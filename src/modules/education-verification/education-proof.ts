import "server-only";

import { z } from "zod";

import { EDUCATION_PROOF_UPLOAD_POLICY, validateUploadedFile } from "@/lib/file-upload";
import { getPHTimeString } from "@/lib/utils";
import { classifySchoolRoute } from "@/modules/school-request-routing/records";

export const EDUCATION_PROOF_ERROR_CODES = [
  "INVALID_INPUT",
  "NOT_FOUND",
  "CONFLICT",
  "DEPENDENCY_FAILURE",
] as const;

export type EducationProofErrorCode = (typeof EDUCATION_PROOF_ERROR_CODES)[number];

export class EducationProofError extends Error {
  public readonly name = "EducationProofError";

  constructor(
    public readonly code: EducationProofErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

function proofError(code: EducationProofErrorCode, message: string): EducationProofError {
  return new EducationProofError(code, message);
}

export const EDUCATION_PROOF_DOCUMENT_TYPES = ["SCHOOL_ID", "DIPLOMA", "TOR", "OTHER"] as const;

export type EducationProofDocumentType = (typeof EDUCATION_PROOF_DOCUMENT_TYPES)[number];

export interface EducationProofDocumentInput {
  readonly documentType: EducationProofDocumentType;
  readonly file: File;
}

export interface SubmitEducationProofInput {
  readonly userId: number;
  readonly educationId: number;
  readonly documents: readonly EducationProofDocumentInput[];
}

export interface SubmitEducationProofResult {
  readonly schoolRequestId: number;
  readonly requestStatus: "Pending" | "RoutedToSchool";
}

const DIRECTUS_BASE = (process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/$/u,
  "",
);
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function directusHeaders(json: boolean): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (json) headers["Content-Type"] = "application/json";
  if (DIRECTUS_TOKEN) headers.Authorization = `Bearer ${DIRECTUS_TOKEN}`;
  return headers;
}

function dependencyFailure(operation: string): EducationProofError {
  return proofError("DEPENDENCY_FAILURE", `Education verification storage failed during ${operation}.`);
}

const educationRowSchema = z.object({
  employee_education_id: z.number().int(),
  user_id: z.number().int(),
  education_status: z.enum(["Pending", "Verified", "Unverified"]),
});

const claimRowSchema = z.object({
  school_request_id: z.number().int(),
  request_status: z.string(),
  matched_school_id: z.number().int().nullable(),
  requested_by: z.number().int(),
});

const fileUploadResponseSchema = z.object({
  data: z.object({ id: z.string().min(1) }),
});

const documentInsertResponseSchema = z.object({
  data: z.object({ document_id: z.number().int() }),
});

const bulkPatchResponseSchema = z.object({
  data: z.array(
    z.object({
      school_request_id: z.number().int(),
      request_status: z.string(),
    }),
  ),
});

interface ResolvedClaim {
  readonly schoolRequestId: number;
  readonly matchedSchoolId: number | null;
  readonly requestedBy: number;
}

async function fetchEducationOwner(
  educationId: number,
): Promise<{ userId: number; educationStatus: "Pending" | "Verified" | "Unverified" }> {
  if (!DIRECTUS_BASE) throw dependencyFailure("education.lookup.configuration");
  const query = new URLSearchParams({
    "filter[employee_education_id][_eq]": String(educationId),
    fields: "employee_education_id,user_id,education_status",
    limit: "2",
  });
  let response: Response;
  try {
    response = await fetch(`${DIRECTUS_BASE}/items/vs_employee_education?${query.toString()}`, {
      headers: directusHeaders(false),
      cache: "no-store",
    });
  } catch (error: unknown) {
    throw new EducationProofError("DEPENDENCY_FAILURE", "Education verification storage is unavailable.", {
      cause: error,
    });
  }
  if (!response.ok) throw dependencyFailure("education.lookup");
  let body: unknown;
  try {
    body = await response.json();
  } catch (error: unknown) {
    throw new EducationProofError("DEPENDENCY_FAILURE", "Education verification storage is unavailable.", {
      cause: error,
    });
  }
  const parsed = z.object({ data: z.array(educationRowSchema) }).safeParse(body);
  if (!parsed.success) throw dependencyFailure("education.lookup.response");
  if (parsed.data.data.length !== 1) {
    throw proofError("NOT_FOUND", "Linked education was not found.");
  }
  const row = parsed.data.data[0];
  if (row === undefined) throw proofError("NOT_FOUND", "Linked education was not found.");
  return { userId: row.user_id, educationStatus: row.education_status };
}

async function resolveActiveClaim(educationId: number): Promise<ResolvedClaim> {
  if (!DIRECTUS_BASE) throw dependencyFailure("claim.lookup.configuration");
  const query = new URLSearchParams({
    "filter[employee_education_id][_eq]": String(educationId),
    fields: "school_request_id,request_status,matched_school_id,requested_by",
    limit: "-1",
  });
  let response: Response;
  try {
    response = await fetch(`${DIRECTUS_BASE}/items/vs_school_request?${query.toString()}`, {
      headers: directusHeaders(false),
      cache: "no-store",
    });
  } catch (error: unknown) {
    throw new EducationProofError("DEPENDENCY_FAILURE", "Education verification storage is unavailable.", {
      cause: error,
    });
  }
  if (!response.ok) throw dependencyFailure("claim.lookup");
  let body: unknown;
  try {
    body = await response.json();
  } catch (error: unknown) {
    throw new EducationProofError("DEPENDENCY_FAILURE", "Education verification storage is unavailable.", {
      cause: error,
    });
  }
  const parsed = z.object({ data: z.array(claimRowSchema) }).safeParse(body);
  if (!parsed.success) throw dependencyFailure("claim.lookup.response");
  const rows = parsed.data.data;
  const awaiting = rows.filter((row) => row.request_status === "AwaitingOptIn");
  if (awaiting.length === 1) {
    const claim = awaiting[0];
    if (claim === undefined) throw proofError("NOT_FOUND", "No pending verification claim was found.");
    return {
      schoolRequestId: claim.school_request_id,
      matchedSchoolId: claim.matched_school_id,
      requestedBy: claim.requested_by,
    };
  }
  if (awaiting.length > 1) {
    throw proofError("CONFLICT", "This education is already under review.");
  }
  const underReview = rows.some(
    (row) => row.request_status === "Pending" || row.request_status === "RoutedToSchool" || row.request_status === "Approved",
  );
  if (underReview) {
    throw proofError("CONFLICT", "This education is already under review.");
  }
  throw proofError("NOT_FOUND", "No pending verification claim was found.");
}

async function uploadProofFile(file: File): Promise<string> {
  if (!DIRECTUS_BASE) throw dependencyFailure("file.upload.configuration");
  const form = new FormData();
  form.append("file", file, file.name);
  const headers: Record<string, string> = {};
  if (DIRECTUS_TOKEN) headers.Authorization = `Bearer ${DIRECTUS_TOKEN}`;
  let response: Response;
  try {
    response = await fetch(`${DIRECTUS_BASE}/files`, {
      method: "POST",
      headers,
      body: form,
    });
  } catch (error: unknown) {
    throw new EducationProofError("DEPENDENCY_FAILURE", "Education verification storage is unavailable.", {
      cause: error,
    });
  }
  if (!response.ok) throw dependencyFailure("file.upload");
  let body: unknown;
  try {
    body = await response.json();
  } catch (error: unknown) {
    throw new EducationProofError("DEPENDENCY_FAILURE", "Education verification storage is unavailable.", {
      cause: error,
    });
  }
  const parsed = fileUploadResponseSchema.safeParse(body);
  if (!parsed.success) throw dependencyFailure("file.upload.response");
  return parsed.data.data.id;
}

async function insertDocumentRow(input: {
  readonly schoolRequestId: number;
  readonly educationId: number;
  readonly documentType: EducationProofDocumentType;
  readonly directusFileId: string;
  readonly uploadedBy: number;
  readonly uploadedAt: string;
}): Promise<number> {
  if (!DIRECTUS_BASE) throw dependencyFailure("document.insert.configuration");
  let response: Response;
  try {
    response = await fetch(`${DIRECTUS_BASE}/items/vs_education_document`, {
      method: "POST",
      headers: directusHeaders(true),
      body: JSON.stringify({
        school_request_id: input.schoolRequestId,
        employee_education_id: input.educationId,
        document_type: input.documentType,
        directus_file_id: input.directusFileId,
        uploaded_by: input.uploadedBy,
        uploaded_at: input.uploadedAt,
      }),
    });
  } catch (error: unknown) {
    throw new EducationProofError("DEPENDENCY_FAILURE", "Education verification storage is unavailable.", {
      cause: error,
    });
  }
  if (!response.ok) throw dependencyFailure("document.insert");
  let body: unknown;
  try {
    body = await response.json();
  } catch (error: unknown) {
    throw new EducationProofError("DEPENDENCY_FAILURE", "Education verification storage is unavailable.", {
      cause: error,
    });
  }
  const parsed = documentInsertResponseSchema.safeParse(body);
  if (!parsed.success) throw dependencyFailure("document.insert.response");
  return parsed.data.data.document_id;
}

async function promoteClaim(input: {
  readonly schoolRequestId: number;
  readonly requestStatus: "Pending" | "RoutedToSchool";
  readonly routedAt: string | null;
}): Promise<void> {
  if (!DIRECTUS_BASE) throw dependencyFailure("claim.promote.configuration");
  const query = new URLSearchParams({
    fields: "school_request_id,request_status",
  });
  let response: Response;
  try {
    response = await fetch(`${DIRECTUS_BASE}/items/vs_school_request?${query.toString()}`, {
      method: "PATCH",
      headers: directusHeaders(true),
      body: JSON.stringify({
        data: {
          request_status: input.requestStatus,
          routed_at: input.routedAt,
          routed_by: null,
        },
        query: {
          filter: {
            school_request_id: { _eq: input.schoolRequestId },
            request_status: { _eq: "AwaitingOptIn" },
          },
        },
      }),
    });
  } catch (error: unknown) {
    throw new EducationProofError("DEPENDENCY_FAILURE", "Education verification storage is unavailable.", {
      cause: error,
    });
  }
  if (!response.ok) {
    if (response.status === 404) {
      throw proofError("CONFLICT", "This education is already under review.");
    }
    throw dependencyFailure("claim.promote");
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error: unknown) {
    throw new EducationProofError("DEPENDENCY_FAILURE", "Education verification storage is unavailable.", {
      cause: error,
    });
  }
  const parsed = bulkPatchResponseSchema.safeParse(body);
  if (!parsed.success) throw dependencyFailure("claim.promote.response");
  if (parsed.data.data.length !== 1) {
    throw proofError("CONFLICT", "This education is already under review.");
  }
}

async function cleanupArtifacts(documentIds: readonly number[], fileIds: readonly string[]): Promise<void> {
  if (!DIRECTUS_BASE) return;
  for (const documentId of documentIds) {
    try {
      await fetch(`${DIRECTUS_BASE}/items/vs_education_document/${documentId}`, {
        method: "DELETE",
        headers: directusHeaders(false),
      });
    } catch (error: unknown) {
      console.warn("[education-proof] Failed to delete document row during cleanup:", error);
    }
  }
  for (const fileId of fileIds) {
    try {
      await fetch(`${DIRECTUS_BASE}/files/${fileId}`, {
        method: "DELETE",
        headers: directusHeaders(false),
      });
    } catch (error: unknown) {
      console.warn("[education-proof] Failed to delete file during cleanup:", error);
    }
  }
}

function validateInput(input: SubmitEducationProofInput): void {
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0) {
    throw proofError("INVALID_INPUT", "A valid user is required.");
  }
  if (!Number.isSafeInteger(input.educationId) || input.educationId <= 0) {
    throw proofError("INVALID_INPUT", "A valid education is required.");
  }
  if (input.documents.length < 1 || input.documents.length > 5) {
    throw proofError("INVALID_INPUT", "Submit between 1 and 5 proof documents.");
  }
  const totalBytes = input.documents.reduce((sum, document) => sum + document.file.size, 0);
  if (totalBytes > 25 * 1024 * 1024) {
    throw proofError("INVALID_INPUT", "Keep the total upload under 25 MB.");
  }
  for (const document of input.documents) {
    if (!EDUCATION_PROOF_DOCUMENT_TYPES.includes(document.documentType)) {
      throw proofError("INVALID_INPUT", "Unsupported proof document type.");
    }
    if (!(document.file instanceof File)) {
      throw proofError("INVALID_INPUT", "A valid file is required.");
    }
  }
}

export async function submitEducationProof(
  input: SubmitEducationProofInput,
): Promise<SubmitEducationProofResult> {
  validateInput(input);

  for (const document of input.documents) {
    try {
      await validateUploadedFile(document.file, EDUCATION_PROOF_UPLOAD_POLICY);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw proofError("INVALID_INPUT", error.message);
      }
      throw proofError("INVALID_INPUT", "Invalid proof document.");
    }
  }

  const education = await fetchEducationOwner(input.educationId);
  if (education.userId !== input.userId) {
    throw proofError("NOT_FOUND", "Linked education was not found.");
  }
  if (education.educationStatus !== "Pending") {
    throw proofError("CONFLICT", "This education is already under review.");
  }

  const claim = await resolveActiveClaim(input.educationId);
  if (claim.requestedBy !== input.userId) {
    throw proofError("NOT_FOUND", "No pending verification claim was found.");
  }

  if (claim.matchedSchoolId === null) {
    throw proofError("CONFLICT", "This school can't review your education yet.");
  }
  let classification: string | null;
  try {
    classification = await classifySchoolRoute(claim.matchedSchoolId);
  } catch (error: unknown) {
    throw new EducationProofError("DEPENDENCY_FAILURE", "Education verification storage is unavailable.", {
      cause: error,
    });
  }
  if (classification !== "DIRECT_REVIEW") {
    throw proofError("CONFLICT", "This school can't review your education yet.");
  }

  const uploadedFileIds: string[] = [];
  const insertedDocumentIds: number[] = [];
  try {
    for (const document of input.documents) {
      const fileId = await uploadProofFile(document.file);
      uploadedFileIds.push(fileId);
      const documentId = await insertDocumentRow({
        schoolRequestId: claim.schoolRequestId,
        educationId: input.educationId,
        documentType: document.documentType,
        directusFileId: fileId,
        uploadedBy: input.userId,
        uploadedAt: getPHTimeString(),
      });
      insertedDocumentIds.push(documentId);
    }

    try {
      await promoteClaim({
        schoolRequestId: claim.schoolRequestId,
        requestStatus: "RoutedToSchool",
        routedAt: getPHTimeString(),
      });
    } catch (error: unknown) {
      await cleanupArtifacts(insertedDocumentIds, uploadedFileIds);
      throw error;
    }

    return { schoolRequestId: claim.schoolRequestId, requestStatus: "RoutedToSchool" };
  } catch (error: unknown) {
    if (error instanceof EducationProofError) throw error;
    await cleanupArtifacts(insertedDocumentIds, uploadedFileIds);
    throw new EducationProofError("DEPENDENCY_FAILURE", "Education verification storage is unavailable.", {
      cause: error,
    });
  }
}

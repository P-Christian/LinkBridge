import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/authenticated-session";
import {
  REGISTRATION_ID_DOCUMENT_UPLOAD_POLICY,
  REGISTRATION_RESUME_UPLOAD_POLICY,
  safeFileName,
  validateUploadedFile,
} from "@/lib/file-upload";
import { verifyRegistrationAttachmentToken } from "@/modules/auth/registration/registration.attachment.token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_IDENTITY_FOLDER_ID = "e81cc874-8036-4655-8bbb-1524a194866b";
const DEFAULT_RESUME_FOLDER_ID = "c380f14b-75d1-4b61-b2b4-9a6e596f3162";

interface CreatedRecord {
  collection: "vs_identity_verifications" | "vs_job_seeker_resumes";
  id: string | number;
}

class UploadInputError extends Error {}

interface AttachmentSession {
  userId: string | number;
  roleName: string;
}

function normalizedUserId(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  return /^\d+$/u.test(trimmed) ? Number(trimmed) : trimmed;
}

async function resolveAttachmentSession(request: NextRequest): Promise<AttachmentSession | null> {
  const authenticated = await authenticateRequest(request);
  if (authenticated) {
    return { userId: authenticated.userId, roleName: authenticated.roleName };
  }

  const token = request.headers.get("x-registration-attachment-token")?.trim();
  if (!token) return null;
  const payload = await verifyRegistrationAttachmentToken(token);
  if (!payload) return null;
  const userId = normalizedUserId(payload.sub);
  const roleName = String(payload.role ?? "").trim().toUpperCase();
  if (userId === null || !roleName) return null;
  return { userId, roleName };
}

function directusConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = (
    process.env.DIRECTUS_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    ""
  ).replace(/\/$/u, "");
  const token = process.env.DIRECTUS_STATIC_TOKEN?.trim() || "";
  return baseUrl && token ? { baseUrl, token } : null;
}

function jsonHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function optionalFile(formData: FormData, field: string): File | null {
  const value = formData.get(field);
  if (value === null) return null;
  if (!(value instanceof Blob) || typeof (value as Blob & { name?: unknown }).name !== "string") {
    throw new UploadInputError(`${field} must be a file.`);
  }
  return value as File;
}

async function hasExistingRecord(
  baseUrl: string,
  token: string,
  collection: CreatedRecord["collection"],
  userId: string | number,
  type?: string,
): Promise<boolean> {
  const params = new URLSearchParams({
    "filter[user_id][_eq]": String(userId),
    fields: "id",
    limit: "1",
  });
  if (type) params.set("filter[type][_eq]", type);

  const response = await fetch(`${baseUrl}/items/${collection}?${params.toString()}`, {
    headers: jsonHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Could not check existing ${collection} records.`);
  const json = (await response.json()) as { data?: Array<{ id?: string | number }> };
  return Boolean(json.data?.length);
}

async function uploadFile(
  baseUrl: string,
  token: string,
  file: File,
  folderId: string,
): Promise<string> {
  const body = new FormData();
  body.append("file", file, safeFileName(file.name));
  const response = await fetch(`${baseUrl}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Directus file upload failed with HTTP ${response.status}.`);
  const json = (await response.json()) as { data?: { id?: string } };
  if (!json.data?.id) throw new Error("Directus returned no uploaded file ID.");
  const fileId = json.data.id;

  const folderResponse = await fetch(`${baseUrl}/files/${encodeURIComponent(fileId)}`, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify({ folder: folderId }),
    cache: "no-store",
  });
  if (!folderResponse.ok) {
    try {
      await fetch(`${baseUrl}/files/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
        headers: jsonHeaders(token),
        cache: "no-store",
      });
    } catch {
      // Preserve the folder-assignment error; rollback was attempted here
      // because the caller has not received the file ID yet.
    }
    throw new Error(`Could not assign the protected upload folder (HTTP ${folderResponse.status}).`);
  }

  return fileId;
}

async function createRecord(
  baseUrl: string,
  token: string,
  collection: CreatedRecord["collection"],
  data: Record<string, unknown>,
): Promise<CreatedRecord> {
  const response = await fetch(`${baseUrl}/items/${collection}`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Could not save ${collection} metadata.`);
  const json = (await response.json()) as { data?: { id?: string | number } };
  if (json.data?.id === undefined || json.data.id === null) {
    throw new Error(`Directus returned no ${collection} record ID.`);
  }
  return { collection, id: json.data.id };
}

async function rollback(
  baseUrl: string,
  token: string,
  records: CreatedRecord[],
  fileIds: string[],
): Promise<void> {
  for (const record of [...records].reverse()) {
    try {
      const response = await fetch(
        `${baseUrl}/items/${record.collection}/${encodeURIComponent(String(record.id))}`,
        { method: "DELETE", headers: jsonHeaders(token), cache: "no-store" },
      );
      if (!response.ok) console.error("Registration attachment record rollback failed", response.status);
    } catch (error) {
      console.error("Registration attachment record rollback failed", error);
    }
  }
  for (const fileId of [...fileIds].reverse()) {
    try {
      const response = await fetch(`${baseUrl}/files/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
        headers: jsonHeaders(token),
        cache: "no-store",
      });
      if (!response.ok) console.error("Registration attachment file rollback failed", response.status);
    } catch (error) {
      console.error("Registration attachment file rollback failed", error);
    }
  }
}

export async function POST(request: NextRequest) {
  const session = await resolveAttachmentSession(request);
  if (!session) return errorResponse("Unauthorized.", 401);

  const isClient = session.roleName === "CLIENT" || session.roleName === "EMPLOYER";
  const isFreelancer = session.roleName === "FREELANCER";
  if (!isClient && !isFreelancer) {
    return errorResponse("Registration attachments are only available for client and freelancer accounts.", 403);
  }

  const config = directusConfig();
  if (!config) return errorResponse("File upload is not configured.", 503);

  const createdFiles: string[] = [];
  const createdRecords: CreatedRecord[] = [];
  try {
    const formData = await request.formData();
    const govIdType = String(formData.get("govIdType") ?? "").trim();
    const govIdFront = optionalFile(formData, "govIdFront");
    const govIdSecondary = optionalFile(formData, "govIdSecondary");
    const resume = optionalFile(formData, "resume");
    const hasGovernmentId = Boolean(govIdFront || govIdSecondary || govIdType);

    if (resume && !isFreelancer) throw new UploadInputError("Resume upload requires a freelancer account.");
    if (hasGovernmentId && (!govIdType || !govIdFront)) {
      throw new UploadInputError("Government ID type and front document are required.");
    }
    if (isFreelancer && hasGovernmentId && !govIdSecondary) {
      throw new UploadInputError("Government ID selfie or secondary image is required.");
    }
    if (!hasGovernmentId && !resume) throw new UploadInputError("No registration attachments were provided.");
    if (govIdType.length > 100) throw new UploadInputError("Government ID type is too long.");

    if (govIdFront) await validateUploadedFile(govIdFront, REGISTRATION_ID_DOCUMENT_UPLOAD_POLICY);
    if (govIdSecondary) await validateUploadedFile(govIdSecondary, REGISTRATION_ID_DOCUMENT_UPLOAD_POLICY);
    if (resume) await validateUploadedFile(resume, REGISTRATION_RESUME_UPLOAD_POLICY);

    const identityExists = hasGovernmentId
      ? await hasExistingRecord(
          config.baseUrl,
          config.token,
          "vs_identity_verifications",
          session.userId,
          "gov_id",
        )
      : false;
    const resumeExists = resume
      ? await hasExistingRecord(
          config.baseUrl,
          config.token,
          "vs_job_seeker_resumes",
          session.userId,
        )
      : false;

    let identityUploaded = false;
    let resumeUploaded = false;

    if (hasGovernmentId && !identityExists && govIdFront) {
      const identityFolder =
        process.env.DIRECTUS_PROTECTED_IDENTITY_FOLDER_ID?.trim() ||
        process.env.DIRECTUS_PROTECTED_FREELANCER_IDENTITY_FOLDER_ID?.trim() ||
        process.env.DIRECTUS_FREELANCER_IDENTITY_FOLDER_ID?.trim() ||
        DEFAULT_IDENTITY_FOLDER_ID;
      const frontId = await uploadFile(config.baseUrl, config.token, govIdFront, identityFolder);
      createdFiles.push(frontId);
      const secondaryId = govIdSecondary
        ? await uploadFile(config.baseUrl, config.token, govIdSecondary, identityFolder)
        : null;
      if (secondaryId) createdFiles.push(secondaryId);

      createdRecords.push(await createRecord(
        config.baseUrl,
        config.token,
        "vs_identity_verifications",
        {
          user_id: session.userId,
          type: "gov_id",
          status: "pending",
          submitted_at: new Date().toISOString(),
          gov_id_type: govIdType,
          gov_id_front_image_uuid: frontId,
          ...(isClient
            ? { gov_id_back_image_uuid: secondaryId }
            : { gov_id_selfie_image_uuid: secondaryId }),
        },
      ));
      identityUploaded = true;
    }

    if (resume && !resumeExists) {
      const resumeFolder =
        process.env.DIRECTUS_PROTECTED_FREELANCER_RESUMES_FOLDER_ID?.trim() ||
        process.env.DIRECTUS_PROTECTED_RESUME_FOLDER_ID?.trim() ||
        process.env.DIRECTUS_RESUME_FOLDER_ID?.trim() ||
        DEFAULT_RESUME_FOLDER_ID;
      const resumeId = await uploadFile(config.baseUrl, config.token, resume, resumeFolder);
      createdFiles.push(resumeId);
      createdRecords.push(await createRecord(
        config.baseUrl,
        config.token,
        "vs_job_seeker_resumes",
        {
          user_id: session.userId,
          file_url: resumeId,
          file_name: safeFileName(resume.name),
          is_primary: true,
        },
      ));
      resumeUploaded = true;
    }

    return NextResponse.json(
      {
        ok: true,
        uploaded: { identity: identityUploaded, resume: resumeUploaded },
        alreadyPresent: { identity: identityExists, resume: resumeExists },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    await rollback(config.baseUrl, config.token, createdRecords, createdFiles);
    if (error instanceof UploadInputError) return errorResponse(error.message, 400);
    if (error instanceof Error && /empty|exceeds|unsupported|content does not match/iu.test(error.message)) {
      return errorResponse(error.message, 400);
    }
    console.error("Registration attachment upload failed", error);
    return errorResponse("Registration files could not be uploaded. Please try again.", 502);
  }
}

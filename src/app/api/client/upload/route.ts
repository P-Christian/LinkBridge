import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  isClientSession,
} from "@/lib/authenticated-session";
import {
  CLIENT_DOCUMENT_UPLOAD_POLICY,
  CLIENT_IMAGE_UPLOAD_POLICY,
  getUploadedFile,
  safeFileName,
  validateUploadedFile,
} from "@/lib/file-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCUMENT_TYPES = new Map(
  [
    "DTI_REGISTRATION",
    "SEC_REGISTRATION",
    "CDA_REGISTRATION",
    "DTI_SEC_REGISTRATION",
    "BIR_2303",
    "TIN_DOCUMENT",
    "MAYORS_PERMIT",
    "BUSINESS_PERMIT",
    "AUTH_REP_ID",
    "GOV_ID",
    "REPRESENTATIVE_ID",
    "ARTICLES_OF_INCORPORATION",
    "SECRETARY_CERTIFICATE",
    "BOARD_RESOLUTION",
    "GIS",
    "OTHER_DOCUMENT",
    "OTHER",
    "VERIFICATION DOCUMENTS",
  ].map((value) => [value, value]),
);

const EQUIVALENT_TYPE_MAP: Record<string, string[]> = {
  DTI_REGISTRATION: ["DTI_REGISTRATION", "DTI_SEC_REGISTRATION"],
  SEC_REGISTRATION: ["SEC_REGISTRATION", "DTI_SEC_REGISTRATION"],
  CDA_REGISTRATION: ["CDA_REGISTRATION", "DTI_SEC_REGISTRATION"],
  DTI_SEC_REGISTRATION: ["DTI_REGISTRATION", "SEC_REGISTRATION", "CDA_REGISTRATION", "DTI_SEC_REGISTRATION"],
  BIR_2303: ["BIR_2303", "TIN_DOCUMENT"],
  TIN_DOCUMENT: ["BIR_2303", "TIN_DOCUMENT"],
  MAYORS_PERMIT: ["MAYORS_PERMIT", "BUSINESS_PERMIT"],
  BUSINESS_PERMIT: ["MAYORS_PERMIT", "BUSINESS_PERMIT"],
  AUTH_REP_ID: ["AUTH_REP_ID", "GOV_ID", "REPRESENTATIVE_ID"],
  GOV_ID: ["AUTH_REP_ID", "GOV_ID", "REPRESENTATIVE_ID"],
  REPRESENTATIVE_ID: ["AUTH_REP_ID", "GOV_ID", "REPRESENTATIVE_ID"],
};

interface DirectusCompanyLink {
  company_id?: string | number | { company_id?: string | number } | null;
}

interface DirectusCompanyDocument {
  company_document_id?: string | number | null;
  directus_file_id?: string | null;
}

function getDirectusConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = (
    process.env.DIRECTUS_URL?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || ""
  ).replace(/\/$/u, "");
  const token = process.env.DIRECTUS_STATIC_TOKEN?.trim() || "";
  return baseUrl && token ? { baseUrl, token } : null;
}

function getHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function getCompanyId(value: DirectusCompanyLink["company_id"]): string | number | null {
  if (typeof value === "object" && value !== null) return value.company_id ?? null;
  return value ?? null;
}

async function resolveClientCompany(
  baseUrl: string,
  token: string,
  userId: string | number,
): Promise<{ companyId: string | number | null; unavailable: boolean }> {
  const params = new URLSearchParams({
    "filter[user_id][_eq]": String(userId),
    fields: "company_id,company_user_role,status",
    limit: "10",
  });
  const response = await fetch(`${baseUrl}/items/vs_company_user?${params.toString()}`, {
    headers: getHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) return { companyId: null, unavailable: true };
  const json = (await response.json()) as { data?: DirectusCompanyLink[] };
  const links = Array.isArray(json.data) ? json.data : [];
  return {
    companyId: links.map((link) => getCompanyId(link.company_id)).find((id) => id !== null) ?? null,
    unavailable: false,
  };
}

async function resolveProtectedClientFolder(baseUrl: string, token: string): Promise<string | null> {
  const configured = (
    process.env.DIRECTUS_PROTECTED_CLIENT_DOCUMENTS_FOLDER_ID?.trim() ||
    process.env.DIRECTUS_CLIENT_DOCUMENTS_FOLDER_ID?.trim() ||
    ""
  );
  if (configured) return configured;

  // The folder must already exist and be configured as protected by the
  // project owner. Never create a folder from an upload request.
  const params = new URLSearchParams({
    "filter[name][_eq]": "client_documents",
    fields: "id,name",
    limit: "1",
  });
  const response = await fetch(`${baseUrl}/folders?${params.toString()}`, {
    headers: getHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { data?: Array<{ id?: string }> };
  return json.data?.[0]?.id ?? null;
}

async function deleteDirectusFile(baseUrl: string, token: string, fileId: string): Promise<void> {
  try {
    await fetch(`${baseUrl}/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: getHeaders(token),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Failed to compensate uploaded client document:", error);
  }
}

async function cleanupPreviousDocument(
  baseUrl: string,
  token: string,
  companyId: string | number,
  documentType: string,
  replacementFileId: string,
): Promise<void> {
  const typesToClean = EQUIVALENT_TYPE_MAP[documentType] || [documentType];
  const params = new URLSearchParams({
    "filter[company_id][_eq]": String(companyId),
    "filter[document_type][_in]": typesToClean.join(","),
    fields: "company_document_id,directus_file_id",
    limit: "100",
  });
  const response = await fetch(`${baseUrl}/items/vs_company_document?${params.toString()}`, {
    headers: getHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) return;
  const json = (await response.json()) as { data?: DirectusCompanyDocument[] };
  for (const record of json.data ?? []) {
    // The replacement row is included because cleanup runs after the new
    // metadata write. Keep it and only remove prior rows/files.
    if (record.directus_file_id === replacementFileId) continue;
    if (record.company_document_id !== null && record.company_document_id !== undefined) {
      await fetch(
        `${baseUrl}/items/vs_company_document/${encodeURIComponent(String(record.company_document_id))}`,
        { method: "DELETE", headers: getHeaders(token), cache: "no-store" },
      );
    }
    if (record.directus_file_id) {
      await deleteDirectusFile(baseUrl, token, record.directus_file_id);
    }
  }
}

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const session = await authenticateRequest(req);
  if (!session) return errorResponse("Unauthorized.", 401);
  if (!isClientSession(session)) return errorResponse("Client account required.", 403);

  const config = getDirectusConfig();
  if (!config) return errorResponse("Document upload is not configured.", 503);

  let uploadedFileId: string | null = null;
  try {
    const formData = await req.formData();
    const file = getUploadedFile(formData);
    const requestedDocumentType = String(formData.get("documentType") ?? "").trim();
    const documentType = requestedDocumentType
      ? DOCUMENT_TYPES.get(requestedDocumentType.toUpperCase())
      : undefined;

    if (requestedDocumentType && !documentType) {
      return errorResponse("Unsupported document type.", 400);
    }

    // A document type selects the protected company-document policy. Without
    // one this endpoint remains compatible with profile/logo image uploads,
    // but caller-supplied companyId/folder values are intentionally ignored.
    if (documentType) {
      await validateUploadedFile(file, CLIENT_DOCUMENT_UPLOAD_POLICY);
    } else {
      await validateUploadedFile(file, CLIENT_IMAGE_UPLOAD_POLICY);
    }

    const directusFormData = new FormData();
    directusFormData.append("file", file, safeFileName(file.name));

    let companyId: string | number | null = null;
    if (documentType) {
      const link = await resolveClientCompany(config.baseUrl, config.token, session.userId);
      if (link.unavailable) {
        return errorResponse("Your company association could not be read. Please try again.", 502);
      }
      companyId = link.companyId;
      if (companyId === null) return errorResponse("No company is associated with this account.", 403);

      // Verify that company documents can be edited (DRAFT, REJECTED, or CORRECTION_REQUIRED)
      const compUrl = `${config.baseUrl}/items/vs_company/${companyId}?fields=verification_status`;
      const compRes = await fetch(compUrl, { headers: getHeaders(config.token), cache: "no-store" });
      if (!compRes.ok) return errorResponse("Failed to verify company status.", 502);
      const compJson = (await compRes.json()) as { data?: { verification_status?: string } };
      const verifStatus = String(compJson.data?.verification_status || "").toUpperCase();

      const editableStatuses = ["DRAFT", "REJECTED"];
      let canEditDocuments = editableStatuses.includes(verifStatus);

      if (!canEditDocuments) {
        const verifUrl = `${config.baseUrl}/items/vs_company_verifications?filter[company_id][_eq]=${companyId}&sort=-created_at,-id&limit=1&fields=status`;
        const verifRes = await fetch(verifUrl, {
          headers: getHeaders(config.token),
          cache: "no-store",
        });
        if (verifRes.ok) {
          const verifJson = (await verifRes.json()) as { data?: Array<{ status?: string }> };
          const latestWorkflowStatus = String(verifJson.data?.[0]?.status || "").toUpperCase();
          canEditDocuments = latestWorkflowStatus === "CORRECTION_REQUIRED";
        }
      }

      if (!canEditDocuments) {
        return errorResponse(
          "Documents cannot be uploaded while your profile is under review or has been verified.",
          403,
        );
      }

      const folder = await resolveProtectedClientFolder(config.baseUrl, config.token);
      if (!folder) {
        return errorResponse("Protected client document storage is not configured.", 503);
      }
      directusFormData.append("folder", folder);
    }

    const uploadResponse = await fetch(`${config.baseUrl}/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}` },
      body: directusFormData,
      cache: "no-store",
    });
    if (!uploadResponse.ok) {
      return errorResponse("Failed to upload file to storage.", uploadResponse.status >= 500 ? 502 : uploadResponse.status);
    }

    const uploadJson = (await uploadResponse.json()) as { data?: { id?: string } };
    uploadedFileId = uploadJson.data?.id ?? null;
    if (!uploadedFileId) throw new Error("Directus returned no uploaded file ID.");

    if (documentType && companyId !== null) {
      const metadataResponse = await fetch(`${config.baseUrl}/items/vs_company_document`, {
        method: "POST",
        headers: getHeaders(config.token),
        body: JSON.stringify({
          company_id: companyId,
          document_type: documentType,
          document_name: safeFileName(file.name),
          directus_file_id: uploadedFileId,
          uploaded_by_user_id: session.userId,
          uploaded_at: new Date().toISOString(),
        }),
        cache: "no-store",
      });

      if (!metadataResponse.ok) {
        await deleteDirectusFile(config.baseUrl, config.token, uploadedFileId);
        uploadedFileId = null;
        return errorResponse("Uploaded file metadata could not be saved.", 502);
      }

      if (documentType !== "OTHER_DOCUMENT") {
        try {
          await cleanupPreviousDocument(
            config.baseUrl,
            config.token,
            companyId,
            documentType,
            uploadedFileId,
          );
        } catch (error) {
          // The new document is valid even if best-effort old-file cleanup is
          // unavailable. It must never make the successful upload disappear.
          console.error("Failed to clean up replaced client document:", error);
        }
      }
    }

    return NextResponse.json(uploadJson.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    if (uploadedFileId) await deleteDirectusFile(config.baseUrl, config.token, uploadedFileId);
    console.error("Upload API route error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = /required|unsupported|empty|exceeds|content does not match/iu.test(message) ? 400 : 502;
    return errorResponse(status === 400 ? message : "File upload could not be completed.", status);
  }
}

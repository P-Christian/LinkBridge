import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CompanyDoc {
  company_document_id?: number | string;
  company_id: number | string | { company_id?: number | string };
  document_type: string;
  document_name: string;
  directus_file_id: string;
  uploaded_by_user_id?: number | null;
  uploaded_at?: string;
}
interface DirectusFile {
  id: string;
  filesize?: number | string;
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
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function companyIdOf(value: CompanyDoc["company_id"]): string | number | null {
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
    fields: "company_id",
    limit: "10",
  });
  const response = await fetch(`${baseUrl}/items/vs_company_user?${params.toString()}`, {
    headers: getHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) return { companyId: null, unavailable: true };
  const json = (await response.json()) as { data?: Array<{ company_id?: CompanyDoc["company_id"] }> };
  for (const link of json.data ?? []) {
    const id = companyIdOf(link.company_id as CompanyDoc["company_id"]);
    if (id !== null) return { companyId: id, unavailable: false };
  }
  return { companyId: null, unavailable: false };
}

function sameId(left: unknown, right: unknown): boolean {
  return left !== null && left !== undefined && right !== null && right !== undefined && String(left) === String(right);
}

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  const session = await authenticateRequest(req);
  if (!session) return errorResponse("Unauthorized.", 401);
  if (!isClientSession(session)) return errorResponse("Client account required.", 403);

  const config = getDirectusConfig();
  if (!config) return errorResponse("Directus base URL not configured.", 503);

  try {
    // The query-string companyId is a legacy UI hint only. Authorization is
    // always resolved from the signed session's current company link.
    const link = await resolveClientCompany(config.baseUrl, config.token, session.userId);
    if (link.unavailable) return errorResponse("Your company association could not be read. Please try again.", 502);
    const companyId = link.companyId;
    if (companyId === null) return errorResponse("No company is associated with this account.", 403);

    const { searchParams } = new URL(req.url);
    const documentType = searchParams.get("documentType");
    const params = new URLSearchParams({
      "filter[company_id][_eq]": String(companyId),
      fields: "*",
      limit: "100",
    });
    if (documentType) params.set("filter[document_type][_eq]", documentType);

    const docsRes = await fetch(`${config.baseUrl}/items/vs_company_document?${params.toString()}`, {
      headers: getHeaders(config.token),
      cache: "no-store",
    });
    if (!docsRes.ok) return errorResponse("Failed to fetch documents.", 502);

    const docsJson = (await docsRes.json()) as { data?: CompanyDoc[] };
    const docs = Array.isArray(docsJson.data) ? docsJson.data : [];
    const fileIds = docs.map((doc) => doc.directus_file_id).filter(Boolean);
    const fileSizes: Record<string, number> = {};

    if (fileIds.length > 0) {
      const filesParams = new URLSearchParams({
        "filter[id][_in]": fileIds.join(","),
        fields: "id,filesize",
        limit: "100",
      });
      const filesRes = await fetch(`${config.baseUrl}/files?${filesParams.toString()}`, {
        headers: getHeaders(config.token),
        cache: "no-store",
      });
      if (filesRes.ok) {
        const filesJson = (await filesRes.json()) as { data?: DirectusFile[] };
        for (const file of filesJson.data ?? []) fileSizes[file.id] = Number(file.filesize ?? 0);
      }
    }

    return NextResponse.json(
      docs.map((doc) => ({
        id: doc.directus_file_id,
        document_type: doc.document_type,
        name: doc.document_name,
        size: fileSizes[doc.directus_file_id] || 0,
        uploaded_at: doc.uploaded_at || null,
      })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("GET /api/client/company-profile/documents error:", error);
    return errorResponse("Failed to fetch documents.", 502);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await authenticateRequest(req);
  if (!session) return errorResponse("Unauthorized.", 401);
  if (!isClientSession(session)) return errorResponse("Client account required.", 403);

  const config = getDirectusConfig();
  if (!config) return errorResponse("Directus base URL not configured.", 503);

  try {
    const link = await resolveClientCompany(config.baseUrl, config.token, session.userId);
    if (link.unavailable) return errorResponse("Your company association could not be read. Please try again.", 502);
    const companyId = link.companyId;
    if (companyId === null) return errorResponse("No company is associated with this account.", 403);

    // Safeguard: Only allow deletion if company is DRAFT or REJECTED
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
        "Documents cannot be removed while your profile is under review or has been verified.",
        403
      );
    }

    const fileId = new URL(req.url).searchParams.get("id")?.trim();
    if (!fileId) return errorResponse("Missing document/file ID.", 400);

    const params = new URLSearchParams({
      "filter[directus_file_id][_eq]": fileId,
      fields: "company_document_id,company_id,directus_file_id",
      limit: "100",
    });
    const findRes = await fetch(`${config.baseUrl}/items/vs_company_document?${params.toString()}`, {
      headers: getHeaders(config.token),
      cache: "no-store",
    });
    if (!findRes.ok) return errorResponse("Failed to find document.", 502);
    const findJson = (await findRes.json()) as { data?: CompanyDoc[] };
    const records = (findJson.data ?? []).filter((record) => sameId(companyIdOf(record.company_id), companyId));
    if (records.length === 0) return errorResponse("Document not found.", 404);

    for (const record of records) {
      if (record.company_document_id !== null && record.company_document_id !== undefined) {
        await fetch(
          `${config.baseUrl}/items/vs_company_document/${encodeURIComponent(String(record.company_document_id))}`,
          { method: "DELETE", headers: getHeaders(config.token), cache: "no-store" },
        );
      }
    }

    const deleteFileRes = await fetch(`${config.baseUrl}/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: getHeaders(config.token),
      cache: "no-store",
    });
    if (!deleteFileRes.ok && deleteFileRes.status !== 404) return errorResponse("Failed to delete document.", 502);
    return NextResponse.json({ success: true, message: "Document deleted successfully." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("DELETE /api/client/company-profile/documents error:", error);
    return errorResponse("Failed to delete document.", 502);
  }
}

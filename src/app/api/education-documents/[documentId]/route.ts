import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  authenticateRequest,
  isAdministratorSession,
  isSchoolAdminSession,
} from "@/lib/authenticated-session";
import { requireSchoolAdminSession } from "@/app/api/school-admin/school-requests/_http";
import { safeFileName } from "@/lib/file-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/$/u,
  "",
);
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const documentRowSchema = z.object({
  document_id: z.number().int(),
  school_request_id: z.number().int(),
  employee_education_id: z.number().int(),
  document_type: z.string(),
  directus_file_id: z.string().min(1),
});

const schoolRequestRowSchema = z.object({
  school_request_id: z.number().int(),
  requested_by: z.union([z.number().int(), z.object({ user_id: z.number().int() })]).transform((value) =>
    typeof value === "number" ? value : value.user_id,
  ),
  matched_school_id: z.number().int().nullable(),
  request_status: z.string(),
});

const educationRowSchema = z.object({
  employee_education_id: z.number().int(),
  user_id: z.number().int(),
});

const fileMetadataSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    filename_download: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
  }),
});

function serviceUnavailable(): NextResponse {
  return NextResponse.json({ error: "Education verification storage is unavailable." }, { status: 502 });
}

function directusHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (DIRECTUS_TOKEN) headers.Authorization = `Bearer ${DIRECTUS_TOKEN}`;
  return headers;
}

async function fetchSingle<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<{ ok: true; row: T | null } | { ok: false }> {
  let response: Response;
  try {
    response = await fetch(`${DIRECTUS_BASE}${path}`, {
      headers: directusHeaders(),
      cache: "no-store",
    });
  } catch (error: unknown) {
    console.warn("[education-documents] Directus lookup failed:", error);
    return { ok: false };
  }
  if (response.status === 404) {
    return { ok: true, row: null };
  }
  if (!response.ok) return { ok: false };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false };
  }
  const parsed = z.object({ data: z.array(schema) }).safeParse(body);
  if (!parsed.success) return { ok: false };
  return { ok: true, row: parsed.data.data[0] ?? null };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
): Promise<NextResponse> {
  const session = await authenticateRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!DIRECTUS_BASE || !DIRECTUS_TOKEN) {
    return NextResponse.json({ error: "Directus base URL not configured." }, { status: 500 });
  }

  const { documentId } = await params;
  if (!/^\d+$/u.test(documentId)) {
    return NextResponse.json({ error: "Document was not found." }, { status: 404 });
  }

  const documentQuery = new URLSearchParams({
    "filter[document_id][_eq]": documentId,
    fields: "document_id,school_request_id,employee_education_id,document_type,directus_file_id",
    limit: "1",
  });
  const documentLookup = await fetchSingle(
    `/items/vs_education_document?${documentQuery.toString()}`,
    documentRowSchema,
  );
  if (!documentLookup.ok) return serviceUnavailable();
  if (!documentLookup.row) {
    return NextResponse.json({ error: "Document was not found." }, { status: 404 });
  }
  const document = documentLookup.row;

  const requestQuery = new URLSearchParams({
    "filter[school_request_id][_eq]": String(document.school_request_id),
    fields: "school_request_id,requested_by,matched_school_id,request_status",
    limit: "1",
  });
  const requestLookup = await fetchSingle(
    `/items/vs_school_request?${requestQuery.toString()}`,
    schoolRequestRowSchema,
  );
  if (!requestLookup.ok) return serviceUnavailable();
  if (!requestLookup.row) {
    return NextResponse.json({ error: "Document was not found." }, { status: 404 });
  }
  const schoolRequest = requestLookup.row;

  const educationQuery = new URLSearchParams({
    "filter[employee_education_id][_eq]": String(document.employee_education_id),
    fields: "employee_education_id,user_id",
    limit: "1",
  });
  const educationLookup = await fetchSingle(
    `/items/vs_employee_education?${educationQuery.toString()}`,
    educationRowSchema,
  );
  if (!educationLookup.ok) return serviceUnavailable();
  if (!educationLookup.row) {
    return NextResponse.json({ error: "Document was not found." }, { status: 404 });
  }
  const education = educationLookup.row;

  const sessionUserId = String(session.userId);
  const isOwner =
    String(schoolRequest.requested_by) === sessionUserId && String(education.user_id) === sessionUserId;
  if (!isOwner) {
    if (isAdministratorSession(session)) {
      // Allowed below.
    } else if (isSchoolAdminSession(session)) {
      let schoolId: number | null = null;
      try {
        const context = await requireSchoolAdminSession(req);
        schoolId = context.schoolId;
      } catch (error: unknown) {
        console.warn("[education-documents] School admin context lookup failed:", error);
        return NextResponse.json({ error: "Document was not found." }, { status: 404 });
      }
      if (schoolId === null || schoolRequest.matched_school_id === null || schoolId !== schoolRequest.matched_school_id) {
        return NextResponse.json({ error: "Document was not found." }, { status: 404 });
      }
      if (schoolRequest.request_status !== "RoutedToSchool" && schoolRequest.request_status !== "Approved") {
        return NextResponse.json({ error: "Document was not found." }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: "Document was not found." }, { status: 404 });
    }
  }

  let fileMetadata: { filename: string | null; mimeType: string | null } = { filename: null, mimeType: null };
  try {
    const metadataResponse = await fetch(
      `${DIRECTUS_BASE}/files/${encodeURIComponent(document.directus_file_id)}`,
      { headers: directusHeaders(), cache: "no-store" },
    );
    if (metadataResponse.status === 404) {
      return NextResponse.json({ error: "Document file was not found." }, { status: 404 });
    }
    if (!metadataResponse.ok) return serviceUnavailable();
    const metadataBody: unknown = await metadataResponse.json();
    const parsed = fileMetadataSchema.safeParse(metadataBody);
    if (!parsed.success) return serviceUnavailable();
    fileMetadata = {
      filename: parsed.data.data.filename_download ?? null,
      mimeType: parsed.data.data.type ?? null,
    };
  } catch (error: unknown) {
    console.warn("[education-documents] File metadata lookup failed:", error);
    return serviceUnavailable();
  }

  let assetResponse: Response;
  try {
    assetResponse = await fetch(
      `${DIRECTUS_BASE}/assets/${encodeURIComponent(document.directus_file_id)}`,
      {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        cache: "no-store",
      },
    );
  } catch (error: unknown) {
    console.warn("[education-documents] Asset fetch failed:", error);
    return serviceUnavailable();
  }
  if (assetResponse.status === 404) {
    return NextResponse.json({ error: "Document file was not found." }, { status: 404 });
  }
  if (!assetResponse.ok) return serviceUnavailable();

  const rawContentType =
    assetResponse.headers.get("content-type") || fileMetadata.mimeType || "application/octet-stream";
  const normalizedContentType =
    rawContentType.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
  const isInlineSafe =
    normalizedContentType === "application/pdf" ||
    normalizedContentType === "image/jpeg" ||
    normalizedContentType === "image/png";
  const filename = safeFileName(fileMetadata.filename || `education-document-${document.document_id}`);
  const sanitizedFilename = filename.replace(/"/gu, "");

  const responseHeaders: Record<string, string> = {
    "Content-Type": isInlineSafe ? normalizedContentType : "application/octet-stream",
    "Content-Disposition": isInlineSafe
      ? `inline; filename="${sanitizedFilename}"`
      : `attachment; filename="${sanitizedFilename}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const contentLength = assetResponse.headers.get("content-length");
  if (contentLength) responseHeaders["Content-Length"] = contentLength;

  return new NextResponse(assetResponse.body, {
    status: 200,
    headers: responseHeaders,
  });
}

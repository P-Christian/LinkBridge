import "server-only";

import { z } from "zod";

import { dependencyError, SchoolRequestSchoolAdminError } from "./errors";
import type { SchoolRequestDocument } from "./types";

const DIRECTUS_BASE = (process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/$/u,
  "",
);
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) headers.Authorization = `Bearer ${DIRECTUS_TOKEN}`;
  return headers;
}

/** Persisted `vs_education_document` row subset for inbox expansion. */
const educationDocumentRowSchema = z.object({
  document_id: z.number().int(),
  school_request_id: z.number().int(),
  document_type: z.string(),
  directus_file_id: z.string().min(1),
});

/** Directus file metadata subset. Display fields only, never the raw id. */
const directusFileRowSchema = z.object({
  id: z.string().min(1),
  filename_download: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
});

async function fetchArray<T>(
  operation: string,
  path: string,
  schema: z.ZodType<T>,
): Promise<readonly T[]> {
  if (!DIRECTUS_BASE) throw dependencyError(`${operation}.configuration`);
  try {
    const response = await fetch(`${DIRECTUS_BASE}${path}`, {
      headers: getHeaders(),
      cache: "no-store",
    });
    if (!response.ok) throw dependencyError(operation, response.status);
    const body: unknown = await response.json();
    const parsed = z.object({ data: z.array(schema) }).safeParse(body);
    if (!parsed.success) throw dependencyError(`${operation}.response`);
    return parsed.data.data;
  } catch (error: unknown) {
    if (error instanceof SchoolRequestSchoolAdminError) throw error;
    throw dependencyError(operation, undefined, error);
  }
}

/**
 * Batch proof-document lookup keyed by `school_request_id`. One document-rows
 * query plus one file-metadata query for the whole batch, never per-row N+1.
 * Missing file metadata degrades to display fallbacks; request ids with no
 * rows resolve to an empty list. The Directus file id is consumed only to
 * join metadata and never leaves this module.
 */
export async function fetchDocumentsBySchoolRequestIds(
  requestIds: readonly number[],
): Promise<ReadonlyMap<number, readonly SchoolRequestDocument[]>> {
  const unique = [...new Set(requestIds)].filter((id) => Number.isInteger(id) && id > 0);
  const byRequest = new Map<number, SchoolRequestDocument[]>();
  for (const id of unique) byRequest.set(id, []);
  if (unique.length === 0) return byRequest;

  const rows = await fetchArray(
    "schoolRequest.documents",
    `/items/vs_education_document?${new URLSearchParams({
      "filter[school_request_id][_in]": unique.join(","),
      fields: "document_id,school_request_id,document_type,directus_file_id",
      limit: "-1",
    }).toString()}`,
    educationDocumentRowSchema,
  );

  const fileIds = [...new Set(rows.map((row) => row.directus_file_id))];
  const files =
    fileIds.length === 0
      ? new Map<string, { fileName: string | null; mimeType: string | null }>()
      : new Map(
          (
            await fetchArray(
              "schoolRequest.documentFiles",
              `/files?${new URLSearchParams({
                "filter[id][_in]": fileIds.join(","),
                fields: "id,filename_download,type",
                limit: "-1",
              }).toString()}`,
              directusFileRowSchema,
            )
          ).map((file) => [
            file.id,
            { fileName: file.filename_download ?? null, mimeType: file.type ?? null },
          ]),
        );

  const ordered = [...rows].sort((a, b) => a.document_id - b.document_id);
  for (const row of ordered) {
    const list = byRequest.get(row.school_request_id);
    if (list === undefined) continue;
    const meta = files.get(row.directus_file_id);
    list.push({
      documentId: row.document_id,
      type: row.document_type,
      fileName: meta?.fileName ?? "Document",
      mimeType: meta?.mimeType ?? "application/octet-stream",
      url: `/api/education-documents/${row.document_id}`,
    });
  }
  return byRequest;
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSchoolAdminSession, toErrorResponse } from "../../school-requests/_http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function directusBase(): string {
  return (process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/u, "");
}

function directusHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function readFilterCount(path: string): Promise<number> {
  const base = directusBase();
  if (!base) throw new Error("Directus is not configured.");
  const response = await fetch(`${base}${path}`, { headers: directusHeaders(), cache: "no-store" });
  if (!response.ok) throw new Error(`Directus read failed with status ${String(response.status)}.`);
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null) throw new Error("Malformed summary response.");
  const meta = (body as { meta?: unknown }).meta;
  if (typeof meta !== "object" || meta === null) throw new Error("Malformed summary response.");
  const count = (meta as { filter_count?: unknown }).filter_count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
    throw new Error("Malformed summary count.");
  }
  return count;
}

function schoolCountPath(schoolId: number): string {
  const query = new URLSearchParams();
  query.set("filter[request_status][_eq]", "RoutedToSchool");
  query.set("filter[matched_school_id][_eq]", String(schoolId));
  query.set("limit", "0");
  query.set("meta", "filter_count");
  return `/items/vs_school_request?${query.toString()}`;
}

function courseCountPath(schoolId: number): string {
  const query = new URLSearchParams();
  query.set("filter[school_id][_eq]", String(schoolId));
  query.set("filter[request_status][_eq]", "RoutedToSchool");
  query.set("filter[routed_by][_nnull]", "true");
  query.set("filter[routed_at][_nnull]", "true");
  query.set("filter[matched_school_course_id][_null]", "true");
  query.set("filter[reviewed_by][_null]", "true");
  query.set("filter[reviewed_at][_null]", "true");
  query.set("limit", "0");
  query.set("meta", "filter_count");
  return `/items/vs_course_request?${query.toString()}`;
}

/**
 * GET /api/school-admin/requests/summary
 *
 * Lightweight pending-request counts for the caller's own school. Counts
 * actionable routed rows only: school requests with `RoutedToSchool` plus the
 * caller's `matched_school_id`, and course requests matching the inbox
 * actionable filter set (routed, unclaimed, not yet matched to a catalog
 * course). Any read failure returns 503 with no fabricated zeros.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  let schoolId: number;
  try {
    const session = await requireSchoolAdminSession(req);
    schoolId = session.schoolId;
  } catch (error: unknown) {
    return toErrorResponse(error);
  }
  try {
    const [school, course] = await Promise.all([
      readFilterCount(schoolCountPath(schoolId)),
      readFilterCount(courseCountPath(schoolId)),
    ]);
    return NextResponse.json({ school, course });
  } catch {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }
}

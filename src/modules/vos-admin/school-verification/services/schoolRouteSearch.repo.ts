// src/modules/vos-admin/school-verification/services/schoolRouteSearch.repo.ts
//
// Plan 2 Todo 4: shared server-side school search backing the public
// freelancer search (`/api/freelancer/schools`) and the role-authorized VOS
// correction search (`/api/vos-admin/schools`).
//
// Both surfaces return the same three server-derived selectable states
// (DIRECT_REVIEW | AWAITING_ACTIVATION | AWAITING_REGISTRATION) and exclude
// null/rejected/suspended/inactive/contradictory rows. The classification
// predicate mirrors `classifySchoolRoute` in
// `src/modules/school-request-routing/records.ts:94-113` exactly (same
// VERIFIED+Active+active-admin rule, same fail-closed exclusions), but runs
// over one batched school page plus one batched admin lookup instead of
// per-school round trips. That module is Todo 2-owned and must not be edited
// here, so the predicate is intentionally duplicated with a pinned reference.
//
// Directus access uses URLSearchParams-encoded params only (never raw
// JSON-string interpolation) and every response is Zod-parsed.

import { z } from "zod";

function directusBase(): string {
  return (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).replace(/\/$/, "");
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export const verificationRouteSchema = z.enum([
  "DIRECT_REVIEW",
  "AWAITING_ACTIVATION",
  "AWAITING_REGISTRATION",
]);

export type VerificationRoute = z.infer<typeof verificationRouteSchema>;

const schoolRowSchema = z.object({
  school_id: z.number().int(),
  school_name: z.string(),
  city_municipality: z.string().nullable(),
  province: z.string().nullable(),
  school_status: z.string(),
  verification_status: z.string(),
  is_active: z.union([z.boolean(), z.number(), z.string()]).optional(),
});

const schoolAdminRowSchema = z.object({
  school_id: z.union([
    z.number().int(),
    z.object({ school_id: z.number().int() }),
  ]),
  is_active: z.union([z.boolean(), z.number(), z.string()]).optional(),
});

const collectionSchema = <T extends z.ZodTypeAny>(row: T) =>
  z.object({ data: z.array(row) });

function isActiveFlag(value: unknown): boolean {
  return value === true || value === 1;
}

function activeAdminIdOf(row: z.infer<typeof schoolAdminRowSchema>): number | null {
  const raw = typeof row.school_id === "number" ? row.school_id : row.school_id.school_id;
  return Number.isInteger(raw) ? raw : null;
}

/**
 * Server-derived route classification. Mirrors `classifySchoolRoute`
 * (`school-request-routing/records.ts:94-113`): VERIFIED + Active + truthy
 * `is_active` + at least one active admin => DIRECT_REVIEW; falsy is_active,
 * REJECTED/SUSPENDED/INACTIVE verification, or Inactive/Suspended status =>
 * null (excluded); otherwise an owned school awaits activation and an
 * unowned DRAFT/Draft placeholder awaits registration.
 */
export function classifySearchRow(
  school: z.infer<typeof schoolRowSchema>,
  hasActiveAdmin: boolean,
): VerificationRoute | null {
  if (
    school.verification_status === "VERIFIED" &&
    school.school_status === "Active" &&
    isActiveFlag(school.is_active) &&
    hasActiveAdmin
  ) {
    return "DIRECT_REVIEW";
  }
  if (!isActiveFlag(school.is_active)) return null;
  if (["REJECTED", "SUSPENDED", "INACTIVE"].includes(school.verification_status)) return null;
  if (["Inactive", "Suspended"].includes(school.school_status)) return null;
  if (hasActiveAdmin) return "AWAITING_ACTIVATION";
  if (school.verification_status === "DRAFT" && school.school_status === "Draft") {
    return "AWAITING_REGISTRATION";
  }
  return null;
}

export const classifiedSchoolSchema = z.object({
  school_id: z.number().int(),
  school_name: z.string(),
  city_municipality: z.string().nullable(),
  province: z.string().nullable(),
  school_status: z.string(),
  verification_route: verificationRouteSchema,
});

export type ClassifiedSchool = z.infer<typeof classifiedSchoolSchema>;

/** VOS correction candidate: the LOCKED Todo 4 shape plus the server route. */
export const schoolRouteCandidateSchema = classifiedSchoolSchema;
export type SchoolRouteCandidate = z.infer<typeof schoolRouteCandidateSchema>;

/** Public freelancer candidate: minimal identity plus the server route. */
export const freelancerSchoolSchema = z.object({
  school_id: z.number().int(),
  school_name: z.string(),
  city_municipality: z.string().nullable(),
  province: z.string().nullable(),
  verification_route: verificationRouteSchema,
});

export type FreelancerSchool = z.infer<typeof freelancerSchoolSchema>;

const SEARCH_FIELDS =
  "school_id,school_name,city_municipality,province,school_status,verification_status,is_active";

/** Internal page size (recall); the public response bound stays 20. */
const SEARCH_PAGE_SIZE = 50;

/** Public response bound shared by both search surfaces. */
export const SCHOOL_SEARCH_LIMIT = 20;

/** Blank/whitespace-only input never produces a full dump. */
export function isBlankSearchTerm(value: string | null): boolean {
  return value === null || value.trim().length === 0;
}

async function fetchJson(operation: string, path: string): Promise<unknown> {
  const base = directusBase();
  if (!base) throw new Error(`${operation} is not configured.`);
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      headers: getHeaders(),
      cache: "no-store",
    });
  } catch (error: unknown) {
    throw new Error(`${operation} failed: ${(error as Error).message}`);
  }
  if (!response.ok) {
    throw new Error(`${operation} failed with status ${response.status}.`);
  }
  return response.json() as Promise<unknown>;
}

/**
 * Deterministic classified search: Directus sorts `school_name` ascending
 * then `school_id` ascending before the page cut, classification preserves
 * that order, unclassifiable rows are dropped, and the response is sliced to
 * `SCHOOL_SEARCH_LIMIT`. The search term must already be trimmed and
 * length-checked by the caller.
 */
export async function searchClassifiedSchools(
  term?: string,
): Promise<readonly ClassifiedSchool[]> {
  const query = new URLSearchParams({
    fields: SEARCH_FIELDS,
    sort: "school_name,school_id",
    limit: String(SEARCH_PAGE_SIZE),
  });
  if (term && term.trim()) {
    query.set("filter[_or][0][school_name][_icontains]", term.trim());
    query.set("filter[_or][1][city_municipality][_icontains]", term.trim());
    query.set("filter[_or][2][province][_icontains]", term.trim());
  }
  const body = await fetchJson(
    "searchClassifiedSchools",
    `/items/vs_school?${query.toString()}`,
  );
  const schools = collectionSchema(schoolRowSchema).parse(body).data;

  const ids = schools.map((row) => row.school_id).filter((id) => Number.isInteger(id));
  const activeBySchool = new Map<number, boolean>();
  if (ids.length > 0) {
    const adminQuery = new URLSearchParams({
      "filter[school_id][_in]": ids.join(","),
      "filter[is_active][_eq]": "1",
      fields: "school_id,is_active",
      limit: String(Math.max(ids.length, 1)),
    });
    const adminBody = await fetchJson(
      "searchClassifiedSchools.admins",
      `/items/vs_school_admin?${adminQuery.toString()}`,
    );
    const admins = collectionSchema(schoolAdminRowSchema).parse(adminBody).data;
    for (const admin of admins) {
      const sid = activeAdminIdOf(admin);
      if (sid !== null && isActiveFlag(admin.is_active)) activeBySchool.set(sid, true);
    }
  }

  const classified: ClassifiedSchool[] = [];
  for (const school of schools) {
    const route = classifySearchRow(school, activeBySchool.get(school.school_id) === true);
    if (route === null) continue;
    classified.push({
      school_id: school.school_id,
      school_name: school.school_name,
      city_municipality: school.city_municipality,
      province: school.province,
      school_status: school.school_status,
      verification_route: route,
    });
    if (classified.length >= SCHOOL_SEARCH_LIMIT) break;
  }
  return classifiedSchoolSchema.array().parse(classified);
}

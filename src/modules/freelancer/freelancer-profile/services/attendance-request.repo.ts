import "server-only";

import { z } from "zod";

import { classifySchoolRoute } from "@/modules/school-request-routing/records";
import { releaseGroupedSchoolRequest } from "@/modules/school-request-routing/transitions";

import type { PersistedPendingEducation } from "./education-persistence.repo";

const REQUEST_FIELDS = [
  "school_request_id",
  "requested_by",
  "requested_school_name",
  "city_municipality",
  "province",
  "request_status",
  "matched_school_id",
  "routed_by",
  "routed_at",
  "reviewed_by",
  "reviewed_at",
  "admin_remarks",
  "employee_education_id",
  "active_employee_education_id",
  "created_at",
].join(",");

const schoolSchema = z.object({
  school_id: z.coerce.number().int().positive(),
  school_name: z.string().trim().min(1),
  city_municipality: z.string().nullable(),
  province: z.string().nullable(),
  verification_status: z.string(),
  school_status: z.string(),
});

const requestSchema = z.object({
  school_request_id: z.coerce.number().int().positive(),
  requested_by: z.coerce.number().int().positive(),
  requested_school_name: z.string().trim().min(1),
  city_municipality: z.string().nullable(),
  province: z.string().nullable(),
  request_status: z.enum(["Pending", "Approved", "Rejected", "RoutedToSchool"]),
  matched_school_id: z.coerce.number().int().positive().nullable().optional(),
  routed_by: z.coerce.number().int().positive().nullable().optional(),
  routed_at: z.string().nullable().optional(),
  reviewed_by: z.coerce.number().int().positive().nullable().optional(),
  reviewed_at: z.string().nullable().optional(),
  admin_remarks: z.string().nullable().optional(),
  employee_education_id: z.coerce.number().int().positive(),
  active_employee_education_id: z.coerce.number().int().positive().nullable(),
  created_at: z.string().optional(),
});

export type PersistedAttendanceRequest = z.infer<typeof requestSchema>;

export type AttendanceRequestErrorCode =
  | "AMBIGUOUS"
  | "LINKAGE_INVALID"
  | "INVALID_INPUT"
  | "STALE_CONFLICT"
  | "DEPENDENCY_FAILURE";

export class AttendanceRequestError extends Error {
  public readonly name = "AttendanceRequestError";
  public readonly code: AttendanceRequestErrorCode;

  constructor(message: string, code: AttendanceRequestErrorCode = "DEPENDENCY_FAILURE") {
    super(message);
    this.code = code;
  }
}

function config(): { readonly baseUrl: string; readonly headers: Record<string, string> } {
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/u, "");
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  if (!baseUrl || !token) {
    throw new AttendanceRequestError(
      "Attendance request storage is not configured.",
      "DEPENDENCY_FAILURE"
    );
  }
  return {
    baseUrl,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
}

function phTimestamp(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

async function fetchCanonicalSchool(schoolId: number): Promise<z.infer<typeof schoolSchema>> {
  const { baseUrl, headers } = config();
  const query = new URLSearchParams({
    fields: "school_id,school_name,city_municipality,province,verification_status,school_status",
  });
  const response = await fetch(`${baseUrl}/items/vs_school/${schoolId}?${query.toString()}`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new AttendanceRequestError(
      "The selected school is unavailable.",
      "DEPENDENCY_FAILURE"
    );
  }
  const parsed = z.object({ data: schoolSchema }).safeParse(await response.json());
  if (!parsed.success || parsed.data.data.school_id !== schoolId) {
    throw new AttendanceRequestError(
      "The selected school is unavailable.",
      "DEPENDENCY_FAILURE"
    );
  }
  return parsed.data.data;
}

async function isReviewReadySchool(schoolId: number): Promise<boolean> {
  try {
    return (await classifySchoolRoute(schoolId)) === "DIRECT_REVIEW";
  } catch {
    return false;
  }
}

async function fetchActiveRequest(
  educationId: number
): Promise<PersistedAttendanceRequest | null> {
  const { baseUrl, headers } = config();
  const query = new URLSearchParams({ fields: REQUEST_FIELDS, limit: "2", sort: "-created_at" });
  query.set("filter[employee_education_id][_eq]", String(educationId));
  query.set("filter[request_status][_neq]", "Rejected");
  const response = await fetch(`${baseUrl}/items/vs_school_request?${query.toString()}`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new AttendanceRequestError(
      "Attendance request storage is temporarily unavailable.",
      "DEPENDENCY_FAILURE"
    );
  }
  const parsed = z.object({ data: z.array(requestSchema).max(1) }).safeParse(await response.json());
  if (!parsed.success) {
    throw new AttendanceRequestError("Attendance request state is ambiguous.", "AMBIGUOUS");
  }
  return parsed.data.data[0] ?? null;
}

function sameEducationLink(
  request: PersistedAttendanceRequest,
  education: PersistedPendingEducation
): boolean {
  return (
    request.requested_by === education.user_id &&
    request.employee_education_id === education.employee_education_id &&
    request.active_employee_education_id === education.employee_education_id
  );
}

function needsSchoolRepoint(
  request: PersistedAttendanceRequest,
  education: PersistedPendingEducation
): boolean {
  if (!sameEducationLink(request, education)) return false;
  if (education.school_id !== null) {
    return request.matched_school_id !== education.school_id;
  }
  if (request.matched_school_id !== null && request.matched_school_id !== undefined) return true;
  const expectedRaw = (education.school_name_raw ?? "").trim();
  return request.requested_school_name.trim() !== expectedRaw;
}

async function patchLinkedRequest(
  request: PersistedAttendanceRequest,
  education: PersistedPendingEducation,
  data: Record<string, unknown>
): Promise<PersistedAttendanceRequest> {
  // Guarded repoint: the write applies only when the row still carries the
  // request id, education link, owner, observed status, and active link. A
  // concurrent transition makes the filter match zero rows, which loses
  // closed instead of overwriting the winner.
  const { baseUrl, headers } = config();
  const query = new URLSearchParams({ fields: REQUEST_FIELDS });
  const response = await fetch(`${baseUrl}/items/vs_school_request?${query.toString()}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      data,
      query: {
        filter: {
          school_request_id: { _eq: request.school_request_id },
          employee_education_id: { _eq: education.employee_education_id },
          requested_by: { _eq: education.user_id },
          request_status: { _eq: request.request_status },
          active_employee_education_id: { _eq: education.employee_education_id },
        },
      },
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new AttendanceRequestError(
      "Attendance request could not be saved.",
      "DEPENDENCY_FAILURE"
    );
  }
  const parsed = z.object({ data: z.array(requestSchema).max(1) }).safeParse(await response.json());
  if (!parsed.success) {
    throw new AttendanceRequestError("Attendance request state is ambiguous.", "AMBIGUOUS");
  }
  const updated = parsed.data.data[0];
  if (updated) return updated;
  const refetched = await fetchActiveRequest(education.employee_education_id);
  if (refetched && refetched.school_request_id === request.school_request_id) {
    try {
      return requireLinkedRequest(refetched, education);
    } catch {
      throw new AttendanceRequestError(
        "Attendance request changed before it could be saved.",
        "STALE_CONFLICT"
      );
    }
  }
  throw new AttendanceRequestError(
    "Attendance request changed before it could be saved.",
    "STALE_CONFLICT"
  );
}

async function repointLinkedRequest(
  request: PersistedAttendanceRequest,
  education: PersistedPendingEducation,
  location?: { readonly city: string | null; readonly province: string | null }
): Promise<PersistedAttendanceRequest> {
  if (!sameEducationLink(request, education)) {
    throw new AttendanceRequestError(
      "Attendance request linkage is invalid.",
      "LINKAGE_INVALID"
    );
  }
  if (education.school_id === null) {
    const rawName = (education.school_name_raw ?? "").trim();
    if (!rawName) {
      throw new AttendanceRequestError("A school name is required.", "INVALID_INPUT");
    }
    return patchLinkedRequest(request, education, withLocation(request, {
      requested_school_name: rawName,
      matched_school_id: null,
      request_status: "Pending",
      routed_by: null,
      routed_at: null,
      reviewed_by: null,
      reviewed_at: null,
      admin_remarks: null,
    }, location?.city ?? null, location?.province ?? null));
  }
  const school = await fetchCanonicalSchool(education.school_id);
  let classification: string | null = null;
  try {
    classification = await classifySchoolRoute(school.school_id);
  } catch {
    classification = null;
  }
  if (classification === "DIRECT_REVIEW") {
    return patchLinkedRequest(request, education, withLocation(request, {
      requested_school_name: school.school_name,
      matched_school_id: school.school_id,
      request_status: "RoutedToSchool",
      routed_by: null,
      routed_at: phTimestamp(),
      reviewed_by: null,
      reviewed_at: null,
      admin_remarks: null,
    }, school.city_municipality, school.province));
  }
  return patchLinkedRequest(request, education, withLocation(request, {
    requested_school_name: school.school_name,
    matched_school_id: school.school_id,
    request_status: "Pending",
    routed_by: null,
    routed_at: null,
    reviewed_by: null,
    reviewed_at: null,
    admin_remarks: null,
  }, school.city_municipality, school.province));
}

function withLocation(
  request: PersistedAttendanceRequest,
  patch: Record<string, unknown>,
  city: string | null,
  province: string | null
): Record<string, unknown> {
  if (request.city_municipality === city && request.province === province) return patch;
  return { ...patch, city_municipality: city, province: province };
}

function requireLinkedRequest(
  request: PersistedAttendanceRequest,
  education: PersistedPendingEducation
): PersistedAttendanceRequest {
  if (
    request.requested_by !== education.user_id ||
    request.employee_education_id !== education.employee_education_id ||
    request.active_employee_education_id !== education.employee_education_id
  ) {
    throw new AttendanceRequestError(
      "Attendance request linkage is invalid.",
      "LINKAGE_INVALID"
    );
  }
  // Defect (1): a reused request must still match the persisted education's
  // canonical state. Any drift fails closed — never returned as valid.
  // Defect (2): enforce canonical route semantics; reject hybrids.
  // System auto-route is the only writer on this path, so routed_by must
  // always be the null system-route marker (never a Admin Portal action).
  if (request.routed_by !== null && request.routed_by !== undefined) {
    throw new AttendanceRequestError(
      "Attendance request route actor is invalid.",
      "LINKAGE_INVALID"
    );
  }
  if (education.school_id !== null) {
    if (request.request_status === "RoutedToSchool") {
      if (request.matched_school_id !== education.school_id) {
        throw new AttendanceRequestError(
          "Attendance request school linkage is invalid.",
          "LINKAGE_INVALID"
        );
      }
      if (typeof request.routed_at !== "string" || request.routed_at.length === 0) {
        throw new AttendanceRequestError(
          "Attendance request route time is invalid.",
          "LINKAGE_INVALID"
        );
      }
      return request;
    }
    if (
      request.request_status === "Pending" &&
      request.matched_school_id === education.school_id &&
      (request.routed_at === null || request.routed_at === undefined) &&
      (request.reviewed_by === null || request.reviewed_by === undefined) &&
      (request.reviewed_at === null || request.reviewed_at === undefined) &&
      (request.admin_remarks === null || request.admin_remarks === undefined)
    ) {
      return request;
    }
    throw new AttendanceRequestError(
      "Attendance request route state is invalid.",
      "LINKAGE_INVALID"
    );
  } else {
    if (request.request_status !== "Pending") {
      throw new AttendanceRequestError(
        "Attendance request route state is invalid.",
        "LINKAGE_INVALID"
      );
    }
    if (request.matched_school_id !== null && request.matched_school_id !== undefined) {
      throw new AttendanceRequestError(
        "Attendance request school linkage is invalid.",
        "LINKAGE_INVALID"
      );
    }
    if (request.routed_at !== null && request.routed_at !== undefined) {
      throw new AttendanceRequestError(
        "Attendance request route time is invalid.",
        "LINKAGE_INVALID"
      );
    }
    const expectedRaw = (education.school_name_raw ?? "").trim();
    if (!expectedRaw || request.requested_school_name.trim() !== expectedRaw) {
      throw new AttendanceRequestError(
        "Attendance request school identity is invalid.",
        "LINKAGE_INVALID"
      );
    }
  }
  return request;
}

function isParkedShape(
  request: PersistedAttendanceRequest,
  education: PersistedPendingEducation
): boolean {
  return (
    education.school_id !== null &&
    request.request_status === "Pending" &&
    request.matched_school_id === education.school_id &&
    (request.routed_at === null || request.routed_at === undefined) &&
    (request.reviewed_by === null || request.reviewed_by === undefined) &&
    (request.reviewed_at === null || request.reviewed_at === undefined) &&
    (request.admin_remarks === null || request.admin_remarks === undefined)
  );
}

export type ParkedAttendanceReconcileSummary = {
  readonly scanned: number;
  readonly released: number;
  readonly skipped: number;
  readonly failed: number;
};

export async function reconcileParkedAttendanceRequests(
  options?: { readonly limit?: number }
): Promise<ParkedAttendanceReconcileSummary> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const { baseUrl, headers } = config();
  const query = new URLSearchParams({
    fields: "school_request_id,matched_school_id",
    limit: String(limit),
    sort: "created_at",
  });
  query.set("filter[request_status][_eq]", "Pending");
  const response = await fetch(`${baseUrl}/items/vs_school_request?${query.toString()}`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new AttendanceRequestError(
      "Attendance request storage is temporarily unavailable.",
      "DEPENDENCY_FAILURE"
    );
  }
  const listed = z
    .object({
      data: z.array(
        z.object({
          school_request_id: z.coerce.number().int().positive(),
          matched_school_id: z.coerce.number().int().positive().nullable().optional(),
        })
      ),
    })
    .safeParse(await response.json());
  if (!listed.success) {
    throw new AttendanceRequestError("Attendance request state is ambiguous.", "AMBIGUOUS");
  }
  const parsed = listed;
  const parked = parsed.data.data.filter(
    (row) => row.matched_school_id !== null && row.matched_school_id !== undefined
  );
  let released = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of parked) {
    try {
      const outcome = await releaseGroupedSchoolRequest({
        requestId: row.school_request_id,
        targetSchoolId: row.matched_school_id as number,
      });
      if (outcome.kind === "mutated") released += 1;
      else skipped += 1;
    } catch {
      failed += 1;
    }
  }
  return { scanned: parked.length, released, skipped, failed };
}

export async function ensureEducationAttendanceRequest(
  education: PersistedPendingEducation,
  location?: { readonly city: string | null; readonly province: string | null }
): Promise<PersistedAttendanceRequest> {
  const existing = await fetchActiveRequest(education.employee_education_id);
  if (existing) {
    if (needsSchoolRepoint(existing, education)) {
      const repointed = await repointLinkedRequest(existing, education, location);
      return requireLinkedRequest(repointed, education);
    }
    if (isParkedShape(existing, education) && education.school_id !== null) {
      try {
        const outcome = await releaseGroupedSchoolRequest({
          requestId: existing.school_request_id,
          targetSchoolId: education.school_id,
        });
        if (outcome.kind === "mutated" || outcome.kind === "converged") {
          const refetched = await fetchActiveRequest(education.employee_education_id);
          if (refetched) return requireLinkedRequest(refetched, education);
        }
      } catch {
        // Best-effort self-heal only; the parked row below is still valid.
      }
    }
    if (
      education.school_id === null &&
      location !== undefined &&
      existing.request_status === "Pending" &&
      (existing.reviewed_by === null || existing.reviewed_by === undefined) &&
      (existing.city_municipality !== (location.city ?? null) ||
        existing.province !== (location.province ?? null))
    ) {
      const relocated = await patchLinkedRequest(existing, education, {
        city_municipality: location.city ?? null,
        province: location.province ?? null,
      });
      return requireLinkedRequest(relocated, education);
    }
    return requireLinkedRequest(existing, education);
  }

  const school = education.school_id === null
    ? null
    : await fetchCanonicalSchool(education.school_id);
  const requestedSchoolName = school?.school_name ?? education.school_name_raw?.trim();
  if (!requestedSchoolName) {
    throw new AttendanceRequestError("A school name is required.", "INVALID_INPUT");
  }
  const reviewReady = school === null ? false : await isReviewReadySchool(school.school_id);

  const payload = {
    requested_by: education.user_id,
    requested_school_name: requestedSchoolName,
    city_municipality: school ? school.city_municipality : location?.city ?? null,
    province: school ? school.province : location?.province ?? null,
    request_status: reviewReady ? "RoutedToSchool" : "Pending",
    matched_school_id: school?.school_id ?? null,
    routed_by: null,
    routed_at: reviewReady ? phTimestamp() : null,
    employee_education_id: education.employee_education_id,
    active_employee_education_id: education.employee_education_id,
  };
  const { baseUrl, headers } = config();
  try {
    const response = await fetch(
      `${baseUrl}/items/vs_school_request?fields=${encodeURIComponent(REQUEST_FIELDS)}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );
    if (response.ok) {
      const parsed = z.object({ data: requestSchema }).safeParse(await response.json());
      if (parsed.success) return requireLinkedRequest(parsed.data.data, education);
    }
  } catch (error: unknown) {
    if (error instanceof AttendanceRequestError) throw error;
  }

  const recovered = await fetchActiveRequest(education.employee_education_id);
  if (recovered) return requireLinkedRequest(recovered, education);
  throw new AttendanceRequestError(
    "Attendance request could not be saved.",
    "DEPENDENCY_FAILURE"
  );
}

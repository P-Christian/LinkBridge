import { z } from "zod";

import {
  CourseRequestSchoolAdminError,
  courseRequestInboxSchema,
  dependencyError,
  fetchDocumentsByEducationIds,
  type CourseRequestCandidate,
  type CourseRequestInbox,
  type CourseRequestInboxListing,
  type CourseRequestSchoolContext,
} from "@/modules/school-admin/course-requests";

/**
 * Route-boundary submitter enrichment.
 *
 * The domain listing is deliberately identity-free: it exposes only the
 * numeric `requested_by` owner. The inbox needs a submitter display label, so
 * the name is resolved HERE, at the HTTP boundary, and appended AFTER the
 * allowlisted fields have already passed domain parsing below. The domain
 * module (`src/modules/school-admin/course-requests/**`) is untouched and its
 * privacy guarantees are unchanged.
 *
 * Privacy bound is absolute: ONLY `user_fname`/`user_mname`/`user_lname` ever
 * cross this boundary. Email, contacts, documents, photo, address, and every
 * other profile field are never selected, mapped, or returned.
 */

const positiveInteger = z.number().int().positive();
const trimmedNonBlank = z.string().trim().min(1);

/** Actionable precursor: allowlisted fields parsed BEFORE any name is attached. */
const actionablePrecursorSchema = z
  .object({
    courseRequestId: positiveInteger,
    requestStatus: z.literal("RoutedToSchool"),
    requestedCourseName: trimmedNonBlank,
    requestedBy: positiveInteger,
    educationId: positiveInteger,
    submittedAt: trimmedNonBlank,
    routedBy: positiveInteger,
    routedAt: trimmedNonBlank,
    matchedSchoolCourseId: z.null(),
    reviewedBy: z.null(),
    reviewedAt: z.null(),
  })
  .strict();

/** Finalizing precursor: claim-locked row parsed BEFORE any name is attached. */
const finalizingPrecursorSchema = z
  .object({
    courseRequestId: positiveInteger,
    requestStatus: z.literal("RoutedToSchool"),
    requestedCourseName: trimmedNonBlank,
    requestedBy: positiveInteger,
    educationId: positiveInteger,
    submittedAt: trimmedNonBlank,
    routedBy: positiveInteger,
    routedAt: trimmedNonBlank,
    matchedSchoolCourseId: positiveInteger,
    reviewedBy: positiveInteger,
    reviewedAt: z.null(),
  })
  .strict();

type ActionablePrecursor = z.infer<typeof actionablePrecursorSchema>;
type FinalizingPrecursor = z.infer<typeof finalizingPrecursorSchema>;

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/u, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

/** Name parts only. Email/contact/photo/address are never requested. */
const SUBMITTER_FIELDS = "user_id,user_fname,user_mname,user_lname";

const submitterRowSchema = z.object({
  user_id: z.number().int(),
  user_fname: z.string().nullable().optional(),
  user_mname: z.string().nullable().optional(),
  user_lname: z.string().nullable().optional(),
});

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) headers.Authorization = `Bearer ${DIRECTUS_TOKEN}`;
  return headers;
}

/**
 * Assemble a display label from name parts only. Missing/blank parts are
 * dropped; if no part survives the result is the empty string. It never
 * substitutes an email or a raw id-derived placeholder, so a real name is
 * never replaced by anything but the real name.
 */
export function formatSubmitterDisplayName(parts: {
  readonly userFname?: string | null;
  readonly userMname?: string | null;
  readonly userLname?: string | null;
}): string {
  return [parts.userFname, parts.userMname, parts.userLname]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0)
    .join(" ");
}

/**
 * Resolve first/last (and middle when present) names for the whole inbox in
 * ONE bounded `vs_user` query - never a per-row N+1. A user row that is absent
 * or has no name parts fails closed as a sanitized 503 dependency error,
 * because the inbox DTO requires a non-blank name and a partial label set is
 * never served. A transport/parse failure fails closed the same way.
 */
export async function resolveSubmitterNames(
  requestedByIds: readonly number[],
): Promise<ReadonlyMap<number, string>> {
  const names = new Map<number, string>();
  const unique = [...new Set(requestedByIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (unique.length === 0) return names;
  if (!DIRECTUS_BASE) throw dependencyError("courseRequest.submitter.configuration");

  const query = new URLSearchParams({
    "filter[user_id][_in]": unique.join(","),
    fields: SUBMITTER_FIELDS,
    limit: "-1",
  });

  try {
    const response = await fetch(`${DIRECTUS_BASE}/items/vs_user?${query.toString()}`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!response.ok) throw dependencyError("courseRequest.submitter", response.status);
    const parsed = z.object({ data: z.array(submitterRowSchema) }).safeParse(await response.json());
    if (!parsed.success) throw dependencyError("courseRequest.submitter.response");
    for (const row of parsed.data.data) {
      const label = formatSubmitterDisplayName({
        userFname: row.user_fname,
        userMname: row.user_mname,
        userLname: row.user_lname,
      });
      if (label.length === 0) throw dependencyError("courseRequest.submitter.response");
      names.set(row.user_id, label);
    }
    for (const id of unique) {
      if (!names.has(id)) throw dependencyError("courseRequest.submitter.response");
    }
    return names;
  } catch (error: unknown) {
    if (error instanceof CourseRequestSchoolAdminError) throw error;
    throw dependencyError("courseRequest.submitter", undefined, error);
  }
}

function toActionablePrecursor(row: {
  readonly course_request_id: number;
  readonly request_status: string;
  readonly requested_course_name: string;
  readonly requested_by: number;
  readonly employee_education_id: number;
  readonly created_at: string;
  readonly routed_by: number;
  readonly routed_at: string;
  readonly matched_school_course_id: number | null;
  readonly reviewed_by: number | null;
  readonly reviewed_at: string | null;
}): ActionablePrecursor {
  const parsed = actionablePrecursorSchema.safeParse({
    courseRequestId: row.course_request_id,
    requestStatus: row.request_status,
    requestedCourseName: row.requested_course_name,
    requestedBy: row.requested_by,
    educationId: row.employee_education_id,
    submittedAt: row.created_at,
    routedBy: row.routed_by,
    routedAt: row.routed_at,
    matchedSchoolCourseId: row.matched_school_course_id,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
  });
  if (!parsed.success) throw dependencyError("courseRequest.inbox.response");
  return parsed.data;
}

function toFinalizingPrecursor(row: {
  readonly course_request_id: number;
  readonly request_status: string;
  readonly requested_course_name: string;
  readonly requested_by: number;
  readonly employee_education_id: number;
  readonly created_at: string;
  readonly routed_by: number;
  readonly routed_at: string;
  readonly matched_school_course_id: number | null;
  readonly reviewed_by: number | null;
  readonly reviewed_at: string | null;
}): FinalizingPrecursor {
  const parsed = finalizingPrecursorSchema.safeParse({
    courseRequestId: row.course_request_id,
    requestStatus: row.request_status,
    requestedCourseName: row.requested_course_name,
    requestedBy: row.requested_by,
    educationId: row.employee_education_id,
    submittedAt: row.created_at,
    routedBy: row.routed_by,
    routedAt: row.routed_at,
    matchedSchoolCourseId: row.matched_school_course_id,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
  });
  if (!parsed.success) throw dependencyError("courseRequest.inbox.response");
  return parsed.data;
}

/**
 * Map the scoped listing to the exact inbox DTO. Domain parsing
 * of the allowlisted fields happens FIRST (precursor schemas above); the
 * name-only labels and proof documents are attached AFTER; the assembled
 * inbox is then guarded by the `courseRequestInboxSchema` so only
 * schema-valid rows serialize.
 */
export async function attachSubmitterNames(
  ctx: CourseRequestSchoolContext,
  listing: CourseRequestInboxListing,
  courses: readonly CourseRequestCandidate[],
): Promise<CourseRequestInbox> {
  const actionable = listing.actionable.map(toActionablePrecursor);
  const finalizing = listing.finalizing.map(toFinalizingPrecursor);
  const requestedByIds = [...actionable, ...finalizing].map((row) => row.requestedBy);
  const names = await resolveSubmitterNames(requestedByIds);
  const educationIds = [...actionable, ...finalizing].map((row) => row.educationId);
  const documentsByEducation = await fetchDocumentsByEducationIds(ctx, educationIds);
  const parsed = courseRequestInboxSchema.safeParse({
    schoolId: listing.schoolId,
    routed: actionable.map((row) => ({
      courseRequestId: row.courseRequestId,
      requestStatus: row.requestStatus,
      requestedCourseName: row.requestedCourseName,
      submitterName: names.get(row.requestedBy) ?? "",
      submittedAt: row.submittedAt,
      routedBy: row.routedBy,
      routedAt: row.routedAt,
      matchedSchoolCourseId: row.matchedSchoolCourseId,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      documents: [...(documentsByEducation.get(row.educationId) ?? [])],
    })),
    finalizing: finalizing.map((row) => ({
      courseRequestId: row.courseRequestId,
      requestStatus: row.requestStatus,
      requestedCourseName: row.requestedCourseName,
      submitterName: names.get(row.requestedBy) ?? "",
      submittedAt: row.submittedAt,
      routedBy: row.routedBy,
      routedAt: row.routedAt,
      matchedSchoolCourseId: row.matchedSchoolCourseId,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      documents: [...(documentsByEducation.get(row.educationId) ?? [])],
    })),
    courses: [...courses],
  });
  if (!parsed.success) throw dependencyError("courseRequest.inbox.response");
  return parsed.data;
}

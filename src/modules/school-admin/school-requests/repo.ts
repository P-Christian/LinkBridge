import "server-only";

import { z, type ZodType } from "zod";

import { resolveExactSchoolAssignment } from "./assignment.resolver";
import { dependencyError, scopedNotFound, SchoolRequestSchoolAdminError } from "./errors";
import {
  courseRequestLinkSchema,
  linkedCourseRowSchema,
  linkedEducationRowSchema,
  schoolRequestInboxRowSchema,
  scopedSchoolRequestRowSchema,
  type LinkedCourseRow,
  type LinkedEducationRow,
  type ScopedSchoolRequestRow,
} from "./schemas";
import type {
  LinkedCourseSummary,
  LinkedEducationSummary,
  SchoolAssignment,
  SchoolRequestInboxRow,
} from "./types";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/u, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) headers.Authorization = `Bearer ${DIRECTUS_TOKEN}`;
  return headers;
}

const SCOPED_REQUEST_FIELDS =
  "school_request_id,requested_by,requested_school_name,request_status,matched_school_id,reviewed_by,reviewed_at,routed_by,routed_at,employee_education_id,active_employee_education_id,created_at";
const EDUCATION_FIELDS =
  "employee_education_id,user_id,school_id,school_course_id,course_name_raw,school_name_raw,education_status,start_date,end_date";
const COURSE_FIELDS = "school_course_id,school_id,course_name,course_code";

async function fetchRows<T>(operation: string, path: string, schema: ZodType<T>): Promise<readonly T[]> {
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

function toEducationSummary(row: LinkedEducationRow): LinkedEducationSummary {
  return {
    employeeEducationId: row.employee_education_id,
    userId: row.user_id,
    schoolId: row.school_id,
    schoolCourseId: row.school_course_id,
    courseNameRaw: row.course_name_raw,
    schoolNameRaw: row.school_name_raw,
    educationStatus: row.education_status,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

function toCourseSummary(row: LinkedCourseRow): LinkedCourseSummary {
  return {
    schoolCourseId: row.school_course_id,
    schoolId: row.school_id,
    courseName: row.course_name,
    courseCode: row.course_code,
  };
}

async function fetchLinkedEducation(operation: string, educationId: number): Promise<LinkedEducationRow> {
  const query = new URLSearchParams({
    "filter[employee_education_id][_eq]": String(educationId),
    fields: EDUCATION_FIELDS,
    limit: "2",
  });
  const rows = await fetchRows(
    operation,
    `/items/vs_employee_education?${query.toString()}`,
    linkedEducationRowSchema,
  );
  if (rows.length === 0) throw dependencyError(`${operation}.missing`);
  if (rows.length > 1) throw dependencyError(`${operation}.ambiguous`);
  const only = rows[0];
  if (only === undefined) throw dependencyError(`${operation}.response`);
  return only;
}

async function fetchLinkedCourse(operation: string, courseId: number): Promise<LinkedCourseRow> {
  const query = new URLSearchParams({
    "filter[school_course_id][_eq]": String(courseId),
    fields: COURSE_FIELDS,
    limit: "2",
  });
  const rows = await fetchRows(operation, `/items/vs_school_course?${query.toString()}`, linkedCourseRowSchema);
  if (rows.length === 0) throw dependencyError(`${operation}.missing`);
  if (rows.length > 1) throw dependencyError(`${operation}.ambiguous`);
  const only = rows[0];
  if (only === undefined) throw dependencyError(`${operation}.response`);
  return only;
}

/** True when at least one course request is linked to the education row. */
async function hasLinkedCourseRequest(educationId: number): Promise<boolean> {
  const query = new URLSearchParams({
    "filter[employee_education_id][_eq]": String(educationId),
    fields: "course_request_id",
    limit: "1",
  });
  const rows = await fetchRows(
    "schoolRequest.hasLinkedCourseRequest",
    `/items/vs_course_request?${query.toString()}`,
    courseRequestLinkSchema,
  );
  return rows.length > 0;
}

/**
 * Expand one persisted request row into the privacy-limited inbox DTO. The
 * caller guarantees `matched_school_id` equals the resolved school. Rows
 * without a linked education cannot be routed/finalizing decisions and are
 * skipped (null); a dangling non-null education link is corrupt data and
 * fails closed.
 */
async function expandRow(
  operation: string,
  row: ScopedSchoolRequestRow,
  expectedSchoolId: number,
): Promise<SchoolRequestInboxRow | null> {
  if (row.matched_school_id !== expectedSchoolId) return null;
  if (row.employee_education_id === null) return null;
  const education = await fetchLinkedEducation(`${operation}.education`, row.employee_education_id);
  const course =
    education.school_course_id === null
      ? null
      : await fetchLinkedCourse(`${operation}.course`, education.school_course_id);
  const parsed = schoolRequestInboxRowSchema.safeParse({
    schoolRequestId: row.school_request_id,
    requestStatus: row.request_status,
    matchedSchoolId: row.matched_school_id,
    requestedBy: row.requested_by,
    requestedSchoolName: row.requested_school_name,
    createdAt: row.created_at,
    routedBy: row.routed_by,
    routedAt: row.routed_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    education: toEducationSummary(education),
    course: course === null ? null : toCourseSummary(course),
  });
  if (!parsed.success) throw dependencyError(`${operation}.shape`);
  return parsed.data;
}

/**
 * List actionable `RoutedToSchool` decisions whose PERSISTED
 * `matched_school_id` equals the resolved school. The assignment is
 * resolved first; zero/multiple assignments throw before any request
 * query is issued.
 */
export async function listRoutedForAssignment(
  assignment: SchoolAssignment,
): Promise<readonly SchoolRequestInboxRow[]> {
  const query = new URLSearchParams({
    "filter[request_status][_eq]": "RoutedToSchool",
    "filter[matched_school_id][_eq]": String(assignment.schoolId),
    fields: SCOPED_REQUEST_FIELDS,
    limit: "-1",
  });
  const rows = await fetchRows(
    "schoolRequest.listRouted",
    `/items/vs_school_request?${query.toString()}`,
    scopedSchoolRequestRowSchema,
  );
  const expanded: SchoolRequestInboxRow[] = [];
  for (const row of rows) {
    const dto = await expandRow("schoolRequest.listRouted", row, assignment.schoolId);
    if (dto !== null && dto.requestStatus === "RoutedToSchool") expanded.push(dto);
  }
  return expanded;
}

/**
 * List recoverable `Approved` rows: linked education still unresolved
 * (Pending) AND no linked course request exists yet. Completed `Approved`
 * rows (Verified education, or an existing follow-on course request, or no
 * linked education) disappear from this set.
 */
export async function listFinalizingForAssignment(
  assignment: SchoolAssignment,
): Promise<readonly SchoolRequestInboxRow[]> {
  const query = new URLSearchParams({
    "filter[request_status][_eq]": "Approved",
    "filter[matched_school_id][_eq]": String(assignment.schoolId),
    fields: SCOPED_REQUEST_FIELDS,
    limit: "-1",
  });
  const rows = await fetchRows(
    "schoolRequest.listFinalizing",
    `/items/vs_school_request?${query.toString()}`,
    scopedSchoolRequestRowSchema,
  );
  const recovering: SchoolRequestInboxRow[] = [];
  for (const row of rows) {
    const dto = await expandRow("schoolRequest.listFinalizing", row, assignment.schoolId);
    if (dto === null || dto.requestStatus !== "Approved") continue;
    if (dto.education.educationStatus !== "Pending") continue;
    if (await hasLinkedCourseRequest(dto.education.employeeEducationId)) continue;
    recovering.push(dto);
  }
  return recovering;
}

/**
 * Fetch one request scoped to the resolved school. Foreign-school resources
 * and unknown ids resolve to NOT_FOUND (typed 404) BEFORE any
 * transition/status validation, so no cross-school existence leaks.
 */
export async function fetchScopedRequest(
  callerUserId: number,
  requestId: number,
): Promise<{ assignment: SchoolAssignment; row: SchoolRequestInboxRow }> {
  const assignment = await resolveExactSchoolAssignment(callerUserId);
  const query = new URLSearchParams({
    "filter[school_request_id][_eq]": String(requestId),
    "filter[matched_school_id][_eq]": String(assignment.schoolId),
    fields: SCOPED_REQUEST_FIELDS,
    limit: "2",
  });
  const rows = await fetchRows(
    "schoolRequest.fetchScoped",
    `/items/vs_school_request?${query.toString()}`,
    scopedSchoolRequestRowSchema,
  );
  if (rows.length === 0) throw scopedNotFound();
  if (rows.length > 1) throw dependencyError("schoolRequest.fetchScoped.ambiguous");
  const only = rows[0];
  if (only === undefined) throw dependencyError("schoolRequest.fetchScoped.response");
  if (only.request_status !== "RoutedToSchool" && only.request_status !== "Approved") throw scopedNotFound();
  const dto = await expandRow("schoolRequest.fetchScoped", only, assignment.schoolId);
  if (dto === null) throw scopedNotFound();
  return { assignment, row: dto };
}

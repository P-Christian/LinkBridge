import "server-only";

import { z, type ZodType } from "zod";

import {
  courseRequestCandidateSchema,
  scopedCourseRequestRowSchema,
  type ScopedCourseRequestRow,
} from "./schemas";
import {
  courseRequestError,
  dependencyError,
  scopedNotFound,
  invalidInputError,
  CourseRequestSchoolAdminError,
  type CourseRequestSchoolAdminErrorCode,
} from "./errors";
import { fetchDocumentsBySchoolRequestIds } from "../school-requests/documents";
import { SchoolRequestSchoolAdminError } from "../school-requests/errors";
import type { CourseRequestCandidate, CourseRequestDocument } from "./types";

/**
 * School-scoped reads and atomically guarded
 * request/roster writes for the School Admin course-request inbox.
 *
 * Every function accepts ONLY the server-derived `{ userId, schoolId }`
 * context (resolved by `resolveSchoolAdminContext` at the route boundary).
 * Client-supplied school/requester/reviewer/education/status/course
 * ownership is never trusted.
 *
 * Guarding contract:
 * - Every `vs_course_request` mutation filter includes the
 *   `course_request_id`, the resolved `school_id`, and the exact expected
 *   source status/audit/claim fields, so a target change between read and
 *   write still affects zero rows.
 * - The separate `vs_school_student` prerequisite / null-course patch /
 *   exact-course replay / read-back all require the education id, the
 *   school id, `invitation_status: "Registered"`, and
 *   `registered_user_id === ownerUserId === education.user_id`, with null
 *   (or exact) course as appropriate. Callers pass `ownerUserId` as the
 *   verified `request.requested_by` (the decision service additionally asserts it equals
 *   `education.user_id` before delegating here).
 * - Rejection read-back converges ONLY when the reviewer AND the trimmed
 *   `admin_remarks` both match.
 * - Foreign/absent resources resolve to NOT_FOUND (404) BEFORE any
 *   transition validation, so no cross-school existence leaks.
 *
 * This module NEVER calls the neutral `claimCourseRequest`,
 * `finalizeCourseRequest`, or `completeAttendanceRosterCourse`: their
 * mutation filters are NOT atomically school/registration scoped.
 */

export interface CourseRequestSchoolContext {
  readonly userId: number;
  readonly schoolId: number;
}

export interface CourseRequestInboxListing {
  readonly schoolId: number;
  readonly actionable: readonly ScopedCourseRequestRow[];
  readonly finalizing: readonly ScopedCourseRequestRow[];
}

export interface ClaimScopedCourseRequestInput {
  readonly requestId: number;
  readonly courseId: number;
  readonly reviewerId: number;
}

export interface FinalizeScopedCourseApprovalInput {
  readonly requestId: number;
  readonly courseId: number;
}

export interface RejectScopedCourseRequestInput {
  readonly requestId: number;
  readonly reviewerId: number;
  readonly remarks: string;
}

export interface ScopedRosterCourseInput {
  readonly educationId: number;
  readonly ownerUserId: number;
  readonly courseId: number;
}

/** Minimal persisted `vs_school_student` subset used by the guarded roster path. */
const scopedRosterRowSchema = z
  .object({
    student_id: z.number().int().positive(),
    school_id: z.number().int().positive(),
    school_course_id: z.number().int().nullable(),
    employee_education_id: z.number().int().nullable(),
    invitation_status: z.string(),
    registered_user_id: z.number().int().nullable(),
  })
  .strict();

export type ScopedRosterRow = z.infer<typeof scopedRosterRowSchema>;

/** Persisted `vs_school_course` row subset; mapped to the inbox DTO below. */
/** Minimal persisted `vs_employee_education` subset for the owner-equality check. */
const scopedEducationOwnerSchema = z
  .object({
    employee_education_id: z.number().int().positive(),
    user_id: z.number().int().positive(),
  })
  .strict();

/** Minimal persisted `vs_school_course` subset for the Active own-school check. */
const scopedCourseStatusSchema = z
  .object({
    school_course_id: z.number().int().positive(),
    school_id: z.number().int().positive(),
    course_name: z.string(),
    course_code: z.string().nullable(),
    degree: z.string().nullable(),
    course_status: z.string(),
  })
  .strict();

/**
 * Loose persisted `vs_course_request` row: nullable route audit and claim
 * fields plus the full status enum, so fetches can distinguish foreign/
 * absent (NOT_FOUND) from null/incomplete audits and claim hybrids
 * (ROUTE_AUDIT_CONFLICT) before strict inbox parsing.
 */
const looseCourseRequestRowSchema = z
  .object({
    course_request_id: z.number().int().positive(),
    school_id: z.number().int().positive(),
    employee_education_id: z.number().int().positive(),
    requested_by: z
      .union([z.number().int(), z.object({ user_id: z.number().int() }).strict()])
      .transform((value) => (typeof value === "number" ? value : value.user_id)),
    requested_course_name: z.string(),
    request_status: z.enum(["Pending", "RoutedToSchool", "Approved", "Rejected"]),
    matched_school_course_id: z.number().int().nullable(),
    reviewed_by: z.number().int().nullable(),
    reviewed_at: z.string().nullable(),
    routed_by: z.number().int().nullable(),
    routed_at: z.string().nullable(),
    created_at: z.string(),
    admin_remarks: z.string().nullable(),
  })
  .strict();

type LooseCourseRequestRow = z.infer<typeof looseCourseRequestRowSchema>;

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

function philippineTimestamp(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

function requireContext(
  operation: string,
  ctx: CourseRequestSchoolContext,
): { userId: number; schoolId: number } {
  if (
    ctx === null ||
    ctx === undefined ||
    !Number.isInteger(ctx.userId) ||
    ctx.userId <= 0 ||
    !Number.isInteger(ctx.schoolId) ||
    ctx.schoolId <= 0
  ) {
    throw dependencyError(`${operation}.context`);
  }
  return { userId: ctx.userId, schoolId: ctx.schoolId };
}

function requirePositive(operation: string, field: string, value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw invalidInputError(`${field} must be a positive integer during ${operation}.`);
  }
  return value;
}

function isCode(error: unknown, code: CourseRequestSchoolAdminErrorCode): boolean {
  return error instanceof CourseRequestSchoolAdminError && error.code === code;
}

function conflict(
  code: CourseRequestSchoolAdminErrorCode,
  message: string,
): never {
  throw courseRequestError(code, message);
}

type DirectusFilter = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

function filterToQueryParams(filter: DirectusFilter): URLSearchParams {
  const query = new URLSearchParams();
  for (const [field, condition] of Object.entries(filter)) {
    for (const [operator, value] of Object.entries(condition)) {
      if (operator === "_eq") {
        query.set(`filter[${field}][_eq]`, String(value));
      } else if (operator === "_null" || operator === "_nnull") {
        query.set(`filter[${field}][${operator}]`, "true");
      }
    }
  }
  return query;
}

async function fetchRows<T>(
  operation: string,
  path: string,
  schema: ZodType<T>,
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
    if (error instanceof CourseRequestSchoolAdminError) throw error;
    throw dependencyError(operation, undefined, error);
  }
}

/**
 * Guarded single-row PATCH: preflight GET (limit 2) enforces cardinality,
 * then ONE PATCH request carries the FULL filter, so a target change
 * between read and write still affects zero rows. Returns the updated row,
 * or null when the guard matched zero rows (lost race / stale source).
 */
async function patchGuardedRow<T>(
  operation: string,
  collection: string,
  filter: DirectusFilter,
  data: Readonly<Record<string, unknown>>,
  fields: string,
  schema: ZodType<T>,
): Promise<T | null> {
  const preflight = filterToQueryParams(filter);
  preflight.set("fields", fields);
  preflight.set("limit", "2");
  const candidates = await fetchRows(
    operation,
    `/items/${collection}?${preflight.toString()}`,
    schema,
  );
  if (candidates.length === 0) return null;
  if (candidates.length > 1) throw dependencyError(`${operation}.ambiguous`);
  const query = new URLSearchParams({ fields });
  let response: Response;
  try {
    response = await fetch(`${DIRECTUS_BASE}/items/${collection}?${query.toString()}`, {
      method: "PATCH",
      headers: getHeaders(),
      cache: "no-store",
      body: JSON.stringify({ data, query: { filter } }),
    });
  } catch (error: unknown) {
    throw dependencyError(operation, undefined, error);
  }
  if (!response.ok) throw dependencyError(operation, response.status);
  let body: unknown;
  try {
    body = await response.json();
  } catch (error: unknown) {
    throw dependencyError(`${operation}.response`, response.status, error);
  }
  const parsed = z.object({ data: z.array(schema).max(1) }).safeParse(body);
  if (!parsed.success) throw dependencyError(`${operation}.response`);
  return parsed.data.data[0] ?? null;
}

const COURSE_REQUEST_FIELDS =
  "course_request_id,school_id,employee_education_id,requested_by,requested_course_name,request_status,matched_school_course_id,reviewed_by,reviewed_at,routed_by,routed_at,created_at,admin_remarks";
const ROSTER_FIELDS =
  "student_id,school_id,school_course_id,employee_education_id,invitation_status,registered_user_id";
const EDUCATION_OWNER_FIELDS = "employee_education_id,user_id";
const COURSE_STATUS_FIELDS =
  "school_course_id,school_id,course_name,course_code,degree,course_status";
const CANDIDATE_FIELDS = "school_course_id,school_id,course_name,course_code,degree,course_status";

function strictRequest(operation: string, row: LooseCourseRequestRow): ScopedCourseRequestRow {
  const parsed = scopedCourseRequestRowSchema.safeParse(row);
  if (!parsed.success) throw dependencyError(`${operation}.response`);
  return parsed.data;
}

/**
 * Exact school-scoped request read (limit two). Zero rows resolve to
 * NOT_FOUND before any transition checks, so foreign/absent ids never
 * leak cross-school existence. Multiple rows fail closed as a dependency
 * failure.
 */
async function fetchExactScopedRequest(
  operation: string,
  schoolId: number,
  requestId: number,
): Promise<LooseCourseRequestRow> {
  const query = filterToQueryParams({
    course_request_id: { _eq: requestId },
    school_id: { _eq: schoolId },
  });
  query.set("fields", COURSE_REQUEST_FIELDS);
  query.set("limit", "2");
  const rows = await fetchRows(
    operation,
    `/items/vs_course_request?${query.toString()}`,
    looseCourseRequestRowSchema,
  );
  if (rows.length === 0) throw scopedNotFound();
  if (rows.length > 1) throw dependencyError(`${operation}.ambiguous`);
  const only = rows[0];
  if (only === undefined) throw dependencyError(`${operation}.response`);
  return only;
}

function requireCompleteRouteAudit(operation: string, row: LooseCourseRequestRow): void {
  if (row.routed_by === null || row.routed_at === null) {
    conflict(
      "ROUTE_AUDIT_CONFLICT",
      "The course request is missing its manual route audit.",
    );
  }
}

/**
 * Claim-shape invariant for decision rows: `reviewed_at` must stay null
 * until finalization, and `matched_school_course_id`/`reviewed_by` must
 * be jointly null (actionable) or jointly non-null (finalizing). Mixed
 * hybrids fail closed as ROUTE_AUDIT_CONFLICT.
 */
function requireDecisionClaimShape(operation: string, row: LooseCourseRequestRow): void {
  if (row.reviewed_at !== null) {
    conflict(
      "ROUTE_AUDIT_CONFLICT",
      `The course request row carries an unexpected terminal shape during ${operation}.`,
    );
  }
  const hasCourse = row.matched_school_course_id !== null;
  const hasReviewer = row.reviewed_by !== null;
  if (hasCourse !== hasReviewer) {
    conflict(
      "ROUTE_AUDIT_CONFLICT",
      "The course request claim fields are inconsistent.",
    );
  }
}

/**
 * Decision fetch: own-school `RoutedToSchool` rows only. Terminal
 * (Approved/Rejected) and Pending rows resolve to NOT_FOUND here; the
 * separate terminal-replay fetch owns those states.
 */
export async function fetchScopedCourseRequestForDecision(
  ctx: CourseRequestSchoolContext,
  requestId: number,
): Promise<ScopedCourseRequestRow> {
  const operation = "courseRequest.fetchForDecision";
  const { schoolId } = requireContext(operation, ctx);
  requirePositive(operation, "requestId", requestId);
  const row = await fetchExactScopedRequest(operation, schoolId, requestId);
  if (row.request_status !== "RoutedToSchool") throw scopedNotFound();
  requireCompleteRouteAudit(operation, row);
  requireDecisionClaimShape(operation, row);
  return strictRequest(operation, row);
}

/**
 * Terminal replay fetch: own-school `Approved`/`Rejected` rows only.
 * `RoutedToSchool`/`Pending` rows resolve to NOT_FOUND here, so routed
 * rows are never prematurely returned as terminal.
 */
export async function fetchScopedTerminalReplay(
  ctx: CourseRequestSchoolContext,
  requestId: number,
): Promise<ScopedCourseRequestRow> {
  const operation = "courseRequest.fetchTerminalReplay";
  const { schoolId } = requireContext(operation, ctx);
  requirePositive(operation, "requestId", requestId);
  const row = await fetchExactScopedRequest(operation, schoolId, requestId);
  if (row.request_status !== "Approved" && row.request_status !== "Rejected") {
    throw scopedNotFound();
  }
  requireCompleteRouteAudit(operation, row);
  return strictRequest(operation, row);
}

/**
 * List the inbox with MUTUALLY EXCLUSIVE filters: actionable rows carry
 * null claim fields, finalizing rows carry the locked
 * `matched_school_course_id` + original `reviewed_by`. Rows that fail
 * strict inbox parsing (e.g. invalid hybrids) never serialize.
 */
export async function listCourseRequestInbox(
  ctx: CourseRequestSchoolContext,
): Promise<CourseRequestInboxListing> {
  const operation = "courseRequest.listInbox";
  const { schoolId } = requireContext(operation, ctx);

  const actionableQuery = filterToQueryParams({
    school_id: { _eq: schoolId },
    request_status: { _eq: "RoutedToSchool" },
    routed_by: { _nnull: true },
    routed_at: { _nnull: true },
    matched_school_course_id: { _null: true },
    reviewed_by: { _null: true },
    reviewed_at: { _null: true },
  });
  actionableQuery.set("fields", COURSE_REQUEST_FIELDS);
  actionableQuery.set("limit", "-1");
  const actionableRows = await fetchRows(
    `${operation}.actionable`,
    `/items/vs_course_request?${actionableQuery.toString()}`,
    scopedCourseRequestRowSchema,
  );

  const finalizingQuery = filterToQueryParams({
    school_id: { _eq: schoolId },
    request_status: { _eq: "RoutedToSchool" },
    routed_by: { _nnull: true },
    routed_at: { _nnull: true },
    matched_school_course_id: { _nnull: true },
    reviewed_by: { _nnull: true },
    reviewed_at: { _null: true },
  });
  finalizingQuery.set("fields", COURSE_REQUEST_FIELDS);
  finalizingQuery.set("limit", "-1");
  const finalizingRows = await fetchRows(
    `${operation}.finalizing`,
    `/items/vs_course_request?${finalizingQuery.toString()}`,
    scopedCourseRequestRowSchema,
  );

  return { schoolId, actionable: actionableRows, finalizing: finalizingRows };
}

/**
 * Latest own-school `vs_school_request` link per education id. The
 * `matched_school_id` filter keeps the lookup inside the caller's school so
 * no cross-school document set can resolve.
 */
const schoolRequestLinkSchema = z
  .object({
    school_request_id: z.number().int().positive(),
    employee_education_id: z.number().int().positive(),
  })
  .strict();

/**
 * Proof documents for the inbox's education ids, resolved through each
 * education's latest own-school request and the shared batched document
 * lookup. One request-link query plus the shared helper's two queries for
 * the whole batch, never per-row N+1. Educations with no own-school request
 * resolve to an empty list.
 */
export async function fetchDocumentsByEducationIds(
  ctx: CourseRequestSchoolContext,
  educationIds: readonly number[],
): Promise<ReadonlyMap<number, readonly CourseRequestDocument[]>> {
  const operation = "courseRequest.documents";
  const { schoolId } = requireContext(operation, ctx);
  const unique = [...new Set(educationIds)].filter((id) => Number.isInteger(id) && id > 0);
  const byEducation = new Map<number, readonly CourseRequestDocument[]>();
  for (const id of unique) byEducation.set(id, []);
  if (unique.length === 0) return byEducation;

  const linkQuery = new URLSearchParams({
    "filter[employee_education_id][_in]": unique.join(","),
    "filter[matched_school_id][_eq]": String(schoolId),
    "filter[request_status][_in]": "RoutedToSchool,Approved",
    fields: "school_request_id,employee_education_id",
    sort: "-school_request_id",
    limit: "-1",
  });
  const links = await fetchRows(
    `${operation}.requests`,
    `/items/vs_school_request?${linkQuery.toString()}`,
    schoolRequestLinkSchema,
  );
  const latestByEducation = new Map<number, number>();
  for (const link of links) {
    if (!latestByEducation.has(link.employee_education_id)) {
      latestByEducation.set(link.employee_education_id, link.school_request_id);
    }
  }
  if (latestByEducation.size === 0) return byEducation;

  let shared: ReadonlyMap<number, readonly CourseRequestDocument[]>;
  try {
    shared = await fetchDocumentsBySchoolRequestIds([...latestByEducation.values()]);
  } catch (error: unknown) {
    if (error instanceof SchoolRequestSchoolAdminError) {
      throw dependencyError(operation, error.status, error);
    }
    throw error;
  }
  for (const [educationId, requestId] of latestByEducation) {
    byEducation.set(educationId, shared.get(requestId) ?? []);
  }
  return byEducation;
}

/** Allowlisted Active same-school course candidates (exactly five fields). */
export async function listActiveCourseCandidates(
  ctx: CourseRequestSchoolContext,
): Promise<readonly CourseRequestCandidate[]> {
  const operation = "courseRequest.listCandidates";
  const { schoolId } = requireContext(operation, ctx);
  const query = filterToQueryParams({
    school_id: { _eq: schoolId },
    course_status: { _eq: "Active" },
  });
  query.set("fields", CANDIDATE_FIELDS);
  query.set("limit", "-1");
  const rows = await fetchRows(
    operation,
    `/items/vs_school_course?${query.toString()}`,
    scopedCourseStatusSchema,
  );
  const candidates: CourseRequestCandidate[] = [];
  for (const row of rows) {
    if (row.school_id !== schoolId || row.course_status !== "Active") {
      throw dependencyError(`${operation}.scope`);
    }
    const parsed = courseRequestCandidateSchema.safeParse({
      schoolCourseId: row.school_course_id,
      courseName: row.course_name,
      courseCode: row.course_code,
      degree: row.degree,
      courseStatus: row.course_status,
    });
    if (!parsed.success) throw dependencyError(`${operation}.response`);
    candidates.push(parsed.data);
  }
  return candidates;
}

/**
 * Own-school Active course validation shared by claim and finalize paths.
 * Foreign, absent, or non-Active courses fail closed as COURSE_CONFLICT
 * and write nothing.
 */
async function requireActiveOwnCourse(
  operation: string,
  schoolId: number,
  courseId: number,
): Promise<void> {
  requirePositive(operation, "courseId", courseId);
  const query = filterToQueryParams({
    school_course_id: { _eq: courseId },
    school_id: { _eq: schoolId },
  });
  query.set("fields", COURSE_STATUS_FIELDS);
  query.set("limit", "2");
  const rows = await fetchRows(
    `${operation}.course`,
    `/items/vs_school_course?${query.toString()}`,
    scopedCourseStatusSchema,
  );
  if (rows.length === 0) {
    conflict("COURSE_CONFLICT", "The selected course is not available for this school.");
  }
  if (rows.length > 1) throw dependencyError(`${operation}.course.ambiguous`);
  const only = rows[0];
  if (only === undefined) throw dependencyError(`${operation}.course.response`);
  if (only.course_status !== "Active") {
    conflict("COURSE_CONFLICT", "The selected course is not available for this school.");
  }
}

/**
 * Roster prerequisite / exact-course replay / read-back. Requires the
 * education id, the school id, `invitation_status: "Registered"`, and
 * `registered_user_id === ownerUserId === education.user_id`, with a null
 * course (`expectedCourseId: null`) or the exact course
 * (`expectedCourseId: <id>`) as appropriate. Zero, duplicate, mismatched,
 * unregistered, or wrong-owner rows fail closed as ROSTER_CONFLICT and
 * never fabricate convergence.
 */
export async function fetchRosterCoursePrerequisite(
  ctx: CourseRequestSchoolContext,
  educationId: number,
  ownerUserId: number,
  expectedCourseId: number | null,
): Promise<ScopedRosterRow> {
  const operation = "courseRequest.fetchRosterPrerequisite";
  const { schoolId } = requireContext(operation, ctx);
  requirePositive(operation, "educationId", educationId);
  requirePositive(operation, "ownerUserId", ownerUserId);
  if (expectedCourseId !== null) requirePositive(operation, "expectedCourseId", expectedCourseId);

  const educationQuery = filterToQueryParams({
    employee_education_id: { _eq: educationId },
  });
  educationQuery.set("fields", EDUCATION_OWNER_FIELDS);
  educationQuery.set("limit", "2");
  const educationRows = await fetchRows(
    `${operation}.education`,
    `/items/vs_employee_education?${educationQuery.toString()}`,
    scopedEducationOwnerSchema,
  );
  if (educationRows.length === 0) {
    conflict("ROSTER_CONFLICT", "The education-linked roster row is missing.");
  }
  if (educationRows.length > 1) {
    conflict("ROSTER_CONFLICT", "The education-linked roster rows are ambiguous.");
  }
  const education = educationRows[0];
  if (education === undefined) throw dependencyError(`${operation}.education.response`);
  if (education.user_id !== ownerUserId) {
    conflict("ROSTER_CONFLICT", "The roster row belongs to a different owner.");
  }

  const rosterQuery = filterToQueryParams({
    employee_education_id: { _eq: educationId },
  });
  rosterQuery.set("fields", ROSTER_FIELDS);
  rosterQuery.set("limit", "2");
  const rosterRows = await fetchRows(
    operation,
    `/items/vs_school_student?${rosterQuery.toString()}`,
    scopedRosterRowSchema,
  );
  if (rosterRows.length === 0) {
    conflict("ROSTER_CONFLICT", "The education-linked roster row is missing.");
  }
  if (rosterRows.length > 1) {
    conflict("ROSTER_CONFLICT", "The education-linked roster rows are ambiguous.");
  }
  const roster = rosterRows[0];
  if (roster === undefined) throw dependencyError(`${operation}.response`);
  if (
    roster.school_id !== schoolId ||
    roster.invitation_status !== "Registered" ||
    roster.registered_user_id !== ownerUserId
  ) {
    conflict("ROSTER_CONFLICT", "The roster row is not a registered row of this school and owner.");
  }
  if (expectedCourseId === null) {
    if (roster.school_course_id !== null) {
      conflict("ROSTER_CONFLICT", "The roster row already carries a course.");
    }
  } else if (roster.school_course_id !== expectedCourseId) {
    conflict("ROSTER_CONFLICT", "The roster row does not carry the expected course.");
  }
  return roster;
}

function isExactClaim(row: ScopedCourseRequestRow, courseId: number): boolean {
  return (
    row.request_status === "RoutedToSchool" &&
    row.matched_school_course_id === courseId &&
    row.reviewed_by !== null &&
    row.reviewed_at === null
  );
}

/**
 * School-scoped claim. The mutation filter carries `course_request_id`,
 * the resolved `school_id`, the `RoutedToSchool` source status, the
 * non-null manual route audit, and null claim fields. An exact same-course
 * claim converges to the persisted row (preserving the original reviewer,
 * so another currently authorized admin may resume); any other persisted
 * divergence fails closed as STATE_CONFLICT with zero rows written.
 */
export async function claimScopedCourseRequest(
  ctx: CourseRequestSchoolContext,
  input: ClaimScopedCourseRequestInput,
): Promise<ScopedCourseRequestRow> {
  const operation = "courseRequest.claimScoped";
  const { schoolId } = requireContext(operation, ctx);
  requirePositive(operation, "requestId", input.requestId);
  requirePositive(operation, "courseId", input.courseId);
  requirePositive(operation, "reviewerId", input.reviewerId);

  const current = await fetchScopedCourseRequestForDecision(ctx, input.requestId);
  if (isExactClaim(current, input.courseId)) return current;
  if (current.matched_school_course_id !== null || current.reviewed_by !== null) {
    conflict("STATE_CONFLICT", "The course request claim conflicts with persisted state.");
  }
  await requireActiveOwnCourse(operation, schoolId, input.courseId);

  const updated = await patchGuardedRow<LooseCourseRequestRow>(
    operation,
    "vs_course_request",
    {
      course_request_id: { _eq: input.requestId },
      school_id: { _eq: schoolId },
      request_status: { _eq: "RoutedToSchool" },
      routed_by: { _nnull: true },
      routed_at: { _nnull: true },
      matched_school_course_id: { _null: true },
      reviewed_by: { _null: true },
      reviewed_at: { _null: true },
    },
    {
      matched_school_course_id: input.courseId,
      reviewed_by: input.reviewerId,
    },
    COURSE_REQUEST_FIELDS,
    looseCourseRequestRowSchema,
  );
  if (updated !== null) {
    requireCompleteRouteAudit(operation, updated);
    requireDecisionClaimShape(operation, updated);
    const parsed = strictRequest(operation, updated);
    if (!isExactClaim(parsed, input.courseId)) {
      conflict("STATE_CONFLICT", "The course request claim conflicts with persisted state.");
    }
    return parsed;
  }
  const readBack = await fetchScopedCourseRequestForDecision(ctx, input.requestId);
  if (isExactClaim(readBack, input.courseId)) return readBack;
  conflict("STATE_CONFLICT", "Another course request claim won.");
}

/**
 * Owner-and-registration-guarded roster course patch. The mutation filter
 * carries the student id, education id, school id, `Registered` status,
 * the exact `registered_user_id` owner, and the null course, so an owner
 * or registration swap between read and write still affects zero rows.
 * An exact same-course replay converges to the persisted row.
 */
export async function completeScopedRegisteredRosterCourse(
  ctx: CourseRequestSchoolContext,
  input: ScopedRosterCourseInput,
): Promise<ScopedRosterRow> {
  const operation = "courseRequest.completeRosterCourse";
  const { schoolId } = requireContext(operation, ctx);
  requirePositive(operation, "educationId", input.educationId);
  requirePositive(operation, "ownerUserId", input.ownerUserId);
  requirePositive(operation, "courseId", input.courseId);

  try {
    return await fetchRosterCoursePrerequisite(ctx, input.educationId, input.ownerUserId, input.courseId);
  } catch (error: unknown) {
    if (!isCode(error, "ROSTER_CONFLICT")) throw error;
  }

  const prerequisite = await fetchRosterCoursePrerequisite(
    ctx,
    input.educationId,
    input.ownerUserId,
    null,
  );

  const updated = await patchGuardedRow<ScopedRosterRow>(
    operation,
    "vs_school_student",
    {
      student_id: { _eq: prerequisite.student_id },
      employee_education_id: { _eq: input.educationId },
      school_id: { _eq: schoolId },
      invitation_status: { _eq: "Registered" },
      registered_user_id: { _eq: input.ownerUserId },
      school_course_id: { _null: true },
    },
    { school_course_id: input.courseId },
    ROSTER_FIELDS,
    scopedRosterRowSchema,
  );
  if (updated !== null) {
    if (
      updated.school_id !== schoolId ||
      updated.invitation_status !== "Registered" ||
      updated.registered_user_id !== input.ownerUserId ||
      updated.school_course_id !== input.courseId
    ) {
      conflict("ROSTER_CONFLICT", "The roster row changed before course completion.");
    }
    return updated;
  }
  return fetchRosterCoursePrerequisite(ctx, input.educationId, input.ownerUserId, input.courseId);
}

/**
 * School-scoped approval finalization. The mutation filter carries
 * `course_request_id`, the resolved `school_id`, the `RoutedToSchool`
 * source status, the non-null manual route audit, the exact locked
 * `matched_school_course_id`, a non-null original `reviewed_by`, and null
 * `reviewed_at`. An exact terminal Approved replay converges without
 * replacing the original reviewer; every other divergence fails closed
 * as STATE_CONFLICT with zero rows written.
 */
export async function finalizeScopedCourseApproval(
  ctx: CourseRequestSchoolContext,
  input: FinalizeScopedCourseApprovalInput,
): Promise<ScopedCourseRequestRow> {
  const operation = "courseRequest.finalizeApproval";
  const { schoolId } = requireContext(operation, ctx);
  requirePositive(operation, "requestId", input.requestId);
  requirePositive(operation, "courseId", input.courseId);
  await requireActiveOwnCourse(operation, schoolId, input.courseId);

  let decision: ScopedCourseRequestRow;
  try {
    decision = await fetchScopedCourseRequestForDecision(ctx, input.requestId);
  } catch (error: unknown) {
    if (isCode(error, "NOT_FOUND")) {
      const terminal = await fetchScopedTerminalReplay(ctx, input.requestId);
      if (
        terminal.request_status === "Approved" &&
        terminal.matched_school_course_id === input.courseId &&
        terminal.reviewed_at !== null
      ) {
        return terminal;
      }
      conflict("STATE_CONFLICT", "Approval does not match the persisted terminal state.");
    }
    throw error;
  }
  if (!isExactClaim(decision, input.courseId)) {
    conflict("STATE_CONFLICT", "Approval does not match the persisted claim.");
  }

  const updated = await patchGuardedRow<LooseCourseRequestRow>(
    operation,
    "vs_course_request",
    {
      course_request_id: { _eq: input.requestId },
      school_id: { _eq: schoolId },
      request_status: { _eq: "RoutedToSchool" },
      routed_by: { _nnull: true },
      routed_at: { _nnull: true },
      matched_school_course_id: { _eq: input.courseId },
      reviewed_by: { _nnull: true },
      reviewed_at: { _null: true },
    },
    { request_status: "Approved", reviewed_at: philippineTimestamp() },
    COURSE_REQUEST_FIELDS,
    looseCourseRequestRowSchema,
  );
  if (updated !== null) {
    if (
      updated.request_status !== "Approved" ||
      updated.matched_school_course_id !== input.courseId ||
      updated.reviewed_at === null
    ) {
      conflict("STATE_CONFLICT", "Approval finalization lost its source-state guard.");
    }
    return strictRequest(operation, updated);
  }
  try {
    const terminal = await fetchScopedTerminalReplay(ctx, input.requestId);
    if (
      terminal.request_status === "Approved" &&
      terminal.matched_school_course_id === input.courseId &&
      terminal.reviewed_at !== null
    ) {
      return terminal;
    }
  } catch (error: unknown) {
    if (!isCode(error, "NOT_FOUND")) {
      throw error;
    }
  }
  conflict("STATE_CONFLICT", "Approval finalization lost its source-state guard.");
}

function isExactRejectionReplay(
  row: ScopedCourseRequestRow,
  reviewerId: number,
  trimmedRemarks: string,
): boolean {
  if (row.request_status !== "Rejected") return false;
  if (row.reviewed_by !== reviewerId) return false;
  return (row.admin_remarks ?? "").trim() === trimmedRemarks;
}

/**
 * School-scoped rejection. Requires a pristine actionable row (null claim
 * fields) and trimmed non-blank remarks; education and roster remain
 * untouched. The mutation filter carries `course_request_id`, the resolved
 * `school_id`, the `RoutedToSchool` source status, the non-null manual
 * route audit, and null claim fields. Read-back converges ONLY when the
 * reviewer AND the trimmed `admin_remarks` both match; any other terminal
 * divergence fails closed as REPLAY_CONFLICT.
 */
export async function rejectScopedCourseRequest(
  ctx: CourseRequestSchoolContext,
  input: RejectScopedCourseRequestInput,
): Promise<ScopedCourseRequestRow> {
  const operation = "courseRequest.rejectScoped";
  requireContext(operation, ctx);
  requirePositive(operation, "requestId", input.requestId);
  requirePositive(operation, "reviewerId", input.reviewerId);
  const trimmedRemarks = input.remarks.trim();
  if (trimmedRemarks.length === 0) {
    throw invalidInputError("remarks must be a non-blank string.");
  }

  let decision: ScopedCourseRequestRow;
  try {
    decision = await fetchScopedCourseRequestForDecision(ctx, input.requestId);
  } catch (error: unknown) {
    if (isCode(error, "NOT_FOUND")) {
      const terminal = await fetchScopedTerminalReplay(ctx, input.requestId);
      if (isExactRejectionReplay(terminal, input.reviewerId, trimmedRemarks)) return terminal;
      conflict("REPLAY_CONFLICT", "The rejection conflicts with the persisted terminal state.");
    }
    throw error;
  }
  if (decision.matched_school_course_id !== null || decision.reviewed_by !== null) {
    conflict("STATE_CONFLICT", "The rejection conflicts with the persisted claim.");
  }

  const context = requireContext(operation, ctx);
  const updated = await patchGuardedRow<LooseCourseRequestRow>(
    operation,
    "vs_course_request",
    {
      course_request_id: { _eq: input.requestId },
      school_id: { _eq: context.schoolId },
      request_status: { _eq: "RoutedToSchool" },
      routed_by: { _nnull: true },
      routed_at: { _nnull: true },
      matched_school_course_id: { _null: true },
      reviewed_by: { _null: true },
      reviewed_at: { _null: true },
    },
    {
      request_status: "Rejected",
      reviewed_by: input.reviewerId,
      reviewed_at: philippineTimestamp(),
      admin_remarks: trimmedRemarks,
    },
    COURSE_REQUEST_FIELDS,
    looseCourseRequestRowSchema,
  );
  if (updated !== null) {
    const parsed = strictRequest(operation, updated);
    if (!isExactRejectionReplay(parsed, input.reviewerId, trimmedRemarks)) {
      conflict("REPLAY_CONFLICT", "Rejection finalization lost its source-state guard.");
    }
    return parsed;
  }
  const terminal = await fetchScopedTerminalReplay(ctx, input.requestId);
  if (isExactRejectionReplay(terminal, input.reviewerId, trimmedRemarks)) return terminal;
  conflict("REPLAY_CONFLICT", "Rejection finalization lost its source-state guard.");
}

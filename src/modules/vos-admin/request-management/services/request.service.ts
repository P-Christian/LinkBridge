// src/modules/vos-admin/request-management/services/request.service.ts
import "server-only";

import { z } from "zod";
import {
  claimCourseRequest,
  completeAttendanceRosterCourse,
  fetchActiveCoursesForSchool,
  fetchApprovedAttendanceEvidence,
  finalizeCourseRequest,
  reconcileLinkedEducation,
  VerificationPrimitiveError,
  assertCourseRequestReviewAllowed,
  EducationFlowUnavailableError,
  getEducationVerificationMode,
  type ActiveSchoolCourse,
} from "../../../education-verification";
import {
  fetchSchoolRequest as fetchRoutingSchoolRequest,
  groupSchoolRequest as groupSchoolRequestPrimitive,
  rejectSchoolRequest as rejectSchoolRequestPrimitive,
  routeSchoolRequest as routeSchoolRequestPrimitive,
  SchoolRequestRoutingError,
} from "../../../school-request-routing";
import {
  fetchRows,
} from "../../../education-verification/directus";
import type { ReviewCourseRequestDecision } from "../types/request.schema";
import { 
  VsSchoolRequest, 
  VsCourseRequest, 
  ReviewAction 
} from '../types/request.types';
import {
  fetchSchoolRequestsRepo,
  fetchCourseRequestsRepo,
  reviewSchoolRequestRepo,
  fetchSchoolRequestById,
  fetchCourseRequestById,
} from './request.repo';
import { notifyEducationRejection } from "@/lib/notifications/services/education-rejection";
import {
  resolveLegacyApprovalTarget,
  verifyLegacyApprovalTarget,
} from './legacy-school-approval';

export async function getSchoolRequests(status?: string): Promise<VsSchoolRequest[]> {
  return fetchSchoolRequestsRepo(status);
}

export async function getCourseRequests(status?: string): Promise<VsCourseRequest[]> {
  return fetchCourseRequestsRepo(status);
}

export interface CourseRequestCandidates {
  readonly requestId: number;
  readonly schoolId: number;
  readonly candidates: readonly ActiveSchoolCourse[];
}

/**
 * Request-scoped Active course candidates derived from the PERSISTED school
 * of the course request. There is intentionally no school-override input:
 * callers cannot ask for another school's catalog through this API.
 */
export async function getCourseRequestCandidates(
  requestId: number,
): Promise<CourseRequestCandidates> {
  if (!Number.isInteger(requestId) || requestId <= 0) {
    throw decisionError("INVALID_INPUT", "Course request id must be a positive integer.", 400);
  }
  const link = await fetchCourseRequestLink(requestId);
  let candidates: readonly ActiveSchoolCourse[];
  try {
    candidates = await fetchActiveCoursesForSchool(link.school_id);
  } catch (error: unknown) {
    throw toDecisionError(error, "Course catalog storage is temporarily unavailable.");
  }
  return { requestId: link.course_request_id, schoolId: link.school_id, candidates };
}

export async function reviewSchoolRequest(id: number, data: ReviewAction, adminId: number): Promise<VsSchoolRequest> {
  // Plan 2 Todo 3 quarantine gate: the legacy approve/reject implementation
  // below is reachable ONLY in legacy mode, byte-unchanged. Attendance mode
  // refuses it with a typed unsupported 409; frozen denies it with 503.
  const mode = getEducationVerificationMode();
  if (mode === "frozen") {
    throw new EducationFlowUnavailableError();
  }
  if (mode === "attendance") {
    throw new SchoolRequestRoutingError(
      "UNSUPPORTED_ACTION",
      "Legacy school-request approval is unavailable in attendance mode.",
      409,
    );
  }
  const payload: Partial<VsSchoolRequest> = {
    request_status: data.action,
    reviewed_by: adminId,
    reviewed_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " "), // PH Time
  };

  if (data.action === 'Approved') {
    if (!data.matched_school_id) {
      throw new Error("A matched school ID is required when approving a school request.");
    }
    payload.matched_school_id = data.matched_school_id;
  } else if (data.action === 'Rejected') {
    if (!data.admin_remarks || data.admin_remarks.trim() === '') {
      throw new Error("Admin remarks are required when rejecting a school request.");
    }
    payload.admin_remarks = data.admin_remarks;
  }

  // Legacy approval verifies exactly the linked Pending education: the link
  // is resolved before this mutation, so a missing or foreign link fails
  // closed before the request patch writes anything.
  if (data.action === 'Approved' && data.matched_school_id) {
    const target = await resolveLegacyApprovalTarget(id);
    await reviewSchoolRequestRepo(id, payload);
    await verifyLegacyApprovalTarget(target, data.matched_school_id);
  } else {
    await reviewSchoolRequestRepo(id, payload);
  }

  // Re-fetch the updated request to ensure we have the populated `requested_by` fields for the UI
  return fetchSchoolRequestById(id);
}

export async function reviewCourseRequest(
  id: number,
  data: ReviewCourseRequestDecision,
  adminId: number,
  options?: CourseReviewOptions,
): Promise<VsCourseRequest> {
  requireVosActor(adminId, options);
  assertCourseRequestReviewAllowed();
  if (!Number.isInteger(id) || id <= 0) {
    throw decisionError("INVALID_INPUT", "Course request id must be a positive integer.", 400);
  }
  switch (data.action) {
    case "Approved": {
      if (!Number.isInteger(data.matched_school_course_id) || data.matched_school_course_id <= 0) {
        throw decisionError("INVALID_INPUT", "A matched course ID is required when approving a course request.", 400);
      }
      return approveCourseRequest(id, data.matched_school_course_id, adminId);
    }
    case "Rejected": {
      if (!data.admin_remarks || data.admin_remarks.trim() === "") {
        throw decisionError("INVALID_INPUT", "Admin remarks are required when rejecting a course request.", 400);
      }
      return rejectCourseRequest(id, data.admin_remarks.trim(), adminId);
    }
    case "RoutedToSchool":
      return routeCourseRequest(id, adminId);
    default:
      throw decisionError("INVALID_INPUT", "Unsupported course request decision.", 400);
  }
}

export type CourseDecisionErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "STATE_CONFLICT"
  | "EVIDENCE_ABSENT"
  | "ROSTER_ABSENT"
  | "AMBIGUOUS"
  | "CORRELATION_CONFLICT"
  | "CLAIM_CONFLICT"
  | "DEPENDENCY_FAILURE";

export class CourseRequestDecisionError extends Error {
  public readonly name = "CourseRequestDecisionError";

  public constructor(
    public readonly code: CourseDecisionErrorCode,
    message: string,
    public readonly status: 400 | 403 | 404 | 409 | 503,
  ) {
    super(message);
  }
}

function decisionError(
  code: CourseDecisionErrorCode,
  message: string,
  status: 400 | 403 | 404 | 409 | 503,
): CourseRequestDecisionError {
  return new CourseRequestDecisionError(code, message, status);
}

export interface CourseReviewOptions {
  /**
   * Admin Portal role id. When present it must be 3 (Admin Portal); otherwise the
   * decision is rejected with 403. The API layer (Todo 5) always supplies it;
   * direct service callers without role context leave it undefined.
   */
  readonly roleId?: number;
}

const VOS_ADMIN_ROLE_ID = 3;

function requireVosActor(adminId: number, options?: CourseReviewOptions): void {
  if (!Number.isInteger(adminId) || adminId <= 0) {
    throw decisionError("INVALID_INPUT", "A valid Admin Portal id is required.", 400);
  }
  if (options?.roleId !== undefined && options.roleId !== VOS_ADMIN_ROLE_ID) {
    throw decisionError("FORBIDDEN", "Course request decisions are restricted to Admin Portals.", 403);
  }
}

function toDecisionError(error: unknown, fallback: string): CourseRequestDecisionError {
  if (error instanceof CourseRequestDecisionError) return error;
  if (error instanceof VerificationPrimitiveError) {
    switch (error.code) {
      case "INVALID_INPUT":
        return decisionError("INVALID_INPUT", error.message, 400);
      case "NOT_FOUND":
        return decisionError("NOT_FOUND", error.message, 404);
      case "DEPENDENCY_FAILURE":
        // Never leak storage internals to the caller.
        return decisionError("DEPENDENCY_FAILURE", "Education verification storage is temporarily unavailable.", 503);
      case "EVIDENCE_ABSENT":
        return decisionError("EVIDENCE_ABSENT", error.message, 409);
      case "ROSTER_ABSENT":
        return decisionError("ROSTER_ABSENT", error.message, 409);
      case "AMBIGUOUS":
        return decisionError("AMBIGUOUS", error.message, 409);
      case "CORRELATION_CONFLICT":
      case "OWNERSHIP_CONFLICT":
        return decisionError("CORRELATION_CONFLICT", error.message, 409);
      case "STALE_CONFLICT":
      case "CLAIM_CONFLICT":
      case "CONCURRENT_CHANGE":
      case "INVALID_ROUTE_AUDIT":
        return decisionError("CLAIM_CONFLICT", error.message, 409);
      default:
        return decisionError("CORRELATION_CONFLICT", error.message, 409);
    }
  }
  return decisionError("DEPENDENCY_FAILURE", fallback, 503);
}

const requesterIdSchema = z
  .union([z.number().int(), z.object({ user_id: z.number().int() })])
  .transform((value) => (typeof value === "number" ? value : value.user_id));

const courseRequestLinkSchema = z.object({
  course_request_id: z.number().int(),
  employee_education_id: z.number().int().nullable(),
  school_id: z.number().int(),
  requested_by: requesterIdSchema,
  requested_course_name: z.string(),
  request_status: z.string(),
  matched_school_course_id: z.number().int().nullable(),
  reviewed_by: z.number().int().nullable(),
  reviewed_at: z.string().nullable(),
  routed_by: z.number().int().nullable(),
  routed_at: z.string().nullable(),
});

type CourseRequestLink = z.infer<typeof courseRequestLinkSchema>;

const COURSE_REQUEST_LINK_FIELDS = [
  "course_request_id",
  "employee_education_id",
  "school_id",
  "requested_by",
  "requested_course_name",
  "request_status",
  "matched_school_course_id",
  "reviewed_by",
  "reviewed_at",
  "routed_by",
  "routed_at",
  "admin_remarks",
].join(",");

const linkedEducationSchema = z.object({
  employee_education_id: z.number().int(),
  user_id: z.number().int(),
  school_id: z.number().int().nullable(),
  school_course_id: z.number().int().nullable(),
  school_name_raw: z.string().nullable(),
  course_name_raw: z.string().nullable(),
  education_status: z.string(),
});

type LinkedEducation = z.infer<typeof linkedEducationSchema>;

const LINKED_EDUCATION_FIELDS = [
  "employee_education_id",
  "user_id",
  "school_id",
  "school_course_id",
  "school_name_raw",
  "course_name_raw",
  "education_status",
  "end_date",
].join(",");

const linkedRosterSchema = z.object({
  student_id: z.number().int(),
  school_id: z.number().int(),
  school_course_id: z.number().int().nullable(),
  employee_education_id: z.number().int().nullable(),
  registered_user_id: z.number().int().nullable(),
});

const LINKED_ROSTER_FIELDS = [
  "student_id",
  "school_id",
  "school_course_id",
  "employee_education_id",
  "registered_user_id",
].join(",");

async function fetchCourseRequestLink(requestId: number): Promise<CourseRequestLink> {
  try {
    const query = new URLSearchParams({
      "filter[course_request_id][_eq]": String(requestId),
      fields: COURSE_REQUEST_LINK_FIELDS,
      limit: "2",
    });
    const rows = await fetchRows(
      "courseRequest.fetchForDecision",
      `/items/vs_course_request?${query.toString()}`,
      courseRequestLinkSchema,
    );
    if (rows.length === 0) {
      throw decisionError("NOT_FOUND", "Course request was not found.", 404);
    }
    if (rows.length > 1 || rows[0] === undefined) {
      throw decisionError("AMBIGUOUS", "Course request rows are ambiguous.", 409);
    }
    return rows[0];
  } catch (error: unknown) {
    throw toDecisionError(error, "Course request storage is temporarily unavailable.");
  }
}

async function fetchLinkedEducation(educationId: number): Promise<LinkedEducation> {
  try {
    const query = new URLSearchParams({
      "filter[employee_education_id][_eq]": String(educationId),
      fields: LINKED_EDUCATION_FIELDS,
      limit: "2",
    });
    const rows = await fetchRows(
      "courseRequest.fetchLinkedEducation",
      `/items/vs_employee_education?${query.toString()}`,
      linkedEducationSchema,
    );
    if (rows.length === 0) {
      throw decisionError("NOT_FOUND", "The linked education was not found.", 404);
    }
    if (rows.length > 1 || rows[0] === undefined) {
      throw decisionError("AMBIGUOUS", "Linked education rows are ambiguous.", 409);
    }
    return rows[0];
  } catch (error: unknown) {
    throw toDecisionError(error, "Education storage is temporarily unavailable.");
  }
}

async function approveCourseRequest(
  requestId: number,
  courseId: number,
  adminId: number,
): Promise<VsCourseRequest> {
  // 1. Exact-link Pending VOS-owned source state, with one exception: an
  // exact replay of an already-converged approval converges through the
  // idempotent finalize instead of conflicting. A null education link is a
  // typed conflict before any claim, education, or roster write.
  const link = await fetchCourseRequestLink(requestId);
  const linkedEducationId = link.employee_education_id;
  if (linkedEducationId === null) {
    throw decisionError("CORRELATION_CONFLICT", "The course request has no linked education.", 409);
  }
  if (
    link.request_status === "Approved" &&
    link.matched_school_course_id === courseId &&
    link.reviewed_by !== null &&
    link.reviewed_at !== null
  ) {
    try {
      await finalizeCourseRequest({ requestId, consumer: "vos", action: "Approved", courseId });
    } catch (error: unknown) {
      throw toDecisionError(error, "Course request storage is temporarily unavailable.");
    }
    return readBackCourseRequest(requestId);
  }
  if (link.request_status !== "Pending") {
    throw decisionError(
      "STATE_CONFLICT",
      `Only Pending course requests accept VOS decisions (current: ${link.request_status}).`,
      409,
    );
  }
  const request = link;
  const educationId: number = linkedEducationId;

  // 2. The exact education must exist, belong to the requester/school, and be Pending
  //    (an already-converged Verified row for the same school+course is replay-safe).
  const education = await fetchLinkedEducation(educationId);
  if (education.user_id !== request.requested_by || education.school_id !== request.school_id) {
    throw decisionError(
      "CORRELATION_CONFLICT",
      "The linked education does not belong to this request.",
      409,
    );
  }
  if (education.education_status !== "Pending") {
    const converged =
      education.education_status === "Verified" &&
      education.school_id === request.school_id &&
      education.school_course_id === courseId;
    if (!converged) {
      throw decisionError("STATE_CONFLICT", "Only a Pending linked education may be approved.", 409);
    }
  }

  // 3. The course must be an Active catalog course owned by the request's school.
  //    This validates the catalog only; attendance is never inferred from matching.
  let courseOk = false;
  try {
    const candidates = await fetchActiveCoursesForSchool(request.school_id);
    courseOk = candidates.some((course) => course.school_course_id === courseId);
  } catch (error: unknown) {
    throw toDecisionError(error, "Course catalog storage is temporarily unavailable.");
  }
  if (!courseOk) {
    throw decisionError(
      "CORRELATION_CONFLICT",
      "The selected course is not an Active course of this school.",
      409,
    );
  }

  // 4. Approved attendance evidence for the same school+education is mandatory.
  try {
    await fetchApprovedAttendanceEvidence({ educationId, schoolId: request.school_id });
  } catch (error: unknown) {
    throw toDecisionError(error, "Attendance storage is temporarily unavailable.");
  }

  // 5. Exactly ONE existing linked roster row must already exist. VOS never creates it.
  try {
    const query = new URLSearchParams({
      "filter[employee_education_id][_eq]": String(educationId),
      fields: LINKED_ROSTER_FIELDS,
      limit: "2",
    });
    const rows = await fetchRows(
      "courseRequest.requireRosterRow",
      `/items/vs_school_student?${query.toString()}`,
      linkedRosterSchema,
    );
    if (rows.length === 0) {
      throw decisionError("ROSTER_ABSENT", "No roster row exists for the linked education.", 409);
    }
    if (rows.length > 1 || rows[0] === undefined) {
      throw decisionError("AMBIGUOUS", "Education-linked roster rows are ambiguous.", 409);
    }
    if (rows[0].school_id !== request.school_id) {
      throw decisionError("CORRELATION_CONFLICT", "The roster row belongs to another school.", 409);
    }
  } catch (error: unknown) {
    throw toDecisionError(error, "Roster storage is temporarily unavailable.");
  }

  // 6. Claim matched course + reviewer. Only the winning claim proceeds; any other
  //    Admin Portal may resume the SAME claim (reviewer preserved), while a different
  //    course conflicts with 409.
  try {
    await claimCourseRequest({ requestId, consumer: "vos", reviewerId: adminId, courseId });
  } catch (error: unknown) {
    throw toDecisionError(error, "Course request storage is temporarily unavailable.");
  }

  // 7. Revalidate the persisted claim and the attendance evidence before writing.
  const claimed = await fetchCourseRequestLink(requestId);
  if (
    claimed.request_status !== "Pending" ||
    claimed.matched_school_course_id !== courseId ||
    claimed.reviewed_by === null ||
    claimed.reviewed_at !== null
  ) {
    throw decisionError("CLAIM_CONFLICT", "The persisted claim no longer matches this approval.", 409);
  }
  try {
    await fetchApprovedAttendanceEvidence({ educationId, schoolId: request.school_id });
  } catch (error: unknown) {
    throw toDecisionError(error, "Attendance storage is temporarily unavailable.");
  }

  // 8. Guardedly complete the EXISTING roster row's course (never insert).
  try {
    await completeAttendanceRosterCourse({ educationId, schoolId: request.school_id, courseId });
  } catch (error: unknown) {
    throw toDecisionError(error, "Roster storage is temporarily unavailable.");
  }

  // 9. Reconcile the education to Verified ONLY after roster success.
  try {
    await reconcileLinkedEducation({
      mode: "courseCompletion",
      educationId,
      requesterId: education.user_id,
      canonicalSchoolId: request.school_id,
      canonicalCourseId: courseId,
    });
  } catch (error: unknown) {
    throw toDecisionError(error, "Education storage is temporarily unavailable.");
  }

  // 10. Finalize Approved + review time.
  try {
    await finalizeCourseRequest({ requestId, consumer: "vos", action: "Approved", courseId });
  } catch (error: unknown) {
    throw toDecisionError(error, "Course request storage is temporarily unavailable.");
  }

  return readBackCourseRequest(requestId);
}

async function rejectCourseRequest(
  requestId: number,
  remarks: string,
  adminId: number,
): Promise<VsCourseRequest> {
  // Rejection needs no approval/review/route claim and no attendance evidence,
  // but still requires the VOS-owned Pending source state.
  const request = await fetchCourseRequestLink(requestId);
  if (
    request.request_status !== "Pending" ||
    request.matched_school_course_id !== null ||
    request.reviewed_by !== null ||
    request.reviewed_at !== null ||
    request.routed_by !== null ||
    request.routed_at !== null
  ) {
    // An exact replay by the same reviewer converges; anything else conflicts.
    if (request.request_status === "Rejected" && request.reviewed_by === adminId) {
      return readBackCourseRequest(requestId);
    }
    throw decisionError(
      "STATE_CONFLICT",
      `Only Pending course requests accept VOS decisions (current: ${request.request_status}).`,
      409,
    );
  }
  try {
    await finalizeCourseRequest({
      requestId,
      consumer: "vos",
      action: "Rejected",
      reviewerId: adminId,
      remarks,
    });
  } catch (error: unknown) {
    throw toDecisionError(error, "Course request storage is temporarily unavailable.");
  }
  await notifyEducationRejection({
    kind: "course",
    requestId,
    educationId: request.employee_education_id,
    recipientUserId: request.requested_by,
    courseName: request.requested_course_name,
    reason: remarks,
    rejectedBy: "vos_admin",
  });
  return readBackCourseRequest(requestId);
}

async function routeCourseRequest(requestId: number, adminId: number): Promise<VsCourseRequest> {
  // Routing needs no approval/review/route claim, but requires Pending source
  // state and writes a non-null VOS actor + time as the manual route audit.
  // A null actor is the explicit SYSTEM-route marker and is never written here.
  const request = await fetchCourseRequestLink(requestId);
  if (
    request.request_status === "RoutedToSchool" &&
    request.routed_by === adminId &&
    request.routed_at !== null
  ) {
    return readBackCourseRequest(requestId);
  }
  if (
    request.request_status !== "Pending" ||
    request.matched_school_course_id !== null ||
    request.reviewed_by !== null ||
    request.reviewed_at !== null ||
    request.routed_by !== null ||
    request.routed_at !== null
  ) {
    throw decisionError(
      "STATE_CONFLICT",
      `Only Pending course requests accept VOS decisions (current: ${request.request_status}).`,
      409,
    );
  }
  try {
    await finalizeCourseRequest({
      requestId,
      consumer: "vos",
      action: "RoutedToSchool",
      reviewerId: adminId,
    });
  } catch (error: unknown) {
    throw toDecisionError(error, "Course request storage is temporarily unavailable.");
  }
  const routed = await readBackCourseRequest(requestId);
  if (routed.routed_by === null || routed.routed_by === undefined || !routed.routed_at) {
    throw decisionError("DEPENDENCY_FAILURE", "Routing did not persist its audit trail.", 503);
  }
  return routed;
}

async function readBackCourseRequest(requestId: number): Promise<VsCourseRequest> {
  try {
    // Re-fetch the updated request to ensure we have the populated
    // `requested_by` fields for the UI.
    return await fetchCourseRequestById(requestId);
  } catch {
    const link = await fetchCourseRequestLink(requestId);
    return {
      course_request_id: link.course_request_id,
      school_id: link.school_id,
      requested_by: link.requested_by,
      requested_course_name: link.requested_course_name,
      request_status: link.request_status as VsCourseRequest["request_status"],
      matched_school_course_id: link.matched_school_course_id,
      reviewed_by: link.reviewed_by,
      reviewed_at: link.reviewed_at,
      routed_by: link.routed_by,
      routed_at: link.routed_at,
      employee_education_id: link.employee_education_id,
      created_at: "",
    };
  }
}

export type SchoolRequestLinkState =
  | "both-null"
  | "equal-linked"
  | "historical-only"
  | "active-only"
  | "mismatched";

export function classifySchoolRequestLink(link: {
  readonly employee_education_id: number | null;
  readonly active_employee_education_id: number | null;
}): SchoolRequestLinkState {
  const historical = link.employee_education_id ?? null;
  const active = link.active_employee_education_id ?? null;
  if (historical === null && active === null) return "both-null";
  if (historical !== null && active !== null) {
    return historical === active ? "equal-linked" : "mismatched";
  }
  return historical !== null ? "historical-only" : "active-only";
}

function requireSchoolRoutingWrite(): void {
  const mode = getEducationVerificationMode();
  if (mode === "frozen") {
    throw new EducationFlowUnavailableError();
  }
  if (mode === "legacy") {
    throw new SchoolRequestRoutingError(
      "UNSUPPORTED_ACTION",
      "Route, Group, and Reject are unavailable in legacy mode.",
      409,
    );
  }
}

function requirePositiveSchoolId(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new SchoolRequestRoutingError("INVALID_INPUT", `${field} must be a positive integer.`, 400);
  }
}

// Route and group decisions run only on an exact education link: the
// historical and active education ids must agree and be positive. Raw
// school names stay display and audit fields and never authorize a
// mutation, so a null or disagreeing link fails closed before any write.
async function requireExactSchoolRequestLink(requestId: number): Promise<number> {
  const request = await fetchRoutingSchoolRequest(requestId);
  if (classifySchoolRequestLink(request) !== "equal-linked") {
    throw new SchoolRequestRoutingError(
      "CORRELATION_CONFLICT",
      "The school request has no exact linked education.",
      409,
    );
  }
  const linked = request.employee_education_id;
  if (linked === null || !Number.isInteger(linked) || linked <= 0) {
    throw new SchoolRequestRoutingError(
      "CORRELATION_CONFLICT",
      "The school request education link is missing.",
      409,
    );
  }
  return linked;
}

export async function routeSchoolRequestDecision(
  requestId: number,
  targetSchoolId: number,
  adminId: number,
): Promise<VsSchoolRequest> {
  requireSchoolRoutingWrite();
  requirePositiveSchoolId(requestId, "School request id");
  requirePositiveSchoolId(targetSchoolId, "Matched school id");
  requirePositiveSchoolId(adminId, "Admin Portal id");
  await requireExactSchoolRequestLink(requestId);
  await routeSchoolRequestPrimitive({ requestId, targetSchoolId, actorId: adminId });
  return fetchSchoolRequestById(requestId);
}

export async function groupSchoolRequestDecision(
  requestId: number,
  targetSchoolId: number,
  adminId: number,
): Promise<VsSchoolRequest> {
  requireSchoolRoutingWrite();
  requirePositiveSchoolId(requestId, "School request id");
  requirePositiveSchoolId(targetSchoolId, "Matched school id");
  requirePositiveSchoolId(adminId, "Admin Portal id");
  await requireExactSchoolRequestLink(requestId);
  await groupSchoolRequestPrimitive({ requestId, targetSchoolId });
  return fetchSchoolRequestById(requestId);
}

export async function rejectSchoolRequestDecision(
  requestId: number,
  remarks: string,
  adminId: number,
): Promise<VsSchoolRequest> {
  requireSchoolRoutingWrite();
  requirePositiveSchoolId(requestId, "School request id");
  requirePositiveSchoolId(adminId, "Admin Portal id");
  const outcome = await rejectSchoolRequestPrimitive({ requestId, actorId: adminId, remarks });
  if (outcome.kind === "mutated") {
    await notifyEducationRejection({
      kind: "school_request",
      requestId,
      educationId: outcome.request.employee_education_id,
      recipientUserId: outcome.request.requested_by,
      schoolName: outcome.request.requested_school_name,
      reason: remarks.trim(),
      rejectedBy: "vos_admin",
    });
  }
  return fetchSchoolRequestById(requestId);
}


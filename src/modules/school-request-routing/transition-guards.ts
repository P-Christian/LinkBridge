import "server-only";

import { routingError } from "./errors";
import { parseRouteAudit } from "./route-audit";
import type {
  EducationRecord,
  GroupSchoolInput,
  MatchSchoolInput,
  RejectSchoolRequestInput,
  RouteSchoolInput,
  SchoolRecord,
  SchoolRequestRecord,
  SystemReleaseOutcome,
} from "./types";

export function hasNoAuditOrRemarks(request: SchoolRequestRecord): boolean {
  return (
    request.matched_school_id === null &&
    request.routed_by === null &&
    request.routed_at === null &&
    request.reviewed_by === null &&
    request.reviewed_at === null &&
    request.admin_remarks === null
  );
}

export function requireEducationLink(request: SchoolRequestRecord): number {
  if (
    request.employee_education_id === null ||
    request.active_employee_education_id !== request.employee_education_id
  ) {
    throw routingError(
      "CORRELATION_CONFLICT",
      "The active and historical education links do not agree."
    );
  }
  return request.employee_education_id;
}

export function assertPendingEducation(
  education: EducationRecord,
  request: SchoolRequestRecord,
  targetSchool: SchoolRecord
): void {
  if (
    education.user_id !== request.requested_by ||
    education.education_status !== "Pending"
  ) {
    throw routingError(
      "CORRELATION_CONFLICT",
      "The linked education no longer belongs to this Pending request."
    );
  }
  if (education.school_id === targetSchool.school_id) return;
  if (education.school_id !== null) {
    throw routingError(
      "CORRELATION_CONFLICT",
      "The linked education is bound to a different school."
    );
  }
  return;
}

export function routeReplay(
  request: SchoolRequestRecord,
  input: RouteSchoolInput
): boolean {
  if (
    request.request_status !== "RoutedToSchool" ||
    request.matched_school_id !== input.targetSchoolId ||
    request.routed_by !== input.actorId ||
    request.reviewed_by !== null ||
    request.reviewed_at !== null ||
    request.admin_remarks !== null
  ) {
    return false;
  }
  parseRouteAudit(request);
  return true;
}

export function groupReplay(
  request: SchoolRequestRecord,
  input: GroupSchoolInput
): boolean {
  return (
    request.request_status === "Pending" &&
    request.matched_school_id === input.targetSchoolId &&
    request.routed_by === null &&
    request.routed_at === null &&
    request.reviewed_by === null &&
    request.reviewed_at === null &&
    request.admin_remarks === null
  );
}

export function matchReplay(
  request: SchoolRequestRecord,
  input: MatchSchoolInput
): boolean {
  return (
    request.request_status === "AwaitingOptIn" &&
    request.matched_school_id === input.targetSchoolId &&
    request.routed_by === null &&
    request.routed_at === null &&
    request.reviewed_by === null &&
    request.reviewed_at === null &&
    request.admin_remarks === null
  );
}

export function systemReplay(
  request: SchoolRequestRecord,
  targetSchoolId: number
): boolean {
  if (
    request.request_status !== "RoutedToSchool" ||
    request.matched_school_id !== targetSchoolId ||
    request.reviewed_by !== null ||
    request.reviewed_at !== null
  ) {
    return false;
  }
  const audit = parseRouteAudit(request);
  return audit.kind === "system" && audit.matched_school_id === targetSchoolId;
}

export function skippedRelease(
  request: SchoolRequestRecord,
  targetSchoolId: number
): SystemReleaseOutcome {
  if (request.request_status !== "Pending") {
    return { kind: "skipped", reason: "terminal", request };
  }
  if (request.matched_school_id !== targetSchoolId) {
    return { kind: "skipped", reason: "retargeted", request };
  }
  if (request.reviewed_by !== null || request.reviewed_at !== null) {
    return { kind: "skipped", reason: "already-claimed", request };
  }
  return { kind: "skipped", reason: "concurrent-change", request };
}

export function rejectReplay(
  request: SchoolRequestRecord,
  input: RejectSchoolRequestInput
): boolean {
  return (
    request.request_status === "Rejected" &&
    request.admin_remarks === input.remarks.trim() &&
    request.reviewed_by === input.actorId &&
    request.reviewed_at !== null &&
    request.active_employee_education_id === null &&
    request.routed_by === null &&
    request.routed_at === null
  );
}

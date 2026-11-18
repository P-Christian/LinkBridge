import "server-only";

import { getPHTimeString } from "@/lib/utils";
import { patchRows } from "./directus";
import { routingError } from "./errors";
import {
  bindEducationSchool,
  classifySchoolRoute,
  fetchEducation,
  fetchSchoolRoute,
  fetchSchoolRequest,
  listWaitingSchoolRequests,
  SCHOOL_REQUEST_FIELDS,
} from "./records";
import { schoolRequestSchema } from "./schemas";
import {
  assertPendingEducation,
  groupReplay,
  hasNoAuditOrRemarks,
  matchReplay,
  rejectReplay,
  requireEducationLink,
  routeReplay,
  skippedRelease,
  systemReplay,
} from "./transition-guards";
import type {
  GroupSchoolInput,
  MatchSchoolInput,
  RejectSchoolRequestInput,
  RouteSchoolInput,
  SchoolRequestRecord,
  SystemReleaseInput,
  SystemReleaseOutcome,
  TransitionOutcome,
} from "./types";

async function patchRequest(
  operation: string,
  filter: Readonly<Record<string, unknown>>,
  data: Readonly<Record<string, unknown>>
): Promise<SchoolRequestRecord | null> {
  return patchRows(
    {
      operation,
      collection: "vs_school_request",
      filter,
      data,
      fields: SCHOOL_REQUEST_FIELDS,
    },
    schoolRequestSchema
  );
}

export async function routeSchoolRequest(input: RouteSchoolInput): Promise<TransitionOutcome> {
  const request = await fetchSchoolRequest(input.requestId);
  if (routeReplay(request, input)) return { kind: "converged", request };
  if (request.request_status !== "Pending" || !hasNoAuditOrRemarks(request)) {
    throw routingError("STALE_CONFLICT", "The school request is no longer routable.");
  }
  const educationId = requireEducationLink(request);
  const [schoolRoute, education] = await Promise.all([
    fetchSchoolRoute(input.targetSchoolId),
    fetchEducation(educationId),
  ]);
  if (schoolRoute.classification !== "DIRECT_REVIEW") {
    throw routingError("TARGET_INELIGIBLE", "The target school is not a review-ready Verified and Active school.");
  }
  assertPendingEducation(education, request, schoolRoute.school);
  const updated = await patchRequest(
    "schoolRequest.route",
    {
      school_request_id: { _eq: input.requestId },
      request_status: { _eq: "Pending" },
      matched_school_id: { _null: true },
      routed_by: { _null: true },
      routed_at: { _null: true },
      reviewed_by: { _null: true },
      reviewed_at: { _null: true },
      admin_remarks: { _null: true },
      employee_education_id: { _eq: educationId },
      active_employee_education_id: { _eq: educationId },
    },
    {
      matched_school_id: input.targetSchoolId,
      routed_by: input.actorId,
      routed_at: getPHTimeString(),
      request_status: "RoutedToSchool",
    }
  );
  if (updated) {
    if (education.school_id === null) {
      await bindEducationSchool(educationId, input.targetSchoolId);
    }
    return { kind: "mutated", request: updated };
  }
  const current = await fetchSchoolRequest(input.requestId);
  if (routeReplay(current, input)) return { kind: "converged", request: current };
  throw routingError("STALE_CONFLICT", "The school request changed before routing completed.");
}

export async function groupSchoolRequest(input: GroupSchoolInput): Promise<TransitionOutcome> {
  const request = await fetchSchoolRequest(input.requestId);
  if (groupReplay(request, input)) return { kind: "converged", request };
  if (
    request.request_status !== "Pending" ||
    request.matched_school_id !== null ||
    request.routed_by !== null ||
    request.routed_at !== null ||
    request.reviewed_by !== null ||
    request.reviewed_at !== null ||
    request.admin_remarks !== null
  ) {
    throw routingError("STALE_CONFLICT", "The school request is no longer groupable.");
  }
  const educationId = requireEducationLink(request);
  const [schoolRoute, education] = await Promise.all([
    fetchSchoolRoute(input.targetSchoolId),
    fetchEducation(educationId),
  ]);
  if (
    schoolRoute.classification !== "AWAITING_ACTIVATION" &&
    schoolRoute.classification !== "AWAITING_REGISTRATION"
  ) {
    throw routingError("TARGET_INELIGIBLE", "The target school is not a server-classified waiting school.");
  }
  assertPendingEducation(education, request, schoolRoute.school);
  const updated = await patchRequest(
    "schoolRequest.group",
    {
      school_request_id: { _eq: input.requestId },
      request_status: { _eq: "Pending" },
      matched_school_id: { _null: true },
      routed_by: { _null: true },
      routed_at: { _null: true },
      reviewed_by: { _null: true },
      reviewed_at: { _null: true },
      admin_remarks: { _null: true },
      employee_education_id: { _eq: educationId },
      active_employee_education_id: { _eq: educationId },
    },
    { matched_school_id: input.targetSchoolId, request_status: "Pending" }
  );
  if (updated) {
    if (education.school_id === null) {
      await bindEducationSchool(educationId, input.targetSchoolId);
    }
    return { kind: "mutated", request: updated };
  }
  const current = await fetchSchoolRequest(input.requestId);
  if (groupReplay(current, input)) return { kind: "converged", request: current };
  throw routingError("STALE_CONFLICT", "The school request changed before grouping completed.");
}

export async function matchSchoolRequest(input: MatchSchoolInput): Promise<TransitionOutcome> {
  const request = await fetchSchoolRequest(input.requestId);
  if (matchReplay(request, input)) return { kind: "converged", request };
  if (
    request.request_status !== "AwaitingOptIn" ||
    request.matched_school_id !== null ||
    request.routed_by !== null ||
    request.routed_at !== null ||
    request.reviewed_by !== null ||
    request.reviewed_at !== null ||
    request.admin_remarks !== null
  ) {
    throw routingError("STALE_CONFLICT", "The school request is no longer matchable.");
  }
  const educationId = requireEducationLink(request);
  const [schoolRoute, education] = await Promise.all([
    fetchSchoolRoute(input.targetSchoolId),
    fetchEducation(educationId),
  ]);
  if (
    schoolRoute.classification !== "DIRECT_REVIEW" &&
    schoolRoute.classification !== "AWAITING_ACTIVATION" &&
    schoolRoute.classification !== "AWAITING_REGISTRATION"
  ) {
    throw routingError("TARGET_INELIGIBLE", "The target school is not eligible for matching.");
  }
  assertPendingEducation(education, request, schoolRoute.school);
  const updated = await patchRequest(
    "schoolRequest.match",
    {
      school_request_id: { _eq: input.requestId },
      request_status: { _eq: "AwaitingOptIn" },
      matched_school_id: { _null: true },
      routed_by: { _null: true },
      routed_at: { _null: true },
      reviewed_by: { _null: true },
      reviewed_at: { _null: true },
      admin_remarks: { _null: true },
      employee_education_id: { _eq: educationId },
      active_employee_education_id: { _eq: educationId },
    },
    { matched_school_id: input.targetSchoolId }
  );
  if (updated) {
    if (education.school_id === null) {
      await bindEducationSchool(educationId, input.targetSchoolId);
    }
    return { kind: "mutated", request: updated };
  }
  const current = await fetchSchoolRequest(input.requestId);
  if (matchReplay(current, input)) return { kind: "converged", request: current };
  throw routingError("STALE_CONFLICT", "The school request changed before matching completed.");
}

export async function releaseGroupedSchoolRequest(input: SystemReleaseInput): Promise<SystemReleaseOutcome> {
  const request = await fetchSchoolRequest(input.requestId);
  if (systemReplay(request, input.targetSchoolId)) return { kind: "converged", request };
  if (request.request_status === "RoutedToSchool") return skippedRelease(request, input.targetSchoolId);
  if (request.request_status !== "Pending" || request.matched_school_id !== input.targetSchoolId) {
    return skippedRelease(request, input.targetSchoolId);
  }
  if (
    request.routed_by !== null ||
    request.routed_at !== null ||
    request.reviewed_by !== null ||
    request.reviewed_at !== null ||
    request.admin_remarks !== null
  ) {
    return skippedRelease(request, input.targetSchoolId);
  }
  const classification = await classifySchoolRoute(input.targetSchoolId);
  if (classification !== "DIRECT_REVIEW") {
    return { kind: "skipped", reason: "ineligible-school", request };
  }
  const updated = await patchRequest(
    "schoolRequest.systemRelease",
    {
      school_request_id: { _eq: input.requestId },
      request_status: { _eq: "Pending" },
      matched_school_id: { _eq: input.targetSchoolId },
      routed_by: { _null: true },
      routed_at: { _null: true },
      reviewed_by: { _null: true },
      reviewed_at: { _null: true },
      admin_remarks: { _null: true },
    },
    { matched_school_id: input.targetSchoolId, routed_by: null, routed_at: getPHTimeString(), request_status: "RoutedToSchool" }
  );
  if (updated) return { kind: "mutated", request: updated };
  const current = await fetchSchoolRequest(input.requestId);
  if (systemReplay(current, input.targetSchoolId)) return { kind: "converged", request: current };
  return skippedRelease(current, input.targetSchoolId);
}

export async function rejectSchoolRequest(input: RejectSchoolRequestInput): Promise<TransitionOutcome> {
  const remarks = input.remarks.trim();
  if (remarks.length === 0) throw routingError("INVALID_INPUT", "Rejection remarks must not be blank.");
  const request = await fetchSchoolRequest(input.requestId);
  const normalizedInput = { ...input, remarks };
  if (rejectReplay(request, normalizedInput)) return { kind: "converged", request };
  if (
    request.request_status !== "Pending" ||
    request.routed_by !== null ||
    request.routed_at !== null ||
    request.reviewed_by !== null ||
    request.reviewed_at !== null ||
    request.admin_remarks !== null
  ) {
    throw routingError("STALE_CONFLICT", "The school request is no longer rejectable.");
  }
  const updated = await patchRequest(
    "schoolRequest.reject",
    {
      school_request_id: { _eq: input.requestId },
      request_status: { _eq: "Pending" },
      routed_by: { _null: true },
      routed_at: { _null: true },
      reviewed_by: { _null: true },
      reviewed_at: { _null: true },
      admin_remarks: { _null: true },
    },
    {
      request_status: "Rejected",
      admin_remarks: remarks,
      reviewed_by: input.actorId,
      reviewed_at: getPHTimeString(),
      active_employee_education_id: null,
    }
  );
  if (updated) return { kind: "mutated", request: updated };
  const current = await fetchSchoolRequest(input.requestId);
  if (rejectReplay(current, normalizedInput)) return { kind: "converged", request: current };
  throw routingError("STALE_CONFLICT", "The school request changed before rejection completed.");
}

// Targeted per-school release of parked (Pending + matched) requests.
// Safe when not review-ready (releaseGroupedSchoolRequest returns
// skipped/ineligible-school). Idempotent and best-effort, never throws.
export interface ParkedReleaseSummary {
  readonly scanned: number;
  readonly released: number;
  readonly skipped: number;
  readonly failed: number;
}

export async function releaseParkedRequestsForSchool(
  schoolId: number
): Promise<ParkedReleaseSummary> {
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    return { scanned: 0, released: 0, skipped: 0, failed: 0 };
  }
  let waiting: readonly SchoolRequestRecord[];
  try {
    waiting = await listWaitingSchoolRequests(schoolId);
  } catch {
    return { scanned: 0, released: 0, skipped: 0, failed: 0 };
  }
  let released = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of waiting) {
    try {
      const outcome = await releaseGroupedSchoolRequest({
        requestId: row.school_request_id,
        targetSchoolId: schoolId,
      });
      if (outcome.kind === "mutated") released += 1;
      else skipped += 1;
    } catch {
      failed += 1;
    }
  }
  return { scanned: waiting.length, released, skipped, failed };
}

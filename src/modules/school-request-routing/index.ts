import "server-only";

export { claimSchoolAttendance, normalizeRosterAcademics } from "./attendance-claim";
export { SchoolRequestRoutingError } from "./errors";
export {
  bindEducationSchool,
  EDUCATION_BIND_FIELDS,
  fetchEducation,
  fetchSchool,
  fetchSchoolRequest,
  listWaitingSchoolRequests,
  classifySchoolRoute,
} from "./records";
export { parseRouteAudit } from "./route-audit";
export {
  groupSchoolRequest,
  matchSchoolRequest,
  rejectSchoolRequest,
  releaseGroupedSchoolRequest,
  releaseParkedRequestsForSchool,
  routeSchoolRequest,
} from "./transitions";
export type { ParkedReleaseSummary } from "./transitions";
export type {
  AttendanceClaimInput,
  EducationRecord,
  GroupSchoolInput,
  MatchSchoolInput,
  NormalizedRosterAcademics,
  RejectSchoolRequestInput,
  RequestStatus,
  RosterAcademicsInput,
  RouteAudit,
  RouteSchoolInput,
  SchoolRequestRecord,
  SchoolRouteClassification,
  SystemReleaseInput,
  SystemReleaseOutcome,
  TransitionOutcome,
} from "./types";

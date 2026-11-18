import "server-only";

export {
  COURSE_REQUEST_SCHOOL_ADMIN_ERROR_CODES,
  CourseRequestSchoolAdminError,
  courseRequestError,
  dependencyError,
  forbiddenError,
  invalidInputError,
  scopedNotFound,
  unauthenticatedError,
} from "./errors";
export {
  courseRequestActionableRowSchema,
  courseRequestCandidateSchema,
  courseRequestDecisionInputSchema,
  courseRequestDecisionResponseSchema,
  courseRequestDecisionResultSchema,
  courseRequestErrorCodeSchema,
  courseRequestErrorEnvelopeSchema,
  courseRequestFinalizingRowSchema,
  courseRequestInboxResponseSchema,
  courseRequestInboxSchema,
  scopedCourseRequestRowSchema,
} from "./schemas";
export {
  claimScopedCourseRequest,
  completeScopedRegisteredRosterCourse,
  fetchDocumentsByEducationIds,
  fetchRosterCoursePrerequisite,
  fetchScopedCourseRequestForDecision,
  fetchScopedTerminalReplay,
  finalizeScopedCourseApproval,
  listActiveCourseCandidates,
  listCourseRequestInbox,
  rejectScopedCourseRequest,
} from "./repo";
export type {
  ClaimScopedCourseRequestInput,
  CourseRequestInboxListing,
  CourseRequestSchoolContext,
  FinalizeScopedCourseApprovalInput,
  RejectScopedCourseRequestInput,
  ScopedRosterCourseInput,
  ScopedRosterRow,
} from "./repo";
export { approveCourseRequest, rejectCourseRequest } from "./service";
export type {
  ApproveCourseRequestInput,
  RejectCourseRequestInput,
} from "./service";
export type { CourseRequestSchoolAdminErrorCode } from "./errors";
export type {
  CourseRequestActionableRow,
  CourseRequestCandidate,
  CourseRequestDecisionInput,
  CourseRequestDecisionResponse,
  CourseRequestDecisionResult,
  CourseRequestDocument,
  CourseRequestFinalizingRow,
  CourseRequestInbox,
  CourseRequestInboxResponse,
  CourseRequestInboxRow,
} from "./types";

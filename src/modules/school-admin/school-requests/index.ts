import "server-only";

export { resolveExactSchoolAssignment } from "./assignment.resolver";
export {
  assignmentError,
  dependencyError,
  invalidInputError,
  SchoolRequestSchoolAdminError,
  schoolRequestError,
  scopedNotFound,
} from "./errors";
export { fetchScopedRequest, listFinalizingForAssignment, listRoutedForAssignment } from "./repo";
export { fetchDocumentsBySchoolRequestIds } from "./documents";
export { schoolRequestInboxRowSchema } from "./schemas";
export { fetchSchoolRequestForSchool, listSchoolRequestInbox } from "./service";
export {
  approveSchoolAttendance,
  recoverSchoolAttendance,
  rejectSchoolAttendance,
} from "./attendance.service";
export type {
  AttendanceAcademics,
  AttendanceDecisionInput,
  AttendanceDecisionResult,
  AttendanceRejectionInput,
  AttendanceRejectionResult,
} from "./attendance.types";
export type {
  LinkedCourseSummary,
  LinkedEducationSummary,
  SchoolAssignment,
  SchoolRequestDocument,
  SchoolRequestInbox,
  SchoolRequestInboxRow,
  SchoolRequestInboxStatus,
} from "./types";

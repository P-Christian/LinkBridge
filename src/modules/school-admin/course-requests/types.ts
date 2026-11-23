import "server-only";

export type CourseRequestInboxStatus = "RoutedToSchool";
export type CourseRequestTerminalStatus = "Approved" | "Rejected";

/**
 * Proof-document metadata resolved through the education's latest school
 * request. Display fields plus the protected read-route URL only; the
 * Directus file id never crosses this boundary.
 */
export interface CourseRequestDocument {
  readonly documentId: number;
  readonly type: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly url: string;
}

/**
 * Actionable inbox row: own-school `RoutedToSchool` with a complete manual
 * route audit and null claim fields. Name-only submitter label and the
 * submission timestamp (`created_at` as `submittedAt`); no contact, profile,
 * document, or raw Directus fields ever cross this boundary.
 */
export interface CourseRequestActionableRow {
  readonly courseRequestId: number;
  readonly requestStatus: "RoutedToSchool";
  readonly requestedCourseName: string;
  readonly submitterName: string;
  readonly submittedAt: string;
  readonly routedBy: number;
  readonly routedAt: string;
  readonly matchedSchoolCourseId: null;
  readonly reviewedBy: null;
  readonly reviewedAt: null;
  readonly documents: readonly CourseRequestDocument[];
}

/**
 * Finalizing inbox row: own-school `RoutedToSchool` locking the persisted
 * matched course + original reviewer while `reviewedAt` stays null until
 * finalization.
 */
export interface CourseRequestFinalizingRow {
  readonly courseRequestId: number;
  readonly requestStatus: "RoutedToSchool";
  readonly requestedCourseName: string;
  readonly submitterName: string;
  readonly submittedAt: string;
  readonly routedBy: number;
  readonly routedAt: string;
  readonly matchedSchoolCourseId: number;
  readonly reviewedBy: number;
  readonly reviewedAt: null;
  readonly documents: readonly CourseRequestDocument[];
}

export type CourseRequestInboxRow = CourseRequestActionableRow | CourseRequestFinalizingRow;

/** Allowlisted Active same-school course candidate (exactly five fields). */
export interface CourseRequestCandidate {
  readonly schoolCourseId: number;
  readonly courseName: string;
  readonly courseCode: string | null;
  readonly degree: string | null;
  readonly courseStatus: "Active";
}

/**
 * School-scoped inbox: `routed` holds actionable decisions; `finalizing`
 * holds claim-locked recoverable rows. Mutually exclusive by row shape.
 */
export interface CourseRequestInbox {
  readonly schoolId: number;
  readonly routed: readonly CourseRequestActionableRow[];
  readonly finalizing: readonly CourseRequestFinalizingRow[];
  readonly courses: readonly CourseRequestCandidate[];
}

/** Strict PATCH decision input (wire uses snake_case course key). */
export type CourseRequestDecisionInput =
  | {
      readonly action: "approve";
      readonly matched_school_course_id: number;
    }
  | {
      readonly action: "reject";
      readonly remarks: string;
    };

/** Terminal PATCH result DTO. */
export interface CourseRequestDecisionResult {
  readonly courseRequestId: number;
  readonly requestStatus: CourseRequestTerminalStatus;
  readonly matchedSchoolCourseId: number | null;
  readonly reviewedBy: number;
  readonly reviewedAt: string;
  readonly adminRemarks: string | null;
}

/** GET inbox response envelope. */
export interface CourseRequestInboxResponse {
  readonly inbox: CourseRequestInbox;
}

/** PATCH decision response envelope. */
export interface CourseRequestDecisionResponse {
  readonly result: CourseRequestDecisionResult;
}

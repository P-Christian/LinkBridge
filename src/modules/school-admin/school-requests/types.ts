import "server-only";

/** Exactly-one active `vs_school_admin` assignment for the calling admin. */
export interface SchoolAssignment {
  readonly schoolAdminId: number;
  readonly schoolId: number;
  readonly userId: number;
}

/** Linked education expansion. Academics live on the roster row, never here. */
export interface LinkedEducationSummary {
  readonly employeeEducationId: number;
  readonly userId: number;
  readonly schoolId: number | null;
  readonly schoolCourseId: number | null;
  readonly courseNameRaw: string | null;
  readonly schoolNameRaw: string | null;
  readonly educationStatus: "Pending" | "Verified" | "Unverified";
  readonly startDate: string | null;
  readonly endDate: string | null;
}

/** Canonical course linked through the education row, when present. */
export interface LinkedCourseSummary {
  readonly schoolCourseId: number;
  readonly schoolId: number;
  readonly courseName: string;
  readonly courseCode: string | null;
}

export type SchoolRequestInboxStatus = "RoutedToSchool" | "Approved";

/**
 * Proof-document metadata for one `vs_education_document` row. Carries only
 * the display fields plus the protected read-route URL; the Directus file id
 * never crosses this boundary.
 */
export interface SchoolRequestDocument {
  readonly documentId: number;
  readonly type: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly url: string;
}

/**
 * Privacy-limited inbox row. Expands ONLY the linked education fields, the
 * linked course, relevant dates, the persisted reviewer/time claim, and the
 * requester id (needed later for review/recovery). Authoritative user
 * identity is fetched server-side only during approval and is never
 * part of this DTO.
 */
export interface SchoolRequestInboxRow {
  readonly schoolRequestId: number;
  readonly requestStatus: SchoolRequestInboxStatus;
  readonly matchedSchoolId: number;
  readonly requestedBy: number;
  readonly requestedSchoolName: string;
  readonly createdAt: string;
  readonly routedBy: number | null;
  readonly routedAt: string | null;
  readonly reviewedBy: number | null;
  readonly reviewedAt: string | null;
  readonly education: LinkedEducationSummary;
  readonly course: LinkedCourseSummary | null;
  readonly documents: readonly SchoolRequestDocument[];
}

/**
 * School-scoped inbox: `routed` holds actionable `RoutedToSchool` decisions;
 * `finalizing` holds recoverable `Approved` rows whose linked education is
 * still unresolved/Pending with no linked course request yet.
 */
export interface SchoolRequestInbox {
  readonly schoolId: number;
  readonly schoolAdminId: number;
  readonly routed: readonly SchoolRequestInboxRow[];
  readonly finalizing: readonly SchoolRequestInboxRow[];
}

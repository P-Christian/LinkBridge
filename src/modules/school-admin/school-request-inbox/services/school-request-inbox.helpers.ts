import type {
  SchoolAttendanceAcademics,
  SchoolInboxRow,
} from "@/modules/school-admin/hooks/useSchoolRequests";

/**
 * Pure presentation/validation helpers for the School Admin attendance inbox.
 *
 * Every helper reads ONLY the fields of the parsed inbox DTO. Nothing here
 * may introduce a new data source: the inbox renders the student name, the
 * school name from the request, the linked course, education dates, the
 * submitted date, and the saved decision date. Identity, alumni, contacts,
 * documents, and course/identity overrides are never part of any value
 * produced here.
 */

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Safe date-only label. Missing or invalid input renders an empty string. */
export function formatInboxDate(value: string | null | undefined): string {
  if (!hasText(value)) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Safe date+time label for the submitted date and the saved decision date.
 * Missing or invalid input renders an empty string.
 */
export function formatInboxDateTime(value: string | null | undefined): string {
  if (!hasText(value)) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Education attendance window. Missing values are dropped, never replaced
 * with a dash: both sides missing renders an empty string, and a single
 * present date renders just that date.
 */
export function formatEducationRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string {
  const start = formatInboxDate(startDate);
  const end = formatInboxDate(endDate);
  if (start.length === 0) return end;
  if (end.length === 0) return start;
  return `${start} - ${end}`;
}

export interface CourseDisplay {
  /** Course label, or the "no course" label when none is linked. */
  readonly label: string;
  readonly code: string | null;
  readonly resolved: boolean;
}

/**
 * Course display. The linked catalog course wins; a typed course is the
 * fallback; only when both are absent the label says so. No course name is
 * ever guessed or invented.
 */
export function describeCourse(row: SchoolInboxRow): CourseDisplay {
  if (row.course !== null) {
    return {
      label: row.course.courseName,
      code: hasText(row.course.courseCode) ? row.course.courseCode : null,
      resolved: true,
    };
  }
  if (hasText(row.education.courseNameRaw)) {
    return { label: row.education.courseNameRaw.trim(), code: null, resolved: true };
  }
  return { label: "No course on file", code: null, resolved: false };
}

/**
 * Defense in depth: only rows whose PERSISTED `matchedSchoolId` equals the
 * inbox's own school may render. A foreign-school row is dropped before any
 * cell is built, so no cross-school data can appear in the DOM even if the
 * boundary were ever widened by mistake.
 */
export function visibleInboxRows(
  rows: readonly SchoolInboxRow[],
  schoolId: number,
): readonly SchoolInboxRow[] {
  return rows.filter((row) => row.matchedSchoolId === schoolId);
}

/**
 * Saved-decision label for rows that already carry a persisted decision.
 * Shows the saved time only, never a numeric user identifier.
 */
export function describeSavedDecision(row: SchoolInboxRow): string | null {
  if (typeof row.reviewedBy !== "number") return null;
  const savedAt = formatInboxDateTime(row.reviewedAt);
  if (savedAt.length === 0) return null;
  return `Saved ${savedAt}`;
}

export interface ApprovalOutcomeCopy {
  readonly title: string;
  readonly body: string;
}

/**
 * Approval adds the student to the school's alumni list with the course they
 * studied. A linked catalog course is included directly; a typed course is
 * included and sent for course verification; a missing course leaves the
 * alumni record without a course.
 */
export function describeApprovalOutcome(row: SchoolInboxRow): ApprovalOutcomeCopy {
  const typedCourse = hasText(row.education.courseNameRaw) ? row.education.courseNameRaw.trim() : null;
  const courseNote =
    row.course !== null
      ? `The linked course "${row.course.courseName}" will be included in their alumni record.`
      : typedCourse !== null
        ? `Their course "${typedCourse}" will be included and sent for course verification.`
        : "No course is linked; their alumni record will have no course.";
  return {
    title: "Approving adds this student to your alumni list",
    body: `Approving adds them to your alumni list with the course they studied here. ${courseNote}`,
  };
}

export interface AcademicsInput {
  readonly studentNumber: string;
  readonly gpa: string;
  readonly schoolYear: string;
}

export interface AcademicsValidation {
  readonly academics: SchoolAttendanceAcademics;
  readonly error: string | null;
}

const STUDENT_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\- ]*$/u;
const SCHOOL_YEAR_PATTERN = /^\d{4}$/u;

/**
 * Client-side mirror of the server's optional-academics validation so
 * malformed input is blocked before any network call. GPA must be numeric
 * within 0..5, school year a four-digit year, and the student number a safe
 * identifier. Blank inputs are omitted entirely (never sent as "").
 */
export function validateAcademicsInput(input: AcademicsInput): AcademicsValidation {
  const studentNumber = input.studentNumber.trim();
  const gpaText = input.gpa.trim();
  const schoolYear = input.schoolYear.trim();

  if (studentNumber.length > 0 && !STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    return {
      academics: {},
      error: "Student number may contain letters, numbers, spaces and hyphens only.",
    };
  }
  if (gpaText.length > 0) {
    const gpa = Number(gpaText);
    if (!Number.isFinite(gpa) || gpa < 0 || gpa > 5) {
      return { academics: {}, error: "GPA must be between 0 and 5." };
    }
  }
  if (schoolYear.length > 0 && !SCHOOL_YEAR_PATTERN.test(schoolYear)) {
    return { academics: {}, error: "School year must be a four-digit year." };
  }

  return {
    academics: {
      ...(studentNumber.length > 0 ? { student_number: studentNumber } : {}),
      ...(gpaText.length > 0 ? { gpa: Number(gpaText) } : {}),
      ...(schoolYear.length > 0 ? { school_year: schoolYear } : {}),
    },
    error: null,
  };
}

export type InboxLoadFailureKind = "forbidden" | "unauthenticated" | "dependency" | "unknown";

/**
 * Classify a load error message from the HTTP boundary into the state the
 * page must render. The API maps 403 to "Forbidden ...", 401 to
 * "Unauthorized", and 503 to the sanitized dependency message.
 */
export function classifyInboxLoadError(message: string): InboxLoadFailureKind {
  const lower = message.toLowerCase();
  if (lower.includes("forbidden")) return "forbidden";
  if (lower.includes("unauthorized")) return "unauthenticated";
  if (lower.includes("temporarily unavailable")) return "dependency";
  return "unknown";
}

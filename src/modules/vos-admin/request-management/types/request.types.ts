// src/modules/vos-admin/request-management/types/request.types.ts

export type RequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'RoutedToSchool';

export interface VsSchoolRequest {
  school_request_id: number;
  requested_by: number | { user_id: number; user_fname: string; user_lname: string };
  requested_school_name: string;
  city_municipality?: string | null;
  province?: string | null;
  request_status: RequestStatus;
  matched_school_id?: number | null;
  admin_remarks?: string | null;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  routed_by?: number | null;
  routed_at?: string | null;
  employee_education_id?: number | null;
  active_employee_education_id?: number | null;
  created_at: string;
}

export interface VsCourseRequest {
  course_request_id: number;
  school_id: number;
  requested_by: number | { user_id: number; user_fname: string; user_lname: string };
  requested_course_name: string;
  requested_course_code?: string | null;
  request_status: RequestStatus;
  matched_school_course_id?: number | null;
  admin_remarks?: string | null;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  routed_by?: number | null;
  routed_at?: string | null;
  employee_education_id?: number | null;
  created_at: string;
}

export interface ReviewAction {
  action: 'Approved' | 'Rejected';
  admin_remarks?: string;
  matched_school_id?: number;
  matched_school_course_id?: number;
}

// --- Todo 6 additions: course decision + stale-state modeling (append-only) ---

/** Every VOS course decision variant (mirrors reviewCourseRequestSchema). */
export type CourseDecisionAction = 'Approved' | 'Rejected' | 'RoutedToSchool';

/** Discriminated decision input accepted by the course review endpoint. */
export type CourseRequestDecision =
  | { action: 'Approved'; matched_school_course_id: number; admin_remarks?: string }
  | { action: 'Rejected'; admin_remarks: string }
  | { action: 'RoutedToSchool'; admin_remarks?: string };

/**
 * Client-safe Active course candidate (structural subset of the catalog row).
 * Deliberately local: the hook module is client code and must not import the
 * server-only education-verification module.
 */
export interface CourseRequestCandidate {
  school_course_id: number;
  school_id: number;
  course_name: string;
  course_code: string | null;
  degree: string | null;
  course_status: 'Active';
}

/** Typed result of the request-scoped candidate endpoint. */
export interface CourseRequestCandidatesResult {
  requestId: number;
  schoolId: number;
  candidates: CourseRequestCandidate[];
}

/** Actions the UI may offer for a course request row. */
export type CourseAvailableAction = 'approve' | 'route' | 'reject' | 'resume';

/**
 * Persisted approval claim retained after a 503 response loss. The claim
 * initiator is the ORIGINAL reviewer (server `reviewed_by` when present) and
 * is never replaced, so any currently authorized Admin Portal can resume it.
 */
export interface PersistedCourseClaim {
  requestId: number;
  courseId: number;
  claimInitiator: number | null;
  phase: 'finalizing';
}

/** Feedback tone per course-request row. 409 surfaces `stale` (non-success). */
export interface CourseDecisionFeedback {
  tone: 'success' | 'stale' | 'finalizing' | 'error';
  message: string;
}

/** Exhaustive outcome of a course decision mutation. */
export type CourseDecisionOutcome =
  | { kind: 'decided'; action: CourseDecisionAction; request: VsCourseRequest }
  | { kind: 'stale'; action: CourseDecisionAction; requestId: number; message: string; reloaded: VsCourseRequest | null }
  | { kind: 'finalizing'; requestId: number; courseId: number; claimInitiator: number | null; persistedCourse: VsCourseRequest | null }
  | { kind: 'failed'; action: CourseDecisionAction; requestId: number; status: number; message: string };

// --- School draft outcome: parsed guard for POST /api/vos-admin/schools ---

/**
 * Created-or-reused school returned by the guarded draft endpoint. `reused` is
 * true when an existing normalized match was returned instead of a new row.
 */
export interface SchoolDraftOutcome {
  readonly school_id: number;
  readonly school_name: string;
  readonly city_municipality: string | null;
  readonly province: string | null;
  readonly verification_route: "DIRECT_REVIEW" | "AWAITING_ACTIVATION" | "AWAITING_REGISTRATION";
  readonly reused: boolean;
}

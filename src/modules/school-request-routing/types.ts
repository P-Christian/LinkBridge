import "server-only";

export const REQUEST_STATUSES = [
  "Pending",
  "Approved",
  "Rejected",
  "RoutedToSchool",
  "AwaitingOptIn",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type SchoolRouteClassification =
  | "DIRECT_REVIEW"
  | "AWAITING_ACTIVATION"
  | "AWAITING_REGISTRATION";

export type SchoolRequestRecord = {
  readonly school_request_id: number;
  readonly requested_by: number;
  readonly requested_school_name: string;
  readonly city_municipality: string | null;
  readonly province: string | null;
  readonly request_status: RequestStatus;
  readonly matched_school_id: number | null;
  readonly admin_remarks: string | null;
  readonly reviewed_by: number | null;
  readonly reviewed_at: string | null;
  readonly routed_by: number | null;
  readonly routed_at: string | null;
  readonly employee_education_id: number | null;
  readonly active_employee_education_id: number | null;
  readonly created_at: string;
};

export type EducationRecord = {
  readonly employee_education_id: number;
  readonly user_id: number;
  readonly school_id: number | null;
  readonly school_name_raw: string | null;
  readonly education_status: "Pending" | "Verified" | "Unverified";
};

export type SchoolRecord = {
  readonly school_id: number;
  readonly school_name: string;
  readonly school_status: string;
  readonly verification_status: string;
  readonly is_active: boolean | number;
};

export type SchoolAdminRecord = {
  readonly school_admin_id: number;
  readonly school_id: number;
  readonly user_id: number;
  readonly is_active: boolean | number;
};

export type RouteAudit =
  | {
      readonly kind: "manual";
      readonly routed_by: number;
      readonly routed_at: string;
    }
  | {
      readonly kind: "system";
      readonly routed_by: null;
      readonly routed_at: string;
      readonly matched_school_id: number;
    };

export type RouteSchoolInput = {
  readonly requestId: number;
  readonly targetSchoolId: number;
  readonly actorId: number;
};

export type GroupSchoolInput = {
  readonly requestId: number;
  readonly targetSchoolId: number;
};

export type MatchSchoolInput = {
  readonly requestId: number;
  readonly targetSchoolId: number;
};

export type SystemReleaseInput = {
  readonly requestId: number;
  readonly targetSchoolId: number;
};

export type RejectSchoolRequestInput = {
  readonly requestId: number;
  readonly actorId: number;
  readonly remarks: string;
};

export type AttendanceClaimInput = {
  readonly requestId: number;
  readonly expectedSchoolId: number;
  readonly callerSchoolId: number;
  readonly reviewerId: number;
  readonly replayClaim?: {
    readonly reviewed_by: number;
    readonly reviewed_at: string;
  };
};

export type TransitionOutcome =
  | {
      readonly kind: "mutated" | "converged";
      readonly request: SchoolRequestRecord;
    };

export type ReleaseSkipReason =
  | "terminal"
  | "retargeted"
  | "already-claimed"
  | "already-routed"
  | "ineligible-school"
  | "concurrent-change";

export type SystemReleaseOutcome =
  | TransitionOutcome
  | {
      readonly kind: "skipped";
      readonly reason: ReleaseSkipReason;
      readonly request: SchoolRequestRecord;
    };

export type RosterAcademicsInput = {
  readonly student_number?: string | number | null;
  readonly school_year?: string | number | null;
  readonly gpa?: string | number | null;
};

export type NormalizedRosterAcademics = {
  readonly student_number: string | null;
  readonly school_year: string | null;
  readonly gpa: number | null;
};

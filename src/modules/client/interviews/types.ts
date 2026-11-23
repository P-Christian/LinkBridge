// src/modules/client/interviews/types.ts

export type InterviewStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "CANCELLED"
  | "RESCHEDULED"
  | "COMPLETED"
  | "NO_SHOW";

export type InterviewFormat = "ONLINE" | "ONSITE" | "PHONE";

export type AttendanceStatus = "PENDING" | "ATTENDED" | "NO_SHOW";

export interface ScreeningAnswer {
  question_id?: number;
  question_text: string;
  answer_text: string;
}

export interface InterviewApplication {
  interview_application_id: number;
  interview_id: number;
  application_id: number;
  attendance_status: AttendanceStatus;
  candidate_notes?: string | null;
  feedback?: string | null;
  created_at?: string;

  // Joined applicant / job info
  applicant_name?: string;
  applicant_email?: string;
  applicant_phone?: string | null;
  applicant_avatar?: string | null;
  job_id?: number;
  job_title?: string;
  application_status?: string;
  current_stage_id?: number | null;
  stage_name?: string;
  stage_type?: string;
  stage_color?: string;
  allowed_next_stages?: Array<{
    id: number;
    stage_name: string;
    stage_type: string;
    color: string;
    is_terminal: boolean;
  }>;
  stage_readiness?: {
    blocking: boolean;
    missing: string[];
    code: string | null;
  } | null;
  screening_answers?: ScreeningAnswer[] | null;
}

export interface Interview {
  interview_id: number;
  company_id: number;
  interviewer_user_id: number;
  scheduled_at: string;
  duration_minutes?: number;
  timezone?: string;
  interview_format: InterviewFormat;
  meeting_link?: string | null;
  meeting_location?: string | null;
  interview_notes?: string | null;
  interview_status: InterviewStatus;
  cancel_reason?: string | null;
  created_by_user_id?: number;
  updated_by_user_id?: number | null;
  created_at?: string;

  // Joined array of candidate applications
  applications?: InterviewApplication[];
}

export interface InterviewFormData {
  interview_id?: string;
  application_ids: number[];
  scheduled_at: string; // "YYYY-MM-DDTHH:mm" format for datetime-local
  duration_minutes: number;
  timezone: string;
  interview_format: InterviewFormat | "";
  meeting_link: string;
  meeting_location: string;
  interview_notes: string;
  include_buffer?: boolean;
}

export interface EvaluationFormData {
  interview_application_id: number;
  attendance_status: AttendanceStatus;
  feedback: string;
  decision?: "HIRED" | "REJECTED" | "NO_ACTION";
  to_stage_id?: number | null;
}

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  RESCHEDULED: "Rescheduled",
  COMPLETED: "Completed",
  NO_SHOW: "No Show",
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PENDING: "Pending",
  ATTENDED: "Attended",
  NO_SHOW: "No Show",
};

export const INTERVIEW_FORMAT_LABELS: Record<InterviewFormat, string> = {
  ONLINE: "Online (Video Call)",
  ONSITE: "On-Site",
  PHONE: "Phone Call",
};

export const TIMEZONE_OPTIONS = [
  { value: "Asia/Manila", label: "Asia/Manila (PHT, UTC+08:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT, UTC+08:00)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST, UTC+09:00)" },
  { value: "Asia/Hong_Kong", label: "Asia/Hong_Kong (HKT, UTC+08:00)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST, UTC+10:00)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST, UTC+00:00)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET, UTC+01:00)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT, UTC-05:00)" },
  { value: "America/Chicago", label: "America/Chicago (CST/CDT, UTC-06:00)" },
  { value: "America/Denver", label: "America/Denver (MST/MDT, UTC-07:00)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT, UTC-08:00)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
];

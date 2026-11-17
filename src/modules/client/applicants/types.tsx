import { CanonicalStageType } from "@/modules/client/pipeline/types";

export type ApplicationStatus =
  | "APPLIED"
  | "UNDER_REVIEW"
  | "SHORTLISTED"
  | "INTERVIEWING"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN";

export type ApplicantFilterStatus =
  | "ALL"
  | "ACTIVE_PIPELINE"
  | CanonicalStageType
  | ApplicationStatus
  | `STAGE_${number}`
  | string;

export interface ApplicantStageOption {
  id: number;
  stage_name: string;
  stage_type: CanonicalStageType;
  color: string;
  is_terminal: boolean;
}

export type AssessmentMoveOutcome = "PASS" | "FAIL";

export interface Applicant {
  application_id: number;

  job_id: number;
  user_id: number;

  applicant_name: string;
  applicant_email: string;

  job_title: string;

  application_status: ApplicationStatus;
  current_stage_id?: number | null;
  stage_name?: string;
  stage_type?: CanonicalStageType;
  stage_color?: string;
  allowed_next_stages?: ApplicantStageOption[];
  stage_readiness?: {
    blocking: boolean;
    missing: string[];
    code: string | null;
  } | null;
  assessment_status?: string | null;
  assessment_needs_review?: boolean;

  client_notes?: string | null;

  skills: string[];

  experience_years: number;

  work_experience_count: number;

  resume_count: number;

  profile_completion: number;

  applied_at?: string;
  status_updated_at?: string;
  profile_image_url?: string | null;
  applicant_profile_image_url?: string | null;
  active_interview_id?: number | null;
  location?: string;
  education: EducationItem[];
  education_count: number;
  education_school?: string;
  education_course?: string;
  screening_answers_count?: number;

  // Referral Metadata
  is_referred?: boolean;
  referral_type?: 'SCHOOL_ADMIN' | 'FREELANCER';
  referrer_name?: string | null;
  referral_school_name?: string | null;
  referral_letter?: string | null;
}

export interface WorkExperienceItem {
  id: number;

  company_name: string;
  job_title: string;

  location?: string | null;

  location_type?: string | null;

  employment_type?: string | null;

  start_date?: string | null;

  end_date?: string | null;

  is_current_role?: boolean;

  job_description?: string | null;
}

export type EducationStatus =
  | "Verified"
  | "Pending"
  | "Unverified";

export interface EducationItem {
  readonly id: number;

  readonly status: EducationStatus;

  school_name: string;

  course_name?: string | null;

  start_date?: string | null;

  end_date?: string | null;
}

export interface CertificationItem {
  id: number;

  certificate_name: string;

  issuing_organization: string;

  issue_date?: string | null;

  credential_url?: string | null;
}

export interface ResumeFile {
  file_url: string;

  file_name?: string | null;
}

export interface SocialLink {
  id?: number;
  platform?: string;
  platform_name?: string;
  profile_url?: string;
  url?: string;
}

export interface ScreeningAnswer {
  question_id: number;
  question_text: string;
  answer_text: string;
}

export interface CandidateDetail {
  application_id: number;

  job_id: number;

  user_id: number;

  application_status: ApplicationStatus;
  current_stage_id?: number | null;
  stage_name?: string;
  stage_type?: CanonicalStageType;
  stage_color?: string;
  allowed_next_stages?: ApplicantStageOption[];
  stage_readiness?: {
    blocking: boolean;
    missing: string[];
    code: string | null;
  } | null;
  active_interview_id?: number | null;

  applicant_name: string;

  applicant_email: string;

  applicant_phone?: string | null;

  profile_image?: string | null;

  job_title: string;

  profile_headline?: string | null;

  professional_summary?: string | null;

  location?: string | null;

  cover_letter?: string | null;

  portfolio_url?: string | null;

  expected_salary?: number | null;

  screening_answers?: ScreeningAnswer[] | null;

  client_notes?: string | null;

  applied_at?: string;

  status_updated_at?: string | null;

  skills: string[];

  experience_years: number;

  work_experience_count: number;

  resume_count: number;

  profile_completion: number;

  resumes: ResumeFile[];

  work_experience: WorkExperienceItem[];

  education: EducationItem[];

  certifications: CertificationItem[];

  social_links: SocialLink[];

  // Referral Metadata
  is_referred?: boolean;
  referral_type?: 'SCHOOL_ADMIN' | 'FREELANCER';
  referrer_name?: string | null;
  referral_school_name?: string | null;
  referral_letter?: string | null;
}

export const STATUS_LABELS: Record<
  ApplicationStatus,
  string
> = {
  APPLIED: "Applied",
  UNDER_REVIEW: "Under Review",
  SHORTLISTED: "Shortlisted",
  INTERVIEWING: "Interviewing",
  HIRED: "Hired",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

// LEGACY FALLBACK ONLY: Used only for displaying legacy unmigrated applicant records without active pipeline snapshots.
export const STATUS_FLOW: ApplicationStatus[] = [
  "APPLIED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "INTERVIEWING",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
];

// LEGACY FALLBACK ONLY: Active workflow transitions are strictly governed by active job pipeline snapshots (vs_job_pipeline_transitions).
export const ALLOWED_STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLIED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["SHORTLISTED", "REJECTED"],
  SHORTLISTED: ["REJECTED"],
  INTERVIEWING: ["REJECTED"],
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
};
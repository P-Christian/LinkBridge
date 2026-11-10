// src/modules/freelancer/freelancer-applications/types/index.ts

import type { AttemptStatus } from "@/modules/shared/assessment";

export type ApplicationStatus =
  | 'DRAFT'
  | 'APPLIED'
  | 'UNDER_REVIEW'
  | 'SHORTLISTED'
  | 'INTERVIEWING'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';

/**
 * Compact assessment state exposed on each freelancer application row:
 * `available` requires an ASSESSMENT current stage with frozen tasks,
 * `status` mirrors the latest attempt (null when no tasks), and
 * `needs_action` is true only for NOT_STARTED / IN_PROGRESS / NEEDS_REVISION.
 */
export interface ApplicationAssessmentInfo {
  available: boolean;
  status: AttemptStatus | null;
  needs_action: boolean;
  deadline?: string | null;
}

export interface CompanyProfile {
  company_id: number;
  company_code: string;
  company_name: string;
  company_legal_name: string;
  company_email?: string | null;
  company_contact?: string | null;
  company_website?: string | null;
  company_description?: string | null;
  company_mission?: string | null;
  company_vision?: string | null;
  company_culture?: string | null;
  company_benefits?: string | null;
  industry_id?: number | null;
  organization_type_id?: number | null;
  company_size_id?: number | null;
  year_established?: number | null;
  company_province: string;
  company_city: string;
  company_brgy?: string | null;
  company_address?: string | null;
  company_zipCode?: string | null;
  registration_no?: string | null;
  company_tin?: string | null;
  company_logo?: string | null;
  company_cover?: string | null;
  company_facebook?: string | null;
  company_linkedin?: string | null;
  company_instagram?: string | null;
  company_x?: string | null;
  company_youtube?: string | null;
  company_tags?: string | null;
  is_public: boolean;
  is_active: boolean;
}

export interface ApplicationItem {
  application_id: number;
  job_id: number;
  user_id: number;
  job_title?: string;
  job_description?: string | null;
  company_id?: number | null;
  company_name?: string;
  company_details?: CompanyProfile | null;
  job_type?: string;
  job_location?: string;
  work_arrangement?: string;
  experience_level?: string | null;
  application_status: ApplicationStatus;
  cover_letter?: string | null;
  expected_salary?: number | null;
  portfolio_url?: string | null;
  applied_at?: string;
  status_updated_at?: string;
  resume?: {
    file_name: string;
    file_url: string;
  };
  is_referred?: boolean;
  referral_letter?: string | null;
  school_name?: string | null;
  referrer_name?: string | null;
  // Populated client-side from the per-application assessment endpoint.
  assessment?: ApplicationAssessmentInfo | null;
  // ATS Pipeline dynamic stage fields
  current_stage_id?: number | null;
  current_stage?: {
    id: number;
    stage_name: string;
    stage_type: string;
    stage_order: number;
    color: string;
    description?: string | null;
    is_terminal: boolean;
  } | null;
  pipeline_stages?: Array<{
    id: number;
    stage_name: string;
    stage_type: string;
    stage_order: number;
    color: string;
    description?: string | null;
    is_terminal: boolean;
  }>;
  stage_history?: Array<{
    id: number;
    from_stage_id?: number | null;
    to_stage_id: number;
    created_at?: string;
  }>;
  screening_answers?: ApplicationScreeningAnswer[] | null;
  profile_snapshot?: ApplicationProfileSnapshot | null;
}

export interface ApplicationScreeningAnswer {
  question_id: number;
  question_text: string;
  answer_text: string;
}

export interface ApplicationProfileSnapshot {
  professional_summary?: string;
  skills?: Array<{
    skill?: {
      skill_name?: string;
    };
    skill_name?: string;
  }>;
  work_experience?: Array<{
    job_title: string;
    company_name: string;
    start_date?: string;
    end_date?: string;
    is_current_role?: boolean;
    description?: string;
  }>;
  education?: Array<{
    school_name: string;
    degree?: string;
    field_of_study?: string;
    start_date?: string;
    end_date?: string;
  }>;
  user_fname?: string;
  user_lname?: string;
  user_email?: string;
  user_contact?: string;
  user_city?: string;
  user_province?: string;
}

export interface ApplicationSummary {
  totalApplied: number;
  pendingApplications: number;
  activeOffers: number;
  successRate: number;
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  APPLIED: 'Applied',
  UNDER_REVIEW: 'Under Review',
  SHORTLISTED: 'Shortlisted',
  INTERVIEWING: 'Interviewing',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

export interface BookmarkedJob {
  bookmark_id: number;
  job_id: number;
  user_id: number;
  job_title?: string;
  company_name?: string;
  company_logo?: string | null;
  job_type?: string;
  job_location?: string;
  work_arrangement?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string;
  salary_negotiable?: boolean;
  bookmarked_at?: string;
  is_referred?: boolean;
  referrer_name?: string | null;
  school_name?: string | null;
  referral_expires_at?: string | null;
}

export type JobType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';
export type WorkArrangement = 'Remote' | 'Hybrid' | 'On-site';
export type ExperienceLevel = 'ENTRY' | 'MID' | 'SENIOR' | 'MANAGER' | 'EXECUTIVE';
export type SalaryType = 'Salary Range' | 'Fixed Salary' | 'Hourly Rate';

export interface JobScreeningQuestion {
  question_id: number;
  question_text: string;
}

export interface PublicJobPosting {
  job_id: number;
  company_id: number;
  company_name?: string | null;
  company_logo?: string | null;
  company_cover?: string | null;
  company_email?: string | null;
  company_contact?: string | null;
  company_address?: string | null;
  company_city?: string | null;
  company_province?: string | null;
  company_facebook?: string | null;
  company_linkedin?: string | null;
  company_instagram?: string | null;
  company_x?: string | null;
  company_youtube?: string | null;
  job_title: string;
  job_category: string;
  job_type: JobType;
  work_arrangement: WorkArrangement;
  job_location: string;
  job_department?: string | null;
  number_of_openings: number;
  job_description: string;
  job_responsibilities?: string | null;
  job_qualifications: string;
  salary_type: SalaryType;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_negotiable: boolean;
  currency: string;
  experience_level?: ExperienceLevel | null;
  education?: string | null;
  status: 'ACTIVE';
  created_at?: string;
  skills?: { id: number; skill_name: string }[];
  benefits?: string[];
  screening_questions?: (JobScreeningQuestion | string)[];
}

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  FULL_TIME: 'Full-Time',
  PART_TIME: 'Part-Time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  FREELANCE: 'Freelance',
};

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  ENTRY: 'Entry Level',
  MID: 'Mid Level',
  SENIOR: 'Senior Level',
  MANAGER: 'Manager / Lead',
  EXECUTIVE: 'Executive / Director',
};

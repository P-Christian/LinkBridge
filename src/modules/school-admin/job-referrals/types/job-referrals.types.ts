// src/modules/school-admin/job-referrals/types/job-referrals.types.ts

export type JobType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';
export type WorkArrangement = 'Remote' | 'Hybrid' | 'On-site';
export type ExperienceLevel = 'ENTRY' | 'MID' | 'SENIOR' | 'MANAGER' | 'EXECUTIVE';
export type JobPostingStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';
export type ReferralStatus =
  | 'CREATED'
  | 'SENT'
  | 'OPENED'
  | 'CLAIMED'
  | 'APPLIED'
  | 'DECLINED'
  | 'REVOKED'
  | 'EXPIRED'
  | 'INVALIDATED';

export interface VsJobPosting {
  job_id: number;
  company_id: number;
  created_by_user_id: number;
  job_title: string;
  job_category: string;
  category_id?: number | null;
  job_type: JobType;
  work_arrangement: WorkArrangement;
  job_location: string;
  job_department?: string | null;
  number_of_openings: number;
  job_description: string;
  job_responsibilities?: string | null;
  job_qualifications: string;
  salary_type?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_negotiable?: boolean | number;
  currency: string;
  experience_level?: ExperienceLevel | null;
  education?: string | null;
  status: JobPostingStatus;
  created_at: string;
  updated_at?: string;
  company_name?: string;
  company_logo?: string;
}

export interface StudentSkillItem {
  id: number;
  skill_id: number;
  skill_name: string;
}

export interface StudentWorkExperienceItem {
  id: number;
  company_name: string;
  job_title: string;
  employment_type?: string;
  start_date: string;
  end_date?: string | null;
  is_current_role?: boolean;
  job_description?: string;
}

export interface StudentJobPreferencesItem {
  job_type?: string;
  work_setup?: string;
  preferred_location?: string;
  salary_range_min?: number;
  salary_range_max?: number;
  preferred_industry?: string;
}

export interface VerifiedStudentCandidate {
  student_id: number;
  school_id: number;
  student_number: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  school_course_id: number | null;
  course_name?: string;
  school_year: string;
  gpa: number | null;
  invitation_status: string;
  registered_user_id: number;
  // Freelancer profile details
  profile_image_url?: string | null;
  user_position?: string | null;
  profile_headline?: string | null;
  professional_summary?: string | null;
  skills: string[];
  work_experiences: StudentWorkExperienceItem[];
  job_preferences?: StudentJobPreferencesItem | null;
  applied_job_ids?: number[];
}

export interface VsJobReferral {
  referral_id: number;
  job_id: number;
  referrer_user_id: number;
  token_hash: string;
  recipient_email_hash?: string | null;
  display_hint?: string | null;
  status: ReferralStatus;
  expires_at: string;
  created_at: string;
  updated_at?: string | null;
  student_id?: number | null;
  school_id?: number | null;
  email_status?: "SENT" | "FAILED" | null;
  email_sent_at?: string | null;
  referral_letter?: string | null;
  // Joined fields for display
  job_title?: string;
  company_name?: string;
  referral_url?: string;
  recipient_name?: string;
  claimants?: ReferralClaimant[];
  claim_count?: number;
}

export interface VsJobReferralHistory {
  history_id: number;
  referral_id: number;
  from_status: string;
  to_status: string;
  actor: string;
  reason_category?: string | null;
  occurred_at: string;
}

export type LetterTone = 'professional' | 'academic' | 'enthusiastic' | 'concise';

export interface GenerateLetterRequest {
  job: {
    job_id: number;
    job_title: string;
    company_name?: string;
    job_description: string;
    job_qualifications: string;
    job_type?: string;
    work_arrangement?: string;
  };
  students: {
    student_id: number;
    registered_user_id: number;
    full_name: string;
    email: string;
    course_name?: string;
    gpa?: number | null;
    headline?: string;
    summary?: string;
    skills: string[];
    work_experiences: {
      job_title: string;
      company_name: string;
      description?: string;
    }[];
  }[];
  tone?: LetterTone;
  schoolName?: string;
  adminName?: string;
}

export interface GenerateLetterResponse {
  letter: string;
  mode: 'tailored' | 'unified';
  studentCount: number;
  suggestedSubject: string;
}

export interface CreateReferralsPayload {
  job_id: number;
  student_ids: number[];
  referral_letter?: string;
  expires_in_days?: number;
}

export interface CreatedReferralResult {
  referral_id: number;
  student_id: number;
  student_name: string;
  email: string;
  token: string;
  referral_url: string;
  status: ReferralStatus;
  email_sent: boolean;
}

export interface BlockedStudent {
  student_id: number;
  name: string;
  reason: "ALREADY_REFERRED" | "ALREADY_APPLIED";
}

export interface CreatedShareLinkResult {
  referral_id: number;
  token: string;
  referral_url: string;
  status: ReferralStatus;
  expires_at: string;
  reused: boolean;
}

export interface ReferralClaimant {
  name: string;
  email: string;
  consented_at: string;
  claim_status: string;
  applied: boolean;
}

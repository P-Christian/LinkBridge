// src/modules/client/jobs/types.tsx

export type JobStatus = "ACTIVE" | "DRAFT" | "CLOSED";
export type ExperienceLevel = "ENTRY" | "MID" | "SENIOR" | "MANAGER" | "EXECUTIVE";
export type JobType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP" | "FREELANCE";
export type WorkArrangement = 'Remote' | 'Hybrid' | 'On-site';
export type JobSkill = {
  id: number;
  skill_name: string;
  source?: string;
  confidence_score?: number | null;
}
export type SalaryType = 'Salary Range' | 'Fixed Salary' | 'Hourly Rate';

export interface RoleCategory {
  category_id: number;
  category_code: string;
  category_name: string;
  description?: string | null;
  is_active?: boolean;
}

export interface JobPosting {
  job_id: number;
  company_id: number;
  job_title: string;
  job_description?: string | null;
  job_requirements?: string | null;
  job_type: JobType;
  job_location: string;
  job_department?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_negotiable?: boolean;
  experience_level?: ExperienceLevel | null;
  status: JobStatus;
  applicants_count?: number;
  active_applicants_count?: number;
  created_at?: string;
  updated_at?: string;
  category_id?: number | null;
  job_category?: string;
  work_arrangement?: string;
  number_of_openings?: string;
  job_responsibilities?: string;
  job_qualifications?: string;
  skills?: { id: number; skill_name: string; source?: string; confidence_score?: number | null }[];
  salary_type?: string;
  currency?: string;
  benefits?: string[];
  education?: string;
  screening_questions?: string[];
}

export interface CompanyInfo {
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
}

export interface PublicJobPosting {
  job_id: number;
  company_id: number;

  company?: CompanyInfo | null;

  // fallback fields if API still returns flattened data
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
  category_id?: number | null;
  job_category: string;
  job_type: JobType;
  work_arrangement: WorkArrangement;
  job_location: string;

  job_department?: string | null;

  number_of_openings: string;

  job_description: string;
  job_requirements?: string | null;

  job_responsibilities?: string | null;

  job_qualifications: string;

  salary_type: SalaryType;

  salary_min?: number | null;
  salary_max?: number | null;

  salary_negotiable: boolean;

  currency: string;

  experience_level?: ExperienceLevel | null;

  education?: string | null;

  status: JobStatus;

  created_at?: string;

  applicants_count?: number;

  active_applicants_count?: number;

  skills?: {
    id:number;
    skill_name:string;
  }[];

  benefits?: string[];

  screening_questions?: string[];
}
export interface JobFormData {
  job_id?: number | null;
  job_title: string;
  job_description: string;
  job_requirements: string;
  job_type: JobType | "";
  job_location: string;
  job_department: string;
  salary_min: string;
  salary_max: string;
  salary_negotiable: boolean;
  experience_level: ExperienceLevel | "";
  status: JobStatus;
  category_id?: number | null;
  job_category?: string;
  work_arrangement?: string;
  number_of_openings?: string;
  job_responsibilities?: string;
  job_qualifications?: string;
  skills?: { id: number; skill_name: string; source?: string; confidence_score?: number | null }[];
  salary_type?: string;
  currency?: string;
  benefits?: string[];
  education?: string;
  screening_questions?: string[];
  is_new_category_suggested?: boolean;
  category_suggestion_rationale?: string;
  suggested_category_name?: string;
  source_pipeline_id?: number | null;
}

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  FULL_TIME: "Full-Time",
  PART_TIME: "Part-Time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  FREELANCE: "Freelance",
};

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  ENTRY: "Entry Level",
  MID: "Mid Level",
  SENIOR: "Senior Level",
  MANAGER: "Manager / Lead",
  EXECUTIVE: "Executive / Director",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  ACTIVE: "Active",
  DRAFT: "Draft",
  CLOSED: "Closed",
};


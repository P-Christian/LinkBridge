// src/modules/public/find-jobs/types.ts

export interface PublicJobPosting {
  job_id: number;
  company_id: number;
  company_code?: string | null;
  company_name: string;
  company_logo_url?: string | null;
  company_location?: string;
  company_verification_status?: string;

  job_title: string;
  job_description: string;
  job_type: string; // Full-Time, Part-Time, Contract, Freelance, Internship
  work_setup: string; // Remote, On-site, Hybrid
  location: string;

  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string;
  show_salary_range?: boolean;

  experience_level?: string;
  created_at: string;
}

export interface PublicJobFilters {
  q: string;
  job_type: string;
  work_setup: string;
  location: string;
  industry_id: string;
  sort: string;
}

export interface CategoryPill {
  id: string;
  name: string;
  iconName: string;
  jobCount?: number;
}

export interface PopularPreset {
  label: string;
  type: "work_setup" | "job_type" | "keyword";
  count: number;
}

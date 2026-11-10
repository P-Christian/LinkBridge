// src/modules/freelancer/freelancer-bookmarks/types/index.ts

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

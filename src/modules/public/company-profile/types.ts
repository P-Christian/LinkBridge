export interface TrustedCompany {
  companyId: number;
  companyCode: string;
  companyName: string;
  companyLogo: string | null;
  industryName: string | null;
  activeJobs: number;
  verified: boolean;
}

export interface PublicCompanyProfile {
  company_id: number;
  company_code: string;
  company_name: string;
  company_legal_name: string;
  industry_name: string | null;
  company_size_name: string | null;
  year_established: number | null;
  company_logo: string | null;
  company_cover: string | null;
  company_description: string | null;
  company_mission: string | null;
  company_vision: string | null;
  company_culture: string | null;
  company_benefits: string | null;
  company_tags: string | null;
  company_website: string | null;
  company_facebook: string | null;
  company_linkedin: string | null;
  company_instagram: string | null;
  company_x: string | null;
  company_youtube: string | null;
  company_contact: string | null;
  company_email: string | null;
  company_address: string | null;
  verification_status: string;
  is_public: boolean;
  is_active: boolean;
  activeJobsCount: number;
}

export interface CompanyJob {
  id: number;
  title: string;
  category: string;
  type: string;
  work_arrangement: string;
  location: string;
  department: string | null;
  salary: string;
  posted: string;
  tags: string[];
  description?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string;
  experience_level?: string;
  created_at?: string;
}

export interface CompanyJobFilters {
  search?: string;
  job_type?: string;
  work_arrangement?: string;
  experience_level?: string;
}

export interface BrowseCompanyFilters {
  search?: string;
  industry?: string;
  size?: string;
  location?: string;
  activeJobsOnly?: boolean;
}

export interface PaginatedCompanyJobs {
  jobs: CompanyJob[];
  total: number;
}

export interface PaginatedBrowseCompanies {
  companies: PublicCompanyProfile[];
  total: number;
}

export interface CompanyProfileFeatures {
  galleryEnabled: boolean;
  salariesEnabled: boolean;
  reviewsEnabled: boolean;
  followEnabled: boolean;
}

export interface CompanyReview {
  review_id: number;
  /** Null for anonymous submissions so the reviewer cannot be de-anonymised. */
  reviewer_user_id: number | null;
  employment_status: "CURRENT_EMPLOYEE" | "FORMER_EMPLOYEE";
  job_title: string | null;
  overall_rating: number;
  work_life_balance_rating: number | null;
  compensation_rating: number | null;
  management_rating: number | null;
  career_growth_rating: number | null;
  review_title: string | null;
  pros: string | null;
  cons: string | null;
  review_text: string;
  is_anonymous: boolean;
  created_at: string;
}

export interface CompanyReviewReport {
  report_id: number;
  review_id: number;
  reporter_user_id: number;
  reason_code: "SPAM" | "FALSE_INFORMATION" | "HARASSMENT" | "HATE_SPEECH" | "PERSONAL_INFORMATION" | "CONFIDENTIAL_INFORMATION" | "OFF_TOPIC" | "DUPLICATE" | "FRAUDULENT_CONTENT" | "OTHER";
  report_details: string | null;
  status: "PENDING" | "UNDER_REVIEW" | "DISMISSED" | "ACTIONED";
  reviewed_by_user_id: number | null;
  reviewed_at: string | null;
  resolution_action: "NO_ACTION" | "KEEP_PUBLISHED" | "HIDE_REVIEW" | "REMOVE_REVIEW" | null;
  resolution_reason: string | null;
  created_at: string;
  updated_at: string;
}

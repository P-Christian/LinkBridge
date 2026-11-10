// src/modules/client/company-profile/types.tsx

export type VerificationStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "CORRECTION_REQUIRED"
  | "VERIFIED"
  | "REJECTED"
  | "INACTIVE"
  | "SUSPENDED";

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
  industry_id?: number | string | null;
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
  verification_status: VerificationStatus;
  verification_workflow_status?: string | null;
  rejection_reason?: string | null;
  public_rejection_reason?: string | null;
  verification_remarks?: string | null;
  profile_completion_percent?: number;
  is_public: number | boolean;
  is_active?: number;
  is_deleted?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyProfileMeta {
  company_user_role: "OWNER" | "ADMIN" | "MEMBER";
  is_primary_contact: number;
}

export interface CompanyProfileState {
  company: CompanyProfile | null;
  meta: CompanyProfileMeta | null;
  loading: boolean;
  saving: boolean;
  error: string;
  successMessage: string;
}

export type EditableCompanyFields = Pick<
  CompanyProfile,
  | "company_name"
  | "company_legal_name"
  | "company_email"
  | "company_contact"
  | "company_website"
  | "company_description"
  | "company_mission"
  | "company_vision"
  | "company_culture"
  | "company_benefits"
  | "industry_id"
  | "organization_type_id"
  | "company_size_id"
  | "year_established"
  | "company_province"
  | "company_city"
  | "company_brgy"
  | "company_address"
  | "company_zipCode"
  | "registration_no"
  | "company_tin"
  | "company_logo"
  | "company_cover"
  | "company_facebook"
  | "company_linkedin"
  | "company_instagram"
  | "company_x"
  | "company_youtube"
  | "company_tags"
  | "is_public"
>;

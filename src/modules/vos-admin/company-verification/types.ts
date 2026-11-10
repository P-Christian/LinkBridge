export type VerificationStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED"
  | "INACTIVE"
  | "SUSPENDED"
  | "CORRECTION_REQUIRED";

export interface CompanyDocument {
  company_document_id: number;
  company_id: number;
  document_type: string;
  document_name: string;
  directus_file_id: string;
  uploaded_by_user_id?: number | null;
  uploaded_at: string;
}

export interface CompanyUser {
  company_user_id: number;
  company_id: number;
  user_id: number;
  company_user_role: string;
  is_primary_contact: boolean | number;
  status: string;
  user_email?: string;
  user_fname?: string;
  user_lname?: string;
  user_contact?: string;
  user_position?: string;
  identity_verification?: {
    id: number;
    gov_id_type?: string | null;
    gov_id_front_image_uuid?: string | null;
    gov_id_back_image_uuid?: string | null;
    gov_id_front_url?: string | null;
    gov_id_back_url?: string | null;
    status?: string | null;
    submitted_at?: string | null;
  } | null;
}

export interface CompanyVerificationAttempt {
  id: number;
  company_id: number;
  submitted_by_user_id?: number | null;
  verification_type: string;
  status: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
  public_rejection_reason?: string | null;
  internal_notes?: string | null;
  created_at: string;
  updated_at: string;
  reviewer_name?: string | null;
  submitter_name?: string | null;
}

export interface CompanyVerificationRecord {
  company_id: number;
  company_name: string;
  company_legal_name: string;
  company_code: string;
  registration_no?: string | null;
  company_tin?: string | null;
  company_email: string;
  company_contact: string;
  company_address?: string | null;
  company_city?: string | null;
  company_province?: string | null;
  company_brgy?: string | null;
  company_zipCode?: string | null;
  company_website?: string | null;
  company_logo?: string | null;
  company_cover?: string | null;
  company_description?: string | null;
  year_established?: number | string | null;
  industry_id?: number | null;
  company_size_id?: number | null;
  organization_type_id?: number | null;
  industry_name?: string | null;
  company_size_name?: string | null;
  organization_type_name?: string | null;
  company_tags?: string | null;
  company_facebook?: string | null;
  company_linkedin?: string | null;
  company_instagram?: string | null;
  company_x?: string | null;
  company_youtube?: string | null;
  verification_status: VerificationStatus;
  rejection_reason?: string | null;
  internal_notes?: string | null;
  profile_completion_percent: number;
  is_public: boolean | number;
  is_active: boolean | number;
  submitted_at?: string | null;
  verified_at?: string | null;
  verified_by_user_id?: number | null;
  created_at: string;
  updated_at: string;
  documents?: CompanyDocument[];
  users?: CompanyUser[];
  verifications?: CompanyVerificationAttempt[];
  latest_verification?: CompanyVerificationAttempt | null;
}

export interface CompanyVerificationFilters {
  status: string;
  search: string;
  industry: string;
}

export interface CompanyVerificationKPIs {
  totalCount: number;
  pendingCount: number;
  verifiedCount: number;
  rejectedCount: number;
  needsRevisionCount: number;
  draftCount: number;
}

export interface VerificationDecisionPayload {
  companyId: number;
  action: "approve" | "request_revision" | "suspend";
  rejectionReason?: string;
  internalNotes?: string;
}

// src/modules/vos-admin/user-management/types/user.types.ts

export interface VsUser {
  user_id: number;
  user_email: string;
  user_fname: string;
  user_mname?: string | null;
  user_lname: string;
  suffix_name?: string | null;
  nickname?: string | null;
  user_contact: string;
  role: string;
  role_id: number | null;
  is_blocked: boolean | number;
  user_province?: string | null;
  user_city?: string | null;
  user_brgy?: string | null;
  user_image?: string | null;
  profile_image_url?: string | null;
  isAdmin: boolean | number;
  verifications?: IdentityVerification[];
  vs_job_seeker_profile?: {
    profile_id?: number;
    profile_headline?: string | null;
    professional_summary?: string | null;
    profile_visibility?: string | null;
    expected_salary?: number | string | null;
    profile_completion_percent?: number | string | null;
    profile_status?: string | null;
  } | {
    profile_id?: number;
    profile_headline?: string | null;
    professional_summary?: string | null;
    profile_visibility?: string | null;
    expected_salary?: number | string | null;
    profile_completion_percent?: number | string | null;
    profile_status?: string | null;
  }[] | null;
  job_seeker_profile?: {
    profile_id?: number;
    profile_headline?: string | null;
    professional_summary?: string | null;
    profile_visibility?: string | null;
    expected_salary?: number | string | null;
    profile_completion_percent?: number | string | null;
    profile_status?: string | null;
  } | {
    profile_id?: number;
    profile_headline?: string | null;
    professional_summary?: string | null;
    profile_visibility?: string | null;
    expected_salary?: number | string | null;
    profile_completion_percent?: number | string | null;
    profile_status?: string | null;
  }[] | null;
  vs_job_preferences?: {
    id?: number;
    job_type?: string | null;
    work_setup?: string | null;
    preferred_location?: string | null;
    salary_range_min?: number | string | null;
    salary_range_max?: number | string | null;
    currency?: string | null;
    availability?: string | null;
    preferred_industry?: string | null;
  } | {
    id?: number;
    job_type?: string | null;
    work_setup?: string | null;
    preferred_location?: string | null;
    salary_range_min?: number | string | null;
    salary_range_max?: number | string | null;
    currency?: string | null;
    availability?: string | null;
    preferred_industry?: string | null;
  }[] | null;
  job_preferences?: {
    id?: number;
    job_type?: string | null;
    work_setup?: string | null;
    preferred_location?: string | null;
    salary_range_min?: number | string | null;
    salary_range_max?: number | string | null;
    currency?: string | null;
    availability?: string | null;
    preferred_industry?: string | null;
  } | {
    id?: number;
    job_type?: string | null;
    work_setup?: string | null;
    preferred_location?: string | null;
    salary_range_min?: number | string | null;
    salary_range_max?: number | string | null;
    currency?: string | null;
    availability?: string | null;
    preferred_industry?: string | null;
  }[] | null;
}

export interface IdentityVerification {
  id: number;
  user_id: number;
  type: 'gov_id' | 'address' | 'mobile_number';
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
  rejection_note?: string | null;
  gov_id_type?: string | null;
  gov_id_front_image_uuid?: string | null;
  gov_id_selfie_image_uuid?: string | null;
  address_doc_image_uuid?: string | null;
  mobile_number?: string | null;
  mobile_verified?: boolean | number;
}

export interface UserManagementKPIs {
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  notSubmittedCount: number;
}

export interface UserWithVerification extends VsUser {
  verifications: IdentityVerification[];
}

export interface ReviewVerificationAction {
  status: 'approved' | 'rejected';
  rejection_note?: string;
}


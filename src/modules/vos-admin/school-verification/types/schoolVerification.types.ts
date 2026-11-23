// src/modules/vos-admin/school-verification/types/schoolVerification.types.ts

export type VerificationStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED"
  | "INACTIVE"
  | "SUSPENDED"
  | "CORRECTION_REQUIRED";

export interface SchoolDocument {
  school_document_id: number;
  school_id: number;
  document_type: string;
  document_name: string;
  directus_file_id: string;
  uploaded_by_user_id?: number | null;
  uploaded_at: string;
  file_url?: string | null;
}

export interface SchoolAdminUser {
  school_admin_id: number;
  school_id: number;
  user_id: number;
  is_active: boolean | number;
  user_email?: string;
  user_fname?: string;
  user_lname?: string;
  user_contact?: string;
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

export interface SchoolVerificationAttempt {
  id: number;
  school_id: number;
  submitted_by_user_id?: number | null;
  verification_type: string;
  status: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
  public_rejection_reason?: string | null;
  internal_notes?: string | null;
  created_at: string;
  updated_at?: string | null;
  reviewer_name?: string | null;
  submitter_name?: string | null;
}

export interface SchoolCourse {
  school_course_id: number;
  school_id: number;
  course_name: string;
  course_code?: string | null;
  degree_level?: string | null;
  department?: string | null;
  description?: string | null;
  course_status: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SchoolVerificationRecord {
  school_id: number;
  school_name: string;
  school_type: string;
  school_logo_url?: string | null;
  school_cover?: string | null;
  school_description?: string | null;
  school_mission?: string | null;
  school_values?: string | null;
  school_email?: string | null;
  school_contact_no?: string | null;
  school_website?: string | null;
  school_facebook?: string | null;
  school_linkedin?: string | null;
  address_line?: string | null;
  barangay?: string | null;
  city_municipality: string;
  province: string;
  postal_code?: string | null;
  country: string;
  school_status: string;
  verification_status: VerificationStatus;
  rejection_reason?: string | null;
  internal_notes?: string | null;
  profile_completion_percent: number;
  is_public: boolean | number;
  is_active: boolean | number;
  submitted_at?: string | null;
  verified_at?: string | null;
  verified_by_user_id?: number | null;
  verified_by_user_name?: string | null;
  created_at: string;
  updated_at?: string | null;
  documents?: SchoolDocument[];
  admins?: SchoolAdminUser[];
  courses?: SchoolCourse[];
  verifications?: SchoolVerificationAttempt[];
  latest_verification?: SchoolVerificationAttempt | null;
}

export interface SchoolVerificationFilterState {
  status: string;
  search: string;
  schoolType: string;
}

export interface SchoolVerificationKPIs {
  totalCount: number;
  draftCount: number;
  pendingCount: number;
  correctionCount: number;
  verifiedCount: number;
  inactiveCount: number;
}

export interface VerificationDecisionPayload {
  schoolId: number;
  action: "approve" | "request_correction" | "suspend";
  rejectionReason?: string;
  internalNotes?: string;
}

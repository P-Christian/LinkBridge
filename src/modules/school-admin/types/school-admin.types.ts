export type SchoolStatus = 'Active' | 'Inactive' | 'Draft' | 'Pending';
export type SchoolType = 'University' | 'College' | 'Technical/Vocational' | 'Other';
export type VerificationStatus =
  | 'DRAFT'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'REJECTED'
  | 'INACTIVE'
  | 'SUSPENDED';

export interface VsSchoolAdmin {
  school_admin_id: number;
  school_id: number;
  user_id: number;
  is_active: boolean;
  assigned_by: number | null;
  created_at: string;
}

export interface VsSchool {
  school_id: number;
  school_name: string;
  school_type: SchoolType;
  school_logo_url: string | null;
  school_cover: string | null;
  school_description: string | null;
  school_mission: string | null;
  school_values: string | null;
  school_email: string | null;
  school_contact_no: string | null;
  school_website: string | null;
  school_facebook: string | null;
  school_linkedin: string | null;
  address_line: string | null;
  barangay: string | null;
  city_municipality: string;
  province: string;
  postal_code: string | null;
  country: string;
  school_status: SchoolStatus | string;
  verification_status: VerificationStatus;
  profile_completion_percent: number;
  is_public: number | boolean;
  is_active: number | boolean;
  created_by: number;
  created_at: string;
  updated_by: number | null;
  updated_at: string | null;
  verified_by_user_id: number | null;
  verified_at: string | null;
}

export interface SchoolWithStats extends VsSchool {
  course_count: number;
  student_count: number;
}


export type CourseDegree = 'Associate' | 'Bachelor' | 'Master' | 'Doctorate';
export type CourseStatus = 'Active' | 'Inactive';

export interface VsSchoolCourse {
  school_course_id: number;
  school_id: number;
  course_name: string;
  course_code: string | null;
  course_category?: string | null;
  degree?: CourseDegree | null;
  course_status: CourseStatus | SchoolStatus;
  created_by: number;
  created_at: string;
  updated_by: number | null;
  updated_at: string | null;
}

export interface PlatformCompanyValue {
  id?: number | string;
  company_id?: number;
  title: string;
  description: string;
  desc?: string;
  icon_name?: string;
  icon?: string;
  icon_url?: string | null;
  color?: string;
  display_order?: number;
  is_active?: boolean | number;
  created_at?: string;
  updated_at?: string;
}

export interface PlatformCompany {
  company_id: number;
  slug: string;
  company_code: string;
  company_name: string;
  company_legal_name: string;
  platform_name?: string | null;
  platform_icon?: string | null;
  support_hours_days?: string | null;
  support_hours_time?: string | null;
  support_hours_timezone?: string | null;
  values?: PlatformCompanyValue[];
  company_tagline?: string | null;
  year_established?: number | null;
  organization_type_id?: number | null;
  industry_id?: number | null;
  company_size_id?: number | null;
  company_address?: string | null;
  company_brgy?: string | null;
  company_city?: string | null;
  company_province?: string | null;
  company_country: string;
  company_zipCode?: string | null;
  map_embed_url?: string | null;
  registration_no?: string | null;
  company_tin?: string | null;
  company_contact: string;
  company_email: string;
  support_email?: string | null;
  company_website?: string | null;
  company_logo?: string | null;
  company_cover?: string | null;
  company_facebook?: string | null;
  company_linkedin?: string | null;
  company_instagram?: string | null;
  company_x?: string | null;
  company_youtube?: string | null;
  company_short_description?: string | null;
  company_description?: string | null;
  company_mission?: string | null;
  company_vision?: string | null;
  company_culture?: string | null;
  company_benefits?: string | null;
  company_tags?: string | null;
  metadata?: Record<string, unknown> | null;
  is_primary: number | boolean;
  is_active: number | boolean;
  display_order: number;
  created_by_user_id?: number | null;
  updated_by_user_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export type PlatformCompanyFormData = Omit<
  PlatformCompany,
  "company_id" | "created_at" | "updated_at" | "created_by_user_id" | "updated_by_user_id"
> & {
  company_id?: number;
};

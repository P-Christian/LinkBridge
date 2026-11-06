// src/modules/client/talent-search/services/talent-search.repo.ts

import { directusItems, directusItemsWhereIn } from "../../../../lib/server/directus";

/**
 * Every Directus read the talent search makes. No scoring, no shaping beyond the
 * column list — the callers get rows.
 */

/**
 * Row ceiling for every read here. The profile corpus and the taxonomy tables are
 * scanned whole — truncating them would silently change which candidates are
 * findable — so this sits far above current data volume and only exists to stop
 * an unbounded `limit=-1` read from exhausting memory.
 */
export const MAX_SCAN_ROWS = 10_000;

/**
 * Who may appear in a search at all. Re-applied when a cached ranking is
 * hydrated, so a candidate who went private after the ranking was written does
 * not surface on page 2.
 */
const VISIBLE_FILTER = "filter[profile_visibility][_in]=Public,Recruiters Only";

const PROFILE_FIELDS =
  "profile_id,user_id,profile_headline,professional_summary,profile_visibility,updated_at";

export interface TalentProfileRow {
  profile_id: number;
  user_id: number;
  profile_headline?: string;
  professional_summary?: string;
  /** Bumps on any write to the profile row; the coarse freshness probe. */
  updated_at?: string;
}

/** Rows attached to every candidate profile by the bulk reads below. */
export interface BulkUserRow {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_city?: string;
  user_province?: string;
  profile_image_url?: string;
}

export interface BulkSkillRow {
  user_id: number;
  skill_id?: { skill_name?: string };
}

export interface BulkWorkRow {
  user_id: number;
  company_name: string;
  job_title: string;
  job_description?: string;
  start_date?: string;
  end_date?: string;
  is_current_role?: boolean;
  employment_type?: string;
  location?: string;
}

export interface BulkCertRow {
  user_id: number;
  certificate_name: string;
  issuing_organization?: string;
}

export interface BulkSocialRow {
  user_id: number;
  platform_name: string;
  profile_url: string;
}

export interface BulkJobPreferenceRow {
  user_id: number;
  work_setup?: string | null;
  preferred_location?: string | null;
}

export interface TalentEducationBulkRow {
  user_id: number;
  employee_education_id?: number;
  education_status?: string;
  school_id?: { school_name?: string; school_id?: number };
  school_course_id?: { course_name?: string };
  start_date?: string;
  end_date?: string;
}

export interface JobPostingRow {
  job_id: number;
  job_title?: string;
  job_location?: string;
  experience_level?: string;
}

export interface JobSkillRow {
  skill_id?: { skill_name?: string };
}

export interface SavedApplicantRow {
  applicant_user_id: number;
}

export interface RoleSkillMappingRow {
  role_id: { role_id: number };
  skill_id: { id: number; skill_name: string };
  importance_weight: number;
  is_required: number;
}

export interface RoleTaxonomyAliasRow {
  alias_id: number;
  alias_name: string;
  normalized_alias: string;
  match_weight: number;
  role_id: {
    role_id: number;
    role_name: string;
    category_id?: {
      category_id: number;
      category_code: string;
      category_name: string;
    };
  };
}

/**
 * The posting, scoped to the caller's company. An id belonging to someone else
 * (or a deleted posting) comes back empty — which is what makes the job-keyed
 * reads below safe.
 */
export function readCompanyJobPosting(jobId: number, companyId: number): Promise<JobPostingRow[]> {
  return directusItems<JobPostingRow>("vs_job_posting", {
    query:
      `filter[job_id][_eq]=${jobId}&filter[company_id][_eq]=${companyId}` +
      `&fields=job_id,job_title,job_location,experience_level&limit=1`,
  });
}

/** Filtered by job id alone — only safe once the caller's ownership is proven. */
export function readJobSkillRows(jobId: number): Promise<JobSkillRow[]> {
  return directusItems<JobSkillRow>("vs_job_skills_map", {
    query: `filter[job_id][_eq]=${jobId}&fields=skill_id.skill_name&limit=${MAX_SCAN_ROWS}`,
  });
}

/** The whole searchable corpus. Taxonomy rows feed the matcher. */
export function scanSearchableProfiles(): Promise<TalentProfileRow[]> {
  return directusItems<TalentProfileRow>("vs_job_seeker_profile", {
    query: `${VISIBLE_FILTER}&fields=${PROFILE_FIELDS}&limit=${MAX_SCAN_ROWS}`,
  });
}

export function scanRoleAliasRows(): Promise<RoleTaxonomyAliasRow[]> {
  return directusItems<RoleTaxonomyAliasRow>("vs_role_title_alias", {
    query:
      `fields=alias_id,alias_name,normalized_alias,match_weight,` +
      `role_id.role_id,role_id.role_name,` +
      `role_id.category_id.category_id,role_id.category_id.category_code,role_id.category_id.category_name` +
      `&limit=${MAX_SCAN_ROWS}`,
  });
}

export function scanRoleSkillRows(): Promise<RoleSkillMappingRow[]> {
  return directusItems<RoleSkillMappingRow>("vs_role_skill_mapping", {
    query:
      `fields=role_id.role_id,skill_id.id,skill_id.skill_name,importance_weight,is_required` +
      `&limit=${MAX_SCAN_ROWS}`,
  });
}

/** One-row probe for the newest write in the table; empty when the table is. */
export function readMostRecentlyWrittenProfile(): Promise<TalentProfileRow[]> {
  return directusItems<TalentProfileRow>("vs_job_seeker_profile", {
    query: "fields=profile_id,updated_at&sort=-updated_at&limit=1",
  });
}

/**
 * One page of a cached ranking. Visibility is re-filtered here, so a candidate
 * who went private since the ranking was written cannot be hydrated.
 */
export function readProfilesByUserIds(userIds: number[]): Promise<TalentProfileRow[]> {
  return directusItemsWhereIn<TalentProfileRow>(
    "vs_job_seeker_profile",
    "user_id",
    userIds,
    "profile_id,user_id,profile_headline,professional_summary,profile_visibility",
    { extra: VISIBLE_FILTER }
  );
}

/** vs_user — name + location only. Contact details are not read for the whole
 * corpus; the drawer fetches them for one profile on demand. */
export function readUserRows(userIds: number[]): Promise<BulkUserRow[]> {
  return directusItemsWhereIn<BulkUserRow>(
    "vs_user",
    "user_id",
    userIds,
    "user_id,user_fname,user_lname,user_city,user_province,profile_image_url"
  );
}

export function readUserSkillRows(userIds: number[]): Promise<BulkSkillRow[]> {
  return directusItemsWhereIn<BulkSkillRow>(
    "vs_user_skills_map",
    "user_id",
    userIds,
    "user_id,skill_id.skill_name"
  );
}

export function readWorkRows(userIds: number[]): Promise<BulkWorkRow[]> {
  return directusItemsWhereIn<BulkWorkRow>(
    "vs_work_experience",
    "user_id",
    userIds,
    "user_id,company_name,job_title,job_description,start_date,end_date,is_current_role,employment_type,location"
  );
}

export function readEducationRows(userIds: number[]): Promise<TalentEducationBulkRow[]> {
  return directusItemsWhereIn<TalentEducationBulkRow>(
    "vs_employee_education",
    "user_id",
    userIds,
    "user_id,employee_education_id,education_status,school_id.school_name,school_id.school_id,school_course_id.course_name,start_date,end_date"
  );
}

export function readCertificationRows(userIds: number[]): Promise<BulkCertRow[]> {
  return directusItemsWhereIn<BulkCertRow>(
    "vs_certifications",
    "user_id",
    userIds,
    "user_id,certificate_name,issuing_organization"
  );
}

export function readSocialLinkRows(userIds: number[]): Promise<BulkSocialRow[]> {
  return directusItemsWhereIn<BulkSocialRow>(
    "vs_user_social_links",
    "user_id",
    userIds,
    "user_id,platform_name,profile_url"
  );
}

export function readJobPreferenceRows(userIds: number[]): Promise<BulkJobPreferenceRow[]> {
  return directusItemsWhereIn<BulkJobPreferenceRow>(
    "vs_job_preferences",
    "user_id",
    userIds,
    "user_id,work_setup,preferred_location"
  );
}

/** Which applicants this company has saved — drives the `is_saved` flag only. */
export function readSavedApplicantRows(companyId: number | null): Promise<SavedApplicantRow[]> {
  if (!companyId) return Promise.resolve([]);
  return directusItems<SavedApplicantRow>("vs_saved_applicant", {
    query: `filter[company_id][_eq]=${companyId}&fields=applicant_user_id&limit=${MAX_SCAN_ROWS}`,
  });
}

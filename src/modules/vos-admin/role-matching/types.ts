// src/modules/vos-admin/role-matching/types.ts

export type ExperienceLevel = "ENTRY" | "JUNIOR" | "MID" | "SENIOR" | "LEAD" | "EXECUTIVE";

export interface JobCategory {
  category_id: number;
  category_code: string;
  category_name: string;
  description: string | null;
  is_active: boolean;
  role_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface StandardRole {
  role_id: number;
  category_id: number;
  category_code?: string;
  category_name?: string;
  role_name: string;
  experience_level: ExperienceLevel;
  is_active: boolean;
  alias_count?: number;
  skill_count?: number;
  created_at?: string;
  updated_at?: string;
}

export type AliasType = "EXACT" | "SYNONYM" | "KEYWORD" | "ABBREVIATION";

export interface SearchKeyword {
  alias_id: number;
  role_id: number;
  role_name?: string;
  category_name?: string;
  alias_name: string;
  normalized_alias: string;
  match_weight: number;
  is_primary: boolean;
  is_active?: boolean;
  alias_type?: AliasType;
  created_at?: string;
  updated_at?: string;
}

export interface MasterSkill {
  id: number;
  skill_name: string;
  category?: string | null;
}

export interface RoleSkillMapping {
  id: number;
  role_id: number;
  role_name?: string;
  skill_id: number;
  skill_name?: string;
  importance_weight: number;
  is_required: boolean;
  is_active?: boolean;
  created_at?: string;
}

export interface DashboardMetrics {
  totalCategories: number;
  totalStandardRoles: number;
  totalSearchKeywords: number;
  totalRoleSkills: number;
  pendingRequests: number;
  lastUpdated: string;
}

// ── Matching Intelligence Request Types ──────────────────────────────────────
// Generalized entity types for the Approval Queue.
// Only JOB_CATEGORY is active in the first implementation.
// Future entity types can be enabled as their source tables/APIs are introduced.
export type IntelligenceEntityType =
  | "JOB_CATEGORY"
  | "JOB_ROLE"
  | "SKILL"
  | "KEYWORD"
  | "ROLE_SKILL"
  | "ROLE_KEYWORD"
  | "CERTIFICATION"
  | "EXPERIENCE_LEVEL";

export type IntelligenceRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ResolutionType = "CREATED_NEW" | "MAPPED_EXISTING" | "REJECTED";

export type IntelligenceRequestAction = "APPROVE" | "REJECT";

/**
 * Normalized frontend representation of an intelligence request.
 * Backed by `vs_role_category_suggestion` in the first implementation.
 * Future implementations may aggregate multiple source tables.
 */
export interface IntelligenceRequest {
  suggestion_id: number;
  job_id?: number | null;
  entity_type: IntelligenceEntityType;

  // JOB_CATEGORY payload fields (first implementation)
  category_name?: string | null;
  category_description?: string | null;

  // Source identity
  company_id?: number | null;
  suggested_by_user_id?: number | null;
  source: "CLIENT" | "SYSTEM";

  // Workflow state & resolution
  status: IntelligenceRequestStatus;
  resolution_type?: ResolutionType | null;
  resolved_category_id?: number | null;
  resolved_category_name?: string | null;

  admin_remarks?: string | null;
  reviewed_by?: number | null;
  reviewed_at?: string | null;

  created_at: string;
  updated_at?: string | null;
}

export interface ReviewRequestPayload {
  action: IntelligenceRequestAction;
  resolution_type?: ResolutionType;
  // For CREATED_NEW
  category_name?: string;
  category_description?: string;
  category_code?: string;
  // For MAPPED_EXISTING
  existing_category_id?: number;
  // For all / REJECT (mandatory on reject)
  admin_remarks?: string;
}

export interface CandidateWorkExperience {
  company_name: string;
  job_title: string;
  job_description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current_role?: boolean;
}

export interface CandidateCertification {
  certificate_name: string;
  issuing_organization?: string | null;
}

export interface CandidateSimulationProfile {
  user_id?: number;
  name: string;
  email: string;
  headline: string;
  summary: string;
  location: string;
  availability_status: string;
  skills: string[];
  work_experience: CandidateWorkExperience[];
  certifications?: CandidateCertification[];
}

export interface SimulationResult {
  keyword: string;
  candidate?: CandidateSimulationProfile;
  resolvedContext: {
    resolved_role: string | null;
    resolved_role_id: number | null;
    category_code: string | null;
    category_name: string | null;
    matched_alias: string | null;
    match_weight: number;
  };
  overallScore: number;
  rankingScore: number;
  confidence: {
    score: number;
    level: string;
  };
  sections: Array<{ label: string; score: number; max: number }>;
  strengths: string[];
  evidence: Array<{ label: string; value: string }>;
  trace: Array<{ factor: string; result: string; points: number }>;
}

// src/modules/client/talent-search/types.tsx

// ─────────────────────────────────────────────
// Talent Search Types
// ─────────────────────────────────────────────

export type AvailabilityStatus = "AVAILABLE" | "EMPLOYED" | "OPEN" | "IMMEDIATELY_AVAILABLE";

export type ExperienceLevel = "ENTRY" | "JUNIOR" | "MID" | "SENIOR" | "MANAGER" | "EXECUTIVE";

export interface TalentWorkExperience {
  company_name: string;
  job_title: string;
  start_date: string | null;
  end_date: string | null;
  is_current_role: boolean;
  employment_type: string | null;
}

export interface TalentEducation {
  id: number | null;
  school_name: string | null;
  school_id: number | null;
  course_name: string | null;
  education_status: string | null;
  start_date: string | null;
  end_date: string | null;
}

import {
  MatchMode,
  MatchConfidenceLevel,
  BreakdownSection,
  MatchExplanation,
  EvidenceItem,
  MatchResult,
} from "@/modules/matching-engine";

export type { MatchMode, MatchConfidenceLevel, BreakdownSection, MatchExplanation, EvidenceItem, MatchResult };

export interface MatchBreakdown {
  mode: MatchMode;
  overallScore: number;
  rankingScore?: number;
  confidence?: {
    score: number;
    level: MatchConfidenceLevel;
  };
  sections: BreakdownSection[];
  explanation: MatchExplanation;
  evidence: EvidenceItem[];
  // Legacy support fields for backwards compatibility
  skills?: number;
  experience?: {
    score: number;
    relevantYears: number;
    totalYears: number;
    matchedRoles: string[];
    ignoredRoles: string[];
  };
  education?: number;
  certifications?: number;
  availability?: number;
  location?: number;
  portfolio?: number;
}

/** Lightweight talent card (search results) */
export interface TalentCard {
  user_id: number;
  profile_id: number;
  name: string;
  email: string;
  profile_image_url: string | null;
  headline: string | null;
  summary: string | null;
  location: string;
  skills: string[];
  experience_years: number;
  relevant_experience_years?: number;
  work_experience: TalentWorkExperience[];
  education: TalentEducation[];
  education_count: number;
  availability_status: AvailabilityStatus;
  is_saved: boolean;
  match_score: number | null;
  ranking_score?: number | null;
  match_result?: MatchResult | null;
  match_breakdown?: MatchBreakdown | null;
  ai_explanation?: string | null;
}


export interface TalentSearchResponse {
  search_mode?: "browse" | "search";
  talents: TalentCard[];
  total: number;
  page: number;
  limit: number;
  ai_reranked?: boolean;
}

/** Full talent profile (drawer / detail view) */
export interface TalentProfile {
  user_id: number;
  name: string;
  email: string;
  phone: string | null;
  profile_image_url: string | null;
  gender: string | null;
  nationality: string | null;
  location: string;
  headline: string | null;
  summary: string | null;
  expected_salary: number | null;
  profile_visibility: string;
  availability_status: "AVAILABLE" | "EMPLOYED" | "OPEN" | "IMMEDIATELY_AVAILABLE";
  skills: string[];
  experience_years: number;
  work_experience: Array<{
    id: number;
    company_name: string;
    job_title: string;
    location: string | null;
    location_type: string | null;
    employment_type: string | null;
    start_date: string | null;
    end_date: string | null;
    is_current_role: boolean;
    description: string | null;
    skills: string[];
  }>;
  education: Array<{
    id: number;
    school_name: string | null;
    school_location: string | null;
    course_name: string | null;
    education_status: string | null;
    start_date: string | null;
    end_date: string | null;
  }>;
  certifications: Array<{
    id: number;
    certificate_name: string;
    issuing_organization: string;
    issue_date: string | null;
    credential_url: string | null;
  }>;
  social_links: Array<{
    id: number;
    platform_name: string;
    profile_url: string;
  }>;
  resumes: Array<{
    id: number;
    file_url: string;
    file_name: string | null;
    is_primary: boolean;
    uploaded_at: string | null;
  }>;
  is_saved: boolean;
  saved_notes: string | null;
}

/** Saved talent list item */
export interface SavedTalent {
  id: number;
  talent_user_id: number;
  notes: string | null;
  created_at: string | null;
  name: string;
  email: string | null;
  profile_image_url: string | null;
  location: string | null;
  headline: string | null;
  skills: string[];
}

/** Search filters */
export interface TalentFilters {
  keyword: string;
  skills: string[];
  locations: string[];
  experience_level: ExperienceLevel | "";
  schools: SchoolFilter[];
}

/**
 * A school chosen from the `vs_school` registry keeps its numeric id so the
 * search can match it exactly; free-typed schools fall back to name matching.
 * `campus` is display only — `vs_school` repeats one name across several towns.
 */
export interface SchoolFilter {
  id: number | null;
  name: string;
  campus?: string | null;
}

export type FilterSuggestionType = "skills" | "locations" | "schools";

/** One row returned by the filter autocomplete endpoint. */
export interface FilterSuggestion {
  value: string;
  label: string;
  hint: string | null;
}

export const EMPTY_FILTERS: TalentFilters = {
  keyword: "",
  skills: [],
  locations: [],
  experience_level: "",
  schools: [],
};

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  ENTRY: "Entry Level (0–2 yrs)",
  JUNIOR: "Junior (0–3 yrs)",
  MID: "Mid Level (2–6 yrs)",
  SENIOR: "Senior (5+ yrs)",
  MANAGER: "Manager (7+ yrs)",
  EXECUTIVE: "Executive (10+ yrs)",
};

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  AVAILABLE: "Available",
  IMMEDIATELY_AVAILABLE: "Immediately Available",
  EMPLOYED: "Currently Employed",
  OPEN: "Open to Opportunities",
};

export const MATCH_SCORE_LABEL = (score: number): { label: string; color: string } => {
  if (score >= 85) return { label: "Excellent Match", color: "text-emerald-600" };
  if (score >= 70) return { label: "Good Match", color: "text-blue-600" };
  if (score >= 50) return { label: "Fair Match", color: "text-amber-600" };
  return { label: "Low Match", color: "text-zinc-500" };
};

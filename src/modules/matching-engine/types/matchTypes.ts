// src/modules/matching-engine/types/matchTypes.ts

export enum MatchMode {
  BROWSE = "BROWSE",
  ROLE_SIMILARITY = "ROLE_SIMILARITY",
  SKILL_MATCH = "SKILL_MATCH",
  JOB_MATCH = "JOB_MATCH",
  HYBRID = "HYBRID",
  AI_RERANK = "AI_RERANK",
}

export type EligibilityReason =
  | "BROWSE_MODE"
  | "DIRECT_ROLE_MATCH"
  | "RELATED_ROLE_MATCH"
  | "SKILL_MATCH"
  | "EXPERIENCE_MATCH"
  | "EDUCATION_MATCH"
  | "NAME_MATCH"
  | "NO_RELEVANCE";

export interface CandidateEligibility {
  eligible: boolean;
  reason: EligibilityReason;
  score: number;
}

export type MatchConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface ResolvedTaxonomyContext {
  keyword: string;
  resolved_role: string | null;
  resolved_role_id: number | null;
  category_code: string | null;
  category_name: string | null;
  matched_alias: string | null;
  match_weight: number;
  alias_type?: string;
  expanded_aliases: string[];
}

export interface MatchContext {
  mode: MatchMode;
  keyword?: string;
  requestedSkills?: string[];
  effectiveSkills?: string[];
  jobId?: number;
  location?: string;
  requiredExperience?: number;
  targetRoleId?: number;
  taxonomyContext?: ResolvedTaxonomyContext;
  layer1Score?: number;
}

export interface BreakdownSection {
  label: string;
  score: number;
  max: number;
  type?: "score" | "bonus";
}

export interface MatchExplanationItem {
  code: string;
  message: string;
}

export interface MatchExplanation {
  summary: string;
  items: MatchExplanationItem[];
  strengths: string[];
  weaknesses: string[];
}

export interface MatchTraceItem {
  factor: string;
  result: string;
  points: number;
}

export interface MatchResult {
  candidateId: number;
  mode: MatchMode;
  compatibility: {
    score: number;
    sections: BreakdownSection[];
  };
  ranking: {
    score: number;
  };
  confidence: {
    score: number;
    level: MatchConfidenceLevel;
  };
  evidence: import("./evaluatorTypes").EvidenceItem[];
  explanation: MatchExplanation;
  trace: MatchTraceItem[];
  engineVersion: string;
}

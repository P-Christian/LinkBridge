import type { Applicant, ApplicantFilterStatus } from "../types";
import {
  CanonicalStageType,
  JobPipelineVersion,
  TERMINAL_STAGE_TYPES,
} from "@/modules/client/pipeline/types";

const TERMINAL_LEGACY_STATUSES = ["HIRED", "REJECTED", "WITHDRAWN"];

/** Unmigrated rows only carry application_status; fold it onto the canonical stage. */
const CANONICAL_BY_LEGACY_STATUS: Record<string, CanonicalStageType> = {
  APPLIED: "APPLIED",
  UNDER_REVIEW: "SCREENING",
  SHORTLISTED: "OFFER",
  INTERVIEWING: "INTERVIEW",
  HIRED: "HIRED",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
};

/** A candidate's stage, preferring the pipeline column over the legacy status. */
export function effectiveStageType(applicant: Applicant): CanonicalStageType | null {
  if (applicant.stage_type) return applicant.stage_type;
  return CANONICAL_BY_LEGACY_STATUS[applicant.application_status] ?? null;
}

export function isTerminalApplicant(applicant: Applicant): boolean {
  if (applicant.stage_type) {
    return TERMINAL_STAGE_TYPES.includes(applicant.stage_type);
  }
  return TERMINAL_LEGACY_STATUSES.includes(applicant.application_status);
}

/**
 * Single source of truth for "does this candidate belong to this tab".
 * Tab counts and the visible list both call this, so the numbers on the tabs
 * always agree with what the list renders.
 */
export function matchesStageFilter(
  applicant: Applicant,
  filter: ApplicantFilterStatus,
  jobPipeline?: JobPipelineVersion | null
): boolean {
  if (filter === "ALL") return true;
  if (filter === "ACTIVE_PIPELINE") return !isTerminalApplicant(applicant);

  if (filter.startsWith("STAGE_")) {
    const stageId = parseInt(filter.replace("STAGE_", ""), 10);
    return (
      applicant.current_stage_id === stageId ||
      Boolean(
        applicant.stage_name &&
          jobPipeline?.stages?.find((s) => s.id === stageId)?.stage_name ===
            applicant.stage_name
      )
    );
  }

  return effectiveStageType(applicant) === filter;
}

export type ExperienceBucket = "lt2" | "2to5" | "5to8" | "gte8";
export type ProfileBucket = "lt50" | "50to80" | "80to100" | "complete";
export type AppliedWindow = "24h" | "7d" | "30d" | "90d";

export interface ApplicantFiltersState {
  experience: ExperienceBucket[];
  profile: ProfileBucket[];
  appliedWithin: AppliedWindow | null;
  stageTypes: CanonicalStageType[];
}

export const EMPTY_APPLICANT_FILTERS: ApplicantFiltersState = {
  experience: [],
  profile: [],
  appliedWithin: null,
  stageTypes: [],
};

export const EXPERIENCE_BUCKETS: Array<{
  id: ExperienceBucket;
  label: string;
  test: (years: number) => boolean;
}> = [
  { id: "lt2", label: "Under 2 yrs", test: (y) => y < 2 },
  { id: "2to5", label: "2–4 yrs", test: (y) => y >= 2 && y < 5 },
  { id: "5to8", label: "5–7 yrs", test: (y) => y >= 5 && y < 8 },
  { id: "gte8", label: "8+ yrs", test: (y) => y >= 8 },
];

export const PROFILE_BUCKETS: Array<{
  id: ProfileBucket;
  label: string;
  test: (pct: number) => boolean;
}> = [
  { id: "lt50", label: "Under 50%", test: (p) => p < 50 },
  { id: "50to80", label: "50–79%", test: (p) => p >= 50 && p < 80 },
  { id: "80to100", label: "80–99%", test: (p) => p >= 80 && p < 100 },
  { id: "complete", label: "Complete", test: (p) => p >= 100 },
];

export const APPLIED_WINDOWS: Array<{
  id: AppliedWindow;
  label: string;
  hours: number;
}> = [
  { id: "24h", label: "Last 24 hours", hours: 24 },
  { id: "7d", label: "Last 7 days", hours: 24 * 7 },
  { id: "30d", label: "Last 30 days", hours: 24 * 30 },
  { id: "90d", label: "Last 90 days", hours: 24 * 90 },
];

export const STAGE_TAG_OPTIONS: Array<{ id: CanonicalStageType; label: string }> = [
  { id: "APPLIED", label: "Applied" },
  { id: "SCREENING", label: "Screening" },
  { id: "ASSESSMENT", label: "Assessment" },
  { id: "INTERVIEW", label: "Interview" },
  { id: "OFFER", label: "Offer" },
  { id: "HIRED", label: "Hired" },
  { id: "REJECTED", label: "Rejected" },
  { id: "WITHDRAWN", label: "Withdrawn" },
];

export function countActiveFilters(filters: ApplicantFiltersState): number {
  return (
    filters.experience.length +
    filters.profile.length +
    filters.stageTypes.length +
    (filters.appliedWithin ? 1 : 0)
  );
}

/** Buckets within a group are OR'd; groups are AND'd against each other. */
export function matchesAdvancedFilters(
  applicant: Applicant,
  filters: ApplicantFiltersState,
  now: number
): boolean {
  if (filters.experience.length) {
    const years = applicant.experience_years ?? 0;
    const hit = EXPERIENCE_BUCKETS.some(
      (b) => filters.experience.includes(b.id) && b.test(years)
    );
    if (!hit) return false;
  }

  if (filters.profile.length) {
    const pct = applicant.profile_completion ?? 0;
    const hit = PROFILE_BUCKETS.some(
      (b) => filters.profile.includes(b.id) && b.test(pct)
    );
    if (!hit) return false;
  }

  if (filters.appliedWithin) {
    const appliedAt = applicant.applied_at
      ? Date.parse(applicant.applied_at)
      : NaN;
    if (Number.isNaN(appliedAt)) return false;
    const window = APPLIED_WINDOWS.find((w) => w.id === filters.appliedWithin);
    if (!window) return false;
    if (now - appliedAt > window.hours * 60 * 60 * 1000) return false;
  }

  if (filters.stageTypes.length) {
    const stage = effectiveStageType(applicant);
    if (!stage || !filters.stageTypes.includes(stage)) return false;
  }

  return true;
}

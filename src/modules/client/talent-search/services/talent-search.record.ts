// src/modules/client/talent-search/services/talent-search.record.ts

import {
  normalizeRawCandidate,
  runMatchingEngine,
  type MatchContext,
  type MatchResult,
  type MatchMode,
  type NormalizedProfile,
} from "@/modules/matching-engine";
import { orderEducation } from "@/modules/client/education/order-education";
import { debugLog } from "./talent-search.helpers";
import type {
  BulkCertRow,
  BulkSocialRow,
  BulkUserRow,
  BulkWorkRow,
  TalentEducationBulkRow,
  TalentProfileRow,
} from "./talent-search.repo";

/** One candidate's rows as attached by the bulk reads, before normalization. */
export type CandidateRows = {
  profile: TalentProfileRow;
  user: BulkUserRow;
  skills: string[];
  work: BulkWorkRow[];
  edu: TalentEducationBulkRow[];
  certs: BulkCertRow[];
  social: BulkSocialRow[];
};

export type NormalizedCandidateItem = CandidateRows & { normalized: NormalizedProfile };

/** Scoring inputs shared by every candidate in one search. */
export type RecordContext = {
  matchContext: MatchContext;
  /** Match percentage and badges appear only when matching a job posting. */
  showMatchScore: boolean;
  /** Browse mode has no relevance score to rank by or show. */
  rankingEnabled: boolean;
  savedUserIds: Set<number>;
  /**
   * Layer 1's verdict for this candidate, carried only so the development log can
   * show what retrieval decided beside what the evaluators made of it. Nothing in
   * the record reads it — that handoff is TS-10, and until it lands the score must
   * stay blind to it, which is exactly the fact TS-39 makes visible.
   */
  retrieval?: { score: number; reason: string };
};

export interface TalentResult {
  user_id: number;
  profile_id: number;
  name: string;
  profile_image_url: string | null;
  headline: string | null;
  summary: string | null;
  location: string;
  skills: string[];
  experience_years: number;
  relevant_experience_years: number;
  work_experience: Array<{
    company_name: string;
    job_title: string;
    start_date: string | null;
    end_date: string | null;
    is_current_role: boolean;
    employment_type: string | null;
  }>;
  education: Array<{
    id: number | null;
    school_name: string | null;
    school_id: number | null;
    course_name: string | null;
    education_status: string | null;
    start_date: string | null;
    end_date: string | null;
  }>;
  education_count: number;
  availability_status: string;
  is_saved: boolean;
  match_score: number | null;
  ranking_score: number | null;
  match_result: MatchResult | null;
  match_breakdown: {
    mode: MatchMode;
    overallScore: number;
    rankingScore: number;
    confidence: MatchResult["confidence"];
    sections: MatchResult["compatibility"]["sections"];
    explanation: MatchResult["explanation"];
    evidence: MatchResult["evidence"];
  } | null;
  ai_explanation: string | null;
}

/**
 * One raw candidate into the shape the engine scores. Shared by the cold path
 * (whole corpus, before Layer 1) and the warm path (the page's ids only), so a
 * page turn cannot score the same person differently from the search that
 * ranked them.
 */
export function normalizeCandidate(rows: CandidateRows): NormalizedProfile {
  const { profile, user, skills, work, edu, certs, social } = rows;

  return normalizeRawCandidate({
    user_id: profile.user_id,
    name: `${user.user_fname} ${user.user_lname}`.trim(),
    headline: profile.profile_headline,
    summary: profile.professional_summary,
    location: [user.user_city, user.user_province].filter(Boolean).join(", "),
    // Derived exactly as the talent-profile route does it — there is no
    // availability column. Left out, the normalizer defaulted everyone to
    // "AVAILABLE" and the card told the employer a working candidate was free.
    availability_status: work.some((w) => w.is_current_role) ? "EMPLOYED" : "AVAILABLE",
    skills,
    work_experience: work,
    education: edu.map((e) => ({
      id: e.employee_education_id ?? null,
      status: e.education_status ?? null,
      school_name: e.school_id?.school_name,
      course_name: e.school_course_id?.course_name,
      start_date: e.start_date,
      end_date: e.end_date,
    })),
    certifications: certs,
    social_links: social,
  });
}

/**
 * One line per scored candidate, development only. `ranking_score` is printed as
 * the three numbers `calculateRankingScore` actually combines, so a candidate who
 * outscores a better-matched one can be attributed to a fuller profile rather than
 * argued about; anything left over is the keyword name/school bonus the formula
 * adds after those three. The per-evaluator points are the part no recruiter or
 * log ever saw on a keyword search, because the payload nulls the breakdown when
 * no job posting is matched.
 */
function logScoredCandidate(
  normalized: NormalizedProfile,
  record: TalentResult,
  engineResult: MatchResult,
  ctx: RecordContext
): void {
  if (process.env.NODE_ENV === "production") return;
  // A warm page hydrated its order from the cache and never consulted Layer 1, so
  // there is no handoff to attribute — its own `WARM` line already says what was
  // reused.
  if (!ctx.retrieval) return;

  const compat = engineResult.compatibility.score;
  const completeness = normalized.profileCompletenessScore;
  const activity = normalized.activityScore;
  const base = Number((compat * 0.85 + completeness * 0.1 + activity * 0.05).toFixed(1));
  const bonus = Number((engineResult.ranking.score - base).toFixed(1));
  // The name and school bonuses are whole numbers, so a tenth is rounding, not a
  // bonus — reporting it would invent a cause. It can only ever add, so a negative
  // remainder means the two sides of the formula diverged and is printed as is.
  const bonusText = Math.abs(bonus) >= 0.1 ? ` ${bonus > 0 ? "+" : "−"} ${Math.abs(bonus)} keyword bonus` : "";

  debugLog(
    `[talent-search] LAYER_2    │ #${record.user_id} ${record.name} │ L1 ${ctx.retrieval.score}/100 ${ctx.retrieval.reason} │ rank ${engineResult.ranking.score} = compat ${compat}×.85 + complete ${completeness}×.10 + activity ${activity}×.05${bonusText} │ ${engineResult.compatibility.sections.map((s) => `${s.label} ${s.score}/${s.max}`).join(", ")} │ rel ${record.relevant_experience_years}y of ${record.experience_years}y │ ${record.availability_status}`
  );
}

/** Score one candidate and shape the card the recruiter sees. */
export function buildTalentRecord(
  rows: CandidateRows,
  normalized: NormalizedProfile,
  ctx: RecordContext
): TalentResult {
  const { profile, user, work, edu } = rows;

  const matchContext: MatchContext = ctx.retrieval
    ? { ...ctx.matchContext, layer1Score: ctx.retrieval.score }
    : ctx.matchContext;
  const engineResult = runMatchingEngine(normalized, matchContext);

  // Relevant years come out of the experience evaluator's evidence, which is
  // the only place role relevance against the query is computed.
  const expEvidence = engineResult.evidence.find((e) => e.type === "EXPERIENCE");
  const relYearsMatch = expEvidence?.value.match(/([\d.]+)\s*yrs/);
  const relYears = relYearsMatch ? Number(relYearsMatch[1]) : 0;

  // Full education history in shared deterministic order; compact surfaces
  // preview from this array and expose the remainder via education_count
  // instead of dropping rows here.
  const orderedEdu = orderEducation<TalentEducationBulkRow>(edu, {
    status: (e) => e.education_status,
    endDate: (e) => e.end_date,
    startDate: (e) => e.start_date,
    id: (e) => e.employee_education_id,
  });

  const record: TalentResult = {
    user_id: profile.user_id,
    profile_id: profile.profile_id,
    name: normalized.name,
    profile_image_url: user.profile_image_url ?? null,
    headline: normalized.headline,
    summary: normalized.summary,
    location: normalized.location,
    skills: normalized.skills,
    experience_years: Number(
      (
        work.reduce((acc, w) => {
          if (!w.start_date) return acc;
          const s = new Date(w.start_date);
          const e = w.is_current_role ? new Date() : w.end_date ? new Date(w.end_date) : new Date();
          return acc + Math.max((e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()), 0);
        }, 0) / 12
      ).toFixed(1)
    ),
    relevant_experience_years: relYears,
    work_experience: work.slice(0, 3).map((w) => ({
      company_name: w.company_name,
      job_title: w.job_title,
      start_date: w.start_date ?? null,
      end_date: w.end_date ?? null,
      is_current_role: w.is_current_role ?? false,
      employment_type: w.employment_type ?? null,
    })),
    education: orderedEdu.map((e) => ({
      id: e.employee_education_id ?? null,
      school_name: e.school_id?.school_name ?? null,
      school_id: e.school_id?.school_id ?? null,
      course_name: e.school_course_id?.course_name ?? null,
      education_status: e.education_status ?? null,
      start_date: e.start_date ?? null,
      end_date: e.end_date ?? null,
    })),
    education_count: edu.length,
    availability_status: normalized.availability,
    is_saved: ctx.savedUserIds.has(profile.user_id),
    match_score: ctx.showMatchScore ? engineResult.compatibility.score : null,
    ranking_score: ctx.rankingEnabled ? engineResult.ranking.score : null,
    match_result: ctx.showMatchScore ? engineResult : null,
    match_breakdown: ctx.showMatchScore
      ? {
          mode: engineResult.mode,
          overallScore: engineResult.compatibility.score,
          rankingScore: engineResult.ranking.score,
          confidence: engineResult.confidence,
          sections: engineResult.compatibility.sections,
          explanation: engineResult.explanation,
          evidence: engineResult.evidence,
        }
      : null,
    ai_explanation: null,
  };

  logScoredCandidate(normalized, record, engineResult, ctx);

  return record;
}

// src/modules/client/applicants/utils/applicantAiCache.ts

export interface AlternativeJobMatch {
  job_id: number;
  job_title: string;
  match_score: number;
  reasoning: string;
}

export interface CandidateAiAnalysis {
  match_score: number;
  fit_level: "Strong Match" | "Good Match" | "Moderate Match" | "Potential Fit" | "Low Match";
  executive_summary: string;
  strengths: string[];
  gaps_or_considerations: string[];
  screening_assessment?: string | null;
  recommendation: string;
  alternative_job_recommendations?: AlternativeJobMatch[];
  analyzed_at: string;
}

const CACHE_PREFIX = "vos_applicant_ai_analysis_";

/**
 * PRIV-016: these records are AI assessments of a named candidate, so they are
 * personal data sitting in a shared browser. They may not live in localStorage
 * forever - entries older than the TTL are dropped, and everything is purged
 * when the hiring user logs out (see purgeApplicantAiCache).
 */
const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

function isExpired(analysis: CandidateAiAnalysis | null | undefined): boolean {
  const analyzedAt = Date.parse(analysis?.analyzed_at ?? "");
  // No readable timestamp -> treat as expired rather than trusting the entry.
  if (!Number.isFinite(analyzedAt)) return true;
  return Date.now() - analyzedAt > CACHE_TTL_MS;
}

export function getCachedApplicantAnalysis(applicationId: number): CandidateAiAnalysis | null {
  if (typeof window === "undefined" || !applicationId) return null;
  try {
    const key = `${CACHE_PREFIX}${applicationId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CandidateAiAnalysis;
    if (isExpired(parsed)) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedApplicantAnalysis(
  applicationId: number,
  analysis: CandidateAiAnalysis
): void {
  if (typeof window === "undefined" || !applicationId || !analysis) return;
  try {
    localStorage.setItem(`${CACHE_PREFIX}${applicationId}`, JSON.stringify(analysis));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearCachedApplicantAnalysis(applicationId: number): void {
  if (typeof window === "undefined" || !applicationId) return;
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${applicationId}`);
  } catch {
    // Ignore
  }
}

/**
 * PRIV-016: remove every cached candidate AI assessment from this browser.
 * Called by the logout handlers so the next person using the machine cannot
 * read the previous user's retained assessments.
 */
export function purgeApplicantAiCache(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore storage access errors
  }
}

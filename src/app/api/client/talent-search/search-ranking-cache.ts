// src/app/api/client/talent-search/search-ranking-cache.ts

import type { ResolvedTaxonomyContext } from "@/modules/matching-engine";
import { layerLog } from "@/modules/client/talent-search/services/talent-search.helpers";

/**
 * Bump this with any change to Layer 1 retrieval, the evaluators, the weights
 * or the record shape. It is the only key a scoring change invalidates, so a
 * stale ranking can never outlive a deploy by more than one version string.
 */
export const RANKING_ENGINE_VERSION = "2026-11-04.1";

/**
 * Freshness bound. A profile-row write is caught by the probe in the route, but
 * the rest is caught by nothing: a no-op PATCH does not fire
 * `ON UPDATE CURRENT_TIMESTAMP`, and the attached tables
 * (`vs_work_experience`, `vs_certifications`, `vs_user_social_links`) have no
 * timestamp column at all. This age is what makes an edit visible without a
 * restart, so it must stay short.
 */
const MAX_AGE_MS = 120_000;

/**
 * One ranking per distinct search. Entries hold an id per candidate, so the cap
 * is what bounds this memory at corpus scale; searches deeper than that simply
 * re-rank rather than growing without limit.
 */
const MAX_ENTRIES = 50;

export interface RankingKeyInput {
  jobId: number;
  keyword: string;
  skills: string[];
  locations: string[];
  schools: string[];
  experienceLevel: string;
}

/**
 * Filter order is preserved: the engine takes `locations[0]` as its single
 * location input, so sorting these lists would put two different searches on
 * one entry.
 */
export function buildRankingKey(input: RankingKeyInput): string {
  return JSON.stringify([
    RANKING_ENGINE_VERSION,
    input.jobId || 0,
    input.keyword,
    input.skills,
    input.locations,
    input.schools,
    input.experienceLevel,
  ]);
}

export interface RankedSearch {
  /** User ids in final display order — after the filters, the sort and any Layer B rerank. */
  ids: number[];
  total: number;
  mode: "browse" | "search";
  aiReranked: boolean;
  /**
   * Engine inputs captured at ranking time. Rebuilding these on a page turn
   * would mean the taxonomy scans and the Gemini call the cache exists to skip,
   * and a different input scores the candidate differently.
   */
  taxonomy: ResolvedTaxonomyContext;
  matchKeyword: string;
  effectiveSkills: string[];
  /** Newest `vs_job_seeker_profile.updated_at` in the corpus when this was ranked. */
  newestProfileWrite: number | null;
  savedAt: number;
}

const ranked = new Map<string, RankedSearch>();

export function getRankedSearch(key: string): RankedSearch | null {
  const entry = ranked.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.savedAt;
  if (age > MAX_AGE_MS) {
    ranked.delete(key);
    // Both of these are invisible from the response: the search simply comes
    // back cold. Say so, in development only.
    layerLog("CACHE", "❌ expired — this entry is older than the max age", { ageMs: age, maxAgeMs: MAX_AGE_MS, entries: ranked.size });
    return null;
  }
  return entry;
}

export function setRankedSearch(key: string, entry: RankedSearch): void {
  if (!ranked.has(key) && ranked.size >= MAX_ENTRIES) {
    const oldest = ranked.keys().next().value;
    if (oldest !== undefined) {
      ranked.delete(oldest);
      layerLog("CACHE", "❗ full — dropped the oldest ranking to hold the entry cap", { maxEntries: MAX_ENTRIES });
    }
  }
  ranked.set(key, entry);
}

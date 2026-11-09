// src/app/api/client/talent-search/search-ranking-cache.ts

import type { ResolvedTaxonomyContext } from "@/modules/matching-engine";
import type { TalentResult } from "@/modules/client/talent-search/services/talent-search.record";
import { layerLog } from "@/modules/client/talent-search/services/talent-search.helpers";

/**
 * Bump this with any change to Layer 1 retrieval, the evaluators, the weights
 * or the record shape. It is the only key a scoring change invalidates, so a
 * stale ranking can never outlive a deploy by more than one version string.
 */
export const RANKING_ENGINE_VERSION = "2026-11-06.1";

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
  experienceLevel?: string;
  experienceLevels?: string[];
  workSetups?: string[];
  /** Part of the key because the stored array IS the order — see RankedSearch.ids. */
  sort?: string;
}

/**
 * Filter order is preserved: the engine takes `locations[0]` as its single
 * location input, so sorting these lists would put two different searches on
 * one entry.
 */
export function buildRankingKey(input: RankingKeyInput): string {
  const expLevels = input.experienceLevels ?? (input.experienceLevel ? [input.experienceLevel] : []);
  return JSON.stringify([
    RANKING_ENGINE_VERSION,
    input.jobId || 0,
    (input.keyword || "").trim().toLowerCase(),
    input.skills,
    input.locations,
    input.schools,
    expLevels,
    input.workSetups ?? [],
    input.sort ?? "relevance",
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

// ────────────────────────────────────────────
// Tier 1: Base Scored Pool (corpus-wide Layer 2 scored candidates for a role)
// ────────────────────────────────────────────

export interface BaseScoredPool {
  talents: TalentResult[];
  taxonomy: ResolvedTaxonomyContext;
  matchKeyword: string;
  effectiveSkills: string[];
  newestProfileWrite: number | null;
  savedAt: number;
}

export function buildBaseSearchKey(input: {
  companyId: number;
  jobId: number;
  keyword: string;
  skills?: string[];
}): string {
  return JSON.stringify([
    RANKING_ENGINE_VERSION,
    input.companyId,
    input.jobId || 0,
    (input.keyword || "").trim().toLowerCase(),
    input.skills ?? [],
  ]);
}

const baseScoredPools = new Map<string, BaseScoredPool>();

export function getBaseScoredPool(key: string): BaseScoredPool | null {
  const entry = baseScoredPools.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.savedAt;
  if (age > MAX_AGE_MS) {
    baseScoredPools.delete(key);
    layerLog("CACHE", "❌ base pool expired", { ageMs: age, maxAgeMs: MAX_AGE_MS });
    return null;
  }
  return entry;
}

export function setBaseScoredPool(key: string, entry: BaseScoredPool): void {
  if (!baseScoredPools.has(key) && baseScoredPools.size >= MAX_ENTRIES) {
    const oldest = baseScoredPools.keys().next().value;
    if (oldest !== undefined) baseScoredPools.delete(oldest);
  }
  baseScoredPools.set(key, entry);
}

// ────────────────────────────────────────────
// Layer B Rerank Cache (keyed on candidate head IDs)
// ────────────────────────────────────────────

export interface CachedRerankResult {
  adjustments: Record<number, number>;
  rationales: Record<number, string>;
  ranked_ids: number[];
  savedAt: number;
}

const rerankCache = new Map<string, CachedRerankResult>();

export function getCachedRerank(key: string): CachedRerankResult | null {
  const entry = rerankCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > MAX_AGE_MS) {
    rerankCache.delete(key);
    return null;
  }
  return entry;
}

export function setCachedRerank(key: string, entry: CachedRerankResult): void {
  if (!rerankCache.has(key) && rerankCache.size >= MAX_ENTRIES) {
    const oldest = rerankCache.keys().next().value;
    if (oldest !== undefined) rerankCache.delete(oldest);
  }
  rerankCache.set(key, entry);
}

// ────────────────────────────────────────────
// Layer C Match Explanation Cache (Option 1: In-Memory LRU)
// ────────────────────────────────────────────

export interface CachedExplanationResult {
  explanation: string;
  savedAt: number;
}

const explanationCache = new Map<string, CachedExplanationResult>();
const EXPLANATION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const EXPLANATION_MAX_ENTRIES = 500;

export function getCachedExplanation(candidateKey: number | string, keyword: string): string | null {
  const normKey = `${String(candidateKey).trim()}::${keyword.trim().toLowerCase()}`;
  const entry = explanationCache.get(normKey);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > EXPLANATION_MAX_AGE_MS) {
    explanationCache.delete(normKey);
    return null;
  }
  return entry.explanation;
}

export function setCachedExplanation(candidateKey: number | string, keyword: string, explanation: string): void {
  const normKey = `${String(candidateKey).trim()}::${keyword.trim().toLowerCase()}`;
  if (!explanationCache.has(normKey) && explanationCache.size >= EXPLANATION_MAX_ENTRIES) {
    const oldest = explanationCache.keys().next().value;
    if (oldest !== undefined) explanationCache.delete(oldest);
  }
  explanationCache.set(normKey, { explanation, savedAt: Date.now() });
}

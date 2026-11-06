// src/modules/client/talent-search/services/talent-search.ai.ts

import {
  expandQueryWithGemini,
  shouldExpandWithGemini,
  type GeminiQueryIntent,
} from "@/lib/gemini/queryUnderstanding";
import { isSchoolQuery } from "@/modules/matching-engine";
import { rerankCandidatesWithGemini } from "@/lib/gemini/aiReranker";
import { debugLog } from "./talent-search.helpers";
import type { TalentResult } from "./talent-search.record";

/**
 * The two Gemini layers of the pipeline. Both are optional: each one falls back
 * to the deterministic path and reports which fallback it took, so the trace can
 * say whether a search was shaped by AI at all.
 */

const RERANK_LIMIT = 10;

/** In-memory query understanding cache to avoid redundant Layer A calls for identical queries */
const queryUnderstandingCache = new Map<string, GeminiQueryIntent>();

export type LayerAOutcome = "hit" | "miss" | "skipped";

export interface QueryUnderstanding {
  /** Keyword the matcher scores against — Gemini's resolved role, or the raw query. */
  matchKeyword: string;
  intent: GeminiQueryIntent | null;
  outcome: LayerAOutcome;
  /** Gemini rewrote the query, so the ranked keyword differs from what was typed. */
  rewrote: boolean;
}

/**
 * Gemini Layer A: natural language → canonical role keyword, e.g. "I need
 * someone who builds websites with React" → "React Developer".
 *
 * It runs before taxonomy and retrieval, so everything downstream sees the
 * resolved role. A school query is never rewritten — expanding "Pangasinan"
 * into a role would drop every graduate of it.
 */
export async function understandQuery(input: {
  keyword: string;
  userId: number;
  companyId: number;
}): Promise<QueryUnderstanding> {
  const { keyword, userId, companyId } = input;
  let intent: GeminiQueryIntent | null = null;
  let matchKeyword = keyword;
  let outcome: LayerAOutcome = "skipped";

  const isSchoolSearch = isSchoolQuery(keyword);

  if (keyword && !isSchoolSearch && shouldExpandWithGemini(keyword)) {
    const cacheKey = keyword.trim().toLowerCase();
    if (queryUnderstandingCache.has(cacheKey)) {
      intent = queryUnderstandingCache.get(cacheKey)!;
      outcome = "hit";
      debugLog(`[talent-search] 🤖 Gemini Layer A (cache hit): "${keyword}" → "${intent.resolved_role ?? keyword}"`);
    } else {
      debugLog(`[talent-search] 🤖 Gemini Layer A: expanding query "${keyword}"`);
      intent = await expandQueryWithGemini(keyword, { userId, companyId }).catch(() => null);
      outcome = intent ? "hit" : "miss";

      if (intent) {
        queryUnderstandingCache.set(cacheKey, intent);
        debugLog(`[talent-search] 🤖 Gemini Layer A result:`, JSON.stringify(intent));
      } else {
        console.log(`[talent-search] ⚠️  Gemini Layer A: failed or no API key — using raw keyword`);
      }
    }

    // Use Gemini resolved role as effective search keyword when confidence is
    // high enough
    if (
      intent &&
      intent.resolved_role &&
      (intent.confidence === "HIGH" || intent.confidence === "MEDIUM")
    ) {
      matchKeyword = intent.resolved_role;
      debugLog(`[talent-search] 🤖 Gemini Layer A: matchKeyword resolved → "${matchKeyword}"`);
    } else {
      debugLog(`[talent-search] ℹ️  Gemini Layer A: keeping original keyword → "${matchKeyword}"`);
    }
  } else if (isSchoolSearch) {
    debugLog(`[talent-search] 🎓 School search detected — preserving original keyword "${keyword}"`);
  } else {
    debugLog(`[talent-search] ℹ️  Gemini Layer A: skipped (query too short or not applicable) — keyword="${keyword}"`);
  }

  return { matchKeyword, intent, outcome, rewrote: matchKeyword !== keyword };
}

export type LayerBOutcome = "reranked" | "skipped" | "not_applicable";

export interface TalentRerank {
  /** New order when AI reranked, otherwise the array it was handed. */
  talents: TalentResult[];
  aiReranked: boolean;
  outcome: LayerBOutcome;
}

/**
 * Gemini Layer B: semantic reranking of the top candidates. Requires both an
 * owned job posting and a search keyword to measure relevance against — with no
 * query, candidates stay in deterministic Layer 2 order. Only the head of the
 * list is sent, and only that head is reordered; the tail keeps its rank.
 *
 * NOTE: Layer C (match explanations) is deliberately absent here. It runs lazily
 * via POST /api/client/talent-search/explain when a drawer opens, so page turns
 * never pay for it.
 */
export async function rerankTalents(input: {
  keyword: string;
  jobId: number;
  userId: number;
  companyId: number;
  talents: TalentResult[];
}): Promise<TalentRerank> {
  const { keyword, jobId, userId, companyId, talents } = input;

  if (!keyword || talents.length < 2) {
    return { talents, aiReranked: false, outcome: "not_applicable" };
  }

  const candidatesToRerank = talents.slice(0, RERANK_LIMIT);
  const beforeOrder = candidatesToRerank.map((t) => `#${t.user_id}`).join(", ");
  debugLog(
    `[talent-search] 🤖 Gemini Layer B: reranking top ${candidatesToRerank.length} candidates${jobId ? ` for job ${jobId}` : ""} for "${keyword}"... [order before: ${beforeOrder}]`
  );
  const rerankInput = candidatesToRerank.map((t) => ({
    id: t.user_id,
    title: t.headline,
    skills: t.skills,
    summary: t.summary,
  }));
  const { ranked_ids, rationales, used_ai, skip_reason } = await rerankCandidatesWithGemini(keyword, rerankInput, {
    userId,
    companyId,
  });

  if (!used_ai || ranked_ids.length === 0) {
    debugLog(`[talent-search] ⚠️  Gemini Layer B: rerank skipped or failed (${skip_reason ?? "no candidates or timeout"}) — keeping Layer 2 order`);
    return { talents, aiReranked: false, outcome: "skipped" };
  }

  const rankMap = new Map(ranked_ids.map((id, idx) => [id, idx]));
  const topReranked = talents
    .slice(0, RERANK_LIMIT)
    .sort((a, b) => (rankMap.get(a.user_id) ?? 99) - (rankMap.get(b.user_id) ?? 99));

  const afterOrder = topReranked.map((t) => `#${t.user_id}`).join(", ");
  debugLog(`[talent-search] 🤖 Gemini Layer B: ✅ reranked ${ranked_ids.length} candidates [order after: ${afterOrder}]`);

  if (rationales && Object.keys(rationales).length > 0) {
    debugLog(`[talent-search] 🤖 Gemini Layer B: Rationale per candidate:`);
    topReranked.forEach((t, idx) => {
      const why = rationales[t.user_id] ?? "Maintained position";
      debugLog(`   ${idx + 1}. Candidate #${t.user_id} (${t.name}): ${why}`);
    });
  }
  return {
    talents: [...topReranked, ...talents.slice(RERANK_LIMIT)],
    aiReranked: true,
    outcome: "reranked",
  };
}

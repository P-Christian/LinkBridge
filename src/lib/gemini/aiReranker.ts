// src/lib/gemini/aiReranker.ts

import { callGeminiMonitored } from "./geminiMonitoring";

export interface RerankCandidate {
  id: number;
  title: string | null;
  skills: string[];
  summary: string | null;
  score?: number;
  relevant_experience_years?: number;
  completeness?: number;
}

export interface RerankResult {
  ranked_ids: number[];
  rationales?: Record<number, string>;
  adjustments?: Record<number, number>;
  used_ai: boolean;
  skip_reason?: string;
}

/**
 * Use Gemini to semantically rerank top candidates.
 * Falls back to original order if Gemini fails or times out.
 * Only processes top 50 candidates to control API cost.
 * Bounded by a strict 4000ms timeout to avoid search latency spikes.
 */
export async function rerankCandidatesWithGemini(
  query: string,
  candidates: RerankCandidate[],
  context?: { userId?: number; companyId?: number }
): Promise<RerankResult> {
  if (!query || candidates.length === 0) {
    return { ranked_ids: candidates.map((c) => c.id), used_ai: false, skip_reason: "empty_query_or_candidates" };
  }

  const top = candidates.slice(0, 50);

  // const candidateList = top
  //   .map(
  //     (c, i) =>
  //       `${i + 1}. ID:${c.id} | Title: ${c.title ?? "Unknown"} | Deterministic Score: ${c.score ?? "N/A"} | RelExp: ${c.relevant_experience_years ?? 0}y | Skills: ${c.skills.slice(0, 6).join(", ") || "None"} | Completeness: ${c.completeness ?? 0}% | Summary: ${(c.summary ?? "").slice(0, 120)}`
  //   )
  //   .join("\n");

  const prompt = `You are a recruitment scoring assistant.
Employer is searching for: "${query}"

Candidates have already been evaluated and scored by deterministic matching (Deterministic Score).
Assess each candidate's genuine semantic relevance to the search query.
Provide a bounded adjustment between -10.0 and +10.0 points to modify their deterministic score:
- Positive (+1 to +10): Strong direct semantic match for the role, tech stack, or domain beyond literal keywords.
- Neutral (0): Matches expected deterministic baseline.
- Negative (-1 to -10): Profile lacks genuine role fit, lacks essential skills, or is incomplete/misaligned despite a matching title.

Return ONLY a valid JSON array of objects with "id", "adjustment" (number from -10 to 10), and a concise 1-sentence "rationale".

Example:
[
  { "id": 3, "adjustment": 6.5, "rationale": "Direct full-stack alignment with strong React and production experience." },
  { "id": 29, "adjustment": -6.0, "rationale": "Title matches but profile completely lacks listed skills, summary, and experience." }
]
Return ONLY the JSON array, nothing else.`;

  const raw = await callGeminiMonitored({
    prompt,
    feature: "AI_RERANKER",
    endpoint: "lib/gemini/aiReranker",
    userId: context?.userId,
    companyId: context?.companyId,
    timeoutMs: 4000,
  });
  if (!raw) {
    return { ranked_ids: top.map((c) => c.id), used_ai: false, skip_reason: "gemini_timeout_or_error" };
  }

  try {
    // Strip markdown code fences if Gemini wrapped output
    const cleaned = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
    const arrMatch = cleaned.match(/\[[\s\S]*?\]/);
    if (!arrMatch) {
      return { ranked_ids: top.map((c) => c.id), used_ai: false, skip_reason: "no_json_array_found" };
    }

    const parsed = JSON.parse(arrMatch[0]);
    if (!Array.isArray(parsed)) {
      return { ranked_ids: top.map((c) => c.id), used_ai: false, skip_reason: "parsed_not_an_array" };
    }

    const validIds = new Set(top.map((c) => c.id));
    const ranked: number[] = [];
    const rationales: Record<number, string> = {};
    const adjustments: Record<number, number> = {};

    for (const item of parsed as unknown[]) {
      if (typeof item === "number" && validIds.has(item)) {
        if (!ranked.includes(item)) ranked.push(item);
      } else if (item && typeof item === "object" && "id" in item) {
        const obj = item as { id: unknown; adjustment?: unknown; rationale?: unknown };
        const id = typeof obj.id === "number" ? obj.id : Number(obj.id);
        if (Number.isFinite(id) && validIds.has(id) && !ranked.includes(id)) {
          ranked.push(id);
          if (typeof obj.rationale === "string" && obj.rationale.trim()) {
            rationales[id] = obj.rationale.trim();
          }
          if (typeof obj.adjustment === "number" && Number.isFinite(obj.adjustment)) {
            adjustments[id] = Math.max(-10, Math.min(10, Number(obj.adjustment.toFixed(1))));
          }
        }
      }
    }

    // Append any IDs Gemini skipped (preserve coverage)
    const covered = new Set(ranked);
    for (const c of top) {
      if (!covered.has(c.id)) {
        ranked.push(c.id);
        rationales[c.id] = "Preserved from initial deterministic order";
      }
    }

    return { ranked_ids: ranked, rationales, adjustments, used_ai: true };
  } catch (err) {
    return {
      ranked_ids: top.map((c) => c.id),
      used_ai: false,
      skip_reason: `json_parse_exception: ${(err as Error)?.message ?? err}`,
    };
  }
}

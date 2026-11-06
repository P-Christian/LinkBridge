// src/lib/gemini/aiReranker.ts

import { callGeminiMonitored } from "./geminiMonitoring";

export interface RerankCandidate {
  id: number;
  title: string | null;
  skills: string[];
  summary: string | null;
}

export interface RerankResult {
  ranked_ids: number[];
  rationales?: Record<number, string>;
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

  const candidateList = top
    .map(
      (c, i) =>
        `${i + 1}. ID:${c.id} | Title: ${c.title ?? "Unknown"} | Skills: ${c.skills.slice(0, 5).join(", ")} | Summary: ${(c.summary ?? "").slice(0, 120)}`
    )
    .join("\n");

  const prompt = `You are a recruitment AI assistant.

Employer is searching for: "${query}"

Rank the following candidates from MOST relevant to LEAST relevant based on the search query.
Return ONLY a valid JSON array of objects containing "id" and a concise 1-sentence "rationale" explaining their ranking position.

Candidates:
${candidateList}

Return format example:
[
  { "id": 3, "rationale": "Direct match for React with 5+ years web development experience." },
  { "id": 7, "rationale": "Strong full-stack profile, but secondary web experience." }
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

    for (const item of parsed as unknown[]) {
      if (typeof item === "number" && validIds.has(item)) {
        if (!ranked.includes(item)) ranked.push(item);
      } else if (item && typeof item === "object" && "id" in item) {
        const obj = item as { id: unknown; rationale?: unknown };
        const id = typeof obj.id === "number" ? obj.id : Number(obj.id);
        if (Number.isFinite(id) && validIds.has(id) && !ranked.includes(id)) {
          ranked.push(id);
          if (typeof obj.rationale === "string" && obj.rationale.trim()) {
            rationales[id] = obj.rationale.trim();
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

    return { ranked_ids: ranked, rationales, used_ai: true };
  } catch (err) {
    return {
      ranked_ids: top.map((c) => c.id),
      used_ai: false,
      skip_reason: `json_parse_exception: ${(err as Error)?.message ?? err}`,
    };
  }
}

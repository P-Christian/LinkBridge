// src/lib/gemini/matchExplainer.ts

import { callGeminiMonitored } from "./geminiMonitoring";

export interface ExplainCandidate {
  name: string;
  title: string | null;
  skills: string[];
  summary: string | null;
  experience_years: number;
}

/**
 * Batch generate explanations for up to 10 candidates in a SINGLE Gemini call.
 * Falls back gracefully — any unparseable entry is simply omitted from the map.
 */
export async function generateBatchExplanations(
  query: string,
  candidates: (ExplainCandidate & { id: number })[],
  context?: { userId?: number; companyId?: number }
): Promise<Map<number, string>> {
  const results = new Map<number, string>();
  if (!query || candidates.length === 0) return results;

  const candidateBlock = candidates
    .map(
      (c) =>
        `[ID:${c.id}]
Name: ${c.name}
Title: ${c.title ?? "Not specified"}
Skills: ${c.skills.slice(0, 8).join(", ") || "None listed"}
Experience: ${c.experience_years} year${c.experience_years !== 1 ? "s" : ""}
Summary: ${(c.summary ?? "").slice(0, 150)}`
    )
    .join("\n\n");

  const prompt = `You are a recruitment assistant. For each candidate below, write 1-3 concise sentences explaining why they match the employer's search. Be specific and factual. Do not use filler phrases like "great fit" or "ideal candidate". Start directly with what makes them relevant.

Employer search: "${query}"

${candidateBlock}

Respond with ONLY a JSON array. No markdown, no explanation, no extra text:
[{"id": <number>, "explanation": "<1-2 sentences>"}]`;

  const raw = await callGeminiMonitored({
    prompt,
    feature: "MATCH_EXPLAINER",
    endpoint: "lib/gemini/matchExplainer",
    userId: context?.userId,
    companyId: context?.companyId,
  });
  if (!raw) return results;

  // Strip markdown fences if Gemini wraps the response anyway
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: { id: number; explanation: string }[];
  try {
    parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return results;
  } catch {
    // Attempt to salvage partial JSON — extract any valid objects
    const matches = [...cleaned.matchAll(/\{\s*"id"\s*:\s*(\d+)\s*,\s*"explanation"\s*:\s*"([^"]+)"\s*\}/g)];
    parsed = matches.map((m) => ({ id: Number(m[1]), explanation: m[2] }));
    if (parsed.length === 0) return results;
  }

  const validIds = new Set(candidates.map((c) => c.id));
  for (const entry of parsed) {
    if (
      typeof entry.id === "number" &&
      typeof entry.explanation === "string" &&
      entry.explanation.length >= 10 &&
      validIds.has(entry.id)
    ) {
      // Trim to 2 sentences max as a safety net (split on sentence end punctuation followed by whitespace to avoid splitting decimals like 6.3)
      const sentences = entry.explanation.split(/(?<=[.!?])\s+/).filter(Boolean);
      const trimmed = sentences.slice(0, 2).join(" ").trim() || entry.explanation.slice(0, 200);
      results.set(entry.id, trimmed);
    }
  }

  return results;
}

/**
 * Generate a single candidate match explanation by wrapping batch explainer.
 */
export async function generateMatchExplanation(
  query: string,
  candidate: ExplainCandidate,
  context?: { userId?: number; companyId?: number }
): Promise<string | null> {
  if (!query || !candidate) return null;
  const resMap = await generateBatchExplanations(query, [{ ...candidate, id: 1 }], context);
  return resMap.get(1) ?? null;
}

/**
 * Generate a candidate role suitability summary when no search query is present (browse mode).
 * Suggests top 1-2 suited roles and core background strength in 1-2 sentences.
 */
export async function generateCandidateSuitability(
  candidate: ExplainCandidate,
  context?: { userId?: number; companyId?: number }
): Promise<string | null> {
  if (!candidate) return null;

  const prompt = `You are a talent recruitment specialist. Based on the candidate profile below, identify the top 1-2 job roles they are most qualified for.
Write 1-2 concise, factual sentences in this format: "Best suited for [Role Title(s)]. [1 concise sentence highlighting their core technical or practical strengths]."
Do not use filler phrases like "great fit" or "ideal candidate". Be direct and professional.

Candidate Profile:
Name: ${candidate.name}
Title: ${candidate.title ?? "Not specified"}
Skills: ${candidate.skills.slice(0, 10).join(", ") || "None listed"}
Experience: ${candidate.experience_years} year${candidate.experience_years !== 1 ? "s" : ""}
Summary: ${(candidate.summary ?? "").slice(0, 200)}

Respond with ONLY the 1-2 sentences of text. No markdown, no quotes, no extra headings.`;

  const raw = await callGeminiMonitored({
    prompt,
    feature: "MATCH_EXPLAINER",
    endpoint: "lib/gemini/matchExplainer/suitability",
    userId: context?.userId,
    companyId: context?.companyId,
    timeoutMs: 4000,
  });

  if (!raw) return null;

  const cleaned = raw.replace(/^["']|["']$/g, "").trim();
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, 2).join(" ").trim() || cleaned.slice(0, 220);
}
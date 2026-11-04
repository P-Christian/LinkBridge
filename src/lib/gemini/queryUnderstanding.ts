// src/lib/gemini/queryUnderstanding.ts

import { callGeminiMonitored } from "./geminiMonitoring";

export interface GeminiQueryIntent {
  resolved_role: string | null;
  inferred_skills: string[];
  experience_hint: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

const FALLBACK: GeminiQueryIntent = {
  resolved_role: null,
  inferred_skills: [],
  experience_hint: null,
  confidence: "LOW",
};

/**
 * Expand a natural-language search query into structured intent.
 * Only called when the query looks like a full sentence (contains spaces and
 * is longer than 15 characters), to avoid unnecessary API calls for simple
 * keyword searches like "web developer".
 */
export async function expandQueryWithGemini(
  rawQuery: string,
  context?: { userId?: number; companyId?: number }
): Promise<GeminiQueryIntent> {
  if (!rawQuery || rawQuery.trim().length === 0) return FALLBACK;

  const prompt = `You are a recruitment search assistant.

Given this employer search query: "${rawQuery.trim()}"

Analyze the query and return ONLY a valid JSON object (no markdown, no explanation) with these fields:
- resolved_role: the most specific canonical job title this maps to (string or null)
- inferred_skills: array of relevant technical skills implied by the query (max 8 skills)
- experience_hint: seniority level if implied — one of "entry", "mid", "senior", "manager", or null
- confidence: "HIGH" if clearly a role/skill search, "MEDIUM" if vague, "LOW" if unrelated to jobs

Examples:
Query: "I need someone who builds React apps"
Response: {"resolved_role":"React Developer","inferred_skills":["React","JavaScript","TypeScript"],"experience_hint":null,"confidence":"HIGH"}

Query: "web developer"
Response: {"resolved_role":"Web Developer","inferred_skills":["HTML","CSS","JavaScript"],"experience_hint":null,"confidence":"HIGH"}

Query: "senior backend engineer with 5 years"
Response: {"resolved_role":"Backend Engineer","inferred_skills":["Node.js","REST API","SQL"],"experience_hint":"senior","confidence":"HIGH"}

Now process: "${rawQuery.trim()}"`;

  const raw = await callGeminiMonitored({
    prompt,
    feature: "QUERY_UNDERSTANDING",
    endpoint: "lib/gemini/queryUnderstanding",
    userId: context?.userId,
    companyId: context?.companyId,
  });
  if (!raw) return FALLBACK;

  try {
    // Extract JSON block from response (handles cases with stray text)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return FALLBACK;
    const parsed = JSON.parse(jsonMatch[0]) as Partial<GeminiQueryIntent>;

    return {
      resolved_role: typeof parsed.resolved_role === "string" ? parsed.resolved_role : null,
      inferred_skills: Array.isArray(parsed.inferred_skills)
        ? parsed.inferred_skills.filter((s): s is string => typeof s === "string").slice(0, 8)
        : [],
      experience_hint:
        typeof parsed.experience_hint === "string" ? parsed.experience_hint : null,
      confidence: (["HIGH", "MEDIUM", "LOW"] as const).includes(
        parsed.confidence as "HIGH" | "MEDIUM" | "LOW"
      )
        ? (parsed.confidence as "HIGH" | "MEDIUM" | "LOW")
        : "LOW",
    };
  } catch {
    return FALLBACK;
  }
}

/** Determine if a query should be sent to Gemini for understanding.
 *  Simple single-word or known-role queries skip Gemini for cost savings. */
export function shouldExpandWithGemini(query: string): boolean {
  const trimmed = query.trim();
  // Trigger Gemini for longer or sentence-like queries
  const wordCount = trimmed.split(/\s+/).length;
  return wordCount >= 2 || trimmed.length > 12;
}

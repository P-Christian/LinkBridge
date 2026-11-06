// src/lib/gemini/campusMatchExplainer.ts
// Generates a structured AI explanation for a campus match result.
//
// Architectural guarantee:
// • Gemini receives structured evidence + deterministic gaps — NOT raw DB records.
// • Gemini CANNOT modify the score.
// • Gemini CANNOT create new gaps (it may only explain the pre-determined ones).
// • Output is validated before being returned; any non-conforming response returns null.

import { callGeminiMonitored } from "./geminiMonitoring";
import {
  CampusMatchResult,
  CampusMatchExplanation,
  CandidateEvidenceLevel,
} from "@/modules/matching-engine/campus/types";

interface ExplainerContext {
  userId?: number;
  companyId?: number;
}

/**
 * Builds a tightly scoped prompt that includes only structured evidence.
 * Raw database records, student personal data, and scores are excluded.
 */
function buildPrompt(result: CampusMatchResult, jobTitle: string): string {
  const curriculumLabels = result.evidence.curriculum.map((e) => e.label).join(", ") || "None identified";
  const verifiedSkills = result.evidence.verifiedSkills.map((e) => e.label).join(", ") || "None — student has not registered";
  const experience = result.evidence.experience.map((e) => e.label).join(", ") || "No work experience on record";

  const gapLines = result.gaps
    .map((g) => {
      const statusLabel =
        g.status === "NOT_EVIDENCED"
          ? "No evidence available"
          : g.status === "NOT_MATCHED"
            ? "Not matched in candidate data"
            : "Hard requirement not satisfied";
      return `- ${g.requirementLabel} (${g.type}): ${statusLabel}`;
    })
    .join("\n") || "None";

  return `You are a campus recruitment assistant. Provide a structured explanation of why this academic candidate may or may not be a match for the job posting.

IMPORTANT RULES:
1. You MUST NOT change or comment on the match score. It has already been determined by the system.
2. You MUST NOT add new gaps that are not already listed in the "Deterministic Gaps" section below.
3. You MUST distinguish between inferred curriculum competencies (labeled as "Curriculum Exposure") and verified skills.
4. Curriculum competencies are INFERRED from the student's degree program — they are NOT verified skills.
5. Be honest and factual. Do not use phrases like "great fit" or "ideal candidate".

JOB: ${jobTitle}

CANDIDATE EVIDENCE:
- Inferred Curriculum Competencies (from degree program, NOT verified): ${curriculumLabels}
- Verified Skills (from LinkBridge profile): ${verifiedSkills}
- Work Experience: ${experience}

DETERMINISTIC GAPS (explain these only — do not invent new ones):
${gapLines}

Respond with ONLY this JSON object. No markdown, no extra text:
{
  "summary": "<1-2 sentences describing the match context>",
  "strengths": ["<specific alignment point>", "..."],
  "inferredCompetencies": ["<competency from curriculum>", "..."],
  "verifiedSkillsSummary": ["<verified skill>", "..."],
  "gapAnalysis": ["<explanation of each provided gap>", "..."],
  "confidence": "${result.evidenceLevel}"
}`;
}

/**
 * Validates that the Gemini response conforms to the expected schema.
 * Returns null if the response cannot be safely used.
 */
function validateExplanation(
  raw: unknown,
  evidenceLevel: CandidateEvidenceLevel
): CampusMatchExplanation | null {
  if (typeof raw !== "object" || raw === null) return null;

  const obj = raw as Record<string, unknown>;

  const summary = typeof obj.summary === "string" ? obj.summary.trim() : null;
  if (!summary) return null;

  const strengths = Array.isArray(obj.strengths)
    ? obj.strengths.filter((s): s is string => typeof s === "string")
    : [];

  const inferredCompetencies = Array.isArray(obj.inferredCompetencies)
    ? obj.inferredCompetencies.filter((s): s is string => typeof s === "string")
    : [];

  const verifiedSkillsSummary = Array.isArray(obj.verifiedSkillsSummary)
    ? obj.verifiedSkillsSummary.filter((s): s is string => typeof s === "string")
    : [];

  const gapAnalysis = Array.isArray(obj.gapAnalysis)
    ? obj.gapAnalysis.filter((s): s is string => typeof s === "string")
    : [];

  return {
    summary,
    strengths,
    inferredCompetencies,
    verifiedSkillsSummary,
    gapAnalysis,
    confidence: evidenceLevel,
  };
}

/**
 * Generates a structured Gemini explanation for a campus match result.
 * Returns null gracefully on any failure — the deterministic result is always preserved.
 */
export async function generateCampusMatchExplanation(
  result: CampusMatchResult,
  jobTitle: string,
  context?: ExplainerContext
): Promise<CampusMatchExplanation | null> {
  // Only explain eligible candidates with a meaningful score
  if (!result.eligibility.eligible || result.score === 0) return null;

  const prompt = buildPrompt(result, jobTitle);

  const raw = await callGeminiMonitored({
    prompt,
    feature: "CAMPUS_MATCH_EXPLAINER",
    endpoint: "lib/gemini/campusMatchExplainer",
    userId: context?.userId,
    companyId: context?.companyId,
  });

  if (!raw) return null;

  // Strip markdown fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.warn("[campusMatchExplainer] Failed to parse Gemini JSON response.");
    return null;
  }

  return validateExplanation(parsed, result.evidenceLevel);
}

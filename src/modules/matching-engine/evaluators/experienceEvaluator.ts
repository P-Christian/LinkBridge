// src/modules/matching-engine/evaluators/experienceEvaluator.ts

import { NormalizedProfile } from "../types/profileTypes";
import { MatchContext } from "../types/matchTypes";
import { EvaluatorResult, EvidenceItem } from "../types/evaluatorTypes";

function cleanTitle(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .trim()
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

export function evaluateExperience(profile: NormalizedProfile, context: MatchContext, weight: number): EvaluatorResult {
  const maxScore = 30;
  const rawKeyword = context.keyword?.trim() ?? "";
  const keyword = cleanTitle(rawKeyword);
  const taxonomy = context.taxonomyContext;

  const expandedAliases = (taxonomy?.expanded_aliases ?? []).map((a) => cleanTitle(a));
  if (keyword) expandedAliases.push(keyword);
  if (taxonomy?.resolved_role) expandedAliases.push(cleanTitle(taxonomy.resolved_role));

  // Add default domain terms if searching web / fullstack / frontend / backend
  if (keyword.includes("web") || keyword.includes("full stack") || keyword.includes("frontend") || keyword.includes("backend")) {
    expandedAliases.push("web developer");
    expandedAliases.push("full stack developer");
    expandedAliases.push("frontend developer");
    expandedAliases.push("backend developer");
    expandedAliases.push("software engineer");
    expandedAliases.push("developer");
  }

  let relevantMonths = 0;
  let totalMonths = 0;
  const matchedRoles: string[] = [];

  for (const work of profile.workHistory) {
    totalMonths += Math.round(work.years * 12);
    const titleClean = cleanTitle(work.title);
    const descClean = cleanTitle(work.description);

    const isMatch = expandedAliases.some(
      (alias) =>
        alias.length > 2 &&
        (titleClean.includes(alias) ||
          alias.includes(titleClean) ||
          descClean.includes(alias) ||
          (alias.includes("web") && titleClean.includes("web")) ||
          (alias.includes("developer") && titleClean.includes("developer")) ||
          (alias.includes("full stack") && titleClean.includes("full stack")))
    );

    if (isMatch || !keyword) {
      relevantMonths += Math.round(work.years * 12);
      matchedRoles.push(work.title);
    }
  }

  const clampedRelevantMonths = Math.min(relevantMonths, totalMonths);
  const relevantYears = Number((clampedRelevantMonths / 12).toFixed(1));
  const totalYears = Number((totalMonths / 12).toFixed(1));

  // Ideal experience years (default 5.0 yrs or context required)
  const idealYears = context.requiredExperience && context.requiredExperience > 0 ? context.requiredExperience : 5.0;

  // Smooth experience curve: min(relevantYears / idealYears, 1.0) * maxScore
  const rawScore = Number((Math.min(relevantYears / idealYears, 1.0) * maxScore).toFixed(1));

  const evidence: EvidenceItem[] = [];
  if (relevantYears > 0) {
    evidence.push({
      type: "EXPERIENCE",
      label: "Relevant Experience",
      value: `${relevantYears} yrs relevant experience (${matchedRoles.slice(0, 2).join(", ")})`,
      scoreContribution: rawScore,
    });
  }

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (relevantYears >= 3) {
    strengths.push(`${relevantYears} years of relevant experience in matching roles`);
  } else if (relevantYears > 0) {
    strengths.push(`${relevantYears} years of relevant experience`);
  } else {
    weaknesses.push("Limited or no direct experience listed in matching roles");
  }

  return {
    factor: "EXPERIENCE",
    label: "Relevant Experience",
    score: rawScore,
    maxScore,
    weight,
    evidence,
    strengths,
    weaknesses,
    explanationCode: "EXPERIENCE_CALCULATED",
    explanationMessage: `${relevantYears} yrs relevant experience out of ${totalYears} yrs total.`,
  };
}

// src/modules/matching-engine/engine/scorer.ts

import { EvaluatorResult } from "../types/evaluatorTypes";
import { BreakdownSection, MatchTraceItem, MatchContext, MatchMode } from "../types/matchTypes";

export interface ScoringOutput {
  compatibilityScore: number;
  sections: BreakdownSection[];
  trace: MatchTraceItem[];
}

export function calculateNormalizedScore(
  evaluatorResults: EvaluatorResult[],
  context: MatchContext
): ScoringOutput {
  let weightedSum = 0;
  let totalWeights = 0;
  const sections: BreakdownSection[] = [];
  const trace: MatchTraceItem[] = [];

  for (const res of evaluatorResults) {
    if (res.weight <= 0) continue;

    // evaluator score contribution normalized to weight
    const scoreFraction = res.maxScore > 0 ? Math.min(res.score / res.maxScore, 1.0) : 0;
    const pointsContribution = Number((scoreFraction * res.weight).toFixed(1));

    weightedSum += pointsContribution;
    totalWeights += res.weight;

    sections.push({
      label: res.label,
      score: pointsContribution,
      max: res.weight,
      type: res.label.toLowerCase().includes("bonus") ? "bonus" : "score",
    });

    trace.push({
      factor: res.factor,
      result: res.explanationMessage,
      points: pointsContribution,
    });
  }

  const isSearchMode =
    context.mode !== MatchMode.BROWSE &&
    (Boolean(context.keyword?.trim()) || Boolean(context.requestedSkills && context.requestedSkills.length > 0));

  const roleScore = evaluatorResults.find((r) => r.factor === "ROLE")?.score ?? 0;
  const skillScore = evaluatorResults.find((r) => r.factor === "SKILLS")?.score ?? 0;
  const expScore = evaluatorResults.find((r) => r.factor === "EXPERIENCE")?.score ?? 0;

  // In search mode, if candidate has 0 relevant skills, 0 role similarity, and 0 relevant experience,
  // they have ZERO core relevance — secondary bonuses (generic education/certs) must not produce a false positive match.
  const hasZeroCoreRelevance = isSearchMode && roleScore === 0 && skillScore === 0 && expScore === 0;

  // Calculate raw normalized score (sum of evaluator point contributions)
  const rawNormalized = totalWeights > 0 ? (weightedSum / totalWeights) * 100 : 0;
  const compatibilityScore = hasZeroCoreRelevance ? 0 : Math.min(100, Math.round(rawNormalized));

  return {
    compatibilityScore,
    sections,
    trace,
  };
}


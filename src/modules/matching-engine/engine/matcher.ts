// src/modules/matching-engine/engine/matcher.ts

import { NormalizedProfile } from "../types/profileTypes";
import { MatchContext, MatchResult } from "../types/matchTypes";
import { SCORING_CONFIG, ENGINE_VERSION } from "../config/scoringConfig";
import { normalizeSearchQuery } from "../normalizers/queryNormalizer";

import { evaluateRole } from "../evaluators/roleEvaluator";
import { evaluateExperience } from "../evaluators/experienceEvaluator";
import { evaluateSkills } from "../evaluators/skillEvaluator";
import { evaluateEducation } from "../evaluators/educationEvaluator";
import { evaluateCertifications } from "../evaluators/certificationEvaluator";
import { evaluatePortfolio } from "../evaluators/portfolioEvaluator";

import { calculateNormalizedScore } from "./scorer";
import { calculateRankingScore } from "./ranking";
import { calculateConfidence } from "../confidence/confidenceCalculator";
import { buildExplanation } from "../explanation/explanationBuilder";
import { collectEvidence } from "../explanation/evidenceBuilder";

export function runMatchingEngine(profile: NormalizedProfile, context: MatchContext): MatchResult {
  // Preprocessing: Query Understanding & Normalization Layer
  const enrichedContext = { ...context };

  if (context.keyword) {
    const normalizedQuery = normalizeSearchQuery(context.keyword, context.taxonomyContext);

    enrichedContext.mode = normalizedQuery.mode;
    enrichedContext.taxonomyContext = {
      keyword: context.keyword,
      resolved_role: normalizedQuery.resolvedRole,
      resolved_role_id: normalizedQuery.resolvedRoleId,
      category_code: normalizedQuery.categoryCode,
      category_name: normalizedQuery.categoryName,
      matched_alias: normalizedQuery.matchedAlias,
      match_weight: normalizedQuery.matchWeight,
      expanded_aliases: normalizedQuery.expandedAliases,
    };
  }

  const modeWeights = SCORING_CONFIG[enrichedContext.mode];

  // Pipeline execution
  const roleRes = evaluateRole(profile, enrichedContext, modeWeights.role);
  const expRes = evaluateExperience(profile, enrichedContext, modeWeights.experience);
  const skillRes = evaluateSkills(profile, enrichedContext, modeWeights.skills);
  const eduRes = evaluateEducation(profile, enrichedContext, modeWeights.education);
  const certRes = evaluateCertifications(profile, enrichedContext, modeWeights.certifications);
  const portRes = evaluatePortfolio(profile, enrichedContext, modeWeights.portfolio);

  const evaluatorResults = [roleRes, expRes, skillRes, eduRes, certRes, portRes];

  // 1. Compatibility Scorer
  const scoringOutput = calculateNormalizedScore(evaluatorResults, enrichedContext);

  // 2. Internal Ranking Scorer
  const rankingScore = calculateRankingScore(scoringOutput.compatibilityScore, profile, enrichedContext.keyword, enrichedContext.layer1Score);

  // 3. Signal-based Confidence Rating
  const confidence = calculateConfidence(profile);

  // 4. Evidence Items Collector
  const evidence = collectEvidence(evaluatorResults);

  // 5. Structured Explanation Builder
  const explanation = buildExplanation(evaluatorResults, enrichedContext, scoringOutput.compatibilityScore);

  return {
    candidateId: profile.id,
    mode: enrichedContext.mode,
    compatibility: {
      score: scoringOutput.compatibilityScore,
      sections: scoringOutput.sections,
    },
    ranking: {
      score: rankingScore,
    },
    confidence,
    evidence,
    explanation,
    trace: scoringOutput.trace,
    engineVersion: ENGINE_VERSION,
  };
}

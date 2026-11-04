// src/modules/matching-engine/evaluators/roleEvaluator.ts

import { NormalizedProfile } from "../types/profileTypes";
import { MatchContext } from "../types/matchTypes";
import { EvaluatorResult, EvidenceItem } from "../types/evaluatorTypes";
import { ROLE_SIMILARITY_SCORES } from "../config/scoringConfig";
import { cleanText } from "../normalizers/textNormalizer";
import { computeJaccardSimilarity } from "../normalizers/tokenExtractor";
import { matchCandidateName } from "../retrieval/nameMatcher";
import { matchSchool } from "../retrieval/schoolMatcher";

export function evaluateRole(profile: NormalizedProfile, context: MatchContext, weight: number): EvaluatorResult {
  const maxScore = 45;
  const rawKeyword = context.keyword?.trim() ?? "";
  const keyword = cleanText(rawKeyword);
  const taxonomy = context.taxonomyContext;
  const aliasWeight = taxonomy?.match_weight ?? 1.0;
  const resolvedRoleClean = cleanText(taxonomy?.resolved_role);

  const expandedAliases = (taxonomy?.expanded_aliases ?? []).map(cleanText);
  if (resolvedRoleClean) expandedAliases.push(resolvedRoleClean);
  if (keyword) expandedAliases.push(keyword);

  if (!keyword && !resolvedRoleClean) {
    return {
      factor: "ROLE",
      label: "Role Similarity",
      score: 0,
      maxScore,
      weight,
      evidence: [],
      strengths: [],
      weaknesses: [],
      explanationCode: "NO_KEYWORD",
      explanationMessage: "No role search keyword provided.",
    };
  }

  const profileTitlesClean = profile.titles.map(cleanText);

  // 1. Direct Title / Alias Match (Exact, Substring, or Stemmed Token Overlap >= 0.65)
  const exactMatchIndex = profileTitlesClean.findIndex((t) => {
    if (!t) return false;
    if (t === keyword || t === resolvedRoleClean) return true;
    if (keyword.length > 2 && t.includes(keyword)) return true;
    if (t.length > 2 && keyword.includes(t)) return true;
    if (resolvedRoleClean.length > 2 && (t.includes(resolvedRoleClean) || resolvedRoleClean.includes(t))) return true;
    return expandedAliases.some((alias) => alias.length > 2 && (t.includes(alias) || alias.includes(t) || computeJaccardSimilarity(t, alias) >= 0.65));
  });

  if (exactMatchIndex !== -1) {
    const matchedOriginalTitle = profile.titles[exactMatchIndex] || profileTitlesClean[exactMatchIndex];
    const rawScore = Math.round(ROLE_SIMILARITY_SCORES.exact_title * aliasWeight); // 45 pts

    const evidence: EvidenceItem[] = [
      {
        type: "ROLE",
        label: "Title Match",
        value: `Matched search '${rawKeyword}' with candidate title '${matchedOriginalTitle}'`,
        scoreContribution: rawScore,
      },
    ];

    return {
      factor: "ROLE",
      label: "Role Similarity",
      score: rawScore,
      maxScore,
      weight,
      evidence,
      strengths: [`Direct title match for '${rawKeyword}' (${matchedOriginalTitle})`],
      weaknesses: [],
      explanationCode: "ROLE_EXACT_MATCH",
      explanationMessage: `Direct title match for '${rawKeyword}' (${matchedOriginalTitle}).`,
    };
  }

  // 2. Data-Driven Dynamic Category Match
  // Compare query category name/code against candidate titles or summary context
  const targetCategoryClean = cleanText(taxonomy?.category_name || taxonomy?.category_code);
  const isCategoryMatch = profileTitlesClean.some((t) => {
    if (!t || !targetCategoryClean) return false;
    return (
      t.includes(targetCategoryClean) ||
      targetCategoryClean.includes(t) ||
      computeJaccardSimilarity(t, targetCategoryClean) >= 0.5
    );
  });

  if (isCategoryMatch) {
    const rawScore = ROLE_SIMILARITY_SCORES.same_category; // 32 pts
    const evidence: EvidenceItem[] = [
      {
        type: "ROLE",
        label: "Category Match",
        value: `Matched category '${taxonomy?.category_name}' for candidate title`,
        scoreContribution: rawScore,
      },
    ];

    return {
      factor: "ROLE",
      label: "Role Similarity",
      score: rawScore,
      maxScore,
      weight,
      evidence,
      strengths: [`Candidate role falls under matching domain '${taxonomy?.category_name}'`],
      weaknesses: [`'${rawKeyword}' is a broader role category`],
      explanationCode: "ROLE_CATEGORY_MATCH",
      explanationMessage: `Matched role category '${taxonomy?.category_name}'.`,
    };
  }

  // 3. Text / Summary Match
  const summaryClean = cleanText(profile.summary);
  const summaryMatch = expandedAliases.some((alias) => alias.length > 2 && summaryClean.includes(alias));
  if (summaryMatch) {
    const rawScore = ROLE_SIMILARITY_SCORES.summary;
    return {
      factor: "ROLE",
      label: "Role Similarity",
      score: rawScore,
      maxScore,
      weight,
      evidence: [
        {
          type: "ROLE",
          label: "Summary Keyword Match",
          value: `Mentioned search keyword in profile summary`,
          scoreContribution: rawScore,
        },
      ],
      strengths: ["Role keywords present in profile summary"],
      weaknesses: ["Role title does not explicitly match search keyword"],
      explanationCode: "ROLE_SUMMARY_MATCH",
      explanationMessage: "Matched search keyword in profile summary.",
    };
  }

  // 4. Candidate Name Match (High Priority for explicit talent lookups)
  const nameMatch = matchCandidateName(rawKeyword, profile.name);
  if (nameMatch.matched) {
    const rawScore = 45;
    return {
      factor: "ROLE",
      label: "Role Similarity",
      score: rawScore,
      maxScore,
      weight,
      evidence: [
        {
          type: "ROLE",
          label: "Candidate Name Match",
          value: `Direct candidate name match: '${profile.name}'`,
          scoreContribution: rawScore,
        },
      ],
      strengths: [`Direct name match for candidate '${profile.name}'`],
      weaknesses: [],
      explanationCode: "ROLE_NAME_MATCH",
      explanationMessage: `Direct name match for candidate '${profile.name}'.`,
    };
  }

  // 5. Institution / School Match
  for (const edu of profile.education) {
    if (edu.school) {
      const sMatch = matchSchool(rawKeyword, edu.school);
      if (sMatch.matched) {
        const rawScore = 38;
        return {
          factor: "ROLE",
          label: "Role Similarity",
          score: rawScore,
          maxScore,
          weight,
          evidence: [
            {
              type: "ROLE",
              label: "Institution Match",
              value: `Candidate attended '${edu.school}' matching search '${rawKeyword}'`,
              scoreContribution: rawScore,
            },
          ],
          strengths: [`Candidate attended searched institution: ${edu.school}`],
          weaknesses: [],
          explanationCode: "ROLE_INSTITUTION_MATCH",
          explanationMessage: `Matched candidate institution '${edu.school}' with search query '${rawKeyword}'.`,
        };
      }
    }
  }

  return {
    factor: "ROLE",
    label: "Role Similarity",
    score: 0,
    maxScore,
    weight,
    evidence: [],
    strengths: [],
    weaknesses: [`Candidate title does not match '${rawKeyword}'`],
    explanationCode: "ROLE_WEAK_MATCH",
    explanationMessage: "No direct title or taxonomy match found for search term.",
  };
}

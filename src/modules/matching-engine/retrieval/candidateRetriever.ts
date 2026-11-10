import { NormalizedProfile } from "../types/profileTypes";
import { AnalyzedQuery } from "./queryAnalyzer";
import { CandidateEligibility, EligibilityReason, MatchMode, ResolvedTaxonomyContext } from "../types/matchTypes";
import { cleanText } from "../normalizers/textNormalizer";
import { computeJaroWinkler } from "./fuzzyMatcher";
import { computeTokenOverlapScore } from "./tokenMatcher";
import { matchCandidateName } from "./nameMatcher";
import { matchSchool } from "./schoolMatcher";

export interface CandidateRetrievalResult {
  candidate: NormalizedProfile;
  retrievalScore: number; // 0 - 100 internal score
  retrievalReason: string;
  eligibility: CandidateEligibility;
}

export function retrieveCandidatePool(
  profiles: NormalizedProfile[],
  analyzedQuery: AnalyzedQuery,
  taxonomyContext?: ResolvedTaxonomyContext | null,
  _minRetrievalThreshold: number = 0,
  rawSearchKeyword?: string,
  effectiveSkills?: string[],
  matchMode?: MatchMode
): CandidateRetrievalResult[] {
  const { cleanedQuery } = analyzedQuery;
  const effectiveQuery = cleanText(rawSearchKeyword) || cleanedQuery;

  const isBrowseMode =
    matchMode === MatchMode.BROWSE ||
    (!cleanedQuery && !effectiveQuery && (!effectiveSkills || effectiveSkills.length === 0));

  // If browse mode, retrieve all candidates with BROWSE_MODE eligibility
  if (isBrowseMode) {
    return profiles.map((p) => ({
      candidate: p,
      retrievalScore: 100,
      retrievalReason: "BROWSE_ALL",
      eligibility: {
        eligible: true,
        reason: "BROWSE_MODE",
        score: 100,
      },
    }));
  }

  const expandedAliases = (taxonomyContext?.expanded_aliases ?? []).map(cleanText);
  if (taxonomyContext?.resolved_role) expandedAliases.push(cleanText(taxonomyContext.resolved_role));
  expandedAliases.push(cleanedQuery);
  if (effectiveQuery && !expandedAliases.includes(effectiveQuery)) {
    expandedAliases.push(effectiveQuery);
  }

  const effectiveSkillsClean = (effectiveSkills ?? []).map(cleanText).filter(Boolean);

  const results: CandidateRetrievalResult[] = [];

  for (const candidate of profiles) {
    let bestScore = 0;
    let primaryReason = "NO_MATCH";
    let eligibilityReason: EligibilityReason = "NO_RELEVANCE";
    let isEligible = false;
    let matchedRoleSkillCount = 0;

    const recordMatch = (score: number, reason: string, elReason: EligibilityReason) => {
      if (score > bestScore) {
        bestScore = score;
        primaryReason = reason;
      }
      if (!isEligible || (elReason === "DIRECT_ROLE_MATCH" && eligibilityReason !== "DIRECT_ROLE_MATCH")) {
        eligibilityReason = elReason;
        isEligible = true;
      }
    };

    // 1. Match against Candidate Name (High Priority)
    const nameMatch = matchCandidateName(effectiveQuery, candidate.name);
    if (nameMatch.matched) {
      recordMatch(nameMatch.score, `${nameMatch.reason} (${candidate.name})`, "NAME_MATCH");
    }

    // 2. Match against Candidate Education (School & Course)
    for (const edu of candidate.education) {
      if (edu.school) {
        const schoolMatch = matchSchool(effectiveQuery, edu.school);
        if (schoolMatch.matched) {
          recordMatch(schoolMatch.score, `${schoolMatch.reason} (${edu.school})`, "EDUCATION_MATCH");
        }
      }
      if (edu.course) {
        const courseClean = cleanText(edu.course);
        if (
          courseClean.includes(effectiveQuery) ||
          computeTokenOverlapScore(effectiveQuery, courseClean) >= 0.6
        ) {
          recordMatch(75, `COURSE_MATCH (${edu.course})`, "EDUCATION_MATCH");
        }
      }
    }

    const candidateTitlesClean = candidate.titles.map(cleanText);
    const candidateSkillsClean = candidate.skills.map(cleanText);
    const headlineClean = candidate.headline ? cleanText(candidate.headline) : "";
    const currentWork = candidate.workHistory.find((w) => w.isCurrent);
    const currentTitleClean = currentWork?.title ? cleanText(currentWork.title) : "";

    // 3. Character & Token Match against Candidate Titles
    for (const title of candidateTitlesClean) {
      if (!title) continue;

      const isCurrentOrHeadline =
        (headlineClean && title.includes(headlineClean)) ||
        (currentTitleClean && title.includes(currentTitleClean));

      // Exact substring or token match
      const tokenOverlap = computeTokenOverlapScore(cleanedQuery, title);
      if (tokenOverlap > 0) {
        const score = Math.round(tokenOverlap * 100);
        const reason: EligibilityReason = isCurrentOrHeadline ? "DIRECT_ROLE_MATCH" : "EXPERIENCE_MATCH";
        recordMatch(score, `TITLE_TOKEN_MATCH (${title})`, reason);
      }

      // Typo handling via Jaro-Winkler character similarity
      const jaroSim = computeJaroWinkler(cleanedQuery, title);
      if (jaroSim >= 0.75) {
        const score = Math.round(jaroSim * 90);
        const reason: EligibilityReason = isCurrentOrHeadline ? "DIRECT_ROLE_MATCH" : "EXPERIENCE_MATCH";
        recordMatch(score, `TYPO_FUZZY_MATCH (${title})`, reason);
      }
    }

    // 4. Match against DB Expanded Taxonomy Aliases
    for (const alias of expandedAliases) {
      if (!alias || alias.length < 3) continue;

      for (const title of candidateTitlesClean) {
        const aliasOverlap = computeTokenOverlapScore(alias, title);
        if (aliasOverlap >= 0.6) {
          const score = Math.round(aliasOverlap * 85);
          recordMatch(score, `ALIAS_TAXONOMY_MATCH (${alias})`, "RELATED_ROLE_MATCH");
        }
      }
    }

    // 5. Match against Candidate Skills
    for (const skill of candidateSkillsClean) {
      if (!skill) continue;

      // A. Match against effective role skills (e.g. "menu engineering", "food cost control" for Chef)
      if (effectiveSkillsClean.length > 0) {
        if (effectiveSkillsClean.includes(skill)) {
          matchedRoleSkillCount++;
          recordMatch(75, `SKILL_ROLE_MATCH (${skill})`, "SKILL_MATCH");
        } else {
          // Token overlap with role skills for multi-word skills
          const skillTokens = skill.split(/\s+/).filter(Boolean);
          for (const roleSkill of effectiveSkillsClean) {
            const roleTokens = roleSkill.split(/\s+/).filter(Boolean);
            if (roleTokens.length > 1 && skillTokens.length > 1) {
              const overlap = computeTokenOverlapScore(skill, roleSkill);
              if (overlap >= 0.7) {
                matchedRoleSkillCount++;
                recordMatch(70, `SKILL_ROLE_MATCH (${skill})`, "SKILL_MATCH");
              }
            }
          }
        }
      }

      // B. Match directly against search query or aliases
      if (skill === cleanedQuery || skill === effectiveQuery) {
        recordMatch(80, `SKILL_EXACT_MATCH (${skill})`, "SKILL_MATCH");
      } else if (skill.length >= 3) {
        // Multi-char skills: token/word containment (avoids single/double letters like 'c' matching 'chef')
        const queryTokens = cleanedQuery.split(/\s+/).filter(Boolean);
        const skillTokens = skill.split(/\s+/).filter(Boolean);

        const isQueryTokenInSkill = queryTokens.some((qt) => qt.length >= 3 && skillTokens.includes(qt));
        const isSkillTokenInQuery = skillTokens.some((st) => st.length >= 3 && queryTokens.includes(st));

        if (isQueryTokenInSkill || isSkillTokenInQuery) {
          recordMatch(70, `SKILL_MATCH (${skill})`, "SKILL_MATCH");
        }
      }
    }

    // 6. Match against Profile Summary & Work Experience Descriptions
    const summaryClean = cleanText(candidate.summary);
    if (summaryClean) {
      for (const alias of expandedAliases) {
        if (alias.length > 3 && summaryClean.includes(alias)) {
          recordMatch(50, `SUMMARY_MATCH (${alias})`, "EXPERIENCE_MATCH");
        }
      }
    }

    for (const w of candidate.workHistory) {
      if (w.description) {
        const descClean = cleanText(w.description);
        if (descClean) {
          for (const alias of expandedAliases) {
            if (alias.length > 3 && descClean.includes(alias)) {
              recordMatch(45, `EXPERIENCE_DESC_MATCH (${alias})`, "EXPERIENCE_MATCH");
            }
          }
        }
      }
    }

    // For role-based searches (where taxonomy resolved a canonical role):
    // A single incidental role skill without ANY title, education, or work experience match
    // is insufficient evidence of role relevance (prevents 0/45 role similarity, 0-yr exp profiles).
    if (
      isEligible &&
      (eligibilityReason as string) === "SKILL_MATCH" &&
      taxonomyContext?.resolved_role &&
      matchedRoleSkillCount < 2 &&
      candidate.workHistory.length === 0
    ) {
      isEligible = false;
      eligibilityReason = "NO_RELEVANCE";
    }

    const eligibility: CandidateEligibility = {
      eligible: isEligible,
      reason: isEligible ? eligibilityReason : "NO_RELEVANCE",
      score: bestScore,
    };

    // Retain candidates meeting threshold (default threshold is 0, retaining all profiles)
    if (bestScore >= _minRetrievalThreshold) {
      results.push({
        candidate,
        retrievalScore: bestScore,
        retrievalReason: primaryReason,
        eligibility,
      });
    }
  }

  // Sort candidate pool by Layer 1 retrieval score
  results.sort((a, b) => b.retrievalScore - a.retrievalScore);

  if (process.env.NODE_ENV !== "production") {
    const matched = results.filter((r) => r.eligibility.eligible);

    console.log(
      `[talent-search] Layer 1: ${profiles.length} profiles evaluated, ${results.length} retained ` +
        `(${matched.length} eligible, ${results.length - matched.length} excluded as NO_RELEVANCE)`
    );
  }

  return results;
}

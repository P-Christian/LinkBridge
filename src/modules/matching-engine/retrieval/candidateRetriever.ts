import { NormalizedProfile } from "../types/profileTypes";
import { AnalyzedQuery } from "./queryAnalyzer";
import { ResolvedTaxonomyContext } from "../types/matchTypes";
import { cleanText } from "../normalizers/textNormalizer";
import { computeJaroWinkler } from "./fuzzyMatcher";
import { computeTokenOverlapScore } from "./tokenMatcher";
import { matchCandidateName } from "./nameMatcher";
import { matchSchool } from "./schoolMatcher";

export interface CandidateRetrievalResult {
  candidate: NormalizedProfile;
  retrievalScore: number; // 0 - 100 internal score
  retrievalReason: string;
}

export function retrieveCandidatePool(
  profiles: NormalizedProfile[],
  analyzedQuery: AnalyzedQuery,
  taxonomyContext?: ResolvedTaxonomyContext | null,
  _minRetrievalThreshold: number = 0,
  rawSearchKeyword?: string,
  effectiveSkills?: string[]
): CandidateRetrievalResult[] {
  const { cleanedQuery } = analyzedQuery;
  const effectiveQuery = cleanText(rawSearchKeyword) || cleanedQuery;

  // If no query string, retrieve all candidates (Browse mode)
  if (!cleanedQuery && !effectiveQuery) {
    return profiles.map((p) => ({
      candidate: p,
      retrievalScore: 100,
      retrievalReason: "BROWSE_ALL",
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

    // 1. Match against Candidate Name (High Priority)
    const nameMatch = matchCandidateName(effectiveQuery, candidate.name);
    if (nameMatch.matched && nameMatch.score > bestScore) {
      bestScore = nameMatch.score;
      primaryReason = `${nameMatch.reason} (${candidate.name})`;
    }

    // 2. Match against Candidate Education (School & Course)
    for (const edu of candidate.education) {
      if (edu.school) {
        const schoolMatch = matchSchool(effectiveQuery, edu.school);
        if (schoolMatch.matched && schoolMatch.score > bestScore) {
          bestScore = schoolMatch.score;
          primaryReason = `${schoolMatch.reason} (${edu.school})`;
        }
      }
      if (edu.course) {
        const courseClean = cleanText(edu.course);
        if (
          courseClean.includes(effectiveQuery) ||
          computeTokenOverlapScore(effectiveQuery, courseClean) >= 0.6
        ) {
          const score = 75;
          if (score > bestScore) {
            bestScore = score;
            primaryReason = `COURSE_MATCH (${edu.course})`;
          }
        }
      }
    }

    const candidateTitlesClean = candidate.titles.map(cleanText);
    const candidateSkillsClean = candidate.skills.map(cleanText);

    // 3. Character & Token Match against Candidate Titles
    for (const title of candidateTitlesClean) {
      if (!title) continue;

      // Exact substring or token match
      const tokenOverlap = computeTokenOverlapScore(cleanedQuery, title);
      if (tokenOverlap > 0) {
        const score = Math.round(tokenOverlap * 100);
        if (score > bestScore) {
          bestScore = score;
          primaryReason = `TITLE_TOKEN_MATCH (${title})`;
        }
      }

      // Typo handling via Jaro-Winkler character similarity
      const jaroSim = computeJaroWinkler(cleanedQuery, title);
      if (jaroSim >= 0.75) {
        const score = Math.round(jaroSim * 90);
        if (score > bestScore) {
          bestScore = score;
          primaryReason = `TYPO_FUZZY_MATCH (${title})`;
        }
      }
    }

    // 4. Match against DB Expanded Taxonomy Aliases
    for (const alias of expandedAliases) {
      if (!alias || alias.length < 3) continue;

      for (const title of candidateTitlesClean) {
        const aliasOverlap = computeTokenOverlapScore(alias, title);
        if (aliasOverlap >= 0.6) {
          const score = Math.round(aliasOverlap * 85);
          if (score > bestScore) {
            bestScore = score;
            primaryReason = `ALIAS_TAXONOMY_MATCH (${alias})`;
          }
        }
      }
    }

    // 5. Match against Candidate Skills
    for (const skill of candidateSkillsClean) {
      if (!skill) continue;

      // A. Match against effective role skills (e.g. "menu engineering", "food cost control" for Chef)
      if (effectiveSkillsClean.length > 0) {
        if (effectiveSkillsClean.includes(skill)) {
          const score = 75;
          if (score > bestScore) {
            bestScore = score;
            primaryReason = `SKILL_ROLE_MATCH (${skill})`;
          }
        } else {
          // Token overlap with role skills for multi-word skills
          const skillTokens = skill.split(/\s+/).filter(Boolean);
          for (const roleSkill of effectiveSkillsClean) {
            const roleTokens = roleSkill.split(/\s+/).filter(Boolean);
            if (roleTokens.length > 1 && skillTokens.length > 1) {
              const overlap = computeTokenOverlapScore(skill, roleSkill);
              if (overlap >= 0.7) {
                const score = 70;
                if (score > bestScore) {
                  bestScore = score;
                  primaryReason = `SKILL_ROLE_MATCH (${skill})`;
                }
              }
            }
          }
        }
      }

      // B. Match directly against search query or aliases
      if (skill === cleanedQuery || skill === effectiveQuery) {
        const score = 80;
        if (score > bestScore) {
          bestScore = score;
          primaryReason = `SKILL_EXACT_MATCH (${skill})`;
        }
      } else if (skill.length >= 3) {
        // Multi-char skills: token/word containment (avoids single/double letters like 'c' matching 'chef')
        const queryTokens = cleanedQuery.split(/\s+/).filter(Boolean);
        const skillTokens = skill.split(/\s+/).filter(Boolean);

        const isQueryTokenInSkill = queryTokens.some((qt) => qt.length >= 3 && skillTokens.includes(qt));
        const isSkillTokenInQuery = skillTokens.some((st) => st.length >= 3 && queryTokens.includes(st));

        if (isQueryTokenInSkill || isSkillTokenInQuery) {
          const score = 70;
          if (score > bestScore) {
            bestScore = score;
            primaryReason = `SKILL_MATCH (${skill})`;
          }
        }
      }
    }

    // 6. Match against Profile Summary
    const summaryClean = cleanText(candidate.summary);
    if (summaryClean) {
      for (const alias of expandedAliases) {
        if (alias.length > 3 && summaryClean.includes(alias)) {
          const score = 50;
          if (score > bestScore) {
            bestScore = score;
            primaryReason = `SUMMARY_MATCH (${alias})`;
          }
        }
      }
    }

    // Retain candidates meeting threshold (default threshold is 0, retaining all profiles)
    if (bestScore >= _minRetrievalThreshold) {
      results.push({
        candidate,
        retrievalScore: bestScore,
        retrievalReason: primaryReason,
      });
    }
  }

  // Sort candidate pool by Layer 1 retrieval score
  results.sort((a, b) => b.retrievalScore - a.retrievalScore);

  // The retention line below names no candidate: the per-candidate breakdown used
  // to be printed here and was reprinted, with more signal, one layer later. It is
  // the caller's job now, and printing the same 35 people twice per search made the
  // trace unreadable rather than informative. The line also reports the threshold
  // that was actually applied rather than asserting that everything was kept.
  if (process.env.NODE_ENV !== "production") {
    const matched = results.filter((r) => r.retrievalScore > 0);

    console.log(
      `[talent-search] Layer 1: ${profiles.length} profiles evaluated, ${results.length} retained ` +
        `(threshold ${_minRetrievalThreshold}, ${matched.length} scored above 0)`
    );
  }

  return results;
}

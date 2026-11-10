// src/modules/matching-engine/retrieval/nameMatcher.ts

import { cleanText } from "../normalizers/textNormalizer";
import { computeJaroWinkler } from "./fuzzyMatcher";

export interface NameMatchResult {
  matched: boolean;
  score: number;
  reason: string;
}

export function matchCandidateName(query: string, candidateName: string): NameMatchResult {
  const queryClean = cleanText(query);
  const nameClean = cleanText(candidateName);
  if (!queryClean || !nameClean) {
    return { matched: false, score: 0, reason: "" };
  }

  // 1. Exact match
  if (queryClean === nameClean) {
    return { matched: true, score: 100, reason: "NAME_EXACT_MATCH" };
  }

  // 2. Space-stripped match (e.g. "delacruz" vs "dela cruz")
  const queryNoSpaces = queryClean.replace(/\s+/g, "");
  const nameNoSpaces = nameClean.replace(/\s+/g, "");
  if (queryNoSpaces && nameNoSpaces && queryNoSpaces === nameNoSpaces) {
    return { matched: true, score: 98, reason: "NAME_EXACT_MATCH" };
  }

  // 3. Token overlap match (e.g. searching "Juan" or "Dela Cruz" matches "Juan Dela Cruz")
  const queryTokens = queryClean.split(/\s+/).filter(Boolean);
  const nameTokens = nameClean.split(/\s+/).filter(Boolean);

  let matchedTokens = 0;
  for (const q of queryTokens) {
    if (nameTokens.includes(q)) {
      matchedTokens++;
      continue;
    }
    // Prefix match if query token is at least 4 chars (e.g. "christ" for "christian")
    if (q.length >= 4 && nameTokens.some((n) => n.startsWith(q))) {
      matchedTokens++;
      continue;
    }
    // Stricter typo match for longer tokens (>= 5 chars) only
    if (q.length >= 5) {
      const isFuzzy = nameTokens.some((n) => n.length >= 5 && computeJaroWinkler(q, n) >= 0.92);
      if (isFuzzy) {
        matchedTokens++;
        continue;
      }
    }
  }

  const tokenOverlap = queryTokens.length > 0 ? matchedTokens / queryTokens.length : 0;
  if (tokenOverlap === 1.0) {
    return { matched: true, score: 95, reason: "NAME_TOKEN_MATCH" };
  }
  if (tokenOverlap >= 0.5) {
    return { matched: true, score: Math.round(tokenOverlap * 90), reason: "NAME_TOKEN_MATCH" };
  }

  // 4. Substring containment (query of 4+ chars contained in candidate name)
  if (queryClean.length >= 4 && nameClean.includes(queryClean)) {
    return { matched: true, score: 90, reason: "NAME_SUBSTRING_MATCH" };
  }

  // 5. Fuzzy character match across entire name (typo handling on longer queries >= 5 chars)
  if (queryClean.length >= 5) {
    const jaro = computeJaroWinkler(queryClean, nameClean);
    if (jaro >= 0.90) {
      return { matched: true, score: Math.round(jaro * 90), reason: "NAME_FUZZY_MATCH" };
    }
  }

  return { matched: false, score: 0, reason: "" };
}

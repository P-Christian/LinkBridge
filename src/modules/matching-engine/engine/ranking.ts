import { NormalizedProfile } from "../types/profileTypes";
import { matchCandidateName } from "../retrieval/nameMatcher";
import { matchSchool } from "../retrieval/schoolMatcher";

export function calculateRankingScore(
  compatibilityScore: number,
  profile: NormalizedProfile,
  searchKeyword?: string,
  layer1Score: number = 0
): number {
  const hasKeyword = Boolean(searchKeyword && searchKeyword.trim());

  // In search mode with a keyword:
  // If a candidate scored 0 in Layer 1 (no role, title, alias, skill, summary, or education match),
  // their completeness and activity should NOT elevate them above candidates who actually matched.
  const hasRelevanceMatch = !hasKeyword || layer1Score > 0 || compatibilityScore > 20;
  const completenessWeight = hasRelevanceMatch ? 0.10 : 0.02;
  const activityWeight = hasRelevanceMatch ? 0.05 : 0.01;

  let score =
    compatibilityScore * 0.85 +
    profile.profileCompletenessScore * completenessWeight +
    profile.activityScore * activityWeight;

  // Layer 1 retrieval bonus: candidates with strong domain match (title, alias, role skill)
  // receive a direct ranking boost proportional to their retrieval score (up to 20 pts).
  if (hasKeyword && layer1Score > 0) {
    score += (layer1Score / 100) * 20;
  }

  // Name and school bonus: only applied when candidate demonstrates baseline compatibility (> 10)
  // to avoid elevating completely unrelated profiles based on name/school match alone.
  if (hasKeyword && compatibilityScore > 10) {
    const rawKeyword = searchKeyword!.trim();
    const nameMatch = matchCandidateName(rawKeyword, profile.name);
    if (nameMatch.matched) {
      // Prioritize explicit name search results at the top
      score += nameMatch.score === 100 ? 35 : 25;
    } else {
      // Check if candidate attended the explicitly searched school
      for (const edu of profile.education) {
        if (edu.school && matchSchool(rawKeyword, edu.school).matched) {
          score += 15;
          break;
        }
      }
    }
  }

  // Cap ranking score strictly within [0, 100]
  return Math.min(100, Math.max(0, Number(score.toFixed(1))));
}

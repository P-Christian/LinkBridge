// src/modules/matching-engine/__tests__/phase4ScoringAndFilters.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSkills } from "../evaluators/skillEvaluator";
import { calculateRankingScore } from "../engine/ranking";
import { applyExperienceFilter } from "../../client/talent-search/services/talent-search.service";
import { MatchMode, MatchContext } from "../types/matchTypes";
import { NormalizedProfile } from "../types/profileTypes";

function createMockProfile(partial: Partial<NormalizedProfile> & { id: number; name: string }): NormalizedProfile {
  return {
    id: partial.id,
    name: partial.name,
    headline: partial.headline ?? null,
    summary: partial.summary ?? null,
    location: partial.location ?? "Manila, Philippines",
    availability: partial.availability ?? "AVAILABLE",
    titles: partial.titles ?? (partial.headline ? [partial.headline] : []),
    skills: partial.skills ?? [],
    workHistory: partial.workHistory ?? [],
    education: partial.education ?? [],
    certifications: partial.certifications ?? [],
    portfolioLinks: partial.portfolioLinks ?? [],
    profileCompletenessScore: partial.profileCompletenessScore ?? 80,
    activityScore: partial.activityScore ?? 70,
  };
}

// ── 1. Skill Evaluator Phase 4 Tests ──

test("SkillEvaluator: ROLE_SIMILARITY scores ratio against effectiveSkills with variant tolerance", () => {
  const profile = createMockProfile({
    id: 1,
    name: "Alex Dev",
    skills: ["React.js", "Node.js", "TypeScript"],
  });

  const context: MatchContext = {
    mode: MatchMode.ROLE_SIMILARITY,
    keyword: "Web Developer",
    effectiveSkills: ["React", "Node", "PostgreSQL", "Docker"],
  };

  const result = evaluateSkills(profile, context, 15);

  assert.equal(result.label, "Skill Relevance");
  assert.equal(result.maxScore, 15);
  // Matched 2 out of 4 (React.js ~ React, Node.js ~ Node) = 50% of 15 = 8
  assert.equal(result.score, 8);
  assert.equal(result.explanationCode, "SKILLS_ROLE_RELEVANCE");
  assert.ok(result.explanationMessage.includes("Matched 2 of 4 role-relevant skills"));
});

test("SkillEvaluator: ROLE_SIMILARITY falls back to count bonus when effectiveSkills is empty", () => {
  const profile = createMockProfile({
    id: 2,
    name: "Sam Generalist",
    skills: ["Communication", "Leadership", "Budgeting"],
  });

  const context: MatchContext = {
    mode: MatchMode.ROLE_SIMILARITY,
    keyword: "Unknown Role",
    effectiveSkills: [],
  };

  const result = evaluateSkills(profile, context, 15);

  assert.equal(result.label, "Skill Relevance");
  assert.equal(result.score, 12); // 3+ skills = 12
  assert.equal(result.explanationCode, "SKILLS_BONUS");
});

// ── 2. Ranking Keyword Bonus Gating Tests ──

test("Ranking: Keyword name bonus is gated behind compatibilityScore > 10", () => {
  const profile = createMockProfile({
    id: 3,
    name: "Kaiser Germanicus",
    profileCompletenessScore: 80,
    activityScore: 70,
  });

  // Candidate with zero compatibility (e.g. software search matching culinary person's name)
  const zeroCompatScore = calculateRankingScore(0, profile, "Kaiser Germanicus", 0);

  // Base calculation:
  // hasRelevanceMatch is false (compat <= 20, layer1 = 0)
  // score = 0 * 0.85 + 80 * 0.02 + 70 * 0.01 = 1.6 + 0.7 = 2.3
  // Name bonus (+35) is GATED and NOT applied!
  assert.equal(zeroCompatScore, 2.3);

  // Candidate with legitimate compatibility (> 10)
  const relevantScore = calculateRankingScore(25, profile, "Kaiser Germanicus", 50);
  // Base: 25 * 0.85 + 80 * 0.10 + 70 * 0.05 + (50/100)*20 = 21.25 + 8 + 3.5 + 10 = 42.75
  // Name bonus (+35) IS applied! = 42.75 + 35 = 77.75 -> 77.8
  assert.equal(relevantScore, 77.8);
});

// ── 3. Experience Level Bands & Multi-Select Tests ──

test("ExperienceFilter: Single ENTRY band [0, 1] yr excludes > 1 yr candidates", () => {
  const talents = [
    { id: 1, relevant_experience_years: 0.5 },
    { id: 2, relevant_experience_years: 1.0 },
    { id: 3, relevant_experience_years: 2.0 },
    { id: 4, relevant_experience_years: 4.0 },
  ];

  const filtered = applyExperienceFilter(talents, "ENTRY");
  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map((t) => t.id), [1, 2]);
});

test("ExperienceFilter: Single JUNIOR band [1, 3] yrs excludes 0-year candidates", () => {
  const talents = [
    { id: 1, relevant_experience_years: 0.5 },
    { id: 2, relevant_experience_years: 1.5 },
    { id: 3, relevant_experience_years: 2.5 },
    { id: 4, relevant_experience_years: 4.5 },
  ];

  const filtered = applyExperienceFilter(talents, "JUNIOR");
  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map((t) => t.id), [2, 3]);
});

test("ExperienceFilter: Multi-select ['ENTRY', 'JUNIOR'] applies OR logic across bands", () => {
  const talents = [
    { id: 1, relevant_experience_years: 0.5 },
    { id: 2, relevant_experience_years: 2.0 },
    { id: 3, relevant_experience_years: 4.0 },
    { id: 4, relevant_experience_years: 8.0 },
  ];

  const filtered = applyExperienceFilter(talents, ["ENTRY", "JUNIOR"]);
  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map((t) => t.id), [1, 2]);
});

test("ExperienceFilter: Empty filter returns all candidates", () => {
  const talents = [
    { id: 1, relevant_experience_years: 0.5 },
    { id: 2, relevant_experience_years: 8.0 },
  ];

  const filtered = applyExperienceFilter(talents, []);
  assert.equal(filtered.length, 2);
});

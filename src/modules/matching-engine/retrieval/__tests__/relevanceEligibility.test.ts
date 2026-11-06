// src/modules/matching-engine/retrieval/__tests__/relevanceEligibility.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { retrieveCandidatePool } from "../candidateRetriever";
import { analyzeQuery } from "../queryAnalyzer";
import { MatchMode, ResolvedTaxonomyContext } from "../../types/matchTypes";
import { NormalizedProfile } from "../../types/profileTypes";

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

const mockChef = createMockProfile({
  id: 1,
  name: "Marco Pierre",
  headline: "Executive Chef",
  skills: ["Menu Engineering", "Food Cost Control", "Fine Dining"],
});

const mockSousChef = createMockProfile({
  id: 2,
  name: "Gordon Laurent",
  headline: "Sous Chef",
  skills: ["Kitchen Staff Supervision", "Plating Aesthetics", "Food Safety"],
});

const mockKitchenSupervisor = createMockProfile({
  id: 3,
  name: "Anthony Bourdain",
  headline: "Kitchen Supervisor",
  skills: ["HACCP Compliance", "Food Cost Control", "Inventory Management"],
});

const mockSoftwareDev = createMockProfile({
  id: 4,
  name: "Ada Lovelace",
  headline: "Full Stack Developer",
  skills: ["React", "TypeScript", "Node.js", "SQL"],
});

const mockProjectManager = createMockProfile({
  id: 5,
  name: "Peter Drucker",
  headline: "Senior Project Manager",
  skills: ["Agile", "Scrum", "Risk Management", "Jira"],
});

const mockGeneralManager = createMockProfile({
  id: 6,
  name: "Satya Nadella",
  headline: "General Manager",
  skills: ["Operations Management", "Strategic Planning", "Budgeting"],
});

const mockUnconventionalChef = createMockProfile({
  id: 7,
  name: "Alain Ducasse",
  headline: "Culinary Consultant",
  titles: ["Culinary Consultant", "Executive Chef"],
  workHistory: [
    {
      company: "The Grand Bistro",
      title: "Executive Chef",
      description: "Supervised high-volume kitchen and designed seasonal menus.",
      startDate: "2018-01-01",
      endDate: "2023-01-01",
      isCurrent: false,
      years: 5,
    },
  ],
  skills: ["Menu Engineering", "Restaurant Operations"],
});

const allCandidates = [
  mockChef,
  mockSousChef,
  mockKitchenSupervisor,
  mockSoftwareDev,
  mockProjectManager,
  mockGeneralManager,
  mockUnconventionalChef,
];

const chefTaxonomy: ResolvedTaxonomyContext = {
  keyword: "chef",
  resolved_role: "Chef",
  resolved_role_id: 13,
  category_code: "cooking",
  category_name: "Cooking & Culinary",
  matched_alias: "sous chef",
  match_weight: 0.95,
  expanded_aliases: ["sous chef", "head chef", "executive chef", "line cook", "kitchen supervisor"],
};

test("1. Chef search: returns only culinary profiles and excludes software/management profiles", () => {
  const query = analyzeQuery("chef");
  const pool = retrieveCandidatePool(
    allCandidates,
    query,
    chefTaxonomy,
    0,
    "chef",
    ["Menu Engineering", "Food Cost Control", "HACCP Compliance"],
    MatchMode.ROLE_SIMILARITY
  );

  const eligible = pool.filter((r) => r.eligibility.eligible);
  const eligibleIds = eligible.map((r) => r.candidate.id);

  assert.ok(eligibleIds.includes(mockChef.id), "Chef should be eligible");
  assert.ok(eligibleIds.includes(mockSousChef.id), "Sous Chef should be eligible via taxonomy alias");
  assert.ok(eligibleIds.includes(mockKitchenSupervisor.id), "Kitchen Supervisor should be eligible via alias & skills");
  assert.ok(eligibleIds.includes(mockUnconventionalChef.id), "Unconventional title with chef history should be eligible");

  assert.ok(!eligibleIds.includes(mockSoftwareDev.id), "Software developer must be excluded");
  assert.ok(!eligibleIds.includes(mockProjectManager.id), "Project manager must be excluded");
  assert.ok(!eligibleIds.includes(mockGeneralManager.id), "General manager must be excluded");
});

test("2. Sous Chef search: matches sous chef, chef, and related roles", () => {
  const query = analyzeQuery("sous chef");
  const pool = retrieveCandidatePool(
    allCandidates,
    query,
    chefTaxonomy,
    0,
    "sous chef",
    ["Kitchen Staff Supervision", "Plating Aesthetics"],
    MatchMode.ROLE_SIMILARITY
  );

  const eligible = pool.filter((r) => r.eligibility.eligible);
  const eligibleIds = eligible.map((r) => r.candidate.id);

  assert.ok(eligibleIds.includes(mockSousChef.id), "Sous Chef must match directly");
  assert.ok(!eligibleIds.includes(mockSoftwareDev.id), "Software dev must not match");
});

test("3. Kitchen Supervisor search: matches kitchen supervisor and culinary profiles", () => {
  const query = analyzeQuery("kitchen supervisor");
  const pool = retrieveCandidatePool(
    allCandidates,
    query,
    chefTaxonomy,
    0,
    "kitchen supervisor",
    ["HACCP Compliance", "Inventory Management"],
    MatchMode.ROLE_SIMILARITY
  );

  const eligible = pool.filter((r) => r.eligibility.eligible);
  const eligibleIds = eligible.map((r) => r.candidate.id);

  assert.ok(eligibleIds.includes(mockKitchenSupervisor.id), "Kitchen supervisor must be eligible");
  assert.ok(!eligibleIds.includes(mockSoftwareDev.id), "Software dev must not match");
  assert.ok(!eligibleIds.includes(mockProjectManager.id), "Project manager must not match");
});

test("4. Software Developer search: retains tech profiles, excludes culinary/operations", () => {
  const query = analyzeQuery("software developer");
  const devTaxonomy: ResolvedTaxonomyContext = {
    keyword: "software developer",
    resolved_role: "Software Developer",
    resolved_role_id: 101,
    category_code: "engineering",
    category_name: "Software Engineering",
    matched_alias: "full stack developer",
    match_weight: 1.0,
    expanded_aliases: ["full stack developer", "frontend developer", "backend developer", "software engineer"],
  };

  const pool = retrieveCandidatePool(
    allCandidates,
    query,
    devTaxonomy,
    0,
    "software developer",
    ["React", "TypeScript", "Node.js"],
    MatchMode.ROLE_SIMILARITY
  );

  const eligible = pool.filter((r) => r.eligibility.eligible);
  const eligibleIds = eligible.map((r) => r.candidate.id);

  assert.ok(eligibleIds.includes(mockSoftwareDev.id), "Software dev must be eligible");
  assert.ok(!eligibleIds.includes(mockChef.id), "Chef must not match");
  assert.ok(!eligibleIds.includes(mockKitchenSupervisor.id), "Kitchen supervisor must not match");
});

test("5. Project Manager search: retains PM, excludes tech and culinary", () => {
  const query = analyzeQuery("project manager");
  const pmTaxonomy: ResolvedTaxonomyContext = {
    keyword: "project manager",
    resolved_role: "Project Manager",
    resolved_role_id: 201,
    category_code: "management",
    category_name: "Management",
    matched_alias: "project manager",
    match_weight: 1.0,
    expanded_aliases: ["senior project manager", "scrum master", "technical project manager"],
  };

  const pool = retrieveCandidatePool(
    allCandidates,
    query,
    pmTaxonomy,
    0,
    "project manager",
    ["Agile", "Scrum", "Risk Management"],
    MatchMode.ROLE_SIMILARITY
  );

  const eligible = pool.filter((r) => r.eligibility.eligible);
  const eligibleIds = eligible.map((r) => r.candidate.id);

  assert.ok(eligibleIds.includes(mockProjectManager.id), "Project manager must be eligible");
  assert.ok(!eligibleIds.includes(mockChef.id), "Chef must not match");
  assert.ok(!eligibleIds.includes(mockSoftwareDev.id), "Software dev must not match");
});

test("6. General Manager search: retains GM, excludes chef and tech", () => {
  const query = analyzeQuery("general manager");
  const gmTaxonomy: ResolvedTaxonomyContext = {
    keyword: "general manager",
    resolved_role: "General Manager",
    resolved_role_id: 301,
    category_code: "management",
    category_name: "Management",
    matched_alias: "general manager",
    match_weight: 1.0,
    expanded_aliases: ["operations director", "general manager"],
  };

  const pool = retrieveCandidatePool(
    allCandidates,
    query,
    gmTaxonomy,
    0,
    "general manager",
    ["Operations Management", "Strategic Planning"],
    MatchMode.ROLE_SIMILARITY
  );

  const eligible = pool.filter((r) => r.eligibility.eligible);
  const eligibleIds = eligible.map((r) => r.candidate.id);

  assert.ok(eligibleIds.includes(mockGeneralManager.id), "General Manager must be eligible");
  assert.ok(!eligibleIds.includes(mockChef.id), "Chef must not match");
  assert.ok(!eligibleIds.includes(mockSoftwareDev.id), "Software dev must not match");
});

test("7. Skill-only search: retains only candidates possessing the skill", () => {
  const query = analyzeQuery("");
  const pool = retrieveCandidatePool(
    allCandidates,
    query,
    null,
    0,
    "",
    ["React"],
    MatchMode.SKILL_MATCH
  );

  const eligible = pool.filter((r) => r.eligibility.eligible);
  const eligibleIds = eligible.map((r) => r.candidate.id);

  assert.deepEqual(eligibleIds, [mockSoftwareDev.id], "Only the candidate with React should be eligible");
});

test("8. Browse mode without filters: retains ALL candidates with BROWSE_MODE reason", () => {
  const query = analyzeQuery("");
  const pool = retrieveCandidatePool(
    allCandidates,
    query,
    null,
    0,
    "",
    [],
    MatchMode.BROWSE
  );

  assert.strictEqual(pool.length, allCandidates.length, "All candidates must be retained in browse mode");
  for (const item of pool) {
    assert.strictEqual(item.eligibility.eligible, true, "Every candidate should be eligible in browse mode");
    assert.strictEqual(item.eligibility.reason, "BROWSE_MODE", "Reason must be BROWSE_MODE");
  }
});

// src/modules/matching-engine/taxonomy/__tests__/taxonomyCache.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import {
  getOrLoadTaxonomy,
  invalidateTaxonomyCache,
  getCachedTaxonomySync,
} from "../taxonomyCache";
import { RoleTaxonomyAlias, RoleSkillMapping } from "../taxonomyTypes";

const mockAliases: RoleTaxonomyAlias[] = [
  {
    alias_id: 1,
    alias_name: "Software Engineer",
    normalized_alias: "software engineer",
    match_weight: 1.0,
    role_id: { role_id: 10, role_name: "Software Engineer" },
  },
];

const mockRoleSkills: RoleSkillMapping[] = [
  {
    role_id: { role_id: 10 },
    skill_id: { id: 101, skill_name: "TypeScript" },
    importance_weight: 1.0,
    is_required: 1,
  },
];

let callCount = 0;
const testLoader = async () => {
  callCount++;
  // simulate small async delay
  await new Promise((r) => setTimeout(r, 10));
  return { aliases: mockAliases, roleSkills: mockRoleSkills };
};

test("TaxonomyCache: loads and returns taxonomy structure", async () => {
  invalidateTaxonomyCache();
  assert.strictEqual(getCachedTaxonomySync(), null, "Cache should be empty initially");

  const data = await getOrLoadTaxonomy(false, testLoader);
  assert.ok(Array.isArray(data.aliases), "aliases should be an array");
  assert.strictEqual(data.aliases.length, 1);
  assert.strictEqual(data.roleSkills.length, 1);
  assert.ok(typeof data.loadedAt === "number", "loadedAt should be a number");
  assert.ok(typeof data.version === "string", "version should be a string");

  const syncCached = getCachedTaxonomySync();
  assert.notStrictEqual(syncCached, null, "Should be cached synchronously");
  assert.strictEqual(syncCached?.version, data.version, "Versions should match");
});

test("TaxonomyCache: deduplicates concurrent loads", async () => {
  invalidateTaxonomyCache();
  callCount = 0;

  const [res1, res2, res3] = await Promise.all([
    getOrLoadTaxonomy(false, testLoader),
    getOrLoadTaxonomy(false, testLoader),
    getOrLoadTaxonomy(false, testLoader),
  ]);

  assert.strictEqual(callCount, 1, "Loader should only be called once for concurrent requests");
  assert.strictEqual(res1, res2, "Concurrent loads should resolve to exact same cache instance");
  assert.strictEqual(res2, res3, "Concurrent loads should resolve to exact same cache instance");
});

test("TaxonomyCache: explicit invalidation clears the cache", async () => {
  await getOrLoadTaxonomy(false, testLoader);
  assert.notStrictEqual(getCachedTaxonomySync(), null);

  invalidateTaxonomyCache();
  assert.strictEqual(getCachedTaxonomySync(), null, "Cache should be null after invalidation");
});

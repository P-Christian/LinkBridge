// src/modules/matching-engine/taxonomy/taxonomyCache.ts

import { fetchRoleAliasesFromDB, fetchRoleSkillsFromDB } from "./taxonomyRepository";
import { RoleSkillMapping, RoleTaxonomyAlias, TaxonomyCache } from "./taxonomyTypes";

/**
 * 10-minute cache TTL for DB taxonomy tables (aliases & role-skill mappings).
 * Static taxonomy changes infrequently; caching eliminates duplicate Directus
 * table scans on every talent search cache miss.
 */
export const TAXONOMY_CACHE_TTL_MS = 10 * 60 * 1000;

export type TaxonomyLoader = () => Promise<{
  aliases: RoleTaxonomyAlias[];
  roleSkills: RoleSkillMapping[];
}>;

const defaultLoader: TaxonomyLoader = async () => {
  const [aliases, roleSkills] = await Promise.all([
    fetchRoleAliasesFromDB(),
    fetchRoleSkillsFromDB(),
  ]);
  return { aliases, roleSkills };
};

let cachedTaxonomy: TaxonomyCache | null = null;
let inFlightLoadPromise: Promise<TaxonomyCache> | null = null;

/**
 * Read cached taxonomy or load both tables concurrently from Directus.
 * Employs single-flight promise deduplication to prevent concurrent searches
 * from issuing duplicate database scans during a cache miss or reload.
 */
export async function getOrLoadTaxonomy(
  forceReload: boolean = false,
  loader: TaxonomyLoader = defaultLoader
): Promise<TaxonomyCache> {
  const now = Date.now();
  if (!forceReload && cachedTaxonomy && now - cachedTaxonomy.loadedAt < TAXONOMY_CACHE_TTL_MS) {
    return cachedTaxonomy;
  }

  // Deduplicate concurrent loads
  if (inFlightLoadPromise) {
    return inFlightLoadPromise;
  }

  inFlightLoadPromise = (async () => {
    try {
      const { aliases, roleSkills } = await loader();

      if (!Array.isArray(aliases) || !Array.isArray(roleSkills)) {
        throw new Error("Failed to load valid taxonomy data: response is not an array");
      }

      const version = `${Date.now()}_${aliases.length}_${roleSkills.length}`;
      const entry: TaxonomyCache = {
        aliases,
        roleSkills,
        loadedAt: Date.now(),
        version,
      };

      cachedTaxonomy = entry;
      return entry;
    } finally {
      inFlightLoadPromise = null;
    }
  })();

  return inFlightLoadPromise;
}

/**
 * Explicitly invalidate the taxonomy cache (e.g. after admin updates).
 */
export function invalidateTaxonomyCache(): void {
  cachedTaxonomy = null;
  inFlightLoadPromise = null;
}

/**
 * Synchronous read of current cached taxonomy, if fresh.
 */
export function getCachedTaxonomySync(): TaxonomyCache | null {
  if (cachedTaxonomy && Date.now() - cachedTaxonomy.loadedAt < TAXONOMY_CACHE_TTL_MS) {
    return cachedTaxonomy;
  }
  return null;
}

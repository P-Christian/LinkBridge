// src/modules/client/talent-search/services/talent-search.taxonomy.ts

import { cleanText, type ResolvedTaxonomyContext } from "@/modules/matching-engine";
import type { RoleSkillMappingRow, RoleTaxonomyAliasRow } from "./talent-search.repo";

export type { ResolvedTaxonomyContext };

const EMPTY_TAXONOMY: ResolvedTaxonomyContext = {
  keyword: "",
  resolved_role: null,
  resolved_role_id: null,
  category_code: null,
  category_name: null,
  matched_alias: null,
  match_weight: 1.0,
  expanded_aliases: [],
};

/**
 * Resolve a query against the DB-backed role taxonomy: exact normalized alias,
 * then partial containment. A match inflates the alias set to the whole role and
 * its category, which is what Layer 1 retrieval then matches against.
 */
export function resolveRoleTaxonomy(
  keyword: string,
  dbAliases: RoleTaxonomyAliasRow[]
): ResolvedTaxonomyContext {
  const original = (keyword || "").trim();
  const cleanedKey = cleanText(original);
  if (!cleanedKey) return EMPTY_TAXONOMY;

  // 1. Exact normalized alias match (using cleanText to strip hyphens, underscores, dots, etc.)
  const exactAlias = dbAliases.find((a) => cleanText(a.normalized_alias) === cleanedKey);
  // 2. Partial containment match — also compare space-stripped versions (e.g. "webdeveloper" vs "web developer")
  const cleanedKeyNoSpaces = cleanedKey.replace(/\s+/g, "");
  const partialAlias =
    exactAlias ??
    dbAliases.find((a) => {
      const norm = cleanText(a.normalized_alias);
      const normNoSpaces = norm.replace(/\s+/g, "");
      return (
        norm &&
        (cleanedKey.includes(norm) ||
          norm.includes(cleanedKey) ||
          cleanedKeyNoSpaces === normNoSpaces ||
          cleanedKeyNoSpaces.includes(normNoSpaces) ||
          normNoSpaces.includes(cleanedKeyNoSpaces))
      );
    });

  if (partialAlias && partialAlias.role_id) {
    const matched = partialAlias;
    const roleName = matched.role_id.role_name;
    const roleId = matched.role_id.role_id;
    const catCode = matched.role_id.category_id?.category_code ?? null;
    const catName = matched.role_id.category_id?.category_name ?? null;

    // Expand all aliases in the same role OR same category for broader matching
    const expanded = dbAliases
      .filter(
        (a) =>
          a.role_id?.role_id === roleId ||
          (catCode && a.role_id?.category_id?.category_code === catCode)
      )
      .map((a) => cleanText(a.normalized_alias));

    return {
      keyword,
      resolved_role: roleName,
      resolved_role_id: roleId,
      category_code: catCode,
      category_name: catName,
      matched_alias: matched.alias_name,
      match_weight: Number(matched.match_weight ?? 1.0),
      expanded_aliases: Array.from(new Set([cleanedKey, ...expanded])).filter(Boolean),
    };
  }

  // No DB match — no category inflation, just use the raw keyword
  return {
    keyword,
    resolved_role: null,
    resolved_role_id: null,
    category_code: null,
    category_name: null,
    matched_alias: keyword,
    match_weight: 1.0,
    expanded_aliases: [cleanedKey],
  };
}

/** role id → the skill names that role's mapping rows carry. */
export function buildRoleSkillsMap(rows: RoleSkillMappingRow[]): Map<number, string[]> {
  const byRole = new Map<number, string[]>();
  for (const row of rows) {
    const roleId = row.role_id?.role_id;
    const skillName = row.skill_id?.skill_name;
    if (!roleId || !skillName) continue;
    if (!byRole.has(roleId)) byRole.set(roleId, []);
    byRole.get(roleId)!.push(skillName);
  }
  return byRole;
}

/**
 * What the evaluators are asked to match on. A keyword that resolved to a DB role
 * contributes that role's skills, and Gemini's inferred skills join them, but only
 * when the recruiter named no skills themselves — an explicit selection is the
 * recruiter's own requirement, not a gap to fill.
 */
export function expandEffectiveSkills(input: {
  requestedSkills: string[];
  taxonomy: ResolvedTaxonomyContext;
  roleSkillsMap: Map<number, string[]>;
  inferredSkills: string[];
}): string[] {
  let effective = input.requestedSkills;

  if (input.requestedSkills.length === 0 && input.taxonomy.resolved_role_id !== null) {
    const roleSkills = input.roleSkillsMap.get(input.taxonomy.resolved_role_id) ?? [];
    if (roleSkills.length > 0) effective = roleSkills;
  }

  if (input.requestedSkills.length === 0 && input.inferredSkills.length > 0) {
    effective = Array.from(new Set([...effective, ...input.inferredSkills]));
  }

  return effective;
}

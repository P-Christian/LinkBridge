// src/modules/matching-engine/taxonomy/taxonomyRepository.ts

import { directusItems } from "../../../lib/server/directus";
import { RoleSkillMapping, RoleTaxonomyAlias } from "./taxonomyTypes";

const MAX_SCAN_ROWS = 10_000;

export async function fetchRoleAliasesFromDB(): Promise<RoleTaxonomyAlias[]> {
  return directusItems<RoleTaxonomyAlias>("vs_role_title_alias", {
    query:
      `fields=alias_id,alias_name,normalized_alias,match_weight,` +
      `role_id.role_id,role_id.role_name,` +
      `role_id.category_id.category_id,role_id.category_id.category_code,role_id.category_id.category_name` +
      `&limit=${MAX_SCAN_ROWS}`,
  });
}

export async function fetchRoleSkillsFromDB(): Promise<RoleSkillMapping[]> {
  return directusItems<RoleSkillMapping>("vs_role_skill_mapping", {
    query:
      `fields=role_id.role_id,skill_id.id,skill_id.skill_name,importance_weight,is_required` +
      `&limit=${MAX_SCAN_ROWS}`,
  });
}

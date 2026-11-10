// src/modules/vos-admin/role-matching/services/taxonomy/taxonomyResolver.ts
// Directus read-only resolver for existing categories, roles, aliases, and master skills.

import { normalizeKeyword } from "../../validators";
import { directusItems } from "@/lib/server/directus";

export interface ExistingCategory {
  category_id: number;
  category_name: string;
  category_code: string;
}

export interface ExistingRole {
  role_id: number;
  role_name: string;
  category_id: number;
}

export interface ExistingAlias {
  alias_id: number;
  alias_name: string;
  normalized_alias: string;
  role_id: number;
}

export interface ExistingMasterSkill {
  id: number;
  skill_name: string;
}

export interface ExistingRoleSkill {
  id: number;
  role_id: number;
  skill_id: number;
}

export async function fetchExistingTaxonomyState() {
  // Every collection is read fail-closed. With one list missing — usually
  // vs_master_skills or vs_role_title_alias, the biggest — the governance pass
  // treats the taxonomy as empty and auto-inserts aliases and master skills that
  // already exist, because the reuse check had nothing to match against.
  const [categories, roles, aliases, masterSkills, roleSkills] = await Promise.all([
    directusItems<ExistingCategory>("vs_role_category", { query: "limit=-1" }),
    directusItems<ExistingRole>("vs_role_title", { query: "limit=-1" }),
    directusItems<ExistingAlias>("vs_role_title_alias", { query: "limit=-1" }),
    directusItems<ExistingMasterSkill>("vs_master_skills", { query: "limit=-1" }),
    directusItems<ExistingRoleSkill>("vs_role_skill_mapping", { query: "limit=-1" }),
  ]);

  return { categories, roles, aliases, masterSkills, roleSkills };
}

export function findMatchingCategory(categories: ExistingCategory[], name: string): ExistingCategory | null {
  const norm = normalizeKeyword(name);
  return categories.find((c) => normalizeKeyword(c.category_name) === norm || c.category_code === norm) ?? null;
}

export function findMatchingRole(roles: ExistingRole[], name: string): ExistingRole | null {
  const norm = normalizeKeyword(name);
  return roles.find((r) => normalizeKeyword(r.role_name) === norm) ?? null;
}

export function findMatchingAlias(aliases: ExistingAlias[], name: string): ExistingAlias | null {
  const norm = normalizeKeyword(name);
  return aliases.find((a) => a.normalized_alias === norm || normalizeKeyword(a.alias_name) === norm) ?? null;
}

export function findMatchingSkill(skills: ExistingMasterSkill[], name: string): ExistingMasterSkill | null {
  const norm = normalizeKeyword(name);
  return skills.find((s) => normalizeKeyword(s.skill_name) === norm) ?? null;
}

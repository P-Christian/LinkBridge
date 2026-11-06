// src/modules/matching-engine/taxonomy/taxonomyTypes.ts

export interface RoleTaxonomyAlias {
  alias_id: number;
  alias_name: string;
  normalized_alias: string;
  match_weight: number;
  role_id: {
    role_id: number;
    role_name: string;
    category_id?: {
      category_id: number;
      category_code: string;
      category_name: string;
    };
  };
}

export interface RoleSkillMapping {
  role_id: { role_id: number };
  skill_id: { id: number; skill_name: string };
  importance_weight: number;
  is_required: number;
}

export interface TaxonomyCache {
  aliases: RoleTaxonomyAlias[];
  roleSkills: RoleSkillMapping[];
  loadedAt: number;
  version: string;
}

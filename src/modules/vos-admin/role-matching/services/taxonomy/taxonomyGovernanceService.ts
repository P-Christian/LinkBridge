// src/modules/vos-admin/role-matching/services/taxonomy/taxonomyGovernanceService.ts
// Core shared taxonomy governance engine — decision layer for AI suggestions.

import { normalizeKeyword } from "../../validators";
import {
  fetchExistingTaxonomyState,
  findMatchingCategory,
  findMatchingRole,
  findMatchingAlias,
  findMatchingSkill,
} from "./taxonomyResolver";
import {
  insertAlias,
  insertMasterSkill,
  insertRoleSkillMapping,
} from "./taxonomyMutationService";

// Generic blacklist for terms that must never become standalone canonical roles/aliases
const TAXONOMY_BLACKLIST = new Set([
  "specialist",
  "professional",
  "experienced",
  "technical",
  "developer",
  "engineer",
  "manager",
  "executive",
  "lead",
  "junior",
  "senior",
]);

export interface RawTaxonomyProposalItem {
  name: string;
  weight?: number;
  type?: string;
  confidence?: number;
  isRequired?: boolean;
}

export interface FullTaxonomyProposal {
  roleName: string;
  categoryName?: string;
  roleConfidence?: number;
  keywords?: RawTaxonomyProposalItem[];
  skills?: RawTaxonomyProposalItem[];
}

export interface GovernanceResult {
  reused: Array<{ entity: string; name: string; id: number }>;
  autoApplied: Array<{ entity: string; name: string; action: string; id?: number }>;
  reviewRequired: Array<{ entity: string; name: string; classification: string; reason: string }>;
  rejected: Array<{ entity: string; name: string; reason: string }>;
}

export async function evaluateTaxonomyProposal(proposal: FullTaxonomyProposal): Promise<GovernanceResult> {
  const result: GovernanceResult = {
    reused: [],
    autoApplied: [],
    reviewRequired: [],
    rejected: [],
  };

  const roleName = proposal.roleName.trim();
  if (!roleName) return result;

  // 1. Fetch current taxonomy state from Directus
  const dbState = await fetchExistingTaxonomyState();

  // 2. Resolve Category & Role
  const categoryObj = findMatchingCategory(dbState.categories, proposal.categoryName || "General");
  if (categoryObj) {
    result.reused.push({ entity: "Category", name: categoryObj.category_name, id: categoryObj.category_id });
  }

  const roleObj = findMatchingRole(dbState.roles, roleName);
  if (roleObj) {
    result.reused.push({ entity: "CanonicalRole", name: roleObj.role_name, id: roleObj.role_id });
  }

  // An unresolved role used to fall back to role 1, so every suggestion for a
  // new role — including the ones fired off unattended from the client portal's
  // best-match route — was written against whichever role happened to be first.
  const targetRoleId = roleObj?.role_id ?? null;
  if (!targetRoleId) {
    result.reviewRequired.push({
      entity: "CanonicalRole",
      name: roleName,
      classification: "NEW_ROLE",
      reason: "This role does not exist yet, so nothing below was written against it.",
    });
  }

  // 3. Process Keywords / Aliases
  for (const item of proposal.keywords ?? []) {
    const rawName = item.name.trim();
    const normalized = normalizeKeyword(rawName);
    const confidence = item.confidence ?? item.weight ?? 0.8;
    const classification = (item.type || "SYNONYM").toUpperCase();

    // Check blacklist / validity
    if (!rawName || rawName.length < 2 || TAXONOMY_BLACKLIST.has(normalized)) {
      result.rejected.push({ entity: "Alias", name: rawName, reason: "Too generic or blacklisted term" });
      continue;
    }

    if (confidence < 0.70) {
      result.rejected.push({ entity: "Alias", name: rawName, reason: `Low confidence score (${confidence.toFixed(2)})` });
      continue;
    }

    // Check existing DB aliases
    const existingAlias = findMatchingAlias(dbState.aliases, rawName);
    if (existingAlias) {
      result.reused.push({ entity: "Alias", name: existingAlias.alias_name, id: existingAlias.alias_id });
      continue;
    }

    // Classify Governance Action
    if (targetRoleId && ["SYNONYM", "ABBREVIATION", "EXACT", "SEARCH_KEYWORD"].includes(classification) && confidence >= 0.85) {
      // Zero-touch background insert into Directus
      const newAliasId = await insertAlias(targetRoleId, rawName, confidence);
      if (newAliasId) {
        result.autoApplied.push({ entity: "Alias", name: rawName, action: "Inserted Alias", id: newAliasId });
      } else {
        result.reviewRequired.push({ entity: "Alias", name: rawName, classification, reason: "Insert conflict / Directus unavailable" });
      }
    } else {
      // Ambiguous / Related Role → Queue for Admin Review
      result.reviewRequired.push({
        entity: "Alias",
        name: rawName,
        classification,
        reason: targetRoleId
          ? `Classification '${classification}' requires human confirmation`
          : "The proposed role is not in the taxonomy yet, so no alias was written",
      });
    }
  }

  // 4. Process Skills
  for (const item of proposal.skills ?? []) {
    const rawSkill = item.name.trim();
    const confidence = item.confidence ?? item.weight ?? 0.8;
    const isRequired = Boolean(item.isRequired);

    if (!rawSkill || rawSkill.length < 2) {
      result.rejected.push({ entity: "Skill", name: rawSkill, reason: "Invalid skill name" });
      continue;
    }

    if (confidence < 0.75) {
      result.rejected.push({ entity: "Skill", name: rawSkill, reason: `Low confidence score (${confidence.toFixed(2)})` });
      continue;
    }

    // Check master skills DB
    const skillObj = findMatchingSkill(dbState.masterSkills, rawSkill);
    let skillId: number | null = skillObj?.id ?? null;


    if (skillObj) {
      result.reused.push({ entity: "MasterSkill", name: skillObj.skill_name, id: skillObj.id });
    } else if (targetRoleId && confidence >= 0.85) {
      // Auto-insert missing master skill
      skillId = await insertMasterSkill(rawSkill, proposal.categoryName || "General");
      if (skillId) {
        result.autoApplied.push({ entity: "MasterSkill", name: rawSkill, action: "Inserted Master Skill", id: skillId });
      } else {
        result.reviewRequired.push({ entity: "MasterSkill", name: rawSkill, classification: "NEW_SKILL", reason: "Insert conflict / Directus unavailable" });
      }
    } else if (!skillObj) {
      result.reviewRequired.push({
        entity: "MasterSkill",
        name: rawSkill,
        classification: "NEW_SKILL",
        reason: targetRoleId ? `Low confidence to auto-create (${confidence.toFixed(2)})` : "The proposed role is not in the taxonomy yet, so no skill was created",
      });
    }

    // Check role skill mapping DB
    if (skillId && targetRoleId) {
      const existingMapping = dbState.roleSkills.find((rs) => rs.role_id === targetRoleId && rs.skill_id === skillId);
      if (existingMapping) {
        result.reused.push({ entity: "RoleSkillMapping", name: rawSkill, id: existingMapping.id });
      } else if (confidence >= 0.80) {
        const mappingId = await insertRoleSkillMapping(targetRoleId, skillId, confidence, isRequired);
        if (mappingId) {
          result.autoApplied.push({ entity: "RoleSkillMapping", name: rawSkill, action: "Created Role Skill Mapping", id: mappingId });
        } else {
          result.reviewRequired.push({ entity: "RoleSkillMapping", name: rawSkill, classification: "SKILL_MAPPING", reason: "Insert conflict / Directus unavailable" });
        }
      }
    }
  }

  console.info(`[taxonomyGovernance] 📊 Governance Complete for "${roleName}":`, {
    reusedCount: result.reused.length,
    autoAppliedCount: result.autoApplied.length,
    reviewRequiredCount: result.reviewRequired.length,
    rejectedCount: result.rejected.length,
  });

  return result;
}

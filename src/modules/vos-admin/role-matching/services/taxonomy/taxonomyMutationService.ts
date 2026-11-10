// src/modules/vos-admin/role-matching/services/taxonomy/taxonomyMutationService.ts
// Idempotent Directus writes with duplicate conflict (409/422) handling.

import { normalizeKeyword } from "../../validators";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

/**
 * Only a uniqueness conflict means "this row already exists". Answering it for
 * any failed POST let Directus being briefly down resolve to whichever row the
 * lookup happened to return first, and the caller recorded that id as the one
 * it had just created.
 */
async function isDuplicateConflict(res: Response): Promise<boolean> {
  if (res.status !== 422 && res.status !== 409) return false;
  const json = await res.json().catch(() => null);
  const detail = json?.errors?.[0];
  const code = `${detail?.extensions?.code ?? ""} ${detail?.message ?? ""}`;
  return /NOT_UNIQUE|record_not_unique|unique/i.test(code);
}

export async function insertAlias(roleId: number, aliasName: string, weight: number = 0.85): Promise<number | null> {
  try {
    const norm = normalizeKeyword(aliasName);
    const payload = {
      alias_name: aliasName.trim(),
      normalized_alias: norm,
      role_id: roleId,
      match_weight: weight,
      is_primary: false,
    };

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_role_title_alias`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const json = await res.json();
      return json?.data?.alias_id ?? null;
    }

    if (!(await isDuplicateConflict(res))) return null;

    // Duplicate conflict fallback — the alias for THIS role, matched exactly.
    // Unscoped, this returned another role's alias_id and the caller reported it
    // as inserted under the role being governed.
    const queryRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_role_title_alias?filter[role_id][_eq]=${roleId}&filter[normalized_alias][_eq]=${encodeURIComponent(norm)}&fields=alias_id&limit=1`,
      {
        headers: getHeaders(),
        cache: "no-store",
      }
    );
    if (queryRes.ok) {
      const queryJson = await queryRes.json();
      const existing = queryJson.data?.[0];
      if (existing) return existing.alias_id;
    }

    return null;
  } catch (err) {
    console.warn(`[taxonomyMutation] ⚠️ Alias insert skipped for "${aliasName}":`, err);
    return null;
  }
}

export async function insertMasterSkill(skillName: string, category: string = "General"): Promise<number | null> {
  try {
    const trimmed = skillName.trim();
    const payload = {
      skill_name: trimmed,
      skill_category: category.trim(),
    };

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_master_skills`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const json = await res.json();
      return json?.data?.id ?? null;
    }

    if (!(await isDuplicateConflict(res))) return null;

    // Duplicate conflict fallback — contains-matching returned the first row
    // whose name held this one, so "React" resolved to "React Native" and the
    // wrong skill got mapped to the role.
    const queryRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_master_skills?filter[skill_name][_ieq]=${encodeURIComponent(trimmed)}&fields=id&limit=1`,
      {
        headers: getHeaders(),
        cache: "no-store",
      }
    );
    if (queryRes.ok) {
      const queryJson = await queryRes.json();
      const existing = queryJson.data?.[0];
      if (existing) return existing.id;
    }

    return null;
  } catch (err) {
    console.warn(`[taxonomyMutation] ⚠️ Master skill insert skipped for "${skillName}":`, err);
    return null;
  }
}

export async function insertRoleSkillMapping(roleId: number, skillId: number, weight: number = 0.8, isRequired: boolean = false): Promise<number | null> {
  try {
    const payload = {
      role_id: roleId,
      skill_id: skillId,
      importance_weight: weight,
      is_required: isRequired,
    };

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_role_skill_mapping`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const json = await res.json();
      return json?.data?.id ?? null;
    }

    if (!(await isDuplicateConflict(res))) return null;

    // Duplicate conflict fallback — this role and skill, one row.
    const queryRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_role_skill_mapping?filter[role_id][_eq]=${roleId}&filter[skill_id][_eq]=${skillId}&fields=id&limit=1`,
      {
        headers: getHeaders(),
        cache: "no-store",
      }
    );
    if (queryRes.ok) {
      const queryJson = await queryRes.json();
      const existing = queryJson.data?.[0];
      if (existing) return existing.id;
    }

    return null;
  } catch (err) {
    console.warn(`[taxonomyMutation] ⚠️ Role skill mapping insert skipped for (role:${roleId}, skill:${skillId}):`, err);
    return null;
  }
}


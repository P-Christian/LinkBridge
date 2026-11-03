// src/app/api/vos-admin/job-roles/skills/route.ts

import { NextRequest, NextResponse } from "next/server";
import { mapPool } from "@/lib/server/pool";
import { requireAdministrator } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

function toPositiveId(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

const MAPPING_COLUMNS = ["role_id", "skill_id", "importance_weight", "is_required"] as const;

function pickMappingColumns(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of MAPPING_COLUMNS) {
    if (body[col] !== undefined) out[col] = body[col];
  }
  return out;
}

const DEFAULT_ROLE_SKILL_MAPPINGS = [
  { role_id: 3, skill_id: 1, importance_weight: 1.0, is_required: 1 },
  { role_id: 3, skill_id: 2, importance_weight: 0.95, is_required: 1 },
  { role_id: 3, skill_id: 3, importance_weight: 0.95, is_required: 1 },
  { role_id: 3, skill_id: 4, importance_weight: 0.85, is_required: 0 },
  { role_id: 6, skill_id: 1, importance_weight: 1.0, is_required: 1 },
  { role_id: 6, skill_id: 5, importance_weight: 0.95, is_required: 1 },
  { role_id: 5, skill_id: 5, importance_weight: 1.0, is_required: 1 },
  { role_id: 5, skill_id: 7, importance_weight: 0.9, is_required: 1 },
  { role_id: 5, skill_id: 8, importance_weight: 0.95, is_required: 1 },
];

// The taxonomy tree and the skills table mount the same unfiltered read at the
// same time. Both saw an empty mapping table and both POSTed the nine defaults,
// so every mapping landed twice; one in-flight seed per process keeps them in
// step.
let seedInFlight: Promise<number> | null = null;

function seedDefaultMappings(): Promise<number> {
  seedInFlight ??= mapPool(
    DEFAULT_ROLE_SKILL_MAPPINGS,
    (item) =>
      fetch(`${DIRECTUS_BASE}/items/vs_role_skill_mapping`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(item),
      })
        .then((res) => res.ok)
        .catch(() => false)
  )
    .then((results) => results.filter((ok) => !ok).length)
    .finally(() => {
      seedInFlight = null;
    });
  return seedInFlight;
}

export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdministrator(req))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const isMaster = searchParams.get("master") === "true";

    if (isMaster) {
      const res = await fetch(`${DIRECTUS_BASE}/items/vs_master_skills?limit=-1`, {
        headers: getHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch master skills.");
      const json = await res.json();
      return NextResponse.json({ master_skills: json.data ?? [] });
    }

    const roleIdParam = searchParams.get("role_id");
    const roleId = roleIdParam === null ? null : toPositiveId(roleIdParam);
    if (roleIdParam !== null && roleId === null) {
      return NextResponse.json({ error: "Invalid role_id." }, { status: 400 });
    }
    const filterParam = roleId ? `&filter[role_id][_eq]=${roleId}` : "";

    // Fetch mappings, roles, and master skills in parallel for robust in-memory join
    const [mappingsRes, rolesRes, masterSkillsRes] = await Promise.all([
      fetch(`${DIRECTUS_BASE}/items/vs_role_skill_mapping?limit=-1${filterParam}`, { headers: getHeaders(), cache: "no-store" }),
      fetch(`${DIRECTUS_BASE}/items/vs_role_title?limit=-1`, { headers: getHeaders(), cache: "no-store" }),
      fetch(`${DIRECTUS_BASE}/items/vs_master_skills?limit=-1`, { headers: getHeaders(), cache: "no-store" }),
    ]);

    // A failed mappings read is not an empty table. Read as empty it used to
    // trigger the auto-seed below, which POSTed a second copy of every default
    // mapping on top of the rows already in the database.
    if (!mappingsRes.ok) {
      return NextResponse.json(
        { error: `Failed to read role-skill mappings (${mappingsRes.status}).` },
        { status: 502 }
      );
    }

    if (!rolesRes.ok || !masterSkillsRes.ok) {
      return NextResponse.json(
        {
          error: `Failed to read the role or master-skill lists (${rolesRes.status}/${masterSkillsRes.status}).`,
        },
        { status: 502 }
      );
    }

    const mappingsJson = await mappingsRes.json();
    const rolesJson = await rolesRes.json();
    const masterJson = await masterSkillsRes.json();

    let rawMappings = mappingsJson.data ?? [];
    const rolesList = rolesJson.data ?? [];
    const masterList = masterJson.data ?? [];

    const rolesMap = new Map(rolesList.map((r: { role_id: number; role_name: string }) => [Number(r.role_id), r.role_name]));
    const skillsMap = new Map(masterList.map((s: { id: number; skill_name: string }) => [Number(s.id), s.skill_name]));

    // If DB has no mappings yet and no role filter was requested, auto-seed standard defaults
    const seedWarnings: string[] = [];
    if (rawMappings.length === 0 && !roleId) {
      const missing = await seedDefaultMappings();
      if (missing > 0) {
        seedWarnings.push(`${missing} default role-skill mapping(s) could not be created.`);
      }

      const refetch = await fetch(`${DIRECTUS_BASE}/items/vs_role_skill_mapping?limit=-1`, { headers: getHeaders(), cache: "no-store" });
      if (refetch.ok) {
        rawMappings = (await refetch.json()).data ?? [];
      } else {
        seedWarnings.push("The seeded mappings could not be read back, so the list may be incomplete.");
      }
    }

    const formatted = rawMappings.map((m: { id: number; role_id: unknown; skill_id: unknown; importance_weight?: number; is_required?: boolean }) => {
      const rId = typeof m.role_id === "object" && m.role_id !== null ? (m.role_id as { role_id: number }).role_id : Number(m.role_id);
      const sId = typeof m.skill_id === "object" && m.skill_id !== null ? (m.skill_id as { id: number }).id : Number(m.skill_id);
      const rName = typeof m.role_id === "object" && m.role_id !== null ? (m.role_id as { role_name: string }).role_name : rolesMap.get(rId);
      const sName = typeof m.skill_id === "object" && m.skill_id !== null ? (m.skill_id as { skill_name: string }).skill_name : skillsMap.get(sId);

      return {
        id: m.id,
        role_id: rId,
        role_name: rName || `Role #${rId}`,
        skill_id: sId,
        skill_name: sName || `Skill #${sId}`,
        importance_weight: Number(m.importance_weight ?? 1.0),
        is_required: Boolean(m.is_required),
      };
    });

    return NextResponse.json({
      skills: formatted,
      ...(seedWarnings.length > 0 ? { warnings: seedWarnings } : {}),
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: safeErrorMessage(err, "Server error") }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdministrator(req))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();

    // 1. If requesting master skill creation or lookup
    if (body.create_master || body.master) {
      const skillName = (body.skill_name || "").trim();
      if (!skillName) {
        return NextResponse.json({ error: "Skill name is required." }, { status: 400 });
      }

      // Check if skill already exists in vs_master_skills
      const searchRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_master_skills?filter[skill_name][_icontains]=${encodeURIComponent(skillName)}`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (!searchRes.ok) {
        return NextResponse.json(
          { error: `Could not check whether "${skillName}" already exists, so no skill was created.` },
          { status: 502 }
        );
      }
      const searchJson = await searchRes.json();
      const existing = (searchJson.data ?? []).find(
        (m: { skill_name: string }) => m.skill_name.trim().toLowerCase() === skillName.toLowerCase()
      );
      if (existing) {
        return NextResponse.json(existing);
      }

      // Create new master skill
      const createRes = await fetch(`${DIRECTUS_BASE}/items/vs_master_skills`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ skill_name: skillName, category: body.category || "General" }),
      });
      if (!createRes.ok) {
        const errJson = await createRes.json().catch(() => ({}));
        throw new Error(errJson.errors?.[0]?.message || "Failed to create master skill.");
      }
      const createdJson = await createRes.json();
      return NextResponse.json(createdJson.data);
    }

    // 2. Normal role skill mapping creation
    let targetSkillId = body.skill_id;

    // If skill_name was passed without skill_id, resolve or create master skill
    if (!targetSkillId && body.skill_name) {
      const sName = body.skill_name.trim();
      const searchRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_master_skills?filter[skill_name][_icontains]=${encodeURIComponent(sName)}`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (!searchRes.ok) {
        // A failed lookup looked like "no such skill" and a second master skill
        // row was created for the same name.
        return NextResponse.json(
          { error: `Could not check whether "${sName}" already exists, so no skill was created.` },
          { status: 502 }
        );
      }
      const searchJson = await searchRes.json();
      const existing = (searchJson.data ?? []).find(
        (m: { skill_name: string }) => m.skill_name.trim().toLowerCase() === sName.toLowerCase()
      );
      if (existing) {
        targetSkillId = existing.id;
      }

      if (!targetSkillId) {
        const createRes = await fetch(`${DIRECTUS_BASE}/items/vs_master_skills`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ skill_name: sName }),
        });
        if (createRes.ok) {
          const createdJson = await createRes.json();
          targetSkillId = createdJson.data?.id;
        } else {
          const errJson = await createRes.json().catch(() => ({}));
          return NextResponse.json(
            {
              error:
                errJson.errors?.[0]?.message ||
                `Could not create the master skill "${sName}", so nothing was mapped.`,
            },
            { status: 502 }
          );
        }
      }
    }

    const roleId = toPositiveId(body.role_id);
    const skillId = toPositiveId(targetSkillId);
    if (!roleId || !skillId) {
      return NextResponse.json({ error: "role_id and skill_id are required." }, { status: 400 });
    }

    // Check if mapping already exists to prevent duplicate key errors
    const checkRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_role_skill_mapping?filter[role_id][_eq]=${roleId}&filter[skill_id][_eq]=${skillId}`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (checkRes.ok) {
      const checkJson = await checkRes.json();
      const existingMapping = checkJson.data?.[0];
      if (existingMapping) {
        // Already mapped: update weight and requirement
        const updateRes = await fetch(`${DIRECTUS_BASE}/items/vs_role_skill_mapping/${existingMapping.id}`, {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({
            importance_weight: Number(body.importance_weight ?? 1.0),
            is_required: body.is_required ? 1 : 0,
          }),
        });
        if (updateRes.ok) {
          const updatedJson = await updateRes.json();
          return NextResponse.json(updatedJson.data);
        }
        // Returning the stored row here answered 200 for a write that failed, so
        // the editor showed the new weight it had just been told to save.
        const errJson = await updateRes.json().catch(() => ({}));
        return NextResponse.json(
          {
            error:
              errJson.errors?.[0]?.message ||
              "This skill is already mapped to the role, and the change to it did not save.",
          },
          { status: updateRes.status }
        );
      }
    }

    // Insert new mapping
    const payload = {
      role_id: roleId,
      skill_id: skillId,
      importance_weight: Number(body.importance_weight ?? 1.0),
      is_required: body.is_required ? 1 : 0,
    };

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_role_skill_mapping`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.errors?.[0]?.message || "Failed to create role skill mapping.");
    }
    const json = await res.json();

    // Lookup skill name for full hydration
    let resolvedSkillName = body.skill_name;
    if (!resolvedSkillName) {
      const skillLookup = await fetch(`${DIRECTUS_BASE}/items/vs_master_skills/${skillId}`, {
        headers: getHeaders(),
        cache: "no-store",
      }).catch(() => null);
      if (skillLookup?.ok) {
        const sJson = await skillLookup.json();
        resolvedSkillName = sJson.data?.skill_name;
      }
    }

    const createdRecord = {
      id: json.data?.id,
      role_id: roleId,
      skill_id: skillId,
      skill_name: resolvedSkillName || `Skill #${skillId}`,
      importance_weight: Number(body.importance_weight ?? 1.0),
      is_required: Boolean(body.is_required),
    };

    return NextResponse.json(createdRecord);
  } catch (err: unknown) {
    return NextResponse.json({ error: safeErrorMessage(err, "Server error") }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!(await requireAdministrator(req))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const mappingId = toPositiveId(body?.id);
    if (!mappingId) return NextResponse.json({ error: "Mapping ID required." }, { status: 400 });

    const updates = pickMappingColumns(body);
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided." }, { status: 400 });
    }

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_role_skill_mapping/${mappingId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update role skill mapping.");
    const json = await res.json();
    return NextResponse.json(json.data);
  } catch (err: unknown) {
    return NextResponse.json({ error: safeErrorMessage(err, "Server error") }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await requireAdministrator(req))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const mappingId = toPositiveId(searchParams.get("id"));
    if (!mappingId) return NextResponse.json({ error: "Mapping ID required." }, { status: 400 });

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_role_skill_mapping/${mappingId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete role skill mapping.");
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: safeErrorMessage(err, "Server error") }, { status: 500 });
  }
}

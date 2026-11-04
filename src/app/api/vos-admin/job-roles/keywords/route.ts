// src/app/api/vos-admin/job-roles/keywords/route.ts

import { NextRequest, NextResponse } from "next/server";
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

const ALIAS_COLUMNS = ["role_id", "alias_name", "normalized_alias", "match_weight", "is_primary", "alias_type", "is_active"] as const;

function pickAliasColumns(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of ALIAS_COLUMNS) {
    if (body[col] !== undefined) out[col] = body[col];
  }
  return out;
}

function toPositiveId(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdministrator(req))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roleIdParam = searchParams.get("role_id");
    const roleId = roleIdParam === null ? null : toPositiveId(roleIdParam);
    if (roleIdParam !== null && roleId === null) {
      return NextResponse.json({ error: "Invalid role_id." }, { status: 400 });
    }
    const filterParam = roleId ? `&filter[role_id][_eq]=${roleId}` : "";

    const [aliasRes, rolesRes] = await Promise.all([
      fetch(`${DIRECTUS_BASE}/items/vs_role_title_alias?limit=-1${filterParam}`, { headers: getHeaders(), cache: "no-store" }),
      fetch(`${DIRECTUS_BASE}/items/vs_role_title?limit=-1`, { headers: getHeaders(), cache: "no-store" }),
    ]);

    // Either read failing used to answer with an empty keyword list, which an
    // administrator reads as "the synonyms are gone".
    if (!aliasRes.ok || !rolesRes.ok) {
      return NextResponse.json(
        { error: "The keyword taxonomy could not be read. Please try again." },
        { status: 502 }
      );
    }

    const aliasJson = await aliasRes.json();
    const rolesJson = await rolesRes.json();

    const rawAliases = aliasJson.data ?? [];
    const rolesList = rolesJson.data ?? [];
    const rolesMap = new Map(rolesList.map((r: { role_id: number; role_name: string }) => [Number(r.role_id), r.role_name]));

    const formatted = rawAliases.map((a: { alias_id: number; role_id: unknown; alias_name: string; normalized_alias?: string; match_weight?: number; is_primary?: boolean; is_active?: unknown }) => {
      const rId = typeof a.role_id === "object" && a.role_id !== null ? (a.role_id as { role_id: number }).role_id : Number(a.role_id);
      const rName = typeof a.role_id === "object" && a.role_id !== null ? (a.role_id as { role_name: string }).role_name : rolesMap.get(rId);

      return {
        alias_id: a.alias_id,
        role_id: rId,
        role_name: rName || `Role #${rId}`,
        alias_name: a.alias_name,
        normalized_alias: a.normalized_alias,
        match_weight: Number(a.match_weight ?? 1.0),
        is_primary: Boolean(a.is_primary),
        is_active: a.is_active !== false && a.is_active !== 0 && a.is_active !== "false",
      };
    });

    return NextResponse.json({ keywords: formatted });
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
    if (process.env.NODE_ENV !== "production") {
      console.log("[keywords route POST] Payload received:", body);
    }
    const res = await fetch(`${DIRECTUS_BASE}/items/vs_role_title_alias`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(pickAliasColumns(body)),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[keywords route POST] ❌ Directus error (HTTP ${res.status}):`, errText);

      // Check if error is RECORD_NOT_UNIQUE
      if (errText.includes("RECORD_NOT_UNIQUE") || errText.includes("has to be unique")) {
        const norm = body.normalized_alias || (body.alias_name ? body.alias_name.trim().toLowerCase() : "");
        if (norm) {
          // Query Directus for the existing record
          const existingRes = await fetch(`${DIRECTUS_BASE}/items/vs_role_title_alias?filter[normalized_alias][_eq]=${encodeURIComponent(norm)}`, {
            headers: getHeaders(),
            cache: "no-store",
          });
          if (existingRes.ok) {
            const existingJson = await existingRes.json();
            const existingItem = existingJson.data?.[0];
            if (existingItem) {
              console.log(`[keywords route POST] ↻ Found existing alias #${existingItem.alias_id} for "${norm}" — returning existing record`);
              return NextResponse.json(existingItem);
            }
          }
        }
        return NextResponse.json({ error: `Keyword "${body.alias_name || 'entry'}" already exists in the database.` }, { status: 409 });
      }

      return NextResponse.json({ error: `Directus error (${res.status}): ${errText || res.statusText}` }, { status: res.status });
    }

    const json = await res.json();
    return NextResponse.json(json.data);
  } catch (err: unknown) {
    console.error("[keywords route POST] 💥 Internal error:", err);
    return NextResponse.json({ error: safeErrorMessage(err, "Server error") }, { status: 500 });
  }
}



export async function PATCH(req: NextRequest) {
  try {
    if (!(await requireAdministrator(req))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const aliasId = toPositiveId(body?.alias_id);
    if (!aliasId) return NextResponse.json({ error: "Alias ID required." }, { status: 400 });

    const updates = pickAliasColumns(body);
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided." }, { status: 400 });
    }

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_role_title_alias/${aliasId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update search keyword.");
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
    const aliasId = toPositiveId(searchParams.get("id"));
    if (!aliasId) return NextResponse.json({ error: "Alias ID required." }, { status: 400 });

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_role_title_alias/${aliasId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete search keyword.");
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: safeErrorMessage(err, "Server error") }, { status: 500 });
  }
}

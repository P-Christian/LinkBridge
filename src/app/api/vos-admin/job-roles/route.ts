// src/app/api/vos-admin/job-roles/route.ts

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

/**
 * A count that could not be read must not answer `0`. These five figures are
 * rendered as the size of the taxonomy, so a Directus outage looked exactly like
 * an administrator having emptied it.
 */
async function readCount(collection: string, countKey: string, extra = ""): Promise<number> {
  const res = await fetch(
    `${DIRECTUS_BASE}/items/${collection}?aggregate[count]=${countKey}${extra}`,
    { headers: getHeaders(), cache: "no-store" }
  );
  if (!res.ok) throw new Error(`${collection} count could not be read (${res.status}).`);
  const json = await res.json();
  return Number(json?.data?.[0]?.count?.[countKey] ?? 0);
}

export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdministrator(req))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const [
      totalCategories,
      totalStandardRoles,
      totalSearchKeywords,
      totalRoleSkills,
      pendingRequests,
    ] = await Promise.all([
      readCount("vs_role_category", "category_id"),
      readCount("vs_role_title", "role_id"),
      readCount("vs_role_title_alias", "alias_id"),
      readCount("vs_role_skill_mapping", "id"),
      readCount("vs_role_category_suggestion", "suggestion_id", "&filter[status][_eq]=PENDING"),
    ]);

    return NextResponse.json({
      totalCategories,
      totalStandardRoles,
      totalSearchKeywords,
      totalRoleSkills,
      pendingRequests,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: safeErrorMessage(err, "Failed to fetch dashboard metrics.") }, { status: 500 });
  }
}

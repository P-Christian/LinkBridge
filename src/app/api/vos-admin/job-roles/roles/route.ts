// src/app/api/vos-admin/job-roles/roles/route.ts

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/authenticated-session";
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

async function authorizeAdmin(req: NextRequest) {
  const session = await authenticateRequest(req);
  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  const roleName = (session.roleName || "").toUpperCase();
  if (session.roleId !== 3 && roleName !== "ADMIN") {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Forbidden: Restricted to administrators." },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, session };
}

function toPositiveId(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeAdmin(req);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const rawCategoryId = searchParams.get("category_id");
    const categoryId = rawCategoryId === null ? null : toPositiveId(rawCategoryId);
    if (rawCategoryId !== null && categoryId === null) {
      return NextResponse.json({ error: "Invalid category_id." }, { status: 400 });
    }
    const filterParam = categoryId ? `&filter[category_id][_eq]=${categoryId}` : "";

    const [rolesRes, catRes] = await Promise.all([
      fetch(`${DIRECTUS_BASE}/items/vs_role_title?limit=-1${filterParam}`, { headers: getHeaders(), cache: "no-store" }),
      fetch(`${DIRECTUS_BASE}/items/vs_role_category?limit=-1`, { headers: getHeaders(), cache: "no-store" }),
    ]);

    // An unreadable roles or categories table used to answer with an empty list,
    // which is indistinguishable from an administrator having deleted the taxonomy.
    if (!rolesRes.ok || !catRes.ok) {
      return NextResponse.json(
        { error: "The role taxonomy could not be read. Please try again." },
        { status: 502 }
      );
    }

    const rolesJson = await rolesRes.json();
    const catJson = await catRes.json();

    const rawRoles = rolesJson.data ?? [];
    const catList = catJson.data ?? [];
    const catMap = new Map(catList.map((c: { category_id: number; category_name: string }) => [Number(c.category_id), c.category_name]));
    const catCodeMap = new Map(catList.map((c: { category_id: number; category_code: string }) => [Number(c.category_id), c.category_code]));

    const formatted = rawRoles.map((r: { role_id: number; role_name: string; category_id: unknown; experience_level?: string; is_active?: boolean }) => {
      const cId = typeof r.category_id === "object" && r.category_id !== null ? (r.category_id as { category_id: number }).category_id : Number(r.category_id);
      const cName = typeof r.category_id === "object" && r.category_id !== null ? (r.category_id as { category_name: string }).category_name : catMap.get(cId);
      const cCode = typeof r.category_id === "object" && r.category_id !== null ? (r.category_id as { category_code: string }).category_code : catCodeMap.get(cId);

      return {
        role_id: r.role_id,
        role_name: r.role_name,
        category_id: cId,
        category_name: cName || `Category #${cId}`,
        category_code: cCode || "",
        experience_level: r.experience_level || "MID",
        is_active: Boolean(r.is_active),
      };
    });

    return NextResponse.json({ roles: formatted });
  } catch (err: unknown) {
    return NextResponse.json({ error: safeErrorMessage(err, "Server error") }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeAdmin(req);
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const res = await fetch(`${DIRECTUS_BASE}/items/vs_role_title`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed to create standard role.");
    const json = await res.json();
    return NextResponse.json(json.data);
  } catch (err: unknown) {
    return NextResponse.json({ error: safeErrorMessage(err, "Server error") }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authorizeAdmin(req);
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const { role_id, ...updates } = body;
    const roleId = toPositiveId(role_id);
    if (!roleId) return NextResponse.json({ error: "Role ID required." }, { status: 400 });

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_role_title/${roleId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update standard role.");
    const json = await res.json();
    return NextResponse.json(json.data);
  } catch (err: unknown) {
    return NextResponse.json({ error: safeErrorMessage(err, "Server error") }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await authorizeAdmin(req);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const id = toPositiveId(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "Role ID required." }, { status: 400 });

    // Safeguard dependency checks before hard deletion
    const [skillsCheckRes, aliasCheckRes, jobsCheckRes] = await Promise.all([
      fetch(`${DIRECTUS_BASE}/items/vs_role_skill_mapping?filter[role_id][_eq]=${id}&limit=1`, {
        headers: getHeaders(),
        cache: "no-store",
      }),
      fetch(`${DIRECTUS_BASE}/items/vs_role_title_alias?filter[role_id][_eq]=${id}&limit=1`, {
        headers: getHeaders(),
        cache: "no-store",
      }),
      fetch(`${DIRECTUS_BASE}/items/vs_job_posting?filter[role_id][_eq]=${id}&limit=1`, {
        headers: getHeaders(),
        cache: "no-store",
      }),
    ]);

    const skillsCount = (await skillsCheckRes.json().catch(() => ({})))?.data?.length ?? 0;
    const aliasCount = (await aliasCheckRes.json().catch(() => ({})))?.data?.length ?? 0;
    const jobsCount = (await jobsCheckRes.json().catch(() => ({})))?.data?.length ?? 0;

    if (skillsCount > 0 || aliasCount > 0 || jobsCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete: Standard role has mapped skills, search keywords, or job postings. Deactivate (set to Inactive) instead to preserve data integrity.`,
        },
        { status: 409 }
      );
    }

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_role_title/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete standard role.");
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: safeErrorMessage(err, "Server error") }, { status: 500 });
  }
}

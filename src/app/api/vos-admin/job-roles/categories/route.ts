// src/app/api/vos-admin/job-roles/categories/route.ts

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

async function authorizeAdmin(req: NextRequest) {
  const session = await requireAdministrator(req);
  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  return { authorized: true, session };
}

function toPositiveId(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

const CATEGORY_COLUMNS = ["category_code", "category_name", "description", "is_active"] as const;

function pickCategoryColumns(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of CATEGORY_COLUMNS) {
    if (body[col] !== undefined) out[col] = body[col];
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeAdmin(req);
    if (!auth.authorized) return auth.response;

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_role_category?limit=-1`, {
      headers: getHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch job categories.");
    const json = await res.json();
    return NextResponse.json({ categories: json.data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: safeErrorMessage(err, "Server error") }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeAdmin(req);
    if (!auth.authorized) return auth.response;
    const body = await req.json();
    const payload = pickCategoryColumns(body);
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "No writable fields provided." }, { status: 400 });
    }
    const res = await fetch(`${DIRECTUS_BASE}/items/vs_role_category`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create job category.");
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
    const categoryId = toPositiveId(body?.category_id);
    if (!categoryId) return NextResponse.json({ error: "Category ID required." }, { status: 400 });

    const updates = pickCategoryColumns(body);
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided." }, { status: 400 });
    }

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_role_category/${categoryId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update job category.");
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
    const categoryId = toPositiveId(searchParams.get("id"));
    if (!categoryId) return NextResponse.json({ error: "Category ID required." }, { status: 400 });

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_role_category/${categoryId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete job category.");
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: safeErrorMessage(err, "Server error") }, { status: 500 });
  }
}

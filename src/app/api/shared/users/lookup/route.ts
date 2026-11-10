// src/app/api/shared/users/lookup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/authenticated-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const userCache = new Map<number, string>();

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    if (userCache.has(id)) {
      return NextResponse.json({ name: userCache.get(id) });
    }

    const raw =
      process.env.DIRECTUS_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:8055";
    const base = raw.replace(/\/$/, "");
    const token =
      process.env.DIRECTUS_STATIC_TOKEN?.trim() ||
      process.env.WEBSOCKET_ACCESS_TOKEN?.trim() ||
      "";

    const res = await fetch(
      `${base}/items/vs_user/${id}?fields=user_fname,user_lname`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      }
    );

    if (res.ok) {
      const json = await res.json();
      const u = json.data;
      if (u) {
        const fname = typeof u.user_fname === "string" ? u.user_fname.trim() : "";
        const lname = typeof u.user_lname === "string" ? u.user_lname.trim() : "";
        const fullName = `${fname} ${lname}`.trim();
        if (fullName) {
          userCache.set(id, fullName);
          return NextResponse.json({ name: fullName });
        }
      }
    }

    return NextResponse.json({ name: null });
  } catch {
    return NextResponse.json({ name: null });
  }
}

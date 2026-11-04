// src/app/api/auth/google/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/authenticated-session";
import { getUserIdentityByUserId } from "@/modules/auth/google/google.service";
import { getUserById } from "@/modules/auth/services/auth.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const [identity, user] = await Promise.all([
      getUserIdentityByUserId(session.userId, "google"),
      getUserById(session.userId),
    ]);

    const storedHash = user?.hash_password || user?.user_password;
    const hasPassword = Boolean(storedHash && String(storedHash).trim() !== "");

    const resolvedName =
      ((identity as Record<string, unknown> | null)?.provider_name as string | undefined) ||
      ((identity as Record<string, unknown> | null)?.name as string | undefined) ||
      [user?.user_fname || user?.first_name, user?.user_lname || user?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      null;

    return NextResponse.json({
      ok: true,
      connected: Boolean(identity),
      name: resolvedName,
      email: identity?.provider_email ?? null,
      linked_at: identity?.linked_at ?? null,
      has_password: hasPassword,
    });
  } catch (error: unknown) {
    console.error("[GET /api/auth/google/status] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch Google connection status." },
      { status: 500 }
    );
  }
}

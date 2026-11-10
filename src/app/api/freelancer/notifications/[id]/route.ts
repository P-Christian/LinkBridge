// src/app/api/freelancer/notifications/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest, isFreelancerSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await authenticateRequest(req);
    if (!session || !isFreelancerSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Freelancer access required." : "Unauthorized." },
        { status: session ? 403 : 401 }
      );
    }

    const userId = Number(session.userId);

    const body = await req.json().catch(() => ({}));
    const payload: Record<string, unknown> = {};
    if (body.is_read !== undefined) payload.is_read = body.is_read;
    if (body.is_starred !== undefined) payload.is_starred = body.is_starred;

    // Verify ownership
    const checkRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_freelancer_notification/${id}?fields=user_id`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (!checkRes.ok) {
      return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    }
    const checkJson = await checkRes.json();
    if (checkJson.data?.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden. You do not own this notification." }, { status: 403 });
    }

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_freelancer_notification/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.errors?.[0]?.message ?? "Failed to update notification." },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("PATCH /api/freelancer/notifications/[id] error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

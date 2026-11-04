// src/app/api/school-admin/notifications/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest, hasRole } from "@/lib/authenticated-session";
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
    if (!session || !hasRole(session, [3, 4], ["ADMIN", "SCHOOL_ADMIN", "SCH_ADMIN", "SCHOOL ADMINISTRATOR"])) {
      return NextResponse.json(
        { error: session ? "Forbidden: School administrator access required." : "Unauthorized." },
        { status: session ? 403 : 401 }
      );
    }

    const userId = Number(session.userId);

    const body = await req.json();
    const isRead = body.is_read;

    // Check if notification belongs to user
    const checkRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_freelancer_notification/${id}?fields=user_id`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!checkRes.ok) {
      return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    }

    const checkJson = await checkRes.json();
    const notification = checkJson.data;

    if (!notification || notification.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 403 });
    }

    // Update notification
    const updateRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_freelancer_notification/${id}`,
      {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ is_read: isRead }),
      }
    );

    if (!updateRes.ok) {
      return NextResponse.json({ error: "Failed to update notification." }, { status: updateRes.status });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("PATCH /api/school-admin/notifications/[id] error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

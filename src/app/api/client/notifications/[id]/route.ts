import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/$/,
  ""
);
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) {
    headers.Authorization = `Bearer ${DIRECTUS_TOKEN}`;
  }
  return headers;
}

// ─── PATCH — Mark single notification as read / unread / starred ──────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const notificationId = parseInt(id, 10);

    if (!notificationId || isNaN(notificationId)) {
      return NextResponse.json(
        { error: "Invalid notification ID." },
        { status: 400 }
      );
    }

    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isClientSession(session)) {
      return NextResponse.json({ error: "Forbidden: employer access required." }, { status: 403 });
    }

    const userId = Number(session.userId);

    // Verify the notification belongs to this user before updating
    const checkRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_employer_notification/${notificationId}?fields=notification_id,user_id`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!checkRes.ok) {
      return NextResponse.json(
        { error: "Notification not found." },
        { status: 404 }
      );
    }

    const checkJson = await checkRes.json();
    const notification = checkJson.data;

    if (!notification || Number(notification.user_id) !== userId) {
      return NextResponse.json(
        { error: "Not authorized to update this notification." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const patchData: Record<string, unknown> = {};

    if (typeof body.is_read === "boolean") {
      patchData.is_read = body.is_read ? 1 : 0;
    }
    if (typeof body.is_starred === "boolean") {
      patchData.is_starred = body.is_starred ? 1 : 0;
    }

    if (Object.keys(patchData).length === 0) {
      patchData.is_read = 1;
    }

    // Update notification in Directus
    const patchRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_employer_notification/${notificationId}`,
      {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify(patchData),
      }
    );

    if (!patchRes.ok) {
      const text = await patchRes.text();
      console.error("Directus notification update error:", text);
      return NextResponse.json(
        { error: "Failed to update notification." },
        { status: patchRes.status }
      );
    }

    return NextResponse.json({ success: true, ...patchData });
  } catch (err: unknown) {
    console.error("PATCH /api/client/notifications/[id] error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// ─── DELETE — Delete single notification ──────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const notificationId = parseInt(id, 10);

    if (!notificationId || isNaN(notificationId)) {
      return NextResponse.json(
        { error: "Invalid notification ID." },
        { status: 400 }
      );
    }

    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isClientSession(session)) {
      return NextResponse.json({ error: "Forbidden: employer access required." }, { status: 403 });
    }

    const userId = Number(session.userId);

    // Verify ownership
    const checkRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_employer_notification/${notificationId}?fields=notification_id,user_id`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!checkRes.ok) {
      return NextResponse.json(
        { error: "Notification not found." },
        { status: 404 }
      );
    }

    const checkJson = await checkRes.json();
    const notification = checkJson.data;

    if (!notification || Number(notification.user_id) !== userId) {
      return NextResponse.json(
        { error: "Not authorized to delete this notification." },
        { status: 403 }
      );
    }

    const delRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_employer_notification/${notificationId}`,
      {
        method: "DELETE",
        headers: getHeaders(),
      }
    );

    if (!delRes.ok) {
      const text = await delRes.text();
      console.error("Directus delete error:", text);
      return NextResponse.json(
        { error: "Failed to delete notification." },
        { status: delRes.status }
      );
    }

    return NextResponse.json({ success: true, deleted_id: notificationId });
  } catch (err: unknown) {
    console.error("DELETE /api/client/notifications/[id] error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

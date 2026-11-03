// src/app/api/school-admin/notifications/route.ts
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

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !hasRole(session, [3, 4], ["ADMIN", "SCHOOL_ADMIN", "SCH_ADMIN", "SCHOOL ADMINISTRATOR"])) {
      return NextResponse.json(
        { error: session ? "Forbidden: School administrator access required." : "Unauthorized." },
        { status: session ? 403 : 401 }
      );
    }

    const userId = Number(session.userId);

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread_only") === "true";
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    let filterQuery = `filter[user_id][_eq]=${userId}`;
    if (unreadOnly) {
      filterQuery += `&filter[is_read][_eq]=0`;
    }

    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_freelancer_notification?${filterQuery}&sort[]=-created_at&limit=${limit}&offset=${offset}`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.errors?.[0]?.message ?? "Failed to load notifications." },
        { status: res.status }
      );
    }

    const json = await res.json();
    const notifications = json.data ?? [];
    
    // Count total unread notifications for this user
    const countRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_freelancer_notification?filter[user_id][_eq]=${userId}&filter[is_read][_eq]=0&limit=0&meta=filter_count`,
      { headers: getHeaders(), cache: "no-store" }
    );
    let unreadCount = 0;
    if (countRes.ok) {
      const countJson = await countRes.json();
      unreadCount = countJson.meta?.filter_count ?? 0;
    } else {
      unreadCount = notifications.filter((n: { is_read?: boolean | number }) => n.is_read === false || n.is_read === 0).length;
    }

    return NextResponse.json({ notifications, unreadCount });
  } catch (err: unknown) {
    console.error("GET /api/school-admin/notifications error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !hasRole(session, [3, 4], ["ADMIN", "SCHOOL_ADMIN", "SCH_ADMIN", "SCHOOL ADMINISTRATOR"])) {
      return NextResponse.json(
        { error: session ? "Forbidden: School administrator access required." : "Unauthorized." },
        { status: session ? 403 : 401 }
      );
    }

    const userId = Number(session.userId);

    // Fetch unread notifications
    const unreadRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_freelancer_notification?filter[user_id][_eq]=${userId}&filter[is_read][_eq]=0&limit=-1&fields=notification_id`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!unreadRes.ok) {
      return NextResponse.json({ error: "Failed to fetch unread list." }, { status: unreadRes.status });
    }

    const unreadJson = await unreadRes.json();
    const unreadList = unreadJson.data || [];

    if (unreadList.length > 0) {
      // Mark all as read
      const updatePromises = unreadList.map((item: { notification_id: number }) =>
        fetch(`${DIRECTUS_BASE}/items/vs_freelancer_notification/${item.notification_id}`, {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({ is_read: true }),
        })
      );
      await Promise.all(updatePromises);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("PATCH /api/school-admin/notifications error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

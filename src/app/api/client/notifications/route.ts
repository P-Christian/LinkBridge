// src/app/api/client/notifications/route.ts

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";
import { pageParams } from "@/lib/server/paging";

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

async function getUnreadCount(userId: number): Promise<number> {
  try {
    const countRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_employer_notification?filter[user_id][_eq]=${userId}&filter[is_read][_eq]=0&fields=notification_id&limit=500`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (!countRes.ok) return 0;
    const countJson = await countRes.json();
    return (countJson.data ?? []).length;
  } catch {
    return 0;
  }
}

// ─── GET — Fetch notifications for logged-in user ─────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isClientSession(session)) {
      return NextResponse.json({ error: "Forbidden: employer access required." }, { status: 403 });
    }

    const userId = Number(session.userId);

    const { searchParams } = new URL(req.url);
    const countOnly = searchParams.get("count_only") === "true";
    const unreadOnly = searchParams.get("unread_only") === "true";
    const starredOnly = searchParams.get("starred_only") === "true";

    // Fast path: sidebar and badge polling only needs the unread count
    if (countOnly) {
      try {
        const countRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_employer_notification?filter[user_id][_eq]=${userId}&filter[is_read][_eq]=0&limit=0&meta=filter_count`,
          { headers: getHeaders(), cache: "no-store" }
        );
        let unreadCount = 0;
        if (countRes.ok) {
          const countJson = await countRes.json();
          unreadCount = countJson.meta?.filter_count ?? 0;
        }
        return NextResponse.json({ unreadCount, unread_count: unreadCount, notifications: [] });
      } catch (countErr: unknown) {
        console.warn("[Employer notifications] Count fetch error:", countErr instanceof Error ? countErr.message : countErr);
        return NextResponse.json({ unreadCount: 0, unread_count: 0, notifications: [] });
      }
    }

    // Shared clamp: ?limit=abc used to reach Directus as limit=NaN (a 400 the
    // panel shows as a failed list), ?limit=-1 is Directus's "no limit" sentinel
    // and would read the whole table, and a negative offset shifts the range.
    const { limit: rawLimit, offset } = pageParams(searchParams);
    const limit = searchParams.has("limit") ? Math.min(rawLimit, 100) : 20;

    // Build filter query against vs_employer_notification
    let filterQuery = `filter[user_id][_eq]=${userId}`;
    if (unreadOnly) {
      filterQuery += `&filter[is_read][_eq]=0`;
    }
    if (starredOnly) {
      filterQuery += `&filter[is_starred][_eq]=1`;
    }

    // Fetch notifications flat
    let notifRes: Response;
    try {
      notifRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_employer_notification?${filterQuery}&sort[]=-created_at&limit=${limit}&offset=${offset}&fields=notification_id,user_id,event_id,category,title,message,action_url,is_read,is_starred,created_at`,
        {
          headers: getHeaders(),
          cache: "no-store",
        }
      );
    } catch (fetchErr: unknown) {
      console.warn("[Employer notifications] Upstream socket/network error:", fetchErr instanceof Error ? fetchErr.message : fetchErr);
      // An unreachable Directus is not "no notifications"; the bell panel shows
      // this reason instead of an empty list that looks like nothing arrived.
      return NextResponse.json(
        { error: "Notifications could not be loaded right now." },
        { status: 502 }
      );
    }

    if (!notifRes.ok) {
      const text = await notifRes.text().catch(() => "");
      console.error("[Employer notifications] Directus fetch error:", text);
      return NextResponse.json(
        { error: "Failed to fetch notifications." },
        { status: notifRes.status }
      );
    }

    const notifJson = await notifRes.json();
    const rawData: Record<string, unknown>[] = notifJson.data ?? [];

    // Normalize — all display info (title, message, category, is_read, is_starred)
    const notifications = rawData.map((n) => ({
      notification_id: n.notification_id,
      user_id: n.user_id,
      event_id: typeof n.event_id === "number" ? n.event_id : null,
      category: n.category,
      title: n.title,
      message: n.message,
      action_url: n.action_url ?? null,
      is_read: n.is_read === 1 || n.is_read === true,
      is_starred: n.is_starred === 1 || n.is_starred === true,
      created_at: n.created_at,
      event_type: null,
      entity_type: null,
      entity_id: null,
    }));

    const unreadCount = unreadOnly
      ? notifications.length
      : notifications.filter((n) => !n.is_read).length;

    return NextResponse.json({ notifications, unreadCount, unread_count: unreadCount });
  } catch (err: unknown) {
    console.error("GET /api/client/notifications error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// ─── PATCH — Bulk update notification status or mark all as read ──────────

export async function PATCH(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isClientSession(session)) {
      return NextResponse.json({ error: "Forbidden: employer access required." }, { status: 403 });
    }

    const userId = Number(session.userId);
    const body = await req.json().catch(() => ({}));

    // Mode 1: Mark all as read
    if (body.mark_all_read) {
      // One 500-row page used to be read as "everything is clear": a failed
      // fetch answered `unread_count: 0`, and an account with more than one
      // page of unread rows had the rest left unread behind the same zero.
      const PAGE = 500;
      const MAX_PAGES = 20;
      let updated = 0;

      for (let page = 0; page < MAX_PAGES; page++) {
        const listRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_employer_notification?filter[user_id][_eq]=${userId}&filter[is_read][_eq]=0&fields=notification_id&limit=${PAGE}`,
          { headers: getHeaders(), cache: "no-store" }
        );

        if (!listRes.ok) {
          return NextResponse.json(
            {
              error:
                updated > 0
                  ? `${updated} notification(s) were marked as read, but the rest could not be read. Please try again.`
                  : "Notifications could not be read. Nothing was marked as read. Please try again.",
            },
            { status: 502 }
          );
        }

        const listJson = await listRes.json();
        const ids: number[] = ((listJson.data ?? []) as Array<{ notification_id: number }>)
          .map((n) => Number(n.notification_id))
          .filter((id) => Number.isFinite(id) && id > 0);

        if (ids.length === 0) {
          return NextResponse.json({ success: true, updated, unread_count: 0 });
        }

        const patchRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_employer_notification`,
          {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify({
              keys: ids,
              data: { is_read: 1 },
            }),
          }
        );

        if (!patchRes.ok) {
          const text = await patchRes.text();
          console.error("Directus bulk mark-read error:", text);
          return NextResponse.json(
            { error: "Failed to mark notifications as read." },
            { status: patchRes.status }
          );
        }

        updated += ids.length;

        // A short page means the unread set is exhausted.
        if (ids.length < PAGE) {
          return NextResponse.json({ success: true, updated, unread_count: 0 });
        }
      }

      return NextResponse.json({
        success: true,
        updated,
        unread_count: null,
        warnings: [
          "Only the first batch of unread notifications could be cleared. Reload the list and mark the rest again.",
        ],
      });
    }

    // Mode 2: Bulk update specific notification_ids
    if (Array.isArray(body.notification_ids)) {
      const targetIds = body.notification_ids
        .map((id: unknown) => Number(id))
        .filter((id: number) => !isNaN(id) && id > 0);

      if (targetIds.length === 0) {
        return NextResponse.json(
          { error: "Invalid notification_ids list." },
          { status: 400 }
        );
      }

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

      // Verify ownership
      const checkRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_employer_notification?filter[user_id][_eq]=${userId}&filter[notification_id][_in]=${targetIds.join(",")}&fields=notification_id&limit=500`,
        { headers: getHeaders(), cache: "no-store" }
      );

      if (!checkRes.ok) {
        return NextResponse.json(
          { error: "Failed to verify notifications." },
          { status: checkRes.status }
        );
      }

      const checkJson = await checkRes.json();
      const verifiedIds: number[] = (checkJson.data ?? []).map(
        (n: { notification_id: number }) => n.notification_id
      );

      if (verifiedIds.length === 0) {
        const unreadCount = await getUnreadCount(userId);
        return NextResponse.json({ success: true, updated: 0, unread_count: unreadCount });
      }

      const patchRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_employer_notification`,
        {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({
            keys: verifiedIds,
            data: patchData,
          }),
        }
      );

      if (!patchRes.ok) {
        const text = await patchRes.text();
        console.error("Directus bulk update status error:", text);
        return NextResponse.json(
          { error: "Failed to update notification status." },
          { status: patchRes.status }
        );
      }

      const unreadCount = await getUnreadCount(userId);
      return NextResponse.json({
        success: true,
        updated: verifiedIds.length,
        unread_count: unreadCount,
      });
    }

    return NextResponse.json(
      { error: "Invalid request. Provide mark_all_read: true or notification_ids array." },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error("PATCH /api/client/notifications error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// ─── DELETE — Bulk delete notifications for the user ──────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isClientSession(session)) {
      return NextResponse.json({ error: "Forbidden: employer access required." }, { status: 403 });
    }

    const userId = Number(session.userId);
    const body = await req.json().catch(() => ({}));

    if (!Array.isArray(body.notification_ids)) {
      return NextResponse.json(
        { error: "Invalid request. Provide notification_ids array." },
        { status: 400 }
      );
    }

    const targetIds = body.notification_ids
      .map((id: unknown) => Number(id))
      .filter((id: number) => !isNaN(id) && id > 0);

    if (targetIds.length === 0) {
      return NextResponse.json(
        { error: "No valid notification IDs provided." },
        { status: 400 }
      );
    }

    // Verify ownership
    const checkRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_employer_notification?filter[user_id][_eq]=${userId}&filter[notification_id][_in]=${targetIds.join(",")}&fields=notification_id&limit=500`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!checkRes.ok) {
      return NextResponse.json(
        { error: "Failed to verify notifications." },
        { status: checkRes.status }
      );
    }

    const checkJson = await checkRes.json();
    const verifiedIds: number[] = (checkJson.data ?? []).map(
      (n: { notification_id: number }) => n.notification_id
    );

    if (verifiedIds.length === 0) {
      const unreadCount = await getUnreadCount(userId);
      return NextResponse.json({ success: true, deleted: 0, unread_count: unreadCount });
    }

    const delRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_employer_notification`,
      {
        method: "DELETE",
        headers: getHeaders(),
        body: JSON.stringify(verifiedIds),
      }
    );

    if (!delRes.ok) {
      const text = await delRes.text();
      console.error("Directus bulk delete error:", text);
      return NextResponse.json(
        { error: "Failed to delete notifications." },
        { status: delRes.status }
      );
    }

    const unreadCount = await getUnreadCount(userId);
    return NextResponse.json({
      success: true,
      deleted: verifiedIds.length,
      unread_count: unreadCount,
    });
  } catch (err: unknown) {
    console.error("DELETE /api/client/notifications error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

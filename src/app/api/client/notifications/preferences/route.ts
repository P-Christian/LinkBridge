// src/app/api/client/notifications/preferences/route.ts

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

/** The known category set is ~15; this bounds the writes one PUT can trigger. */
const MAX_PREFERENCES_PER_REQUEST = 50;

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

// ─── GET — Fetch notification preferences for logged-in user ─────────────

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

    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_notification_preference?filter[user_id][_eq]=${userId}&fields=preference_id,user_id,category,email_enabled,in_app_enabled,updated_at&sort[]=-updated_at&sort[]=-preference_id&limit=100`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Directus preferences fetch error:", text);
      return NextResponse.json(
        { error: "Failed to fetch notification preferences." },
        { status: res.status }
      );
    }

    const json = await res.json();
    const rawPrefs: Record<string, unknown>[] = json.data ?? [];

    const existingMap = new Map<string, { preference_id?: number; email_enabled: boolean; in_app_enabled: boolean; updated_at?: string | null }>();
    rawPrefs.forEach((p) => {
      const cat = String(p.category ?? "");
      // Newest row wins (see the sort above): duplicate rows were written by an
      // earlier PUT that could not read the existing ones, and last-wins made the
      // panel show whichever row Directus happened to return second.
      if (cat && !existingMap.has(cat)) {
        existingMap.set(cat, {
          preference_id: Number(p.preference_id),
          email_enabled: p.email_enabled === 1 || p.email_enabled === true,
          in_app_enabled: p.in_app_enabled === 1 || p.in_app_enabled === true,
          updated_at: (p.updated_at as string) ?? null,
        });
      }
    });

    // Known categories list
    const knownCategories: { category: string; defaultEmail: boolean; defaultInApp: boolean }[] = [
      { category: "APPLICATION_RECEIVED", defaultEmail: true, defaultInApp: true },
      { category: "APPLICATION_WITHDRAWN", defaultEmail: true, defaultInApp: true },
      { category: "APPLICATION_STATUS_UPDATED", defaultEmail: true, defaultInApp: true },
      { category: "MESSAGE_RECEIVED", defaultEmail: true, defaultInApp: true },
      { category: "UNREAD_MESSAGE_REMINDER", defaultEmail: true, defaultInApp: true },
      { category: "INTERVIEW_SCHEDULED", defaultEmail: true, defaultInApp: true },
      { category: "INTERVIEW_RESCHEDULED", defaultEmail: true, defaultInApp: true },
      { category: "INTERVIEW_CANCELLED", defaultEmail: true, defaultInApp: true },
      { category: "INTERVIEW_REMINDER", defaultEmail: true, defaultInApp: true },
      { category: "JOB_APPROVED", defaultEmail: true, defaultInApp: true },
      { category: "JOB_REJECTED", defaultEmail: true, defaultInApp: true },
      { category: "JOB_EXPIRED", defaultEmail: true, defaultInApp: true },
      { category: "TEAM_ACTIVITY", defaultEmail: true, defaultInApp: true },
      { category: "PRODUCT_UPDATES", defaultEmail: false, defaultInApp: true },
      { category: "MARKETING_UPDATES", defaultEmail: false, defaultInApp: false },
    ];

    const preferences = knownCategories.map((kc) => {
      const existing = existingMap.get(kc.category);
      if (existing) {
        return {
          preference_id: existing.preference_id,
          user_id: userId,
          category: kc.category,
          email_enabled: existing.email_enabled,
          in_app_enabled: existing.in_app_enabled,
          updated_at: existing.updated_at ?? null,
        };
      }
      return {
        user_id: userId,
        category: kc.category,
        email_enabled: kc.defaultEmail,
        in_app_enabled: kc.defaultInApp,
        updated_at: null,
      };
    });

    // Also include any custom/legacy categories from DB that are not in knownCategories
    existingMap.forEach((val, key) => {
      if (!knownCategories.some((kc) => kc.category === key)) {
        preferences.push({
          preference_id: val.preference_id,
          user_id: userId,
          category: key,
          email_enabled: val.email_enabled,
          in_app_enabled: val.in_app_enabled,
          updated_at: val.updated_at ?? null,
        });
      }
    });

    return NextResponse.json({ preferences });
  } catch (err: unknown) {
    console.error("GET /api/client/notifications/preferences error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// ─── PUT — Upsert notification preferences ───────────────────────────────

interface PreferenceInput {
  category: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
}

export async function PUT(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isClientSession(session)) {
      return NextResponse.json({ error: "Forbidden: employer access required." }, { status: 403 });
    }

    const userId = Number(session.userId);

    const body = await req.json().catch(() => null);
    const rawIncoming: PreferenceInput[] = body?.preferences ?? [];
    const incoming = Array.isArray(rawIncoming)
      ? rawIncoming.slice(0, MAX_PREFERENCES_PER_REQUEST)
      : [];

    if (!Array.isArray(incoming) || incoming.length === 0) {
      return NextResponse.json(
        { error: "No preferences provided." },
        { status: 400 }
      );
    }

    // Fetch existing preferences to determine create vs update
    const existRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_notification_preference?filter[user_id][_eq]=${userId}&fields=preference_id,category&limit=100`,
      { headers: getHeaders(), cache: "no-store" }
    );

    // A failed lookup looks like "no preferences yet", and every category would
    // then be POSTed again instead of PATCHed — vs_notification_preference has no
    // unique key, so one outage minted a duplicate row per category that the GET
    // reads back with limit=100 and no sort.
    if (!existRes.ok) {
      const err = await existRes.json().catch(() => ({}));
      return NextResponse.json(
        {
          error:
            err.errors?.[0]?.message ??
            "The existing preferences could not be read, so nothing was saved.",
        },
        { status: existRes.status }
      );
    }

    const existJson = await existRes.json();
    const existing: { preference_id: number; category: string }[] =
      existJson.data ?? [];

    const existingMap = new Map(
      existing.map((e) => [e.category, e.preference_id])
    );

    const results = await Promise.allSettled(
      incoming.map(async (pref) => {
        const existingId = existingMap.get(pref.category);

        if (existingId) {
          // Update
          const res = await fetch(
            `${DIRECTUS_BASE}/items/vs_notification_preference/${existingId}`,
            {
              method: "PATCH",
              headers: getHeaders(),
              body: JSON.stringify({
                email_enabled: pref.email_enabled ? 1 : 0,
                in_app_enabled: pref.in_app_enabled ? 1 : 0,
              }),
            }
          );
          if (!res.ok) throw new Error(`Failed to update pref: ${pref.category}`);
        } else {
          // Create
          const res = await fetch(
            `${DIRECTUS_BASE}/items/vs_notification_preference`,
            {
              method: "POST",
              headers: getHeaders(),
              body: JSON.stringify({
                user_id: userId,
                category: pref.category,
                email_enabled: pref.email_enabled ? 1 : 0,
                in_app_enabled: pref.in_app_enabled ? 1 : 0,
              }),
            }
          );
          if (!res.ok) throw new Error(`Failed to create pref: ${pref.category}`);
        }
      })
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.error("Some preferences failed to save:", failed);
      // 500, not 207: fetch treats 207 as a successful response, so a client
      // that only checks res.ok reported a partial save as "saved".
      return NextResponse.json(
        { error: "Some preferences could not be saved. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("PUT /api/client/notifications/preferences error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

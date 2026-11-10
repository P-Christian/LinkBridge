// src/app/api/freelancer/notifications/preferences/route.ts
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

// Canonical categories for freelancers
const KNOWN_FREELANCER_CATEGORIES = [
  { category: "APPLICATION_SUBMITTED", defaultEmail: true, defaultInApp: true },
  { category: "APPLICATION_STATUS_UPDATED", defaultEmail: true, defaultInApp: true },
  { category: "Application Updates", defaultEmail: true, defaultInApp: true },
  { category: "INTERVIEW", defaultEmail: true, defaultInApp: true },
  { category: "Referral Updates", defaultEmail: true, defaultInApp: true },
  { category: "Profile Activity", defaultEmail: false, defaultInApp: true },
  { category: "EDUCATION_VERIFICATION", defaultEmail: false, defaultInApp: true },
  { category: "MESSAGE_RECEIVED", defaultEmail: true, defaultInApp: true },
  { category: "UNREAD_MESSAGE_REMINDER", defaultEmail: true, defaultInApp: true },
  { category: "PRODUCT_UPDATES", defaultEmail: false, defaultInApp: true },
  { category: "MARKETING_UPDATES", defaultEmail: false, defaultInApp: false },
];

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isFreelancerSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Freelancer access required." : "Unauthorized." },
        { status: session ? 403 : 401 }
      );
    }

    const userId = Number(session.userId);

    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_notification_preference?filter[user_id][_eq]=${userId}&fields=preference_id,user_id,category,email_enabled,in_app_enabled,quiet_hours_start,quiet_hours_end,timezone,updated_at&sort[]=-updated_at&sort[]=-preference_id&limit=100`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.errors?.[0]?.message ?? "Failed to load preferences." },
        { status: res.status }
      );
    }

    const json = await res.json();
    const rawPrefs: Record<string, unknown>[] = json.data ?? [];

    const existingMap = new Map<string, { preference_id: number; email_enabled: boolean; in_app_enabled: boolean; updated_at: string | null }>();
    let quietHoursStart: string | null = null;
    let quietHoursEnd: string | null = null;
    let timezone: string | null = null;

    rawPrefs.forEach((p) => {
      const cat = String(p.category ?? "");
      // Newest row wins (see the sort above), so a duplicate left behind by an
      // earlier failed PUT cannot show a toggle the panel then writes elsewhere.
      if (cat && !existingMap.has(cat)) {
        existingMap.set(cat, {
          preference_id: Number(p.preference_id),
          email_enabled: p.email_enabled === 1 || p.email_enabled === true,
          in_app_enabled: p.in_app_enabled === 1 || p.in_app_enabled === true,
          updated_at: (p.updated_at as string) ?? null,
        });
      }
      // Extract first found user-level quiet hours settings
      if (p.quiet_hours_start && !quietHoursStart) quietHoursStart = p.quiet_hours_start as string;
      if (p.quiet_hours_end && !quietHoursEnd) quietHoursEnd = p.quiet_hours_end as string;
      if (p.timezone && !timezone) timezone = p.timezone as string;
    });

    const preferences = KNOWN_FREELANCER_CATEGORIES.map((kc) => {
      const existing = existingMap.get(kc.category);
      if (existing) {
        return {
          preference_id: existing.preference_id,
          user_id: userId,
          category: kc.category,
          email_enabled: existing.email_enabled,
          in_app_enabled: existing.in_app_enabled,
          quiet_hours_start: quietHoursStart,
          quiet_hours_end: quietHoursEnd,
          timezone: timezone,
          updated_at: existing.updated_at,
        };
      }
      return {
        user_id: userId,
        category: kc.category,
        email_enabled: kc.defaultEmail,
        in_app_enabled: kc.defaultInApp,
        quiet_hours_start: quietHoursStart,
        quiet_hours_end: quietHoursEnd,
        timezone: timezone,
        updated_at: null,
      };
    });

    return NextResponse.json({
      preferences,
      quiet_hours_start: quietHoursStart,
      quiet_hours_end: quietHoursEnd,
      timezone: timezone,
    });
  } catch (err: unknown) {
    console.error("GET /api/freelancer/notifications/preferences error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isFreelancerSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Freelancer access required." : "Unauthorized." },
        { status: session ? 403 : 401 }
      );
    }

    const userId = Number(session.userId);

    const body = await req.json().catch(() => null);
    const incoming = body?.preferences ?? [];
    const qStart = body?.quiet_hours_start ?? null;
    const qEnd = body?.quiet_hours_end ?? null;
    const tz = body?.timezone ?? null;

    if (!Array.isArray(incoming) || incoming.length === 0) {
      return NextResponse.json({ error: "No preferences provided." }, { status: 400 });
    }

    // Fetch existing preferences
    const existRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_notification_preference?filter[user_id][_eq]=${userId}&fields=preference_id,category&limit=100`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!existRes.ok) {
      const err = await existRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.errors?.[0]?.message ?? "Failed to read existing preferences." },
        { status: existRes.status }
      );
    }

    const existJson = await existRes.json();
    const existing: { preference_id: number; category: string }[] = existJson.data ?? [];
    const existingMap = new Map(existing.map((e) => [e.category, e.preference_id]));

    const results = await Promise.allSettled(
      incoming.map(async (pref: { category: string; email_enabled?: boolean; in_app_enabled?: boolean }) => {
        const existingId = existingMap.get(pref.category);
        const payload = {
          email_enabled: pref.email_enabled ? 1 : 0,
          in_app_enabled: pref.in_app_enabled ? 1 : 0,
          quiet_hours_start: qStart,
          quiet_hours_end: qEnd,
          timezone: tz,
        };

        if (existingId) {
          // Update
          const res = await fetch(
            `${DIRECTUS_BASE}/items/vs_notification_preference/${existingId}`,
            {
              method: "PATCH",
              headers: getHeaders(),
              body: JSON.stringify(payload),
            }
          );
          if (!res.ok) throw new Error(`Failed to update preference: ${pref.category}`);
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
                ...payload,
              }),
            }
          );
          if (!res.ok) throw new Error(`Failed to create preference: ${pref.category}`);
        }
      })
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.error("[PREFERENCES PUT] Some updates failed:", failed);
      // 500, not 207: fetch treats 207 as successful, so useNotifications read a
      // partial save as "saved" and reloaded the unchanged rows.
      return NextResponse.json(
        { error: "Some preferences could not be saved. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("PUT /api/freelancer/notifications/preferences error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

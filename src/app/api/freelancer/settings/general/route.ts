// src/app/api/freelancer/settings/general/route.ts

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
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

async function getUserIdFromReq(req: NextRequest): Promise<number | null> {
  const session = await authenticateRequest(req);
  if (!session) return null;
  const userId = Number(session.userId);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

// Default values
const DEFAULT_SETTINGS = {
  locale: "en-US",
  timezone: "Asia/Manila",
  date_time_format: "YYYY-MM-DD",
  text_size: "medium",
  reduced_motion: 0,
  settings_version: 1,
};

// GET: Fetch user setting
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromReq(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Query vs_employee_setting
    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_employee_setting?filter[user_id][_eq]=${userId}&limit=1`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!res.ok) {
      console.error("Directus GET vs_employee_setting error status:", res.status);
      return NextResponse.json({ ...DEFAULT_SETTINGS, user_id: userId });
    }

    const json = await res.json();
    const data = json.data?.[0];

    if (!data) {
      // Return defaults if no settings exist in DB yet
      return NextResponse.json({ ...DEFAULT_SETTINGS, user_id: userId });
    }

    return NextResponse.json({
      setting_id: data.setting_id,
      user_id: data.user_id,
      locale: data.locale || DEFAULT_SETTINGS.locale,
      timezone: data.timezone || DEFAULT_SETTINGS.timezone,
      date_time_format: data.date_time_format || DEFAULT_SETTINGS.date_time_format,
      text_size: data.text_size || DEFAULT_SETTINGS.text_size,
      reduced_motion: data.reduced_motion === 1 || data.reduced_motion === true ? 1 : 0,
      settings_version: data.settings_version || DEFAULT_SETTINGS.settings_version,
      updated_at: data.updated_at,
    });
  } catch (err: unknown) {
    console.error("GET /api/freelancer/settings/general error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// PATCH: Update settings (with concurrency settings_version checks & history audit trail)
export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserIdFromReq(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { locale, timezone, date_time_format, text_size, reduced_motion, settings_version } = body;

    // 1. Fetch current settings record to check version conflict
    const fetchRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_employee_setting?filter[user_id][_eq]=${userId}&limit=1`,
      { headers: getHeaders(), cache: "no-store" }
    );

    let existingRecord = null;
    if (fetchRes.ok) {
      const json = await fetchRes.json();
      existingRecord = json.data?.[0];
    }

    if (existingRecord) {
      const currentVersion = Number(existingRecord.settings_version || 1);
      // Concurrency protection check
      if (settings_version !== undefined && Number(settings_version) < currentVersion) {
        return NextResponse.json(
          { error: "Stale version: settings have been updated elsewhere. Please reload." },
          { status: 409 }
        );
      }
    }

    // 2. Prepare patch payloads
    const payload: Record<string, unknown> = {};
    if (locale !== undefined) payload.locale = locale;
    if (timezone !== undefined) payload.timezone = timezone;
    if (date_time_format !== undefined) payload.date_time_format = date_time_format;
    if (text_size !== undefined) payload.text_size = text_size;
    if (reduced_motion !== undefined) payload.reduced_motion = reduced_motion ? 1 : 0;
    
    // Increment version
    const nextVersion = existingRecord ? Number(existingRecord.settings_version || 1) + 1 : 1;
    payload.settings_version = nextVersion;
    payload.updated_at = new Date().toISOString();

    let saveRes;
    if (existingRecord) {
      // UPDATE
      saveRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_employee_setting/${existingRecord.setting_id}`,
        {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        }
      );
    } else {
      // INSERT
      payload.user_id = userId;
      saveRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_employee_setting`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        }
      );
    }

    if (!saveRes.ok) {
      const text = await saveRes.text();
      console.error("Directus save setting error:", text);
      return NextResponse.json({ error: "Failed to save settings." }, { status: saveRes.status });
    }

    const saveJson = await saveRes.json();
    const savedData = saveJson.data;

    // 3. Write changed settings to Audit Log (vs_employee_setting_history)
    try {
      const oldVals = existingRecord || DEFAULT_SETTINGS;
      const auditLogs = [];

      const fieldsToCheck = ["locale", "timezone", "date_time_format", "text_size", "reduced_motion"];
      for (const field of fieldsToCheck) {
        let oldVal = oldVals[field];
        let newVal = payload[field];
        if (field === "reduced_motion") {
          oldVal = oldVal === 1 || oldVal === true ? "1" : "0";
          newVal = newVal !== undefined ? (newVal === 1 ? "1" : "0") : undefined;
        }

        if (newVal !== undefined && String(oldVal) !== String(newVal)) {
          auditLogs.push({
            user_id: userId,
            setting_key: field,
            old_value: String(oldVal),
            new_value: String(newVal),
            actor: "employee",
            occurred_at: new Date().toISOString(),
          });
        }
      }

      if (auditLogs.length > 0) {
        await fetch(`${DIRECTUS_BASE}/items/vs_employee_setting_history`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(auditLogs.length === 1 ? auditLogs[0] : auditLogs),
        });
      }
    } catch (auditErr) {
      console.error("Failed to write to settings history log:", auditErr);
    }

    return NextResponse.json({
      success: true,
      settings: {
        ...savedData,
        reduced_motion: savedData.reduced_motion === 1 || savedData.reduced_motion === true ? 1 : 0,
      },
    });
  } catch (err: unknown) {
    console.error("PATCH /api/freelancer/settings/general error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

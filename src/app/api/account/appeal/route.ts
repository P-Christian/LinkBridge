// src/app/api/account/appeal/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/authenticated-session";
import { createAuditRecordStrictRepo } from "@/modules/vos-admin/audit-trail";
import { createNotification } from "@/lib/notifications";
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

function getPHTimeString(): string {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const phDate = new Date(utc + 3600000 * 8);
  return phDate.toISOString().slice(0, 19).replace("T", " ");
}

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req, { allowContainment: true });
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing token" }, { status: 401 });
    }

    const userId = Number(session.userId);

    // Fetch user account status from vs_user
    let userStatus = "SUSPENDED";
    try {
      const uRes = await fetch(`${DIRECTUS_BASE}/items/vs_user/${userId}?fields=status,user_status,is_blocked`, {
        headers: getHeaders(),
        cache: "no-store",
      });
      if (uRes.ok) {
        const uJson = await uRes.json();
        const u = uJson.data;
        if (u) {
          userStatus = String(u.status || u.user_status || (u.is_blocked ? "BLOCKED" : "SUSPENDED")).toUpperCase();
        }
      }
    } catch {
      /* ignore */
    }

    const caseUrl = `${DIRECTUS_BASE}/items/vs_account_status_case?filter[user_id][_eq]=${userId}&sort=-created_at&limit=1`;
    const res = await fetch(caseUrl, { headers: getHeaders(), cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ hasCase: false, case: null, userStatus });
    }

    const json = await res.json();
    const latestCase = json.data?.[0] || null;

    return NextResponse.json({
      hasCase: !!latestCase,
      hasPendingAppeal: latestCase?.state === "OPEN",
      case: latestCase,
      userStatus,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeErrorMessage(error, "Internal server error.") }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req, { allowContainment: true });
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing token" }, { status: 401 });
    }

    const userId = Number(session.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const { statement, evidence_refs, type: requestType } = body ?? {};

    if (!statement || typeof statement !== "string" || !statement.trim()) {
      return NextResponse.json({ error: "Statement / reason is required" }, { status: 400 });
    }

    // Check if there is already an OPEN case for this user
    const checkUrl = `${DIRECTUS_BASE}/items/vs_account_status_case?filter[user_id][_eq]=${userId}&filter[state][_eq]=OPEN&limit=1`;
    const checkRes = await fetch(checkUrl, { headers: getHeaders(), cache: "no-store" });
    if (checkRes.ok) {
      const checkJson = await checkRes.json();
      if (checkJson.data && checkJson.data.length > 0) {
        return NextResponse.json(
          { error: "You already have an active request under review. Please wait for an administrator to decide your case." },
          { status: 409 }
        );
      }
    }

    const validTypes = ["SUSPENSION_APPEAL", "REACTIVATION_REQUEST", "RESTORE_ACCOUNT"];
    const resolvedType = typeof requestType === "string" && validTypes.includes(requestType)
      ? requestType
      : "SUSPENSION_APPEAL";

    // Insert new appeal case into vs_account_status_case
    const casePayload = {
      user_id: userId,
      type: resolvedType,
      state: "OPEN",
      statement: statement.trim(),
      evidence_refs: evidence_refs && typeof evidence_refs === "string" ? evidence_refs.trim() : null,
      created_at: getPHTimeString(),
    };

    const caseRes = await fetch(`${DIRECTUS_BASE}/items/vs_account_status_case`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(casePayload),
    });

    if (!caseRes.ok) {
      const errText = await caseRes.text().catch(() => "");
      console.error("[account/appeal] Failed to insert case record:", errText);
      return NextResponse.json({ error: "Failed to record appeal case" }, { status: 500 });
    }

    const caseJson = await caseRes.json();
    const createdCase = caseJson.data;

    // Log the event in the audit trail
    try {
      await createAuditRecordStrictRepo({
        event_type: "ACCOUNT_APPEAL_SUBMITTED",
        event_category: "USER",
        action: "CREATE",
        status: "SUCCESS",
        actor_type: "USER",
        actor_user_id: userId,
        resource_type: "vs_account_status_case",
        resource_id: String(createdCase?.case_id || ""),
        reason: `User submitted suspension appeal: ${statement.trim().slice(0, 100)}...`,
      });
    } catch (auditErr) {
      console.warn("[account/appeal] Audit log warning:", auditErr);
    }

    // Fetch user details to personalize the admin notification
    let userDisplayName = `User #${userId}`;
    try {
      const uRes = await fetch(`${DIRECTUS_BASE}/items/vs_user/${userId}?fields=user_fname,user_lname,user_email`, {
        headers: getHeaders(),
        cache: "no-store",
      });
      if (uRes.ok) {
        const uJson = await uRes.json();
        const u = uJson.data;
        if (u) {
          const name = `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim();
          userDisplayName = name || u.user_email || `User #${userId}`;
        }
      }
    } catch {
      /* ignore */
    }

    // Notify all system administrators (role_id === 3)
    try {
      const adminUrl = `${DIRECTUS_BASE}/items/vs_user?filter[role_id][_eq]=3&fields=user_id&limit=20`;
      const adminRes = await fetch(adminUrl, { headers: getHeaders(), cache: "no-store" });
      if (adminRes.ok) {
        const adminJson = await adminRes.json();
        const adminUsers = adminJson.data || [];
        for (const adm of adminUsers) {
          if (adm.user_id) {
            await createNotification({
              event_type: "appeal_submitted",
              recipient_user_id: adm.user_id,
              entity_type: "vs_account_status_case",
              entity_id: createdCase.case_id,
              category: "Security & Compliance",
              title: "New Account Appeal Submitted",
              message: `${userDisplayName} has submitted an appeal for account suspension (Case #${createdCase.case_id}).`,
              action_url: "/linkbridge/admin/account-status",
            });
          }
        }
      }
    } catch (notifErr) {
      console.warn("[account/appeal] Admin notification warning:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: "Appeal submitted successfully",
      case: createdCase,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeErrorMessage(error, "Internal server error.") }, { status: 500 });
  }
}

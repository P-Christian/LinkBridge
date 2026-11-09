import { NextRequest, NextResponse } from "next/server";
import { getAccountStatusUsers, getAccountStatusDetail, changeUserStatus, getAccountStatusMetrics } from "@/modules/vos-admin/account-status-management";
import { createAuditRecordStrictRepo } from "@/modules/vos-admin/audit-trail";
import { createNotification } from "@/lib/notifications";
import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";
import { clampInt } from "@/lib/server/paging";
import {
  ACCOUNT_STATUSES,
  type AccountStatus,
} from "@/modules/vos-admin/account-status-management/types/account-status.types";

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isAdministratorSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Admin access required" : "Unauthorized" },
        { status: session ? 403 : 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const metricsParam = searchParams.get("metrics");

    if (metricsParam === "true") {
      const metrics = await getAccountStatusMetrics();
      return NextResponse.json({ metrics });
    }

    const userIdStr = searchParams.get("userId");

    if (userIdStr) {
      // Without this the id reaches /items/vs_user/NaN and a malformed request
      // is reported as "user not found" rather than a bad request.
      const userId = Number(userIdStr);
      if (!Number.isSafeInteger(userId) || userId <= 0) {
        return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
      }
      const user = await getAccountStatusDetail(userId);
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      return NextResponse.json({ user });
    }

    const statusFilter = searchParams.get("statusFilter") || undefined;
    const search = searchParams.get("search") || undefined;
    const appealsOnly = searchParams.get("appealsOnly") === "true";
    // Both land in Directus `limit=`/`page=`: a NaN page was rejected upstream
    // and blanked the whole table, and page=0 makes Directus compute a negative
    // range.
    const page = clampInt(searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER);
    const limit = clampInt(searchParams.get("limit"), 10, 1, 100);

    const result = await getAccountStatusUsers(statusFilter, search, page, limit, appealsOnly);
    return NextResponse.json({ users: result.users, total: result.total });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeErrorMessage(error, "Internal server error.")}, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isAdministratorSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Admin access required" : "Unauthorized" },
        { status: session ? 403 : 401 }
      );
    }

    const admin = {
      adminId: Number(session.userId),
      email: (session.payload.user_email as string) || "admin@vosync.com",
    };

    const body = await req.json().catch(() => null);
    const { userId, targetStatus, reasonCode, publicReason, internalNote, duration, expiresAt, restrictions } =
      body ?? {};

    if (!userId || !targetStatus || !reasonCode || !publicReason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const targetUserId = Number(userId);
    if (!Number.isSafeInteger(targetUserId) || targetUserId <= 0) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }
    if (!ACCOUNT_STATUSES.includes(targetStatus as AccountStatus)) {
      return NextResponse.json(
        { error: `targetStatus must be one of: ${ACCOUNT_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Read for the notification routing only; the status version is re-read
    // inside the transition so a stale copy cannot reset the counter.
    const userDetail = await getAccountStatusDetail(targetUserId);
    if (!userDetail) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const warnings = await changeUserStatus(
      targetUserId,
      targetStatus,
      admin.email,
      reasonCode,
      publicReason,
      internalNote,
      expiresAt,
      restrictions
    );

    // Awaited and strict: an unawaited write can be cut off when the response
    // closes, and the best-effort variant swallows a rejected insert, so either
    // way the admin would believe the transition was logged. The status change is
    // already committed, so this is reported as a warning, not an error — an
    // error invites a retry, and a retry is a second transition.
    try {
      const newValues: Record<string, unknown> = {
        account_status: targetStatus,
        reason_code: reasonCode,
      };

      if (targetStatus === "LIMITED" || targetStatus === "SUSPENDED") {
        if (duration && duration !== "indefinite") {
          const days = parseInt(duration, 10);
          newValues.duration = `${days} Day${days === 1 ? "" : "s"}${expiresAt ? ` (Expires ${new Date(expiresAt).toLocaleDateString()})` : ""}`;
        } else {
          newValues.duration = "Indefinite / Permanent";
        }
      } else if (targetStatus === "BLOCKED") {
        newValues.duration = "Permanent / Indefinite";
      }

      if (targetStatus === "LIMITED" && Array.isArray(restrictions) && restrictions.length > 0) {
        newValues.restrictions = restrictions;
      }

      await createAuditRecordStrictRepo({
        event_type: "ACCOUNT_STATUS_UPDATED",
        event_category: "USER",
        action: "UPDATE",
        status: "SUCCESS",
        actor_type: "ADMIN",
        actor_user_id: admin.adminId,
        resource_type: "USER",
        resource_id: String(targetUserId),
        reason: internalNote || `${targetStatus} status applied for reason ${reasonCode}`,
        old_values: {
          account_status: userDetail.status,
        },
        new_values: newValues,
      });
    } catch (auditErr) {
      console.error("Status transition could not be logged:", auditErr);
      warnings.push("The account was updated but the change is not in the audit trail.");
    }

    try {
      const actionUrl = targetStatus === "SUSPENDED" || targetStatus === "BLOCKED"
        ? "/linkbridge/suspended"
        : (userDetail.role === "CLIENT" ? "/linkbridge/client/dashboard" : "/linkbridge/freelancer/dashboard");

      await createNotification({
        event_type: "account_status_change",
        recipient_user_id: targetUserId,
        entity_type: "user",
        entity_id: targetUserId,
        category: "System Activity",
        title: `Account Status Changed to ${targetStatus.replace("_", " ")}`,
        message: publicReason,
        action_url: actionUrl,
      });
    } catch (notifErr) {
      console.error("Failed to create user status change notification:", notifErr);
      warnings.push("The account was updated but the user notification could not be sent.");
    }

    return NextResponse.json({ success: true, warnings });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeErrorMessage(error, "Internal server error.")}, { status: 500 });
  }
}

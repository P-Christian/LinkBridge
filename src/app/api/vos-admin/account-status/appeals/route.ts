// src/app/api/vos-admin/account-status/appeals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveAppeal } from "@/modules/vos-admin/account-status-management";
import { createAuditRecordStrictRepo } from "@/modules/vos-admin/audit-trail";
import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

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
    const { caseId, userId, decision, internalNote, publicNote } = body ?? {};

    if (!caseId || !userId || !decision) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Both ids reach a Directus item URL: NaN reads /items/.../NaN and the write
    // is reported as a server error instead of a bad request.
    const numCaseId = Number(caseId);
    const numUserId = Number(userId);
    if (
      !Number.isSafeInteger(numCaseId) || numCaseId <= 0 ||
      !Number.isSafeInteger(numUserId) || numUserId <= 0
    ) {
      return NextResponse.json({ error: "Invalid caseId or userId" }, { status: 400 });
    }

    if (decision !== 'uphold' && decision !== 'modify' && decision !== 'restore') {
      return NextResponse.json({ error: "Invalid decision value" }, { status: 400 });
    }

    const warnings = await resolveAppeal(
      numCaseId,
      numUserId,
      decision,
      admin.email,
      internalNote,
      publicNote
    );

    // Awaited and strict: an unawaited write can be cut off when the response
    // closes, and the best-effort variant swallows a rejected insert, so either
    // way the admin would believe the decision was logged.
    try {
      await createAuditRecordStrictRepo({
        event_type: "APPEAL_DECISION_SUBMITTED",
        event_category: "USER",
        action: "UPDATE",
        status: "SUCCESS",
        actor_type: "ADMIN",
        actor_user_id: admin.adminId,
        resource_type: "account_status_case",
        resource_id: String(numCaseId),
        reason: internalNote || `Appeal case #${numCaseId} resolved with decision: ${decision}`,
      });
    } catch (auditErr) {
      console.error("Appeal decision could not be logged:", auditErr);
      warnings.push("The appeal decision was applied but is not in the audit trail.");
    }

    return NextResponse.json({ success: true, warnings });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeErrorMessage(error, "Internal server error.")}, { status: 500 });
  }
}

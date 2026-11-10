// src/app/api/vos-admin/audit-trail/config/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchAuditConfigRepo, updateAuditConfigRepo, createAuditRecordStrictRepo, AuditCategoryConfig } from "@/modules/vos-admin/audit-trail";
import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isAdministratorSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Admin access required" : "Unauthorized" },
        { status: session ? 403 : 401 }
      );
    }

    const config = await fetchAuditConfigRepo();
    return NextResponse.json({ config });
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

    const adminId = Number(session.userId);

    const body = await req.json();
    const newConfig: AuditCategoryConfig = body.config;

    if (!newConfig || typeof newConfig !== "object") {
      return NextResponse.json({ error: "Invalid config object" }, { status: 400 });
    }

    const { config: savedConfig, warnings } = await updateAuditConfigRepo(newConfig, adminId);

    // Strict + warned: the settings are already saved, and a swallowed insert
    // would leave the change to what gets logged itself unlogged.
    try {
      await createAuditRecordStrictRepo({
        event_type: "AUDIT_CONFIG_CHANGED",
        event_category: "ADMIN",
        action: "CONFIG_CHANGE",
        status: "SUCCESS",
        actor_type: "ADMIN",
        actor_user_id: adminId,
        reason: "Updated audit event customization settings",
      });
    } catch (auditErr) {
      console.error("Audit settings change could not be logged:", auditErr);
      warnings.push("The settings were saved but the change is not in the audit trail.");
    }

    return NextResponse.json({
      config: savedConfig,
      message: "Audit settings updated successfully",
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeErrorMessage(error, "Internal server error.")}, { status: 500 });
  }
}

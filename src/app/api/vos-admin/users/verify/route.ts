import { NextRequest, NextResponse } from "next/server";
import { reviewIdentityDocument } from "@/modules/vos-admin/user-management";
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
    const adminId = Number(session.userId);

    const body = await req.json();
    const { verificationId, status, rejectionNote } = body;

    if (!verificationId || !status) {
      return NextResponse.json({ error: "Missing verificationId or status" }, { status: 400 });
    }

    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const verification = await reviewIdentityDocument(
      Number(verificationId),
      status,
      adminId,
      rejectionNote
    );

    if (verification && verification.user_id) {
      try {
        const { recalculateAndPersistScoreForUser } = await import("@/modules/freelancer/freelancer-profile/services/identity-verification.service");
        await recalculateAndPersistScoreForUser(verification.user_id);
      } catch (err) {
        console.error("Failed to auto-recalculate score after admin review:", err);
      }
    }

    // The review is already committed, so a failed log is reported as a warning
    // rather than an error that would invite a second review.
    const warnings: string[] = [];
    try {
      await createAuditRecordStrictRepo({
        event_type: status === 'approved' ? "IDENTITY_VERIFICATION_APPROVED" : "IDENTITY_VERIFICATION_REJECTED",
        event_category: "USER",
        action: status === 'approved' ? "VERIFY" : "REJECT",
        status: "SUCCESS",
        actor_type: "ADMIN",
        actor_user_id: adminId,
        resource_type: "vs_identity_verifications",
        resource_id: String(verificationId),
        reason: rejectionNote || `Identity document ${status} by admin #${adminId}`,
      });
    } catch (auditErr) {
      console.error("Identity review could not be logged:", auditErr);
      warnings.push("The review was applied but is not in the audit trail.");
    }

    return NextResponse.json({ verification, warnings });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeErrorMessage(error, "Internal server error.")}, { status: 500 });
  }
}

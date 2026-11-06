import { NextRequest, NextResponse } from "next/server";
import { reviewIdentityDocument } from "@/modules/vos-admin/user-management";
import { createAuditRecordStrictRepo } from "@/modules/vos-admin/audit-trail";
import { getAccountStatusDetail, changeUserStatus } from "@/modules/vos-admin/account-status-management";
import { createNotification } from "@/lib/notifications";
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

    const warnings: string[] = [];
    const adminEmail = (session.payload.user_email as string) || "admin@vosync.com";

    // Auto-activate user account if government ID is approved
    let oldAccountStatus: string | null = null;
    let newAccountStatus: string | null = null;

    if (verification && verification.user_id && status === "approved") {
      try {
        const userDetail = await getAccountStatusDetail(verification.user_id);
        if (userDetail) {
          oldAccountStatus = userDetail.status;
          if (userDetail.status === "PENDING_VERIFICATION") {
            const statusWarnings = await changeUserStatus(
              verification.user_id,
              "ACTIVE",
              adminEmail,
              "GOV_ID_VERIFIED",
              "Your identity has been verified by an administrator.",
              `Auto-activated upon approval of Government ID verification #${verificationId}`
            );
            if (statusWarnings && statusWarnings.length > 0) {
              warnings.push(...statusWarnings);
            }
            newAccountStatus = "ACTIVE";

            // Also patch verification_status on vs_user directly
            const envApiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
            const envToken = process.env.DIRECTUS_STATIC_TOKEN;
            if (envApiBase && envToken) {
              await fetch(`${envApiBase}/items/vs_user/${verification.user_id}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${envToken}`,
                },
                body: JSON.stringify({
                  verification_status: "VERIFIED",
                }),
              }).catch((e) => console.warn("Failed to patch verification_status on vs_user:", e));
            }

            // Notify user of account activation
            try {
              const actionUrl = userDetail.role === "CLIENT"
                ? "/linkbridge/client/dashboard"
                : "/linkbridge/freelancer/dashboard";

              await createNotification({
                event_type: "account_activated",
                recipient_user_id: verification.user_id,
                entity_type: "user",
                entity_id: verification.user_id,
                category: "System Activity",
                title: "Account Activated",
                message: "Your government ID has been approved and your account is now Active.",
                action_url: actionUrl,
              });
            } catch (notifErr) {
              console.warn("Failed to create activation notification:", notifErr);
            }
          }
        }
      } catch (activationErr) {
        console.error("Failed to auto-activate user on gov ID approval:", activationErr);
        warnings.push("Government ID was approved, but user account could not be auto-activated.");
      }
    }

    // The review is already committed, so a failed log is reported as a warning
    // rather than an error that would invite a second review.
    try {
      const oldVals: Record<string, unknown> = {
        verification_status: "pending",
      };
      if (oldAccountStatus) {
        oldVals.account_status = oldAccountStatus;
      }

      const newVals: Record<string, unknown> = {
        verification_status: status,
      };
      if (newAccountStatus) {
        newVals.account_status = newAccountStatus;
      }

      await createAuditRecordStrictRepo({
        event_type: status === 'approved' ? "IDENTITY_VERIFICATION_APPROVED" : "IDENTITY_VERIFICATION_REJECTED",
        event_category: "USER",
        action: status === 'approved' ? "VERIFY" : "REJECT",
        status: "SUCCESS",
        actor_type: "ADMIN",
        actor_user_id: adminId,
        resource_type: "USER",
        resource_id: String(verification?.user_id || verificationId),
        reason: rejectionNote || `Identity document ${status} by admin #${adminId}${newAccountStatus ? " (Account Activated)" : ""}`,
        old_values: oldVals,
        new_values: newVals,
      });
    } catch (auditErr) {
      console.error("Identity review could not be logged:", auditErr);
      warnings.push("The review was applied but is not in the audit trail.");
    }

    return NextResponse.json({ verification, warnings });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeErrorMessage(error, "Internal server error.") }, { status: 500 });
  }
}

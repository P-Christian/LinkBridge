// src/app/api/freelancer/referrals/claim/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  claimReferralRecord,
  getReferralByToken,
} from "@/modules/freelancer/freelancer-referrals/services/referral.service";
import { authenticateRequest, isFreelancerSession } from "@/lib/authenticated-session";

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isFreelancerSession(session)) {
      return NextResponse.json({ error: "Forbidden: freelancer role required." }, { status: 403 });
    }

    const userId = Number(session.userId);

    const body = await req.json().catch(() => ({}));
    // SEC-036: the opaque invitation token is the only accepted handle. A
    // sequential referral id from the client is never trusted.
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const consentVersion =
      typeof body.consent_version === "string" ? body.consent_version : "1.0";

    if (!token) {
      return NextResponse.json(
        { error: "Referral invitation token is required." },
        { status: 400 }
      );
    }

    const referral = await getReferralByToken(token);
    const referralId = Number(referral?.referral_id);
    if (!referral || !Number.isSafeInteger(referralId) || referralId <= 0) {
      return NextResponse.json(
        { error: "Referral invitation not found or no longer valid." },
        { status: 404 }
      );
    }

    const claim = await claimReferralRecord(
      referralId,
      userId,
      consentVersion,
      session.user.user_email
    );

    return NextResponse.json({ success: true, claim });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to claim referral.";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}

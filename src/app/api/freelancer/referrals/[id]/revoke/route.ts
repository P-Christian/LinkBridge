// src/app/api/freelancer/referrals/[id]/revoke/route.ts
import { NextRequest, NextResponse } from "next/server";
import { logReferralHistory } from "@/modules/freelancer/freelancer-referrals/services/referral.service";
import { authenticateRequest, isFreelancerSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

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

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isFreelancerSession(session)) {
      return NextResponse.json({ error: "Forbidden: freelancer role required." }, { status: 403 });
    }

    const userId = Number(session.userId);

    // Validate ownership
    const refRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_referral/${id}?fields=referrer_user_id,status`, {
      headers: getHeaders(),
      cache: "no-store"
    });
    if (!refRes.ok) {
      return NextResponse.json({ error: "Referral not found." }, { status: 404 });
    }
    const referral = (await refRes.json()).data;
    if (!referral || referral.referrer_user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized access to this referral." }, { status: 403 });
    }

    if (referral.status === "CLAIMED" || referral.status === "APPLIED") {
      return NextResponse.json({ error: "Cannot revoke a claimed or applied referral." }, { status: 400 });
    }

    // Patch status to REVOKED
    const patchRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_referral/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ status: "REVOKED", revoked_at: new Date().toISOString() })
    });

    if (!patchRes.ok) {
      return NextResponse.json({ error: "Failed to update status." }, { status: 500 });
    }

    await logReferralHistory(Number(id), referral.status, "REVOKED", `user:${userId}`, "Revoked by Referrer");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = safeErrorMessage(err, "An error occurred");
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

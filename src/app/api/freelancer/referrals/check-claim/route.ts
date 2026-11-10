// src/app/api/freelancer/referrals/check-claim/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/authenticated-session";
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

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ claimed: false });
    }

    const userId = Number(session.userId);

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("job_id");

    // If no specific job_id, return all active claims for this candidate
    if (!jobId) {
      const allClaimsRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_job_referral_claim?filter[candidate_user_id][_eq]=${userId}&filter[claim_status][_eq]=ACTIVE&fields=job_id,referral_id.expires_at,referral_id.referrer_user_id.user_fname,referral_id.referrer_user_id.user_lname&limit=200`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (!allClaimsRes.ok) return NextResponse.json({ claims: [] });
      const allJson = await allClaimsRes.json();
      const claims = (allJson.data || []).map((c: Record<string, unknown>) => {
        const ref = (c.referral_id as Record<string, unknown>) || {};
        const refUser = (ref.referrer_user_id as Record<string, unknown>) || {};
        const fname = refUser.user_fname || "";
        const lname = refUser.user_lname || "";
        const name = `${fname} ${lname}`.trim() || "A friend";
        return {
          job_id: Number(c.job_id),
          referrer_name: name,
          expires_at: (ref.expires_at as string) || null,
        };
      });
      return NextResponse.json({ claims });
    }

    // Query active claim for single job
    const claimRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_referral_claim?filter[candidate_user_id][_eq]=${userId}&filter[job_id][_eq]=${jobId}&filter[claim_status][_eq]=ACTIVE&limit=1`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!claimRes.ok) return NextResponse.json({ claimed: false });

    const claimJson = await claimRes.json();
    const claims = claimJson.data || [];

    if (claims.length === 0) {
      return NextResponse.json({ claimed: false });
    }

    const claim = claims[0];
    
    // Resolve referrer name and expiration
    const refRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_referral/${claim.referral_id}?fields=expires_at,referrer_user_id.user_fname,referrer_user_id.user_lname`,
      { headers: getHeaders(), cache: "no-store" }
    );
    
    let referrerName = "A LinkBridge User";
    let expiresAt: string | null = null;
    if (refRes.ok) {
      const refData = (await refRes.json()).data;
      expiresAt = refData?.expires_at || null;
      if (refData?.referrer_user_id) {
        referrerName = `${refData.referrer_user_id.user_fname ?? ""} ${refData.referrer_user_id.user_lname ?? ""}`.trim() || referrerName;
      }
    }

    return NextResponse.json({
      claimed: true,
      referrer_name: referrerName,
      expires_at: expiresAt,
    });
  } catch (err: unknown) {
    const errorMsg = safeErrorMessage(err, "An error occurred");
    return NextResponse.json({ claimed: false, error: errorMsg }, { status: 500 });
  }
}

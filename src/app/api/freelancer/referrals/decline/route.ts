import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required." }, { status: 400 });
    }

    // Lookup referral by token_hash or plain token
    const crypto = await import("crypto");
    const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");

    const searchRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_referral?filter[_or][0][token_hash][_eq]=${encodeURIComponent(token.trim())}&filter[_or][1][token_hash][_eq]=${encodeURIComponent(tokenHash)}&limit=1&fields=referral_id,status,display_hint,recipient_email_hash`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!searchRes.ok) {
      return NextResponse.json({ error: "Failed to look up referral." }, { status: 500 });
    }

    const searchJson = await searchRes.json();
    const referral = searchJson.data?.[0];

    if (!referral) {
      return NextResponse.json({ error: "Referral not found." }, { status: 404 });
    }

    // If already claimed, applied, or revoked, do not overwrite
    if (["CLAIMED", "APPLIED", "REVOKED"].includes(referral.status)) {
      return NextResponse.json(
        { error: `Cannot decline a referral that is already ${referral.status.toLowerCase()}.` },
        { status: 400 }
      );
    }

    // Update status to DECLINED
    const updateRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_referral/${referral.referral_id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({
        status: "DECLINED",
      }),
    });

    if (!updateRes.ok) {
      return NextResponse.json({ error: "Failed to update referral status." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Referral marked as declined." });
  } catch (err: unknown) {
    const errorMsg = safeErrorMessage(err, "An error occurred while declining referral.");
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}


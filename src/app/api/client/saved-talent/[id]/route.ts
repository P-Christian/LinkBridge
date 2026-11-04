// src/app/api/client/saved-talent/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";

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

// DELETE — unsave a talent by talent_user_id (not saved record id)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const talentUserId = Number(id);

    if (!talentUserId || isNaN(talentUserId)) {
      return NextResponse.json({ error: "Invalid talent user ID." }, { status: 400 });
    }

    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    const userId = Number(session.userId);
    const { isVerified, companyId } = await checkCompanyVerificationStatus(userId);
    if (!isVerified || !companyId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    // Find the saved record
    const findRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_saved_applicant?filter[company_id][_eq]=${companyId}&filter[applicant_user_id][_eq]=${talentUserId}&fields=saved_applicant_id&limit=1`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!findRes.ok) {
      return NextResponse.json({ error: "Failed to find saved talent record." }, { status: 502 });
    }

    const findJson = await findRes.json();
    const record = findJson.data?.[0];

    if (!record) {
      return NextResponse.json({ error: "Saved talent record not found." }, { status: 404 });
    }

    const deleteRes = await fetch(`${DIRECTUS_BASE}/items/vs_saved_applicant/${record.saved_applicant_id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });

    if (!deleteRes.ok && deleteRes.status !== 204) {
      return NextResponse.json({ error: "Failed to remove saved talent." }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[saved-talent DELETE] Error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}


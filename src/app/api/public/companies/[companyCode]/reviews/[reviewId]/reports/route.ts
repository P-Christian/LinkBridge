import { NextRequest, NextResponse } from "next/server";
import { createReviewReport } from "@/modules/public/company-profile/services/company-profile.service";
import { authenticateRequest } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyCode: string; reviewId: string }> }
) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: invalid or missing session" }, { status: 401 });
    }

    const userId = Number(session.userId);

    const { reviewId } = await params;
    const rId = Number(reviewId);
    if (isNaN(rId)) {
      return NextResponse.json({ error: "Invalid review ID" }, { status: 400 });
    }

    const body = await req.json();
    if (!body.reason_code) {
      return NextResponse.json({ error: "Missing required fields (reason_code)" }, { status: 400 });
    }

    const newReport = await createReviewReport(rId, body, userId);
    if (!newReport) {
      return NextResponse.json({ error: "Failed to submit review report" }, { status: 500 });
    }

    return NextResponse.json(newReport, { status: 201 });
  } catch (error: unknown) {
    console.error("API Error in company review report POST:", error);
    const message = safeErrorMessage(error, "Internal server error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

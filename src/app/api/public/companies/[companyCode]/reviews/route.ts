import { NextRequest, NextResponse } from "next/server";
import { getPublicCompanyByCode, getPublicCompanyReviews, createCompanyReview } from "@/modules/public/company-profile/services/company-profile.service";
import { authenticateRequest } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyCode: string }> }
) {
  try {
    const { companyCode } = await params;
    const company = await getPublicCompanyByCode(companyCode);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

    const reviews = await getPublicCompanyReviews(company.company_id, limit);
    return NextResponse.json(reviews);
  } catch (error: unknown) {
    console.error("API Error in company reviews GET:", error);
    const message = safeErrorMessage(error, "Internal server error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyCode: string }> }
) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: invalid or missing session" }, { status: 401 });
    }

    const userId = Number(session.userId);

    const { companyCode } = await params;
    const company = await getPublicCompanyByCode(companyCode);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const body = await req.json();

    // Validate required fields
    if (!body.employment_status || !body.review_text || body.overall_rating == null) {
      return NextResponse.json({ error: "Missing required fields (employment_status, overall_rating, review_text)" }, { status: 400 });
    }

    const newReview = await createCompanyReview(company.company_id, body, userId);
    if (!newReview) {
      return NextResponse.json({ error: "Failed to create review in database" }, { status: 500 });
    }

    return NextResponse.json(newReview, { status: 201 });
  } catch (error: unknown) {
    console.error("API Error in company reviews POST:", error);
    const message = safeErrorMessage(error, "Internal server error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

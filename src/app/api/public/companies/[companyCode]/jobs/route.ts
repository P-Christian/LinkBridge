import { NextRequest, NextResponse } from "next/server";
import { getPublicCompanyByCode, getPublicCompanyJobs } from "@/modules/public/company-profile/services/company-profile.service";
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
    const search = searchParams.get("search") || undefined;
    const job_type = searchParams.get("job_type") || undefined;
    const work_arrangement = searchParams.get("work_arrangement") || undefined;
    const experience_level = searchParams.get("experience_level") || undefined;
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 5);

    const result = await getPublicCompanyJobs(
      company.company_id,
      { search, job_type, work_arrangement, experience_level },
      { page, limit }
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("API Error in company jobs:", error);
    const message = safeErrorMessage(error, "Internal server error");
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getBrowseCompanies } from "@/modules/public/company-profile/services/company-profile.service";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const industry = searchParams.get("industry") || undefined;
    const size = searchParams.get("size") || undefined;
    const location = searchParams.get("location") || undefined;
    const activeJobsOnly = searchParams.get("activeJobsOnly") === "true";
    const page = Math.max(1, Math.floor(Number(searchParams.get("page")) || 1));
    const limit = Math.min(Math.max(Math.floor(Number(searchParams.get("limit")) || 10), 1), 50);

    const result = await getBrowseCompanies(
      { search, industry, size, location, activeJobsOnly },
      { page, limit }
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("API Error in public companies:", error);
    const message = safeErrorMessage(error, "Internal server error");
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

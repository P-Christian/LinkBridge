// src/app/api/vos-admin/school-verification/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdministrator } from "@/lib/authenticated-session";
import {
  getSchoolVerifications,
  processVerificationDecision,
  VerificationDecisionSchema,
} from "@/modules/vos-admin/school-verification";
import { releaseParkedRequestsForSchool } from "@/modules/school-request-routing";
import { DirectusError } from "@/lib/server/directus";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdministrator(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;

    const records = await getSchoolVerifications(status, search);
    return NextResponse.json(records);
  } catch (error: unknown) {
    if (error instanceof DirectusError) {
      console.error("API Route Error (GET school-verification):", error);
      return NextResponse.json(
        { error: "The verification queue could not be read. Please try again." },
        { status: 502 }
      );
    }
    const msg = safeErrorMessage(error, "Internal server error");
    console.error("API Route Error (GET school-verification):", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdministrator(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const adminId = auth.adminId;

    const body = await req.json();
    const parseResult = VerificationDecisionSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((e) => e.message).join(", ");
      return NextResponse.json({ error: `Validation error: ${errorMsg}` }, { status: 400 });
    }

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await processVerificationDecision(parseResult.data, adminId, clientIp, userAgent);

    // Best-effort: now that the school may be review-ready, release its parked
    // school requests. The decision itself is already committed, so a failure
    // here is reported instead of thrown.
    if (parseResult.data.action === "approve" && result.success) {
      try {
        await releaseParkedRequestsForSchool(Number(parseResult.data.schoolId));
      } catch (releaseErr) {
        console.warn("Failed releasing parked school requests after approval:", releaseErr);
        result.warnings.push(
          "The school was approved, but its parked school requests could not be released."
        );
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof DirectusError) {
      console.error("API Route Error (POST school-verification):", error);
      return NextResponse.json(
        { error: "The verification decision could not be saved. Please try again." },
        { status: 502 }
      );
    }
    const msg = safeErrorMessage(error, "Internal server error");
    console.error("API Route Error (POST school-verification):", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

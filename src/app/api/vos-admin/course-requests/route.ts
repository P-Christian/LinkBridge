import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";
import { NextRequest, NextResponse } from "next/server";
import {
  CourseRequestDecisionError,
  getCourseRequests,
} from "@/modules/vos-admin/request-management";

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isAdministratorSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Access restricted to administrators" : "Unauthorized: Invalid or missing token" },
        { status: session ? 403 : 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ALL";

    const requests = await getCourseRequests(status);
    return NextResponse.json({ requests });
  } catch (error: unknown) {
    if (error instanceof CourseRequestDecisionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    // Sanitized dependency failure: never leak storage internals.
    return NextResponse.json(
      { error: "Course request storage is temporarily unavailable." },
      { status: 503 }
    );
  }
}

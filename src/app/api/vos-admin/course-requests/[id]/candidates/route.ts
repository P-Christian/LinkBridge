import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";
import { NextRequest, NextResponse } from "next/server";
import {
  CourseRequestDecisionError,
  getCourseRequestCandidates,
} from "@/modules/vos-admin/request-management";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isAdministratorSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Access restricted to administrators" : "Unauthorized: Invalid or missing token" },
        { status: session ? 403 : 401 }
      );
    }

    const { id: paramId } = await params;
    const id = parseInt(paramId, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    // Candidates come from the request's persisted school. Query parameters
    // are never consulted, so no school override is possible.
    const result = await getCourseRequestCandidates(id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof CourseRequestDecisionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    // Sanitized dependency failure: never leak storage internals.
    return NextResponse.json(
      { error: "Course catalog storage is temporarily unavailable." },
      { status: 503 }
    );
  }
}

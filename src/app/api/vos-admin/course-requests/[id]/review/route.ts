import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  CourseRequestDecisionError,
  reviewCourseRequest,
  reviewCourseRequestSchema,
} from "@/modules/vos-admin/request-management";
import { EducationFlowUnavailableError } from "@/modules/education-verification";

export async function PATCH(
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
    const adminId = Number(session.userId);
    const roleId = Number(session.roleId ?? 3);

    const { id: paramId } = await params;
    const id = parseInt(paramId, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await req.json();
    const parsed = reviewCourseRequestSchema.parse(body);

    const request = await reviewCourseRequest(id, parsed, adminId, {
      roleId: roleId,
    });
    return NextResponse.json({ request });
  } catch (error: unknown) {
    if (error instanceof EducationFlowUnavailableError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503 }
      );
    }
    if (error instanceof CourseRequestDecisionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    if (error instanceof ZodError) {
      const [firstIssue] = error.issues;
      return NextResponse.json(
        { error: firstIssue?.message ?? "Malformed decision body." },
        { status: 400 }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Malformed decision body." },
        { status: 400 }
      );
    }
    // Sanitized dependency failure: never leak storage internals.
    return NextResponse.json(
      { error: "Course request storage is temporarily unavailable." },
      { status: 503 }
    );
  }
}

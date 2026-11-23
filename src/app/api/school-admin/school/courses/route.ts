import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCourseSchema } from "@/modules/school-admin/school-courses/types/school-courses.schema";
import {
  createMyCourse,
  getMyCourses,
} from "@/modules/school-admin/services/school-admin.service";
import {
  RosterHttpError,
  resolveSchoolAdminContext,
} from "@/modules/school-admin/student-roster/services/roster-auth";
import { checkRestriction } from "@/lib/status-validator";

/**
 * Route-local strict create body: the shared course fields plus a literal
 * Active status, closed-world (`.strict()`). Any forged ownership, audit, or
 * status key (`school_id`, `created_by`, `updated_by`, `created_at`,
 * non-Active `course_status`, ...) fails with 400 and never reaches the
 * service spread. Only the four parsed fields below are forwarded.
 */
const strictCreateCourseBodySchema = createCourseSchema
  .extend({ course_status: z.literal("Active") })
  .strict();

const SANITIZED_DEPENDENCY_BODY = { error: "Service temporarily unavailable." };

function authErrorResponse(error: RosterHttpError): NextResponse {
  if (error.status === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (error.status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(SANITIZED_DEPENDENCY_BODY, { status: 503 });
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await resolveSchoolAdminContext(req);
    const courses = await getMyCourses(schoolId);
    return NextResponse.json({ courses });
  } catch (err: unknown) {
    if (err instanceof RosterHttpError) return authErrorResponse(err);
    return NextResponse.json(SANITIZED_DEPENDENCY_BODY, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await resolveSchoolAdminContext(req);

    // Validate MANAGE_COURSES Restriction
    const isRestricted = await checkRestriction(userId, "MANAGE_COURSES");
    if (isRestricted) {
      return NextResponse.json(
        { error: "Your course management privileges are temporarily suspended." },
        { status: 403 }
      );
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
    }
    const parsed = strictCreateCourseBodySchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid course payload.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const created = await createMyCourse(
      schoolId,
      {
        course_name: parsed.data.course_name,
        course_code: parsed.data.course_code ?? null,
        course_category: parsed.data.course_category ?? null,
        degree: parsed.data.degree,
        course_status: "Active",
      },
      userId
    );

    return NextResponse.json({ course: created }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof RosterHttpError) return authErrorResponse(err);
    return NextResponse.json(SANITIZED_DEPENDENCY_BODY, { status: 503 });
  }
}

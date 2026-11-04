import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  hasRole,
  isAdministratorSession,
  AuthenticatedSession,
} from "@/lib/authenticated-session";
import {
  getMySchool,
  getCourseById,
  updateMyCourse,
} from "@/modules/school-admin/services/school-admin.service";

import { safeErrorMessage } from "@/lib/api-error";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isSchoolAdminSession(session: AuthenticatedSession): boolean {
  return hasRole(session, [4], ["SCHOOL_ADMIN", "SCHOOL ADMINISTRATOR", "SCHOOLADMIN"]);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const resolvedParams = await params;
    const courseId = parseInt(resolvedParams.courseId, 10);
    if (isNaN(courseId)) {
      return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
    }

    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const isAdmin = isAdministratorSession(session);
    const isSchoolAdmin = isSchoolAdminSession(session);
    if (!isAdmin && !isSchoolAdmin) {
      return NextResponse.json(
        { error: "Forbidden: School administrators only." },
        { status: 403 }
      );
    }

    const userId = Number(session.userId);

    // Verify course exists
    const existingCourse = await getCourseById(courseId);
    if (!existingCourse) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    // Tenant boundary check for school admins
    if (!isAdmin) {
      const school = await getMySchool(userId);
      if (!school) {
        return NextResponse.json({ error: "School assignment not found." }, { status: 404 });
      }

      if (Number(existingCourse.school_id) !== Number(school.school_id)) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to modify courses for another school." },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const updated = await updateMyCourse(courseId, body, userId);

    return NextResponse.json({ course: updated });
  } catch (error: unknown) {
    const message = safeErrorMessage(error, "Internal server error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

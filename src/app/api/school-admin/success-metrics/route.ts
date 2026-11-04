// src/app/api/school-admin/success-metrics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSchoolSuccessMetrics } from '@/modules/school-admin/success-metrics/services/success-metrics.service';
import { SuccessMetricsFilterSchema } from '@/modules/school-admin/success-metrics/types/success-metrics.schema';
import { authenticateRequest, hasRole, isAdministratorSession } from '@/lib/authenticated-session';
import { fetchSchoolByUserIdRepo } from '@/modules/school-admin/services/school-admin.repo';
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await authenticateRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const isSchoolAdmin = session ? hasRole(session, [3, 4], ["ADMIN", "ADMINISTRATOR", "SCHOOL_ADMIN", "SCH_ADMIN"]) : false;
    if (session && !isSchoolAdmin) {
      return NextResponse.json({ error: "Forbidden: school admin role required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    const schoolId = searchParams.get('school_id');
    const schoolYear = searchParams.get('school_year') || undefined;
    const schoolCourseId = searchParams.get('school_course_id') || undefined;
    const isAlumni = searchParams.get('is_alumni') || undefined;

    const parseResult = SuccessMetricsFilterSchema.safeParse({
      school_id: schoolId,
      school_year: schoolYear,
      school_course_id: schoolCourseId,
      is_alumni: isAlumni,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_FAILED',
          message: 'Invalid filter parameters provided.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    // Only a platform administrator may query another school; every other caller is bound to its own school,
    // regardless of whether hasRole matched on role id or role name above.
    if (!isAdministratorSession(session)) {
      const schoolAdminData = await fetchSchoolByUserIdRepo(Number(session.userId));
      if (!schoolAdminData || String(schoolAdminData.school_id) !== String(parseResult.data.school_id)) {
        return NextResponse.json({ error: "Forbidden: unauthorized school access." }, { status: 403 });
      }
    }

    const metricsData = await getSchoolSuccessMetrics(parseResult.data);

    return NextResponse.json({
      success: true,
      data: metricsData,
    });
  } catch (error: unknown) {
    const message = safeErrorMessage(error, "Internal server error calculating metrics");
    console.error('[API /api/school-admin/success-metrics] Error:', error);
    return NextResponse.json(
      {
        error: 'INTERNAL_FAIL',
        message,
      },
      { status: 500 }
    );
  }
}

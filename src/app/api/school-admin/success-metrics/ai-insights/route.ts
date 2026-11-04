// src/app/api/school-admin/success-metrics/ai-insights/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateMetricsAiInsights } from '@/modules/school-admin/success-metrics/services/success-metrics-ai.service';
import { AiMetricsInsightRequestSchema } from '@/modules/school-admin/success-metrics/types/success-metrics.schema';
import { authenticateRequest, hasRole } from '@/lib/authenticated-session';
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await authenticateRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const isSchoolAdmin = session ? hasRole(session, [3, 4], ["ADMIN", "ADMINISTRATOR", "SCHOOL_ADMIN", "SCH_ADMIN"]) : false;
    if (session && !isSchoolAdmin) {
      return NextResponse.json({ error: "Forbidden: school admin role required." }, { status: 403 });
    }

    const body = await request.json();

    const parseResult = AiMetricsInsightRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_FAILED',
          message: 'Invalid metrics summary payload for AI analysis.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    // STRICT ISOLATION: Passes in-memory stats to AI without touching the database
    const insights = await generateMetricsAiInsights(parseResult.data);

    return NextResponse.json({
      success: true,
      data: insights,
    });
  } catch (error: unknown) {
    const message = safeErrorMessage(error, "Internal server error generating AI insights");
    console.error('[API /api/school-admin/success-metrics/ai-insights] Error:', error);
    return NextResponse.json(
      {
        error: 'INTERNAL_FAIL',
        message,
      },
      { status: 500 }
    );
  }
}

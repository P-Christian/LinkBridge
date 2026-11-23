// src/app/api/school-admin/job-referrals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveJobsService,
  getEligibleStudentCandidatesService,
  createBatchReferralsService,
  getAdminReferralsService,
  ReferralBatchConflictError,
} from '@/modules/school-admin/job-referrals/services';
import { createReferralsSchema } from '@/modules/school-admin/job-referrals/types/job-referrals.schema';
import { resolveSchoolAdminContext, RosterHttpError } from '@/modules/school-admin/student-roster/services/roster-auth';
import { fetchSchoolByIdRepo } from '@/modules/school-admin/services/school-admin.repo';
import { getReferralBaseUrl } from '@/lib/mail/templates/base-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toErrorStatus(error: unknown, fallback: number): { status: number; message: string } {
  if (error instanceof RosterHttpError) {
    return { status: error.status, message: error.message };
  }
  const msg = error instanceof Error ? error.message : 'Internal server error';
  return { status: fallback, message: msg };
}

async function getAuthSession(req: NextRequest) {
  const { userId, schoolId } = await resolveSchoolAdminContext(req);
  const school = await fetchSchoolByIdRepo(schoolId);

  return {
    userId,
    schoolId,
    schoolName: school?.school_name || 'Partner School',
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. School Admin access required.' }, { status: 401 });
    }

    const origin = getReferralBaseUrl();

    const [jobs, students, referrals] = await Promise.all([
      getActiveJobsService().catch((err) => {
        console.error('Error fetching jobs:', err);
        return [];
      }),
      getEligibleStudentCandidatesService(session.schoolId).catch((err) => {
        console.error('Error fetching student candidates:', err);
        return [];
      }),
      getAdminReferralsService(session.userId, origin).catch((err) => {
        console.error('Error fetching admin referrals:', err);
        return [];
      }),
    ]);

    return NextResponse.json({
      school: {
        school_id: session.schoolId,
        school_name: session.schoolName,
      },
      jobs,
      students,
      referrals,
    });
  } catch (error: unknown) {
    const { status, message } = toErrorStatus(error, 500);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. School Admin access required.' }, { status: 401 });
    }

    const rawBody = await req.json();
    const parsed = createReferralsSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const origin = getReferralBaseUrl();
    const results = await createBatchReferralsService(session.userId, session.schoolId, origin, parsed.data);

    return NextResponse.json({
      success: true,
      count: results.length,
      data: results,
    }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ReferralBatchConflictError) {
      return NextResponse.json({ error: error.message, blocked: error.blocked }, { status: 409 });
    }
    const { status, message } = toErrorStatus(error, 400);
    return NextResponse.json({ error: message }, { status });
  }
}

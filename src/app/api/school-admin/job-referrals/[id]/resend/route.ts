import { NextRequest, NextResponse } from 'next/server';
import { getReferralBaseUrl } from '@/lib/mail/templates/base-url';
import { resendReferralEmailService, ReferralActionError } from '@/modules/school-admin/job-referrals/services';
import { resolveSchoolAdminContext, RosterHttpError } from '@/modules/school-admin/student-roster/services/roster-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const referralId = Number(id);
    if (!Number.isSafeInteger(referralId) || referralId <= 0) {
      return NextResponse.json({ error: 'Referral not found.' }, { status: 404 });
    }
    const { userId } = await resolveSchoolAdminContext(req);
    const result = await resendReferralEmailService(userId, referralId, getReferralBaseUrl());
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    if (error instanceof RosterHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ReferralActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

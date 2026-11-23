import { NextRequest, NextResponse } from 'next/server';
import { createShareLinkService } from '@/modules/school-admin/job-referrals/services';
import { createShareLinkSchema } from '@/modules/school-admin/job-referrals/types/job-referrals.schema';
import { resolveSchoolAdminContext, RosterHttpError } from '@/modules/school-admin/student-roster/services/roster-auth';
import { getReferralBaseUrl } from '@/lib/mail/templates/base-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await resolveSchoolAdminContext(req);

    const rawBody = await req.json().catch(() => ({}));
    const parsed = createShareLinkSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = await createShareLinkService(
      userId,
      parsed.data.job_id,
      getReferralBaseUrl(),
      parsed.data.expires_in_days
    );

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof RosterHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

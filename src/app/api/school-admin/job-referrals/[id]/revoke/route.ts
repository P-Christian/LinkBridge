import { NextRequest, NextResponse } from 'next/server';
import { revokeReferralRecord } from '@/modules/freelancer/freelancer-referrals/services/referral.service';
import { resolveSchoolAdminContext, RosterHttpError } from '@/modules/school-admin/student-roster/services/roster-auth';

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (DIRECTUS_TOKEN) h['Authorization'] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const referralId = Number(id);
    if (!Number.isSafeInteger(referralId) || referralId <= 0) {
      return NextResponse.json({ error: 'Referral not found.' }, { status: 404 });
    }

    const { userId } = await resolveSchoolAdminContext(req);

    const refRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_referral/${referralId}?fields=referrer_user_id,status`,
      { headers: getHeaders(), cache: 'no-store' }
    );
    if (!refRes.ok) {
      return NextResponse.json({ error: 'Referral not found.' }, { status: 404 });
    }

    const referral = (await refRes.json()).data;
    if (!referral) {
      return NextResponse.json({ error: 'Referral not found.' }, { status: 404 });
    }

    if (Number(referral.referrer_user_id) !== userId) {
      return NextResponse.json({ error: 'Unauthorized access to this referral.' }, { status: 403 });
    }

    const status = String(referral.status ?? '').toUpperCase();
    if (status === 'CLAIMED' || status === 'APPLIED') {
      return NextResponse.json(
        { error: 'Cannot revoke a claimed or applied referral.' },
        { status: 400 }
      );
    }
    if (status === 'REVOKED') {
      return NextResponse.json({ success: true });
    }

    await revokeReferralRecord(referralId, status, `admin:${userId}`, 'Revoked by School Admin');

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof RosterHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextResponse, type NextRequest } from 'next/server';
import { inviteStudentService } from '@/modules/school-admin/student-roster/services';
import {
  RosterHttpError,
  resolveSchoolAdminContext,
} from '@/modules/school-admin/student-roster/services/roster-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function resolveStudentInviteOrigin(req: NextRequest): string {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const forwardedHost = req.headers.get('x-forwarded-host');
  const host = (forwardedHost || req.headers.get('host') || '').trim();
  const proto =
    req.headers.get('x-forwarded-proto') ||
    (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');

  // 1. If host matches one of the configured ALLOWED_ORIGINS, use that origin directly
  if (host && allowedOrigins.length > 0) {
    const matched = allowedOrigins.find((origin) => {
      try {
        const u = new URL(origin);
        return u.host.toLowerCase() === host.toLowerCase();
      } catch {
        return false;
      }
    });
    if (matched) return matched.replace(/\/$/, '');
  }

  // 2. Check NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_SITE_URL if configured
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (appUrl?.trim()) {
    return appUrl.trim().replace(/\/$/, '');
  }

  // 3. If incoming host is a remote / external domain or IP (not localhost), use it
  if (host && !host.includes('localhost') && !host.startsWith('127.0.0.1')) {
    return `${proto}://${host}`.replace(/\/$/, '');
  }

  // 4. If request is from localhost but public ALLOWED_ORIGINS are configured, prefer primary public origin
  if (allowedOrigins.length > 0 && !allowedOrigins[0].includes('localhost') && !allowedOrigins[0].includes('127.0.0.1')) {
    return allowedOrigins[0].replace(/\/$/, '');
  }

  // 5. Fallback to local request origin
  return req.nextUrl.origin.replace(/\/$/, '');
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await resolveSchoolAdminContext(req);

    const { id } = await params;
    const studentId = Number(id);

    if (!Number.isSafeInteger(studentId) || studentId <= 0) {
      throw new RosterHttpError(400, 'Invalid student ID');
    }

    const origin = resolveStudentInviteOrigin(req);
    const result = await inviteStudentService(schoolId, studentId, origin);

    return NextResponse.json({
      success: true,
      token: result.token,
      invitation_url: result.invitation_url,
      expires_at: result.expires_at,
      student: result.student,
    });
  } catch (error: unknown) {
    if (error instanceof RosterHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Student invitation service is temporarily unavailable' },
      { status: 503 },
    );
  }
}

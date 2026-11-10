import { NextRequest } from 'next/server';
import * as jose from 'jose';
import { isDevAuthBypassEnabled, DEV_BYPASS_USER_ID } from '@/lib/dev-auth-bypass';
import { getJwtVerificationSecret } from '@/modules/auth/registration/registration.session';

const COOKIE_NAME = 'vos_sync_access_token';

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

export class RosterHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'RosterHttpError';
    this.status = status;
  }
}

export interface SchoolAdminRoleClaim {
  roleId: number | null;
  roleName: string;
}

export function assertSchoolAdminRole(claim: SchoolAdminRoleClaim): void {
  const name = (claim.roleName || '').toUpperCase();
  if (claim.roleId === 4 || name === 'SCHOOL_ADMIN' || name === 'SCH_ADMIN') return;
  throw new RosterHttpError(403, 'Forbidden: School Admin role required');
}

function toRoleId(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

async function verifySchoolAdminRequest(req: NextRequest): Promise<{ userId: number }> {
  if (isDevAuthBypassEnabled()) {
    return { userId: DEV_BYPASS_USER_ID };
  }
  const token =
    req.cookies.get(COOKIE_NAME)?.value ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    null;
  if (!token) throw new RosterHttpError(401, 'Unauthorized');

  const secret = getJwtVerificationSecret();
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    const userId = Number(payload.user_id ?? payload.sub ?? payload.id);
    if (!userId) throw new RosterHttpError(401, 'Unauthorized');
    assertSchoolAdminRole({
      roleId: toRoleId(payload.role_id ?? payload.role),
      roleName: String(payload.role_name ?? payload.role ?? ''),
    });
    return { userId };
  } catch (error) {
    if (error instanceof RosterHttpError) throw error;
    throw new RosterHttpError(401, 'Unauthorized');
  }
}

export async function resolveExactSchoolAssignment(userId: number): Promise<{ schoolId: number }> {
  const url =
    `${DIRECTUS_BASE}/items/vs_school_admin` +
    `?filter[user_id][_eq]=${userId}&filter[is_active][_eq]=true&limit=3`;
  const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' });
  if (!res.ok) {
    throw new RosterHttpError(503, 'Dependency unavailable: assignment lookup failed');
  }
  const json = await res.json();
  const rows = Array.isArray(json.data) ? json.data : [];
  const schoolId = rows.length === 1 ? Number(rows[0].school_id) : NaN;
  if (!Number.isSafeInteger(schoolId) || schoolId <= 0) {
    throw new RosterHttpError(403, 'Forbidden: exactly one active school assignment is required');
  }
  return { schoolId };
}

export async function resolveSchoolAdminContext(req: NextRequest): Promise<{ userId: number; schoolId: number }> {
  const { userId } = await verifySchoolAdminRequest(req);
  const { schoolId } = await resolveExactSchoolAssignment(userId);
  return { userId, schoolId };
}

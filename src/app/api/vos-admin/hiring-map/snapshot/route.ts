// src/app/api/vos-admin/hiring-map/snapshot/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { authenticateRequest, isAdministratorSession } from '@/lib/authenticated-session';
import { fetchHires } from '@/modules/vos-admin/server/hiring-map.server';

export const dynamic = 'force-dynamic';

/** GET → { hires: HireEvent[], serverTime } — every HIRED application, privacy-trimmed. Admins only. */
export async function GET(request: NextRequest) {
  const session = await authenticateRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdministratorSession(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const hires = await fetchHires();
    return NextResponse.json(
      { hires, serverTime: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[hiring-map] snapshot failed', error);
    return NextResponse.json({ error: 'Could not load hires' }, { status: 502 });
  }
}


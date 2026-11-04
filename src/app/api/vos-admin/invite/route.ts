import { NextResponse } from 'next/server';
import { isDevAuthBypassEnabled } from '@/lib/dev-auth-bypass';
import { cookies } from 'next/headers';
import * as jose from 'jose';
import { z } from 'zod';
import { getJwtVerificationSecret } from '@/modules/auth/registration/registration.session';

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

interface AdminAuth {
    adminId: number;
    roleId: number;
}

async function verifyVosAdmin(req: Request): Promise<AdminAuth | null> {
    if (isDevAuthBypassEnabled()) {
        return { adminId: 1, roleId: 3 };
    }

    let token = req.headers.get("authorization")?.replace("Bearer ", "") || null;
    if (!token) {
        const cookieStore = await cookies();
        token = cookieStore.get("vos_sync_access_token")?.value ?? null;
    }
    if (!token) return null;

    try {
        const secret = getJwtVerificationSecret();
        const { payload } = await jose.jwtVerify(token, secret);
        return {
            adminId: Number(payload.sub || payload.user_id || payload.id),
            roleId: Number(payload.role_id ?? payload.role ?? 0),
        };
    } catch {
        return null;
    }
}

function getHeaders() {
    const h: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
    if (DIRECTUS_TOKEN) h['Authorization'] = `Bearer ${DIRECTUS_TOKEN}`;
    return h;
}

const inviteBodySchema = z.object({
    school_id: z.number().int().positive(),
    invited_email: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "A valid email is required."),
});

export async function POST(req: Request) {
    try {
        const auth = await verifyVosAdmin(req);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (auth.roleId !== 3) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const parsed = inviteBodySchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }
        const { school_id, invited_email } = parsed.data;

        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 72);

        const tokenUrl = `${DIRECTUS_BASE}/items/vs_invite_token`;
        const res = await fetch(tokenUrl, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                token,
                school_id,
                invited_email,
                invited_by: auth.adminId,
                expires_at: expiresAt.toISOString(),
                is_used: false,
            }),
        });

        if (!res.ok) {
            const errJson = await res.json().catch(() => null);
            return NextResponse.json(
                { error: errJson?.errors?.[0]?.message || "Failed to create invite token" },
                { status: 502 }
            );
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
        const invitationUrl = `${baseUrl}/school-register?token=${token}`;

        return NextResponse.json({
            invitation_url: invitationUrl,
            expires_at: expiresAt.toISOString(),
        });
    } catch (error: unknown) {
        console.error("Invite API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

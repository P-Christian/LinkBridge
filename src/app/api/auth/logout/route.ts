// src/app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createAuditRecordRepo } from "@/modules/vos-admin/audit-trail";

import { revokeUserSession } from "@/modules/auth/sessions/session.repo";
import { getJwtVerificationSecret } from "@/modules/auth/registration/registration.session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_sync_access_token";

export async function POST(req: NextRequest) {
    const token = req.cookies.get(COOKIE_NAME)?.value || req.headers.get("authorization")?.replace("Bearer ", "");
    let userId: number | null = null;
    let sessionId: string | null = null;

    if (token) {
        try {
            const { payload } = await jwtVerify(token, getJwtVerificationSecret());
            userId = Number(payload.sub || payload.user_id || payload.id);
            sessionId = typeof payload.sid === "string" ? payload.sid : null;
        } catch {
            // Ignore invalid token on logout
        }
    }

    if (sessionId) {
        try {
            await revokeUserSession(sessionId, "LOGOUT");
        } catch (err) {
            console.error("[api/auth/logout] Failed to revoke session in vs_user_sessions:", err);
        }
    }

    createAuditRecordRepo({
        event_type: "USER_LOGOUT",
        event_category: "AUTHENTICATION",
        action: "LOGOUT",
        status: "SUCCESS",
        actor_type: "USER",
        actor_user_id: userId,
        reason: "User logged out",
    });

    console.log(`[api/auth/logout] Logging out user_id=${userId}`);

    const res = NextResponse.json({ ok: true });

    const hostname = req.nextUrl.hostname;

    // Delete using Next.js cookie helper
    res.cookies.delete(COOKIE_NAME);
    res.cookies.delete({ name: COOKIE_NAME, path: "/" });
    res.cookies.delete("vos_sync_access_token");
    res.cookies.delete({ name: "vos_sync_access_token", path: "/" });

    // Explicit Set-Cookie headers for guaranteed browser cookie eviction across custom hosts (e.g. vos-sync-local)
    res.headers.append("Set-Cookie", `${COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax`);
    res.headers.append("Set-Cookie", `vos_sync_access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax`);
    if (hostname) {
        res.headers.append("Set-Cookie", `${COOKIE_NAME}=; Path=/; Domain=${hostname}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax`);
        res.headers.append("Set-Cookie", `${COOKIE_NAME}=; Path=/; Domain=.${hostname}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax`);
        res.headers.append("Set-Cookie", `vos_sync_access_token=; Path=/; Domain=${hostname}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax`);
        res.headers.append("Set-Cookie", `vos_sync_access_token=; Path=/; Domain=.${hostname}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax`);
    }

    return res;
}

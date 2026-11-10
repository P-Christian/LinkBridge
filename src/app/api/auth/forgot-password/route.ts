import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/modules/auth/services/auth.service";
import { getClientIp, rateLimitRetryAfterMs, tooManyRequestsResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SEC-007: this endpoint sends mail, so the budget is deliberately small.
const FORGOT_EMAIL_REQUESTS = 5;
const FORGOT_IP_REQUESTS = 10;
const FORGOT_WINDOW_MS = 15 * 60_000;

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim();

    if (!email) {
        return NextResponse.json(
            { ok: false, message: "Email is required." },
            { status: 400 }
        );
    }

    const retryAfterMs =
        rateLimitRetryAfterMs("auth:forgot-password:email", email, FORGOT_EMAIL_REQUESTS, FORGOT_WINDOW_MS) ||
        rateLimitRetryAfterMs("auth:forgot-password:ip", getClientIp(req), FORGOT_IP_REQUESTS, FORGOT_WINDOW_MS);
    if (retryAfterMs) return tooManyRequestsResponse(retryAfterMs);

    try {
        await requestPasswordReset(email);

        return NextResponse.json(
            { ok: true, message: "If that email is registered, a reset code has been sent." },
            { status: 200 }
        );

    } catch (err: unknown) {
        console.error("[auth/forgot-password] Error:", err);
        
        return NextResponse.json(
            { ok: false, message: "Failed to process reset request." },
            { status: 500 }
        );
    }
}

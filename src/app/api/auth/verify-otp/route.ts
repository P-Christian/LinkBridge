import { NextRequest, NextResponse } from "next/server";
import { confirmOTP } from "@/modules/auth/services/auth.service";
import { legacyRegistrationRetiredResponse } from "@/modules/auth/registration";
import { getClientIp, rateLimitRetryAfterMs, tooManyRequestsResponse } from "@/lib/rate-limit";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_sync_access_token";
const COOKIE_MAX_AGE_CAP = 60 * 60 * 24 * 7;

// SEC-007: six-digit codes need a tight per-target budget or the endpoint
// becomes a blind oracle.
const OTP_TARGET_REQUESTS = 6;
const OTP_IP_REQUESTS = 15;
const OTP_WINDOW_MS = 10 * 60_000;

export async function POST(req: NextRequest) {
    const retired = legacyRegistrationRetiredResponse();
    if (retired) return retired;
    const body = await req.json().catch(() => null);

    // SEC-023: keyed by the email the requester submitted, never by a numeric
    // vs_user.user_id, so no sequential id is needed to aim this endpoint.
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = body?.code;

    if (!email || !code) {
        return NextResponse.json(
            { ok: false, message: "Email and OTP code are required." },
            { status: 400 }
        );
    }

    const retryAfterMs =
        rateLimitRetryAfterMs("auth:verify-otp:target", email, OTP_TARGET_REQUESTS, OTP_WINDOW_MS) ||
        rateLimitRetryAfterMs("auth:verify-otp:ip", getClientIp(req), OTP_IP_REQUESTS, OTP_WINDOW_MS);
    if (retryAfterMs) return tooManyRequestsResponse(retryAfterMs);

    try {
        const { token, role_id } = await confirmOTP(email, code);

        const res = NextResponse.json(
            { 
                ok: true, 
                message: "OTP verified successfully.", 
                role_id
            },
            { status: 200 }
        );

        res.cookies.set({
            name: COOKIE_NAME,
            value: token,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: COOKIE_MAX_AGE_CAP,
        });

        return res;

    } catch (err: unknown) {
        console.error("[auth/verify-otp] Error:", err);
        
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
        const status = errorMessage.includes("Invalid") || errorMessage.includes("expired") ? 400 : 500;

        return NextResponse.json(
            { ok: false, message: status === 500 ? safeErrorMessage(err, "An unexpected error occurred.") : errorMessage },
            { status }
        );
    }
}

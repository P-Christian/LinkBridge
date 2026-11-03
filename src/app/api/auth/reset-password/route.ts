import { NextRequest, NextResponse } from "next/server";
import { confirmPasswordReset } from "@/modules/auth/services/auth.service";
import { getClientIp, rateLimitRetryAfterMs, tooManyRequestsResponse } from "@/lib/rate-limit";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SEC-007: same budget as /verify-otp — this endpoint redeems a reset code.
const RESET_TARGET_REQUESTS = 6;
const RESET_IP_REQUESTS = 15;
const RESET_WINDOW_MS = 10 * 60_000;

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);
    
    // SEC-023: the reset is targeted by the email the requester holds. The numeric
    // userId the legacy signup response used to leak is no longer accepted here.
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const otp = typeof body?.otp === "string" ? body.otp.trim() : "";
    const newPassword = body?.newPassword;

    if (!email || !otp || !newPassword) {
        return NextResponse.json(
            { ok: false, message: "Email, reset code, and new password are required." },
            { status: 400 }
        );
    }

    const retryAfterMs =
        rateLimitRetryAfterMs("auth:reset-password:target", email, RESET_TARGET_REQUESTS, RESET_WINDOW_MS) ||
        rateLimitRetryAfterMs("auth:reset-password:ip", getClientIp(req), RESET_IP_REQUESTS, RESET_WINDOW_MS);
    if (retryAfterMs) return tooManyRequestsResponse(retryAfterMs);

    try {
        await confirmPasswordReset(email, otp, newPassword);

        return NextResponse.json(
            { ok: true, message: "Password updated successfully." },
            { status: 200 }
        );

    } catch (err: unknown) {
        console.error("[auth/reset-password] Error:", err);
        
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
        const status = errorMessage.includes("Invalid") || errorMessage.includes("expired") || errorMessage.includes("not found") ? 400 : 500;

        return NextResponse.json(
            { ok: false, message: status === 500 ? safeErrorMessage(err, "An unexpected error occurred.") : errorMessage },
            { status }
        );
    }
}

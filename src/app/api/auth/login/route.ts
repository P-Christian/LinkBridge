// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { loginUser, AuthFailure } from "@/modules/auth/services/auth.service";
import { rateLimitRetryAfterMs, tooManyRequestsResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_sync_access_token";
const COOKIE_MAX_AGE_CAP = 60 * 60 * 24 * 7; // 7 days cap

// SEC-007: the account lockout only exists once an email is recognised, so the
// IP bucket is what slows credential stuffing across many accounts.
const LOGIN_IP_REQUESTS = 10;
const LOGIN_IP_WINDOW_MS = 60_000;
const LOGIN_ACCOUNT_REQUESTS = 8;
const LOGIN_ACCOUNT_WINDOW_MS = 15 * 60_000;

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);

    const email = String(body?.email ?? "").trim();
    const hashPassword = String(body?.hashPassword ?? body?.password ?? "").trim();

    const userAgent = req.headers.get("user-agent");
    const forwarded = req.headers.get("x-forwarded-for");
    const ipAddress = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip") || "127.0.0.1";
    const deploymentId = req.headers.get("host") || req.nextUrl.hostname || "default";

    const retryAfterMs =
        rateLimitRetryAfterMs("auth:login:ip", ipAddress, LOGIN_IP_REQUESTS, LOGIN_IP_WINDOW_MS) ||
        (email ? rateLimitRetryAfterMs("auth:login:account", email, LOGIN_ACCOUNT_REQUESTS, LOGIN_ACCOUNT_WINDOW_MS) : 0);
    if (retryAfterMs) return tooManyRequestsResponse(retryAfterMs);

    try {
        const { token, role_id, role, role_name, destination } = await loginUser(
            email,
            hashPassword,
            { deploymentId, userAgent, ipAddress }
        );

        const res = NextResponse.json(
            {
                ok: true,
                message: "Login successful.",
                role_id,
                role,
                role_name,
                destination,
            },
            { headers: { "Cache-Control": "no-store" } }
        );

        const isHttps = req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";

        res.cookies.set({
            name: COOKIE_NAME,
            value: token,
            httpOnly: true,
            sameSite: "lax",
            secure: isHttps,
            path: "/",
            maxAge: COOKIE_MAX_AGE_CAP,
        });

        return res;

    } catch (err: unknown) {
        // SEC-023: the service returns a machine-readable reason, so the wording
        // it hands back can stay generic without this handler guessing at substrings.
        if (err instanceof AuthFailure) {
            return NextResponse.json(
                { ok: false, code: err.reason, message: err.message },
                { status: err.statusCode, headers: { "Cache-Control": "no-store" } }
            );
        }

        // Anything else (e.g. RegistrationError from session issuing) still maps
        // through the legacy wording so its status does not regress to 500.
        const errorMessage = err instanceof Error ? err.message : "Server is down, please contact Administrator.";
        const isClientError =
            errorMessage.includes("Credentials invalid") ||
            errorMessage.includes("Account is blocked") ||
            errorMessage.includes("Account is locked") ||
            errorMessage.includes("Account locked") ||
            errorMessage.includes("required");
        const isInactive = errorMessage.includes("not active or verified") ||
                           errorMessage.includes("suspended") ||
                           errorMessage.includes("blocked") ||
                           errorMessage.includes("pending verification") ||
                           errorMessage.includes("deactivated") ||
                           errorMessage.includes("pending deletion");
        const status = isInactive ? 403 : isClientError ? 400 : 500;

        return NextResponse.json(
            {
                ok: false,
                message: status === 500
                    ? "Login could not be completed."
                    : errorMessage,
            },
            { status, headers: { "Cache-Control": "no-store" } }
        );
    }
}

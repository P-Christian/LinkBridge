/**
 * src/lib/auth-utils.ts
 * Centralized JWT utilities for VOS ERP.
 */

export const COOKIE_NAME = "vos_sync_access_token";
export const REFRESH_COOKIE_NAME = "refreshToken"; // Matches Spring Boot backend
export const SPRING_COOKIE_NAME = "springboot_token";
export const LAST_VISITED_PATH_COOKIE = "vos_last_visited_path";
export const COOKIE_MAX_AGE_CAP = 60 * 60 * 24 * 7; // 7 days cap
export const REFRESH_PATH = "/";

/**
 * Shared cookie options for consistency.
 */
export const getCookieOptions = (remember: boolean, path: string = "/", maxAgeOverride?: number) => {
    const hasMaxAge = maxAgeOverride !== undefined || remember;
    const maxAgeVal = maxAgeOverride !== undefined ? maxAgeOverride : COOKIE_MAX_AGE_CAP;
    return {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        path,
        ...(hasMaxAge ? { maxAge: maxAgeVal } : {}),
    };
};

export interface JwtPayload {
    sub: string;
    email: string;
    FirstName?: string;
    MiddleName?: string;
    LastName?: string;
    role?: string;
    subsystems?: string[];
    iat?: number;
    exp?: number;
    [key: string]: unknown;
}

/**
 * Decodes a JWT payload without verifying the signature.
 * Safe for use in both Client and Server environments (if using Buffer or atob).
 * Note: Next.js middleware supports `Buffer`.
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
    if (!token) return null;

    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;

        const base64Url = parts[1];
        let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

        // Pad for base64
        while (base64.length % 4) {
            base64 += "=";
        }

        const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
        return JSON.parse(jsonPayload) as JwtPayload;
    } catch (error) {
        console.error("[auth-utils] Error decoding JWT payload:", error);
        return null;
    }
}

/**
 * Utility to extract token from various backend response formats.
 */
export function pickTokenFromPayload(payload: Record<string, unknown> | string | null): string | null {
    if (!payload) return null;
    if (typeof payload === "string") return payload.trim() || null;

    const t = payload.token ?? payload.accessToken ?? payload.access_token ?? payload.jwt;
    return typeof t === "string" && t.trim() ? t.trim() : null;
}

/**
 * Extracts the real client IP from standard proxy headers.
 */
export function extractClientIp(headers: Headers): string | null {
    const xff = headers.get("x-forwarded-for");
    if (xff) {
        const first = xff.split(",")[0].trim();
        if (first) return first;
    }
    const realIp = headers.get("x-real-ip");
    if (realIp) return realIp.trim();
    return null;
}

/**
 * SEC-022: geolocation lookup for the session list has been removed.
 *
 * This helper used to call `http://ip-api.com/json/<ip>` — cleartext HTTP, to an
 * external host, with the signed-in user's own IP, on every read of
 * `/api/{client,freelancer}/settings/sessions`. The resolved lat/lon only ever
 * fed a cosmetic `location` label on a row the user is looking at; it was never
 * persisted (`location_label` is a separate column that no caller populates) and
 * never used for a security decision. The value did not justify shipping a user's
 * IP to a third party, so the feature is dropped rather than upgraded to HTTPS.
 *
 * The session rows still render the IP address and the parsed user agent, which
 * is what the list needs; the callers keep their existing "Philippines" fallback
 * label (the same one already used whenever this lookup failed or timed out).
 *
 * If geolocation is ever required for a real security decision (new-location
 * alerts, impossible travel), resolve it once at login over HTTPS and persist it
 * into `vs_user_sessions.location_label` — do not re-query a third party with the
 * IP on every list view.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the argument is kept only so the session-list call sites keep their shape
export async function resolveIpGeo(_ip: string): Promise<{ latitude: number; longitude: number } | null> {
    return null;
}


// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";
import { canAuthenticate, isSessionEpochStale, isSessionRevoked } from "@/lib/status-validator";
import { getJwtVerificationSecret } from "@/modules/auth/registration/registration.session";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth-bypass";

const COOKIE_NAME = "vos_sync_access_token";
const PROTECTED_PREFIXES = ["/dashboard", "/scm", "/fm", "/hrm", "/bia", "/arf", "/cafeteria", "/vos-sync", "/main-dashboard"];
const PUBLIC_FILE = /\.(.*)$/;

function isProtectedPath(pathname: string) {
    const pathLower = pathname.toLowerCase();
    if (pathLower === "/vos-sync/freelancer/jobs" || pathLower.startsWith("/vos-sync/freelancer/jobs/")) {
        return false;
    }
    return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
    if (isDevAuthBypassEnabled()) {
        return NextResponse.next();
    }

    const { pathname } = req.nextUrl;

    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon.ico") ||
        pathname.startsWith("/robots.txt") ||
        pathname.startsWith("/sitemap.xml") ||
        pathname.startsWith("/server-down") ||
        pathname.startsWith("/api/health") ||
        PUBLIC_FILE.test(pathname)
    ) {
        return NextResponse.next();
    }

    if (pathname === "/login" || pathname === "/signup") {
        const token = req.cookies.get(COOKIE_NAME)?.value;
        if (token) {
            try {
                const secret = getJwtVerificationSecret();
                const { payload } = await jose.jwtVerify(token, secret);
                const userRoleId = Number(payload.role_id);
                const userRoleName = typeof payload.role_name === "string" ? payload.role_name : (typeof payload.role === "string" ? payload.role : "");
                const roleUpper = userRoleName.toUpperCase();

                let roleDashboard = "/vos-sync/freelancer/dashboard";
                if (userRoleId === 2 || roleUpper === "CLIENT" || roleUpper === "EMPLOYER") {
                    roleDashboard = "/vos-sync/client/dashboard";
                } else if (userRoleId === 3 || roleUpper === "ADMIN" || roleUpper === "ADMINISTRATOR") {
                    roleDashboard = "/vos-sync/vos-admin";
                } else if (userRoleId === 4 || roleUpper === "SCHOOL_ADMIN" || roleUpper === "SCH_ADMIN" || roleUpper === "SCHOOL") {
                    roleDashboard = "/vos-sync/school-admin";
                }

                // Break redirect loop if user is already on /login?next=<dashboard>
                const nextParam = req.nextUrl.searchParams.get("next");
                if (nextParam && nextParam === roleDashboard) {
                    const isHttps = req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";
                    const response = NextResponse.next();
                    response.cookies.delete(COOKIE_NAME);
                    response.cookies.set({
                        name: COOKIE_NAME,
                        value: "",
                        httpOnly: true,
                        sameSite: "lax",
                        secure: isHttps,
                        path: "/",
                        expires: new Date(0),
                        maxAge: 0,
                    });
                    return response;
                }

                const url = req.nextUrl.clone();
                url.pathname = roleDashboard;
                url.searchParams.delete("next");
                return NextResponse.redirect(url);
            } catch {
                // Stale or invalid token — clear and proceed to login/signup page
                const isHttps = req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";
                const response = NextResponse.next();
                response.cookies.delete(COOKIE_NAME);
                response.cookies.set({
                    name: COOKIE_NAME,
                    value: "",
                    httpOnly: true,
                    sameSite: "lax",
                    secure: isHttps,
                    path: "/",
                    expires: new Date(0),
                    maxAge: 0,
                });
                return response;
            }
        }
        return NextResponse.next();
    }

    if (
        pathname.startsWith("/api/auth/login") ||
        pathname.startsWith("/api/auth/signup") ||
        pathname.startsWith("/api/auth/logout") ||
        pathname.startsWith("/api/auth/google")
    ) {
        return NextResponse.next();
    }

    if (!isProtectedPath(pathname)) {
        return NextResponse.next();
    }

    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
        return redirectToLogin(req);
    }

    try {
        const secret = getJwtVerificationSecret();
        const { payload } = await jose.jwtVerify(token, secret);

        const userRoleName = typeof payload.role_name === 'string' ? payload.role_name.toUpperCase() : "";
        const pathLower = pathname.toLowerCase();

        // Exclude suspended page and logout routes from redirection checks
        if (
            pathLower !== "/vos-sync/suspended" &&
            !pathLower.startsWith("/api/auth/logout") &&
            pathLower !== "/logout"
        ) {
            const userId = Number(payload.sub || payload.user_id || payload.id);
            const DIRECTUS_BASE = (
                process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || ""
            ).replace(/\/$/, "");
            const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
            const headers: Record<string, string> = { "Accept": "application/json" };
            if (DIRECTUS_TOKEN) headers["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;

            try {
                const fields = "user_id,status,otp_verified,is_blocked,lock_until,session_epoch";
                const statusRes = await fetch(`${DIRECTUS_BASE}/items/vs_user/${userId}?fields=${fields}`, {
                    headers,
                    cache: "no-store",
                });

                if (statusRes.ok) {
                    const statusJson = await statusRes.json();
                    const dbUser = statusJson?.data;
                    if (dbUser) {
                        if (!canAuthenticate(dbUser)) {
                            const url = req.nextUrl.clone();
                            url.pathname = "/vos-sync/suspended";
                            return NextResponse.redirect(url);
                        }

                        const sid = typeof payload.sid === "string" ? payload.sid : null;
                        if (sid) {
                            if (await isSessionRevoked(sid)) {
                                return redirectToLogin(req);
                            }
                        } else if (isSessionEpochStale(dbUser.session_epoch, payload.iat)) {
                            return redirectToLogin(req);
                        }
                    } else {
                        return redirectToLogin(req);
                    }
                } else if (statusRes.status === 404) {
                    return redirectToLogin(req);
                } else {
                    console.error(`[Middleware] Directus returned status ${statusRes.status} for user #${userId}; failing closed.`);
                    return redirectToLogin(req);
                }
            } catch (err) {
                console.error("[Middleware] Account status check failed; failing closed:", err);
                return redirectToLogin(req);
            }
        }

        let isAuthorized = true;
        const userRoleId = Number(payload.role_id);

        if (pathLower.startsWith("/vos-sync/freelancer") && userRoleName !== "FREELANCER" && userRoleId !== 1) {
            isAuthorized = false;
        } else if (pathLower.startsWith("/vos-sync/vos-admin") && userRoleName !== "ADMIN" && userRoleName !== "ADMINISTRATOR" && userRoleId !== 3) {
            isAuthorized = false;
        } else if (pathLower.startsWith("/vos-sync/client") && userRoleName !== "CLIENT" && userRoleName !== "EMPLOYER" && userRoleId !== 2) {
            isAuthorized = false;
        } else if (pathLower.startsWith("/vos-sync/school-admin") && userRoleName !== "SCHOOL_ADMIN" && userRoleName !== "SCH_ADMIN" && userRoleName !== "SCHOOL" && userRoleId !== 4) {
            isAuthorized = false;
        }

        if (!isAuthorized) {
            let roleDashboard = "/vos-sync/freelancer/dashboard";
            if (userRoleId === 2 || userRoleName === "CLIENT" || userRoleName === "EMPLOYER") {
                roleDashboard = "/vos-sync/client/dashboard";
            } else if (userRoleId === 3 || userRoleName === "ADMIN" || userRoleName === "ADMINISTRATOR") {
                roleDashboard = "/vos-sync/vos-admin";
            } else if (userRoleId === 4 || userRoleName === "SCHOOL_ADMIN" || userRoleName === "SCH_ADMIN" || userRoleName === "SCHOOL") {
                roleDashboard = "/vos-sync/school-admin";
            }
            const url = req.nextUrl.clone();
            url.pathname = roleDashboard;
            url.searchParams.delete("next");
            return NextResponse.redirect(url);
        }

        const response = NextResponse.next();

        // Prevent browser caching (bfcache) so the back button forces a new request to middleware
        response.headers.set('Cache-Control', 'no-store, max-age=0');

        return response;
    } catch (err) {
        console.error("[Middleware] JWT verification failed:", err);
        return redirectToLogin(req);
    }
}

function redirectToLogin(req: NextRequest) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    const response = NextResponse.redirect(url);
    const isHttps = req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";
    response.cookies.delete(COOKIE_NAME);
    response.cookies.set({
        name: COOKIE_NAME,
        value: "",
        httpOnly: true,
        sameSite: "lax",
        secure: isHttps,
        path: "/",
        expires: new Date(0),
        maxAge: 0,
    });
    return response;
}

export const config = {
    matcher: ["/:path*"],
};

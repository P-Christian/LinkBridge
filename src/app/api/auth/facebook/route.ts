// src/app/api/auth/facebook/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  generateOAuthParams,
  resolveCanonicalRedirectUri,
  resolveRequestOrigin,
  sealOAuthTransaction,
} from "@/modules/auth/facebook/facebook.service";
import { authenticateRequest } from "@/lib/authenticated-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeReturnToPath(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return null;
  }
  if (
    trimmed.startsWith("/linkbridge/client/settings") ||
    trimmed.startsWith("/linkbridge/freelancer/settings")
  ) {
    return trimmed;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const modeParam = req.nextUrl.searchParams.get("mode");
  const mode = modeParam === "signup" ? "signup" : modeParam === "link" ? "link" : "login";
  const popupParam = req.nextUrl.searchParams.get("popup");
  const popup = popupParam === "1" || popupParam === "true";

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol?.replace(":", "");
  const requestOrigin = resolveRequestOrigin(host, proto, req.nextUrl.origin);

  try {
    let linkUserId: string | number | undefined;
    let linkSessionEpoch: string | null | undefined;
    let returnTo: string | undefined;

    if (mode === "link") {
      const session = await authenticateRequest(req);
      if (!session) {
        return NextResponse.redirect(new URL("/login?error=session_required", requestOrigin));
      }

      linkUserId = session.userId;
      linkSessionEpoch = session.user.session_epoch ?? null;

      const rawReturnTo = req.nextUrl.searchParams.get("returnTo");
      const defaultReturn =
        session.roleId === 2 || session.roleName === "CLIENT"
          ? "/linkbridge/client/settings?tab=security"
          : "/linkbridge/freelancer/settings?tab=security";

      returnTo = sanitizeReturnToPath(rawReturnTo) || defaultReturn;
    }

    const redirectUri = resolveCanonicalRedirectUri(host, proto);
    const { transaction, authUrl } = generateOAuthParams(redirectUri, mode, {
      linkUserId,
      linkSessionEpoch,
      returnTo,
      popup,
    });
    const sealedToken = await sealOAuthTransaction(transaction);

    const response = NextResponse.redirect(authUrl);

    const isHttps = requestOrigin.startsWith("https://");
    response.cookies.set({
      name: "vos_sync_facebook_oauth_tx",
      value: sealedToken,
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: 300, // 5 minutes
    });

    return response;
  } catch (error: unknown) {
    console.error("[GET /api/auth/facebook] Initiation error:", error);
    const fallbackPath = mode === "link" ? "/login" : `/${mode}`;
    return NextResponse.redirect(new URL(`${fallbackPath}?error=facebook_init_failed`, requestOrigin));
  }
}

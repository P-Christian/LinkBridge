// src/app/api/auth/google/confirm-link/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/authenticated-session";
import {
  consumeGooglePendingLink,
  unsealPendingLinkToken,
} from "@/modules/auth/google/google.service";
import {
  getUserIdentityBySubject,
  linkUserIdentity,
} from "@/modules/auth/google/identity.repo";
import { createAuditRecordRepo } from "@/modules/vos-admin/audit-trail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const pendingCookie = req.cookies.get("vos_sync_pending_google_link")?.value;
    if (!pendingCookie) {
      return NextResponse.json(
        { ok: false, error: "Pending link session expired or missing." },
        { status: 400 }
      );
    }

    const payload = await unsealPendingLinkToken(pendingCookie);
    if (!payload) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired pending link token." },
        { status: 400 }
      );
    }

    if (String(payload.userId) !== String(session.userId)) {
      return NextResponse.json(
        { ok: false, error: "Pending link session does not match the active user." },
        { status: 403 }
      );
    }

    // Single-use atomic consumption
    const isFresh = consumeGooglePendingLink(payload.jti);
    if (!isFresh) {
      return NextResponse.json(
        { ok: false, error: "Link confirmation token was already consumed." },
        { status: 409 }
      );
    }

    // Re-validate that this Google sub has not been concurrently linked elsewhere
    const existing = await getUserIdentityBySubject("google", payload.sub);
    if (existing && String(existing.user_id) !== String(session.userId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "This Google account is already linked to another user account.",
        },
        { status: 409 }
      );
    }

    if (existing && String(existing.user_id) === String(session.userId)) {
      const isHttps = req.nextUrl.protocol === "https:";
      const res = NextResponse.json({
        ok: true,
        message: "Google account is already connected to this account.",
      });
      res.cookies.set({
        name: "vos_sync_pending_google_link",
        value: "",
        httpOnly: true,
        sameSite: "lax",
        secure: isHttps,
        path: "/",
        maxAge: 0,
      });
      return res;
    }

    // Atomically persist identity in vs_user_identity
    await linkUserIdentity({
      userId: session.userId,
      provider: "google",
      providerSubject: payload.sub,
      providerEmail: payload.email,
      providerName: payload.name ?? null,
    });

    createAuditRecordRepo({
      event_type: "USER_IDENTITY_LINKED",
      event_category: "AUTHENTICATION",
      action: "CONFIRM_LINK_IDENTITY",
      status: "SUCCESS",
      actor_type: session.roleId === 3 ? "ADMIN" : "USER",
      actor_user_id: Number(session.userId),
      reason: `User explicitly confirmed linking Google identity (${payload.email}) to current account`,
    });

    const isHttps = req.nextUrl.protocol === "https:";
    const res = NextResponse.json({
      ok: true,
      message: "Google account connected successfully.",
    });

    res.cookies.set({
      name: "vos_sync_pending_google_link",
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (error: unknown) {
    console.error("[POST /api/auth/google/confirm-link] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to confirm Google account link." },
      { status: 500 }
    );
  }
}

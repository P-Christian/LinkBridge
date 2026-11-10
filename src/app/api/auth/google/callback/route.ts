// src/app/api/auth/google/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  consumeOAuthTransaction,
  exchangeCodeForTokens,
  unsealOAuthTransaction,
  verifyGoogleIdToken,
  encryptGoogleRegistration,
  getUserIdentityBySubject,
  linkUserIdentity,
  updateIdentityLastLogin,
  resolveRequestOrigin,
  sealPendingLinkToken,
} from "@/modules/auth/google/google.service";
import {
  getUserByEmail,
  getUserById,
  resetFailedAttempts,
} from "@/modules/auth/services/auth.repo";
import { issueAuthSession } from "@/modules/auth/registration/registration.session";
import { canAuthenticate } from "@/lib/status-validator";
import { createAuditRecordRepo } from "@/modules/vos-admin/audit-trail";
import { authenticateRequest } from "@/lib/authenticated-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_sync_access_token";
const COOKIE_MAX_AGE_CAP = 60 * 60 * 24 * 7; // 7 days

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol?.replace(":", "");
  const requestOrigin = resolveRequestOrigin(host, proto, url.origin);
  const isHttps = requestOrigin.startsWith("https://");

  const txCookie = req.cookies.get("vos_sync_oauth_tx")?.value;

  // Cleanup helper for the transaction cookie
  const clearTxCookie = (res: NextResponse) => {
    res.cookies.set({
      name: "vos_sync_oauth_tx",
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: 0,
    });
  };

  if (errorParam) {
    let mode = "login";
    let returnTo = "";
    let isPopup = false;
    if (txCookie) {
      try {
        const tx = await unsealOAuthTransaction(txCookie);
        if (tx) {
          mode = tx.mode || "login";
          returnTo = tx.returnTo || "";
          isPopup = !!tx.popup;
        }
      } catch {
        // Ignore unseal errors during cancellation
      }
    }
    const targetPath = isPopup ? "/auth/popup-callback" : "/cancelled";
    const cancelUrl = new URL(targetPath, requestOrigin);
    cancelUrl.searchParams.set("status", "cancelled");
    cancelUrl.searchParams.set("provider", "google");
    if (mode) cancelUrl.searchParams.set("flow", mode);
    if (returnTo) cancelUrl.searchParams.set("returnTo", returnTo);
    const res = NextResponse.redirect(cancelUrl);
    clearTxCookie(res);
    return res;
  }

  if (!code || !state || !txCookie) {
    const res = NextResponse.redirect(new URL("/login?error=invalid_oauth_state", requestOrigin));
    clearTxCookie(res);
    return res;
  }

  // 1. Unseal transaction and verify state
  const transaction = await unsealOAuthTransaction(txCookie);
  if (!transaction || transaction.state !== state) {
    const res = NextResponse.redirect(new URL("/login?error=state_mismatch", requestOrigin));
    clearTxCookie(res);
    return res;
  }

  // 2. Atomic single-use check to prevent transaction replay
  const isFresh = consumeOAuthTransaction(transaction.jti);
  if (!isFresh) {
    const res = NextResponse.redirect(new URL("/login?error=transaction_replayed", requestOrigin));
    clearTxCookie(res);
    return res;
  }

  try {
    // 3. Token exchange
    const { id_token } = await exchangeCodeForTokens(
      code,
      transaction.code_verifier,
      transaction.redirect_uri
    );

    // 4. Verify Google ID token against official JWKS
    const googleProfile = await verifyGoogleIdToken(id_token, transaction.nonce);
    const normalizedEmail = googleProfile.email;

    // ─── Flow A: Account Linking (mode === "link") ───────────────────────────
    if (transaction.mode === "link") {
      const returnBasePath = transaction.returnTo || "/linkbridge/freelancer/settings";
      const settingsUrl = new URL(returnBasePath, requestOrigin);
      settingsUrl.searchParams.set("tab", "security");

      // 1. Verify active caller session
      const activeSession = await authenticateRequest(req);
      if (
        !activeSession ||
        String(activeSession.userId) !== String(transaction.linkUserId)
      ) {
        settingsUrl.searchParams.set("error", "link_unauthorized");
        const res = NextResponse.redirect(settingsUrl);
        clearTxCookie(res);
        return res;
      }

      // 2. Check session epoch if configured
      if (
        transaction.linkSessionEpoch &&
        activeSession.user.session_epoch &&
        transaction.linkSessionEpoch !== activeSession.user.session_epoch
      ) {
        settingsUrl.searchParams.set("error", "session_expired");
        const res = NextResponse.redirect(settingsUrl);
        clearTxCookie(res);
        return res;
      }

      const existingIdentity = await getUserIdentityBySubject("google", googleProfile.sub);

      // 3. Condition: Already linked to current account
      if (
        existingIdentity &&
        String(existingIdentity.user_id) === String(activeSession.userId)
      ) {
        settingsUrl.searchParams.set("notice", "already_connected");
        const redirectTarget = transaction.popup
          ? new URL("/auth/popup-callback?status=success&notice=already_connected&provider=google&flow=link", requestOrigin)
          : settingsUrl;
        const res = NextResponse.redirect(redirectTarget);
        clearTxCookie(res);
        return res;
      }

      // 4. Condition: Identity is linked to a DIFFERENT account -> Hard block!
      if (
        existingIdentity &&
        String(existingIdentity.user_id) !== String(activeSession.userId)
      ) {
        if (transaction.popup) {
          const res = NextResponse.redirect(new URL("/auth/popup-callback?status=error&error=google_already_linked&provider=google&flow=link", requestOrigin));
          clearTxCookie(res);
          return res;
        }
        settingsUrl.searchParams.set("error", "google_already_linked");
        const res = NextResponse.redirect(settingsUrl);
        clearTxCookie(res);
        return res;
      }

      // 5. Condition: Google email belongs to another internal account -> Explicit confirmation required!
      const conflictingAccount = await getUserByEmail(normalizedEmail);
      if (
        conflictingAccount &&
        String(conflictingAccount.user_id) !== String(activeSession.userId)
      ) {
        const pendingToken = await sealPendingLinkToken({
          userId: activeSession.userId,
          sub: googleProfile.sub,
          email: normalizedEmail,
          name: googleProfile.name,
        });

        settingsUrl.searchParams.set("pending_link", "google");
        settingsUrl.searchParams.set("email", normalizedEmail);
        const redirectTarget = transaction.popup
          ? new URL(
            `/auth/popup-callback?status=success&provider=google&flow=link&redirectUrl=${encodeURIComponent(
              settingsUrl.pathname + settingsUrl.search
            )}`,
            requestOrigin
          )
          : settingsUrl;
        const res = NextResponse.redirect(redirectTarget);
        clearTxCookie(res);

        res.cookies.set({
          name: "vos_sync_pending_google_link",
          value: pendingToken,
          httpOnly: true,
          sameSite: "lax",
          secure: isHttps,
          path: "/",
          maxAge: 10 * 60, // 10 minutes
        });

        return res;
      }

      // 6. Clean link: No conflict, link immediately
      await linkUserIdentity({
        userId: activeSession.userId,
        provider: "google",
        providerSubject: googleProfile.sub,
        providerEmail: normalizedEmail,
        providerName: googleProfile.name ?? null,
      });

      createAuditRecordRepo({
        event_type: "USER_IDENTITY_LINKED",
        event_category: "AUTHENTICATION",
        action: "LINK_IDENTITY",
        status: "SUCCESS",
        actor_type: activeSession.roleId === 3 ? "ADMIN" : "USER",
        actor_user_id: Number(activeSession.userId),
        reason: `Linked Google identity for ${normalizedEmail}`,
      });

      if (transaction.popup) {
        const res = NextResponse.redirect(new URL("/auth/popup-callback?status=success&provider=google&flow=link", requestOrigin));
        clearTxCookie(res);
        return res;
      }

      settingsUrl.searchParams.set("linked", "google");
      const res = NextResponse.redirect(settingsUrl);
      clearTxCookie(res);
      return res;
    }

    // ─── Flow B: Sign-In (Continue with Google from /login, mode === "login") ──
    if (transaction.mode === "login") {
      const identity = await getUserIdentityBySubject("google", googleProfile.sub);
      const emailUser = await getUserByEmail(normalizedEmail);

      // Branch 1: Identity linked
      if (identity?.user_id) {
        // Conflict check: Google sub is linked to identity.user_id, but Google email belongs to a different account in vs_user
        if (emailUser && String(emailUser.user_id) !== String(identity.user_id)) {
          createAuditRecordRepo({
            event_type: "SECURITY_ALERT",
            event_category: "AUTHENTICATION",
            action: "IDENTITY_CONFLICT",
            status: "DENIED",
            actor_type: "USER",
            actor_user_id: identity.user_id,
            reason: `Google identity conflict: Google sub (${googleProfile.sub}) is linked to user ${identity.user_id}, but verified email (${normalizedEmail}) belongs to user ${emailUser.user_id}`,
          });

          const res = NextResponse.redirect(new URL("/login?error=google_identity_conflict", requestOrigin));
          clearTxCookie(res);
          return res;
        }

        const user = await getUserById(identity.user_id);
        if (!user) {
          const res = NextResponse.redirect(new URL("/login?error=account_not_found", requestOrigin));
          clearTxCookie(res);
          return res;
        }

        if (user.is_blocked) {
          createAuditRecordRepo({
            event_type: "USER_LOGIN_BLOCKED",
            event_category: "AUTHENTICATION",
            action: "FAILED_LOGIN",
            status: "DENIED",
            actor_type: "USER",
            actor_user_id: user.user_id,
            reason: "Google login denied: Account is blocked",
          });

          const res = NextResponse.redirect(new URL("/login?error=account_blocked", requestOrigin));
          clearTxCookie(res);
          return res;
        }

        if (!canAuthenticate(user)) {
          const res = NextResponse.redirect(new URL("/login?error=account_inactive", requestOrigin));
          clearTxCookie(res);
          return res;
        }

        await updateIdentityLastLogin(identity.identity_id);
        await resetFailedAttempts(user.user_id);

        createAuditRecordRepo({
          event_type: "USER_LOGIN",
          event_category: "AUTHENTICATION",
          action: "LOGIN",
          status: "SUCCESS",
          actor_type: user.role_id === 3 ? "ADMIN" : "USER",
          actor_user_id: user.user_id,
          organization_type:
            user.role_id === 2 ? "EMPLOYER" : user.role_id === 4 ? "SCHOOL" : "FREELANCER",
          reason: "User logged in successfully via linked Google identity",
        });

        const session = await issueAuthSession({
          user_id: user.user_id,
          user_email: user.user_email,
          role: user.role,
          role_id: user.role_id,
          status: user.status,
          user_status: user.user_status,
          otp_verified: user.otp_verified,
          is_blocked: user.is_blocked,
          lock_until: user.lock_until,
        });

        const targetPath = session.destination || "/linkbridge/freelancer/dashboard";
        const redirectTarget = transaction.popup
          ? new URL(`/auth/popup-callback?status=success&provider=google&flow=login&redirectUrl=${encodeURIComponent(targetPath)}`, requestOrigin)
          : new URL(targetPath, requestOrigin);
        const res = NextResponse.redirect(redirectTarget);
        clearTxCookie(res);

        res.cookies.set({
          name: COOKIE_NAME,
          value: session.token,
          httpOnly: true,
          sameSite: "lax",
          secure: isHttps,
          path: "/",
          maxAge: COOKIE_MAX_AGE_CAP,
        });

        return res;
      }

      // Branch 2: Identity not linked
      if (emailUser) {
        // Email exists in LinkBridge: reject login and show "Google account not connected"
        createAuditRecordRepo({
          event_type: "USER_LOGIN_FAILED",
          event_category: "AUTHENTICATION",
          action: "LOGIN_REJECTED",
          status: "DENIED",
          actor_type: "USER",
          actor_user_id: emailUser.user_id,
          reason: `Google login rejected: Email ${normalizedEmail} exists in LinkBridge but Google identity is not connected`,
        });

        const errorUrl = new URL(`/login?error=google_not_connected&email=${encodeURIComponent(normalizedEmail)}`, requestOrigin);
        const redirectTarget = transaction.popup
          ? new URL(`/auth/popup-callback?status=error&error=google_not_connected&provider=google&flow=login`, requestOrigin)
          : errorUrl;
        const res = NextResponse.redirect(redirectTarget);
        clearTxCookie(res);
        return res;
      } else {
        // Email does not exist in LinkBridge: reject login and direct to signup
        createAuditRecordRepo({
          event_type: "USER_LOGIN_FAILED",
          event_category: "AUTHENTICATION",
          action: "LOGIN_REJECTED",
          status: "DENIED",
          actor_type: "USER",
          reason: `Google login rejected: No account found for email ${normalizedEmail}`,
        });

        const errorUrl = new URL("/login?error=account_not_found", requestOrigin);
        const redirectTarget = transaction.popup
          ? new URL(`/auth/popup-callback?status=error&error=account_not_found&provider=google&flow=login`, requestOrigin)
          : errorUrl;
        const res = NextResponse.redirect(redirectTarget);
        clearTxCookie(res);
        return res;
      }
    }

    // ─── Flow C: Sign-Up (Keep separate signup flow unchanged, mode === "signup") ──

    // 1. Resolve user through existing linked Google identity (sub)
    let user = null;
    const identity = await getUserIdentityBySubject("google", googleProfile.sub);
    if (identity?.user_id) {
      user = await getUserById(identity.user_id);
      if (user) {
        await updateIdentityLastLogin(identity.identity_id);
      }
    }

    // 2. A provider email is not proof that the caller owns the LinkBridge
    // account, so sign-up never links on it (SEC-009). The login flow already
    // refuses the same thing; linking is done from an authenticated session.
    if (!user) {
      const existingUser = await getUserByEmail(normalizedEmail);
      if (existingUser) {
        createAuditRecordRepo({
          event_type: "USER_LOGIN_FAILED",
          event_category: "AUTHENTICATION",
          action: "LOGIN_REJECTED",
          status: "DENIED",
          actor_type: existingUser.role_id === 3 ? "ADMIN" : "USER",
          actor_user_id: existingUser.user_id,
          reason: `Google sign-up refused: email ${normalizedEmail} belongs to an account that is not connected to Google`,
        });

        const errorUrl = new URL(`/login?error=google_not_connected&email=${encodeURIComponent(normalizedEmail)}`, requestOrigin);
        const redirectTarget = transaction.popup
          ? new URL(`/auth/popup-callback?status=error&error=google_not_connected&provider=google&flow=signup`, requestOrigin)
          : errorUrl;
        const res = NextResponse.redirect(redirectTarget);
        clearTxCookie(res);
        return res;
      }
    }

    // 3. Auto-Registration Transition: Brand new user (neither sub nor email exists)
    if (!user) {
      const regToken = await encryptGoogleRegistration({
        email: normalizedEmail,
        given_name: googleProfile.given_name,
        family_name: googleProfile.family_name,
        name: googleProfile.name,
        picture: googleProfile.picture,
        sub: googleProfile.sub,
      });

      const signupUrl = new URL("/signup?google=1", requestOrigin);
      const redirectTarget = transaction.popup
        ? new URL(`/auth/popup-callback?status=success&provider=google&flow=signup&redirectUrl=${encodeURIComponent(signupUrl.pathname + signupUrl.search)}`, requestOrigin)
        : signupUrl;

      const res = NextResponse.redirect(redirectTarget);
      clearTxCookie(res);

      res.cookies.set({
        name: "vos_sync_google_reg",
        value: regToken,
        httpOnly: true,
        sameSite: "lax",
        secure: isHttps,
        path: "/",
        maxAge: 15 * 60, // 15 minutes
      });

      createAuditRecordRepo({
        event_type: "USER_SIGNUP_GOOGLE_INITIATED",
        event_category: "AUTHENTICATION",
        action: "OAUTH_SIGNUP_INITIATED",
        status: "SUCCESS",
        actor_type: "USER",
        reason: `Verified Google registration initiated for ${normalizedEmail}`,
      });

      return res;
    }

    // ── Linked account exists: enforce account security & status ──

    if (user.is_blocked) {
      createAuditRecordRepo({
        event_type: "USER_LOGIN_BLOCKED",
        event_category: "AUTHENTICATION",
        action: "FAILED_LOGIN",
        status: "DENIED",
        actor_type: "USER",
        actor_user_id: user.user_id,
        reason: "Google login denied: Account is blocked",
      });

      const res = NextResponse.redirect(new URL("/login?error=account_blocked", requestOrigin));
      clearTxCookie(res);
      return res;
    }

    if (!canAuthenticate(user)) {
      const res = NextResponse.redirect(new URL("/login?error=account_inactive", requestOrigin));
      clearTxCookie(res);
      return res;
    }

    // Reset failed attempts on successful login
    await resetFailedAttempts(user.user_id);

    createAuditRecordRepo({
      event_type: "USER_LOGIN",
      event_category: "AUTHENTICATION",
      action: "LOGIN",
      status: "SUCCESS",
      actor_type: user.role_id === 3 ? "ADMIN" : "USER",
      actor_user_id: user.user_id,
      organization_type:
        user.role_id === 2 ? "EMPLOYER" : user.role_id === 4 ? "SCHOOL" : "FREELANCER",
      reason: "User logged in successfully via linked Google identity",
    });

    const session = await issueAuthSession({
      user_id: user.user_id,
      user_email: user.user_email,
      role: user.role,
      role_id: user.role_id,
      status: user.status,
      user_status: user.user_status,
      otp_verified: user.otp_verified,
      is_blocked: user.is_blocked,
      lock_until: user.lock_until,
    });

    const targetPath = session.destination || "/linkbridge/freelancer/dashboard";
    const redirectTarget = transaction.popup
      ? new URL(`/auth/popup-callback?status=success&provider=google&flow=login&redirectUrl=${encodeURIComponent(targetPath)}`, requestOrigin)
      : new URL(targetPath, requestOrigin);
    const res = NextResponse.redirect(redirectTarget);

    clearTxCookie(res);

    res.cookies.set({
      name: COOKIE_NAME,
      value: session.token,
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: COOKIE_MAX_AGE_CAP,
    });

    return res;
  } catch (err: unknown) {
    console.error("[GET /api/auth/google/callback] Callback failure:", err);
    const fallbackPath = transaction?.mode === "link" ? "/linkbridge/freelancer/settings" : "/login";
    const res = NextResponse.redirect(new URL(`${fallbackPath}?error=oauth_callback_failed`, requestOrigin));
    clearTxCookie(res);
    return res;
  }
}

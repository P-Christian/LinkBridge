// src/app/api/auth/facebook/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  consumeOAuthTransaction,
  exchangeCodeForTokens,
  fetchFacebookUserInfo,
  unsealOAuthTransaction,
  encryptFacebookRegistration,
  resolveRequestOrigin,
} from "@/modules/auth/facebook/facebook.service";
import {
  getUserIdentityBySubject,
  linkUserIdentity,
  updateIdentityLastLogin,
} from "@/modules/auth/google/identity.repo";
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

  const txCookie = req.cookies.get("vos_sync_facebook_oauth_tx")?.value;

  const clearTxCookie = (res: NextResponse) => {
    res.cookies.set({
      name: "vos_sync_facebook_oauth_tx",
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
    cancelUrl.searchParams.set("provider", "facebook");
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
    const tokenResult = await exchangeCodeForTokens(
      code,
      transaction.redirect_uri
    );

    // 4. Fetch full profile details from Facebook Graph API
    const facebookProfile = await fetchFacebookUserInfo(tokenResult.access_token);
    const normalizedEmail = facebookProfile.email;

    // ─── Flow A: Account Linking (mode === "link") ───────────────────────────
    if (transaction.mode === "link") {
      const returnBasePath = transaction.returnTo || "/linkbridge/freelancer/settings";
      const settingsUrl = new URL(returnBasePath, requestOrigin);
      settingsUrl.searchParams.set("tab", "security");

      // Verify active caller session
      const activeSession = await authenticateRequest(req);
      if (
        !activeSession ||
        String(activeSession.userId) !== String(transaction.linkUserId)
      ) {
        if (transaction.popup) {
          const res = NextResponse.redirect(new URL("/auth/popup-callback?status=error&error=link_unauthorized&provider=facebook&flow=link", requestOrigin));
          clearTxCookie(res);
          return res;
        }
        settingsUrl.searchParams.set("error", "link_unauthorized");
        const res = NextResponse.redirect(settingsUrl);
        clearTxCookie(res);
        return res;
      }

      // Check session epoch if configured
      if (
        transaction.linkSessionEpoch &&
        activeSession.user.session_epoch &&
        transaction.linkSessionEpoch !== activeSession.user.session_epoch
      ) {
        if (transaction.popup) {
          const res = NextResponse.redirect(new URL("/auth/popup-callback?status=error&error=session_expired&provider=facebook&flow=link", requestOrigin));
          clearTxCookie(res);
          return res;
        }
        settingsUrl.searchParams.set("error", "session_expired");
        const res = NextResponse.redirect(settingsUrl);
        clearTxCookie(res);
        return res;
      }

      // Enforce Facebook ID uniqueness across all users
      const existingIdentity = await getUserIdentityBySubject("facebook", facebookProfile.id);
      if (
        existingIdentity &&
        String(existingIdentity.user_id) !== String(activeSession.userId)
      ) {
        if (transaction.popup) {
          const res = NextResponse.redirect(new URL("/auth/popup-callback?status=error&error=facebook_already_linked&provider=facebook&flow=link", requestOrigin));
          clearTxCookie(res);
          return res;
        }
        settingsUrl.searchParams.set("error", "facebook_already_linked");
        const res = NextResponse.redirect(settingsUrl);
        clearTxCookie(res);
        return res;
      }

      // Enforce cross-account email uniqueness: if Facebook email belongs to another LinkBridge user
      const conflictingAccount = await getUserByEmail(normalizedEmail);
      if (
        conflictingAccount &&
        String(conflictingAccount.user_id) !== String(activeSession.userId)
      ) {
        createAuditRecordRepo({
          event_type: "SECURITY_ALERT",
          event_category: "AUTHENTICATION",
          action: "IDENTITY_CONFLICT",
          status: "DENIED",
          actor_type: activeSession.roleId === 3 ? "ADMIN" : "USER",
          actor_user_id: Number(activeSession.userId),
          reason: `Facebook link blocked: Email (${normalizedEmail}) already belongs to user ${conflictingAccount.user_id}`,
        });

        if (transaction.popup) {
          const res = NextResponse.redirect(
            new URL(
              `/auth/popup-callback?status=error&error=email_already_registered&provider=facebook&email=${encodeURIComponent(
                normalizedEmail
              )}&flow=link`,
              requestOrigin
            )
          );
          clearTxCookie(res);
          return res;
        }

        settingsUrl.searchParams.set("conflict", "email_already_registered");
        settingsUrl.searchParams.set("conflict_provider", "facebook");
        settingsUrl.searchParams.set("email", normalizedEmail);
        const res = NextResponse.redirect(settingsUrl);
        clearTxCookie(res);
        return res;
      }

      // Atomically persist identity in vs_user_identity
      await linkUserIdentity({
        userId: activeSession.userId,
        provider: "facebook",
        providerSubject: facebookProfile.id,
        providerEmail: normalizedEmail,
        providerName: facebookProfile.name ?? null,
      });

      createAuditRecordRepo({
        event_type: "USER_IDENTITY_LINKED",
        event_category: "AUTHENTICATION",
        action: "LINK_IDENTITY",
        status: "SUCCESS",
        actor_type: activeSession.roleId === 3 ? "ADMIN" : "USER",
        actor_user_id: Number(activeSession.userId),
        reason: `Linked Facebook identity for ${normalizedEmail}`,
      });

      if (transaction.popup) {
        const res = NextResponse.redirect(new URL("/auth/popup-callback?status=success&provider=facebook&flow=link", requestOrigin));
        clearTxCookie(res);
        return res;
      }

      settingsUrl.searchParams.set("linked", "facebook");
      const res = NextResponse.redirect(settingsUrl);
      clearTxCookie(res);
      return res;
    }

    // ─── Flow B: Sign-In (Continue with Facebook from /login, mode === "login") ──
    if (transaction.mode === "login") {
      const identity = await getUserIdentityBySubject("facebook", facebookProfile.id);
      const emailUser = await getUserByEmail(normalizedEmail);

      // Branch 1: Identity linked
      if (identity?.user_id) {
        // Conflict check: Facebook ID is linked to identity.user_id, but Facebook email belongs to a different account in vs_user
        if (emailUser && String(emailUser.user_id) !== String(identity.user_id)) {
          createAuditRecordRepo({
            event_type: "SECURITY_ALERT",
            event_category: "AUTHENTICATION",
            action: "IDENTITY_CONFLICT",
            status: "DENIED",
            actor_type: "USER",
            actor_user_id: identity.user_id,
            reason: `Facebook identity conflict: Facebook ID (${facebookProfile.id}) is linked to user ${identity.user_id}, but verified email (${normalizedEmail}) belongs to user ${emailUser.user_id}`,
          });

          const res = NextResponse.redirect(new URL("/login?error=facebook_identity_conflict", requestOrigin));
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
            reason: "Facebook login denied: Account is blocked",
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
          reason: "User logged in successfully via linked Facebook identity",
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
          ? new URL(`/auth/popup-callback?status=success&provider=facebook&flow=login&redirectUrl=${encodeURIComponent(targetPath)}`, requestOrigin)
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
        // Email exists in LinkBridge: reject login and show "Facebook account not connected"
        createAuditRecordRepo({
          event_type: "USER_LOGIN_FAILED",
          event_category: "AUTHENTICATION",
          action: "LOGIN_REJECTED",
          status: "DENIED",
          actor_type: "USER",
          actor_user_id: emailUser.user_id,
          reason: `Facebook login rejected: Email ${normalizedEmail} exists in LinkBridge but Facebook identity is not connected`,
        });

        const errorUrl = new URL(`/login?error=facebook_not_connected&email=${encodeURIComponent(normalizedEmail)}`, requestOrigin);
        const redirectTarget = transaction.popup
          ? new URL(`/auth/popup-callback?status=error&error=facebook_not_connected&provider=facebook&flow=login`, requestOrigin)
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
          reason: `Facebook login rejected: No account found for email ${normalizedEmail}`,
        });

        const errorUrl = new URL("/login?error=account_not_found", requestOrigin);
        const redirectTarget = transaction.popup
          ? new URL(`/auth/popup-callback?status=error&error=account_not_found&provider=facebook&flow=login`, requestOrigin)
          : errorUrl;
        const res = NextResponse.redirect(redirectTarget);
        clearTxCookie(res);
        return res;
      }
    }

    // ─── Flow C: Sign-Up (Keep separate signup flow unchanged, mode === "signup") ──

    // 1. Try finding user by linked Facebook ID first
    let user = null;
    const identity = await getUserIdentityBySubject("facebook", facebookProfile.id);
    if (identity?.user_id) {
      user = await getUserById(identity.user_id);
      if (user) {
        await updateIdentityLastLogin(identity.identity_id);
      }
    }

    // 2. Facebook's payload carries no verified-email signal, so a provider
    // email match must never claim an existing account (SEC-009). Linking is
    // done from an authenticated session instead.
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
          reason: `Facebook sign-up refused: email ${normalizedEmail} belongs to an account that is not connected to Facebook`,
        });

        const errorUrl = new URL(`/login?error=facebook_not_connected&email=${encodeURIComponent(normalizedEmail)}`, requestOrigin);
        const redirectTarget = transaction.popup
          ? new URL(`/auth/popup-callback?status=error&error=facebook_not_connected&provider=facebook&flow=signup`, requestOrigin)
          : errorUrl;
        const res = NextResponse.redirect(redirectTarget);
        clearTxCookie(res);
        return res;
      }
    }

    if (user) {
      // ── Account exists: proceed with login ──

      if (user.is_blocked) {
        createAuditRecordRepo({
          event_type: "USER_LOGIN_BLOCKED",
          event_category: "AUTHENTICATION",
          action: "FAILED_LOGIN",
          status: "DENIED",
          actor_type: "USER",
          actor_user_id: user.user_id,
          reason: "Facebook login denied: Account is blocked",
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

      // Reset any failed password attempts on successful Facebook auth
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
        reason: "User logged in successfully via Facebook",
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
        ? new URL(`/auth/popup-callback?status=success&provider=facebook&flow=login&redirectUrl=${encodeURIComponent(targetPath)}`, requestOrigin)
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
    } else {
      // ── Account does NOT exist in Directus ──

      // Issue encrypted single-use registration cookie
      const encryptedRegistration = await encryptFacebookRegistration({
        email: normalizedEmail,
        name: facebookProfile.name,
        first_name: facebookProfile.first_name,
        last_name: facebookProfile.last_name,
        picture: facebookProfile.picture,
        id: facebookProfile.id,
      });

      // Seamlessly guide user to signup, providing notice=no_account if coming from login
      const signupUrl = new URL("/signup", requestOrigin);
      signupUrl.searchParams.set("facebook", "1");

      const redirectTarget = transaction.popup
        ? new URL(`/auth/popup-callback?status=success&provider=facebook&flow=signup&redirectUrl=${encodeURIComponent(signupUrl.pathname + signupUrl.search)}`, requestOrigin)
        : signupUrl;

      const res = NextResponse.redirect(redirectTarget);
      clearTxCookie(res);

      res.cookies.set({
        name: "vos_sync_facebook_reg",
        value: encryptedRegistration,
        httpOnly: true,
        sameSite: "lax",
        secure: isHttps,
        path: "/",
        maxAge: 15 * 60, // 15 minutes
      });

      return res;
    }
  } catch (err: unknown) {
    console.error("[GET /api/auth/facebook/callback] Callback failure:", err);
    const fallbackPath = transaction?.mode === "link" ? "/linkbridge/freelancer/settings" : "/login";
    const res = NextResponse.redirect(new URL(`${fallbackPath}?error=facebook_callback_failed`, requestOrigin));
    clearTxCookie(res);
    return res;
  }
}

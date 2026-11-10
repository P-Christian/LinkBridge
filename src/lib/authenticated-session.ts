import * as jose from "jose";
import { cookies } from "next/headers";
import {
  AccountAuthenticationState,
  canAuthenticate,
  isSessionEpochStale,
  isSessionRevoked,
  lookupAccountAuthenticationState,
} from "@/lib/status-validator";
import { getJwtVerificationSecret } from "@/modules/auth/registration/registration.session";
import {
  DEV_BYPASS_ROLE_ID,
  DEV_BYPASS_USER_ID,
  isDevAuthBypassEnabled,
} from "@/lib/dev-auth-bypass";

export interface AuthenticatedSession {
  token: string;
  payload: jose.JWTPayload;
  user: AccountAuthenticationState;
  userId: string | number;
  roleId: number | null;
  roleName: string;
}

function normalizeUserId(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    return /^\d+$/u.test(trimmed) ? Number(trimmed) : trimmed;
  }
  return null;
}

/**
 * Return the access token from a request without accepting arbitrary JWT
 * payloads. The token is only useful after authenticateAccessToken verifies
 * its signature and re-reads the current account state.
 */
export function getAccessTokenFromRequest(
  request: Request & { cookies?: { get: (name: string) => { value?: string } | undefined } },
): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/iu);
    if (match?.[1]?.trim()) return match[1].trim();
  }

  const cookieToken = request.cookies?.get("vos_sync_access_token")?.value;
  if (cookieToken?.trim()) return cookieToken.trim();

  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)vos_sync_access_token=([^;]+)/);
    if (match?.[1]?.trim()) return decodeURIComponent(match[1].trim());
  }

  return null;
}

/**
 * The four states a credential attempt can end in, kept separate so callers can
 * answer with the right status instead of collapsing "the directory is down"
 * into "you are not logged in".
 *
 * - `authenticated`: signature valid, account eligible, session not revoked.
 * - `anonymous`: no token, or one that is not ours (bad signature, expired).
 * - `denied`: a genuine credential for an account that may not authenticate.
 * - `unavailable`: Directus could not answer; the caller must not act on it.
 */
export type AuthenticationOutcome =
  | { status: "authenticated"; session: AuthenticatedSession }
  | { status: "anonymous" }
  | { status: "denied" }
  | { status: "unavailable" };

/**
 * Verify a signed access token and require the account to remain active.
 * JWT claims are treated as a locator only; authorization uses the current
 * Directus account row returned by `lookupAccountAuthenticationState`.
 */
export async function authenticateAccessTokenDetailed(
  token: string | null | undefined,
  options?: { allowContainment?: boolean }
): Promise<AuthenticationOutcome> {
  if (!token?.trim()) return { status: "anonymous" };

  // jose throws for an expired or mis-signed token, which is a stale
  // credential the caller should clear; anything that throws later is an
  // upstream fault and must not be mistaken for one.
  let payload: jose.JWTPayload;
  try {
    payload = (await jose.jwtVerify(token.trim(), getJwtVerificationSecret())).payload;
  } catch {
    return { status: "anonymous" };
  }

  try {
    const userId = normalizeUserId(payload.sub ?? payload.user_id ?? payload.id);
    if (userId === null) return { status: "anonymous" };

    const lookup = await lookupAccountAuthenticationState(userId);
    if (lookup.outcome === "unavailable") return { status: "unavailable" };
    if (lookup.outcome === "missing") return { status: "denied" };
    const user = lookup.user;
    if (!options?.allowContainment && !canAuthenticate(user)) return { status: "denied" };

    // SEC-008: middleware cannot reach `/api/*`, so revocation is enforced here
    // and every handler inherits it. A token that carries `sid` is governed by
    // its own session row; the epoch only invalidates legacy tokens that
    // predate `sid`, which is what a password-change bump is meant to catch.
    const sid = typeof payload.sid === "string" ? payload.sid : null;
    if (sid) {
      if (await isSessionRevoked(sid)) return { status: "denied" };
    } else if (isSessionEpochStale(user.session_epoch, payload.iat)) {
      return { status: "denied" };
    }

    const roleIdValue = Number(user.role_id ?? payload.role_id);
    const roleId = Number.isSafeInteger(roleIdValue) && roleIdValue > 0 ? roleIdValue : null;
    const roleName = String(
      user.role_name ?? user.role ?? payload.role_name ?? payload.role ?? "",
    ).toUpperCase();

    return {
      status: "authenticated",
      session: { token: token.trim(), payload, user, userId, roleId, roleName },
    };
  } catch (error) {
    console.error("[authenticated-session] Session resolution threw:", error);
    return { status: "unavailable" };
  }
}

export async function authenticateAccessToken(
  token: string | null | undefined,
): Promise<AuthenticatedSession | null> {
  const outcome = await authenticateAccessTokenDetailed(token);
  return outcome.status === "authenticated" ? outcome.session : null;
}

/**
 * Development-only stand-in for a verified session. Reachable only through
 * isDevAuthBypassEnabled(), which is false in production, and only for a
 * request that carried no valid session.
 */
function createDevSession(): AuthenticatedSession {
  const user: AccountAuthenticationState = {
    user_id: DEV_BYPASS_USER_ID,
    user_email: "dev@localhost",
    role_id: DEV_BYPASS_ROLE_ID,
    role_name: "DEV_BYPASS",
    status: "active",
    user_status: "active",
    verification_status: "VERIFIED",
    otp_verified: 1,
    is_blocked: 0,
  };
  return {
    token: "",
    payload: {},
    user,
    userId: DEV_BYPASS_USER_ID,
    roleId: DEV_BYPASS_ROLE_ID,
    roleName: "DEV_BYPASS",
  };
}

export async function authenticateRequest(
  request: Request & { cookies?: { get: (name: string) => { value?: string } | undefined } },
  options?: { allowContainment?: boolean }
): Promise<AuthenticatedSession | null> {
  const outcome = await authenticateRequestDetailed(request, options);
  return outcome.status === "authenticated" ? outcome.session : null;
}

/**
 * Same as `authenticateRequest`, but keeps the reason a caller was not let
 * through. `/api/auth/me` needs it: clearing a cookie that Directus merely
 * failed to answer about signs users out during an outage.
 */
export async function authenticateRequestDetailed(
  request: Request & { cookies?: { get: (name: string) => { value?: string } | undefined } },
  options?: { allowContainment?: boolean }
): Promise<AuthenticationOutcome> {
  const outcome = await authenticateAccessTokenDetailed(getAccessTokenFromRequest(request), options);
  if (outcome.status === "authenticated" || !isDevAuthBypassEnabled()) return outcome;
  return { status: "authenticated", session: createDevSession() };
}

export async function authenticateCookieSession(): Promise<AuthenticatedSession | null> {
  const cookieStore = await cookies();
  const session = await authenticateAccessToken(
    cookieStore.get("vos_sync_access_token")?.value,
  );
  if (session || !isDevAuthBypassEnabled()) return session;
  return createDevSession();
}

/**
 * Role test on the two claims that decide it, so callers that only hold a
 * resolved `{ roleId, roleName }` pair — `/api/auth/me`, for instance — share
 * one mapping instead of re-typing the id/name table and drifting from it.
 */
export function hasRole(
  session: Pick<AuthenticatedSession, "roleId" | "roleName">,
  roleIds: readonly number[],
  roleNames: readonly string[],
): boolean {
  if (session.roleId === DEV_BYPASS_ROLE_ID && isDevAuthBypassEnabled()) return true;
  const roleName = session.roleName.toUpperCase();
  return (
    (session.roleId !== null && roleIds.includes(session.roleId)) ||
    roleNames.some((name) => roleName === name.toUpperCase())
  );
}

export function isAdministratorSession(
  session: Pick<AuthenticatedSession, "roleId" | "roleName">,
): boolean {
  return hasRole(session, [3], ["ADMIN", "ADMINISTRATOR"]);
}

export function isClientSession(
  session: Pick<AuthenticatedSession, "roleId" | "roleName">,
): boolean {
  return hasRole(session, [2], ["CLIENT", "EMPLOYER"]);
}

export function isFreelancerSession(
  session: Pick<AuthenticatedSession, "roleId" | "roleName">,
): boolean {
  return hasRole(session, [1], ["FREELANCER"]);
}

export function isSchoolAdminSession(
  session: Pick<AuthenticatedSession, "roleId" | "roleName">,
): boolean {
  return hasRole(session, [4], [
    "SCHOOL_ADMIN",
    "SCH_ADMIN",
    "SCHOOL ADMINISTRATOR",
    "SCHOOLADMIN",
    "SCHOOL",
  ]);
}

/**
 * Administrator gate for /api/vos-admin/** handlers. A failed signature check,
 * an expired token or a non-admin role all return null so callers can 401; an
 * unverified payload never reaches this as an identity.
 */
export async function requireAdministrator(
  request: Request & { cookies?: { get: (name: string) => { value?: string } | undefined } },
): Promise<{ adminId: number } | null> {
  const session = await authenticateRequest(request);
  if (!session || !isAdministratorSession(session)) return null;

  const adminId = Number(session.userId);
  return Number.isSafeInteger(adminId) && adminId > 0 ? { adminId } : null;
}


import * as jose from "jose";
import { SessionTokenResult } from "./registration.types";
import { getRoleById } from "../services/auth.repo";
import { RegistrationError } from "./registration.errors";
import { canAuthenticate } from "@/lib/status-validator";

export interface AuthSessionUser {
  user_id: string | number;
  user_email: string;
  role: string;
  role_id: number;
  role_name?: string;
  user_fname?: string;
  user_lname?: string;
  status?: string | null;
  user_status?: string | null;
  otp_verified?: boolean | number | string | null;
  is_blocked?: boolean | number | string | null;
  lock_until?: string | null;
  session_id?: string;
}

/** Shortest secret accepted in any environment (SEC-006): 32 ASCII chars. */
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Resolve the master signing secret. Missing or weak configuration fails
 * closed in every environment: an unset `JWT_SECRET` must not degrade into an
 * empty HMAC key that anyone can forge.
 */
export function requireJwtSecret(): string {
  const configuredSecret = process.env.JWT_SECRET?.trim();
  if (!configuredSecret) {
    throw new RegistrationError(
      "JWT_SECRET is not configured.",
      "CONFIGURATION_ERROR",
      500
    );
  }
  if (configuredSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new RegistrationError(
      "JWT_SECRET must be at least 32 characters.",
      "CONFIGURATION_ERROR",
      500
    );
  }

  return configuredSecret;
}

/** Key for access-session tokens only. Other purposes derive their own key. */
export function getJwtVerificationSecret(): Uint8Array {
  return new TextEncoder().encode(requireJwtSecret());
}

/**
 * Resolves default dashboard destination based on user role
 */
export function resolveRoleDestination(
  role: string,
  roleId?: number
): string {
  const normalizedRole = (role || "").toUpperCase();
  const id = Number(roleId);

  if (id === 1 || normalizedRole === "FREELANCER") {
    return "/vos-sync/freelancer/dashboard";
  }
  if (id === 2 || normalizedRole === "CLIENT" || normalizedRole === "EMPLOYER") {
    return "/vos-sync/client/dashboard";
  }
  if (id === 3 || normalizedRole === "ADMIN") {
    return "/vos-sync/vos-admin";
  }
  if (
    id === 4 ||
    normalizedRole === "SCH_ADMIN" ||
    normalizedRole === "SCHOOL_ADMIN"
  ) {
    return "/vos-sync/school-admin";
  }

  return "/main-dashboard";
}

/**
 * Issues an authenticated JWT session consistent with login
 */
export async function issueAuthSession(
  user: AuthSessionUser,
  options?: { allowContainment?: boolean }
): Promise<SessionTokenResult> {
  if (!options?.allowContainment && !canAuthenticate(user)) {
    throw new RegistrationError(
      "Account is not active or verified.",
      "REGISTRATION_RESTRICTED",
      403
    );
  }

  let cleanRoleName = user.role_name || user.role || "";

  try {
    if (!user.role_name && user.role_id) {
      const roleData = await getRoleById(user.role_id);
      if (roleData && roleData.role_name) {
        cleanRoleName = roleData.role_name;
      }
    }
  } catch {
    // Non-blocking fallback to user.role
  }

  const secret = getJwtVerificationSecret();
  const alg = "HS256";

  const claims: Record<string, unknown> = {
    sub: String(user.user_id),
    email: user.user_email,
    role: user.role,
    role_name: cleanRoleName,
    role_id: user.role_id,
  };
  if (user.user_fname) claims.user_fname = user.user_fname;
  if (user.user_lname) claims.user_lname = user.user_lname;
  if (user.session_id) claims.sid = user.session_id;

  const token = await new jose.SignJWT(claims)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const destination = resolveRoleDestination(user.role, user.role_id);

  return {
    token,
    destination,
    user_id: user.user_id,
    role: user.role,
    role_id: user.role_id,
    role_name: cleanRoleName,
    session_id: user.session_id,
  };
}

/**
 * Backwards-compatible name for callers that issue a session after
 * challenge-backed registration provisioning.
 */
export const issueRegistrationSession = issueAuthSession;

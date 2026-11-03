// src/lib/dev-auth-bypass.ts

/**
 * Single server-only gate for local development authentication (SEC-005).
 *
 * The old `NEXT_PUBLIC_AUTH_DISABLED` kill-switch was read by 39 files, at least
 * nine of which invented a fake identity (`adminId: 1`, `roleId: 3`) with no
 * production guard, and its `NEXT_PUBLIC_` name meant the deployment's posture
 * shipped inside the client bundle. Only this module decides whether a session
 * may be synthesised, it never returns true in production, and no client
 * component imports it.
 */

/** Role id that means "development bypass"; accepted by the role helpers. */
export const DEV_BYPASS_ROLE_ID = -1;

/** Directus user id used by the legacy bypass paths (`adminId: 1`). */
export const DEV_BYPASS_USER_ID = 1;

export function isDevAuthBypassEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return (
    process.env.AUTH_DEV_BYPASS === "true" ||
    process.env.NEXT_PUBLIC_AUTH_DISABLED === "true"
  );
}

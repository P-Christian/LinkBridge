// src/lib/status-validator.ts

const DIRECTUS_BASE = (
  process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || ""
).replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

/**
 * Directus/MySQL naive datetimes carry no zone, so they must be read as the
 * server's +08:00 wall clock or every comparison drifts by hours.
 */
export function parseDbTimestamp(ts: string | null | undefined): number {
  if (!ts) return 0;
  if (ts.includes("Z") || ts.includes("+")) return new Date(ts).getTime();
  const normalized = ts.replace(" ", "T");
  const withTz = normalized.includes("T") ? `${normalized}+08:00` : normalized;
  const parsed = new Date(withTz).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface AccountAuthenticationState {
  user_id: string | number;
  user_email?: string;
  role?: string;
  role_id?: number;
  role_name?: string;
  user_fname?: string;
  user_lname?: string;
  status?: string | null;
  user_status?: string | null;
  verification_status?: string | null;
  status_version?: number | null;
  otp_verified?: boolean | number | string | null;
  is_blocked?: boolean | number | string | null;
  lock_until?: string | null;
  session_epoch?: string | null;
}

function isTruthyDatabaseFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function isMissingDatabaseFlag(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/**
 * Account statuses that are eligible to authenticate. `ACTIVE` is a fully
 * verified account, `VERIFIED` is a lifecycle state written by the
 * school/company verification flows, and `PENDING_VERIFICATION` is an account
 * that completed signup (including OTP) but still awaits admin verification.
 * Every other status remains denied. One shared, fail-closed predicate for
 * every JWT issuance/request gate.
 */
export const LOGIN_ELIGIBLE_ACCOUNT_STATUSES: readonly string[] = [
  "ACTIVE",
  "VERIFIED",
  "PENDING_VERIFICATION",
  "LIMITED",
];

export function canAuthenticate(
  user: AccountAuthenticationState | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!user) {
    return false;
  }

  // Challenge-backed registration writes `status`; accounts created by the
  // legacy registration/admin flows use `user_status`. Prefer the canonical
  // field when present, but retain the legacy field as a compatibility source.
  const canonicalStatus = String(user.status ?? "").trim();
  const legacyStatus = String(user.user_status ?? "").trim();
  const accountStatus = (canonicalStatus || legacyStatus).toUpperCase();
  if (!LOGIN_ELIGIBLE_ACCOUNT_STATUSES.includes(accountStatus)) {
    return false;
  }
  // Legacy admin-created accounts predate OTP enforcement and have no value
  // for otp_verified. Old self-registration still wrote an explicit 0 while
  // verification was pending, so only an absent legacy flag is compatible;
  // explicit false/0 remains denied. Refactor-era `status` rows always require
  // an affirmative OTP flag.
  const otpVerified = isTruthyDatabaseFlag(user.otp_verified);
  const legacyOtpNotApplicable =
    !canonicalStatus && isMissingDatabaseFlag(user.otp_verified);
  if (
    (!otpVerified && !legacyOtpNotApplicable) ||
    isTruthyDatabaseFlag(user.is_blocked)
  ) {
    return false;
  }
  if (user.lock_until) {
    const lockUntilMs = Date.parse(user.lock_until);
    if (!Number.isFinite(lockUntilMs) || lockUntilMs > nowMs) return false;
  }
  return true;
}

const ACCOUNT_AUTH_FIELDS = [
  "user_id",
  "user_email",
  "role",
  "role_id",
  "user_fname",
  "user_lname",
  "status",
  "otp_verified",
  "is_blocked",
  "lock_until",
  "session_epoch",
].join(",");

/**
 * Why an account lookup produced no usable row.
 *
 * `missing` and `unavailable` used to collapse into a single `null`, which made
 * every caller treat a Directus 503 as "this user does not exist". On
 * `/api/auth/me` that cost a real logout: the cookie was deleted on an upstream
 * blip and the UI pinned itself to guest until a hard reload.
 */
export type AccountLookup =
  | { outcome: "found"; user: AccountAuthenticationState }
  | { outcome: "missing" }
  | { outcome: "unavailable"; reason: string };

export async function lookupAccountAuthenticationState(
  userId: string | number
): Promise<AccountLookup> {
  if (!DIRECTUS_BASE || !DIRECTUS_TOKEN) {
    return { outcome: "unavailable", reason: "Directus is not configured" };
  }
  try {
    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_user/${encodeURIComponent(String(userId))}?fields=${ACCOUNT_AUTH_FIELDS}`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (res.status === 404) return { outcome: "missing" };
    if (!res.ok) {
      console.error(
        `[status-validator] Account lookup for #${userId} failed: ${res.status}`
      );
      return { outcome: "unavailable", reason: `Directus responded ${res.status}` };
    }
    const json = (await res.json()) as { data?: AccountAuthenticationState };
    if (!json.data) return { outcome: "missing" };
    return { outcome: "found", user: json.data };
  } catch (error) {
    console.error(`[status-validator] Account lookup for #${userId} threw:`, error);
    return { outcome: "unavailable", reason: "Directus lookup threw" };
  }
}

/**
 * The account row, or null when it cannot be read. Callers that must keep a
 * signed-in user signed in through an upstream outage should use
 * `lookupAccountAuthenticationState` and branch on `unavailable` instead.
 */
export async function getAccountAuthenticationState(
  userId: string | number
): Promise<AccountAuthenticationState | null> {
  const lookup = await lookupAccountAuthenticationState(userId);
  return lookup.outcome === "found" ? lookup.user : null;
}

/**
 * SEC-008: "log out all devices" and password change revoke `vs_user_sessions`
 * rows, but that was only enforced in middleware, which never sees `/api/*`.
 * A missing, revoked or expired row means the token must stop working even
 * though its signature and `exp` are still valid.
 *
 * An unreachable Directus is treated as "not revoked" here, matching the
 * middleware gate, so an upstream outage does not sign every user out of the
 * API; the account-state check around it still fails closed.
 */
export async function isSessionRevoked(sid: string): Promise<boolean> {
  if (!DIRECTUS_BASE || !DIRECTUS_TOKEN) return true;
  try {
    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_user_sessions/${encodeURIComponent(sid)}?fields=session_id,revoked_at,expires_at`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (res.status === 404) return true;
    if (!res.ok) {
      console.error(`[status-validator] Session lookup for sid failed: ${res.status}`);
      return false;
    }
    const json = (await res.json()) as { data?: { revoked_at?: string | null; expires_at?: string | null } };
    const session = json.data;
    if (!session) return true;
    if (session.revoked_at) return true;
    const expiresAtMs = parseDbTimestamp(session.expires_at);
    return expiresAtMs > 0 && Date.now() > expiresAtMs;
  } catch (error) {
    console.error("[status-validator] Session lookup threw:", error);
    return false;
  }
}

/**
 * A token issued before the account's current `session_epoch` belongs to a
 * session that has since been revoked wholesale.
 */
export function isSessionEpochStale(
  sessionEpoch: string | null | undefined,
  issuedAtSeconds: number | undefined
): boolean {
  const epochMs = parseDbTimestamp(sessionEpoch);
  const tokenMs = issuedAtSeconds ? issuedAtSeconds * 1000 : 0;
  return epochMs > 0 && tokenMs > 0 && epochMs > tokenMs;
}

/**
 * Why a capability restriction could not be answered.
 *
 * Every failed read used to return `false`, i.e. "no restriction", so a
 * suspended or LIMITED account could post jobs, apply to roles and send
 * messages for as long as `vs_user` or `vs_account_restriction` was
 * unreachable. The outage was read as a grant of the privilege.
 */
export type RestrictionCheck =
  | { restricted: false }
  | { restricted: true; reason: "restricted" }
  | { restricted: true; reason: "unavailable"; detail: string };

/**
 * Checks if a user has an active, unexpired capability restriction.
 * Utilizes a 15-second revalidated fetch cache.
 *
 * `restricted` is only `false` when it has been *confirmed* that no active
 * restriction applies. Doubt — an unreachable Directus, a missing account row,
 * an unreadable expiry — resolves to `restricted: true` with `reason:
 * "unavailable"` so a caller can deny with the honest wording instead of
 * accusing the user of a restriction nobody saw.
 */
export async function checkRestrictionState(
  userId: number,
  restrictionCode: string
): Promise<RestrictionCheck> {
  if (!DIRECTUS_BASE || !DIRECTUS_TOKEN) {
    return {
      restricted: true,
      reason: "unavailable",
      detail: "Directus is not configured",
    };
  }

  const statusState = await checkUserStatusState(userId);
  if (statusState.outcome !== "found") {
    return {
      restricted: true,
      reason: "unavailable",
      detail:
        statusState.outcome === "unavailable"
          ? statusState.reason
          : `Account #${userId} could not be found`,
    };
  }
  if (statusState.status === "ACTIVE") return { restricted: false };

  try {
    const url = `${DIRECTUS_BASE}/items/vs_account_restriction?filter[user_id][_eq]=${userId}&filter[code][_eq]=${encodeURIComponent(restrictionCode)}&filter[status][_eq]=ACTIVE&limit=1`;
    const res = await fetch(url, {
      headers: getHeaders(),
      next: { revalidate: 15 }, // Cache check for 15 seconds
    });

    if (!res.ok) {
      console.error(
        `[status-validator] Error checking restriction for user #${userId}: ${res.statusText}`
      );
      return {
        restricted: true,
        reason: "unavailable",
        detail: `Directus responded ${res.status}`,
      };
    }

    const json = await res.json();
    const restrictions = json.data || [];
    if (restrictions.length === 0) return { restricted: false };

    // Check expiration timestamp
    const restriction = restrictions[0];
    if (restriction.expires_at) {
      // vs_account_restriction stores Manila wall clock, like every other vs_*
      // datetime. new Date() would read it in the server's own zone, moving the
      // expiry by the offset between that zone and +08:00.
      // An unreadable expiry parses to 0 and stays enforced: guessing that a
      // restriction has lapsed would hand back the privilege we cannot confirm.
      const expiry = parseDbTimestamp(restriction.expires_at);
      if (expiry > 0 && Date.now() > expiry) {
        // Expired restriction
        return { restricted: false };
      }
    }

    return { restricted: true, reason: "restricted" };
  } catch (error) {
    console.error(
      `[status-validator] Exception checking restriction for user #${userId}:`,
      error
    );
    return {
      restricted: true,
      reason: "unavailable",
      detail: "Restriction lookup threw",
    };
  }
}

/**
 * `true` unless the account's restriction state was read successfully and found
 * clear. Use `checkRestrictionState` where the response needs to distinguish an
 * outage from a real restriction.
 */
export async function checkRestriction(
  userId: number,
  restrictionCode: string
): Promise<boolean> {
  return (await checkRestrictionState(userId, restrictionCode)).restricted;
}

/**
 * The account's status and session epoch, or why it could not be read.
 *
 * Collapsing "unreachable" and "no such account" into a `null` handed
 * `checkRestriction` an unreadable answer that it then reported as "clear".
 *
 * `status` is `""` when neither `status` nor `user_status` carries a value —
 * that is an unknown account, not an active one, so it must not short-circuit
 * the restriction lookup.
 */
export type UserStatusState =
  | { outcome: "found"; status: string; session_epoch?: string | null }
  | { outcome: "missing" }
  | { outcome: "unavailable"; reason: string };

export async function checkUserStatusState(
  userId: number
): Promise<UserStatusState> {
  try {
    const url = `${DIRECTUS_BASE}/items/vs_user/${userId}`;
    const res = await fetch(url, {
      headers: getHeaders(),
      next: { revalidate: 15 }
    });

    if (res.status === 404) return { outcome: "missing" };
    if (!res.ok) {
      console.error(
        `[status-validator] Error fetching user status details for user #${userId}: ${res.statusText}`
      );
      return { outcome: "unavailable", reason: `Directus responded ${res.status}` };
    }

    const json = await res.json();
    const user = json.data;
    if (!user) return { outcome: "missing" };

    // Prefer the canonical column but fall back to the legacy one, exactly as
    // canAuthenticate does. Defaulting a blank status to "ACTIVE" made
    // checkRestrictionState return before reading vs_account_restriction, so an
    // account suspended only through user_status (the school-verification
    // cascade writes that column) read as unrestricted.
    const status =
      String(user.status ?? "").trim() || String(user.user_status ?? "").trim();

    return {
      outcome: "found",
      status: status.toUpperCase(),
      session_epoch: user.session_epoch,
    };
  } catch (error) {
    console.error(
      `[status-validator] Exception checking status for user #${userId}:`,
      error
    );
    return { outcome: "unavailable", reason: "Status lookup threw" };
  }
}

/**
 * Checks the user's general account status and session epoch.
 * Returns the status and session_epoch, utilizing a 15-second revalidated fetch cache.
 */
export async function checkUserStatus(userId: number): Promise<{ status: string; session_epoch?: string | null } | null> {
  const state = await checkUserStatusState(userId);
  return state.outcome === "found"
    ? { status: state.status, session_epoch: state.session_epoch }
    : null;
}

/**
 * Checks if the user's associated company is approved (vs_company.verification_status === "VERIFIED").
 * Non-verified companies are restricted from posting jobs, browsing candidate profiles, or sending candidate messages.
 *
 * `readFailed` marks the two cases where nothing was actually learned — the
 * link or the company row could not be read. Those used to answer
 * `verification_status: "DRAFT"`, so a Directus blip told an already-verified
 * company that it was sitting in a draft nobody had seen, and pointed it at a
 * resubmission path instead of a retry.
 */
export async function checkCompanyVerificationStatus(userId: number): Promise<{
  isVerified: boolean;
  verification_status: string;
  companyId: number | null;
  readFailed: boolean;
}> {
  const unavailable = (companyId: number | null, detail: string) => {
    console.error(
      `[status-validator] Company verification for user #${userId} could not be read: ${detail}`
    );
    return {
      isVerified: false,
      verification_status: "UNKNOWN",
      companyId,
      readFailed: true,
    };
  };

  try {
    const linkUrl = `${DIRECTUS_BASE}/items/vs_company_user?filter[user_id][_eq]=${userId}&fields=company_id&limit=1`;
    const linkRes = await fetch(linkUrl, { headers: getHeaders(), next: { revalidate: 10 } });
    if (!linkRes.ok) return unavailable(null, `link read responded ${linkRes.status}`);

    const linkJson = await linkRes.json();
    const link = linkJson.data?.[0];
    // A confirmed read with no link: the account is not attached to a company,
    // which is a different fact from "the company is in DRAFT".
    if (!link?.company_id) {
      return {
        isVerified: false,
        verification_status: "NO_COMPANY",
        companyId: null,
        readFailed: false,
      };
    }

    const companyRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_company/${link.company_id}?fields=company_id,verification_status`,
      { headers: getHeaders(), next: { revalidate: 10 } }
    );
    if (!companyRes.ok) return unavailable(link.company_id, `company read responded ${companyRes.status}`);

    const companyJson = await companyRes.json();
    const status = String(companyJson.data?.verification_status ?? "DRAFT").toUpperCase();
    return {
      isVerified: status === "VERIFIED",
      verification_status: status,
      companyId: link.company_id,
      readFailed: false,
    };
  } catch (error) {
    console.error(`[status-validator] Exception checking company verification status for user #${userId}:`, error);
    return unavailable(null, "lookup threw");
  }
}

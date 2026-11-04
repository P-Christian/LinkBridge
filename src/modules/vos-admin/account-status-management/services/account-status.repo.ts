// src/modules/vos-admin/account-status-management/services/account-status.repo.ts
import { AccountStatusUser, AccountRestriction, AccountStatusCase, AccountDeletionRequest, toAccountStatus } from '../types/account-status.types';
import { mapPool } from "@/lib/server/pool";
import { getPHTimeString, toPHWallClock } from "@/lib/utils";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

/**
 * Deactivates the given ACTIVE restriction rows in one bounded batch and returns
 * the ids that stayed ACTIVE.
 *
 * Callers must not swallow the failures: a row that stays ACTIVE keeps the user
 * blocked. But they must not abort the transition either — the user row is the
 * commit point, so a throw here lands on the admin as "the status change
 * failed", the history entry is never written, and the retry becomes a second
 * transition. Both write paths therefore turn the failures into warnings, and
 * the detail read keeps the failed rows visible as ACTIVE.
 */
async function deactivateRestrictions(
  rows: Array<{ restriction_id: number }>
): Promise<number[]> {
  if (rows.length === 0) return [];

  const results = await mapPool(rows, (r) =>
    fetch(`${DIRECTUS_BASE}/items/vs_account_restriction/${r.restriction_id}`, {
      method: "PATCH",
      headers: getHeaders(),
      cache: "no-store",
      body: JSON.stringify({ status: "INACTIVE" }),
    }).catch(() => null)
  );

  return rows
    .filter((_, index) => !results[index]?.ok)
    .map((r) => r.restriction_id);
}

interface DirectusUserRaw {
  user_id: number;
  user_email: string;
  user_fname: string;
  user_lname: string;
  role?: string | null;
  role_id?: number | null;
  status?: string | null;
  verification_status?: string | null;
  status_version?: number | null;
  session_epoch?: string | null;
}

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

/**
 * vs_user.status_version, read immediately before a transition. A caller's copy
 * can go stale between its detail read and its write, and a missing column is
 * treated as the DDL default (1) rather than reset to 0 by the caller.
 */
async function readStatusVersion(userId: number): Promise<number> {
  const res = await fetch(`${DIRECTUS_BASE}/items/vs_user/${userId}?fields=status_version`, {
    headers: getHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Could not read the current status version for user #${userId}.`);
  }
  const json: unknown = await res.json().catch(() => null);
  const raw = (json as { data?: { status_version?: unknown } })?.data?.status_version;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

export async function fetchAccountStatusUsersRepo(
  statusFilter?: string,
  search?: string,
  page: number = 1,
  limit: number = 10
): Promise<{ users: AccountStatusUser[]; total: number }> {
  const queries: string[] = [];

  queries.push(`limit=${limit}`);
  queries.push(`page=${page}`);
  queries.push('meta=filter_count');
  queries.push('sort=-user_id');

  const filter: Record<string, unknown> = {};

  if (statusFilter && statusFilter !== "ALL") {
    filter.status = { _eq: statusFilter };
  }

  if (search && search.trim()) {
    const q = search.trim();
    filter._or = [
      { user_fname: { _contains: q } },
      { user_lname: { _contains: q } },
      { user_email: { _contains: q } },
    ];
  }

  if (Object.keys(filter).length > 0) {
    queries.push(`filter=${encodeURIComponent(JSON.stringify(filter))}`);
  }

  const url = `${DIRECTUS_BASE}/items/vs_user?${queries.join('&')}`;

  const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch users: ${res.statusText}`);
  }

  const json = await res.json();
  const rawUsers: DirectusUserRaw[] = json.data || [];
  const total = json.meta?.filter_count ?? rawUsers.length;

  const userIds = rawUsers.map((u: DirectusUserRaw) => u.user_id);
  const restrictionsMap: Record<number, AccountRestriction[]> = {};
  const casesMap: Record<number, AccountStatusCase[]> = {};
  const deletionsMap: Record<number, AccountDeletionRequest> = {};

  if (userIds.length > 0) {
    const idsCsv = userIds.join(',');

    // Fetch restrictions
    const restUrl = `${DIRECTUS_BASE}/items/vs_account_restriction?filter[user_id][_in]=${idsCsv}&filter[status][_eq]=ACTIVE&limit=-1`;
    const restRes = await fetch(restUrl, { headers: getHeaders(), cache: "no-store" });
    if (restRes.ok) {
      const restJson = await restRes.json();
      (restJson.data || []).forEach((r: AccountRestriction) => {
        if (!restrictionsMap[r.user_id]) restrictionsMap[r.user_id] = [];
        restrictionsMap[r.user_id].push(r);
      });
    }

    // Fetch appeal cases
    const casesUrl = `${DIRECTUS_BASE}/items/vs_account_status_case?filter[user_id][_in]=${idsCsv}&limit=-1`;
    const casesRes = await fetch(casesUrl, { headers: getHeaders(), cache: "no-store" });
    if (casesRes.ok) {
      const casesJson = await casesRes.json();
      (casesJson.data || []).forEach((c: AccountStatusCase) => {
        if (!casesMap[c.user_id]) casesMap[c.user_id] = [];
        casesMap[c.user_id].push(c);
      });
    }

    // Fetch deletion requests
    const delUrl = `${DIRECTUS_BASE}/items/vs_account_deletion_request?filter[user_id][_in]=${idsCsv}&filter[completed_at][_null]=true&limit=-1`;
    const delRes = await fetch(delUrl, { headers: getHeaders(), cache: "no-store" });
    if (delRes.ok) {
      const delJson = await delRes.json();
      (delJson.data || []).forEach((d: AccountDeletionRequest) => {
        deletionsMap[d.user_id] = d;
      });
    }
  }

  const users: AccountStatusUser[] = rawUsers.map((u: DirectusUserRaw) => ({
    user_id: u.user_id,
    user_email: u.user_email,
    user_fname: u.user_fname,
    user_lname: u.user_lname,
    role: u.role || 'USER',
    role_id: u.role_id ?? null,
    status: toAccountStatus(u.status),
    verification_status: u.verification_status ?? (u.status === 'PENDING_VERIFICATION' ? 'PENDING' : (u.status === 'ACTIVE' ? 'VERIFIED' : null)),
    status_version: u.status_version || 1,
    session_epoch: u.session_epoch ?? null,
    restrictions: restrictionsMap[u.user_id] || [],
    cases: casesMap[u.user_id] || [],
    deletionRequest: deletionsMap[u.user_id] || null
  }));

  return { users, total };
}

export async function fetchUserStatusDetailRepo(userId: number): Promise<AccountStatusUser | null> {
  const url = `${DIRECTUS_BASE}/items/vs_user/${userId}`;
  const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch user status details: ${res.statusText}`);
  }

  const json = await res.json();
  const u = json.data;
  if (!u) return null;

  // Fetch restrictions. Each of these four reads used to answer "no rows" when
  // Directus was unreachable, so the moderator panel showed an account with no
  // active restriction, no status history, no appeal cases and no deletion
  // request — and a reinstatement decided from that panel acts on the outage.
  const restUrl = `${DIRECTUS_BASE}/items/vs_account_restriction?filter[user_id][_eq]=${userId}&filter[status][_eq]=ACTIVE&limit=-1`;
  const restRes = await fetch(restUrl, { headers: getHeaders(), cache: "no-store" });
  if (!restRes.ok) {
    throw new Error(`Could not read the restrictions on user #${userId}.`);
  }
  let restrictions = (await restRes.json()).data || [];

  // Self-heal: deactivate stale active restrictions if user status is ACTIVE
  if (u.status === 'ACTIVE' && restrictions.length > 0) {
    const failed = await deactivateRestrictions(restrictions);
    // A row whose PATCH failed is still ACTIVE in the database, so it stays in
    // the list rather than being reported to the panel as cleared.
    restrictions = restrictions.filter(
      (r: { restriction_id: number }) => !failed.includes(r.restriction_id)
    );
  }

  // Fetch history
  const histUrl = `${DIRECTUS_BASE}/items/vs_account_status_history?filter[user_id][_eq]=${userId}&sort=-occurred_at&limit=50`;
  const histRes = await fetch(histUrl, { headers: getHeaders(), cache: "no-store" });
  if (!histRes.ok) {
    throw new Error(`Could not read the status history of user #${userId}.`);
  }
  const history = (await histRes.json()).data || [];

  // Fetch appeal cases
  const casesUrl = `${DIRECTUS_BASE}/items/vs_account_status_case?filter[user_id][_eq]=${userId}&sort=-created_at&limit=-1`;
  const casesRes = await fetch(casesUrl, { headers: getHeaders(), cache: "no-store" });
  if (!casesRes.ok) {
    throw new Error(`Could not read the appeal cases of user #${userId}.`);
  }
  const cases = (await casesRes.json()).data || [];

  // Fetch deletion requests
  const delUrl = `${DIRECTUS_BASE}/items/vs_account_deletion_request?filter[user_id][_eq]=${userId}&sort=-requested_at&limit=1`;
  const delRes = await fetch(delUrl, { headers: getHeaders(), cache: "no-store" });
  if (!delRes.ok) {
    throw new Error(`Could not read the deletion request of user #${userId}.`);
  }
  const delData = (await delRes.json()).data || [];
  const deletionRequest = delData.length > 0 ? delData[0] : null;

  return {
    user_id: u.user_id,
    user_email: u.user_email,
    user_fname: u.user_fname,
    user_lname: u.user_lname,
    role: u.role || 'USER',
    role_id: u.role_id,
    status: toAccountStatus(u.status),
    verification_status: u.verification_status ?? (u.status === 'PENDING_VERIFICATION' ? 'PENDING' : (u.status === 'ACTIVE' ? 'VERIFIED' : null)),
    status_version: u.status_version || 1,
    session_epoch: u.session_epoch,
    restrictions,
    cases,
    history,
    deletionRequest
  };
}

/**
 * Applies a status transition and returns the non-fatal failures encountered.
 *
 * The user row is the commit point: once it is written the account really has
 * changed, so a failed history or restriction write must not be reported as an
 * error (an admin who sees an error retries, and the second attempt is a second
 * transition). It is reported as a warning instead.
 */
export async function updateUserStatusRepo(
  userId: number,
  newStatus: string,
  adminEmail: string,
  reasonCode: string,
  publicReason: string,
  internalNote?: string,
  expiresAt?: string | null,
  restrictionsToApply?: string[]
): Promise<string[]> {
  const warnings: string[] = [];
  const newVersion = (await readStatusVersion(userId)) + 1;

  // Reject an unreadable expiry before anything is written: a null here would
  // silently mean "never expires", and the account stays limited forever.
  let expiresAtPH: string | null = null;
  if (expiresAt) {
    const parsed = toPHWallClock(expiresAt);
    if (parsed === null) throw new Error("expiresAt is not a valid date.");
    expiresAtPH = parsed;
  }

  // Update vs_user status
  const userUrl = `${DIRECTUS_BASE}/items/vs_user/${userId}`;
  const userPayload = {
    status: newStatus,
    // The ledger columns have to move with the status, or every history row's
    // prior/new version pair describes a counter nothing ever incremented.
    status_version: newVersion,
    session_epoch: newStatus !== 'ACTIVE' && newStatus !== 'LIMITED' ? getPHTimeString() : undefined
  };
  const userRes = await fetch(userUrl, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(userPayload)
  });

  if (!userRes.ok) {
    throw new Error(`Failed to update user status record: ${await userRes.text()}`);
  }

  // Deactivate all existing active restrictions for this user
  const checkRestUrl = `${DIRECTUS_BASE}/items/vs_account_restriction?filter[user_id][_eq]=${userId}&filter[status][_eq]=ACTIVE&limit=-1`;
  const checkRestRes = await fetch(checkRestUrl, { headers: getHeaders(), cache: "no-store" });
  if (checkRestRes.ok) {
    const activeRest = (await checkRestRes.json()).data || [];
    const failedClear = await deactivateRestrictions(activeRest);
    if (failedClear.length > 0) {
      warnings.push(
        `The status changed, but restrictions ${failedClear.join(", ")} could not be cleared and are still active on this account.`
      );
    }
  } else {
    warnings.push("Existing restrictions could not be read, so none were cleared.");
  }

  // Create history record
  let historyReason = internalNote || reasonCode;
  if (newStatus === 'LIMITED' && restrictionsToApply && restrictionsToApply.length > 0) {
    historyReason = `${historyReason} | Restrictions: ${restrictionsToApply.join(', ')}`;
  }

  const histUrl = `${DIRECTUS_BASE}/items/vs_account_status_history`;
  const histPayload = {
    user_id: userId,
    prior_status: null, // Can be resolved dynamically if needed
    new_status: newStatus,
    prior_version: newVersion - 1,
    new_version: newVersion,
    actor: adminEmail,
    approver: adminEmail,
    reason: historyReason,
    occurred_at: getPHTimeString()
  };

  const histRes = await fetch(histUrl, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(histPayload)
  }).catch(() => null);
  if (!histRes?.ok) {
    console.error(`Account status history write failed for user #${userId}`);
    warnings.push("The status history entry could not be written.");
  }

  // Handle active restrictions if status is LIMITED
  if (newStatus === 'LIMITED' && restrictionsToApply && restrictionsToApply.length > 0) {
    const restUrl = `${DIRECTUS_BASE}/items/vs_account_restriction`;
    for (const code of restrictionsToApply) {
      const restPayload = {
        user_id: userId,
        code,
        status: 'ACTIVE',
        effective_at: getPHTimeString(),
        // Manila wall clock, matching effective_at and every other vs_* datetime
        // column. The client sends an absolute ISO instant; slicing it would keep
        // UTC digits, eight hours early, and lift the restriction while the
        // account is still meant to be limited.
        expires_at: expiresAtPH,
        reason: publicReason,
        source: adminEmail
      };

      const restRes = await fetch(restUrl, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(restPayload)
      }).catch(() => null);
      if (!restRes?.ok) {
        console.error(`Restriction ${code} could not be applied to user #${userId}`);
        warnings.push(`Restriction ${code} could not be applied.`);
      }
    }
  }

  return warnings;
}

export async function updateAppealCaseRepo(
  caseId: number,
  userId: number,
  decision: 'uphold' | 'modify' | 'restore',
  adminEmail: string,
  internalNote?: string,
  publicNote?: string
): Promise<string[]> {
  // Restore the account before closing the case. Closing first meant a failed
  // restore left the appeal RESOLVED with the account still blocked, and a
  // resolved case never reappears in the decision queue.
  const warnings: string[] = [];
  if (decision === 'restore') {
    // updateUserStatusRepo already clears every ACTIVE restriction for the user,
    // so this is the one write the restore needs.
    warnings.push(
      ...(await updateUserStatusRepo(
        userId,
        'ACTIVE',
        adminEmail,
        'APPEAL_RESTORED',
        'Your appeal has been accepted and your account access is restored.',
        internalNote
      ))
    );
  }

  const caseUrl = `${DIRECTUS_BASE}/items/vs_account_status_case/${caseId}`;
  const casePayload = {
    state: 'RESOLVED',
    internal_decision: internalNote,
    public_decision: publicNote || `Appeal ${decision}ed by administration.`,
    resolved_at: getPHTimeString()
  };

  const caseRes = await fetch(caseUrl, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(casePayload)
  }).catch(() => null);

  if (!caseRes?.ok) {
    const detail = caseRes ? await caseRes.text().catch(() => "") : "no response";
    throw new Error(
      decision === 'restore'
        ? `The account was restored but case #${caseId} could not be closed: ${detail}`
        : `Failed to update case record: ${detail}`
    );
  }

  return warnings;
}

// src/modules/vos-admin/account-status-management/types/account-status.types.ts

// The route validates against this list: an unrecognised value in vs_user.status
// is not login-eligible, so a typo from a hand-built request locks the account
// out with no status any screen knows how to clear.
export const ACCOUNT_STATUSES = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'LIMITED',
  'SUSPENDED',
  'BLOCKED',
  'DEACTIVATED',
  'PENDING_DELETION',
  'DELETED',
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

// A vs_user row whose status column is empty or holds a value this list does
// not know. Reporting it as ACTIVE would show an unverifiable account as being
// in good standing, and the screen has no way to say "unreadable" otherwise.
export const UNKNOWN_ACCOUNT_STATUS = 'UNKNOWN';

export type AccountStatusOrUnknown = AccountStatus | typeof UNKNOWN_ACCOUNT_STATUS;

/** Narrows whatever the database held to a status the screens recognise. */
export function toAccountStatus(value: unknown): AccountStatusOrUnknown {
  return ACCOUNT_STATUSES.includes(value as AccountStatus)
    ? (value as AccountStatus)
    : UNKNOWN_ACCOUNT_STATUS;
}

export interface AccountRestriction {
  restriction_id: number;
  user_id: number;
  code: string;
  scope_type?: string | null;
  scope_id?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  effective_at: string;
  expires_at?: string | null;
  reason?: string | null;
  source?: string | null;
}

export interface AccountStatusHistory {
  history_id: number;
  user_id: number;
  prior_status?: AccountStatus | null;
  new_status: AccountStatus;
  prior_version?: number | null;
  new_version: number;
  actor?: string | null;
  approver?: string | null;
  reason?: string | null;
  policy_version?: string | null;
  occurred_at: string;
}

export interface AccountStatusCase {
  case_id: number;
  user_id: number;
  type: string;
  state: 'OPEN' | 'ASSIGNED' | 'RESOLVED';
  assigned_reviewer?: number | null;
  evidence_refs?: string | null;
  statement?: string | null;
  public_decision?: string | null;
  internal_decision?: string | null;
  created_at: string;
  updated_at?: string | null;
  resolved_at?: string | null;
}

export interface AccountDeletionRequest {
  request_id: number;
  user_id: number;
  requested_at: string;
  due_at: string;
  cancelled_at?: string | null;
  completed_at?: string | null;
  hold_state?: boolean | number | null;
  retention_state?: string | null;
  result_category?: string | null;
}

export interface AccountStatusUser {
  user_id: number;
  user_email: string;
  user_fname: string;
  user_lname: string;
  role: string;
  role_id: number | null;
  status: AccountStatusOrUnknown;
  verification_status?: string | null;
  status_version: number;
  session_epoch?: string | null;
  restrictions?: AccountRestriction[];
  cases?: AccountStatusCase[];
  history?: AccountStatusHistory[];
  deletionRequest?: AccountDeletionRequest | null;
}

export interface StatusTransitionPayload {
  userId: number;
  targetStatus: AccountStatus;
  reasonCode: string;
  publicReason: string;
  internalNote?: string;
  duration?: string;
  expiresAt?: string | null;
  restrictions?: string[]; // Array of restriction codes to apply (if LIMITED)
}

export interface AppealDecisionPayload {
  caseId: number;
  decision: 'uphold' | 'modify' | 'restore';
  internalNote?: string;
  publicNote?: string;
}

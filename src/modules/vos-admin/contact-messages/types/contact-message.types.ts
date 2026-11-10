// src/modules/vos-admin/contact-messages/types/contact-message.types.ts

export type ContactMessageStatus = "new" | "read" | "resolved" | "archived";

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  company: string | null;
  subject: string;
  message: string;
  /** FK to vs_user.user_id — populated when the sender was logged in */
  user_id: number | null;
  /** Snapshot of sender's role at submission time */
  user_role: string | null;
  status: ContactMessageStatus;
  /** Origin channel — always "web_form" from the public contact page */
  source: string;
  /** FK to vs_user.user_id — which admin currently owns this message */
  assigned_to: number | null;
  /** Overwritable pinned note left by an admin */
  internal_note: string | null;
  /** FK to vs_user.user_id — admin who last changed status or note */
  reviewed_by: number | null;
  reviewed_at: string | null;
  /** SHA-256 hash of the sender's IP address */
  ip_hash: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Shape returned by the list endpoint (items + total) */
export interface ContactMessageListResult {
  items: ContactMessage[];
  total: number;
}

/** Active (non-soft-deleted) queue size, per status, plus the whole queue. */
export type ContactMessageStatusCounts = Record<ContactMessageStatus, number> & {
  all: number;
};

/** Query params accepted by GET /api/vos-admin/contact-messages */
export interface ContactMessageListParams {
  status?: ContactMessageStatus | "all";
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/** Body accepted by PATCH /api/vos-admin/contact-messages/[id] */
export interface ContactMessagePatchBody {
  status?: ContactMessageStatus;
  internal_note?: string;
}

/** Shape of the public submit payload (after Zod parsing) */
export interface ContactSubmitPayload {
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
  /** Honeypot — must be empty; never stored */
  website?: string;
}

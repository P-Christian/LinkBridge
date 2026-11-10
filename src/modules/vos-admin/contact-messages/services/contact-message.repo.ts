// src/modules/vos-admin/contact-messages/services/contact-message.repo.ts
import type {
  ContactMessage,
  ContactMessageListResult,
  ContactMessageListParams,
  ContactMessagePatchBody,
  ContactMessageStatusCounts,
} from "../types/contact-message.types";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const COLLECTION = "vs_contact_messages";

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

/** Insert a new contact message row. Returns the created record. */
export async function insertContactMessageRepo(
  payload: Omit<
    ContactMessage,
    "id" | "status" | "assigned_to" | "internal_note" | "reviewed_by" | "reviewed_at" | "deleted_at" | "updated_at"
  > & { status: "new"; source: string }
): Promise<ContactMessage> {
  const res = await fetch(`${DIRECTUS_BASE}/items/${COLLECTION}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[contact-messages] insert failed ${res.status}: ${text}`);
  }

  const json = await res.json();
  return json.data as ContactMessage;
}

/**
 * Directus `meta.total_count` on this collection answers with the size of the
 * whole table whatever filter was applied, so a filtered page believed it was
 * showing 7 of 7 when only 4 rows matched. `aggregate[count]` does honour the
 * filter (the unread badge proves it), so every count here goes through it.
 */
async function countWithFilter(filter: Record<string, unknown>): Promise<number> {
  const query = new URLSearchParams({
    fields: "id",
    "aggregate[count]": "id",
    limit: "1",
    filter: JSON.stringify(filter),
  });

  const res = await fetch(`${DIRECTUS_BASE}/items/${COLLECTION}?${query}`, {
    headers: getHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 403 || res.status === 404) return 0;
    throw new Error(`[contact-messages] count failed ${res.status}: ${text}`);
  }

  const json = await res.json();
  return Number(json.data?.[0]?.count?.id ?? 0);
}

/** The filters shared by the page query and its count, so the two cannot drift. */
function buildListFilter(params: Pick<ContactMessageListParams, "status" | "q" | "from" | "to">) {
  const and: Record<string, unknown>[] = [
    // Exclude soft-deleted rows
    { deleted_at: { _null: true } },
  ];
  if (params.status && params.status !== "all") and.push({ status: { _eq: params.status } });
  if (params.from) and.push({ created_at: { _gte: params.from } });
  if (params.to) and.push({ created_at: { _lte: params.to } });

  const search = params.q?.trim();
  if (search) {
    and.push({
      _or: ["name", "email", "subject", "company"].map((field) => ({
        [field]: { _icontains: search },
      })),
    });
  }

  return { _and: and };
}

/** Fetch a paginated, filtered list of contact messages (excludes soft-deleted). */
export async function fetchContactMessagesRepo(
  params: ContactMessageListParams
): Promise<ContactMessageListResult> {
  const { status, q, from, to, page = 1, pageSize = 20 } = params;
  const safePageSize = Math.min(Math.max(1, pageSize), 100);
  const offset = (Math.max(1, page) - 1) * safePageSize;

  const baseFields = "id,name,email,company,subject,message,user_id,user_role,status,source,assigned_to,internal_note,reviewed_by,reviewed_at,ip_hash,created_at,updated_at,deleted_at";

  // The search branch used to hard-code filter[_and][2]/[3]/[4] for status, from
  // and to, so whichever of them was absent left a hole in the _and array and a
  // constraint the admin had actually chosen was dropped. Serialising a real
  // object also stops user-supplied values from rewriting the filter around a
  // quote character.
  const filter = buildListFilter({ status, q, from, to });

  const query = new URLSearchParams({
    fields: baseFields,
    limit: String(safePageSize),
    offset: String(offset),
    "sort[]": "-created_at",
    filter: JSON.stringify(filter),
  });

  const [res, total] = await Promise.all([
    fetch(`${DIRECTUS_BASE}/items/${COLLECTION}?${query}`, { headers: getHeaders(), cache: "no-store" }),
    countWithFilter(filter),
  ]);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(`[contact-messages] list failed ${res.status}: ${text}`);
    // If collection does not exist yet in Directus, return empty result instead of throwing 500
    if (res.status === 403 || res.status === 404) {
      return { items: [], total: 0 };
    }
    throw new Error(`[contact-messages] list failed ${res.status}: ${text}`);
  }

  const json = await res.json();
  return {
    items: (json.data ?? []) as ContactMessage[],
    total,
  };
}

/**
 * Queue totals for the KPI cards and the filter tabs. One grouped read instead
 * of a count per status; `all` is the unfiltered active total, so an unexpected
 * status value still shows up in `all` rather than silently shrinking the queue.
 */
export async function countContactMessagesByStatusRepo(): Promise<ContactMessageStatusCounts> {
  const query = new URLSearchParams({
    fields: "status",
    "aggregate[count]": "id",
    groupBy: "status",
    limit: "-1",
    filter: JSON.stringify({ deleted_at: { _null: true } }),
  });

  const res = await fetch(`${DIRECTUS_BASE}/items/${COLLECTION}?${query}`, {
    headers: getHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 403 || res.status === 404) {
      return { all: 0, new: 0, read: 0, resolved: 0, archived: 0 };
    }
    throw new Error(`[contact-messages] status counts failed ${res.status}: ${text}`);
  }

  const json = await res.json();
  const rows: Array<{ status?: unknown; count?: { id?: unknown } }> = Array.isArray(json.data) ? json.data : [];

  const counts: ContactMessageStatusCounts = { all: 0, new: 0, read: 0, resolved: 0, archived: 0 };
  for (const row of rows) {
    const n = Number(row?.count?.id ?? 0);
    counts.all += n;
    const status = String(row?.status ?? "");
    if (status === "new" || status === "read" || status === "resolved" || status === "archived") {
      counts[status] += n;
    }
  }
  return counts;
}

/** Fetch a single contact message by ID. */
export async function fetchContactMessageByIdRepo(
  id: number
): Promise<ContactMessage | null> {
  const fields = "id,name,email,company,subject,message,user_id,user_role,status,source,assigned_to,internal_note,reviewed_by,reviewed_at,ip_hash,created_at,updated_at,deleted_at";
  const res = await fetch(`${DIRECTUS_BASE}/items/${COLLECTION}/${id}?fields=${fields}`, {
    headers: getHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[contact-messages] fetch by id failed ${res.status}: ${text}`);
  }
  const json = await res.json();
  const row = json.data as ContactMessage | null;
  // Treat soft-deleted as not found
  if (!row || row.deleted_at) return null;
  return row;
}

/** Update status and/or internal_note. Also records reviewer and timestamp. */
export async function patchContactMessageRepo(
  id: number,
  patch: ContactMessagePatchBody & { reviewed_by: number; reviewed_at: string; updated_at: string }
): Promise<ContactMessage> {
  const res = await fetch(`${DIRECTUS_BASE}/items/${COLLECTION}/${id}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[contact-messages] patch failed ${res.status}: ${text}`);
  }
  const json = await res.json();
  return json.data as ContactMessage;
}

/** Soft-delete a contact message by setting deleted_at. */
export async function softDeleteContactMessageRepo(
  id: number,
  deletedAt: string
): Promise<void> {
  const res = await fetch(`${DIRECTUS_BASE}/items/${COLLECTION}/${id}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ deleted_at: deletedAt }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[contact-messages] soft-delete failed ${res.status}: ${text}`);
  }
}

/** Mark a 'new' message as 'read' and record the reviewing admin. */
export async function markAsReadRepo(
  id: number,
  adminId: number,
  now: string
): Promise<void> {
  const res = await fetch(`${DIRECTUS_BASE}/items/${COLLECTION}/${id}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({
      status: "read",
      reviewed_by: adminId,
      reviewed_at: now,
      updated_at: now,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[contact-messages] mark-as-read failed ${res.status}: ${text}`);
  }
}

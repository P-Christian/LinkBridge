// src/lib/messaging/conversation-reads.ts
// Server-only reads shared by both portal mirrors' conversation lists. Each
// mirror used to hand-roll the same two lookups with its own row window, so the
// same account saw different previews and different unread badges depending on
// which portal it logged into.

import { directusItems } from "@/lib/server/directus";
import { chunk, mapPool } from "@/lib/server/pool";

export type ConversationMessageRow = Record<string, unknown>;

const MESSAGE_FIELDS =
  "message_id,conversation_id,message_type,message_content,sender_id,created_at";

/** Conversations sampled per query. Keeps each request's row budget small. */
const CONVERSATION_BATCH = 20;
/** Most recent messages inspected per conversation when counting unread. */
const MESSAGES_PER_CONVERSATION = 20;
/** Ids per `_in=` clause, kept small enough that the request URL stays valid. */
const IN_CHUNK = 200;

function positiveIds(ids: readonly number[]): number[] {
  return ids.filter((id) => Number.isInteger(id) && id > 0);
}

/**
 * Read a newest-first message window covering a batch of conversations.
 *
 * `limit = batch × window` is only enough for every thread in the batch if none
 * of them is busy: one conversation with that many recent messages fills the
 * window, the rest come back with no rows and the callers read that as "no
 * preview" and, worse for the badge, "nothing unread". When the window arrives
 * full, each conversation re-reads with a window of its own.
 */
async function messageWindow(
  ids: readonly number[],
  window: number,
  buildQuery: (ids: readonly number[], limit: number) => string
): Promise<ConversationMessageRow[]> {
  const limit = ids.length * window;
  const rows = await directusItems<ConversationMessageRow>("vs_message", {
    query: buildQuery(ids, limit),
  });
  if (ids.length === 1 || rows.length < limit) return rows;

  const singles = await mapPool(ids, (id) =>
    directusItems<ConversationMessageRow>("vs_message", {
      query: buildQuery([id], window),
    })
  );
  return singles.flat();
}

/**
 * Newest visible message per conversation.
 *
 * The lists used to read one global "newest 200 messages" window and take the
 * first row per conversation, which only covers threads busy enough to sit in
 * that window: a conversation whose last message predates 200 newer ones
 * rendered with an empty preview and no last-activity time at all. Sampling a
 * bounded window per small batch of conversations keeps that from happening.
 */
export async function lastMessageByConversation(
  conversationIds: readonly number[]
): Promise<Map<number, ConversationMessageRow>> {
  const ids = positiveIds(conversationIds);
  const result = new Map<number, ConversationMessageRow>();
  if (ids.length === 0) return result;

  const batches = await mapPool(chunk(ids, CONVERSATION_BATCH), (batch) =>
    messageWindow(batch, MESSAGES_PER_CONVERSATION, (convIds, limit) =>
      // MySQL `timestamp` has 1-second resolution: two messages sent in the
      // same second tie on created_at, so the preview row can flip to an older
      // message. message_id breaks the tie.
      `filter[conversation_id][_in]=${convIds.join(",")}` +
        `&filter[is_deleted][_eq]=false` +
        `&sort[]=-created_at&sort[]=-message_id` +
        `&limit=${limit}&fields=${MESSAGE_FIELDS}`
    )
  );

  for (const msg of batches.flat()) {
    const cid = Number(msg.conversation_id);
    if (!result.has(cid)) result.set(cid, msg);
  }

  return result;
}

/**
 * Unread messages per conversation: messages the other party sent that this user
 * has no read receipt for. Only conversations with something unread appear.
 *
 * This replaces an unordered 1000-row sample, which for any account with more
 * traffic than that read the *oldest* messages Directus happened to return
 * first. Those are long since read, so the badge counted zero and a message that
 * arrived a minute ago never surfaced.
 *
 * Throws with a 502 rather than answering an empty map: a count that could not be
 * read is not a count of zero, and the list would otherwise render every thread
 * as fully read.
 *
 * Known limit: a thread with more than `MESSAGES_PER_CONVERSATION` unread
 * messages reports exactly that number, not the true count. Raising the window
 * costs list latency, and showing it honestly needs a "N+" badge on both
 * portals, so the cap stays and is deliberate.
 */
export async function unreadCountByConversation(
  userId: number,
  conversationIds: readonly number[]
): Promise<Map<number, number>> {
  const ids = positiveIds(conversationIds);
  if (ids.length === 0) return new Map();

  const samples = await mapPool(
    chunk(ids, CONVERSATION_BATCH),
    (batch) =>
      messageWindow(batch, MESSAGES_PER_CONVERSATION, (convIds, limit) => {
        // Newest first: an oldest-first window is almost always fully read, and
        // counting that answers 0 for a thread with a message waiting.
        const filters =
          `filter[conversation_id][_in]=${convIds.join(",")}` +
          `&filter[is_deleted][_eq]=false` +
          `&filter[sender_id][_neq]=${userId}`;
        return `${filters}&sort[]=-message_id&limit=${limit}&fields=message_id,conversation_id`;
      })
  );

  const candidates = samples.flat();
  if (candidates.length === 0) return new Map();

  const messageIds = candidates
    .map((row) => Number(row.message_id))
    .filter((id) => Number.isInteger(id) && id > 0);

  const receipts = await mapPool(
    chunk(messageIds, IN_CHUNK),
    (batch) =>
      directusItems<{ message_id: number }>("vs_message_read", {
        query:
          `filter[message_id][_in]=${batch.join(",")}` +
          `&filter[user_id][_eq]=${userId}&fields=message_id&limit=-1`,
      })
  );

  const readIds = new Set(receipts.flat().map((row) => Number(row.message_id)));

  const counts = new Map<number, number>();
  for (const row of candidates) {
    if (readIds.has(Number(row.message_id))) continue;
    const cid = Number(row.conversation_id);
    counts.set(cid, (counts.get(cid) ?? 0) + 1);
  }
  return counts;
}

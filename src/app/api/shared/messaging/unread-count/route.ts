// src/app/api/shared/messaging/unread-count/route.ts
import { NextRequest } from "next/server";
import { json } from "@/lib/server/route";
import { authenticateRequest } from "@/lib/authenticated-session";
import { DirectusError, directusItems } from "@/lib/server/directus";
import { chunk, mapPool } from "@/lib/server/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
/** Guard so a pathological account cannot turn one badge poll into an unbounded walk. */
const MAX_ROWS = 20_000;
/** Ids per `_in=` clause, kept small enough that the request URL stays valid. */
const IN_CHUNK = 200;

interface ConversationRow {
  conversation_id: number;
  client_id?: number | string | null;
  freelancer_id?: number | string | null;
  archived_by_client?: boolean | null;
  archived_by_freelancer?: boolean | null;
}

interface MessageRow {
  message_id: number;
  conversation_id: number;
}

/**
 * Walk a filtered read page by page. A single un-paginated read is capped by
 * Directus at its default of 100 rows, and the previous `limit=1000` guess
 * silently dropped everything past the first window — a conversation whose
 * oldest messages were cut never reached the unread calculation at all.
 */
async function readAllRows<T>(
  collection: string,
  filter: string,
  fields: string,
  sort: string
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const page = await directusItems<T>(collection, {
      query: `${filter}&fields=${fields}&sort[]=${sort}&limit=${PAGE_SIZE}&offset=${offset}`,
    });
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  throw new Error(`Too many ${collection} rows to count safely (${MAX_ROWS}+).`);
}

async function countUnreadConversations(userId: number): Promise<number> {
  const conversations = await readAllRows<ConversationRow>(
    "vs_conversation",
    `filter[_or][0][freelancer_id][_eq]=${userId}&filter[_or][1][client_id][_eq]=${userId}`,
    "conversation_id,client_id,freelancer_id,archived_by_client,archived_by_freelancer",
    "conversation_id"
  );

  // Directus can answer these ids as strings, which used to make both
  // comparisons below false — archived threads kept contributing to the badge.
  const activeConversations = conversations.filter((c) => {
    if (Number(c.freelancer_id) === userId && c.archived_by_freelancer) return false;
    if (Number(c.client_id) === userId && c.archived_by_client) return false;
    return true;
  });

  const conversationIds = activeConversations
    .map((c) => Number(c.conversation_id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (conversationIds.length === 0) return 0;

  const messageChunks = await mapPool(
    chunk(conversationIds, IN_CHUNK),
    (ids) =>
      readAllRows<MessageRow>(
        "vs_message",
        `filter[conversation_id][_in]=${ids.join(",")}&filter[is_deleted][_eq]=false&filter[sender_id][_neq]=${userId}`,
        "message_id,conversation_id",
        "message_id"
      )
  );
  const messages = messageChunks.flat();
  if (messages.length === 0) return 0;

  const messageIds = messages.map((m) => Number(m.message_id)).filter((id) => Number.isInteger(id) && id > 0);

  const receiptChunks = await mapPool(
    chunk(messageIds, IN_CHUNK),
    (ids) =>
      readAllRows<{ message_id: number }>(
        "vs_message_read",
        `filter[message_id][_in]=${ids.join(",")}&filter[user_id][_eq]=${userId}`,
        "message_id",
        "message_id"
      )
  );
  const readMessageIds = new Set(receiptChunks.flat().map((r) => Number(r.message_id)));

  // One badge unit per conversation that still holds something this user has not
  // opened, so a single thread with 40 new messages stays "1".
  const unreadConversations = new Set<number>();
  for (const msg of messages) {
    if (!readMessageIds.has(Number(msg.message_id))) {
      unreadConversations.add(Number(msg.conversation_id));
    }
  }

  return unreadConversations.size;
}

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) return json({ unreadCount: 0 });

    const userId = Number(session.userId);
    if (!Number.isInteger(userId) || userId <= 0) return json({ unreadCount: 0 });

    return json({ unreadCount: await countUnreadConversations(userId) });
  } catch (err) {
    // Answering 0 here cleared a badge that still had messages waiting; the
    // sidebar keeps the previous count when the request fails instead.
    console.error("[GET /api/shared/messaging/unread-count]", err);
    return json(
      { error: "The unread count could not be calculated." }, err instanceof DirectusError ? 502 : 500);
  }
}

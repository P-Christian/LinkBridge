// src/lib/messaging/transport/rest.ts
//
// Serialisation boundary between the messaging routes and the browser. JSON is
// the default; protobuf is opted into per deployment with
// MESSAGING_TRANSPORT=protobuf. This is a format choice only — protobuf is not
// encryption, and an authenticated user who controls the browser can still
// recover these fields.

import { create, toBinary } from "@bufbuild/protobuf";
import { ConversationListResponseSchema } from "@/lib/messaging/protobuf/generated/conversation.v1_pb";

export const PROTOBUF_CONTENT_TYPE = "application/protobuf";

export function protobufTransportEnabled(): boolean {
  return process.env.MESSAGING_TRANSPORT === "protobuf";
}

/**
 * A cookie-authenticated response is never cacheable, whichever format it is in.
 * JSON responses get `no-store` from `json()`; this is the header set for the
 * protobuf path so the two formats cannot drift apart.
 */
export function protobufHeaders(): HeadersInit {
  return {
    "Content-Type": PROTOBUF_CONTENT_TYPE,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

/**
 * An encoded list of zero conversations serialises to an empty buffer, so a
 * caller that tests the buffer instead of the header would read "no data" where
 * the server sent "no rows". Callers must go through this.
 */
export function protobufResponse(bytes: Uint8Array): Response {
  // The ArrayBuffer slice is the body: Uint8Array<ArrayBufferLike> is not a
  // BodyInit, and a plain `.buffer` can be wider than this view.
  return new Response(bytes.slice().buffer, {
    status: 200,
    headers: protobufHeaders(),
  });
}

type Row = Record<string, unknown>;

/** Empty and absent are the same wire state; the decoder restores the JSON shape. */
function str(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * The wire contract is deliberately narrower than the JSON body: server-side
 * authorization columns (client_id, job_id, status, archived_by_freelancer,
 * archived_at, created_at, updated_at) are never published. Adding a field here
 * means adding it to `decodeConversationList` in ./client.ts in the same change.
 */
export function encodeConversationList(rows: Row[]): Uint8Array {
  return toBinary(
    ConversationListResponseSchema,
    create(ConversationListResponseSchema, {
      conversations: rows.map((row) => ({
        conversationId: Number(row.conversation_id) || 0,
        freelancerId: Number(row.freelancer_id) || 0,
        conversationType: str(row.conversation_type) ?? "",
        archivedByClient: Boolean(row.archived_by_client),
        unreadCount: Number(row.unread_count) || 0,
        lastMessageAt: str(row.last_message_at),
        lastMessagePreview: str(row.last_message_preview),
        otherPartyName: str(row.other_party_name),
        otherPartyAvatar: str(row.other_party_avatar),
        otherPartyEmail: str(row.other_party_email),
        jobTitle: str(row.job_title),
      })),
    })
  );
}

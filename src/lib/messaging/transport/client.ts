// src/lib/messaging/transport/client.ts
//
// The browser side of the messaging transport. The format is read from the
// response's Content-Type, never from an assumption about how the app was
// deployed, so JSON and protobuf responses can be served side by side and a
// rollback is a single environment-variable change.
//
// This module must not import ./rest.ts — that one reads server-only env.

import { fromBinary } from "@bufbuild/protobuf";
import { ConversationListResponseSchema } from "@/lib/messaging/protobuf/generated/conversation.v1_pb";

const PROTOBUF_CONTENT_TYPE = "application/protobuf";

type ProtoString = string | undefined;

/** Restores the JSON shape: absent optional strings were null or "" on the wire. */
function fromProto(value: ProtoString, absent: string | null): string | null {
  return value === undefined ? absent : value;
}

function decodeConversationList(bytes: Uint8Array) {
  const list = fromBinary(ConversationListResponseSchema, bytes);
  return {
    conversations: list.conversations.map((conv) => ({
      conversation_id: conv.conversationId,
      freelancer_id: conv.freelancerId,
      conversation_type: conv.conversationType,
      archived_by_client: conv.archivedByClient,
      unread_count: conv.unreadCount,
      last_message_at: fromProto(conv.lastMessageAt, null),
      last_message_preview: fromProto(conv.lastMessagePreview, ""),
      other_party_name: fromProto(conv.otherPartyName, null),
      other_party_avatar: fromProto(conv.otherPartyAvatar, null),
      other_party_email: fromProto(conv.otherPartyEmail, null),
      job_title: fromProto(conv.jobTitle, null),
    })),
  };
}

/**
 * Decodes the conversation-list response in whichever format the server chose.
 * Every other messaging route still returns JSON, so only the list fetch calls
 * this; callers that keep using `res.json()` are unaffected.
 */
export async function parseConversationsResponse(res: Response): Promise<{
  conversations?: Record<string, unknown>[];
  error?: string;
}> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes(PROTOBUF_CONTENT_TYPE)) {
    return res.json();
  }
  return decodeConversationList(new Uint8Array(await res.arrayBuffer()));
}

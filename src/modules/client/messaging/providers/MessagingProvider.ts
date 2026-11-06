// src/modules/client/messaging/providers/MessagingProvider.ts

import {
  Conversation,
  Message,
  MessageReactionGroup,
  CreateConversationPayload,
  SendMessagePayload,
} from "../types";
import { parseConversationsResponse } from "@/lib/messaging/transport/client";

const BASE = "/api/client/messaging";

// ─── Fetch conversations ───────────────────────────────────────────────────

export async function fetchConversations(params?: {
  archived?: boolean;
}): Promise<Conversation[]> {
  const qs = params?.archived ? "?archived=true" : "";
  const res = await fetch(`${BASE}${qs}`, { cache: "no-store" });
  const json = await parseConversationsResponse(res);
  if (!res.ok) throw new Error(json.error ?? "Failed to fetch conversations.");
  // The wire rows are untyped under either format, exactly as `res.json()` left
  // them: the protobuf path ships only the fields the conversation UI reads.
  return (json.conversations ?? []) as unknown as Conversation[];
}

// ─── Create or get conversation ────────────────────────────────────────────

export async function createConversation(
  payload: CreateConversationPayload
): Promise<{ conversation: Conversation; created: boolean }> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to create conversation.");
  return json;
}

// ─── Fetch messages ────────────────────────────────────────────────────────

export async function fetchMessages(
  conversationId: number,
  params?: { limit?: number; offset?: number }
): Promise<{ messages: Message[]; warnings: string[] }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));

  const res = await fetch(
    `${BASE}/${conversationId}/messages${qs.toString() ? `?${qs}` : ""}`,
    { cache: "no-store" }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to fetch messages.");
  // A 200 with warnings means part of the thread could not be loaded — the
  // message list itself is still valid, so both must reach the caller.
  return {
    messages: Array.isArray(json.messages) ? (json.messages as Message[]) : [],
    warnings: Array.isArray(json.warnings) ? (json.warnings as string[]) : [],
  };
}

// ─── Send message ──────────────────────────────────────────────────────────

export async function sendMessage(
  conversationId: number,
  payload: SendMessagePayload
): Promise<{ message: Message; warnings: string[] }> {
  const res = await fetch(`${BASE}/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to send message.");
  // Parts of a send can fail after the message row is committed (attachments,
  // the conversation preview). The server reports those as warnings on a 201.
  return {
    message: json.message as Message,
    warnings: Array.isArray(json.warnings) ? (json.warnings as string[]) : [],
  };
}

// ─── Archive conversation ──────────────────────────────────────────────────

export async function archiveConversation(
  conversationId: number,
  archive: boolean
): Promise<void> {
  const res = await fetch(`${BASE}/${conversationId}/archive`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archive }),
  });
  const json = await res.json();
  if (!res.ok)
    throw new Error(json.error ?? "Failed to archive conversation.");
}

// ─── Upload file ───────────────────────────────────────────────────────────

export async function uploadFile(file: File): Promise<{
  file_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
}> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE}/upload`, {
    method: "POST",
    body: formData,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to upload file.");
  return json;
}

// ─── Toggle message reaction ───────────────────────────────────────────────

export async function toggleReaction(
  messageId: number,
  reaction: string
): Promise<{ reactions: MessageReactionGroup[] | null; warning: string | null }> {
  const res = await fetch(`/api/shared/messaging/messages/${messageId}/reactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reaction }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to toggle reaction.");
  // null = the write landed but the server could not re-read the list. Treating
  // that as [] would erase every other reaction from the bubble.
  return {
    reactions: Array.isArray(json.reactions) ? json.reactions : null,
    warning: typeof json.warning === "string" ? json.warning : null,
  };
}

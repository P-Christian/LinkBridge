"use client";

// src/modules/freelancer/freelancer-messaging/hooks/useMessages.ts

import { useCallback, useState, useEffect, useRef } from "react";
import { CelebrationEvent, Message, SendMessagePayload } from "../types";
import {
  fetchMessages,
  sendMessage,
  uploadFile,
  toggleReaction,
} from "../providers/MessagingProvider";
import { getPHTimeString } from "@/lib/utils";
import { useRealtime } from "@/modules/shared/providers/RealtimeProvider";
import { toast } from "sonner";

function parseLocalDateMs(dateStr: string): number {
  if (!dateStr) return 0;
  const [datePart = "", timePart = "00:00:00"] = dateStr.replace("T", " ").split(" ");
  const [year = 1970, month = 1, day = 1] = datePart.split("-").map(Number);
  const [hour = 0, minute = 0, second = 0] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, second).getTime();
}

function sortChronologically(list: Message[]): Message[] {
  return [...list].sort((a, b) => parseLocalDateMs(a.created_at) - parseLocalDateMs(b.created_at));
}

let tempIdCounter = 0;
function getNextTempId(): number {
  tempIdCounter = (tempIdCounter + 1) % 1000;
  return -(Date.now() * 1000 + tempIdCounter);
}

export function useMessages(currentUserId: number = 0) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const activeConversationIdRef = useRef<number | null>(null);
  const sendingRef = useRef<Set<number>>(new Set());
  // ChatPanel's jump-to-message loop keeps calling the same callback instance for
  // the whole loop, so a guard or a paging cursor read from render state would
  // re-see the values from the render that created it: every iteration would
  // pass the guard and request the same offset.
  const loadingOlderRef = useRef(false);
  const hasMoreRef = useRef(true);
  const fetchedCountRef = useRef(0);
  const authoritativeReactionsRef = useRef<
    Map<number, { reactions: Message["reactions"]; timestamp: number }>
  >(new Map());
  const pendingPayloadsRef = useRef<
    Map<number, { conversationId: number; payload: SendMessagePayload }>
  >(new Map());

  const resolveReactions = useCallback(
    (messageId: number, serverReactions?: Message["reactions"]): Message["reactions"] => {
      const auth = authoritativeReactionsRef.current.get(messageId);
      if (!auth) return serverReactions ?? [];
      if (Date.now() - auth.timestamp < 30000) {
        const serverHasMyReaction = serverReactions?.some((r) => r.reacted_by_me);
        const authHasMyReaction = auth.reactions?.some((r) => r.reacted_by_me);
        if (authHasMyReaction && !serverHasMyReaction) {
          return auth.reactions;
        }
        if (!authHasMyReaction && serverHasMyReaction) {
          return auth.reactions;
        }
      }
      return serverReactions ?? [];
    },
    []
  );

  const { subscribe } = useRealtime();

  useEffect(() => {
    const unsubscribe = subscribe("vs_messages", ({ event, data }) => {
      if (event === "create" && data && data.length > 0) {
        data.forEach((item) => {
          const rawMsg = item as unknown as Message;
          if (!rawMsg.attachments) rawMsg.attachments = [];
          if (!rawMsg.reactions) rawMsg.reactions = [];
          const currentConvId = activeConversationIdRef.current;
          if (currentConvId && Number(rawMsg.conversation_id) === currentConvId) {
            setMessages((prev) => {
              if (prev.some((m) => m.message_id === rawMsg.message_id)) return prev;
              return sortChronologically([...prev, rawMsg]);
            });
          }
        });

        // Background-refresh to populate attachments, reactions, or system card metadata
        const activeId = activeConversationIdRef.current;
        if (activeId) {
          fetchMessages(activeId, { limit: 50, offset: 0 })
            .then((result) => {
              const latestMessages = result.messages;
              if (latestMessages && latestMessages.length > 0) {
                setMessages((prev) => {
                  const map = new Map<number, Message>();
                  for (const p of prev) map.set(p.message_id, p);
                  for (const m of latestMessages) {
                    map.set(m.message_id, {
                      ...m,
                      reactions: resolveReactions(m.message_id, m.reactions),
                    });
                  }
                  return sortChronologically(Array.from(map.values()));
                });
              }
            })
            .catch(() => {});
        }
      } else {
        // Polling tick or generic update event — fetch latest messages for active conversation
        const activeId = activeConversationIdRef.current;
        if (activeId) {
          fetchMessages(activeId, { limit: 50, offset: 0 })
            .then((result) => {
              const latestMessages = result.messages;
              if (latestMessages && latestMessages.length > 0) {
                setMessages((prev) => {
                  const map = new Map<number, Message>();
                  for (const p of prev) map.set(p.message_id, p);
                  let hasChanges = false;
                  for (const m of latestMessages) {
                    const existing = map.get(m.message_id);
                    const finalReactions = resolveReactions(m.message_id, m.reactions);
                    if (!existing) {
                      map.set(m.message_id, { ...m, reactions: finalReactions });
                      hasChanges = true;
                    } else {
                      const reactionsChanged =
                        JSON.stringify(existing.reactions) !== JSON.stringify(finalReactions);
                      if (reactionsChanged) {
                        map.set(m.message_id, { ...existing, reactions: finalReactions });
                        hasChanges = true;
                      }
                    }
                  }
                  if (!hasChanges) return prev;
                  return sortChronologically(Array.from(map.values()));
                });
              }
            })
            .catch(() => {});
        }
      }
    });

    return () => unsubscribe();
  }, [subscribe]);

  const loadMessages = useCallback(async (conversationId: number) => {
    activeConversationIdRef.current = conversationId;
    authoritativeReactionsRef.current.clear();
    setLoading(true);
    setError("");
    setHasMore(true);
    hasMoreRef.current = true;
    fetchedCountRef.current = 0;
    // Clicking through the list fires one request per thread and they can land
    // out of order, so only the thread the panel is actually showing may write
    // to it — otherwise the user reads and replies in the wrong conversation.
    const isCurrent = () => activeConversationIdRef.current === conversationId;
    try {
      const result = await fetchMessages(conversationId, { limit: 50, offset: 0 });
      if (!isCurrent()) return;
      setError("");
      setMessages(sortChronologically(result.messages));
      if (result.celebration) {
        setCelebration(result.celebration);
      }
      setHasMore(result.messages.length >= 50);
      hasMoreRef.current = result.messages.length >= 50;
      fetchedCountRef.current = result.messages.length;
    } catch (err: unknown) {
      if (!isCurrent()) return;
      const msg = err instanceof Error ? err.message : "Failed to load messages.";
      setError(msg);
      toast.error(msg);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  const loadOlderMessages = useCallback(async (conversationId: number) => {
    if (loadingOlderRef.current || !hasMoreRef.current) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    setError("");
    try {
      // Count only rows the server actually returned: the message list also
      // carries optimistic sends (negative ids) and socket pushes, and paging
      // off that length skips over real history.
      const currentOffset = fetchedCountRef.current;
      const result = await fetchMessages(conversationId, { limit: 50, offset: currentOffset });
      if (activeConversationIdRef.current !== conversationId) return;
      const olderData = result.messages;
      if (olderData.length === 0) {
        hasMoreRef.current = false;
        setHasMore(false);
      } else {
        fetchedCountRef.current = currentOffset + olderData.length;
        setMessages((prev) => {
          const combined = [...olderData, ...prev];
          const map = new Map<number, Message>();
          for (const m of combined) map.set(m.message_id, m);
          return sortChronologically(Array.from(map.values()));
        });
        hasMoreRef.current = olderData.length >= 50;
        setHasMore(olderData.length >= 50);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load older messages.";
      setError(msg);
      toast.error(msg);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, []);

  const refreshMessages = useCallback(
    async (conversationId: number) => {
      setError("");
      try {
        const result = await fetchMessages(conversationId, { limit: 50, offset: 0 });
        if (activeConversationIdRef.current !== conversationId) return;
        setError("");
        // Merge rather than replace: a refresh after a reaction or a send must
        // not drop the older pages the user scrolled back through, nor the
        // messages still marked sending or failed. Server rows win on conflict.
        setMessages((prev) => {
          const byId = new Map<number, Message>();
          for (const p of prev) byId.set(p.message_id, p);
          for (const m of result.messages) {
            byId.set(m.message_id, {
              ...m,
              reactions: resolveReactions(m.message_id, m.reactions),
            });
          }
          return sortChronologically(Array.from(byId.values()));
        });
        // A refresh re-reads only the newest page: a short page proves there is
        // nothing older, but a full one cannot prove there is.
        if (result.messages.length < 50) {
          hasMoreRef.current = false;
          setHasMore(false);
        }
      } catch (err: unknown) {
        if (activeConversationIdRef.current !== conversationId) return;
        const msg = err instanceof Error ? err.message : "Failed to refresh messages.";
        setError(msg);
        toast.error(msg);
      }
    },
    []
  );

  // ─── Send message with up to 5 retries ────────────────────────────────
  const executeSendWithRetry = useCallback(
    async (
      tempId: number,
      conversationId: number,
      payload: SendMessagePayload
    ): Promise<boolean> => {
      setError("");

      // Two loops for one message would insert two vs_message rows — the
      // recipient reads the same text twice. The Retry button only appears once
      // the loop gives up, but a double click lands both before the state
      // commits, so the guard has to be a ref rather than rendered output.
      if (sendingRef.current.has(tempId)) return false;
      sendingRef.current.add(tempId);

      const MAX_RETRIES = 5;
      let attempts = 0;
      let successMsg: Message | null = null;
      let lastError: unknown = null;

      try {
        while (attempts <= MAX_RETRIES) {
          try {
            successMsg = await sendMessage(conversationId, payload);
            break;
          } catch (err) {
            lastError = err;
            const errMsg = err instanceof Error ? err.message : String(err);
            // If error is permission or privilege suspension, fail immediately
            // without useless retries
            if (
              errMsg.includes("suspended") ||
              errMsg.includes("privilege") ||
              errMsg.includes("Forbidden") ||
              errMsg.includes("restricted") ||
              errMsg.includes("not allowed")
            ) {
              break;
            }
            attempts++;
            if (attempts <= MAX_RETRIES) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        }
      } finally {
        sendingRef.current.delete(tempId);
      }

      if (successMsg) {
        const finalMsg = successMsg;
        pendingPayloadsRef.current.delete(tempId);
        setMessages((prev) => {
          // A retry loop can outlive the thread it was sent from (switching
          // conversation replaces the list). Without this, the confirmed send
          // is appended to whatever conversation is now on screen.
          if (activeConversationIdRef.current !== conversationId) return prev;
          // Filter out finalMsg if realtime already inserted it to avoid duplicates
          const filtered = prev.filter((m) => m.message_id !== finalMsg.message_id);
          const idx = filtered.findIndex((m) => m.message_id === tempId);
          if (idx !== -1) {
            const next = [...filtered];
            const prevMsg = filtered[idx];
            next[idx] = {
              ...prevMsg,
              ...finalMsg,
              reply_to: finalMsg.reply_to ?? prevMsg.reply_to ?? null,
              delivery_status: "sent",
            };
            return sortChronologically(next);
          }
          return sortChronologically([...filtered, { ...finalMsg, delivery_status: "sent" }]);
        });

        // Hide "sent" status after 2 seconds
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.message_id === finalMsg.message_id && m.delivery_status === "sent"
                ? { ...m, delivery_status: undefined }
                : m
            )
          );
        }, 2000);

        return true;
      } else {
        // All 5 retries failed
        setMessages((prev) =>
          prev.map((m) =>
            m.message_id === tempId
              ? { ...m, delivery_status: "failed" }
              : m
          )
        );
        const msg = lastError instanceof Error ? lastError.message : "Failed to send message.";
        setError(msg);
        if (
          msg.includes("suspended") ||
          msg.includes("privilege") ||
          msg.includes("Forbidden") ||
          msg.includes("restricted") ||
          msg.includes("not allowed")
        ) {
          toast.error(msg);
        } else {
          toast.error("Failed to send message after 5 retries.");
        }
        return false;
      }
    },
    []
  );

  const send = useCallback(
    async (
      conversationId: number,
      payload: SendMessagePayload
    ): Promise<boolean> => {
      const tempId = getNextTempId();
      // The optimistic row is sorted against server rows by parseLocalDateMs(),
      // which reads the stored PH wall clock as if it were local. A browser
      // outside UTC+8 would date its own message hours off and drop it into the
      // middle of the history it just sent.
      const nowPH = getPHTimeString();
      const repliedMsg = payload.reply_to_message_id
        ? messages.find((m) => m.message_id === payload.reply_to_message_id)
        : null;
      const optimisticReplyTo = repliedMsg
        ? {
            message_id: repliedMsg.message_id,
            sender_id: repliedMsg.sender_id,
            sender_name: repliedMsg.sender_id === currentUserId ? "You" : null,
            message_content:
              repliedMsg.message_content ||
              repliedMsg.attachments?.[0]?.file_name ||
              "Attachment",
            message_type: repliedMsg.message_type,
            attachments: repliedMsg.attachments,
          }
        : null;

      const optimisticMsg: Message = {
        message_id: tempId,
        conversation_id: conversationId,
        sender_id: currentUserId,
        message_type: payload.message_type ?? "TEXT",
        message_content: payload.message_content ?? null,
        reply_to_message_id: payload.reply_to_message_id ?? null,
        reply_to: optimisticReplyTo,
        is_edited: false,
        edited_at: null,
        created_at: nowPH,
        is_deleted: false,
        attachments: (payload.attachments ?? []).map((att, i) => ({
          attachment_id: -i - 1,
          message_id: tempId,
          file_name: att.file_name,
          file_path: att.file_path,
          file_size: att.file_size ?? null,
          mime_type: att.mime_type ?? null,
          created_at: nowPH,
        })),
        delivery_status: "sending",
      };

      pendingPayloadsRef.current.set(tempId, { conversationId, payload });
      setMessages((prev) => sortChronologically([...prev, optimisticMsg]));

      // Execute retry loop in background
      void executeSendWithRetry(tempId, conversationId, payload);
      return true;
    },
    [currentUserId, executeSendWithRetry, messages]
  );

  const retry = useCallback(
    async (messageId: number): Promise<boolean> => {
      const entry = pendingPayloadsRef.current.get(messageId);
      if (!entry) return false;

      setMessages((prev) =>
        prev.map((m) =>
          m.message_id === messageId ? { ...m, delivery_status: "sending" } : m
        )
      );

      return executeSendWithRetry(messageId, entry.conversationId, entry.payload);
    },
    [executeSendWithRetry]
  );

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const result = await uploadFile(file);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload file.";
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  const toggleMessageReaction = useCallback(
    async (messageId: number, reaction: string) => {
      // Optimistic update
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.message_id !== messageId) return msg;
          const currentReactions = msg.reactions ?? [];

          // Remove any other reaction currently reacted by me
          let nextReactions = currentReactions
            .map((r) => {
              if (r.reacted_by_me && r.reaction !== reaction) {
                return { ...r, count: r.count - 1, reacted_by_me: false };
              }
              return r;
            })
            .filter((r) => r.count > 0);

          const existingTarget = nextReactions.find(
            (r) => r.reaction === reaction
          );

          if (existingTarget) {
            if (existingTarget.reacted_by_me) {
              // Toggled off same emoji
              if (existingTarget.count <= 1) {
                nextReactions = nextReactions.filter(
                  (r) => r.reaction !== reaction
                );
              } else {
                nextReactions = nextReactions.map((r) =>
                  r.reaction === reaction
                    ? {
                        ...r,
                        count: r.count - 1,
                        reacted_by_me: false,
                      }
                    : r
                );
              }
            } else {
              // Switched to this emoji
              nextReactions = nextReactions.map((r) =>
                r.reaction === reaction
                  ? {
                      ...r,
                      count: r.count + 1,
                      reacted_by_me: true,
                    }
                  : r
              );
            }
          } else {
            // New emoji selected
            nextReactions.push({
              reaction,
              count: 1,
              reacted_by_me: true,
              users: [],
            });
          }

          authoritativeReactionsRef.current.set(messageId, {
            reactions: nextReactions,
            timestamp: Date.now(),
          });

          return {
            ...msg,
            reactions: nextReactions,
          };
        })
      );

      try {
        const result = await toggleReaction(messageId, reaction);
        if (result.warning) toast.warning(result.warning);
        if (result.reactions !== null) {
          authoritativeReactionsRef.current.set(messageId, {
            reactions: result.reactions,
            timestamp: Date.now(),
          });
          const updatedReactions = result.reactions;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.message_id === messageId
                ? { ...msg, reactions: updatedReactions }
                : msg
            )
          );
        }
      } catch (err: unknown) {
        authoritativeReactionsRef.current.delete(messageId);
        const activeId = activeConversationIdRef.current;
        if (activeId) {
          fetchMessages(activeId, { limit: 50, offset: 0 })
            .then((result) => {
              const latest = result?.messages;
              if (!latest) return;
              if (activeConversationIdRef.current !== activeId) return;
              // Merge, like refreshMessages: this rollback only re-reads the
              // newest page, so replacing state would drop the older pages the
              // user scrolled back through and anything still marked sending.
              setMessages((prev) => {
                const byId = new Map<number, Message>();
                for (const m of prev) byId.set(m.message_id, m);
                for (const m of latest) byId.set(m.message_id, m);
                return sortChronologically(Array.from(byId.values()));
              });
            })
            .catch(() => {});
        }
        const msg = err instanceof Error ? err.message : "Failed to update reaction.";
        setError(msg);
        toast.error(msg);
      }
    },
    []
  );

  // Listen for programmatic celebration triggers (e.g. from HiredCard)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleTrigger = (e: Event) => {
      const customEvent = e as CustomEvent<CelebrationEvent>;
      if (customEvent.detail) {
        setCelebration(customEvent.detail);
      }
    };
    window.addEventListener("vos:trigger-celebration", handleTrigger);
    return () => {
      window.removeEventListener("vos:trigger-celebration", handleTrigger);
    };
  }, []);

  const clearMessages = useCallback(() => {
    // Closing a thread must stop the realtime/polling handler from refetching it:
    // the messages GET also writes read receipts, so a stale ref marks messages
    // read in a conversation the user is no longer looking at.
    activeConversationIdRef.current = null;
    hasMoreRef.current = true;
    fetchedCountRef.current = 0;
    setMessages([]);
    setError("");
    setHasMore(true);
    setCelebration(null);
  }, []);

  const dismissCelebration = useCallback(() => {
    setCelebration(null);
  }, []);

  const triggerCelebration = useCallback((event: CelebrationEvent) => {
    setCelebration(event);
  }, []);

  // ─── Delete message (Optimistic) ────────────────────────────────────────

  const deleteMessage = useCallback(
    async (messageId: number): Promise<boolean> => {
      let previousMessage: Message | undefined;

      // Optimistic update: mark message as removed in the local thread
      setMessages((prev) => {
        previousMessage = prev.find((m) => m.message_id === messageId);
        if (!previousMessage) return prev;
        return prev.map((msg) =>
          msg.message_id === messageId
            ? {
                ...msg,
                is_deleted: true,
                message_content: null,
                attachments: [],
                is_pinned: false,
              }
            : msg
        );
      });

      try {
        const res = await fetch(`/api/shared/messaging/messages/${messageId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Failed to remove message");
        }
        toast.success("Message removed.", { id: `delete-msg-fl-${messageId}`, duration: 2500 });
        return true;
      } catch (err: unknown) {
        // Rollback on failure
        if (previousMessage) {
          const prevMsg = previousMessage;
          setMessages((prev) =>
            prev.map((msg) => (msg.message_id === messageId ? prevMsg : msg))
          );
        }
        const errorMsg = err instanceof Error ? err.message : "Failed to remove message.";
        setError(errorMsg);
        toast.error(errorMsg);
        return false;
      }
    },
    []
  );

  // ─── Toggle pin (Optimistic) ───────────────────────────────────────────

  const togglePin = useCallback(
    async (messageId: number): Promise<boolean> => {
      let previousPinned: boolean | undefined;

      // Optimistic update
      setMessages((prev) => {
        const target = prev.find((m) => m.message_id === messageId);
        if (!target) return prev;
        previousPinned = Boolean(target.is_pinned);
        return prev.map((msg) =>
          msg.message_id === messageId
            ? { ...msg, is_pinned: !previousPinned }
            : msg
        );
      });

      try {
        const res = await fetch(`/api/shared/messaging/messages/${messageId}/pin`, {
          method: "POST",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Failed to update pin status");
        }
        const data = await res.json();
        toast.success(data.is_pinned ? "Message pinned." : "Message unpinned.", {
          id: `pin-${messageId}`,
          duration: 2500,
        });
        return true;
      } catch (err: unknown) {
        // Rollback on failure
        if (previousPinned !== undefined) {
          const revertVal = previousPinned;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.message_id === messageId ? { ...msg, is_pinned: revertVal } : msg
            )
          );
        }
        const errorMsg = err instanceof Error ? err.message : "Failed to update pin status.";
        setError(errorMsg);
        toast.error(errorMsg);
        return false;
      }
    },
    []
  );

  return {
    messages,
    celebration,
    dismissCelebration,
    triggerCelebration,
    loading,
    loadingOlder,
    hasMore,
    uploading,
    error,
    loadMessages,
    loadOlderMessages,
    refreshMessages,
    send,
    retry,
    upload,
    deleteMessage,
    togglePin,
    toggleReaction: toggleMessageReaction,
    clearMessages,
    clearError: () => setError(""),
  };
}

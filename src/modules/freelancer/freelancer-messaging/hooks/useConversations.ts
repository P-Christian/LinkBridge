"use client";

// src/modules/freelancer/freelancer-messaging/hooks/useConversations.ts

import { useCallback, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Conversation } from "../types";
import {
  fetchConversations,
  archiveConversation,
} from "../providers/MessagingProvider";
import { useRealtime } from "@/modules/shared/providers/RealtimeProvider";
import { useRequestAbort } from "@/hooks/useRequestAbort";

export function useConversations(activeConversationId?: number | null) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { subscribe } = useRealtime();
  const abortRead = useRequestAbort();

  const archivedFilterRef = useRef(false);
  const activeConversationIdRef = useRef<number | null>(activeConversationId ?? null);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId ?? null;
    if (activeConversationId) {
      const raf = requestAnimationFrame(() => {
        setConversations((prev) =>
          prev.map((c) =>
            c.conversation_id === activeConversationId
              ? { ...c, unread_count: 0 }
              : c
          )
        );
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [activeConversationId]);

  const normalizeConversations = useCallback((data: Conversation[]): Conversation[] => {
    const activeId = activeConversationIdRef.current;
    if (!activeId) return data;
    return data.map((c) =>
      c.conversation_id === activeId ? { ...c, unread_count: 0 } : c
    );
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe("vs_messages", () => {
      fetchConversations({ archived: archivedFilterRef.current })
        .then((data) => {
          if (data) setConversations(normalizeConversations(data));
        })
        .catch(() => {});
    });
    return () => unsubscribe();
  }, [subscribe, normalizeConversations]);

  const loadConversations = useCallback(
    async (opts?: { archived?: boolean; silent?: boolean }) => {
      archivedFilterRef.current = opts?.archived ?? false;
      if (!opts?.silent) setLoading(true);
      setError("");
      // Toggling the archive tab fires a second read; whichever was started
      // last owns the list, or the archived thread list can render under the
      // active tab (and vice versa).
      const signal = abortRead();
      try {
        const data = await fetchConversations(opts);
        if (signal.aborted) return;
        setConversations(normalizeConversations(data));
      } catch (err: unknown) {
        if (signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Failed to load conversations.";
        setError(msg);
        if (!opts?.silent) toast.error(msg);
      } finally {
        if (!opts?.silent && !signal.aborted) setLoading(false);
      }
    },
    [normalizeConversations, abortRead]
  );

  const archive = useCallback(
    async (conversationId: number, doArchive: boolean): Promise<boolean> => {
      setError("");
      try {
        await archiveConversation(conversationId, doArchive);
        setConversations((prev) =>
          prev.filter((c) => c.conversation_id !== conversationId)
        );
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error
          ? err.message
          : "Failed to archive conversation.";
        setError(msg);
        toast.error(msg);
        return false;
      }
    },
    []
  );

  const clearUnreadCount = useCallback((conversationId: number) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.conversation_id === conversationId
          ? { ...c, unread_count: 0 }
          : c
      )
    );
  }, []);

  // Optimistic sidebar preview — no fetch, no skeleton
  const updateConversationPreview = useCallback(
    (conversationId: number, preview: string, sentAt: string) => {
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.conversation_id === conversationId
            ? { ...c, last_message_preview: preview, last_message_at: sentAt }
            : c
        );
        // Float the updated conversation to the top
        const idx = updated.findIndex((c) => c.conversation_id === conversationId);
        if (idx > 0) {
          const [item] = updated.splice(idx, 1);
          updated.unshift(item);
        }
        return updated;
      });
    },
    []
  );

  return {
    conversations,
    loading,
    error,
    loadConversations,
    clearUnreadCount,
    updateConversationPreview,
    archive,
    clearError: () => setError(""),
  };
}

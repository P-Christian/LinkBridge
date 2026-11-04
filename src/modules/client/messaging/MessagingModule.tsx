"use client";

// src/modules/client/messaging/MessagingModule.tsx

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useConversations } from "./hooks/useConversations";
import { useMessages } from "./hooks/useMessages";
import ConversationList from "./components/ConversationList";
import ChatPanel from "./components/ChatPanel";
import EmptyState from "./components/EmptyState";
import { Conversation } from "./types";
import { cn } from "@/lib/utils";
import CompanyVerificationGuard from "../components/CompanyVerificationGuard";

// TODO: point this at your real "Applicants" route
const APPLICANTS_HREF = "/client/applicants";

interface Props {
  currentUserId: number;
  /** Optional: auto-open a conversation with this freelancer on mount */
  initialFreelancerId?: number;
  initialJobId?: number;
}

export default function MessagingModule({
  currentUserId,
  initialFreelancerId,
  initialJobId,
}: Props) {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [unreadAtOpen, setUnreadAtOpen] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const {
    conversations,
    loading: convsLoading,
    loadFailed: convsLoadFailed,
    loadConversations,
    openOrCreateConversation,
    clearUnreadCount,
    updateConversationPreview,
    archive,
  } = useConversations(activeConversation?.conversation_id ?? null);

  const {
    messages,
    loading: msgsLoading,
    loadingOlder,
    hasMore,
    uploading,
    error: msgsError,
    loadMessages,
    loadOlderMessages,
    refreshMessages,
    send,
    retry,
    upload,
    deleteMessage,
    togglePin,
    toggleReaction,
    clearMessages,
  } = useMessages(currentUserId);
  const [toast, setToast] = useState<{ text: string; onUndo?: () => void } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoOpenedRef = useRef<number | null>(null);

  const unreadConversations = conversations.filter((c) => (c.unread_count ?? 0) > 0).length;

  // ─── Toast ──────────────────────────────────────────────────────────────────

  const showToast = useCallback((text: string, onUndo?: () => void) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ text, onUndo });
    toastTimerRef.current = setTimeout(() => setToast(null), 6000);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  // ─── Loading ────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadConversations({ archived: showArchived });
  }, [loadConversations, showArchived]);

  const openConversation = useCallback(
    (conv: Conversation) => {
      setUnreadAtOpen(conv.unread_count ?? 0);
      clearUnreadCount(conv.conversation_id);
      clearMessages();
      setActiveConversation({ ...conv, unread_count: 0 });
      loadMessages(conv.conversation_id);
      setMobileShowChat(true);
    },
    [clearUnreadCount, clearMessages, loadMessages]
  );

  // Auto-open once per freelancer (the ref stops it re-firing when convsLoading flips)
  useEffect(() => {
    if (!initialFreelancerId || convsLoading) return;
    if (autoOpenedRef.current === initialFreelancerId) return;
    autoOpenedRef.current = initialFreelancerId;

    openOrCreateConversation({
      freelancer_id: initialFreelancerId,
      job_id: initialJobId ?? null,
      conversation_type: initialJobId ? "JOB_APPLICATION" : "DIRECT_MESSAGE",
    }).then((conv) => {
      if (conv) openConversation(conv);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFreelancerId, initialJobId, convsLoading]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleSelectConversation = useCallback(
    (conv: Conversation) => {
      if (activeConversation?.conversation_id === conv.conversation_id) {
        clearUnreadCount(conv.conversation_id);
        setMobileShowChat(true);
        return;
      }
      openConversation(conv);
    },
    [activeConversation, clearUnreadCount, openConversation]
  );

  const handleRefreshConversations = useCallback(() => {
    loadConversations({ archived: showArchived });
  }, [loadConversations, showArchived]);

  const handleRefreshMessages = useCallback(() => {
    if (activeConversation) refreshMessages(activeConversation.conversation_id);
  }, [activeConversation, refreshMessages]);

  const handleCloseConversation = useCallback(() => {
    setActiveConversation(null);
    clearMessages();
    setMobileShowChat(false);
  }, [clearMessages]);

  // FIX: the old handler ignored `nextArchived` and always archived, so "Unarchive" did nothing.
  const handleArchive = useCallback(
    async (conversationId: number, nextArchived: boolean) => {
      const ok = await archive(conversationId, nextArchived);
      if (!ok) return;
      if (activeConversation?.conversation_id === conversationId) handleCloseConversation();
      loadConversations({ archived: showArchived, silent: true });

      showToast(
        nextArchived ? "Conversation archived" : "Moved back to your inbox",
        async () => {
          setToast(null);
          await archive(conversationId, !nextArchived);
          loadConversations({ archived: showArchived, silent: true });
        }
      );
    },
    [archive, activeConversation, handleCloseConversation, loadConversations, showArchived, showToast]
  );

  const handleSend = useCallback(
    async (content: string, files: File[], replyToMessageId?: number): Promise<boolean> => {
      if (!activeConversation) return false;

      let attachments: {
        file_name: string;
        file_path: string;
        file_size: number;
        mime_type: string;
      }[] = [];

      if (files.length > 0) {
        const uploaded = await Promise.all(files.map((f) => upload(f)));
        // FIX: previously a failed upload was silently dropped and the message still sent.
        // Now we stop, so the draft and files stay in the input for a retry.
        if (uploaded.some((r) => r === null)) return false;

        attachments = uploaded.map((r) => ({
          file_name: r!.file_name,
          file_path: r!.file_path,
          file_size: r!.file_size,
          mime_type: r!.mime_type,
        }));
      }

      const hasText = Boolean(content.trim());
      if (!hasText && attachments.length === 0) return false;

      // Optimistic: update the sidebar preview instantly without any fetch or skeleton
      const now = new Date().toISOString();
      const rawText =
        content.trim() ||
        (attachments[0]?.mime_type?.startsWith("image/") ? "📷 Image" : "📎 File");
      const preview = `You: ${rawText}`;
      updateConversationPreview(activeConversation.conversation_id, preview, now);

      // If text is provided, send text message first
      if (hasText) {
        await send(activeConversation.conversation_id, {
          message_content: content.trim(),
          message_type: "TEXT",
          reply_to_message_id: replyToMessageId,
        });
      }

      // Send each file as its own message so each file can be pinned independently
      if (attachments.length > 0) {
        for (let i = 0; i < attachments.length; i++) {
          const att = attachments[i];
          const isImg = att.mime_type.startsWith("image/");
          await send(activeConversation.conversation_id, {
            message_type: isImg ? "IMAGE" : "FILE",
            attachments: [att],
            reply_to_message_id: !hasText && i === 0 ? replyToMessageId : undefined,
          });
        }
      }

      return true;
    },
    [activeConversation, upload, send, updateConversationPreview]
  );

  const handleToggleArchived = useCallback(() => {
    setShowArchived((prev) => !prev);
    handleCloseConversation();
  }, [handleCloseConversation]);

  // ─── Keyboard shortcuts: "/" focuses search, Esc closes the open chat ───────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing) return;

      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (
        e.key === "Escape" &&
        activeConversation &&
        !document.querySelector('[role="dialog"]')
      ) {
        handleCloseConversation();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeConversation, handleCloseConversation]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  const showNoConversations =
    !convsLoading && !showArchived && conversations.length === 0 && !convsLoadFailed;

  return (
    <CompanyVerificationGuard moduleName="Candidate Messages">
      <div className="client-page-transition h-full space-y-4 max-md:flex max-md:min-h-full max-md:flex-col md:space-y-6">
        <style>{`
          @keyframes page-entry {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .client-page-transition {
            animation: page-entry 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          @media (prefers-reduced-motion: reduce) {
            .client-page-transition { animation: none; }
          }
        `}</style>

        {/* Main chat layout */}
        <div className="relative h-[calc(100dvh-96px)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm sm:h-[calc(100dvh-104px)] max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex h-full w-full min-w-0 overflow-hidden">
            {/* Conversation list: hidden on mobile while a chat is open */}
            <div
              className={cn(
                "flex w-full shrink-0 flex-col sm:w-80 lg:w-96",
                mobileShowChat ? "hidden sm:flex" : "flex"
              )}
            >
              <ConversationList
                conversations={conversations}
                activeConversationId={activeConversation?.conversation_id ?? null}
                loading={convsLoading}
                loadFailed={convsLoadFailed}
                searchQuery={searchQuery}
                showArchived={showArchived}
                searchInputRef={searchInputRef}
                onSelect={handleSelectConversation}
                onArchive={handleArchive}
                onSearch={setSearchQuery}
                onRefresh={handleRefreshConversations}
                onToggleArchived={handleToggleArchived}
              />
            </div>

            {/* Chat panel */}
            <div
              className={cn(
                "h-full min-w-0 flex-1 flex-col overflow-hidden",
                mobileShowChat ? "flex" : "hidden sm:flex"
              )}
            >
              {activeConversation ? (
                <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
                  <ChatPanel
                    key={activeConversation.conversation_id}
                    conversation={activeConversation}
                    messages={messages}
                    currentUserId={currentUserId}
                    loading={msgsLoading}
                    loadingOlder={loadingOlder}
                    hasMore={hasMore}
                    uploading={uploading}
                    error={msgsError}
                    unreadAtOpen={unreadAtOpen}
                    isArchived={!!activeConversation.archived_by_client}
                    onSend={handleSend}
                    onRefresh={handleRefreshMessages}
                    onLoadOlder={() => loadOlderMessages(activeConversation.conversation_id)}
                    onArchive={() =>
                      handleArchive(
                        activeConversation.conversation_id,
                        !activeConversation.archived_by_client
                      )
                    }
                    onBack={handleCloseConversation}
                    onToggleReaction={toggleReaction}
                    onRetry={retry}
                    onDeleteMessage={deleteMessage}
                    onTogglePin={togglePin}
                  />
                </div>
              ) : (
                <div className="flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden">
                  {showNoConversations ? (
                    <EmptyState
                      message="No conversations yet"
                      subMessage="Message a freelancer from their application and the conversation will appear here."
                      action={{ label: "Go to applicants", href: APPLICANTS_HREF }}
                    />
                  ) : (
                    <EmptyState
                      subMessage={
                        unreadConversations > 0 && !showArchived
                          ? `You have ${unreadConversations} unread ${
                              unreadConversations === 1 ? "conversation" : "conversations"
                            }. Pick one from the list to read it.`
                          : undefined
                      }
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Undo toast (absolute, not fixed: the page-entry animation creates a transform context) */}
          {toast && (
            <div
              role="status"
              className="absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
            >
              <span>{toast.text}</span>
              {toast.onUndo && (
                <button
                  type="button"
                  onClick={toast.onUndo}
                  className="font-semibold text-indigo-300 underline underline-offset-2 hover:text-indigo-200 max-md:min-h-10 dark:text-indigo-600 dark:hover:text-indigo-700"
                >
                  Undo
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </CompanyVerificationGuard>
  );
}
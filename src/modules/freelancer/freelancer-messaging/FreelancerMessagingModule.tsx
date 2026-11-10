"use client";

// src/modules/freelancer/freelancer-messaging/FreelancerMessagingModule.tsx

import React, { useEffect, useState, useCallback } from "react";

import { useConversations } from "./hooks/useConversations";
import { useMessages } from "./hooks/useMessages";
import ConversationList from "./components/ConversationList";
import ChatPanel from "./components/ChatPanel";
import EmptyState from "./components/EmptyState";
import HiringCelebrationModal from "./components/HiringCelebrationModal";
import { Conversation } from "./types";
import { cn } from "@/lib/utils";

interface Props {
  currentUserId: number;
}

export default function FreelancerMessagingModule({ currentUserId }: Props) {
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const {
    conversations,
    loading: convsLoading,
    loadConversations,
    clearUnreadCount,
    updateConversationPreview,
    archive,
  } = useConversations(activeConversation?.conversation_id ?? null);

  const {
    messages,
    celebration,
    dismissCelebration,
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

  useEffect(() => {
    loadConversations({ archived: showArchived });
  }, [loadConversations, showArchived]);

  const handleSelectConversation = useCallback(
    (conv: Conversation) => {
      clearUnreadCount(conv.conversation_id);
      if (activeConversation?.conversation_id === conv.conversation_id) return;
      clearMessages();
      setActiveConversation({ ...conv, unread_count: 0 });
      loadMessages(conv.conversation_id);
      setMobileShowChat(true);
    },
    [activeConversation, clearMessages, clearUnreadCount, loadMessages]
  );

  const handleRefreshConversations = useCallback(() => {
    loadConversations({ archived: showArchived });
  }, [loadConversations, showArchived]);

  const handleRefreshMessages = useCallback(() => {
    if (activeConversation) {
      refreshMessages(activeConversation.conversation_id);
    }
  }, [activeConversation, refreshMessages]);

  const handleArchive = useCallback(
    async (conversationId: number, nextArchived: boolean) => {
      const ok = await archive(conversationId, nextArchived);
      if (!ok) return;
      if (activeConversation?.conversation_id === conversationId) {
        setActiveConversation(null);
        clearMessages();
        setMobileShowChat(false);
      }
    },
    [archive, activeConversation, clearMessages]
  );

  const handleCloseConversation = useCallback(() => {
    setActiveConversation(null);
    clearMessages();
    setMobileShowChat(false);
  }, [clearMessages]);

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
        if (uploaded.some((r) => r === null)) return false;
        attachments = uploaded
          .filter((r) => r !== null)
          .map((r) => ({
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
    setActiveConversation(null);
    clearMessages();
  }, [clearMessages]);

  return (
    <div className="space-y-4 md:space-y-6 freelancer-page-transition max-md:flex max-md:h-[calc(100dvh-88px)] max-md:min-h-0 max-md:flex-col sm:max-md:h-[calc(100dvh-128px)]">
      <style>{`
        @keyframes page-entry {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .freelancer-page-transition {
          animation: page-entry 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>



      {/* Main Layout */}
      <div className="rounded-2xl border border-border/80 bg-card text-card-foreground overflow-hidden shadow-sm max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col">
        <div className="flex h-[calc(100dvh-170px)] min-h-[550px] w-full min-w-0 overflow-hidden max-md:flex-1 max-md:min-h-0 max-md:min-w-0">
          <div
            className={cn(
              "w-full sm:w-80 lg:w-96 shrink-0 flex flex-col",
              mobileShowChat ? "hidden sm:flex" : "flex"
            )}
          >
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversation?.conversation_id ?? null}
              loading={convsLoading}
              searchQuery={searchQuery}
              showArchived={showArchived}
              currentUserId={currentUserId}
              onSelect={handleSelectConversation}
              onArchive={handleArchive}
              onSearch={setSearchQuery}
              onRefresh={handleRefreshConversations}
              onToggleArchived={handleToggleArchived}
            />
          </div>

          <div
            className={cn(
              "flex-1 min-w-0 h-full flex flex-col overflow-hidden",
              mobileShowChat ? "flex" : "hidden sm:flex"
            )}
          >
            {activeConversation ? (
              <div className="w-full h-full min-w-0 flex flex-col min-h-0 overflow-hidden">
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
                  isArchived={!!activeConversation.archived_by_freelancer}
                  onArchive={() =>
                    handleArchive(
                      activeConversation.conversation_id,
                      !activeConversation.archived_by_freelancer
                    )
                  }
                  onSend={handleSend}
                  onRefresh={handleRefreshMessages}
                  onLoadOlder={() => loadOlderMessages(activeConversation.conversation_id)}
                  onBack={handleCloseConversation}
                  onToggleReaction={toggleReaction}
                  onRetry={retry}
                  onDeleteMessage={deleteMessage}
                  onTogglePin={togglePin}
                />
              </div>
            ) : (
              <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
                <EmptyState />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Fullscreen Hiring Celebration Surprise Modal ── */}
      <HiringCelebrationModal
        celebration={celebration}
        onDismiss={dismissCelebration}
      />
    </div>
  );
}

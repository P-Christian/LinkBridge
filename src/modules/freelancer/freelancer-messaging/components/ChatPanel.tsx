"use client";

// src/modules/freelancer/freelancer-messaging/components/ChatPanel.tsx

import React, { useEffect, useLayoutEffect, useRef, useCallback, useState, useMemo } from "react";
import {
  RefreshCw,
  Briefcase,
  Loader2,
  ArrowLeft,
  ChevronUp,
  ArrowDown,
  PanelRight,
  Pin,
} from "lucide-react";
import { toast } from "sonner";
import { Conversation, Message } from "../types";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import ConversationDetailsSidebar from "@/modules/shared/messaging/components/ConversationDetailsSidebar";
import ReportMessageModal from "@/modules/shared/messaging/components/ReportMessageModal";
import PinnedMessagesModal from "@/modules/shared/messaging/components/PinnedMessagesModal";

interface Props {
  conversation: Conversation;
  messages: Message[];
  currentUserId: number;
  loading: boolean;
  loadingOlder?: boolean;
  hasMore?: boolean;
  uploading: boolean;
  error: string;
  isArchived?: boolean;
  onSend: (content: string, files: File[], replyToMessageId?: number) => Promise<boolean>;
  onRefresh: () => void;
  onLoadOlder?: () => void;
  onArchive?: () => void;
  onBack?: () => void;
  onToggleReaction?: (messageId: number, reaction: string) => void;
  onRetry?: (messageId: number) => void;
  onDeleteMessage?: (messageId: number) => Promise<boolean>;
  onTogglePin?: (messageId: number) => Promise<boolean>;
}

function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  const cleanStr = String(dateStr).replace("T", " ").replace("Z", "").trim();
  const [datePart = "", timePart = "00:00:00"] = cleanStr.split(" ");
  const [year = 1970, month = 1, day = 1] = datePart
    .split("-")
    .map((n) => parseInt(n, 10) || 0);
  const timeClean = timePart.split(".")[0] || "00:00:00";
  const [hour = 0, minute = 0, second = 0] = timeClean
    .split(":")
    .map((n) => parseInt(n, 10) || 0);
  return new Date(year, (month || 1) - 1, day || 1, hour, minute, second);
}
 

function isSameDayStr(a: string, b: string): boolean {
  if (!a || !b) return false;
  const dateA = parseDate(a);
  const dateB = parseDate(b);
  if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return false;
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function minutesBetweenStr(a: string, b: string): number {
  return Math.abs(parseDate(a).getTime() - parseDate(b).getTime()) / 60_000;
}

function formatClock(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
}

function getSeparatorLabel(dateStr: string): string {
  const messageDate = parseDate(dateStr);
  if (isNaN(messageDate.getTime())) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mDate = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
  const diffDays = Math.round((today.getTime() - mDate.getTime()) / (1000 * 60 * 60 * 24));
  const time = formatClock(messageDate);

  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Yesterday, ${time}`;

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const base = `${monthNames[messageDate.getMonth()]} ${messageDate.getDate()}`;
  return messageDate.getFullYear() === now.getFullYear()
    ? `${base}, ${time}`
    : `${base}, ${messageDate.getFullYear()}, ${time}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();
}

function filterLatestInterviewCards(msgs: Message[]): Message[] {
  let latestRescheduledMsgId: number | null = null;

  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (
      m.message_type === "SYSTEM" &&
      m.system_message?.event_type === "INTERVIEW_UPDATED"
    ) {
      if (latestRescheduledMsgId === null || m.message_id > latestRescheduledMsgId) {
        latestRescheduledMsgId = m.message_id;
      }
    }
  }

  return msgs.filter((m) => {
    if (
      m.message_type === "SYSTEM" &&
      m.system_message?.event_type === "INTERVIEW_UPDATED"
    ) {
      return m.message_id === latestRescheduledMsgId;
    }
    return true;
  });
}

export default function ChatPanel({
  conversation,
  messages,
  currentUserId,
  loading,
  loadingOlder,
  hasMore,
  uploading,
  isArchived = false,
  onSend,
  onRefresh,
  onLoadOlder,
  onArchive,
  onBack,
  onToggleReaction,
  onRetry,
  onDeleteMessage,
  onTogglePin,
}: Props) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true); // true while the user is at (or near) the bottom
  const anchorRef = useRef<{ height: number; top: number } | null>(null);
  const prevLastIdRef = useRef<number | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [newBelow, setNewBelow] = useState(0);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [reportingMessageId, setReportingMessageId] = useState<number | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const displayMessages = useMemo(
    () => filterLatestInterviewCards(messages),
    [messages]
  );

  const pinnedMessages = useMemo(() => {
    return messages.filter((m) => Boolean(m.is_pinned) && !m.is_deleted);
  }, [messages]);

  const handleReply = useCallback((m: Message) => {
    setReplyingTo(m);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleJumpToMessage = useCallback(
    async (messageId: number) => {
      // Pulling older pages grows the list above the viewport; without releasing
      // the pin the resize observer would keep dragging the view back down.
      stickRef.current = false;
      let el = document.querySelector(`[data-message-id="${messageId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-emerald-500", "ring-offset-2", "rounded-2xl");
        setTimeout(() => {
          el?.classList.remove("ring-2", "ring-emerald-500", "ring-offset-2", "rounded-2xl");
        }, 2000);
        return;
      }

      if (onLoadOlder) {
        const toastId = toast.loading("Loading message history…");
        for (let i = 0; i < 5; i++) {
          await onLoadOlder();
          await new Promise((r) => setTimeout(r, 250));
          el = document.querySelector(`[data-message-id="${messageId}"]`);
          if (el) {
            toast.dismiss(toastId);
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("ring-2", "ring-emerald-500", "ring-offset-2", "rounded-2xl");
            setTimeout(() => {
              el?.classList.remove("ring-2", "ring-emerald-500", "ring-offset-2", "rounded-2xl");
            }, 2000);
            return;
          }
        }
        toast.dismiss(toastId);
      }

      toast.info("Message could not be found in history.", {
        id: "jump-older-freelancer",
        duration: 3000,
      });
    },
    [onLoadOlder]
  );

  const pinningRef = useRef<Set<number>>(new Set());

  const handleTogglePin = useCallback(
    async (messageId: number) => {
      // The route reads the current pin before writing it, so two overlapping
      // toggles both see "not pinned" and insert two vs_message_pin rows for one
      // message — and the menu item is still clickable while it animates out.
      if (pinningRef.current.has(messageId)) return;
      pinningRef.current.add(messageId);
      try {
        if (onTogglePin) {
          await onTogglePin(messageId);
        } else {
          const res = await fetch(`/api/shared/messaging/messages/${messageId}/pin`, {
            method: "POST",
          });
          if (!res.ok) throw new Error("Failed to update pin status");
          const data = await res.json();
          toast.success(data.is_pinned ? "Message pinned." : "Message unpinned.", {
            id: "pin-toggle-fl",
            duration: 2500,
          });
          onRefresh();
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to pin/unpin message.");
      } finally {
        pinningRef.current.delete(messageId);
      }
    },
    [onTogglePin, onRefresh]
  );

  const handleDelete = useCallback(
    async (messageId: number) => {
      if (onDeleteMessage) {
        await onDeleteMessage(messageId);
        return;
      }
      try {
        const res = await fetch(`/api/shared/messaging/messages/${messageId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to remove message");
        toast.success("Message removed.", { id: "delete-msg-fl", duration: 2500 });
        onRefresh();
      } catch {
        toast.error("Failed to remove message.");
      }
    },
    [onDeleteMessage, onRefresh]
  );

  const handleOpenReport = useCallback((messageId?: number | null) => {
    setReportingMessageId(messageId ?? null);
    setShowReportModal(true);
  }, []);

  const handleSendWrapped = useCallback(
    async (content: string, files: File[]) => {
      const res = await onSend(content, files, replyingTo?.message_id);
      if (res) setReplyingTo(null);
      return res;
    },
    [onSend, replyingTo]
  );

  const {
    other_party_name = "Employer",
    other_party_avatar,
    other_party_email,
    company_name,
    job_title,
    conversation_type,
  } = conversation;

  const subtitle = job_title && company_name
    ? `${job_title} at ${company_name}`
    : job_title || company_name;

  const [imgError, setImgError] = React.useState(false);
  const [prevAvatar, setPrevAvatar] = React.useState(other_party_avatar);

  if (other_party_avatar !== prevAvatar) {
    setPrevAvatar(other_party_avatar);
    setImgError(false);
  }

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Reading history is the reason a thread gets scrolled up; staying there has
    // to survive a refresh and the other party's next message.
    stickRef.current = distance < 120;
    setShowScrollBottom(distance > 200);
    if (distance < 120) setNewBelow(0);
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Keep pinned to the bottom while the content grows (images loading, etc.)
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stickRef.current) scrollToBottom(false);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  // Initial load + new messages landing at the bottom of the thread
  useEffect(() => {
    if (loading) return;
    const last = messages[messages.length - 1];
    const prevLastId = prevLastIdRef.current;
    prevLastIdRef.current = last?.message_id ?? null;
    if (!last) return;

    if (prevLastId === null) {
      stickRef.current = true;
      scrollToBottom(false);
      return;
    }
    if (last.message_id === prevLastId) return;

    if (last.sender_id === currentUserId || stickRef.current) {
      stickRef.current = true;
      scrollToBottom(true);
    } else {
      setNewBelow((n) => n + 1);
    }
  }, [messages, loading, currentUserId, scrollToBottom]);

  // Load older: remember the position, then restore it so the view doesn't jump
  const handleLoadOlder = useCallback(() => {
    const el = messagesContainerRef.current;
    if (el) anchorRef.current = { height: el.scrollHeight, top: el.scrollTop };
    stickRef.current = false;
    onLoadOlder?.();
  }, [onLoadOlder]);

  useLayoutEffect(() => {
    const el = messagesContainerRef.current;
    const anchor = anchorRef.current;
    if (!el || !anchor || loadingOlder) return;
    el.scrollTop = anchor.top + (el.scrollHeight - anchor.height);
    anchorRef.current = null;
  }, [messages, loadingOlder]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="relative flex flex-row h-full w-full min-w-0 overflow-hidden"
    >
      <div className="relative flex flex-col h-full w-full flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-card shrink-0">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back to conversations"
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition max-md:size-11 max-md:grid max-md:place-items-center"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          {other_party_avatar && !imgError ? (
            <Image
              src={other_party_avatar}
              alt={other_party_name}
              width={50}
              height={50}
              unoptimized
              onError={() => setImgError(true)}
              className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/10 dark:ring-primary/20 shrink-0"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
              {getInitials(other_party_name)}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground truncate">
                {other_party_name}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
                {conversation_type === "JOB_APPLICATION"
                  ? "Job Opportunity"
                  : conversation_type === "DIRECT_MESSAGE"
                  ? "Direct"
                  : "Support"}
              </span>
            </div>
            {(subtitle || other_party_email) && (
              <div className="flex items-center gap-2 mt-0.5">
                {subtitle && (
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-2.5 w-2.5 text-primary" />
                    <span className="text-[10px] text-primary font-medium truncate">
                      {subtitle}
                    </span>
                  </div>
                )}
                {other_party_email && !subtitle && (
                  <span className="text-[10px] text-muted-foreground truncate">
                    {other_party_email}
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh messages"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition disabled:opacity-40 shrink-0 max-md:size-11 max-md:grid max-md:place-items-center"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", loading && "animate-spin")}
            />
          </button>

          <button
            onClick={() => setSidebarOpen((v) => !v)}
            title="Conversation details"
            aria-label="Conversation details"
            aria-pressed={sidebarOpen}
            className={cn(
              "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition shrink-0 max-md:size-11 max-md:grid max-md:place-items-center",
              sidebarOpen && "bg-primary/10 text-primary"
            )}
          >
            <PanelRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Sticky Pinned Messages Banner */}
        {pinnedMessages.length > 0 && (
          <div className="flex shrink-0 items-center justify-between border-b border-amber-200/60 bg-amber-50/80 px-4 py-2 text-xs text-amber-900 backdrop-blur-xs dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <button
              type="button"
              onClick={() => handleJumpToMessage(pinnedMessages[0].message_id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left hover:underline cursor-pointer"
            >
              <Pin className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-[11px] text-amber-800 dark:text-amber-300">
                {pinnedMessages.length === 1 ? "Pinned message:" : `${pinnedMessages.length} pinned messages:`}
              </span>
              <span className="truncate text-[11px] opacity-90">
                {pinnedMessages[0].message_content || "Attachment"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowPinnedModal(true)}
              className="ml-2 shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100/80 dark:text-amber-300 dark:hover:bg-amber-900/50 transition cursor-pointer"
            >
              View all
            </button>
          </div>
        )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-busy={loading}
        className="flex-1 w-full min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 bg-muted/20"
      >
        <div ref={contentRef} className="flex flex-col min-h-full w-full min-w-0">
        {loading ? (
          <div className="flex flex-1 justify-center items-center">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center gap-3">
            <div className="p-4 rounded-2xl bg-muted/60">
              <span className="text-2xl">💬</span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                No messages yet
              </p>
              <p className="text-sm md:text-xs text-muted-foreground mt-1">
                Send a message to reply to the employer
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Load Older Messages Trigger */}
            {hasMore && (
              <div className="flex justify-center mb-2">
                <button
                  onClick={handleLoadOlder}
                  disabled={loadingOlder}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm md:text-xs font-semibold bg-card text-muted-foreground hover:text-foreground border border-border/60 shadow-2xs hover:bg-muted/60 transition disabled:opacity-50 max-md:min-h-11"
                >
                  {loadingOlder ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span>Loading older messages...</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-3.5 w-3.5 text-primary" />
                      <span>Load older messages</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {displayMessages.map((msg, index) => {
              const isOwn = msg.sender_id === currentUserId;
              const prevMsg = displayMessages[index - 1];
              const nextMsg = displayMessages[index + 1];
              const showDateDivider =
                !prevMsg ||
                !isSameDayStr(prevMsg.created_at, msg.created_at) ||
                minutesBetweenStr(prevMsg.created_at, msg.created_at) >= 30;
              const dateLabel = showDateDivider ? getSeparatorLabel(msg.created_at) : undefined;
              const isFirstInGroup =
                showDateDivider ||
                !prevMsg ||
                prevMsg.sender_id !== msg.sender_id ||
                !isSameDayStr(prevMsg.created_at, msg.created_at) ||
                minutesBetweenStr(prevMsg.created_at, msg.created_at) >= 30;
              const isLastInGroup =
                !nextMsg ||
                nextMsg.sender_id !== msg.sender_id ||
                !isSameDayStr(msg.created_at, nextMsg.created_at) ||
                minutesBetweenStr(msg.created_at, nextMsg.created_at) >= 30;

              return (
                <MessageBubble
                  key={msg.message_id}
                  message={msg}
                  isOwn={isOwn}
                  showDateDivider={showDateDivider}
                  dateLabel={dateLabel}
                  onToggleReaction={onToggleReaction}
                  otherPartyName={conversation.other_party_name}
                  otherPartyAvatar={conversation.other_party_avatar}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                  onRetry={onRetry}
                  onReply={handleReply}
                  onTogglePin={handleTogglePin}
                  onDelete={handleDelete}
                  onReport={handleOpenReport}
                  onJumpToMessage={handleJumpToMessage}
                />
              );
            })}
            <div className="h-6 shrink-0" aria-hidden="true" />
          </>
        )}
        </div>
      </div>

      {/* Floating Jump to Bottom Button */}
      <AnimatePresence>
        {showScrollBottom && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={() => {
              stickRef.current = true;
              setNewBelow(0);
              scrollToBottom(true);
            }}
            aria-label={
              newBelow > 0
                ? `${newBelow} new messages, jump to latest`
                : "Jump to recent messages"
            }
            className={cn(
              "absolute right-6 bottom-20 z-20 h-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer max-md:size-11",
              newBelow > 0 ? "px-4 text-xs font-semibold" : "w-10"
            )}
          >
            <ArrowDown className="h-4 w-4" />
            {newBelow > 0 && <span>{newBelow} new</span>}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input */}
      <MessageInput
        disabled={loading}
        uploading={uploading}
        replyingTo={replyingTo}
        onCancelReply={handleCancelReply}
        onSend={handleSendWrapped}
      />
      </div>

      {/* Conversation Details Sidebar */}
      <ConversationDetailsSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        otherPartyName={other_party_name}
        otherPartyAvatar={other_party_avatar}
        otherPartySubtitle={company_name || undefined}
        userRole="freelancer"
        conversationType={conversation_type}
        conversationId={conversation.conversation_id}
        isArchived={isArchived}
        messages={messages}
        currentUserId={currentUserId}
        onJumpToMessage={handleJumpToMessage}
        onTogglePin={handleTogglePin}
        onRefresh={onRefresh}
        onArchive={onArchive}
        onOpenReport={handleOpenReport}
      />

      {/* Pinned Messages Modal */}
      <PinnedMessagesModal
        isOpen={showPinnedModal}
        onClose={() => setShowPinnedModal(false)}
        pinnedMessages={pinnedMessages}
        currentUserId={currentUserId}
        otherPartyName={other_party_name}
        onJumpToMessage={handleJumpToMessage}
        onTogglePin={handleTogglePin}
      />

      {/* Report Modal */}
      <ReportMessageModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        messageId={reportingMessageId}
        conversationId={conversation.conversation_id}
        reportedUserId={conversation.client_id}
        reportedUserName={other_party_name}
      />
    </motion.div>
  );
}

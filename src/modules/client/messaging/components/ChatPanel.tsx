"use client";

// src/modules/client/messaging/components/ChatPanel.tsx
//
// NOTE: render this with key={conversation.conversation_id} (MessagingModule does)
// so scroll, search and unread-marker state reset cleanly per conversation.

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
 
  Briefcase,
  ArrowLeft,
  ArrowDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  X,
  PanelRight,
  Pin,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Conversation, Message } from "../types";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import Avatar from "./Avatar";
import { cn } from "@/lib/utils";
import { formatSeparatorLabel, isSameDay, minutesBetween } from "../utils";
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
  /** How many unread messages this conversation had when it was opened */
  unreadAtOpen?: number;
  isArchived?: boolean;
  onSend: (content: string, files: File[], replyToMessageId?: number) => Promise<boolean>;
  onRefresh: () => void;
  onLoadOlder?: () => Promise<"loaded" | "exhausted" | "failed">;
  onArchive?: () => void;
  onBack?: () => void; // mobile
  onToggleReaction?: (messageId: number, reaction: string) => void;
  onRetry?: (messageId: number) => void;
  onDeleteMessage?: (messageId: number) => Promise<boolean>;
  onTogglePin?: (messageId: number) => Promise<boolean>;
}

// Only keep the most recent "interview rescheduled" card
function filterLatestInterviewCards(msgs: Message[]): Message[] {
  let latestId: number | null = null;
  for (const m of msgs) {
    if (m.message_type === "SYSTEM" && m.system_message?.event_type === "INTERVIEW_UPDATED") {
      if (latestId === null || m.message_id > latestId) latestId = m.message_id;
    }
  }
  return msgs.filter(
    (m) =>
      !(m.message_type === "SYSTEM" && m.system_message?.event_type === "INTERVIEW_UPDATED") ||
      m.message_id === latestId
  );
}

const GROUP_WINDOW_MIN = 30;

function sameGroup(a?: Message, b?: Message): boolean {
  return (
    !!a &&
    !!b &&
    a.message_type !== "SYSTEM" &&
    b.message_type !== "SYSTEM" &&
    a.sender_id === b.sender_id &&
    isSameDay(a.created_at, b.created_at) &&
    minutesBetween(a.created_at, b.created_at) < GROUP_WINDOW_MIN
  );
}

function UnreadDivider({ count }: { count: number }) {
  return (
    <div className="my-3 flex select-none items-center gap-3 px-2" role="separator">
      <div className="h-px flex-1 bg-indigo-200 dark:bg-indigo-900" />
      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
        {count} new {count === 1 ? "message" : "messages"}
      </span>
      <div className="h-px flex-1 bg-indigo-200 dark:bg-indigo-900" />
    </div>
  );
}

function MessagesSkeleton() {
  const rows: Array<["left" | "right", string]> = [
    ["left", "w-48"],
    ["left", "w-64"],
    ["right", "w-40"],
    ["left", "w-56"],
    ["right", "w-52"],
  ];
  return (
    <div className="flex flex-1 animate-pulse flex-col justify-end gap-3" aria-hidden="true">
      {rows.map(([side, width], i) => (
        <div key={i} className={cn("flex", side === "right" ? "justify-end" : "justify-start")}>
          <div
            className={cn(
              "h-9 max-w-[75%] rounded-2xl",
              width,
              side === "right" ? "bg-indigo-200/60 dark:bg-indigo-900/40" : "bg-zinc-200 dark:bg-zinc-800"
            )}
          />
        </div>
      ))}
    </div>
  );
}

export default function ChatPanel({
  conversation,
  messages,
  currentUserId,
  loading,
  loadingOlder,
  hasMore,
  uploading,
  error,
  unreadAtOpen = 0,
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
  const {
    other_party_avatar,
    other_party_email,
    job_title,
    conversation_type,
    conversation_id,
  } = conversation;
  const otherName = conversation.other_party_name || "Freelancer";
  const firstName = otherName.split(" ")[0];

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true); // true while the user is at (or near) the bottom
  const anchorRef = useRef<{ height: number; top: number } | null>(null);
  const prevLastIdRef = useRef<number | null>(null);
  const markerComputedRef = useRef(false);

  const [showJump, setShowJump] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const [unreadMarkerId, setUnreadMarkerId] = useState<number | null>(null);

  // sidebar & action state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [reportingMessageId, setReportingMessageId] = useState<number | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // in-chat search
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const displayMessages = useMemo(() => {
    return filterLatestInterviewCards(messages).filter((m) => !m.is_deleted);
  }, [messages]);

  const [activePinIndex, setActivePinIndex] = useState(0);

  const pinnedMessages = useMemo(() => {
    return messages.filter((m) => Boolean(m.is_pinned) && !m.is_deleted);
  }, [messages]);

  const safePinIndex =
    pinnedMessages.length > 0 ? activePinIndex % pinnedMessages.length : 0;
  const currentPinned = pinnedMessages[safePinIndex];

  const handleReply = useCallback((m: Message) => {
    setReplyingTo(m);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleJumpToMessage = useCallback(
    async (messageId: number) => {
      if (messages.some((m) => m.message_id === messageId && m.is_deleted)) {
        toast.info("This message was removed.", { id: "jump-older", duration: 3000 });
        return;
      }

      let el = document.querySelector(`[data-message-id="${messageId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (onLoadOlder) {
        const toastId = toast.loading("Loading message history…");
        for (let i = 0; i < 5; i++) {
          const outcome = await onLoadOlder();
          await new Promise((r) => setTimeout(r, 250));
          el = document.querySelector(`[data-message-id="${messageId}"]`);
          if (el) {
            toast.dismiss(toastId);
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
          if (outcome === "failed") {
            // Without this the loop burned all five attempts on a failing
            // endpoint and then declared the message missing.
            toast.dismiss(toastId);
            toast.error("Older messages could not be loaded. Please try again.", {
              id: "jump-older",
              duration: 4000,
            });
            return;
          }
          if (outcome === "exhausted") break;
        }
        toast.dismiss(toastId);
      }

      toast.info("Message could not be found in the history loaded so far.", {
        id: "jump-older",
        duration: 3000,
      });
    },
    [onLoadOlder, messages]
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
            id: "pin-toggle",
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
        toast.success("Message removed.", { id: "delete-msg", duration: 2500 });
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

  // ─── Scrolling ────────────────────────────────────────────────────────────

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distance < 120;
    stickRef.current = nearBottom;
    setShowJump(distance > 200);
    if (nearBottom) setNewBelow(0);
  }, []);

  // Keep pinned to the bottom while content grows (images loading, new messages, etc.)
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stickRef.current) scrollToBottom(false);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  // Initial load + new message handling
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

  // Load older: remember scroll position, then restore it so the view doesn't jump
  const handleLoadOlder = () => {
    const el = scrollRef.current;
    if (el) anchorRef.current = { height: el.scrollHeight, top: el.scrollTop };
    stickRef.current = false;
    void onLoadOlder?.();
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const anchor = anchorRef.current;
    if (!el || !anchor || loadingOlder) return;
    el.scrollTop = anchor.top + (el.scrollHeight - anchor.height);
    anchorRef.current = null;
  }, [messages, loadingOlder]);

  // ─── "N new messages" marker (computed once, so it doesn't drift) ─────────

  useEffect(() => {
    if (loading || markerComputedRef.current || displayMessages.length === 0) return;
    markerComputedRef.current = true;
    if (unreadAtOpen <= 0) return;

    let remaining = unreadAtOpen;
    for (let i = displayMessages.length - 1; i >= 0; i--) {
      const m = displayMessages[i];
      if (m.message_type === "SYSTEM" || m.sender_id === currentUserId) continue;
      remaining -= 1;
      if (remaining === 0) {
        const targetId = m.message_id;
        queueMicrotask(() => {
          setUnreadMarkerId(targetId);
        });
        return;
      }
    }
  }, [loading, displayMessages, unreadAtOpen, currentUserId]);

  // ─── In-chat search ───────────────────────────────────────────────────────

  const trimmedQuery = query.trim().toLowerCase();
  const matchIds = useMemo(
    () =>
      trimmedQuery
        ? displayMessages
            .filter(
              (m) =>
                m.message_content?.toLowerCase().includes(trimmedQuery) ||
                m.attachments?.some((a) =>
                  a.file_name?.toLowerCase().includes(trimmedQuery)
                )
            )
            .map((m) => m.message_id)
        : [],
    [displayMessages, trimmedQuery]
  );
  const activeIdx = matchIds.length > 0 ? Math.min(matchIndex, matchIds.length - 1) : -1;
  const activeMatchId = activeIdx >= 0 ? matchIds[activeIdx] : null;

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (activeMatchId === null) return;
    stickRef.current = false;
    scrollRef.current
      ?.querySelector(`[data-message-id="${activeMatchId}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeMatchId]);

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };

  const stepMatch = (dir: 1 | -1) => {
    if (matchIds.length === 0) return;
    setMatchIndex((activeIdx + dir + matchIds.length) % matchIds.length);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const iconButton =
    "flex items-center justify-center rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 max-md:size-10 max-md:p-0 dark:hover:bg-zinc-800 dark:hover:text-zinc-300";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="relative flex h-full min-h-0 w-full min-w-0 flex-row overflow-hidden"
    >
      <div className="relative flex h-full min-h-0 flex-1 min-w-0 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to conversations"
              className={cn(iconButton, "text-zinc-500")}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          <Avatar name={otherName} src={other_party_avatar} size={36} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {otherName}
              </h2>
            </div>
            {(job_title || other_party_email) && (
              <div className="mt-0.5 flex items-center gap-1">
                {job_title ? (
                  <>
                    <Briefcase className="h-3 w-3 shrink-0 text-indigo-400" />
                    <span className="truncate text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      {job_title}
                    </span>
                  </>
                ) : (
                  <span className="truncate text-xs text-zinc-500">{other_party_email}</span>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            title="Search in conversation"
            aria-label="Search in conversation"
            aria-pressed={searchOpen}
            className={cn(
              iconButton,
              searchOpen && "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
            )}
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            title="Conversation details"
            aria-label="Conversation details"
            aria-pressed={sidebarOpen}
            className={cn(
              iconButton,
              sidebarOpen && "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
            )}
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </div>

        {/* Sticky Pinned Messages Banner */}
        {pinnedMessages.length > 0 && currentPinned && (
          <div className="flex shrink-0 items-center justify-between border-b border-amber-200/60 bg-amber-50/80 px-4 py-2 text-xs text-amber-900 backdrop-blur-xs dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <button
              type="button"
              onClick={() => handleJumpToMessage(currentPinned.message_id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left hover:underline cursor-pointer"
            >
              <Pin className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-[11px] text-amber-800 dark:text-amber-300 shrink-0">
                {pinnedMessages.length === 1
                  ? "Pinned message:"
                  : `Pinned (${safePinIndex + 1}/${pinnedMessages.length}):`}
              </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentPinned.message_id}
                  initial={{ opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 3 }}
                  transition={{ duration: 0.15 }}
                  className="truncate text-[11px] opacity-90"
                >
                  {currentPinned.message_content ||
                    (currentPinned.attachments?.[0]?.file_name
                      ? `${currentPinned.attachments[0].mime_type?.startsWith("image/") ? "📷" : "📎"} ${currentPinned.attachments[0].file_name}`
                      : "Attachment")}
                </motion.span>
              </AnimatePresence>
            </button>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {pinnedMessages.length > 1 && (
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePinIndex((prev) => (prev - 1 + pinnedMessages.length) % pinnedMessages.length);
                    }}
                    title="Previous pinned message"
                    aria-label="Previous pinned message"
                    className="p-1 rounded-md text-amber-700 hover:bg-amber-100/80 dark:text-amber-300 dark:hover:bg-amber-900/50 transition cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePinIndex((prev) => (prev + 1) % pinnedMessages.length);
                    }}
                    title="Next pinned message"
                    aria-label="Next pinned message"
                    className="p-1 rounded-md text-amber-700 hover:bg-amber-100/80 dark:text-amber-300 dark:hover:bg-amber-900/50 transition cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowPinnedModal(true)}
                className="rounded-lg px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100/80 dark:text-amber-300 dark:hover:bg-amber-900/50 transition cursor-pointer"
              >
                View all
              </button>
            </div>
          </div>
        )}

      {/* In-conversation search bar */}
      {searchOpen && (
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <Search className="h-4 w-4 shrink-0 text-zinc-400" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMatchIndex(Number.MAX_SAFE_INTEGER); // clamps to the newest match
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                closeSearch();
              } else if (e.key === "Enter") {
                e.preventDefault();
                stepMatch(e.shiftKey ? -1 : 1);
              }
            }}
            placeholder="Search in this conversation"
            aria-label="Search in this conversation"
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400 max-md:text-base dark:text-zinc-100"
          />
          <span className="shrink-0 text-xs tabular-nums text-zinc-500" aria-live="polite">
            {trimmedQuery
              ? matchIds.length > 0
                ? `${activeIdx + 1} of ${matchIds.length}`
                : "No matches"
              : hasMore
              ? "Loaded messages only"
              : ""}
          </span>
          <button
            type="button"
            onClick={() => stepMatch(-1)}
            disabled={matchIds.length === 0}
            aria-label="Previous match"
            className={cn(iconButton, "disabled:opacity-30")}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => stepMatch(1)}
            disabled={matchIds.length === 0}
            aria-label="Next match"
            className={cn(iconButton, "disabled:opacity-30")}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={closeSearch} aria-label="Close search" className={iconButton}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="relative min-h-0 flex-1 w-full min-w-0 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          role="log"
          aria-live="polite"
          aria-label={`Conversation with ${otherName}`}
          aria-busy={loading}
          className="h-full w-full min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain bg-zinc-50/50 px-4 py-4 dark:bg-zinc-950/20"
        >
          <div ref={contentRef} className="flex min-h-full w-full min-w-0 flex-col justify-end">
            {loading ? (
              <MessagesSkeleton />
            ) : displayMessages.length === 0 && !hasMore ? (
              error ? (
                // An unread thread must not render as an empty one: the "start
                // the conversation" copy below invites a first message into a
                // conversation whose history we simply could not read.
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                  <p className="mx-auto max-w-xs text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    This conversation could not be loaded.
                  </p>
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                  <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800">
                    <span className="text-2xl" aria-hidden="true">
                      💬
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Start the conversation with {firstName}
                    </p>
                    <p className="mx-auto mt-1 max-w-xs text-xs text-zinc-500">
                      {job_title
                        ? `Ask about availability, rates, or past work for ${job_title}.`
                        : "Send a message below."}
                    </p>
                  </div>
                </div>
              )
            ) : (
              <>
                {hasMore && (
                  <div className="mb-3 flex justify-center">
                    <button
                      type="button"
                      onClick={handleLoadOlder}
                      disabled={loadingOlder}
                      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow-2xs transition hover:bg-zinc-50 disabled:opacity-50 max-md:min-h-10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700/60"
                    >
                      {loadingOlder ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                          Loading older messages...
                        </>
                      ) : (
                        <>
                          <ChevronUp className="h-3.5 w-3.5 text-indigo-500" />
                          Load older messages
                        </>
                      )}
                    </button>
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {displayMessages.map((msg, index) => {
                    const prev = displayMessages[index - 1];
                    const next = displayMessages[index + 1];
                    const showDateDivider =
                      !prev ||
                      !isSameDay(prev.created_at, msg.created_at) ||
                      minutesBetween(prev.created_at, msg.created_at) >= 30;
                    const startsUnread = msg.message_id === unreadMarkerId;

                    return (
                      <motion.div
                        key={msg.message_id}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, height: 0, overflow: "hidden" }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                      >
                        {startsUnread && <UnreadDivider count={unreadAtOpen} />}
                        <MessageBubble
                          message={msg}
                          isOwn={msg.sender_id === currentUserId}
                          showDateDivider={showDateDivider}
                          dateLabel={showDateDivider ? formatSeparatorLabel(msg.created_at) : undefined}
                          isFirstInGroup={startsUnread || !sameGroup(prev, msg)}
                          isLastInGroup={!sameGroup(msg, next) || next?.message_id === unreadMarkerId}
                          otherParty={{ name: otherName, avatar: other_party_avatar }}
                          searchQuery={searchOpen ? query : ""}
                          isActiveMatch={msg.message_id === activeMatchId}
                          onToggleReaction={onToggleReaction}
                          onRetry={onRetry}
                          onReply={handleReply}
                          onTogglePin={handleTogglePin}
                          onDelete={handleDelete}
                          onReport={handleOpenReport}
                          onJumpToMessage={handleJumpToMessage}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div className="h-6 shrink-0" aria-hidden="true" />
              </>
            )}
          </div>
        </div>

        {/* Jump to latest (shows a count when new messages arrived while scrolled up) */}
        <AnimatePresence>
          {showJump && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              onClick={() => {
                stickRef.current = true;
                setNewBelow(0);
                scrollToBottom(true);
              }}
              aria-label={newBelow > 0 ? `${newBelow} new messages, jump to latest` : "Jump to latest message"}
              className={cn(
                "absolute bottom-4 right-4 z-20 flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition-transform hover:bg-indigo-700 active:scale-95",
                newBelow > 0 ? "px-4 text-xs font-semibold" : "w-10"
              )}
            >
              <ArrowDown className="h-4 w-4" />
              {newBelow > 0 && <span>{newBelow} new</span>}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Input: per-conversation drafts via draftKey */}
      <MessageInput
        disabled={loading}
        uploading={uploading}
        draftKey={conversation_id}
        replyingTo={replyingTo}
        onCancelReply={handleCancelReply}
        onSend={handleSendWrapped}
      />
      </div>

      {/* Conversation Details Sidebar */}
      <ConversationDetailsSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        otherPartyName={otherName}
        otherPartyAvatar={other_party_avatar}
        userRole="client"
        conversationType={conversation_type}
        conversationId={conversation_id}
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
        otherPartyName={otherName}
        onJumpToMessage={handleJumpToMessage}
        onTogglePin={handleTogglePin}
      />

      {/* Report Modal */}
      <ReportMessageModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        messageId={reportingMessageId}
        conversationId={conversation_id}
        reportedUserId={conversation.freelancer_id}
        reportedUserName={otherName}
      />
    </motion.div>
  );
}
"use client";

// src/modules/client/messaging/components/MessageBubble.tsx

import React, { useState, useRef, useEffect, useCallback } from "react";
import { FileText, ImageIcon, Check, Download, Eye, Smile, Copy, RefreshCw, Loader2, AlertCircle, Reply, Pin, Trash2, Flag, MoreHorizontal } from "lucide-react";
import { Message, ALLOWED_REACTIONS, MessageReactionGroup } from "../types";
import { cn, copyToClipboard } from "@/lib/utils";
import Image from "next/image";
import SystemMessageRenderer from "@/modules/shared/messaging/components/SystemMessageRenderer";
import DeleteMessageModal from "@/modules/shared/messaging/components/DeleteMessageModal";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Avatar from "./Avatar";
import Highlight from "./Highlight";
import { formatFileSize, formatFullDateTime } from "../utils";

const DocumentViewer = dynamic(
  () => import("@/components/DocumentViewer").then((mod) => mod.DocumentViewer),
  { ssr: false }
);

interface Props {
  message: Message;
  isOwn: boolean;
  showDateDivider?: boolean;
  dateLabel?: string;
  /** Consecutive messages from the same sender within 5 min are grouped */
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  otherParty?: { name: string; avatar?: string | null };
  searchQuery?: string;
  isActiveMatch?: boolean;
  /** True while the message API call is in-flight (last own message only) */
  isSending?: boolean;
  onToggleReaction?: (messageId: number, reaction: string) => void;
  onRetry?: (messageId: number) => void;
  onReply?: (message: Message) => void;
  onTogglePin?: (messageId: number) => void;
  onDelete?: (messageId: number) => void;
  onReport?: (messageId: number) => void;
  onJumpToMessage?: (messageId: number) => void;
}

const LONG_PRESS_MS = 450;
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

// ─── Small pieces ─────────────────────────────────────────────────────────────

function AnimatedEmoji({ emoji, isAnimating }: { emoji: string; isAnimating: boolean }) {
  return (
    <motion.span
      animate={
        isAnimating
          ? { scale: [1, 1.45, 0.88, 1], rotate: [0, -14, 10, 0] }
          : { scale: 1, rotate: 0 }
      }
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="inline-block select-none leading-none"
    >
      {emoji}
    </motion.span>
  );
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="pointer-events-none my-4 flex select-none items-center gap-3 px-2">
      <div className="h-px flex-1 bg-zinc-200/80 dark:bg-zinc-800" />
      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-zinc-200/80 dark:bg-zinc-800" />
    </div>
  );
}

/** Turns URLs into links and highlights the in-chat search term in the rest. */
function MessageText({ text, query, isOwn }: { text: string; query?: string; isOwn: boolean }) {
  const parts = text.split(URL_RE); // one capture group → odd indexes are URLs
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "break-all underline underline-offset-2",
              isOwn
                ? "text-white hover:text-indigo-100"
                : "text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            )}
          >
            {part}
          </a>
        ) : (
          <Highlight key={i} text={part} query={query} />
        )
      )}
    </>
  );
}

const isImageType = (mime: string | null | undefined) => !!mime?.startsWith("image/");

// ─── ReactionPills (Overlapping bottom edge badge) ──────────────────────────

function ReactionPills({
  reactions,
  isOwn,
  animatingReaction,
  onReact,
}: {
  reactions: MessageReactionGroup[];
  isOwn: boolean;
  animatingReaction: string | null;
  onReact: (emoji: string) => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0.6, opacity: 0, y: 4 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.6, opacity: 0, y: 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
        className={cn(
          "absolute -bottom-2.5 z-20 flex items-center gap-0.5 rounded-full shadow-xs backdrop-blur-xs",
          isOwn ? "right-2" : "left-2"
        )}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {reactions.map((r) => {
          const tooltipText =
            r.users && r.users.length > 0
              ? r.users.map((u) => u.user_name).join(", ")
              : `${r.count} reaction${r.count > 1 ? "s" : ""}`;

          return (
            <motion.button
              layout
              key={r.reaction}
              type="button"
              onClick={() => onReact(r.reaction)}
              title={tooltipText}
              aria-label={`${r.reaction} ${r.count}${r.reacted_by_me ? ", you reacted" : ""}. Toggle reaction`}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors duration-150 active:scale-95 max-md:min-h-8",
                r.reacted_by_me
                  ? "border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
              )}
            >
              <AnimatedEmoji emoji={r.reaction} isAnimating={animatingReaction === r.reaction} />
              <span className="font-medium leading-none">{r.count}</span>
            </motion.button>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── BubbleActions (Individual hover action toolbar) ─────────────────────────

function BubbleActions({
  isOwn,
  onReply,
  onTogglePin,
  isPinned,
  onCopy,
  copyLabel,
  onDelete,
  onReport,
  onReact,
  myReaction,
  animatingReaction,
  onPickerOpenChange,
}: {
  isOwn: boolean;
  onReply?: () => void;
  onTogglePin?: () => void;
  isPinned?: boolean;
  onCopy: () => void;
  copyLabel: string;
  onDelete?: () => void;
  onReport?: () => void;
  onReact: (emoji: string) => void;
  myReaction?: string;
  animatingReaction?: string | null;
  onPickerOpenChange?: (open: boolean) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerShift, setPickerShift] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showPicker && !showMoreMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setShowPicker(false);
        onPickerOpenChange?.(false);
        setPickerShift(0);
        setShowMoreMenu(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowPicker(false);
        onPickerOpenChange?.(false);
        setPickerShift(0);
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [showPicker, showMoreMenu, onPickerOpenChange]);

  const handleCopyClick = () => {
    onCopy();
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    setShowMoreMenu(false);
  };

  const handleTogglePicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMoreMenu(false);
    const next = !showPicker;
    if (next && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const triggerCenter = rect.left + rect.width / 2;
      const pickerWidth = 300;
      const halfWidth = pickerWidth / 2;
      const container = triggerRef.current.closest<HTMLElement>(".overflow-y-auto") ?? document.body;
      const containerRect = container.getBoundingClientRect();
      const minLeft = Math.max(12, containerRect.left + 12);
      const maxRight = Math.min(window.innerWidth - 12, containerRect.right - 12);

      let shift = 0;
      if (triggerCenter - halfWidth < minLeft) {
        shift = minLeft - (triggerCenter - halfWidth);
      } else if (triggerCenter + halfWidth > maxRight) {
        shift = maxRight - (triggerCenter + halfWidth);
      }
      setPickerShift(shift);
    } else {
      setPickerShift(0);
    }
    setShowPicker(next);
    onPickerOpenChange?.(next);
  };

  const actionButton =
    "flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:scale-110 hover:text-zinc-800 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:text-zinc-200";

  return (
    <div
      ref={menuRef}
      className={cn(
        "shrink-0 items-center gap-1 self-center transition-opacity duration-150",
        showPicker ? "z-50 opacity-100!" : "z-10",
        "hidden md:flex md:opacity-0 group-hover/row:opacity-100 focus-within:opacity-100",
        (showPicker || showMoreMenu) && "opacity-100!"
      )}
    >
      {/* 1. Emoji Reaction Trigger */}
      <div className="relative inline-flex items-center">
        <button
          ref={triggerRef}
          type="button"
          title="Add reaction"
          aria-label="Add reaction"
          aria-expanded={showPicker}
          onClick={handleTogglePicker}
          className={cn(actionButton, showPicker && "bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100 ring-2 ring-indigo-500/30")}
        >
          <Smile className="h-3.5 w-3.5" />
        </button>

        <AnimatePresence>
          {showPicker && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, scale: 0.85, y: 6, x: `calc(-50% + ${pickerShift}px)` }}
              animate={{ opacity: 1, scale: 1, y: 0, x: `calc(-50% + ${pickerShift}px)` }}
              exit={{ opacity: 0, scale: 0.85, y: 6, x: `calc(-50% + ${pickerShift}px)` }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute bottom-full left-1/2 mb-2 z-50 flex min-w-max items-center gap-1 p-1.5 rounded-2xl border border-zinc-200 bg-white/95 shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {ALLOWED_REACTIONS.map((emoji) => {
                const isSelected = emoji === myReaction;
                return (
                  <button
                    key={emoji}
                    type="button"
                    role="menuitemcheckbox"
                    aria-label={`React with ${emoji}`}
                    aria-checked={isSelected}
                    onClick={() => {
                      onReact(emoji);
                      setShowPicker(false);
                      onPickerOpenChange?.(false);
                    }}
                    className={cn(
                      "relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-lg transition-colors duration-150",
                      isSelected
                        ? "scale-110 border border-indigo-400/80 bg-indigo-100/90 dark:border-indigo-600/80 dark:bg-indigo-950/90"
                        : "hover:scale-110 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    )}
                  >
                    <AnimatedEmoji emoji={emoji} isAnimating={animatingReaction === emoji} />
                    {isSelected && (
                      <span className="absolute -bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-indigo-500" />
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Reply */}
      {onReply && (
        <button
          type="button"
          title="Reply"
          aria-label="Reply to message"
          onClick={onReply}
          className={actionButton}
        >
          <Reply className="h-3.5 w-3.5" />
        </button>
      )}

      {/* 3. 3-dots More Actions Menu */}
      <div className="relative inline-flex items-center">
        <button
          type="button"
          title="More actions"
          aria-label="More actions"
          aria-expanded={showMoreMenu}
          onClick={(e) => {
            e.stopPropagation();
            setShowPicker(false);
            setShowMoreMenu((prev) => !prev);
          }}
          className={cn(actionButton, showMoreMenu && "bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100")}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>

        <AnimatePresence>
          {showMoreMenu && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, scale: 0.95, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 4 }}
              transition={{ duration: 0.12 }}
              className={cn(
                "absolute bottom-full mb-2 z-50 min-w-max flex flex-col p-1.5",
                "rounded-2xl border border-zinc-200/80 bg-white/95 shadow-xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/95",
                isOwn ? "right-0" : "left-0"
              )}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Pin / Unpin */}
              {onTogglePin && (
                <button
                  type="button"
                  onClick={() => {
                    onTogglePin();
                    setShowMoreMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium whitespace-nowrap text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Pin className={cn("h-3.5 w-3.5", isPinned ? "fill-amber-500 text-amber-500" : "text-zinc-500")} />
                  <span>{isPinned ? "Unpin message" : "Pin message"}</span>
                </button>
              )}

              {/* Copy */}
              <button
                type="button"
                onClick={handleCopyClick}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium whitespace-nowrap text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-zinc-500" />}
                <span>{copied ? "Copied" : copyLabel}</span>
              </button>

              {/* Delete (Own only) */}
              {isOwn && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onDelete();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium whitespace-nowrap text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove message</span>
                </button>
              )}

              {/* Report (Other only) */}
              {!isOwn && onReport && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onReport();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium whitespace-nowrap text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <Flag className="h-3.5 w-3.5" />
                  <span>Report message</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
  showDateDivider,
  dateLabel,
  isFirstInGroup = true,
  isLastInGroup = true,
  otherParty,
  searchQuery,
  isActiveMatch,
  isSending = false,
  onToggleReaction,
  onRetry,
  onReply,
  onTogglePin,
  onDelete,
  onReport,
  onJumpToMessage,
}: Props) {
  const { message_type, message_content, created_at, attachments, is_edited, reactions, is_pinned, is_deleted, reply_to } = message;

  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileUrl: string } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [isActionPickerOpen, setIsActionPickerOpen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [animatingReaction, setAnimatingReaction] = useState<string | null>(null);
  const [showSent, setShowSent] = useState(false);

  const pressRef = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const myReaction = reactions?.find((r) => r.reacted_by_me)?.reaction;
  const hasReactions = !!(reactions && reactions.length > 0);
  const [reactedTarget, setReactedTarget] = useState<string | null>(null);

  const shouldShowReactions = useCallback(
    (targetKey: string) => {
      if (!hasReactions) return false;
      if (reactedTarget) {
        return reactedTarget === targetKey;
      }
      if (attachments && attachments.length > 0) {
        return String(attachments[0].attachment_id) === targetKey;
      }
      return targetKey === "text";
    },
    [hasReactions, reactedTarget, attachments]
  );

  const cancelPress = useCallback(() => {
    if (pressRef.current) {
      clearTimeout(pressRef.current.timer);
      pressRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelPress();
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
    };
  }, [cancelPress]);

  // isSending false → show "Sent ✓" for 1.5 s then hide
  const prevSendingRef = useRef(isSending);
  useEffect(() => {
    if (prevSendingRef.current && !isSending && isOwn) {
      setShowSent(true);
      if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
      sentTimerRef.current = setTimeout(() => setShowSent(false), 1500);
    }
    prevSendingRef.current = isSending;
  }, [isSending, isOwn]);

  // Close the picker or more menu on outside tap / Escape
  useEffect(() => {
    if (!showPicker && !showMoreMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) {
        setShowPicker(false);
        setShowMoreMenu(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowPicker(false);
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [showPicker, showMoreMenu]);

  const handleReact = useCallback(
    (emoji: string) => {
      onToggleReaction?.(message.message_id, emoji);
      setAnimatingReaction(emoji);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      animTimerRef.current = setTimeout(() => setAnimatingReaction(null), 350);
      setShowPicker(false);
    },
    [message.message_id, onToggleReaction]
  );

  const handleCopy = useCallback(async () => {
    if (!message_content) return;
    await copyToClipboard(message_content);
    setShowPicker(false);
  }, [message_content]);

  // ─── Touch long-press (400ms) opens the picker. Mouse users use the hover button.
  // No preventDefault / touch-action:none, so scrolling the chat over a bubble still works.

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    cancelPress();
    pressRef.current = {
      x: e.clientX,
      y: e.clientY,
      timer: setTimeout(() => {
        pressRef.current = null;
        setShowPicker(true);
        navigator.vibrate?.(10);
      }, LONG_PRESS_MS),
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const press = pressRef.current;
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) cancelPress();
  };

  // ─── System message ───────────────────────────────────────────────────────

  if (message_type === "SYSTEM") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {showDateDivider && dateLabel && <DateDivider label={dateLabel} />}
        <div className="my-3 flex justify-center px-4">
          <SystemMessageRenderer message={message} />
        </div>
      </motion.div>
    );
  }

  // ─── Regular message ──────────────────────────────────────────────────────

  const radius = isOwn
    ? cn("rounded-2xl rounded-br-md", !isFirstInGroup && "rounded-tr-md")
    : cn("rounded-2xl rounded-bl-md", !isFirstInGroup && "rounded-tl-md");


  return (
    <motion.div
      data-message-id={message.message_id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "relative w-full min-w-0",
        (showPicker || isActionPickerOpen) && "z-40",
        isFirstInGroup && !showDateDivider ? "mt-3" : "mt-0.5"
      )}
    >
      {showDateDivider && dateLabel && <DateDivider label={dateLabel} />}

      <div
        ref={rowRef}
        className={cn(
          "group relative flex w-full min-w-0 flex-col",
          hasReactions && "mb-3",
          isOwn ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "relative flex w-full min-w-0 items-end gap-2",
            isOwn ? "justify-end" : "justify-start"
          )}
        >
          {/* Avatar slot (other party only; shown on last message of a group) */}
          {!isOwn && (
            <div className="w-7 shrink-0">
              {isLastInGroup && otherParty && (
                <Avatar name={otherParty.name} src={otherParty.avatar} size={28} className="ring-0" />
              )}
            </div>
          )}

          {/* Bubble column */}
          <div
            className={cn(
              "relative flex max-w-[85%] sm:max-w-[75%] min-w-0 flex-col gap-1",
              isOwn ? "items-end" : "items-start"
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={cancelPress}
            onPointerCancel={cancelPress}
          >
            {/* Sender name for left chat bubble (only on first message in group) */}
            {!isOwn && isFirstInGroup && otherParty?.name && (
              <span className="select-none px-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {otherParty.name}
              </span>
            )}

            {/* Reaction picker */}
            <AnimatePresence>
              {showPicker && (
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, scale: 0.85, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: 10 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className={cn(
                    "md:hidden absolute -top-12 z-40 flex min-w-max items-center gap-1 p-1.5",
                    "rounded-2xl border border-zinc-200 bg-white/95 shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95",
                    isOwn ? "right-0" : "left-0"
                  )}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {ALLOWED_REACTIONS.map((emoji) => {
                    const isSelected = emoji === myReaction;
                    return (
                      <button
                        key={emoji}
                        type="button"
                        role="menuitemcheckbox"
                        aria-label={`React with ${emoji}`}
                        aria-checked={isSelected}
                        onClick={() => handleReact(emoji)}
                        className={cn(
                          "relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-lg transition-colors duration-150 max-md:size-10",
                          isSelected
                            ? "scale-110 border border-indigo-400/80 bg-indigo-100/90 dark:border-indigo-600/80 dark:bg-indigo-950/90"
                            : "hover:scale-110 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        )}
                      >
                        <AnimatedEmoji emoji={emoji} isAnimating={animatingReaction === emoji} />
                        {isSelected && (
                          <span className="absolute -bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-indigo-500" />
                        )}
                      </button>
                    );
                  })}

                  {/* Copy lives here on touch screens, where text selection is off */}
                  {message_content && (
                    <>
                      <span className="mx-0.5 h-5 w-px bg-zinc-200 md:hidden dark:bg-zinc-700" />
                      <button
                        type="button"
                        role="menuitem"
                        aria-label="Copy message text"
                        onClick={handleCopy}
                        className="flex size-10 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 md:hidden dark:hover:bg-zinc-800"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content column with individual action rows */}
            <div
              className={cn(
                "relative flex flex-col gap-1.5 min-w-0 max-w-full",
                isOwn ? "items-end" : "items-start",
                isActiveMatch && "rounded-2xl ring-2 ring-amber-400 ring-offset-2 dark:ring-offset-zinc-950"
              )}
            >
              {/* Hover date & time tooltip (solid non-transparent, z-50, 400ms delay, arrow indicator) */}
              {!is_deleted && (
                <div
                  className={cn(
                    "pointer-events-none absolute z-50 flex items-center gap-1.5 whitespace-nowrap select-none",
                    "rounded-md px-2.5 py-1 text-[11px] font-medium shadow-md transition-opacity duration-150 delay-0",
                    (showPicker || isActionPickerOpen)
                      ? "opacity-0 pointer-events-none"
                      : "opacity-0 group-hover:opacity-100 group-hover:delay-[400ms]",
                    hasReactions ? "top-full mt-4" : "top-full mt-1.5",
                    isOwn
                      ? "right-0 justify-end bg-indigo-950 text-indigo-100 border border-indigo-700/80 dark:bg-indigo-950 dark:text-indigo-100 dark:border-indigo-600/70"
                      : "left-0 justify-start bg-white text-zinc-800 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                  )}
                >
                  {/* Upward arrow indicator pointing to the bubble */}
                  <span
                    className={cn(
                      "absolute -top-1 h-2 w-2 rotate-45",
                      isOwn
                        ? "right-3.5 bg-indigo-950 border-l border-t border-indigo-700/80 dark:bg-indigo-950 dark:border-indigo-600/70"
                        : "left-3.5 bg-white border-l border-t border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700"
                    )}
                  />
                  {isOwn && message.delivery_status === "failed" ? (
                    <>
                      <AlertCircle className="relative z-10 h-3 w-3 shrink-0 text-rose-400" />
                      <span className="relative z-10 text-rose-200">Failed to send</span>
                    </>
                  ) : isOwn && (message.delivery_status === "sending" || isSending) ? (
                    <>
                      <Loader2 className="relative z-10 h-3 w-3 shrink-0 text-indigo-400 animate-spin" />
                      <span className="relative z-10">Sending…</span>
                    </>
                  ) : (
                    <>
                      {isOwn && <Check className="relative z-10 h-3 w-3 shrink-0 text-indigo-400" />}
                      <span className="relative z-10">
                        {isOwn ? `Sent ${formatFullDateTime(created_at)}` : formatFullDateTime(created_at)}
                      </span>
                      {is_edited && <span className="relative z-10 opacity-75 italic">(edited)</span>}
                    </>
                  )}
                </div>
              )}

              <AnimatePresence>
                {is_pinned && !is_deleted && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: -4, height: 0 }}
                    animate={{ opacity: 1, scale: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, scale: 0.85, y: -4, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="flex items-center gap-1 px-1 text-[11px] font-medium text-amber-500 overflow-hidden"
                  >
                    <motion.div
                      animate={{ rotate: [0, -15, 15, 0] }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                    >
                      <Pin className="h-3 w-3 fill-amber-500" />
                    </motion.div>
                    <span>Pinned</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {is_deleted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className={cn(
                    "w-fit max-w-full cursor-default select-text px-3.5 py-2 text-xs italic leading-relaxed shadow-xs opacity-75",
                    radius,
                    isOwn
                      ? "bg-indigo-600/60 text-white/90"
                      : "border border-zinc-200/60 bg-zinc-100 text-zinc-500 dark:border-zinc-700/60 dark:bg-zinc-800/60 dark:text-zinc-400"
                  )}
                >
                  🚫 This message was removed
                </motion.div>
              ) : (
                <>
                  {/* Text bubble row with individual action toolbar */}
                  {(message_content || reply_to) && (
                    <div
                      className={cn(
                        "flex items-center gap-1.5 min-w-0 max-w-full group/row",
                        isOwn ? "justify-end" : "justify-start",
                        shouldShowReactions("text") && "mb-2.5"
                      )}
                    >
                      {isOwn && (
                        <BubbleActions
                          isOwn={isOwn}
                          onReply={onReply ? () => onReply(message) : undefined}
                          onTogglePin={onTogglePin ? () => onTogglePin(message.message_id) : undefined}
                          isPinned={is_pinned}
                          onCopy={handleCopy}
                          copyLabel="Copy text"
                          onDelete={onDelete ? () => setShowDeleteModal(true) : undefined}
                          onReport={onReport ? () => onReport(message.message_id) : undefined}
                          onReact={(emoji) => {
                            setReactedTarget("text");
                            handleReact(emoji);
                          }}
                          myReaction={myReaction}
                          animatingReaction={animatingReaction}
                          onPickerOpenChange={setIsActionPickerOpen}
                        />
                      )}

                      <div
                        className={cn(
                          "relative w-fit max-w-full cursor-default select-text leading-relaxed shadow-xs max-md:select-none",
                          radius,
                          isOwn
                            ? "bg-indigo-600 text-white"
                            : "border border-zinc-200/60 bg-white text-zinc-800 dark:border-zinc-700/60 dark:bg-zinc-800 dark:text-zinc-100"
                        )}
                      >
                        {/* Quoted reply banner inside the bubble */}
                        {reply_to && !is_deleted && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onJumpToMessage?.(reply_to.message_id);
                            }}
                            className={cn(
                              "flex flex-col text-left transition rounded-xl px-2.5 py-1.5 m-1.5 w-[calc(100%-12px)] border-l-2 overflow-hidden",
                              isOwn
                                ? "bg-black/25 hover:bg-black/30 text-white/95 border-amber-300"
                                : "bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 border-indigo-500 dark:bg-zinc-700/60 dark:hover:bg-zinc-700 dark:text-zinc-200 dark:border-indigo-400"
                            )}
                          >
                            <div className="flex items-center gap-1">
                              <Reply className="h-3 w-3 shrink-0 opacity-80" />
                              <span className={cn("text-[10px] font-bold truncate", isOwn ? "text-amber-300 dark:text-amber-300" : "text-indigo-600 dark:text-indigo-400")}>
                                {reply_to.sender_id === message.sender_id ? "You" : (reply_to.sender_name && reply_to.sender_name !== "Freelancer" && reply_to.sender_name !== "Client" ? reply_to.sender_name : otherParty?.name || reply_to.sender_name || "User")}
                              </span>
                            </div>
                            <span className={cn(
                              "truncate text-[11px] opacity-90 line-clamp-1 mt-0.5",
                              (reply_to.is_deleted || reply_to.message_content === "This message was removed") && "italic opacity-70"
                            )}>
                              {reply_to.is_deleted || reply_to.message_content === "This message was removed"
                                ? "This message was removed"
                                : (reply_to.message_content && reply_to.message_content !== "Attachment"
                                    ? reply_to.message_content
                                    : reply_to.attachments?.[0]?.file_name) ||
                                  reply_to.message_content ||
                                  "Attachment"}
                            </span>
                          </button>
                        )}

                        {/* Message text */}
                        {message_content && (
                          <div className="px-3.5 py-2 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]">
                            <MessageText text={message_content} query={searchQuery} isOwn={isOwn} />
                          </div>
                        )}

                        {shouldShowReactions("text") && (
                          <ReactionPills
                            reactions={reactions!}
                            isOwn={isOwn}
                            animatingReaction={animatingReaction}
                            onReact={(emoji) => {
                              setReactedTarget("text");
                              handleReact(emoji);
                            }}
                          />
                        )}
                      </div>

                      {!isOwn && (
                        <BubbleActions
                          isOwn={isOwn}
                          onReply={onReply ? () => onReply(message) : undefined}
                          onTogglePin={onTogglePin ? () => onTogglePin(message.message_id) : undefined}
                          isPinned={is_pinned}
                          onCopy={handleCopy}
                          copyLabel="Copy text"
                          onDelete={onDelete ? () => setShowDeleteModal(true) : undefined}
                          onReport={onReport ? () => onReport(message.message_id) : undefined}
                          onReact={(emoji) => {
                            setReactedTarget("text");
                            handleReact(emoji);
                          }}
                          myReaction={myReaction}
                          animatingReaction={animatingReaction}
                          onPickerOpenChange={setIsActionPickerOpen}
                        />
                      )}
                    </div>
                  )}

                  {/* Attachments — each with its own individual action toolbar */}
                  {attachments?.map((att) => {
                    const isAttMatch = Boolean(
                      searchQuery && att.file_name?.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                    const showAttReactions = shouldShowReactions(String(att.attachment_id));

                    return (
                      <div
                        key={att.attachment_id}
                        className={cn(
                          "flex items-center gap-1.5 min-w-0 max-w-full group/row",
                          isOwn ? "justify-end" : "justify-start",
                          showAttReactions && "mb-2.5"
                        )}
                      >
                        {isOwn && (
                          <BubbleActions
                            isOwn={isOwn}
                            onReply={onReply ? () => onReply({
                              ...message,
                              message_content: att.file_name,
                              attachments: [att],
                            }) : undefined}
                            onTogglePin={onTogglePin ? () => onTogglePin(message.message_id) : undefined}
                            isPinned={is_pinned}
                            onCopy={() => {
                              if (att.file_path) {
                                const url = att.file_path.startsWith("http")
                                  ? att.file_path
                                  : `${window.location.origin}${att.file_path}`;
                                navigator.clipboard?.writeText(url);
                              }
                            }}
                            copyLabel="Copy file link"
                            onDelete={onDelete ? () => setShowDeleteModal(true) : undefined}
                            onReport={onReport ? () => onReport(message.message_id) : undefined}
                            onReact={(emoji) => {
                              setReactedTarget(String(att.attachment_id));
                              handleReact(emoji);
                            }}
                            myReaction={myReaction}
                            animatingReaction={animatingReaction}
                            onPickerOpenChange={setIsActionPickerOpen}
                          />
                        )}

                        {isImageType(att.mime_type) ? (
                          <div className="relative group/bubble">
                            <div
                              className={cn(
                                "max-w-[220px] overflow-hidden rounded-2xl border shadow-sm",
                                isAttMatch && "ring-2 ring-amber-400 ring-offset-2 dark:ring-offset-zinc-950",
                                isOwn ? "border-indigo-500/30" : "border-zinc-200 dark:border-zinc-700"
                              )}
                            >
                              <button
                                type="button"
                                aria-label={`Preview ${att.file_name}`}
                                onClick={() => setPreviewDoc({ fileName: att.file_name, fileUrl: att.file_path })}
                                className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                              >
                                <Image
                                  width={220}
                                  height={192}
                                  unoptimized
                                  src={att.file_path}
                                  alt={att.file_name}
                                  className="h-auto max-h-48 w-full cursor-pointer object-cover"
                                />
                              </button>
                              {att.file_name && (
                                <div
                                  className={cn(
                                    "flex items-center justify-between gap-1 px-3 py-1.5 text-xs",
                                    isOwn
                                      ? "bg-indigo-600 text-indigo-100"
                                      : "bg-zinc-50 text-zinc-500 dark:bg-zinc-800"
                                  )}
                                >
                                  <div className="flex min-w-0 items-center gap-1">
                                    <ImageIcon className="h-3 w-3 shrink-0" />
                                    <span className={cn("truncate", isAttMatch && "font-bold text-amber-500 underline")}>{att.file_name}</span>
                                  </div>
                                  <a
                                    href={att.file_path}
                                    download={att.file_name}
                                    title="Download image"
                                    aria-label={`Download ${att.file_name}`}
                                    className="p-0.5 hover:opacity-80 max-md:flex max-md:size-10 max-md:items-center max-md:justify-center max-md:p-0"
                                  >
                                    <Download className="h-3.5 w-3.5 shrink-0" />
                                  </a>
                                </div>
                              )}
                            </div>

                            {showAttReactions && (
                              <ReactionPills
                                reactions={reactions!}
                                isOwn={isOwn}
                                animatingReaction={animatingReaction}
                                onReact={(emoji) => {
                                  setReactedTarget(String(att.attachment_id));
                                  handleReact(emoji);
                                }}
                              />
                            )}
                          </div>
                        ) : (
                          <div className="relative group/bubble">
                            <div
                              className={cn(
                                "flex max-w-[260px] items-center gap-2 border px-3 py-2 shadow-sm",
                                radius,
                                isAttMatch && "ring-2 ring-amber-400 ring-offset-2 dark:ring-offset-zinc-950",
                                isOwn
                                  ? "border-indigo-500/40 bg-indigo-600 text-white"
                                  : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                              )}
                            >
                              <div
                                className={cn(
                                  "shrink-0 rounded-lg p-1.5",
                                  isOwn ? "bg-white/20" : "bg-zinc-100 dark:bg-zinc-700"
                                )}
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium">{att.file_name}</p>
                                {att.file_size ? (
                                  <p className={cn("text-[11px]", isOwn ? "text-indigo-200" : "text-zinc-500")}>
                                    {formatFileSize(att.file_size)}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc({ fileName: att.file_name, fileUrl: att.file_path })}
                                  title="Preview document"
                                  aria-label={`Preview ${att.file_name}`}
                                  className="rounded-md p-1 transition hover:bg-black/10 max-md:size-10 dark:hover:bg-white/10"
                                >
                                  <Eye className="mx-auto h-3.5 w-3.5" />
                                </button>
                                <a
                                  href={att.file_path}
                                  download={att.file_name}
                                  title="Download document"
                                  aria-label={`Download ${att.file_name}`}
                                  className="rounded-md p-1 transition hover:bg-black/10 max-md:flex max-md:size-10 max-md:items-center max-md:justify-center dark:hover:bg-white/10"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            </div>

                            {showAttReactions && (
                              <ReactionPills
                                reactions={reactions!}
                                isOwn={isOwn}
                                animatingReaction={animatingReaction}
                                onReact={(emoji) => {
                                  setReactedTarget(String(att.attachment_id));
                                  handleReact(emoji);
                                }}
                              />
                            )}
                          </div>
                        )}

                        {!isOwn && (
                          <BubbleActions
                            isOwn={isOwn}
                            onReply={onReply ? () => onReply({
                              ...message,
                              message_content: att.file_name,
                              attachments: [att],
                            }) : undefined}
                            onTogglePin={onTogglePin ? () => onTogglePin(message.message_id) : undefined}
                            isPinned={is_pinned}
                            onCopy={() => {
                              if (att.file_path) {
                                const url = att.file_path.startsWith("http")
                                  ? att.file_path
                                  : `${window.location.origin}${att.file_path}`;
                                navigator.clipboard?.writeText(url);
                              }
                            }}
                            copyLabel="Copy file link"
                            onDelete={onDelete ? () => setShowDeleteModal(true) : undefined}
                            onReport={onReport ? () => onReport(message.message_id) : undefined}
                            onReact={(emoji) => {
                              setReactedTarget(String(att.attachment_id));
                              handleReact(emoji);
                            }}
                            myReaction={myReaction}
                            animatingReaction={animatingReaction}
                            onPickerOpenChange={setIsActionPickerOpen}
                          />
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Sending / Sent / Failed status label — own messages only, under the bubble */}
            {isOwn && (message.delivery_status || isSending || showSent) && (
              <AnimatePresence mode="wait">
                {message.delivery_status === "failed" ? (
                  <motion.div
                    key="failed"
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="mt-0.5 flex select-none items-center gap-1.5 pr-1 text-[11px] text-rose-500 dark:text-rose-400"
                  >
                    <span>Failed</span>
                    {onRetry && (
                      <button
                        type="button"
                        onClick={() => onRetry(message.message_id)}
                        className="flex items-center gap-1 font-medium underline underline-offset-2 hover:text-rose-600 dark:hover:text-rose-300 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="h-2.5 w-2.5" />
                        Retry
                      </button>
                    )}
                  </motion.div>
                ) : (
                  <motion.span
                    key={message.delivery_status || (isSending ? "sending" : "sent")}
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="mt-0.5 select-none pr-1 text-[11px] text-zinc-400 dark:text-zinc-500"
                  >
                    {message.delivery_status === "sending" || isSending ? "Sending…" : "Sent ✓"}
                  </motion.span>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* Document preview */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="flex h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 max-md:max-h-[90dvh] sm:max-w-4xl">
          <DialogHeader className="flex shrink-0 flex-row items-center justify-between border-b px-6 py-3.5">
            <div className="flex min-w-0 items-center gap-2 pr-4">
              <FileText className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <DialogTitle className="truncate text-sm font-bold">{previewDoc?.fileName}</DialogTitle>
            </div>
            {previewDoc && (
              <a
                href={previewDoc.fileUrl}
                download={previewDoc.fileName}
                className="mr-8 inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 max-md:min-h-10"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            )}
          </DialogHeader>
          <div className="relative flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-950">
            {previewDoc && (
              <DocumentViewer
                fileUrl={previewDoc.fileUrl}
                fileName={previewDoc.fileName}
                hideDownloadButton
                hideFileName
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <DeleteMessageModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => {
          setShowDeleteModal(false);
          onDelete?.(message.message_id);
        }}
      />
    </motion.div>
  );
}

export default React.memo(MessageBubble);

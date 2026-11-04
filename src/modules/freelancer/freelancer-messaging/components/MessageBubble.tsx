"use client";

// src/modules/freelancer/freelancer-messaging/components/MessageBubble.tsx

import React, { useState, useRef, useEffect, useCallback } from "react";
import { FileText, ImageIcon, CheckCheck, Download, Eye, Smile, RefreshCw, Loader2, AlertCircle, Reply, Pin, Trash2, Flag, MoreHorizontal, Copy, Check } from "lucide-react";
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
import Avatar from "@/modules/client/messaging/components/Avatar";

const DocumentViewer = dynamic(
  () => import("@/components/DocumentViewer").then((mod) => mod.DocumentViewer),
  { ssr: false }
);

interface Props {
  message: Message;
  isOwn: boolean;
  showDateDivider?: boolean;
  dateLabel?: string;
  onToggleReaction?: (messageId: number, reaction: string) => void;
  otherPartyName?: string;
  otherPartyAvatar?: string | null;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  onRetry?: (messageId: number) => void;
  onReply?: (message: Message) => void;
  onTogglePin?: (messageId: number) => void;
  onDelete?: (messageId: number) => void;
  onReport?: (messageId: number) => void;
  onJumpToMessage?: (messageId: number) => void;
}

// ─── AnimatedEmoji — single-responsibility, reused in picker + badge pill ────

function AnimatedEmoji({
  emoji,
  isAnimating,
}: {
  emoji: string;
  isAnimating: boolean;
}) {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatFullDateTime(dateStr: string): string {
  const messageDate = parseDate(dateStr);
  if (isNaN(messageDate.getTime())) return "";
  const rawHour = messageDate.getHours();
  const minute = messageDate.getMinutes();
  const period = rawHour >= 12 ? "PM" : "AM";
  const hour = rawHour % 12 || 12;
  const timeFormatted = `${hour}:${minute.toString().padStart(2, "0")} ${period}`;
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${monthNames[messageDate.getMonth()]} ${messageDate.getDate()}, ${messageDate.getFullYear()}, ${timeFormatted}`;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(mimeType: string | null | undefined): boolean {
  return !!mimeType?.startsWith("image/");
}

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
              aria-label={`Toggle ${r.reaction} reaction`}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors duration-150 active:scale-95 max-md:min-h-11 max-md:px-3 max-md:py-2 border",
                r.reacted_by_me
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-card border-border/60 text-muted-foreground hover:bg-muted"
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

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4 px-2 select-none pointer-events-none">
      <div className="flex-1 h-px bg-border/60" />
      <span className="text-[11px] font-medium text-muted-foreground tracking-wide">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
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
    "flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground shadow-sm transition hover:scale-110 hover:text-foreground hover:bg-muted active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

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
          className={cn(actionButton, showPicker && "bg-muted text-foreground ring-2 ring-primary/30")}
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
              className="absolute bottom-full left-1/2 mb-2 z-50 flex min-w-max items-center gap-1 p-1.5 rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-md text-card-foreground"
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
                        ? "scale-110 border border-primary/40 bg-primary/10 text-primary"
                        : "hover:scale-110 hover:bg-muted"
                    )}
                  >
                    <AnimatedEmoji emoji={emoji} isAnimating={animatingReaction === emoji} />
                    {isSelected && (
                      <span className="absolute -bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary" />
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
          className={cn(actionButton, showPicker && "bg-muted text-foreground ring-2 ring-primary/30")}
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
          className={cn(actionButton, showMoreMenu && "bg-muted text-foreground")}
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
                "rounded-2xl border border-border/80 bg-card/95 shadow-xl backdrop-blur-xl text-card-foreground",
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
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium whitespace-nowrap text-foreground transition hover:bg-muted"
                >
                  <Pin className={cn("h-3.5 w-3.5", isPinned ? "fill-amber-500 text-amber-500" : "text-muted-foreground")} />
                  <span>{isPinned ? "Unpin message" : "Pin message"}</span>
                </button>
              )}

              {/* Copy */}
              <button
                type="button"
                onClick={handleCopyClick}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium whitespace-nowrap text-foreground transition hover:bg-muted"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
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
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium whitespace-nowrap text-destructive transition hover:bg-destructive/10"
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
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium whitespace-nowrap text-destructive transition hover:bg-destructive/10"
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
  onToggleReaction,
  otherPartyName,
  otherPartyAvatar,
  isFirstInGroup,
  isLastInGroup,
  onRetry,
  onReply,
  onTogglePin,
  onDelete,
  onReport,
  onJumpToMessage,
}: Props) {
  const { message_type, message_content, created_at, attachments, is_edited, reactions, is_pinned, is_deleted, reply_to } =
    message;

  const [previewDoc, setPreviewDoc] = useState<{
    fileName: string;
    fileUrl: string;
  } | null>(null);

  const [showPicker, setShowPicker] = useState(false);
  const [isActionPickerOpen, setIsActionPickerOpen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Tracks which emoji this user just clicked — cleared after 350 ms
  const [animatingReaction, setAnimatingReaction] = useState<string | null>(null);

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, []);

  // Close picker and more menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!showPicker && !showMoreMenu) return;
    const handleOutsideClick = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        pickerRef.current &&
        !pickerRef.current.contains(target) &&
        bubbleRef.current &&
        !bubbleRef.current.contains(target) &&
        moreMenuRef.current &&
        !moreMenuRef.current.contains(target)
      ) {
        setShowPicker(false);
        setShowMoreMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowPicker(false);
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showPicker, showMoreMenu]);

  const handleCopy = useCallback(async () => {
    if (!message_content) return;
    await copyToClipboard(message_content);
    setShowMoreMenu(false);
  }, [message_content]);

  // ─── Unified reaction handler ────────────────────────────────────────────

  const handleReact = useCallback(
    (emoji: string) => {
      // Trigger animation only on the emoji this user just clicked
      setAnimatingReaction(emoji);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      animTimerRef.current = setTimeout(() => setAnimatingReaction(null), 350);

      onToggleReaction?.(message.message_id, emoji);
      setShowPicker(false);
    },
    [message.message_id, onToggleReaction]
  );

  // ─── 3s Hold to open picker ───────────────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Prevent browser text-selection / scroll from cancelling the hold
    e.preventDefault();
    holdTimerRef.current = setTimeout(() => {
      setShowPicker(true);
    }, 3000);
  };

  const handlePointerUp = () => {
    // Releasing does NOT close the picker — only click-outside does
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handlePointerCancel = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
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
        <div className="flex justify-center my-3 px-4">
          <SystemMessageRenderer message={message} />
        </div>
      </motion.div>
    );
  }

  // ─── Regular message ──────────────────────────────────────────────────────




  return (
    <motion.div
      data-message-id={message.message_id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "relative w-full min-w-0 select-none",
        (showPicker || isActionPickerOpen) && "z-40",
        isFirstInGroup && !showDateDivider ? "mt-3" : "mt-0.5"
      )}
    >
      {showDateDivider && dateLabel && <DateDivider label={dateLabel} />}

      <div
        className={cn(
          "group relative flex w-full min-w-0 flex-col",
          hasReactions ? "mb-3.5" : "mb-0",
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
              {isLastInGroup && otherPartyName ? (
                <Avatar name={otherPartyName} src={otherPartyAvatar} size={28} className="ring-0" />
              ) : null}
            </div>
          )}

        {/* ── Bubble column ─────────────────────────────────────────────── */}
        <div
          className={cn(
            "relative flex max-w-[85%] sm:max-w-[75%] min-w-0 flex flex-col gap-1 break-words",
            isOwn ? "items-end" : "items-start"
          )}
          ref={bubbleRef}
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {/* Sender name for left chat bubble (only on first message in group) */}
          {!isOwn && isFirstInGroup && otherPartyName && (
            <span className="select-none px-1 text-[11px] font-medium text-muted-foreground">
              {otherPartyName}
            </span>
          )}

          {/* ── Floating Reaction Picker ────────────────────────────────── */}
          <AnimatePresence>
            {showPicker && (
              <motion.div
                ref={pickerRef}
                initial={{ opacity: 0, scale: 0.85, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 10 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className={cn(
                  "md:hidden absolute -top-12 z-40 flex items-center gap-1 p-1.5 min-w-max",
                  "bg-card/95 backdrop-blur-md text-card-foreground",
                  "border border-border/80 shadow-2xl rounded-2xl",
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
                      data-emoji={emoji}
                      aria-label={`React with ${emoji}`}
                      onClick={() => handleReact(emoji)}
                      className={cn(
                        "relative h-8 w-8 flex items-center justify-center rounded-xl text-lg max-md:size-11",
                        "transition-colors duration-150 cursor-pointer",
                        isSelected
                          ? "bg-primary/15 border border-primary/30 text-primary scale-110 shadow-xs"
                          : "hover:bg-muted hover:scale-110"
                      )}
                    >
                      {/* AnimatedEmoji fires when picker button is the clicked one */}
                      <AnimatedEmoji
                        emoji={emoji}
                        isAnimating={animatingReaction === emoji}
                      />
                      {isSelected && (
                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content column with individual action rows */}
          <div className={cn("relative flex flex-col gap-1.5 min-w-0 max-w-full", isOwn ? "items-end" : "items-start")}>
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
                    ? "right-0 justify-end bg-card text-foreground border border-border/80 shadow-md"
                    : "left-0 justify-start bg-card text-foreground border border-border/80 shadow-md"
                )}
              >
                {/* Upward arrow indicator pointing to the bubble */}
                <span
                  className={cn(
                    "absolute -top-1 h-2 w-2 rotate-45",
                    isOwn
                      ? "right-3.5 bg-card border-l border-t border-border/80"
                      : "left-3.5 bg-card border-l border-t border-border/80"
                  )}
                />
                {isOwn && message.delivery_status === "failed" ? (
                  <>
                    <AlertCircle className="relative z-10 h-3 w-3 shrink-0 text-destructive" />
                    <span className="relative z-10 text-destructive">Failed to send</span>
                  </>
                ) : isOwn && message.delivery_status === "sending" ? (
                  <>
                    <Loader2 className="relative z-10 h-3 w-3 shrink-0 text-primary animate-spin" />
                    <span className="relative z-10">Sending…</span>
                  </>
                ) : (
                  <>
                    {isOwn && <CheckCheck className="relative z-10 h-3 w-3 shrink-0 text-primary" />}
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
                  "w-fit max-w-full px-4 py-2.5 rounded-2xl text-xs italic leading-relaxed shadow-xs opacity-75 cursor-default select-text",
                  isOwn
                    ? "bg-primary/50 text-primary-foreground/90 rounded-br-md"
                    : "bg-muted/60 text-muted-foreground border border-border/60 rounded-bl-md"
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
                        "relative w-fit max-w-full rounded-2xl leading-relaxed shadow-xs cursor-default select-text",
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-card text-card-foreground border border-border/60 rounded-bl-md"
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
                              ? "bg-primary-foreground/15 hover:bg-primary-foreground/20 text-primary-foreground border-amber-300"
                              : "bg-muted hover:bg-muted/80 text-foreground border-primary"
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <Reply className="h-3 w-3 shrink-0 opacity-80" />
                            <span className={cn("text-[10px] font-bold truncate", isOwn ? "text-amber-300" : "text-primary font-bold")}>
                              {reply_to.sender_id === message.sender_id ? "You" : (reply_to.sender_name && reply_to.sender_name !== "Freelancer" && reply_to.sender_name !== "Client" ? reply_to.sender_name : otherPartyName || reply_to.sender_name || "User")}
                            </span>
                          </div>
                          <span className="truncate text-[11px] opacity-90 line-clamp-1 mt-0.5">
                            {(reply_to.message_content && reply_to.message_content !== "Attachment"
                              ? reply_to.message_content
                              : reply_to.attachments?.[0]?.file_name) ||
                              reply_to.message_content ||
                              "Attachment"}
                          </span>
                        </button>
                      )}

                      {/* Message text */}
                      {message_content && (
                        <div className="px-4 py-2 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]">
                          {message_content}
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
                            "rounded-2xl overflow-hidden shadow-sm border max-w-[220px]",
                            isOwn ? "border-primary/30" : "border-border/60"
                          )}
                        >
                          <Image
                            width={220}
                            height={192}
                            unoptimized
                            src={att.file_path}
                            alt={att.file_name}
                            className="w-full h-auto max-h-48 object-cover cursor-pointer"
                            onClick={() =>
                              setPreviewDoc({ fileName: att.file_name, fileUrl: att.file_path })
                            }
                          />
                          {att.file_name && (
                            <div
                              className={cn(
                                "px-3 py-1.5 text-[10px] flex items-center justify-between gap-1",
                                isOwn
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted/60 text-muted-foreground border-t border-border/40"
                              )}
                            >
                              <div className="flex items-center gap-1 min-w-0">
                                <ImageIcon className="h-3 w-3 shrink-0" />
                                <span className="truncate">{att.file_name}</span>
                              </div>
                              <a
                                href={att.file_path}
                                download={att.file_name}
                                title="Download Image"
                                className="hover:opacity-80 p-0.5 max-md:size-11 max-md:grid max-md:place-items-center"
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
                            "flex items-center gap-2 px-3 py-2 rounded-2xl border shadow-sm max-w-[240px]",
                            isOwn
                              ? "bg-primary border-primary/30 text-primary-foreground rounded-br-md"
                              : "bg-card border-border/60 text-card-foreground rounded-bl-md"
                          )}
                        >
                          <div className={cn("p-1.5 rounded-lg shrink-0", isOwn ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground")}>
                            <FileText className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{att.file_name}</p>
                            {att.file_size && (
                              <p className={cn("text-[10px]", isOwn ? "text-primary-foreground/75" : "text-muted-foreground")}>
                                {formatFileSize(att.file_size)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewDoc({ fileName: att.file_name, fileUrl: att.file_path })
                              }
                              title="Preview Document"
                              className={cn("p-1 rounded-md transition max-md:size-11 max-md:grid max-md:place-items-center", isOwn ? "hover:bg-primary-foreground/15" : "hover:bg-muted")}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <a
                              href={att.file_path}
                              download={att.file_name}
                              title="Download Document"
                              className={cn("p-1 rounded-md transition max-md:size-11 max-md:grid max-md:place-items-center", isOwn ? "hover:bg-primary-foreground/15" : "hover:bg-muted")}
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
          {isOwn && message.delivery_status && (
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
                  key={message.delivery_status}
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="mt-0.5 select-none pr-1 text-[11px] text-zinc-400 dark:text-zinc-500"
                >
                  {message.delivery_status === "sending" ? "Sending…" : "Sent ✓"}
                </motion.span>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>

      {/* ── Document Preview Modal ─────────────────────────────────────── */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="sm:max-w-4xl w-full h-[85vh] flex flex-col p-0 gap-0 overflow-hidden max-md:[&>[data-slot=dialog-close]]:p-3.5 max-md:[&>[data-slot=dialog-close]]:-m-3.5 max-md:h-[85dvh]">
          <DialogHeader className="px-6 py-3.5 border-b shrink-0 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 pr-4">
              <FileText className="h-4 w-4 text-[#14a800] shrink-0" />
              <DialogTitle className="text-sm font-bold truncate">
                {previewDoc?.fileName}
              </DialogTitle>
            </div>
            {previewDoc && (
              <a
                href={previewDoc.fileUrl}
                download={previewDoc.fileName}
                className="mr-8 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14a800] hover:bg-[#118f00] text-white text-xs font-semibold shrink-0 transition"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            )}
          </DialogHeader>
          <div className="flex-1 bg-zinc-100 dark:bg-zinc-950 overflow-hidden relative">
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


"use client";

// src/modules/shared/messaging/components/PinnedMessagesModal.tsx

import React, { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Pin, X, ArrowUpRight, Paperclip } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface PinnedMessageItem {
  message_id: number;
  sender_id: number;
  message_content: string | null;
  message_type?: string;
  created_at: string;
  attachments?: Array<{
    file_name: string;
    file_path: string;
    file_size?: number | null;
    mime_type?: string | null;
  }>;
}

interface PinnedMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  pinnedMessages: PinnedMessageItem[];
  currentUserId: number;
  otherPartyName: string;
  onJumpToMessage?: (messageId: number) => void;
  onTogglePin?: (messageId: number) => void;
}

export default function PinnedMessagesModal({
  isOpen,
  onClose,
  pinnedMessages,
  currentUserId,
  otherPartyName,
  onJumpToMessage,
  onTogglePin,
}: PinnedMessagesModalProps) {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted) return null;

  const formatTimestamp = (raw: string) => {
    try {
      const d = new Date(raw.replace(" ", "T"));
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return raw;
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pinned-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative flex flex-col w-full max-w-2xl h-[580px] max-h-[88vh] rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl dark:bg-zinc-900/95 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Pin className="h-4 w-4" />
                </div>
                <div>
                  <h2 id="pinned-modal-title" className="text-sm font-semibold text-foreground">
                    Pinned Messages
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    {pinnedMessages.length} of 25 messages pinned
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {pinnedMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground mb-2">
                    <Pin className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-medium text-foreground">No pinned messages</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs">
                    Important messages you pin in this conversation will appear here.
                  </p>
                </div>
              ) : (
                pinnedMessages.map((pm) => {
                  const isOwn = pm.sender_id === currentUserId;
                  const hasAttachments = Boolean(pm.attachments && pm.attachments.length > 0);
                  return (
                    <div
                      key={pm.message_id}
                      className="group relative flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card p-3.5 shadow-2xs hover:border-primary/40 hover:bg-primary/[0.02] transition"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onJumpToMessage?.(pm.message_id);
                          onClose();
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-primary">
                            {isOwn ? "You" : otherPartyName}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatTimestamp(pm.created_at)}
                          </span>
                        </div>

                        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-foreground">
                          {pm.message_content || (hasAttachments ? "Shared an attachment" : "")}
                        </p>

                        {hasAttachments && (
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <Paperclip className="h-3 w-3 text-primary" />
                            <span>
                              {pm.attachments!.length} attachment
                              {pm.attachments!.length > 1 ? "s" : ""}
                            </span>
                          </div>
                        )}

                        <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-primary opacity-0 group-hover:opacity-100 transition">
                          <span>Jump to message</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </div>
                      </button>

                      {onTogglePin && (
                        <button
                          type="button"
                          onClick={() => onTogglePin(pm.message_id)}
                          title="Unpin message"
                          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

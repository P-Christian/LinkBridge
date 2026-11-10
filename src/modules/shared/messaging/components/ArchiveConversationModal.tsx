"use client";

// src/modules/shared/messaging/components/ArchiveConversationModal.tsx

import React, { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Archive, ArchiveRestore, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ArchiveConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isArchived: boolean;
  conversationName: string;
  loading?: boolean;
}

export default function ArchiveConversationModal({
  isOpen,
  onClose,
  onConfirm,
  isArchived,
  conversationName,
  loading = false,
}: ArchiveConversationModalProps) {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => !loading && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative w-full max-w-sm rounded-2xl border border-border/80 bg-card/95 text-card-foreground p-6 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-4 ring-primary/10">
                {isArchived ? (
                  <ArchiveRestore className="h-5 w-5" />
                ) : (
                  <Archive className="h-5 w-5" />
                )}
              </div>
              <div>
                <h2 id="archive-modal-title" className="text-base font-semibold text-foreground">
                  {isArchived ? "Move to inbox?" : "Archive conversation?"}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {isArchived
                    ? `This conversation with ${conversationName} will be restored to your active conversations.`
                    : `This conversation with ${conversationName} will be moved to your archive. You can access it anytime from the Archived filter.`}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-xl border border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onConfirm()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing…</span>
                  </>
                ) : (
                  <span>{isArchived ? "Move to inbox" : "Archive"}</span>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

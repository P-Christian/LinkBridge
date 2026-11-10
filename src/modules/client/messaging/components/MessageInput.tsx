"use client";

// src/modules/client/messaging/components/MessageInput.tsx

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Send, Paperclip, X, FileText, ImageIcon, Loader2, AlertCircle, Reply } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { formatFileSize } from "../utils";
import { Message } from "../types";

interface PendingFile {
  file: File;
  preview?: string; // object URL for images
}

interface Props {
  disabled?: boolean;
  uploading?: boolean;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  /** Used to keep an unsent draft per conversation (sessionStorage) */
  draftKey?: string | number;
  onSend: (content: string, files: File[]) => Promise<boolean>;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB, keep in sync with upload endpoint
const ALLOWED_EXT = /\.(pdf|docx?|xlsx?|txt|zip)$/i;

// ─── Draft helpers (never throw: storage can be blocked) ─────────────────────

const draftId = (key: string | number) => `client-messaging-draft:${key}`;

function readDraft(key?: string | number): string {
  if (key === undefined || typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(draftId(key)) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(key: string | number | undefined, value: string) {
  if (key === undefined || typeof window === "undefined") return;
  try {
    if (value) window.sessionStorage.setItem(draftId(key), value);
    else window.sessionStorage.removeItem(draftId(key));
  } catch {
    /* ignore */
  }
}

const isTouchPrimary = () =>
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export default function MessageInput({
  disabled,
  uploading,
  replyingTo,
  onCancelReply,
  draftKey,
  onSend,
}: Props) {
  const [content, setContent] = useState(() => readDraft(draftKey));
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const pendingRef = useRef<PendingFile[]>([]);

  const isBusy = !!(uploading || disabled);
  const canSend = (content.trim().length > 0 || pendingFiles.length > 0) && !isBusy;

  useEffect(() => {
    pendingRef.current = pendingFiles;
  });

  // Revoke object URLs on unmount (the old version captured an empty list and leaked)
  useEffect(() => {
    return () => {
      pendingRef.current.forEach((pf) => pf.preview && URL.revokeObjectURL(pf.preview));
    };
  }, []);

  // Auto-grow the textarea whenever the text changes (typing, draft restore, quick reply, clear)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [content]);

  // Focus on desktop when the chat opens
  useEffect(() => {
    if (!isTouchPrimary()) textareaRef.current?.focus();
  }, []);

  // Auto-dismiss file errors
  useEffect(() => {
    if (!fileError) return;
    const t = setTimeout(() => setFileError(null), 6000);
    return () => clearTimeout(t);
  }, [fileError]);

  const updateContent = (value: string) => {
    setContent(value);
    writeDraft(draftKey, value);
  };

  // ─── Files ────────────────────────────────────────────────────────────────

  const addFiles = useCallback((incoming: File[]) => {
    if (incoming.length === 0) return;

    const problems = new Set<string>();
    const accepted: PendingFile[] = [];
    const room = MAX_FILES - pendingRef.current.length;

    for (const file of incoming) {
      const isImage = file.type.startsWith("image/");
      if (!isImage && !ALLOWED_EXT.test(file.name)) {
        problems.add(`${file.name} isn't a supported file type`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        problems.add(`${file.name} is larger than ${MAX_FILE_SIZE / 1024 / 1024} MB`);
        continue;
      }
      if (accepted.length >= room) {
        problems.add(`You can attach up to ${MAX_FILES} files per message`);
        break;
      }
      accepted.push({ file, preview: isImage ? URL.createObjectURL(file) : undefined });
    }

    if (accepted.length > 0) setPendingFiles((prev) => [...prev, ...accepted]);
    setFileError(problems.size > 0 ? Array.from(problems).join(". ") : null);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    if (isBusy) return;
    setPendingFiles((prev) => {
      const target = prev[index];
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files);
    // Only intercept when it's purely files (e.g. a screenshot); keep normal text paste otherwise.
    if (files.length > 0 && !e.clipboardData.getData("text")) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  const handleDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepthRef.current += 1;
    setDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setDragging(false);
    if (!isBusy) addFiles(Array.from(e.dataTransfer.files));
  };

  // ─── Send ─────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!canSend) return;
    const ok = await onSend(content.trim(), pendingFiles.map((pf) => pf.file));
    if (!ok) return;

    updateContent("");
    pendingFiles.forEach((pf) => pf.preview && URL.revokeObjectURL(pf.preview));
    setPendingFiles([]);
    setFileError(null);
    if (!isTouchPrimary()) textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    // On phones/tablets Enter is a new line; the send button sends.
    if (isTouchPrimary()) return;
    e.preventDefault();
    void handleSend();
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => hasFiles(e) && e.preventDefault()}
      onDrop={handleDrop}
      className="relative shrink-0 border-t border-zinc-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] font-sans dark:border-zinc-800 dark:bg-zinc-900"
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-50/90 text-sm font-medium text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300">
          Drop files to attach
        </div>
      )}

      {/* Replying banner */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            className="overflow-hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={replyingTo.message_id}
                initial={{ opacity: 0, y: 6, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.99 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="mb-2.5 flex items-center justify-between rounded-xl border border-indigo-200/80 bg-indigo-50/80 px-3 py-2 text-xs text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-200"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Reply className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <span className="shrink-0 font-semibold text-[11px] text-indigo-700 dark:text-indigo-300">
                    Replying:
                  </span>
                  <span className="truncate text-[11px] text-zinc-600 dark:text-zinc-400">
                    {replyingTo.message_content ||
                      (replyingTo.attachments?.[0]?.file_name
                        ? `${replyingTo.attachments[0].mime_type?.startsWith("image/") ? "📷" : "📎"} ${replyingTo.attachments[0].file_name}`
                        : "Attachment")}
                  </span>
                </div>
                {onCancelReply && (
                  <button
                    type="button"
                    onClick={onCancelReply}
                    aria-label="Cancel reply"
                    className="ml-2 shrink-0 rounded-lg p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File problems */}
      {fileError && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{fileError}</span>
          <button
            type="button"
            onClick={() => setFileError(null)}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 hover:bg-rose-100 dark:hover:bg-rose-900/40"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Pending files */}
      {pendingFiles.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2 px-1">
          {pendingFiles.map((pf, i) => {
            const Icon = pf.file.type.startsWith("image/") ? ImageIcon : FileText;
            return (
              <li
                key={`${pf.file.name}-${i}`}
                className={cn(
                  "relative flex max-w-[220px] items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-100 py-1.5 pl-2.5 pr-9 dark:border-zinc-700 dark:bg-zinc-800",
                  isBusy && "opacity-60"
                )}
              >
                {pf.preview ? (
                  <Image
                    width={64}
                    height={64}
                    unoptimized
                    src={pf.preview}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/40">
                    <Icon className="h-4 w-4 text-indigo-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {pf.file.name}
                  </p>
                  <p className="text-[11px] text-zinc-500">{formatFileSize(pf.file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  disabled={isBusy}
                  aria-label={`Remove ${pf.file.name}`}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 max-md:size-8 dark:hover:bg-zinc-700"
                >
                  <X className="mx-auto h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Input row */}
      <div className="flex items-end gap-3">
        <div className="relative flex flex-1 items-end rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-1 shadow-2xs transition-all focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-zinc-700/80 dark:bg-zinc-800/80">
          <textarea
            ref={textareaRef}
            rows={1}
            value={content}
            onChange={(e) => updateContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            readOnly={isBusy}
            aria-label="Message"
            placeholder="Write a message..."
            className={cn(
              "min-h-9 flex-1 resize-none overflow-y-auto border-0 bg-transparent py-2 pr-2 leading-relaxed text-zinc-800 placeholder-zinc-400 focus:outline-none max-md:min-h-10 max-md:text-base md:text-sm dark:text-zinc-100",
              isBusy && "opacity-60"
            )}
            style={{ maxHeight: "120px" }}
          />

          {/* Inline Attachment Icon */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            title="Attach file (max 25MB)"
            aria-label="Attach file"
            className="mb-1 shrink-0 rounded-xl p-1.5 text-zinc-400 transition hover:bg-slate-200/50 hover:text-zinc-600 disabled:opacity-40 max-md:grid max-md:size-11 max-md:place-items-center dark:hover:bg-zinc-700/50 dark:hover:text-zinc-200"
          >
            <Paperclip className="h-4.5 w-4.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all",
            canSend
              ? "cursor-pointer bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 active:scale-95"
              : "cursor-not-allowed bg-slate-100 text-slate-300 dark:bg-zinc-800/60 dark:text-zinc-600"
          )}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="ml-0.5 h-4 w-4" />
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
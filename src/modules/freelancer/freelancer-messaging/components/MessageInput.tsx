"use client";

// src/modules/freelancer/freelancer-messaging/components/MessageInput.tsx

import React, { useCallback, useEffect, useRef, useState, KeyboardEvent } from "react";
import { Send, Paperclip, X, FileText, ImageIcon, Loader2, Reply } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Message } from "../types";

interface PendingFile {
  file: File;
  preview?: string;
}

interface Props {
  disabled?: boolean;
  uploading?: boolean;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  onSend: (content: string, files: File[]) => Promise<boolean>;
}

// Keep in sync with the upload endpoint and the client-portal composer.
const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_EXT = /\.(pdf|docx?|xlsx?|txt|zip)$/i;

const TOAST_ID = "freelancer-attachment";

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  return FileText;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MessageInput({
  disabled,
  uploading,
  replyingTo,
  onCancelReply,
  onSend,
}: Props) {
  const [content, setContent] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<PendingFile[]>([]);

  const isBusy = !!(uploading || disabled);
  const canSend = (content.trim().length > 0 || pendingFiles.length > 0) && !isBusy;

  useEffect(() => {
    pendingRef.current = pendingFiles;
  });

  // Read the list back through a ref: this cleanup is registered on mount, when
  // pendingFiles was still empty, so closing the thread used to revoke nothing
  // and leak an object URL per image preview.
  useEffect(() => {
    return () => {
      pendingRef.current.forEach((pf) => pf.preview && URL.revokeObjectURL(pf.preview));
    };
  }, []);

  const addFiles = useCallback((incoming: File[]) => {
    if (incoming.length === 0) return;

    const problems = new Set<string>();
    const accepted: PendingFile[] = [];
    const room = MAX_FILES - pendingRef.current.length;

    for (const file of incoming) {
      const isImage = file.type.startsWith("image/");
      // The accept= hint is only a filter in the picker; drag, paste or a forced
      // file list get through it, and the upload endpoint rejects them later.
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
    if (problems.size > 0) {
      toast.error(Array.from(problems).join(". "), { id: TOAST_ID });
    }
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

  const handleSend = async () => {
    if (!canSend) return;
    const ok = await onSend(content.trim(), pendingFiles.map((pf) => pf.file));
    if (!ok) return;
    setContent("");
    pendingFiles.forEach((pf) => {
      if (pf.preview) URL.revokeObjectURL(pf.preview);
    });
    setPendingFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter also commits an in-progress IME candidate; without this guard the
    // half-typed word was sent as a message.
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void handleSend();
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  };

  return (
    <div className="border-t border-border/60 bg-card p-4 shrink-0 font-sans">
      {/* Replying banner */}
      {replyingTo && (
        <div className="mb-2.5 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
          <div className="flex min-w-0 items-center gap-2">
            <Reply className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="font-semibold text-[11px] text-primary">
              Replying:
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
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
              className="ml-2 shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 px-1">
          {pendingFiles.map((pf, i) => {
            const Icon = getFileIcon(pf.file.type);
            return (
              <div
                key={i}
                className={cn(
                  "relative flex items-center gap-2 pl-2.5 pr-8 py-1.5 rounded-xl bg-muted border border-border/60 max-w-[200px]",
                  isBusy && "opacity-60 grayscale-[0.5]"
                )}
              >
                {pf.preview ? (
                  <Image
                    width={64}
                    height={64}
                    src={pf.preview}
                    alt={pf.file.name}
                    className="h-8 w-8 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {pf.file.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatFileSize(pf.file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  disabled={isBusy}
                  aria-label={`Remove ${pf.file.name}`}
                  className="absolute right-1.5 top-1.5 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition disabled:opacity-50 disabled:cursor-not-allowed max-md:size-11 max-md:grid max-md:place-items-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modern Capsule Input Row */}
      <div className="flex items-center gap-3">
        {/* Input Bar */}
        <div className="flex-1 relative flex items-center rounded-full bg-muted/40 border border-border/60 px-5 py-1.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all shadow-2xs">
          <textarea
            ref={textareaRef}
            rows={1}
            value={content}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            disabled={isBusy}
            placeholder="Type here..."
            className="flex-1 bg-transparent border-0 text-base md:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none overflow-y-auto leading-relaxed py-1.5 pr-2 disabled:opacity-50 min-h-9 max-md:min-h-11"
            style={{ maxHeight: "100px" }}
          />

          {/* Inline Attachment Icon */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            title="Attach file"
            aria-label="Attach file"
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition shrink-0 disabled:opacity-40 max-md:size-11 max-md:grid max-md:place-items-center"
          >
            <Paperclip className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Separate Circular Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center transition-all shrink-0 max-md:size-11",
            canSend
              ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 cursor-pointer shadow-xs"
              : "bg-muted text-muted-foreground/40 cursor-not-allowed"
          )}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
          ) : (
            <Send className="h-4 w-4 text-primary-foreground ml-0.5" />
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

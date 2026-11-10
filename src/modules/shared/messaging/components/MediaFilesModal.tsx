"use client";

// src/modules/shared/messaging/components/MediaFilesModal.tsx

import React, { useState, useMemo, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  X,
  FileText,

  Download,
  Eye,
  Search,
  ArrowUpRight,
  FolderOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DocumentViewer = dynamic(
  () => import("@/components/DocumentViewer").then((mod) => mod.DocumentViewer),
  { ssr: false }
);

export interface AttachmentItem {
  message_id: number;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  mime_type?: string | null;
}

interface MediaFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  allAttachments: AttachmentItem[];
  onJumpToMessage?: (messageId: number) => void;
}

export default function MediaFilesModal({
  isOpen,
  onClose,
  allAttachments,
  onJumpToMessage,
}: MediaFilesModalProps) {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [activeTab, setActiveTab] = useState<"all" | "images" | "docs">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewItem, setPreviewItem] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewItem) {
          setPreviewItem(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, previewItem, onClose]);

  const images = useMemo(() => {
    return allAttachments.filter(
      (a) =>
        a.mime_type?.startsWith("image/") ||
        /\.(png|jpe?g|webp|gif|svg)$/i.test(a.file_name)
    );
  }, [allAttachments]);

  const docs = useMemo(() => {
    return allAttachments.filter(
      (a) =>
        !a.mime_type?.startsWith("image/") &&
        !/\.(png|jpe?g|webp|gif|svg)$/i.test(a.file_name)
    );
  }, [allAttachments]);

  const filteredItems = useMemo(() => {
    const list =
      activeTab === "images"
        ? images
        : activeTab === "docs"
        ? docs
        : allAttachments;

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((item) => item.file_name.toLowerCase().includes(q));
  }, [activeTab, images, docs, allAttachments, searchQuery]);

  if (!mounted) return null;

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImg = (item: AttachmentItem) =>
    item.mime_type?.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(item.file_name);

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="media-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative flex flex-col w-full max-w-4xl h-[650px] max-h-[88vh] rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl dark:bg-zinc-900/95 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FolderOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 id="media-modal-title" className="text-sm font-semibold text-foreground">
                      Media & Files
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      {allAttachments.length} total shared file{allAttachments.length === 1 ? "" : "s"}
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

              {/* Subheader: Tabs & Search */}
              <div className="flex shrink-0 flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 px-6 py-3 bg-muted/20">
                {/* Tabs */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab("all")}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      activeTab === "all"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    All ({allAttachments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("images")}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      activeTab === "images"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    Images ({images.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("docs")}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      activeTab === "docs"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    Documents ({docs.length})
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8.5 w-full rounded-xl border border-border/80 bg-background pl-8.5 pr-3 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-hidden"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Files Grid / List with Tab Motion */}
              <div className="flex-1 overflow-y-auto p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab + (searchQuery ? "-search" : "")}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                  >
                    {filteredItems.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center py-20 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground mb-2">
                          <FileText className="h-5 w-5" />
                        </div>
                        <p className="text-xs font-medium text-foreground">No files found</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {searchQuery ? "Try searching with a different term." : "No files in this category."}
                        </p>
                      </div>
                    ) : activeTab === "images" ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                        {filteredItems.map((item, idx) => (
                          <div
                            key={`${item.message_id}-${idx}`}
                            className="group relative flex flex-col rounded-xl border border-border/60 bg-card overflow-hidden shadow-2xs hover:border-primary/40 transition"
                          >
                            <div
                              className="relative aspect-square w-full cursor-pointer bg-muted/40 overflow-hidden"
                              onClick={() => setPreviewItem({ url: item.file_path, title: item.file_name })}
                            >
                              <Image
                                src={item.file_path}
                                alt={item.file_name}
                                fill
                                unoptimized
                                className="object-cover group-hover:scale-105 transition duration-200"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow-md">
                                  <Eye className="h-4 w-4" />
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-2.5">
                              <span className="truncate text-[11px] font-medium text-foreground" title={item.file_name}>
                                {item.file_name}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <a
                                  href={item.file_path}
                                  download={item.file_name}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                  title="Download"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                                {onJumpToMessage && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onJumpToMessage(item.message_id);
                                      onClose();
                                    }}
                                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-primary"
                                    title="Jump to message"
                                  >
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredItems.map((item, idx) => {
                          const isImage = isImg(item);
                          const ext = item.file_name.split(".").pop()?.toUpperCase() || "FILE";
                          return (
                            <div
                              key={`${item.message_id}-${idx}`}
                              className="group flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs hover:border-primary/40 hover:bg-primary/[0.02] transition"
                            >
                              <div
                                className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer"
                                onClick={() => setPreviewItem({ url: item.file_path, title: item.file_name })}
                              >
                                {isImage ? (
                                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted/40 border border-primary/10 shadow-2xs">
                                    <Image
                                      src={item.file_path}
                                      alt={item.file_name}
                                      fill
                                      unoptimized
                                      className="object-cover group-hover:scale-105 transition duration-200"
                                    />
                                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                      <Eye className="h-4 w-4 text-white drop-shadow-sm" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="relative flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-primary/15 bg-gradient-to-br from-primary/10 via-primary/5 to-info/10 text-primary shadow-2xs group-hover:border-primary/40 group-hover:from-primary/15 transition">
                                    <FileText className="h-4 w-4 opacity-80" />
                                    <span className="text-[9px] font-bold tracking-wider mt-0.5 uppercase font-mono">
                                      {ext.slice(0, 4)}
                                    </span>
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition">
                                    {item.file_name}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-medium text-muted-foreground">
                                      {formatFileSize(item.file_size)}
                                    </span>
                                    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground uppercase font-mono">
                                      {ext}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setPreviewItem({ url: item.file_path, title: item.file_name })}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition"
                                  title="Preview"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                <a
                                  href={item.file_path}
                                  download={item.file_name}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition"
                                  title="Download"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                                {onJumpToMessage && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onJumpToMessage(item.message_id);
                                      onClose();
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground hover:bg-muted hover:text-primary transition"
                                    title="Jump to message"
                                  >
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Smooth Motion Document Preview Modal */}
      <AnimatePresence>
        {previewItem && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-60 flex flex-col bg-black/80 backdrop-blur-md p-4 sm:p-6"
            onClick={() => setPreviewItem(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative flex flex-col w-full h-full max-w-5xl mx-auto rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-muted/40 px-5 py-3">
                <span className="truncate text-xs font-semibold text-foreground max-w-md">
                  {previewItem.title}
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={previewItem.url}
                    download={previewItem.title}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewItem(null)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="relative flex-1 overflow-hidden bg-background">
                <DocumentViewer
                  fileUrl={previewItem.url}
                  fileName={previewItem.title}
                  hideDownloadButton={true}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}

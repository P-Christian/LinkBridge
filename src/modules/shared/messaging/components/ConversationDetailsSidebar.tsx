"use client";

// src/modules/shared/messaging/components/ConversationDetailsSidebar.tsx

import React, { useMemo, useState } from "react";
import Image from "next/image";
import {
  X,

  Pin,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  Flag,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
 
import PinnedMessagesModal from "./PinnedMessagesModal";
import MediaFilesModal from "./MediaFilesModal";
import ArchiveConversationModal from "./ArchiveConversationModal";

export interface ConversationDetailsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  otherPartyName: string;
  otherPartyAvatar?: string | null;
  otherPartySubtitle?: string | null;
  conversationType?: string;
  conversationId: number;
  isArchived?: boolean;
  messages: Array<{
    message_id: number;
    sender_id: number;
    message_content: string | null;
    message_type?: string;
    created_at: string;
    is_pinned?: boolean;
    attachments?: Array<{
      attachment_id?: number;
      file_name: string;
      file_path: string;
      file_size?: number | null;
      mime_type?: string | null;
    }>;
  }>;
  currentUserId: number;
  onJumpToMessage?: (messageId: number) => void;
  onTogglePin?: (messageId: number) => void;
  onRefresh?: () => void;
  onArchive?: () => void;
  onOpenReport?: (messageId?: number | null) => void;
  userRole?: "client" | "freelancer";
}

export default function ConversationDetailsSidebar({
  isOpen,

  otherPartyName,
  otherPartyAvatar,
  otherPartySubtitle,

  isArchived = false,
  messages,
  currentUserId,
  onJumpToMessage,
  onTogglePin,

  onArchive,
  onOpenReport,

  userRole,
}: ConversationDetailsSidebarProps) {
 
  const [chatInfoOpen, setChatInfoOpen] = useState(true);
  const [showPinnedList, setShowPinnedList] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(true);

  // Modals
  const [showAllPinnedModal, setShowAllPinnedModal] = useState(false);
  const [showAllMediaModal, setShowAllMediaModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // Filter pinned messages (cap at 25)
  const pinnedMessages = useMemo(() => {
    return messages.filter((m) => Boolean(m.is_pinned)).slice(0, 25);
  }, [messages]);

  // Sidebar preview: show only the latest 5 pinned messages
  const previewPinnedMessages = useMemo(() => {
    return pinnedMessages.slice(0, 5);
  }, [pinnedMessages]);

  // Extract all media and files from messages
  const allAttachments = useMemo(() => {
    const list: Array<{
      message_id: number;
      file_name: string;
      file_path: string;
      file_size?: number | null;
      mime_type?: string | null;
    }> = [];
    for (const m of messages) {
      if (m.attachments && m.attachments.length > 0) {
        for (const att of m.attachments) {
          list.push({ ...att, message_id: m.message_id });
        }
      }
    }
    return list;
  }, [messages]);

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

  // Sidebar preview: only show latest 5
  const previewImages = useMemo(() => images.slice(0, 5), [images]);
  const previewDocs = useMemo(() => docs.slice(0, 5), [docs]);



  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="conversation-details-aside"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex h-full w-80 md:w-88 max-w-[20rem] md:max-w-[22rem] shrink-0 flex-col border-l border-border/80 bg-card/95 backdrop-blur-xl text-card-foreground shadow-xl overflow-hidden z-20"
            aria-label="Conversation details"
          >
            <div className="w-80 md:w-88 max-w-[20rem] md:max-w-[22rem] flex h-full flex-col overflow-hidden">
              {/* Scrollable details content */}
              <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable] pr-2 pl-4 py-5 space-y-6">
                {/* Identity & Status */}
                <div className="flex flex-col items-center text-center">
                  {otherPartyAvatar ? (
                    <Image
                      src={otherPartyAvatar}
                      alt={otherPartyName}
                      width={80}
                      height={80}
                      unoptimized
                      className="h-20 w-20 rounded-full object-cover ring-4 ring-primary/10 shadow-md"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-primary text-xl font-bold text-white shadow-md ring-4 ring-primary/10">
                      {getInitials(otherPartyName)}
                    </div>
                  )}

                  <h3 className="mt-3 text-base font-semibold text-foreground">
                    {otherPartyName}
                  </h3>

                  {userRole !== "client" && otherPartySubtitle && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                      {otherPartySubtitle}
                    </p>
                  )}
                </div>

                {/* Section 1: Chat info with Animated Accordion */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setChatInfoOpen((v) => !v)}
                    className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
                  >
                    <span>Chat info</span>
                    {chatInfoOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  <AnimatePresence initial={false}>
                    {chatInfoOpen && (
                      <motion.div
                        key="chat-info-content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="pt-1 space-y-2">
                          <button
                            type="button"
                            onClick={() => setShowPinnedList((v) => !v)}
                            className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition"
                          >
                            <div className="flex items-center gap-2.5">
                              <Pin className="h-4 w-4 text-primary" />
                              <span>Pinned messages</span>
                            </div>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              {pinnedMessages.length}/25
                            </span>
                          </button>

                          <AnimatePresence initial={false}>
                            {showPinnedList && (
                              <motion.div
                                key="pinned-list-content"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.18, ease: "easeInOut" }}
                                className="overflow-hidden"
                              >
                                <div className="rounded-xl border border-border/60 bg-muted/40 p-2 space-y-2">
                                  {pinnedMessages.length === 0 ? (
                                    <p className="py-3 text-center text-[11px] text-muted-foreground">
                                      No pinned messages in this chat.
                                    </p>
                                  ) : (
                                    <>
                                      <div className="space-y-2">
                                        {previewPinnedMessages.map((pm) => (
                                          <div
                                            key={pm.message_id}
                                            className="group relative flex items-start justify-between gap-2 rounded-lg bg-card p-2 text-left shadow-2xs hover:border-primary/30 transition border border-transparent"
                                          >
                                            <button
                                              type="button"
                                              onClick={() => onJumpToMessage?.(pm.message_id)}
                                              className="min-w-0 flex-1 text-left"
                                            >
                                              <span className="block text-[10px] font-semibold text-primary">
                                                {pm.sender_id === currentUserId ? "You" : otherPartyName}
                                              </span>
                                              <p className="line-clamp-2 text-xs text-foreground mt-0.5">
                                                {pm.message_content || "Attachment"}
                                              </p>
                                            </button>
                                            {onTogglePin && (
                                              <button
                                                type="button"
                                                onClick={() => onTogglePin(pm.message_id)}
                                                title="Unpin message"
                                                className="shrink-0 p-1 text-zinc-400 hover:text-destructive transition"
                                              >
                                                <X className="h-3 w-3" />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                      </div>

                                      {/* Only show button if more than 5 pinned messages */}
                                      {pinnedMessages.length > 5 && (
                                        <button
                                          type="button"
                                          onClick={() => setShowAllPinnedModal(true)}
                                          className="w-full rounded-lg border border-primary/20 bg-primary/5 py-2 text-center text-xs font-semibold text-primary hover:bg-primary/10 transition"
                                        >
                                          Show more ({pinnedMessages.length - 5} more)
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

             

                {/* Section 2: Media & files with Animated Accordion */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setMediaOpen((v) => !v)}
                    className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
                  >
                    <span>Media & files</span>
                    {mediaOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  <AnimatePresence initial={false}>
                    {mediaOpen && (
                      <motion.div
                        key="media-files-content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="pt-1 space-y-3">
                          {/* Images */}
                          <div>
                            <h4 className="text-[11px] font-medium text-muted-foreground mb-1.5">
                              Images ({images.length})
                            </h4>
                            {previewImages.length === 0 ? (
                              <p className="text-[11px] text-muted-foreground italic">No images shared yet.</p>
                            ) : (
                              <div className="grid grid-cols-3 gap-1.5">
                                {previewImages.map((img, i) => (
                                  <a
                                    key={i}
                                    href={img.file_path}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
                                  >
                                    <Image
                                      src={img.file_path}
                                      alt={img.file_name}
                                      fill
                                      unoptimized
                                      className="object-cover group-hover:scale-105 transition"
                                    />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Docs / Files */}
                          <div>
                            <h4 className="text-[11px] font-medium text-muted-foreground mb-1.5">
                              Documents ({docs.length})
                            </h4>
                            {previewDocs.length === 0 ? (
                              <p className="text-[11px] text-muted-foreground italic">No files shared yet.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {previewDocs.map((doc, i) => (
                                  <a
                                    key={i}
                                    href={doc.file_path}
                                    download={doc.file_name}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-2 text-xs hover:border-primary/30 transition"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                                      <span className="truncate text-foreground text-[11px] font-medium">
                                        {doc.file_name}
                                      </span>
                                    </div>
                                    <Download className="h-3 w-3 shrink-0 text-muted-foreground hover:text-foreground" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Only show button if more than 5 total media & files */}
                          {allAttachments.length > 5 && (
                            <button
                              type="button"
                              onClick={() => setShowAllMediaModal(true)}
                              className="w-full mt-2 rounded-lg border border-primary/20 bg-primary/5 py-2 text-center text-xs font-semibold text-primary hover:bg-primary/10 transition"
                            >
                              Show more media & files ({allAttachments.length - 5} more)
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

             

                {/* Section 3: Privacy & support with Animated Accordion */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setPrivacyOpen((v) => !v)}
                    className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
                  >
                    <span>Privacy & support</span>
                    {privacyOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  <AnimatePresence initial={false}>
                    {privacyOpen && (
                      <motion.div
                        key="privacy-support-content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="pt-1 space-y-1">
                          {onArchive && (
                            <button
                              type="button"
                              onClick={() => setShowArchiveModal(true)}
                              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition"
                            >
                              {isArchived ? (
                                <ArchiveRestore className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Archive className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span>{isArchived ? "Move to inbox" : "Archive conversation"}</span>
                            </button>
                          )}

                          {onOpenReport && (
                            <button
                              type="button"
                              onClick={() => onOpenReport(null)}
                              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/[0.08] transition"
                            >
                              <Flag className="h-4 w-4 text-destructive" />
                              <span>Report conversation</span>
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Pinned Messages Modal */}
      <PinnedMessagesModal
        isOpen={showAllPinnedModal}
        onClose={() => setShowAllPinnedModal(false)}
        pinnedMessages={pinnedMessages}
        currentUserId={currentUserId}
        otherPartyName={otherPartyName}
        onJumpToMessage={onJumpToMessage}
        onTogglePin={onTogglePin}
      />

      {/* Media & Files Modal */}
      <MediaFilesModal
        isOpen={showAllMediaModal}
        onClose={() => setShowAllMediaModal(false)}
        allAttachments={allAttachments}
        onJumpToMessage={onJumpToMessage}
      />

      {/* Archive Confirmation Modal */}
      <ArchiveConversationModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        onConfirm={async () => {
          setShowArchiveModal(false);
          onArchive?.();
        }}
        isArchived={isArchived}
        conversationName={otherPartyName}
      />
    </>
  );
}

"use client";

// src/modules/freelancer/freelancer-messaging/components/ConversationGroupItem.tsx

import React, { useState } from "react";
import { Briefcase, ChevronDown, Archive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Conversation } from "../types";
import { cn } from "@/lib/utils";
import { formatTime, formatEventPreview, getInitials } from "./ConversationItem";
import ArchiveConversationModal from "@/modules/shared/messaging/components/ArchiveConversationModal";

export interface FreelancerConversationGroup {
  groupId: number;
  companyName: string;
  otherPartyAvatar?: string | null;
  latestTimestamp: string | null;
  totalUnread: number;
  items: Conversation[];
}

interface Props {
  group: FreelancerConversationGroup;
  activeConversationId: number | null;
  searchQuery?: string;
  onSelect: (conv: Conversation) => void;
  onArchive: (conversationId: number, nextArchived: boolean) => void;
}

export default function ConversationGroupItem({
  group,
  activeConversationId,
  searchQuery,
  onSelect,
  onArchive,
}: Props) {
  const { companyName, otherPartyAvatar, latestTimestamp, totalUnread, items } = group;

  const [imgError, setImgError] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);

  const hasActive = items.some((c) => c.conversation_id === activeConversationId);
  const [userToggled, setUserToggled] = useState<boolean | null>(null);

  // Automatically expand if this group contains the active conversation or a search query is active
  const isExpanded = userToggled !== null ? userToggled : (hasActive || Boolean(searchQuery?.trim()));

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUserToggled(!isExpanded);
  };

  const archivingConv = items.find((c) => c.conversation_id === archiveTargetId);

  return (
    <div className="border-b border-border/50">
      {/* Group Header Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        className={cn(
          "relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
          hasActive && !isExpanded ? "bg-primary/[0.04]" : "hover:bg-accent/40"
        )}
      >
        {/* Avatar (Company Logo or Initials) */}
        <div className="relative shrink-0 mt-0.5">
          {otherPartyAvatar && !imgError ? (
            <Image
              src={otherPartyAvatar}
              alt={companyName}
              width={40}
              height={40}
              unoptimized
              onError={() => setImgError(true)}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-primary/10 dark:ring-primary/20"
            />
          ) : (
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-primary/10 dark:ring-primary/20",
                "bg-gradient-to-br from-primary/80 to-info text-primary-foreground"
              )}
            >
              {getInitials(companyName)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {companyName}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatTime(latestTimestamp)}
            </span>
          </div>

          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              <Briefcase className="h-3 w-3 shrink-0" />
              <span>{items.length} Job Applications</span>
            </div>

            <div className="flex items-center gap-2">
              {totalUnread > 0 && (
                <span
                  aria-label={`${totalUnread} unread in group`}
                  className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground"
                >
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="shrink-0"
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </div>
          </div>
        </div>
      </button>

      {/* Collapsible Nested Job Threads */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28, mass: 0.8 }}
            className="overflow-hidden bg-muted/20"
          >
            <div className="px-3 py-1.5 space-y-1">
              {items.map((conv, idx) => {
                const isSubActive = conv.conversation_id === activeConversationId;
                const subUnread = conv.unread_count ?? 0;
                const hasSubUnread = subUnread > 0 && !isSubActive;
                const jobTitle = conv.job_title?.trim() || "General Application";
                const { text: previewText } = formatEventPreview(conv.last_message_preview || "");

                return (
                  <motion.div
                    key={conv.conversation_id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: idx * 0.03 }}
                    className="group relative"
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(conv)}
                      aria-current={isSubActive ? "true" : undefined}
                      className={cn(
                        "relative flex w-full items-start gap-2.5 rounded-xl pl-9 pr-3 py-2.5 text-left transition-all duration-150 cursor-pointer",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isSubActive
                          ? "bg-primary/10 dark:bg-primary/15 text-foreground ring-1 ring-primary/25 shadow-xs font-medium"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {/* Smooth active capsule indicator */}
                      {isSubActive && (
                        <motion.span
                          layoutId="activeSubIndicatorFreelancer"
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-1 rounded-full bg-primary"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}

                      <Briefcase className={cn(
                        "h-3.5 w-3.5 shrink-0 mt-0.5 transition-colors",
                        isSubActive ? "text-primary" : "text-muted-foreground"
                      )} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className={cn(
                              "truncate text-xs font-semibold",
                              hasSubUnread
                                ? "text-foreground font-bold"
                                : isSubActive
                                ? "text-primary font-bold"
                                : "text-foreground"
                            )}
                          >
                            {jobTitle}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatTime(conv.last_message_at)}
                          </span>
                        </div>

                        <div className="mt-0.5 flex items-center justify-between gap-1.5">
                          <p className={cn(
                            "min-w-0 flex-1 truncate text-[11px]",
                            isSubActive ? "text-foreground/90 font-medium" : "text-muted-foreground"
                          )}>
                            {previewText || "No messages yet"}
                          </p>

                          {hasSubUnread && (
                            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                              {subUnread > 9 ? "9+" : subUnread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Quick Archive for specific thread */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setArchiveTargetId(conv.conversation_id);
                      }}
                      title={conv.archived_by_freelancer ? "Move to inbox" : "Archive"}
                      aria-label={conv.archived_by_freelancer ? "Move to inbox" : "Archive conversation"}
                      className="absolute right-2 top-2.5 hidden h-6 w-6 items-center justify-center rounded-md border border-border bg-card text-muted-foreground opacity-0 shadow-xs transition hover:bg-muted hover:text-foreground group-hover:opacity-100 md:flex"
                    >
                      <Archive className="h-3 w-3" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Archive Confirmation Modal */}
      {archivingConv && (
        <ArchiveConversationModal
          isOpen={true}
          isArchived={Boolean(archivingConv.archived_by_freelancer)}
          conversationName={archivingConv.job_title || companyName}
          onClose={() => setArchiveTargetId(null)}
          onConfirm={() => {
            onArchive(archivingConv.conversation_id, !archivingConv.archived_by_freelancer);
            setArchiveTargetId(null);
          }}
        />
      )}
    </div>
  );
}

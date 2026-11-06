"use client";

// src/modules/client/messaging/components/ConversationGroupItem.tsx

import React, { useState } from "react";
import { Briefcase, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Conversation } from "../types";
import { cn } from "@/lib/utils";
import { formatListTime } from "../utils";
import Avatar from "./Avatar";
import Highlight from "./Highlight";
import ArchiveConversationModal from "@/modules/shared/messaging/components/ArchiveConversationModal";

export interface ClientConversationGroup {
  groupId: number;
  otherPartyName: string;
  otherPartyAvatar?: string | null;
  latestTimestamp: string | null;
  totalUnread: number;
  items: Conversation[];
}

interface Props {
  group: ClientConversationGroup;
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
  const { otherPartyName, otherPartyAvatar, latestTimestamp, totalUnread, items } = group;

  const hasActive = items.some((c) => c.conversation_id === activeConversationId);
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);

  // Automatically expand if this group contains the active conversation or a search query is active
  const isExpanded = userToggled !== null ? userToggled : (hasActive || Boolean(searchQuery?.trim()));

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUserToggled(!isExpanded);
  };

  const archivingConv = items.find((c) => c.conversation_id === archiveTargetId);

  return (
    <div className="border-b border-zinc-100 dark:border-zinc-800/60">
      {/* Group Header Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        className={cn(
          "relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
          hasActive && !isExpanded
            ? "bg-indigo-50/50 dark:bg-indigo-950/20"
            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
        )}
      >
        <Avatar name={otherPartyName} src={otherPartyAvatar} size={40} className="mt-0.5" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <Highlight text={otherPartyName} query={searchQuery} />
            </span>
            <span className="shrink-0 text-xs text-zinc-400">
              {formatListTime(latestTimestamp)}
            </span>
          </div>

          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
              <Briefcase className="h-3 w-3 shrink-0 text-indigo-500 dark:text-indigo-400" />
              <span>{items.length} Applications</span>
            </div>

            <div className="flex items-center gap-2">
              {totalUnread > 0 && (
                <span
                  aria-label={`${totalUnread} unread in group`}
                  className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold text-white"
                >
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="shrink-0"
              >
                <ChevronDown className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
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
            className="overflow-hidden"
          >
            <div className="py-0.5 space-y-0.5">
              {items.map((conv, idx) => {
                const isSubActive = conv.conversation_id === activeConversationId;
                const subUnread = conv.unread_count ?? 0;
                const hasSubUnread = subUnread > 0 && !isSubActive;
                const title = conv.job_title?.trim() || "General Application";

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
                        "relative flex w-full items-start gap-2.5 px-4 py-2 text-left transition-colors pl-9 cursor-pointer",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                        isSubActive
                          ? "bg-indigo-50/90 text-indigo-950 dark:bg-indigo-950/50 dark:text-indigo-200 font-medium"
                          : "hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-300"
                      )}
                    >
                      {/* Active indicator with smooth shared layout motion */}
                      {isSubActive && (
                        <motion.span
                          layoutId="active-conversation-indicator-client"
                          className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-indigo-600 dark:bg-indigo-400"
                          transition={{ type: "spring", stiffness: 600, damping: 40, mass: 0.2 }}
                        />
                      )}

                      <Briefcase className={cn(
                        "h-3.5 w-3.5 shrink-0 mt-0.5 transition-colors",
                        isSubActive ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400"
                      )} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className={cn(
                              "truncate text-xs font-semibold",
                              hasSubUnread
                                ? "text-zinc-900 dark:text-zinc-50"
                                : isSubActive
                                ? "text-indigo-950 dark:text-indigo-100 font-bold"
                                : "text-zinc-800 dark:text-zinc-200"
                            )}
                          >
                            <Highlight text={title} query={searchQuery} />
                          </span>
                          <span className="shrink-0 text-[11px] text-zinc-400">
                            {formatListTime(conv.last_message_at)}
                          </span>
                        </div>

                        <div className="mt-0.5 flex items-center justify-between gap-1.5">
                          <p className={cn(
                            "min-w-0 flex-1 truncate text-[11px]",
                            isSubActive ? "text-indigo-800/80 dark:text-indigo-300/80" : "text-zinc-500 dark:text-zinc-400"
                          )}>
                            {conv.last_message_preview ? (
                              <Highlight text={conv.last_message_preview} query={searchQuery} />
                            ) : (
                              "No messages yet"
                            )}
                          </p>

                          {hasSubUnread && (
                            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
                              {subUnread > 9 ? "9+" : subUnread}
                            </span>
                          )}
                        </div>
                      </div>
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
          isArchived={Boolean(archivingConv.archived_by_client)}
          conversationName={archivingConv.job_title || otherPartyName}
          onClose={() => setArchiveTargetId(null)}
          onConfirm={() => {
            onArchive(archivingConv.conversation_id, !archivingConv.archived_by_client);
            setArchiveTargetId(null);
          }}
        />
      )}
    </div>
  );
}

"use client";

// src/modules/client/messaging/components/ConversationItem.tsx

import React, { useState } from "react";
import { Archive, ArchiveRestore, Briefcase } from "lucide-react";
import { motion } from "framer-motion";
import { Conversation } from "../types";
import { cn } from "@/lib/utils";
import { formatListTime } from "../utils";
import Avatar from "./Avatar";
import Highlight from "./Highlight";
import ArchiveConversationModal from "@/modules/shared/messaging/components/ArchiveConversationModal";

interface Props {
  conversation: Conversation;
  isActive: boolean;
  searchQuery?: string;
  onSelect: (conv: Conversation) => void;
  onArchive: (conversationId: number, nextArchived: boolean) => void;
}

export default function ConversationItem({
  conversation,
  isActive,
  searchQuery,
  onSelect,
  onArchive,
}: Props) {
  const {
    conversation_id,
    other_party_name,
    other_party_avatar,
    job_title,
    unread_count,
    last_message_preview,
    last_message_at,
    archived_by_client,
  } = conversation;

  const name = other_party_name || "Unknown";
  const unread = unread_count ?? 0;
  const hasUnread = unread > 0 && !isActive;
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  return (
    <div className="group relative border-b border-zinc-100 dark:border-zinc-800/60">
      {/* Main row is a real <button> so keyboard + screen readers work, and the
          archive button below is a sibling (buttons can't be nested). */}
      <button
        type="button"
        onClick={() => onSelect(conversation)}
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
          isActive
            ? "bg-indigo-50/70 dark:bg-indigo-950/30"
            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
        )}
      >
        {isActive && (
          <motion.span
            layoutId="active-conversation-indicator-client"
            className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-indigo-500"
            transition={{ type: "spring", stiffness: 600, damping: 40, mass: 0.2 }}
          />
        )}

        <Avatar name={name} src={other_party_avatar} size={40} className="mt-0.5" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "truncate text-sm",
                hasUnread
                  ? "font-semibold text-zinc-900 dark:text-zinc-50"
                  : "font-medium text-zinc-700 dark:text-zinc-300"
              )}
            >
              <Highlight text={name} query={searchQuery} />
            </span>
            <span
              className={cn(
                "shrink-0 text-xs",
                hasUnread
                  ? "font-medium text-indigo-600 dark:text-indigo-400"
                  : "text-zinc-400"
              )}
            >
              {formatListTime(last_message_at)}
            </span>
          </div>

          {job_title && (
            <div className="mt-0.5 flex items-center gap-1">
              <Briefcase className="h-3 w-3 shrink-0 text-indigo-400" />
              <span className="truncate text-xs font-medium text-indigo-600 dark:text-indigo-400">
                <Highlight text={job_title} query={searchQuery} />
              </span>
            </div>
          )}

          <div className="mt-0.5 flex items-center gap-2">
            <p
              className={cn(
                "min-w-0 flex-1 truncate text-xs",
                hasUnread
                  ? "font-medium text-zinc-700 dark:text-zinc-200"
                  : "text-zinc-500 dark:text-zinc-500"
              )}
            >
              {last_message_preview ? (
                <Highlight text={last_message_preview} query={searchQuery} />
              ) : (
                "Loading..."
              )}
            </p>

            {hasUnread && (
              <span
                aria-label={`${unread} unread`}
                className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold text-white md:group-hover:invisible"
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Archive: desktop hover/focus only. On mobile it lives in the chat header menu. */}
      <button
        type="button"
        onClick={() => setShowArchiveConfirm(true)}
        title={archived_by_client ? "Move to inbox" : "Archive"}
        aria-label={archived_by_client ? "Move to inbox" : "Archive conversation"}
        className="absolute bottom-3 right-3 hidden h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 opacity-0 shadow-xs transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 group-hover:opacity-100 md:flex dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
      >
        {archived_by_client ? (
          <ArchiveRestore className="h-3.5 w-3.5" />
        ) : (
          <Archive className="h-3.5 w-3.5" />
        )}
      </button>

      <ArchiveConversationModal
        isOpen={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        onConfirm={() => {
          setShowArchiveConfirm(false);
          onArchive(conversation_id, !archived_by_client);
        }}
        isArchived={Boolean(archived_by_client)}
        conversationName={name}
      />
    </div>
  );
}
"use client";

// src/modules/client/messaging/components/ConversationList.tsx

import React from "react";
import { Search, MessageSquare, RefreshCw, Archive, X } from "lucide-react";
import { Conversation } from "../types";
import ConversationItem from "./ConversationItem";
import ConversationGroupItem, { ClientConversationGroup } from "./ConversationGroupItem";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread";

interface Props {
  conversations: Conversation[];
  activeConversationId: number | null;
  loading: boolean;
  loadFailed: boolean;
  searchQuery: string;
  showArchived: boolean;
  searchInputRef?: React.Ref<HTMLInputElement>;
  onSelect: (conv: Conversation) => void;
  onArchive: (conversationId: number, nextArchived: boolean) => void;
  onSearch: (q: string) => void;
  onRefresh: () => void;
  onToggleArchived: () => void;
}

export default function ConversationList({
  conversations,
  activeConversationId,
  loading,
  loadFailed,
  searchQuery,
  showArchived,
  searchInputRef,
  onSelect,
  onArchive,
  onSearch,
  onRefresh,
  onToggleArchived,
}: Props) {
  const [filter, setFilter] = React.useState<Filter>("all");

  const q = searchQuery.trim().toLowerCase();

  const filtered = React.useMemo(
    () =>
      conversations.filter((c) => {
        // Keep the open conversation visible even after it's been marked read,
        // otherwise it vanishes from the Unread tab while you're reading it.
        if (
          filter === "unread" &&
          (c.unread_count ?? 0) === 0 &&
          c.conversation_id !== activeConversationId
        ) {
          return false;
        }
        if (!q) return true;
        return (
          c.other_party_name?.toLowerCase().includes(q) ||
          c.job_title?.toLowerCase().includes(q) ||
          c.last_message_preview?.toLowerCase().includes(q)
        );
      }),
    [conversations, filter, q, activeConversationId]
  );

  const grouped = React.useMemo(() => {
    const map = new Map<number, ClientConversationGroup>();

    for (const conv of filtered) {
      const gid = conv.freelancer_id;
      let group = map.get(gid);
      if (!group) {
        group = {
          groupId: gid,
          otherPartyName: conv.other_party_name || "Unknown Candidate",
          otherPartyAvatar: conv.other_party_avatar,
          latestTimestamp: conv.last_message_at,
          totalUnread: 0,
          items: [],
        };
        map.set(gid, group);
      }
      group.items.push(conv);
      group.totalUnread += conv.unread_count ?? 0;
      if (
        conv.last_message_at &&
        (!group.latestTimestamp ||
          new Date(conv.last_message_at.replace(" ", "T")).getTime() >
            new Date(group.latestTimestamp.replace(" ", "T")).getTime())
      ) {
        group.latestTimestamp = conv.last_message_at;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const timeA = a.latestTimestamp ? new Date(a.latestTimestamp.replace(" ", "T")).getTime() : 0;
      const timeB = b.latestTimestamp ? new Date(b.latestTimestamp.replace(" ", "T")).getTime() : 0;
      return timeB - timeA;
    });
  }, [filtered]);

  const unreadConversations = conversations.filter(
    (c) => (c.unread_count ?? 0) > 0 && c.conversation_id !== activeConversationId
  ).length;

  const emptyTitle = searchQuery
    ? "No matches"
    : filter === "unread"
    ? "You're all caught up"
    : showArchived
    ? "No archived conversations"
    : "No conversations yet";

  const emptyBody = searchQuery
    ? "Try a different name, job title, or word from a message."
    : filter === "unread"
    ? "New replies will show up here."
    : showArchived
    ? "Conversations you archive are kept here."
    : "Message a freelancer from the Applicants page to start one.";

  return (
    <div className="flex h-full flex-col border-r border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="border-b border-zinc-100 px-4 pb-3 pt-4 dark:border-zinc-800">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {showArchived ? "Archived" : "Messages"}
          </h2>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleArchived}
              title={showArchived ? "Back to inbox" : "View archived"}
              aria-label={showArchived ? "Back to inbox" : "View archived"}
              aria-pressed={showArchived}
              className={cn(
                "rounded-lg p-1.5 text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 max-md:size-10 max-md:p-0 dark:hover:text-zinc-300",
                showArchived && "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
              )}
            >
              <Archive className="mx-auto h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              title="Refresh"
              aria-label="Refresh conversations"
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 max-md:size-10 max-md:p-0 dark:hover:text-zinc-300"
            >
              <RefreshCw className={cn("mx-auto h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && searchQuery) {
                e.preventDefault();
                onSearch("");
              }
            }}
            placeholder="Search people, jobs, messages"
            aria-label="Search conversations"
            className="w-full rounded-xl border border-zinc-200 bg-zinc-100 py-2 pl-9 pr-8 text-zinc-700 transition placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 max-md:h-10 max-md:text-base md:text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div role="tablist" aria-label="Filter conversations" className="mt-3 flex gap-1">
          {(["all", "unread"] as const).map((value) => {
            const selected = filter === value;
            return (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 max-md:min-h-9",
                  selected
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                )}
              >
                {value === "all" ? "All" : `Unread${unreadConversations > 0 ? ` (${unreadConversations})` : ""}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex flex-col gap-4 p-4" aria-busy="true">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex animate-pulse items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
                  <div className="h-2 w-full rounded bg-zinc-100 dark:bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        ) : loadFailed && conversations.length === 0 ? (
          // Not the same as an empty inbox: this only means the list could not
          // be read, and "No conversations yet" would be a claim about them.
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Your conversations could not be loaded.
            </p>
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800">
              <MessageSquare className="h-7 w-7 text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{emptyTitle}</p>
              <p className="mt-1 text-xs text-zinc-500">{emptyBody}</p>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearch("")}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          grouped.map((group) =>
            group.items.length === 1 ? (
              <ConversationItem
                key={group.items[0].conversation_id}
                conversation={group.items[0]}
                isActive={group.items[0].conversation_id === activeConversationId}
                searchQuery={searchQuery}
                onSelect={onSelect}
                onArchive={onArchive}
              />
            ) : (
              <ConversationGroupItem
                key={`group-${group.groupId}`}
                group={group}
                activeConversationId={activeConversationId}
                searchQuery={searchQuery}
                onSelect={onSelect}
                onArchive={onArchive}
              />
            )
          )
        )}
      </div>
    </div>
  );
}

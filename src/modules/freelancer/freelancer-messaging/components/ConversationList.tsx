"use client";

// src/modules/freelancer/freelancer-messaging/components/ConversationList.tsx

import React from "react";
import { Search, MessageSquare, RefreshCw, Archive } from "lucide-react";
import { Conversation } from "../types";
import ConversationItem from "./ConversationItem";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface Props {
  conversations: Conversation[];
  activeConversationId: number | null;
  loading: boolean;
  searchQuery: string;
  showArchived: boolean;
  currentUserId: number;
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
  searchQuery,
  showArchived,
  currentUserId,
  onSelect,
  onArchive,
  onSearch,
  onRefresh,
  onToggleArchived,
}: Props) {
  const [filterTab, setFilterTab] = React.useState<"ALL" | "UNREAD">("ALL");

  const totalUnread = conversations.filter(
    (c) => (c.unread_count ?? 0) > 0 && c.conversation_id !== activeConversationId
  ).length;

  const filtered = conversations.filter((c) => {
    if (
      filterTab === "UNREAD" &&
      (c.unread_count ?? 0) === 0 &&
      c.conversation_id !== activeConversationId
    ) {
      return false;
    }
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      c.other_party_name?.toLowerCase().includes(q) ||
      c.job_title?.toLowerCase().includes(q) ||
      c.last_message_preview?.toLowerCase().includes(q)
    );
  });

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full border-r border-border/60 bg-card">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">
              Messages
            </span>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggleArchived}
                    aria-label={showArchived ? "Hide archived messages" : "Show archived messages"}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted max-md:size-11 max-md:grid max-md:place-items-center",
                      showArchived &&
                        "bg-primary/10 text-primary"
                    )}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {showArchived ? "Hide archived" : "Show archived"}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onRefresh}
                    disabled={loading}
                    aria-label="Refresh conversations"
                    className="p-1.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 max-md:size-11 max-md:grid max-md:place-items-center"
                  >
                    <RefreshCw
                      className={cn("h-3.5 w-3.5", loading && "animate-spin")}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Refresh
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-base md:text-xs bg-muted/50 border border-border/60 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition max-md:min-h-11"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/60 px-4 py-2 gap-2 bg-muted/20 shrink-0">
        <button
          onClick={() => setFilterTab("ALL")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm md:text-xs font-medium transition-colors max-md:min-h-11",
            filterTab === "ALL"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          All
        </button>
        <button
          onClick={() => setFilterTab("UNREAD")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm md:text-xs font-medium transition-colors flex items-center gap-1.5 max-md:min-h-11",
            filterTab === "UNREAD"
              ? "bg-primary text-primary-foreground font-semibold"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          Unread
          {totalUnread > 0 && (
            <span className={cn(
              "h-4 min-w-4 px-1 flex items-center justify-center rounded-full text-[9px] font-bold",
              filterTab === "UNREAD" ? "bg-primary-foreground text-primary" : "bg-destructive/15 text-destructive"
            )}>
              {totalUnread}
            </span>
          )}
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 rounded bg-muted" />
                  <div className="h-2 w-full rounded bg-muted/60" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16 px-6 text-center">
            <div className="p-4 rounded-2xl bg-muted/60">
              <MessageSquare className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {searchQuery ? "No results found" : showArchived ? "No archived messages" : "No messages yet"}
              </p>
              <p className="text-sm md:text-xs text-muted-foreground mt-1">
                {searchQuery
                  ? "Try a different search term"
                  : "When employers message you about your applications, they will appear here."}
              </p>
            </div>
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationItem
              key={conv.conversation_id}
              conversation={conv}
              isActive={conv.conversation_id === activeConversationId}
              currentUserId={currentUserId}
              onSelect={onSelect}
              onArchive={onArchive}
            />
          ))
        )}
      </div>
    </div>
  </TooltipProvider>
  );
}

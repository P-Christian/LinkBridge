"use client";

// src/modules/freelancer/freelancer-messaging/components/ConversationList.tsx

import React from "react";
import { Search, MessageSquare, RefreshCw, Archive } from "lucide-react";
import { Conversation } from "../types";
import ConversationItem from "./ConversationItem";
import ConversationGroupItem, { FreelancerConversationGroup } from "./ConversationGroupItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { LayoutGroup, motion, AnimatePresence } from "framer-motion";
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

  const filtered = React.useMemo(() => {
    return conversations.filter((c) => {
      if (
        filterTab === "UNREAD" &&
        (c.unread_count ?? 0) === 0 &&
        c.conversation_id !== activeConversationId
      ) {
        return false;
      }
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        c.company_name?.toLowerCase().includes(q) ||
        c.other_party_name?.toLowerCase().includes(q) ||
        c.job_title?.toLowerCase().includes(q) ||
        c.last_message_preview?.toLowerCase().includes(q)
      );
    });
  }, [conversations, filterTab, activeConversationId, searchQuery]);

  const grouped = React.useMemo(() => {
    const map = new Map<number, FreelancerConversationGroup>();

    for (const conv of filtered) {
      const gid = conv.client_id;
      let group = map.get(gid);
      if (!group) {
        group = {
          groupId: gid,
          companyName: conv.company_name || conv.other_party_name || "Unknown Company",
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
            "relative px-3 py-1.5 rounded-lg text-sm md:text-xs font-medium transition-colors max-md:min-h-11",
            filterTab === "ALL"
              ? "text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {filterTab === "ALL" && (
            <motion.span
              layoutId="activeFilterTabFreelancer"
              className="absolute inset-0 rounded-lg bg-muted shadow-2xs"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <span className="relative z-10">All</span>
        </button>
        <button
          onClick={() => setFilterTab("UNREAD")}
          className={cn(
            "relative px-3 py-1.5 rounded-lg text-sm md:text-xs font-medium transition-colors flex items-center gap-1.5 max-md:min-h-11",
            filterTab === "UNREAD"
              ? "text-primary-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {filterTab === "UNREAD" && (
            <motion.span
              layoutId="activeFilterTabFreelancer"
              className="absolute inset-0 rounded-lg bg-primary shadow-2xs"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5">
            Unread
            {totalUnread > 0 && (
              <span className={cn(
                "h-4 min-w-4 px-1 flex items-center justify-center rounded-full text-[9px] font-bold",
                filterTab === "UNREAD" ? "bg-primary-foreground text-primary" : "bg-destructive/15 text-destructive"
              )}>
                {totalUnread}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-3 p-4"
            >
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 rounded bg-muted" />
                    <div className="h-2 w-full rounded bg-muted/60" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              key={`empty-${filterTab}-${searchQuery ? "search" : "idle"}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex flex-col items-center justify-center h-full gap-3 py-16 px-6 text-center"
            >
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
            </motion.div>
          ) : (
            <motion.div
              key={`list-${filterTab}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <LayoutGroup id="freelancer-conversations">
                {grouped.map((group) =>
                  group.items.length === 1 ? (
                    <ConversationItem
                      key={group.items[0].conversation_id}
                      conversation={group.items[0]}
                      isActive={group.items[0].conversation_id === activeConversationId}
                      currentUserId={currentUserId}
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
                )}
              </LayoutGroup>
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </div>
  </TooltipProvider>
  );
}

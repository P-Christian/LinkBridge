"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
 
  Building,
  User,
  Calendar,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Inbox,
  X,
} from "lucide-react";
import type {
  ContactMessage,
  ContactMessageStatus,
  ContactMessageStatusCounts,
} from "../types/contact-message.types";
import { formatWallClock } from "@/lib/utils";

interface ContactMessageListProps {
  messages: ContactMessage[];
  total: number;
  loading: boolean;
  error: string | null;
  statusFilter: ContactMessageStatus | "all";
  search: string;
  page: number;
  pageSize: number;
  statusCounts: ContactMessageStatusCounts | null;
  onStatusFilterChange: (status: ContactMessageStatus | "all") => void;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  onSelectMessage: (id: number) => void;
  onRetry: () => void;
}

const STATUS_BADGES: Record<ContactMessageStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-info/15 text-info border-info/30" },
  read: { label: "Read", className: "bg-primary/10 text-primary border-primary/20" },
  resolved: {
    label: "Resolved",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  archived: { label: "Archived", className: "bg-muted text-muted-foreground border-border" },
};

export function ContactMessageList({
  messages,
  total,
  loading,
  error,
  statusFilter,
  search,
  page,
  pageSize,
  statusCounts,
  onStatusFilterChange,
  onSearchChange,
  onPageChange,
  onSelectMessage,
  onRetry,
}: ContactMessageListProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filterTabs: Array<{ id: ContactMessageStatus | "all"; label: string; badge?: number }> = [
    { id: "all", label: "All Messages", badge: statusCounts?.all },
    { id: "new", label: "New", badge: statusCounts?.new },
    { id: "read", label: "Read", badge: statusCounts?.read },
    { id: "resolved", label: "Resolved", badge: statusCounts?.resolved },
    { id: "archived", label: "Archived", badge: statusCounts?.archived },
  ];

  return (
    <div className="space-y-4">
      {/* Search and Filters Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-card/70 p-3.5 rounded-2xl border border-primary/10 backdrop-blur-xl shadow-xs">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
          {filterTabs.map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusFilterChange(tab.id)}
                className={`relative px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-primary/5 bg-background/50 border border-border/50"
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.badge === "number" && tab.badge > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-info/15 text-info"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search sender, subject..."
            className="pl-8 pr-8 h-9 text-xs rounded-xl border-border/80 bg-background/60 focus-visible:ring-primary/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-primary/10 bg-card/60 p-4 space-y-2 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-48 rounded" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-72 rounded" />
              <Skeleton className="h-3 w-full rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm font-semibold text-destructive">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="rounded-full text-xs h-8 px-4 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </Button>
        </div>
      ) : messages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center space-y-3">
          <Inbox className="h-10 w-10 text-muted-foreground/60 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">No contact messages found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {search || statusFilter !== "all"
                ? "No submissions matched your search or status filter. Try clearing filters to see all messages."
                : "Your contact inbox is currently empty. Incoming inquiries from the public contact page will show up here."}
            </p>
          </div>
          {(search || statusFilter !== "all") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onSearchChange("");
                onStatusFilterChange("all");
              }}
              className="rounded-full text-xs h-8 px-4"
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {messages.map((item) => {
            const badge = STATUS_BADGES[item.status] || STATUS_BADGES.read;
            const isNew = item.status === "new";

            return (
              // A real button, not a div with a click handler: keyboard users
              // get it for free, and its accessible name is the row's own text
              // (subject, sender, snippet, date) rather than a label that hides
              // that content from a screen reader.
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectMessage(item.id)}
                className={`group relative w-full text-left rounded-2xl border p-4 transition-all duration-200 cursor-pointer backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  isNew
                    ? "bg-card/90 border-primary/30 shadow-xs hover:border-primary/50 hover:bg-card/95"
                    : "bg-card/60 border-primary/10 hover:border-primary/30 hover:bg-card/80"
                }`}
              >
                {/* Left side: Subject, Sender, Snippet. Spans, not divs/p: a
                    button may only contain phrasing content. */}
                <span className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                      {item.subject}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold rounded-full px-2 py-0 border ${badge.className}`}
                    >
                      {badge.label}
                    </Badge>
                    {item.user_role && (
                      <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/40 uppercase">
                        {item.user_role}
                      </span>
                    )}
                  </span>

                  <span className="block text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                    {item.message}
                  </span>

                  <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-0.5">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <User className="h-3 w-3 text-primary/70" />
                      {item.name}
                    </span>
                    <span>•</span>
                    <span>{item.email}</span>
                    {item.company && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3 text-muted-foreground/70" />
                          {item.company}
                        </span>
                      </>
                    )}
                  </span>
                </span>

                {/* Right side: Date & View Button */}
                <span className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatWallClock(item.created_at)}
                  </span>
                  {/* The row itself opens the message, so this pill is a cue and
                      not a second control for the same action. */}
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center gap-1.5 rounded-full h-8 px-3.5 text-xs font-medium border border-primary/20 bg-card/60 text-foreground transition-colors group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Review
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2">
          <span className="text-xs text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} messages
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
              className="rounded-full h-8 px-3 text-xs gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <span className="text-xs font-semibold px-2">
              {page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
              className="rounded-full h-8 px-3 text-xs gap-1"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

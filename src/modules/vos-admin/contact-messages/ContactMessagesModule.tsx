"use client";

import React from "react";
import { useContactMessages } from "./hooks/useContactMessages";
import { ContactMessageList } from "./components/ContactMessageList";
import { ContactMessageDetailModal } from "./components/ContactMessageDetailModal";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  RefreshCw,
  Inbox,
  CheckCircle2,
  Clock,
} from "lucide-react";

export function ContactMessagesModule() {
  const {
    messages,
    total,
    unreadCount,
    statusCounts,
    loading,
    error,
    filters,
    searchInput,
    selectedId,
    selectedMessage,
    detailLoading,
    updating,
    setStatusFilter,
    setSearch,
    setPage,
    selectMessage,
    updateMessage,
    deleteMessage,
    refresh,
  } = useContactMessages();

  return (
    <div className="flex flex-col p-6 md:p-8 max-w-[1600px] mx-auto w-full overflow-y-auto h-full min-h-0 space-y-6 admin-page-transition">
      <style>{`
        @keyframes page-entry {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .admin-page-transition {
          animation: page-entry 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Clean Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
        
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Contact Messages
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Review, triage, and manage incoming inquiries submitted through the public Contact Us page.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="rounded-full gap-2 text-xs h-9 px-4 cursor-pointer hover:bg-primary/5 hover:text-primary transition-colors border-primary/20"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-primary/10 bg-card/70 backdrop-blur-xl p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Inquiries</span>
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Inbox className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {statusCounts ? statusCounts.all : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground">Active submissions, excluding deleted</p>
        </div>

        <div className="rounded-2xl border border-info/20 bg-card/70 backdrop-blur-xl p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-info">New / Unread</span>
            <div className="p-1.5 rounded-lg bg-info/10 text-info">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-info">
            {statusCounts ? unreadCount : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground">Awaiting initial administrative review</p>
        </div>

        <div className="rounded-2xl border border-primary/10 bg-card/70 backdrop-blur-xl p-5 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Resolved & Archived
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {statusCounts ? statusCounts.resolved + statusCounts.archived : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground">Answered, or filed away with no action</p>
        </div>
      </div>

      {/* Messages List View */}
      <ContactMessageList
        messages={messages}
        total={total}
        loading={loading}
        error={error}
        statusFilter={filters.status}
        search={searchInput}
        page={filters.page}
        pageSize={filters.pageSize}
        statusCounts={statusCounts}
        onStatusFilterChange={setStatusFilter}
        onSearchChange={setSearch}
        onPageChange={setPage}
        onSelectMessage={selectMessage}
        onRetry={refresh}
      />

      {/* Message Detail Modal */}
      <ContactMessageDetailModal
        message={selectedMessage}
        isOpen={selectedId !== null}
        loading={detailLoading}
        onClose={() => selectMessage(null)}
        onUpdate={updateMessage}
        onDelete={deleteMessage}
        updating={updating}
      />
    </div>
  );
}

"use client";

// src/modules/client/notifications/NotificationsModule.tsx

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MotionConfig, motion } from "framer-motion";
import {
  Bell,
  CheckCheck,
  ChevronDown,
  Layers,
  Mail,
  MailOpen,
  Search,
  Settings2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "./hooks/useNotifications";
import { useRealtime } from "@/modules/shared/providers/RealtimeProvider";
import NotificationList from "./components/NotificationList";
import { cn } from "@/lib/utils";

// Notification preferences live in the Settings page — open that tab directly.
const SETTINGS_HREF = "/vos-sync/client/settings?tab=notifications";

type FilterTab = "ALL" | "UNREAD" | "STARRED";

interface FilterTabOption {
  label: string;
  value: FilterTab;
  icon: React.ElementType;
}

const FILTER_TABS: FilterTabOption[] = [
  { label: "All", value: "ALL", icon: Layers },
  { label: "Unread", value: "UNREAD", icon: Bell },
  { label: "Starred", value: "STARRED", icon: Star },
];

const PILL_SPRING = { type: "spring", stiffness: 500, damping: 36 } as const;

export default function NotificationsModule() {
  const router = useRouter();
  const {
    notifications,
    loading,
    saving,
    unreadCount,
    starredCount,
    loadNotifications,
    markRead,
    toggleReadStatus,
    toggleStarredStatus,
    bulkSetRead,
    bulkSetStarred,
    bulkDelete,
    markAllRead,
  } = useNotifications();

  const { subscribe } = useRealtime();

  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Live updates
  useEffect(() => {
    const unsubscribe = subscribe("vs_employer_notification", ({ data }) => {
      if (data && data.length > 0) {
        loadNotifications({ quiet: true });
      }
    });
    return () => unsubscribe();
  }, [subscribe, loadNotifications]);

  // Reset selection when tab or search query changes (adjusted during render, no effect needed)
  const filterKey = `${activeTab}-${searchQuery}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setSelectedIds(new Set());
  }

  const handleClearFilters = () => {
    setActiveTab("ALL");
    setSearchQuery("");
  };

  const tabCounts: Record<FilterTab, number> = {
    ALL: notifications.length,
    UNREAD: unreadCount,
    STARRED: starredCount,
  };

  const filteredNotifications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return notifications.filter((n) => {
      if (activeTab === "UNREAD" && n.is_read) return false;
      if (activeTab === "STARRED" && !n.is_starred) return false;

      if (q) {
        const matchTitle = n.title?.toLowerCase().includes(q);
        const matchMessage = n.message?.toLowerCase().includes(q);
        if (!matchTitle && !matchMessage) return false;
      }

      return true;
    });
  }, [notifications, activeTab, searchQuery]);

  const isFiltered = activeTab !== "ALL" || searchQuery.trim().length > 0;

  // Only show the skeleton on the first load, not on every realtime refresh
  const showSkeleton = loading && notifications.length === 0;

  // ─── Multi-select computations & handlers ─────────────────────────────

  const filteredIds = useMemo(
    () => filteredNotifications.map((n) => n.notification_id),
    [filteredNotifications]
  );

  const readIdsInView = useMemo(
    () =>
      filteredNotifications
        .filter((n) => n.is_read)
        .map((n) => n.notification_id),
    [filteredNotifications]
  );

  const unreadIdsInView = useMemo(
    () =>
      filteredNotifications
        .filter((n) => !n.is_read)
        .map((n) => n.notification_id),
    [filteredNotifications]
  );

  const starredIdsInView = useMemo(
    () =>
      filteredNotifications
        .filter((n) => n.is_starred)
        .map((n) => n.notification_id),
    [filteredNotifications]
  );

  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;
  const isAllSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const hasSomeSelected =
    !isAllSelected && filteredIds.some((id) => selectedIds.has(id));

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleMasterToggle = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIds));
    }
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredIds));
  };

  const handleSelectNone = () => {
    setSelectedIds(new Set());
  };

  const handleSelectRead = () => {
    setSelectedIds(new Set(readIdsInView));
  };

  const handleSelectUnread = () => {
    setSelectedIds(new Set(unreadIdsInView));
  };

  const handleSelectStarred = () => {
    setSelectedIds(new Set(starredIdsInView));
  };

  // ─── Bulk Actions ─────────────────────────────────────────────────────

  const handleBulkMarkRead = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await bulkSetRead(ids, true);
    setSelectedIds(new Set());
  };

  const handleBulkMarkUnread = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await bulkSetRead(ids, false);
    setSelectedIds(new Set());
  };

  const handleBulkStar = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await bulkSetStarred(ids, true);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await bulkDelete(ids);
    setSelectedIds(new Set());
  };

  return (
    // reducedMotion="user" turns off movement (but keeps fades) for people who prefer less motion
    <MotionConfig reducedMotion="user">
      <div className="space-y-4 md:space-y-6 client-page-transition">
        <style>{`
          @keyframes page-entry {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .client-page-transition {
            animation: page-entry 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          @media (prefers-reduced-motion: reduce) {
            .client-page-transition { animation: none; }
          }
        `}</style>

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? `You have ${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"}.`
                : "Stay updated on candidate activity, interviews, and team communications."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                onClick={markAllRead}
                disabled={saving}
                variant="outline"
                size="sm"
                aria-label="Mark all as read"
                className="h-9 max-md:size-10 max-md:px-0 cursor-pointer text-xs font-medium"
              >
                <CheckCheck className="h-4 w-4 md:mr-1.5 text-primary" />
                <span className="max-md:hidden">Mark all as read</span>
              </Button>
            )}
            <Button
              onClick={() => router.push(SETTINGS_HREF)}
              variant="ghost"
              size="sm"
              aria-label="Notification settings"
              className="h-9 max-md:size-10 max-md:px-0 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="h-4 w-4 md:mr-1.5" />
              <span className="max-md:hidden">Settings</span>
            </Button>
          </div>
        </div>

        {/* ── Feed Card ─────────────────────────────────────────────────── */}
        <Card className="gap-0 overflow-hidden rounded-xl border bg-card !py-0 shadow-sm">
          <CardContent className="p-0">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 border-b border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Filter tab bar */}
              <div
                role="group"
                aria-label="Filter notifications"
                className="scrollbar-none -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5"
              >
                {FILTER_TABS.map((opt) => {
                  const Icon = opt.icon;
                  // Before the first fetch the list is empty, so every pill would
                  // claim 0; the badge stays hidden until there is something to count.
                  const count = showSkeleton ? undefined : tabCounts[opt.value];
                  const isSelected = activeTab === opt.value;

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setActiveTab(opt.value)}
                      className={cn(
                        "relative flex shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full border px-3 py-1.5 max-md:min-h-10 text-xs font-medium transition-colors",
                        isSelected
                          ? "border-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {/* Sliding highlight that follows the selected tab */}
                      {isSelected && (
                        <motion.span
                          layoutId="notifications-filter-pill"
                          transition={PILL_SPRING}
                          className="absolute inset-0 rounded-full bg-primary"
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <Icon className={cn("h-3.5 w-3.5", opt.value === "STARRED" && isSelected && "fill-current")} />
                        {opt.label}
                        {typeof count === "number" && (
                          <span
                            className={cn(
                              "min-w-4 text-center text-xs md:text-[10px] font-bold transition-colors",
                              isSelected
                                ? "text-primary-foreground/80"
                                : count === 0
                                  ? "text-muted-foreground/40"
                                  : "text-muted-foreground/70"
                            )}
                          >
                            {count > 99 ? "99+" : count}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <div className="relative w-full shrink-0 lg:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by candidate, job, or keyword..."
                  aria-label="Search notifications"
                  className="h-9 rounded-lg border-border bg-background pl-9 pr-9 md:text-xs max-md:h-10 max-md:text-base"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground max-md:size-10 max-md:right-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* ── Selection & Bulk Action Header ─────────────────────────── */}
            {!showSkeleton && filteredNotifications.length > 0 && (
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2 text-xs transition-colors",
                  hasSelection ? "bg-primary/[0.04] dark:bg-primary/[0.08]" : "bg-muted/30"
                )}
              >
                <div className="flex items-center gap-2">
                  {/* Master Checkbox + Dropdown */}
                  <div className="flex items-center">
                    <Checkbox
                      checked={
                        isAllSelected
                          ? true
                          : hasSomeSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={handleMasterToggle}
                      aria-label="Select all notifications"
                      className="cursor-pointer"
                    />

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-6 text-muted-foreground hover:text-foreground cursor-pointer ml-0.5"
                          aria-label="Selection options"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-36 text-xs">
                        <DropdownMenuItem onClick={handleSelectAll} className="cursor-pointer">
                          All ({filteredNotifications.length})
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleSelectNone} className="cursor-pointer">
                          None
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleSelectRead} className="cursor-pointer">
                          Read ({readIdsInView.length})
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleSelectUnread} className="cursor-pointer">
                          Unread ({unreadIdsInView.length})
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleSelectStarred} className="cursor-pointer">
                          Starred ({starredIdsInView.length})
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {hasSelection ? (
                    <span className="font-semibold text-foreground">
                      {selectedCount} selected
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Select
                    </span>
                  )}
                </div>

                {/* Bulk Actions */}
                {hasSelection && (
                  <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkMarkRead}
                      className="h-8 gap-1.5 cursor-pointer text-xs font-medium"
                      title="Mark selected as read"
                    >
                      <MailOpen className="h-3.5 w-3.5 text-primary" />
                      <span className="max-sm:hidden">Mark as read</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkMarkUnread}
                      className="h-8 gap-1.5 cursor-pointer text-xs font-medium"
                      title="Mark selected as unread"
                    >
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="max-sm:hidden">Mark as unread</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkStar}
                      className="h-8 gap-1.5 cursor-pointer text-xs font-medium"
                      title="Star selected"
                    >
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      <span className="max-sm:hidden">Star</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDelete}
                      className="h-8 gap-1.5 cursor-pointer text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete selected"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="max-sm:hidden">Delete</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectNone}
                      className="h-8 px-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                      title="Clear selection"
                    >
                      <X className="h-3.5 w-3.5 sm:mr-1" />
                      <span className="max-sm:hidden">Cancel</span>
                    </Button>
                  </div>
                )}
              </div>
            )}

            <NotificationList
              resetKey={`${activeTab}-${searchQuery.trim()}`}
              notifications={filteredNotifications}
              loading={showSkeleton}
              onMarkRead={markRead}
              onToggleRead={toggleReadStatus}
              onToggleStar={toggleStarredStatus}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              isFiltered={isFiltered}
              onClearFilters={handleClearFilters}
            />
          </CardContent>
        </Card>
      </div>
    </MotionConfig>
  );
}

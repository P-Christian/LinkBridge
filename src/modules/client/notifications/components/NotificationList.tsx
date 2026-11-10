"use client";

// src/modules/client/notifications/components/NotificationList.tsx

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BellOff, SearchX } from "lucide-react";
import { Notification } from "../types";
import NotificationItem from "./NotificationItem";
import { Button } from "@/components/ui/button";

interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  onMarkRead: (id: number) => void;
  onToggleRead?: (id: number, currentReadStatus: boolean) => void;
  onToggleStar?: (id: number, currentStarredStatus: boolean) => void;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  isFiltered?: boolean;
  onClearFilters?: () => void;
  /** Changes whenever the active filters change; resets "show more" back to one page */
  resetKey?: string;
}

type DateGroupKey = "Today" | "Yesterday" | "This Week" | "Earlier";

type Row =
  | { type: "header"; key: string; label: DateGroupKey; count: number }
  | { type: "item"; key: string; notification: Notification };

const PAGE_SIZE = 20;
const GROUP_ORDER: DateGroupKey[] = ["Today", "Yesterday", "This Week", "Earlier"];

// Rows stagger in slightly, capped so long lists don't feel slow.
const MAX_STAGGER_INDEX = 8;
const STAGGER_STEP = 0.025;

function getDateGroupKey(dateStr: string): DateGroupKey {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Earlier";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "This Week";
  return "Earlier";
}

/**
 * Motion shared by every row (headers, items and the empty state).
 * - enter: fade + rise, lightly staggered by position
 * - exit:  fade + slide left (the row is popped out of flow so the rest can glide up)
 * - layout: remaining rows spring to their new position
 */
function rowMotion(index: number) {
  const delay = Math.min(index, MAX_STAGGER_INDEX) * STAGGER_STEP;
  return {
    layout: "position" as const,
    initial: { opacity: 0, y: 10 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        opacity: { duration: 0.2, delay },
        y: { duration: 0.25, delay, ease: "easeOut" as const },
      },
    },
    exit: {
      opacity: 0,
      x: -16,
      transition: { duration: 0.15, ease: "easeIn" as const },
    },
    transition: {
      layout: { type: "spring" as const, stiffness: 500, damping: 42 },
    },
  };
}

function NotificationSkeleton() {
  return (
    <div className="divide-y divide-border/40" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading notifications...</span>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-start gap-3.5 px-5 py-4 max-md:px-4">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-muted" />
          <div className="flex-1 space-y-2.5 pt-0.5">
            <div className="h-3.5 w-2/5 rounded bg-muted" />
            <div className="h-3 w-4/5 rounded bg-muted/70" />
            <div className="h-2.5 w-24 rounded bg-muted/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationList({
  notifications,
  loading,
  onMarkRead,
  onToggleRead,
  onToggleStar,
  selectedIds,
  onToggleSelect,
  isFiltered = false,
  onClearFilters,
  resetKey = "",
}: NotificationListProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);

  // Reset pagination when filters change (state adjusted during render, no effect needed)
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setVisibleCount(PAGE_SIZE);
  }

  const visible = useMemo(
    () => notifications.slice(0, visibleCount),
    [notifications, visibleCount]
  );
  const remaining = notifications.length - visible.length;

  // One flat list of header + item rows, so a single AnimatePresence can
  // animate every row (and the group headers) in and out.
  const rows = useMemo<Row[]>(() => {
    const buckets: Record<DateGroupKey, Notification[]> = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Earlier: [],
    };
    visible.forEach((n) => buckets[getDateGroupKey(n.created_at)].push(n));

    const result: Row[] = [];
    GROUP_ORDER.forEach((label) => {
      const items = buckets[label];
      if (items.length === 0) return;
      result.push({ type: "header", key: `header-${label}`, label, count: items.length });
      items.forEach((notification) =>
        result.push({
          type: "item",
          key: `item-${notification.notification_id}`,
          notification,
        })
      );
    });
    return result;
  }, [visible]);

  if (loading) return <NotificationSkeleton />;

  const isEmpty = notifications.length === 0;

  return (
    <div>
      {/* `relative` is required so popped (exiting) rows keep their position */}
      <div className="relative">
        <AnimatePresence initial={false} mode="popLayout">
          {isEmpty ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.25, delay: 0.1 } }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                {isFiltered ? (
                  <SearchX className="h-6 w-6 text-muted-foreground" />
                ) : (
                  <BellOff className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="max-w-sm space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {isFiltered ? "No notifications match your filters" : "You're all caught up"}
                </p>
                <p className="text-sm md:text-xs text-muted-foreground">
                  {isFiltered
                    ? "Try a different search, category, or switch back to all notifications."
                    : "We'll let you know when candidates apply or interviews change."}
                </p>
              </div>

              {isFiltered && onClearFilters && (
                <Button
                  onClick={onClearFilters}
                  variant="outline"
                  size="sm"
                  className="h-8 max-md:min-h-10 cursor-pointer text-sm md:text-xs font-medium"
                >
                  Clear filters
                </Button>
              )}
            </motion.div>
          ) : (
            rows.map((row, index) =>
              row.type === "header" ? (
                <motion.div
                  key={row.key}
                  {...rowMotion(index)}
                  className="flex select-none items-center justify-between border-b border-border/40 bg-muted/40 px-5 py-2 max-md:px-4"
                >
                  <h3 className="text-xs md:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {row.label}
                  </h3>
                  <span className="text-xs md:text-[11px] text-muted-foreground/70">
                    {row.count}
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key={row.key}
                  {...rowMotion(index)}
                  className="border-b border-border/40"
                >
                  <NotificationItem
                    notification={row.notification}
                    onMarkRead={onMarkRead}
                    onToggleRead={onToggleRead}
                    onToggleStar={onToggleStar}
                    isSelected={selectedIds?.has(row.notification.notification_id)}
                    onToggleSelect={onToggleSelect}
                  />
                </motion.div>
              )
            )
          )}
        </AnimatePresence>
      </div>

      {remaining > 0 && (
        <div className="flex justify-center p-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="h-9 max-md:min-h-10 cursor-pointer rounded-lg text-xs font-medium"
          >
            Show more ({remaining} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";

// src/modules/freelancer/freelancer-notifications/FreelancerNotificationsModule.tsx

import React, { useEffect, useState } from "react";
import {
  Bell,
  CheckCheck,
  Filter,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNotifications } from "./hooks/useNotifications";
import { useRealtime } from "@/modules/shared/providers/RealtimeProvider";
import FreelancerNotificationList from "./components/FreelancerNotificationList";
import { cn } from "@/lib/utils";

const FILTER_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Unread", value: "UNREAD" },
  { label: "Starred", value: "STARRED" },
] as const;

type FilterValue = (typeof FILTER_OPTIONS)[number]["value"];

export default function FreelancerNotificationsModule() {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    toggleStar,
    markAllAsRead,
    saving,
    fetchNotifications,
  } = useNotifications();

  const { subscribe } = useRealtime();

  const [filter, setFilter] = useState<FilterValue>("ALL");

  useEffect(() => {
    const unsubscribe = subscribe("vs_freelancer_notification", ({ data }) => {
      if (data && data.length > 0) {
        fetchNotifications();
      }
    });
    return () => unsubscribe();
  }, [subscribe, fetchNotifications]);

  const filteredNotifications =
    filter === "UNREAD"
      ? notifications.filter((n) => !n.is_read)
      : filter === "STARRED"
      ? notifications.filter((n) => n.is_starred)
      : notifications;

  return (
    <div className="space-y-6 freelancer-page-transition">
      <style>{`
        @keyframes page-entry {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .freelancer-page-transition {
          animation: page-entry 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-emerald-950 via-zinc-900 to-neutral-950 dark:from-black dark:via-zinc-950 dark:to-zinc-900 text-white p-4 sm:p-8 rounded-3xl border border-white/10 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 h-40 w-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 bg-white/10 backdrop-blur rounded-2xl border border-white/20 relative">
            <Bell className="h-7 w-7" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Notifications</h1>
            <p className="text-sm text-zinc-300 mt-1">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                : "You're all caught up"}
            </p>
          </div>
        </div>
      </div>

      {/* Notifications Card */}
      <Card className="shadow-sm border bg-card rounded-xl py-0 gap-0 overflow-hidden">
        <CardContent className="p-0">
          {/* Filters Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2 px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-sm md:text-xs font-medium transition-colors max-md:min-h-11",
                    filter === opt.value
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                      : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  )}
                >
                  {opt.label}
                  {opt.value === "UNREAD" && unreadCount > 0 && (
                    <span className="ml-1.5 text-[10px]">({unreadCount})</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchNotifications()}
                disabled={isLoading}
                className="h-8 px-2.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                title="Refresh notifications"
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isLoading && "animate-spin")} />
                Refresh
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  disabled={saving}
                  className="h-8 px-2.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                  Mark All Read
                </Button>
              )}
            </div>
          </div>

          {/* Feed List */}
          <FreelancerNotificationList
            notifications={filteredNotifications}
            loading={isLoading}
            onMarkRead={markAsRead}
            onToggleStar={toggleStar}
          />
        </CardContent>
      </Card>
    </div>
  );
}


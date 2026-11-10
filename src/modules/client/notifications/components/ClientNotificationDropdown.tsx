"use client";

// src/modules/client/notifications/components/ClientNotificationDropdown.tsx

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCheck, ChevronRight } from "lucide-react";
import { Notification } from "../types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelativeTime, getNotificationVisual } from "../utils/notificationVisuals";

const NOTIFICATIONS_HREF = "/linkbridge/client/notifications";
const PREVIEW_COUNT = 6;

interface Props {
  notifications: Notification[];
  isLoading: boolean;
  unreadCount: number;
  onClose: () => void;
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
}

export function ClientNotificationDropdown({
  notifications,
  isLoading,
  unreadCount,
  onClose,
  onMarkRead,
  onMarkAllRead,
}: Props) {
  const router = useRouter();

  const latestItems = useMemo(() => notifications.slice(0, PREVIEW_COUNT), [notifications]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      onMarkRead(notification.notification_id);
    }

    const url = notification.action_url;
    if (url && /^https?:\/\//i.test(url)) {
      window.location.assign(url);
    } else {
      router.push(url || NOTIFICATIONS_HREF);
    }

    onClose();
  };

  const renderItem = (notif: Notification) => {
    const unread = !notif.is_read;
    const { icon: Icon, badge } = getNotificationVisual(notif);

    return (
      <li key={notif.notification_id}>
        <button
          type="button"
          onClick={() => handleNotificationClick(notif)}
          className={cn(
            "relative flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors",
            "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
            unread && "bg-primary/5"
          )}
        >
          {unread && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" />}

          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
              badge
            )}
          >
            <Icon className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-start justify-between gap-2">
              <p
                className={cn(
                  "text-xs leading-snug line-clamp-1",
                  unread ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                )}
              >
                {notif.title}
              </p>
              {unread && (
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
                  aria-label="Unread"
                />
              )}
            </div>
            <p
              className={cn(
                "text-[11px] leading-relaxed line-clamp-2",
                unread ? "text-muted-foreground" : "text-muted-foreground/70"
              )}
            >
              {notif.message}
            </p>
            <p className="pt-0.5 text-[10px] text-muted-foreground/60">
              {formatRelativeTime(notif.created_at)}
            </p>
          </div>
        </button>
      </li>
    );
  };

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-[#E6EAF2] bg-white shadow-xl dark:border-[#1E2942] dark:bg-[#121A2E] sm:w-96 max-md:fixed max-md:inset-x-2 max-md:top-[60px] max-md:mt-0 max-md:w-auto max-md:max-w-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E6EAF2] bg-muted/20 px-4 py-3 dark:border-[#1E2942]">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold text-foreground dark:text-[#E6EAF5]">Notifications</h3>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary">
              {unreadCount > 99 ? "99+" : unreadCount} new
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onMarkAllRead}
          disabled={unreadCount === 0}
          className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline disabled:pointer-events-none disabled:opacity-40 max-md:min-h-10"
        >
          <CheckCheck className="h-3 w-3" />
          Mark all as read
        </button>
      </div>

      {/* Body */}
      <div className="max-h-[380px] overflow-y-auto">
        {isLoading && latestItems.length === 0 ? (
          <div className="divide-y divide-border/40" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-start gap-3 px-4 py-3">
                <div className="h-8 w-8 shrink-0 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <div className="h-3 w-1/2 rounded bg-muted" />
                  <div className="h-2.5 w-4/5 rounded bg-muted/70" />
                </div>
              </div>
            ))}
          </div>
        ) : latestItems.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <BellOff className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs font-semibold text-foreground">You&apos;re all caught up</p>
            <p className="text-[11px] text-muted-foreground">New activity will show up here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">{latestItems.map(renderItem)}</ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[#E6EAF2] bg-muted/10 p-2.5 dark:border-[#1E2942]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onClose();
            router.push(NOTIFICATIONS_HREF);
          }}
          className="flex h-8 w-full items-center justify-center gap-1 rounded-xl text-xs font-semibold text-primary hover:text-primary/95 max-md:min-h-10"
        >
          View all notifications
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
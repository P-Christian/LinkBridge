"use client";

// src/modules/client/notifications/components/NotificationItem.tsx

import React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Mail, Star } from "lucide-react";
import { Notification } from "../types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  formatFullDate,
  formatRelativeTime,
  getNotificationVisual,
} from "../utils/notificationVisuals";

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: number) => void;
  onToggleRead?: (id: number, currentReadStatus: boolean) => void;
  onToggleStar?: (id: number, currentStarredStatus: boolean) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
}

export default function NotificationItem({
  notification,
  onMarkRead,
  onToggleRead,
  onToggleStar,
  isSelected = false,
  onToggleSelect,
}: NotificationItemProps) {
  const router = useRouter();
  const { icon: Icon, label, badge, text } = getNotificationVisual(notification);
  const unread = !notification.is_read;
  const isStarred = Boolean(notification.is_starred);

  const handleOpen = () => {
    if (unread) onMarkRead(notification.notification_id);

    const url = notification.action_url;
    if (!url) return;
    if (/^https?:\/\//i.test(url)) {
      window.location.assign(url);
    } else {
      router.push(url);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Ignore keys pressed on inner interactive elements (checkbox, action buttons)
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleOpen();
    }
  };

  const handleQuickMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkRead(notification.notification_id);
  };

  const handleToggleRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleRead) {
      onToggleRead(notification.notification_id, notification.is_read);
    } else {
      onMarkRead(notification.notification_id);
    }
  };

  const handleToggleStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleStar) {
      onToggleStar(notification.notification_id, isStarred);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex items-start gap-3.5 px-5 py-4 max-md:px-4 cursor-pointer select-none transition-colors duration-150",
        "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
        isSelected
          ? "bg-primary/[0.08] dark:bg-primary/[0.14] ring-1 ring-inset ring-primary/20"
          : unread
            ? "bg-primary/[0.04] dark:bg-primary/[0.08]"
            : "bg-card"
      )}
    >
      {/* Unread accent bar (absolute, so it never shifts the layout) */}
      {unread && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-0.5 bg-primary"
        />
      )}

      {/* Row Checkbox */}
      {onToggleSelect && (
        <div
          className="mt-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(notification.notification_id)}
            aria-label={`Select notification: ${notification.title}`}
            className="cursor-pointer"
          />
        </div>
      )}

      {/* Icon badge */}
      <div
        className={cn(
          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
          badge
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p
            className={cn(
              "text-sm leading-snug line-clamp-2",
              unread ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
            )}
          >
            {notification.title}
          </p>
          {unread && (
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
              aria-label="Unread"
            />
          )}
        </div>

        <p
          className={cn(
            "mt-1 text-sm md:text-[13px] leading-relaxed line-clamp-2",
            unread ? "text-muted-foreground" : "text-muted-foreground/75"
          )}
        >
          {notification.message}
        </p>

        <div className="mt-2 flex items-center gap-2 text-xs md:text-[11px]">
          <span className={cn("font-medium", text)}>{label}</span>
          <span className="text-muted-foreground/40" aria-hidden>
            •
          </span>
          <time
            dateTime={notification.created_at}
            title={formatFullDate(notification.created_at)}
            className="text-muted-foreground whitespace-nowrap"
          >
            {formatRelativeTime(notification.created_at)}
          </time>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 self-center">
        {/* Star Button */}
        {onToggleStar && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleToggleStar}
            title={isStarred ? "Unstar" : "Star"}
            aria-label={isStarred ? "Unstar" : "Star"}
            className={cn(
              "h-8 w-8 max-md:size-10 rounded-lg cursor-pointer transition-all",
              isStarred
                ? "text-amber-500 hover:text-amber-600 opacity-100"
                : "text-muted-foreground hover:text-amber-500 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:focus-visible:opacity-100"
            )}
          >
            <Star
              className={cn(
                "h-4 w-4 transition-transform",
                isStarred && "fill-amber-500 scale-105"
              )}
            />
          </Button>
        )}

        {/* Read / Unread Toggle */}
        {onToggleRead ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleToggleRead}
            title={unread ? "Mark as read" : "Mark as unread"}
            aria-label={unread ? "Mark as read" : "Mark as unread"}
            className={cn(
              "h-8 w-8 max-md:size-10 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-opacity",
              "md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:focus-visible:opacity-100"
            )}
          >
            {unread ? (
              <Check className="h-4 w-4" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
          </Button>
        ) : unread ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleQuickMarkRead}
            title="Mark as read"
            aria-label="Mark as read"
            className={cn(
              "h-8 w-8 max-md:size-10 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-opacity",
              "md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:focus-visible:opacity-100"
            )}
          >
            <Check className="h-4 w-4" />
          </Button>
        ) : null}

        <ChevronRight className="hidden sm:block h-4 w-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
    </div>
  );
}

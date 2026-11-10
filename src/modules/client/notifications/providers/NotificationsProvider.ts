// src/modules/client/notifications/providers/NotificationsProvider.ts

import { apiDelete, apiGet, apiPatch, apiPut } from "@/lib/api/client";
import { Notification, NotificationPreference } from "../types";

const BASE = "/api/client/notifications";

type NotificationQuery = {
  notifications?: Notification[];
  preferences?: NotificationPreference[];
};

export type BulkNotificationResult = {
  success: boolean;
  updated: number;
  unread_count?: number;
};

export type BulkDeleteResult = {
  success: boolean;
  deleted: number;
  unread_count?: number;
};

// ─── Fetch Notifications ───────────────────────────────────────────────────

export async function fetchNotifications(
  params?: {
    unread_only?: boolean;
    starred_only?: boolean;
    limit?: number;
    offset?: number;
  },
  signal?: AbortSignal
): Promise<Notification[]> {
  const body = await apiGet<NotificationQuery>(BASE, {
    query: {
      unread_only: params?.unread_only ? "true" : undefined,
      starred_only: params?.starred_only ? "true" : undefined,
      limit: params?.limit || undefined,
      offset: params?.offset || undefined,
    },
    cache: "no-store",
    signal,
    errorText: "Failed to fetch notifications.",
  });
  return body?.notifications ?? [];
}

// ─── Update Single Read/Unread Status ─────────────────────────────────────

export async function updateNotificationRead(
  notificationId: number,
  isRead: boolean = true
): Promise<void> {
  await apiPatch(
    `${BASE}/${notificationId}`,
    { is_read: isRead },
    {
      errorText: isRead
        ? "Failed to mark notification as read."
        : "Failed to mark notification as unread.",
    }
  );
}

export async function markNotificationRead(
  notificationId: number
): Promise<void> {
  return updateNotificationRead(notificationId, true);
}

export async function markNotificationUnread(
  notificationId: number
): Promise<void> {
  return updateNotificationRead(notificationId, false);
}

// ─── Update Single Starred Status ─────────────────────────────────────────

export async function updateNotificationStarred(
  notificationId: number,
  isStarred: boolean
): Promise<void> {
  await apiPatch(
    `${BASE}/${notificationId}`,
    { is_starred: isStarred },
    {
      errorText: isStarred
        ? "Failed to star notification."
        : "Failed to unstar notification.",
    }
  );
}

// ─── Delete Single Notification ───────────────────────────────────────────

export async function deleteSingleNotification(
  notificationId: number
): Promise<void> {
  await apiDelete(`${BASE}/${notificationId}`, undefined, {
    errorText: "Failed to delete notification.",
  });
}

// ─── Bulk Update Notifications (Read / Unread) ────────────────────────────

export async function bulkUpdateNotifications(
  notificationIds: number[],
  isRead: boolean
): Promise<BulkNotificationResult> {
  return apiPatch<BulkNotificationResult>(
    BASE,
    { notification_ids: notificationIds, is_read: isRead },
    {
      errorText: isRead
        ? "Failed to mark selected notifications as read."
        : "Failed to mark selected notifications as unread.",
    }
  );
}

// ─── Bulk Update Notifications (Starred / Unstarred) ──────────────────────

export async function bulkUpdateNotificationsStarred(
  notificationIds: number[],
  isStarred: boolean
): Promise<BulkNotificationResult> {
  return apiPatch<BulkNotificationResult>(
    BASE,
    { notification_ids: notificationIds, is_starred: isStarred },
    {
      errorText: isStarred
        ? "Failed to star selected notifications."
        : "Failed to unstar selected notifications.",
    }
  );
}

// ─── Bulk Delete Notifications ────────────────────────────────────────────

export async function bulkDeleteNotifications(
  notificationIds: number[]
): Promise<BulkDeleteResult> {
  return apiDelete<BulkDeleteResult>(
    BASE,
    { notification_ids: notificationIds },
    { errorText: "Failed to delete selected notifications." }
  );
}

// ─── Mark All as Read ─────────────────────────────────────────────────────

export async function markAllNotificationsRead(): Promise<void> {
  await apiPatch(BASE, { mark_all_read: true }, {
    errorText: "Failed to mark all notifications as read.",
  });
}

// ─── Fetch Preferences ────────────────────────────────────────────────────

export async function fetchNotificationPreferences(
  signal?: AbortSignal
): Promise<NotificationPreference[]> {
  const body = await apiGet<NotificationQuery>(`${BASE}/preferences`, {
    cache: "no-store",
    signal,
    errorText: "Failed to fetch notification preferences.",
  });
  return body?.preferences ?? [];
}

// ─── Update Preferences ───────────────────────────────────────────────────

export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreference>[]
): Promise<void> {
  await apiPut(`${BASE}/preferences`, { preferences }, {
    errorText: "Failed to update notification preferences.",
  });
}

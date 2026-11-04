"use client";

// src/modules/client/notifications/hooks/useNotifications.ts

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useFetchResource } from "@/hooks/useFetchResource";
import { Notification, NotificationPreference } from "../types";
import {
  fetchNotifications,
  updateNotificationRead,
  updateNotificationStarred,
  markAllNotificationsRead,
  bulkUpdateNotifications,
  bulkUpdateNotificationsStarred,
  bulkDeleteNotifications,
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from "../providers/NotificationsProvider";

// Shared empty lists, so "never read" and "read returned nothing" cannot hand
// consumers a new array identity on every render.
const NO_NOTIFICATIONS: Notification[] = [];
const NO_PREFERENCES: NotificationPreference[] = [];

type ListFilter = { unread_only?: boolean; starred_only?: boolean };

export function useNotifications() {
  const [saving, setSaving] = useState(false);

  // Filters live in a ref so `loadNotifications` keeps one stable identity:
  // NotificationsModule's realtime subscription re-subscribes when it changes.
  const filterRef = useRef<ListFilter>({});

  // ─── Notifications list ───────────────────────────────────────────────

  const fetchList = useCallback(
    (signal: AbortSignal) => fetchNotifications(filterRef.current, signal),
    []
  );

  const {
    data: notificationData,
    loading,
    reload: reloadList,
    refresh: refreshList,
    setData,
  } = useFetchResource<Notification[]>(fetchList, {
    fallbackError: "Failed to load notifications.",
    toast: true,
    retryAction: true,
  });

  const notifications = notificationData ?? NO_NOTIFICATIONS;

  const setNotifications = useCallback(
    (updater: (list: Notification[]) => Notification[]) => {
      setData((previous) => updater(previous ?? NO_NOTIFICATIONS));
    },
    [setData]
  );

  const loadNotifications = useCallback(
    (opts?: ListFilter & { quiet?: boolean }) => {
      filterRef.current = {
        unread_only: opts?.unread_only,
        starred_only: opts?.starred_only,
      };
      if (opts?.quiet) {
        refreshList();
      } else {
        reloadList();
      }
    },
    [refreshList, reloadList]
  );

  // ─── Toggle / Mark single notification read status ────────────────────

  const toggleReadStatus = useCallback(
    async (notificationId: number, currentReadStatus: boolean) => {
      const nextRead = !currentReadStatus;

      // 1. Optimistic update
      setNotifications((list) =>
        list.map((n) =>
          n.notification_id === notificationId ? { ...n, is_read: nextRead } : n
        )
      );

      try {
        await updateNotificationRead(notificationId, nextRead);
        toast.success(nextRead ? "Marked as read" : "Marked as unread");
      } catch (err: unknown) {
        // Rollback
        setNotifications((list) =>
          list.map((n) =>
            n.notification_id === notificationId
              ? { ...n, is_read: currentReadStatus }
              : n
          )
        );
        toast.error(
          err instanceof Error
            ? err.message
            : `Failed to mark notification as ${nextRead ? "read" : "unread"}.`
        );
      }
    },
    [setNotifications]
  );

  const markRead = useCallback(
    async (notificationId: number) => {
      // Optimistic update
      setNotifications((list) =>
        list.map((n) =>
          n.notification_id === notificationId ? { ...n, is_read: true } : n
        )
      );

      try {
        await updateNotificationRead(notificationId, true);
      } catch (err: unknown) {
        // Rollback
        setNotifications((list) =>
          list.map((n) =>
            n.notification_id === notificationId ? { ...n, is_read: false } : n
          )
        );
        toast.error(err instanceof Error ? err.message : "Failed to mark as read.");
      }
    },
    [setNotifications]
  );

  const markUnread = useCallback(
    async (notificationId: number) => {
      // Optimistic update
      setNotifications((list) =>
        list.map((n) =>
          n.notification_id === notificationId ? { ...n, is_read: false } : n
        )
      );

      try {
        await updateNotificationRead(notificationId, false);
        toast.success("Marked as unread");
      } catch (err: unknown) {
        // Rollback
        setNotifications((list) =>
          list.map((n) =>
            n.notification_id === notificationId ? { ...n, is_read: true } : n
          )
        );
        toast.error(
          err instanceof Error ? err.message : "Failed to mark as unread."
        );
      }
    },
    [setNotifications]
  );

  // ─── Toggle Starred Status ────────────────────────────────────────────

  const toggleStarredStatus = useCallback(
    async (notificationId: number, currentStarredStatus: boolean) => {
      const nextStarred = !currentStarredStatus;

      // 1. Optimistic update
      setNotifications((list) =>
        list.map((n) =>
          n.notification_id === notificationId
            ? { ...n, is_starred: nextStarred }
            : n
        )
      );

      try {
        await updateNotificationStarred(notificationId, nextStarred);
        toast.success(
          nextStarred ? "Notification starred" : "Notification unstarred"
        );
      } catch (err: unknown) {
        // Rollback
        setNotifications((list) =>
          list.map((n) =>
            n.notification_id === notificationId
              ? { ...n, is_starred: currentStarredStatus }
              : n
          )
        );
        toast.error(
          err instanceof Error ? err.message : "Failed to update star status."
        );
      }
    },
    [setNotifications]
  );

  // ─── Bulk status update (Read / Unread) ────────────────────────────────

  const bulkSetRead = useCallback(
    async (notificationIds: number[], isRead: boolean) => {
      if (notificationIds.length === 0) return;

      const idSet = new Set(notificationIds);
      let previousNotifications: Notification[] = NO_NOTIFICATIONS;

      // 1. Optimistic update
      setNotifications((list) => {
        previousNotifications = list;
        return list.map((n) =>
          idSet.has(n.notification_id) ? { ...n, is_read: isRead } : n
        );
      });

      try {
        await bulkUpdateNotifications(notificationIds, isRead);
        toast.success(
          `Marked ${notificationIds.length} ${
            notificationIds.length === 1 ? "notification" : "notifications"
          } as ${isRead ? "read" : "unread"}`
        );
      } catch (err: unknown) {
        // Rollback
        setNotifications(() => previousNotifications);
        toast.error(
          err instanceof Error
            ? err.message
            : `Failed to mark notifications as ${isRead ? "read" : "unread"}.`
        );
      }
    },
    [setNotifications]
  );

  // ─── Bulk Starred Update ──────────────────────────────────────────────

  const bulkSetStarred = useCallback(
    async (notificationIds: number[], isStarred: boolean) => {
      if (notificationIds.length === 0) return;

      const idSet = new Set(notificationIds);
      let previousNotifications: Notification[] = NO_NOTIFICATIONS;

      // 1. Optimistic update
      setNotifications((list) => {
        previousNotifications = list;
        return list.map((n) =>
          idSet.has(n.notification_id) ? { ...n, is_starred: isStarred } : n
        );
      });

      try {
        await bulkUpdateNotificationsStarred(notificationIds, isStarred);
        toast.success(
          `${isStarred ? "Starred" : "Unstarred"} ${notificationIds.length} ${
            notificationIds.length === 1 ? "notification" : "notifications"
          }`
        );
      } catch (err: unknown) {
        // Rollback
        setNotifications(() => previousNotifications);
        toast.error(
          err instanceof Error
            ? err.message
            : `Failed to ${isStarred ? "star" : "unstar"} notifications.`
        );
      }
    },
    [setNotifications]
  );

  // ─── Bulk delete ──────────────────────────────────────────────────────

  const bulkDelete = useCallback(
    async (notificationIds: number[]) => {
      if (notificationIds.length === 0) return;

      const idSet = new Set(notificationIds);
      let previousNotifications: Notification[] = NO_NOTIFICATIONS;

      // 1. Optimistic update
      setNotifications((list) => {
        previousNotifications = list;
        return list.filter((n) => !idSet.has(n.notification_id));
      });

      try {
        await bulkDeleteNotifications(notificationIds);
        toast.success(
          `Deleted ${notificationIds.length} ${
            notificationIds.length === 1 ? "notification" : "notifications"
          }`
        );
      } catch (err: unknown) {
        // Rollback
        setNotifications(() => previousNotifications);
        toast.error(
          err instanceof Error ? err.message : "Failed to delete notifications."
        );
      }
    },
    [setNotifications]
  );

  // ─── Mark all read ────────────────────────────────────────────────────

  const markAllRead = useCallback(async () => {
    setSaving(true);
    let previousNotifications: Notification[] = NO_NOTIFICATIONS;

    setNotifications((list) => {
      previousNotifications = list;
      return list.map((n) => ({ ...n, is_read: true }));
    });

    try {
      await markAllNotificationsRead();
      toast.success("All notifications marked as read");
    } catch (err: unknown) {
      setNotifications(() => previousNotifications);
      toast.error(
        err instanceof Error ? err.message : "Failed to mark all as read."
      );
    } finally {
      setSaving(false);
    }
  }, [setNotifications]);

  // ─── Preferences ──────────────────────────────────────────────────────

  const fetchPreferences = useCallback(
    (signal: AbortSignal) => fetchNotificationPreferences(signal),
    []
  );

  const {
    data: preferenceData,
    loading: prefsLoading,
    error: prefsError,
    reload: loadPreferences,
    setData: setPreferencesState,
    setError: setPrefsError,
  } = useFetchResource<NotificationPreference[]>(fetchPreferences, {
    enabled: false,
    fallbackError: "Failed to load notification preferences.",
  });

  const preferences = preferenceData ?? NO_PREFERENCES;

  const savePreferences = useCallback(
    async (updated: Partial<NotificationPreference>[]) => {
      setSaving(true);
      setPrefsError("");

      try {
        await updateNotificationPreferences(updated);
        // Optimistically update local state
        setPreferencesState((prev) =>
          (prev ?? NO_PREFERENCES).map((pref) => {
            const match = updated.find((u) => u.category === pref.category);
            return match ? { ...pref, ...match } : pref;
          })
        );
        return true;
      } catch (err: unknown) {
        setPrefsError(
          err instanceof Error
            ? err.message
            : "Failed to save notification preferences."
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    [setPrefsError, setPreferencesState]
  );

  // ─── Derived state ────────────────────────────────────────────────────

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const starredCount = useMemo(
    () => notifications.filter((n) => n.is_starred).length,
    [notifications]
  );

  const hasUnread = unreadCount > 0;

  return {
    notifications,
    preferences,

    loading,
    prefsLoading,
    saving,

    prefsError,

    unreadCount,
    starredCount,
    hasUnread,

    loadNotifications,
    toggleReadStatus,
    toggleStarredStatus,
    markRead,
    markUnread,
    bulkSetRead,
    bulkSetStarred,
    bulkDelete,
    markAllRead,
    loadPreferences,
    savePreferences,

    clearPrefsError: () => setPrefsError(""),
  };
}

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { FreelancerNotification, FreelancerNotificationPreference } from "../types";

export function useNotifications() {
  const [notifications, setNotifications] = useState<FreelancerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Preferences & Quiet Hours State
  const [preferences, setPreferences] = useState<FreelancerNotificationPreference[]>([]);
  const [quietHours, setQuietHours] = useState<{
    start: string | null;
    end: string | null;
    timezone: string | null;
  }>({ start: null, end: null, timezone: null });
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefsError, setPrefsError] = useState("");

  const fetchNotifications = useCallback(async (opts?: { unread_only?: boolean }) => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams();
      if (opts?.unread_only) query.set("unread_only", "true");
      const qs = query.toString();

      const res = await fetch(`/api/freelancer/notifications${qs ? `?${qs}` : ""}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch notifications");
      }
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: number) => {
    // 1. Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        n.notification_id === notificationId ? { ...n, is_read: true } : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      const res = await fetch(`/api/freelancer/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: true }),
      });
      const data = await res.json();
      return res.ok && data.success;
    } catch (err) {
      console.error("Error marking notification as read", err);
      return false;
    }
  }, []);

  const toggleStar = useCallback(async (notificationId: number, currentStarred: boolean) => {
    const nextStarred = !currentStarred;
    // 1. Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        n.notification_id === notificationId ? { ...n, is_starred: nextStarred } : n
      )
    );

    try {
      const res = await fetch(`/api/freelancer/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_starred: nextStarred }),
      });
      const data = await res.json();
      return res.ok && data.success;
    } catch (err) {
      console.error("Error toggling notification starred state", err);
      // rollback if it fails
      setNotifications((prev) =>
        prev.map((n) =>
          n.notification_id === notificationId ? { ...n, is_starred: currentStarred } : n
        )
      );
      return false;
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    // Optimistically mark all read
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    setSaving(true);

    try {
      const res = await fetch("/api/freelancer/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to mark all as read.");
      }
      return true;
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to mark all notifications as read."
      );
      // Rollback unread count
      fetchNotifications();
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchNotifications]);

  const loadPreferences = useCallback(async () => {
    setPrefsLoading(true);
    setPrefsError("");
    try {
      const res = await fetch("/api/freelancer/notifications/preferences");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch notification preferences.");
      }
      setPreferences(data.preferences || []);
      setQuietHours({
        start: data.quiet_hours_start ?? null,
        end: data.quiet_hours_end ?? null,
        timezone: data.timezone ?? null,
      });
    } catch (err: unknown) {
      setPrefsError(
        err instanceof Error ? err.message : "Failed to load notification preferences."
      );
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  const savePreferences = useCallback(async (payload: {
    preferences: Partial<FreelancerNotificationPreference>[];
    quiet_hours_start?: string | null;
    quiet_hours_end?: string | null;
    timezone?: string | null;
  }) => {
    setSaving(true);
    setPrefsError("");
    try {
      const res = await fetch("/api/freelancer/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save notification preferences.");
      }
      // Reload on success
      await loadPreferences();
      return true;
    } catch (err: unknown) {
      setPrefsError(
        err instanceof Error ? err.message : "Failed to save notification preferences."
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [loadPreferences]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    toggleStar,

    // New preferences hooks/state
    preferences,
    quietHours,
    prefsLoading,
    saving,
    prefsError,
    loadPreferences,
    savePreferences,
    markAllAsRead,
  };
}


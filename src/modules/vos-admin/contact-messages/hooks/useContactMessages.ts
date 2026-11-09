"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { toast } from "sonner";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import type {
  ContactMessage,
  ContactMessageStatus,
  ContactMessageStatusCounts,
} from "../types/contact-message.types";

export interface ContactMessageFilters {
  status: ContactMessageStatus | "all";
  search: string;
  page: number;
  pageSize: number;
}

export function useContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  // null until the first read lands, so the tabs never show a count that is
  // really just "not loaded yet".
  const [statusCounts, setStatusCounts] = useState<ContactMessageStatusCounts | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState<string>("");

  const [filters, setFilters] = useState<ContactMessageFilters>({
    status: "all",
    search: "",
    page: 1,
    pageSize: 15,
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  const abortList = useRequestAbort();
  // Separate controller: paging the list must not cancel the message the admin
  // just opened, and vice versa.
  const abortDetail = useRequestAbort();
  const abortUnread = useRequestAbort();

  const fetchCounts = useCallback(async () => {
    const signal = abortUnread();
    try {
      const res = await fetch("/api/vos-admin/contact-messages/unread-count", { signal });
      if (res.ok) {
        const data = await res.json();
        if (signal.aborted) return;
        const counts = data.counts as ContactMessageStatusCounts | undefined;
        if (counts) {
          setStatusCounts(counts);
          setUnreadCount(Number(counts.new ?? 0));
        } else {
          setUnreadCount(Number(data.unreadCount ?? 0));
        }
      }
    } catch {
      // non-blocking
    }
  }, [abortUnread]);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    // The Refresh button, a retry and every filter or page change all read
    // through here: only the newest read may write state, or page 1 can land
    // after page 2 and the rows stop matching the pager that asked for them.
    const signal = abortList();
    try {
      const query = new URLSearchParams();
      if (filters.status !== "all") query.set("status", filters.status);
      if (filters.search.trim()) query.set("q", filters.search.trim());
      query.set("page", String(filters.page));
      query.set("pageSize", String(filters.pageSize));

      const res = await fetch(`/api/vos-admin/contact-messages?${query.toString()}`, { signal });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch messages (${res.status})`);
      }

      const data = await res.json();
      if (signal.aborted) return;
      const items = (data.items ?? []) as ContactMessage[];
      const totalNow = Number(data.total ?? 0);
      startTransition(() => {
        setMessages(items);
        setTotal(totalNow);
      });

      // Deleting the last row of the last page used to leave the admin on an
      // empty page 3 with a pager still pointing at it.
      if (items.length === 0 && totalNow > 0 && filters.page > 1) {
        const lastPage = Math.max(1, Math.ceil(totalNow / filters.pageSize));
        setFilters((prev) =>
          prev.page === lastPage ? prev : { ...prev, page: lastPage }
        );
      }
    } catch (err: unknown) {
      if (signal.aborted) return;
      const message = err instanceof Error ? err.message : "An error occurred while loading messages";
      setError(message);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [filters, abortList, startTransition]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    // The effect only kicks off the read; its setState happens after the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCounts();
  }, [fetchCounts]);

  // One read per pause in typing rather than per keystroke: every uncommitted
  // character used to cancel the request before it and blank the list back to
  // skeletons.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) =>
        prev.search === searchInput ? prev : { ...prev, search: searchInput, page: 1 }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const selectMessage = useCallback(async (id: number | null) => {
    setSelectedId(id);
    if (!id) {
      // Claim the token even here: a detail read still running would otherwise
      // populate the panel the admin just closed.
      abortDetail();
      setSelectedMessage(null);
      return;
    }

    setDetailLoading(true);
    // Clicking another row starts a new detail read; a late response for the
    // previous message must not replace the open body, because replying or
    // changing status is done against whatever is shown here.
    const signal = abortDetail();
    try {
      const res = await fetch(`/api/vos-admin/contact-messages/${id}`, { signal });
      if (!res.ok) {
        throw new Error(`Failed to load message (${res.status})`);
      }
      const data = await res.json();
      if (signal.aborted) return;
      const item: ContactMessage = data.item;
      setSelectedMessage(item);

      // Opening a 'new' message auto-advances it server-side; the route reports
      // here when that write did not land, so the panel does not claim a status
      // the row does not have.
      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        toast.warning(String(data.warnings.join(" ")));
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: item.status, reviewed_at: item.reviewed_at } : m))
      );
      fetchCounts();
    } catch (err: unknown) {
      if (signal.aborted) return;
      const msg = err instanceof Error ? err.message : "Failed to load message details";
      toast.error(msg);
      // Clear the selection too: the dialog opens on selectedId, so leaving it
      // set keeps the previously opened message on screen under a "failed to
      // load" toast.
      setSelectedId(null);
      setSelectedMessage(null);
    } finally {
      if (!signal.aborted) {
        setDetailLoading(false);
      }
    }
  }, [fetchCounts, abortDetail]);

  const updateMessage = useCallback(
    async (
      id: number,
      patch: { status?: ContactMessageStatus; internal_note?: string }
    ) => {
      setUpdating(true);
      try {
        const res = await fetch(`/api/vos-admin/contact-messages/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update message");
        }

        const data = await res.json();
        const updated: ContactMessage = data.item;

        setSelectedMessage(updated);
        setMessages((prev) => prev.map((m) => (m.id === id ? updated : m)));
        toast.success("Message updated successfully");
        fetchCounts();
        return updated;
      } catch (err: unknown) {
        // Toasted here and never rethrown: the callers are onClick handlers, so
        // a rejection would surface as an unhandled promise rejection in the
        // console while the admin already saw the reason.
        const msg = err instanceof Error ? err.message : "Error updating message";
        toast.error(msg);
        return null;
      } finally {
        setUpdating(false);
      }
    },
    [fetchCounts]
  );

  const deleteMessage = useCallback(
    async (id: number) => {
      setUpdating(true);
      try {
        const res = await fetch(`/api/vos-admin/contact-messages/${id}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to delete message");
        }

        const remaining = messages.filter((m) => m.id !== id);
        setMessages(remaining);
        setTotal((prev) => Math.max(0, prev - 1));
        // Deleting the only row on page 3 used to park the admin on a page that
        // no longer exists, with a pager pointing at it.
        if (remaining.length === 0 && filters.page > 1) {
          setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }));
        }
        if (selectedId === id) {
          setSelectedId(null);
          setSelectedMessage(null);
        }
        toast.success("Message removed");
        fetchCounts();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error deleting message";
        toast.error(msg);
      } finally {
        setUpdating(false);
      }
    },
    [messages, filters.page, selectedId, fetchCounts]
  );

  const setStatusFilter = useCallback((status: ContactMessageStatus | "all") => {
    setFilters((prev) => ({ ...prev, status, page: 1 }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setSearchInput(search);
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  return {
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
    refresh: fetchMessages,
  };
}

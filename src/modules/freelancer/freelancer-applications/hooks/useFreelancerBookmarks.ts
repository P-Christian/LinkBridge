"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { BookmarkedJob } from "../types";

export function useFreelancerBookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkedJob[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBookmarks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/freelancer/bookmarks");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load bookmarks.");
      setBookmarks(json.bookmarks ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }, []);

  const addBookmark = useCallback(async (jobId: number) => {
    try {
      const res = await fetch("/api/freelancer/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to bookmark job.");
      await fetchBookmarks();
      return true;
    } catch (err: unknown) {
      console.error(err);
      return false;
    }
  }, [fetchBookmarks]);

  const removeBookmark = useCallback(async (jobId: number) => {
    try {
      setBookmarks((prev) => prev.filter((b) => b.job_id !== jobId));
      
      const res = await fetch("/api/freelancer/bookmarks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to remove bookmark.");
      return true;
    } catch (err: unknown) {
      console.error(err);
      await fetchBookmarks();
      return false;
    }
  }, [fetchBookmarks]);

  const bookmarkedJobIds = useMemo(() => {
    return bookmarks.map((b) => b.job_id);
  }, [bookmarks]);

  const toggleBookmark = useCallback(async (jobId: number) => {
    if (bookmarkedJobIds.includes(jobId)) {
      await removeBookmark(jobId);
    } else {
      await addBookmark(jobId);
    }
  }, [bookmarkedJobIds, addBookmark, removeBookmark]);

  return {
    bookmarks,
    bookmarkedJobIds,
    loading,
    fetchBookmarks,
    addBookmark,
    removeBookmark,
    toggleBookmark,
  };
}

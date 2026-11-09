"use client";

// src/modules/vos-admin/role-matching/hooks/useSearchKeywords.ts

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import { SearchKeyword } from "../types";
import { fetchSearchKeywords, createSearchKeyword, updateSearchKeyword, deleteSearchKeyword } from "../services/roleMatchingService";

/** One toast per panel: a bulk add that fails alias by alias must not stack up. */
const TOAST_ID = "role-search-keywords";

export function useSearchKeywords(roleId?: number) {
  const [keywords, setKeywords] = useState<SearchKeyword[]>([]);
  const [loading, setLoading] = useState(false);

  const abortRead = useRequestAbort();

  const loadKeywords = useCallback(async (rId?: number) => {
    setLoading(true);
    // Clicking another role in the tree starts a new read; this one must then
    // stay out of state, or aliases from the previous role render under the new
    // selection and editKeyword/removeKeyword act on the wrong alias_id.
    const signal = abortRead();
    try {
      const data = await fetchSearchKeywords(rId ?? roleId);
      if (signal.aborted) return;
      setKeywords(data);
    } catch (err: unknown) {
      if (signal.aborted) return;
      toast.error((err as Error).message || "Failed to load search keywords.", { id: TOAST_ID });
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [roleId, abortRead]);

  const addKeyword = useCallback(async (payload: Partial<SearchKeyword>) => {
    try {
      const created = await createSearchKeyword(payload);
      setKeywords((prev) => {
        const exists = prev.some((k) => k.alias_id === created.alias_id);
        if (exists) {
          return prev.map((k) => (k.alias_id === created.alias_id ? { ...k, ...created } : k));
        }
        return [...prev, created];
      });
      return true;
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to add search keyword.", { id: TOAST_ID });
      return false;
    }
  }, []);


  const editKeyword = useCallback(async (payload: Partial<SearchKeyword>) => {
    try {
      const updated = await updateSearchKeyword(payload);
      const is_active =
        updated.is_active !== undefined
          ? Boolean(updated.is_active)
          : payload.is_active !== undefined
          ? Boolean(payload.is_active)
          : undefined;
      setKeywords((prev) =>
        prev.map((k) =>
          k.alias_id === (updated.alias_id ?? payload.alias_id)
            ? { ...k, ...updated, ...(is_active !== undefined ? { is_active } : {}) }
            : k
        )
      );
      return true;
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update search keyword.", { id: TOAST_ID });
      return false;
    }
  }, []);

  const removeKeyword = useCallback(async (aliasId: number) => {
    try {
      await deleteSearchKeyword(aliasId);
      setKeywords((prev) => prev.filter((k) => k.alias_id !== aliasId));
      return true;
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete search keyword.", { id: TOAST_ID });
      return false;
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadKeywords(roleId);
  }, [loadKeywords, roleId]);

  return { keywords, loading, loadKeywords, addKeyword, editKeyword, removeKeyword };
}

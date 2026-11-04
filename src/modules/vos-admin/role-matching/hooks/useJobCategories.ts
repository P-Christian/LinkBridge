"use client";

// src/modules/vos-admin/role-matching/hooks/useJobCategories.ts

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import { JobCategory } from "../types";
import { fetchJobCategories, createJobCategory, updateJobCategory, deleteJobCategory } from "../services/roleMatchingService";

const TOAST_ID = "job-categories";

export function useJobCategories() {
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRead = useRequestAbort();

  const loadCategories = useCallback(async () => {
    setLoading(true);
    // Add/edit/remove below patch this list locally, so a read that started
    // before one of those writes must not land after it and restore the old
    // snapshot.
    const signal = abortRead();
    try {
      const data = await fetchJobCategories(signal);
      if (signal.aborted) return;
      setCategories(data);
    } catch (err: unknown) {
      if (signal.aborted) return;
      toast.error((err as Error).message || "Failed to load job categories.", { id: TOAST_ID });
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [abortRead]);

  const addCategory = useCallback(async (payload: Partial<JobCategory>) => {
    try {
      const created = await createJobCategory(payload);
      setCategories((prev) => [...prev, created]);
      return true;
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to add category.", { id: TOAST_ID });
      return false;
    }
  }, []);

  const editCategory = useCallback(async (payload: Partial<JobCategory>) => {
    try {
      const updated = await updateJobCategory(payload);
      setCategories((prev) => prev.map((c) => (c.category_id === updated.category_id ? { ...c, ...updated } : c)));
      return true;
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update category.", { id: TOAST_ID });
      return false;
    }
  }, []);

  const removeCategory = useCallback(async (id: number) => {
    try {
      await deleteJobCategory(id);
      setCategories((prev) => prev.filter((c) => c.category_id !== id));
      return true;
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete category.", { id: TOAST_ID });
      return false;
    }
  }, []);

  useEffect(() => {
    // useRequestAbort cancels this read if the panel unmounts before it lands.
    void Promise.resolve().then(() => loadCategories());
  }, [loadCategories]);

  return { categories, loading, loadCategories, addCategory, editCategory, removeCategory };
}

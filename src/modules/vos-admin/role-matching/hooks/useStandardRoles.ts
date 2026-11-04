"use client";

// src/modules/vos-admin/role-matching/hooks/useStandardRoles.ts

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import { StandardRole } from "../types";
import { fetchStandardRoles, createStandardRole, updateStandardRole, deleteStandardRole } from "../services/roleMatchingService";

const TOAST_ID = "standard-roles";

export function useStandardRoles(categoryId?: number) {
  const [roles, setRoles] = useState<StandardRole[]>([]);
  const [loading, setLoading] = useState(false);

  const abortRead = useRequestAbort();

  const loadRoles = useCallback(async (catId?: number) => {
    setLoading(true);
    // Clicking another category in the tree starts a new read; this one must
    // then stay out of state, or role rows from the previous category render
    // under the new selection and addRole/editRole act on the wrong ones.
    const signal = abortRead();
    try {
      const data = await fetchStandardRoles(catId ?? categoryId);
      if (signal.aborted) return;
      setRoles(data);
    } catch (err: unknown) {
      if (signal.aborted) return;
      toast.error((err as Error).message || "Failed to load standard roles.", { id: TOAST_ID });
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [categoryId, abortRead]);

  const addRole = useCallback(async (payload: Partial<StandardRole>) => {
    try {
      const created = await createStandardRole(payload);
      setRoles((prev) => [...prev, created]);
      return true;
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to add standard role.", { id: TOAST_ID });
      return false;
    }
  }, []);

  const editRole = useCallback(async (payload: Partial<StandardRole>) => {
    try {
      const updated = await updateStandardRole(payload);
      setRoles((prev) => prev.map((r) => (r.role_id === updated.role_id ? { ...r, ...updated } : r)));
      return true;
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update standard role.", { id: TOAST_ID });
      return false;
    }
  }, []);

  const removeRole = useCallback(async (roleId: number) => {
    try {
      await deleteStandardRole(roleId);
      setRoles((prev) => prev.filter((r) => r.role_id !== roleId));
      return true;
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete standard role.", { id: TOAST_ID });
      return false;
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRoles(categoryId);
  }, [loadRoles, categoryId]);

  return { roles, loading, loadRoles, addRole, editRole, removeRole };
}

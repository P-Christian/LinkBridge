"use client";

// src/modules/client/talent-search/hooks/useSavedTalent.ts

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import { SavedTalent } from "../types";

export function useSavedTalent() {
  const [saved, setSaved] = useState<SavedTalent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const abortRead = useRequestAbort();

  const fetchSaved = useCallback(async () => {
    setLoading(true);
    setError("");

    // Saving or unsaving refetches the list; an earlier read that lands after
    // it would write a snapshot taken before that change and drop the row the
    // client just saved.
    const signal = abortRead();
    try {
      const res = await fetch("/api/client/saved-talent", { signal });
      const json = await res.json();

      if (signal.aborted) return;

      if (!res.ok) {
        throw new Error(json.error || "Failed to load saved talent.");
      }

      setSaved(json.saved ?? []);
    } catch (err: unknown) {
      if (signal.aborted) return;
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [abortRead]);

  useEffect(() => {
    // Deferred so the loading flag is not raised synchronously inside the
    // effect body; the read itself is superseded by any later refetch.
    void Promise.resolve().then(() => fetchSaved());
  }, [fetchSaved]);

  const saveTalent = useCallback(
    async (
      talentUserId: number,
      notes?: string
    ): Promise<boolean> => {
      setSaving(true);
      setError("");

      try {
        const res = await fetch("/api/client/saved-talent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            talent_user_id: talentUserId,
            notes: notes || null,
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          if (res.status === 409) {
            void fetchSaved();
            return true; // Already saved
          }
          throw new Error(json.error || "Failed to save talent.");
        }

        void fetchSaved();
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [fetchSaved]
  );

  const unsaveTalent = useCallback(async (talentUserId: number): Promise<boolean> => {
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/client/saved-talent/${talentUserId}`, {
        method: "DELETE",
      });

      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error || "Failed to remove saved talent.");
      }

      setSaved((prev) => prev.filter((s) => s.talent_user_id !== talentUserId));
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred.");
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const sendInvitation = useCallback(
    async (talentUserId: number, message: string, jobId?: number): Promise<boolean> => {
      setSaving(true);
      setError("");

      try {
        const res = await fetch("/api/client/talent-invitation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            talent_user_id: talentUserId,
            message,
            job_id: jobId || null,
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to send invitation.");
        }

        // The invitation row exists even when delivery did not, so the response
        // reports what failed rather than the dialog claiming a clean send.
        const warnings: unknown[] = Array.isArray(json.warnings) ? json.warnings : [];
        for (const warning of warnings) {
          if (typeof warning === "string") toast.warning(warning);
        }
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return {
    saved,
    loading,
    saving,
    error,
    fetchSaved,
    saveTalent,
    unsaveTalent,
    sendInvitation,
    clearError: () => setError(""),
  };
}

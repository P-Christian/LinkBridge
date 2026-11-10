"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import { parseErrorMessage, showErrorToast } from "@/lib/toast";

export interface UseFetchResourceOptions {
  /** Text shown when the failure carries no message of its own. */
  fallbackError?: string;
  /** Toast the failure instead of only exposing `error`. Off by default. */
  toast?: boolean;
  /** Give the failure toast a Retry action that re-reads non-quietly. */
  retryAction?: boolean;
  /** Skip the read on mount, e.g. while a required id is still unknown.
   * `reload` and `refresh` still work, so a manual trigger stays possible. */
  enabled?: boolean;
}

export interface FetchResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string;
  /** Re-reads non-quietly, so `loading` flips true. Identity is stable. */
  reload: () => void;
  /** Re-reads without touching `loading`, for background refreshes. Identity is stable. */
  refresh: () => void;
  setData: (updater: T | null | ((previous: T | null) => T | null)) => void;
  /** For writes that report into the same slot the read error uses. */
  setError: (message: string) => void;
  clearError: () => void;
}

/**
 * Reads a `/api` resource with loading, error, toast and abort handled once.
 *
 * `fetcher` must be stable across renders (wrap it in `useCallback`); a new
 * identity is what re-triggers the read, so parameters belong in that
 * `useCallback`'s dependency list.
 *
 * `loading` starts true and the first read does not set it, because a
 * synchronous `setState` inside a mount effect is a lint error in this repo. A
 * changed `fetcher` therefore refreshes without a skeleton flash; mount a fresh
 * instance (via `key`) when you want the loading state reset.
 */
export function useFetchResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: UseFetchResourceOptions = {}
): FetchResourceState<T> {
  const { fallbackError, toast = false, retryAction = false, enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  const nextSignal = useRequestAbort();

  // A retry clicked from a toast belongs to the load that started it, so the
  // action reads the newest loader through this instead of closing over a stale
  // one. Assigned in an effect, never during render.
  const retryRef = useRef<() => void>(() => {});

  const settle = useCallback(
    async (err: unknown) => {
      setError(parseErrorMessage(err, fallbackError));
      setLoading(false);
      if (toast) {
        await showErrorToast(
          err,
          fallbackError,
          retryAction ? RETRY_ACTION(retryRef) : undefined
        );
      }
    },
    [fallbackError, retryAction, toast]
  );

  const load = useCallback(
    async (quiet: boolean) => {
      if (!quiet) {
        setLoading(true);
        setError("");
      }

      const signal = nextSignal();
      try {
        setData(await fetcher(signal));
        setError("");
      } catch (err: unknown) {
        if (signal.aborted) return;
        await settle(err);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [fetcher, nextSignal, settle]
  );

  // The first read is written inline rather than calling `load`, because this
  // repo lints `react-hooks/set-state-in-effect` as an error; settling the
  // promise in a callback is the pattern the hooks this replaces already used.
  useEffect(() => {
    if (!enabled) return;
    const signal = nextSignal();
    fetcher(signal).then(
      (result) => {
        if (signal.aborted) return;
        setData(result);
        setError("");
        setLoading(false);
      },
      (err: unknown) => {
        if (signal.aborted) return;
        void settle(err);
      }
    );
  }, [enabled, fetcher, nextSignal, settle]);

  const reload = useCallback(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    retryRef.current = reload;
  }, [reload]);

  const applyData = useCallback(
    (updater: T | null | ((previous: T | null) => T | null)) => {
      setData((previous) =>
        typeof updater === "function"
          ? (updater as (p: T | null) => T | null)(previous)
          : updater
      );
    },
    []
  );

  const applyError = useCallback((message: string) => setError(message), []);
  const clearError = useCallback(() => setError(""), []);

  return {
    data,
    loading,
    error,
    reload,
    refresh,
    setData: applyData,
    setError: applyError,
    clearError,
  };
}

function RETRY_ACTION(retryRef: { current: () => void }) {
  return { action: { label: "Retry", onClick: () => retryRef.current() } };
}

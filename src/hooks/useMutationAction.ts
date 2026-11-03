"use client";

import { useCallback, useState } from "react";
import { parseErrorMessage, showErrorToast, showSuccessToast } from "@/lib/toast";

export type MutationOutcome<T> = { ok: true; data: T } | { ok: false; message: string };

export interface UseMutationActionOptions {
  /** Text shown when the failure carries no message of its own. */
  fallbackError?: string;
  /** Toast this after a successful run. Omit to stay silent. */
  successMessage?: string;
  /** Toast failures as well as returning them. Defaults to true. */
  toast?: boolean;
}

export interface MutationState<TArgs, TRes> {
  run: (args: TArgs) => Promise<MutationOutcome<TRes>>;
  pending: boolean;
  error: string;
  reset: () => void;
}

/**
 * Runs one `/api` mutation with pending state and toast feedback.
 *
 * Deliberately does not use `useRequestAbort`: as `lib/route-fetch.ts` already
 * establishes, cancelling a half-applied write is worse than a slow one, so an
 * unmount never aborts here.
 *
 * Callers that optimistically update state should apply their change, `await
 * run(...)`, and restore their snapshot when `ok` is false.
 */
export function useMutationAction<TArgs, TRes>(
  mutate: (args: TArgs, signal?: AbortSignal) => Promise<TRes>,
  options: UseMutationActionOptions = {}
): MutationState<TArgs, TRes> {
  const { fallbackError, successMessage, toast = true } = options;

  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(
    async (args: TArgs): Promise<MutationOutcome<TRes>> => {
      setPending(true);
      if (toast) setError("");
      try {
        const data = await mutate(args);
        setError("");
        if (successMessage) showSuccessToast(successMessage);
        return { ok: true, data };
      } catch (err: unknown) {
        const message = parseErrorMessage(err, fallbackError);
        setError(message);
        if (toast) await showErrorToast(err, fallbackError);
        return { ok: false, message };
      } finally {
        setPending(false);
      }
    },
    [fallbackError, mutate, successMessage, toast]
  );

  const reset = useCallback(() => {
    setError("");
    setPending(false);
  }, []);

  return { run, pending, error, reset };
}

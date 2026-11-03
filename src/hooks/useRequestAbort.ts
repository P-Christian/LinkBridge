"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Hands out a fresh signal per read, cancelling the superseded read and any
 * read still running when the component unmounts. Callers must bail out of
 * their catch when `signal.aborted` is set — an abandoned read is not an error
 * the user should be told about.
 */
export function useRequestAbort() {
  const current = useRef<AbortController | null>(null);

  const nextSignal = useCallback(() => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    return controller.signal;
  }, []);

  useEffect(() => () => current.current?.abort(), []);

  return nextSignal;
}

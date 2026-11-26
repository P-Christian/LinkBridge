// src/modules/vos-admin/hooks/useHiringStream.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectionStatus, HireEvent, HiringSource } from '../types/hiring-map.types';
import { hireTime } from '../lib/hiring-map/hiring-format';

/** The hire that is currently being "announced" on screen. */
export interface Arrival {
  hire: HireEvent;
  /** Date.now() when it was released from the queue */
  at: number;
}

export interface UseHiringStreamOptions {
  /** Minimum gap between two on-screen arrivals, so a burst plays one by one. */
  releaseEveryMs?: number;
  /** How long an arrival stays highlighted. */
  arrivalHoldMs?: number;
  /** Ticker length. */
  recentCount?: number;
}

export interface HiringStream {
  hires: HireEvent[];
  recent: HireEvent[];
  arrival: Arrival | null;
  status: ConnectionStatus;
  /** true until the first snapshot has arrived */
  loading: boolean;
  error: string | null;
  /** hires waiting in the burst queue */
  queued: number;
  simulate: (() => void) | undefined;
}

const newestFirst = (a: HireEvent, b: HireEvent) => hireTime(b) - hireTime(a);

export function useHiringStream(source: HiringSource, options: UseHiringStreamOptions = {}): HiringStream {
  const { releaseEveryMs = 1_600, arrivalHoldMs = 7_000, recentCount = 12 } = options;

  const [hires, setHires] = useState<HireEvent[]>([]);
  const [recent, setRecent] = useState<HireEvent[]>([]);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(source.kind === 'demo' ? 'demo' : 'connecting');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(0);

  const queueRef = useRef<HireEvent[]>([]);
  const knownRef = useRef<Set<string>>(new Set());
  const arrivalTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const release = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) return;
    setQueued(queueRef.current.length);
    setHires((prev) => [...prev, next]);
    setRecent((prev) => [next, ...prev].slice(0, recentCount));
    const at = Date.now();
    setArrival({ hire: next, at });
    if (arrivalTimer.current) clearTimeout(arrivalTimer.current);
    arrivalTimer.current = setTimeout(() => {
      setArrival((current) => (current && current.at === at ? null : current));
    }, arrivalHoldMs);
  }, [arrivalHoldMs, recentCount]);

  // Drain the queue at a steady pace.
  useEffect(() => {
    const id = setInterval(release, releaseEveryMs);
    return () => clearInterval(id);
  }, [release, releaseEveryMs]);

  useEffect(() => {
    const controller = new AbortController();
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    queueRef.current = [];
    knownRef.current = new Set();

    // Defer state resets to avoid cascading render warning on effect mount
    queueMicrotask(() => {
      if (cancelled) return;
      setHires([]);
      setRecent([]);
      setArrival(null);
      setQueued(0);
      setLoading(true);
      setError(null);
      setStatus(source.kind === 'demo' ? 'demo' : 'connecting');
    });

    source
      .loadSnapshot(controller.signal)
      .then((snapshot) => {
        if (cancelled) return;
        const unique = snapshot.filter((h) => !knownRef.current.has(h.hireId));
        unique.forEach((h) => knownRef.current.add(h.hireId));
        setHires(unique);
        setRecent([...unique].sort(newestFirst).slice(0, recentCount));
        setLoading(false);

        unsubscribe = source.subscribe({
          onStatus: (s) => !cancelled && setStatus(s),
          onHire: (hire) => {
            if (cancelled || knownRef.current.has(hire.hireId)) return;
            knownRef.current.add(hire.hireId);
            queueRef.current.push(hire);
            setQueued(queueRef.current.length);
          },
        });
      })
      .catch((err: unknown) => {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : 'Could not load hires');
        setStatus('offline');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
      unsubscribe?.();
      if (arrivalTimer.current) clearTimeout(arrivalTimer.current);
    };
  }, [source, recentCount]);

  return { hires, recent, arrival, status, loading, error, queued, simulate: source.simulate };
}


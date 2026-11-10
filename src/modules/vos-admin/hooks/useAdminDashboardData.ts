/* eslint-disable react-hooks/set-state-in-effect */
// src/modules/vos-admin/hooks/useAdminDashboardData.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useRequestAbort } from '@/hooks/useRequestAbort';
import type { AdminDashboardOverviewData } from '../types/dashboard';

export function useAdminDashboardData() {
  const [data, setData] = useState<AdminDashboardOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const abortRead = useRequestAbort();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    // The Refresh button and the verification-updated event both refetch, so an
    // older snapshot must not be the one that lands last.
    const signal = abortRead();
    try {
      const res = await fetch('/api/vos-admin/dashboard/overview', {
        cache: 'no-store',
        signal,
      });
      if (!res.ok) {
        throw new Error(`Failed to load dashboard data (${res.status})`);
      }
      const json: AdminDashboardOverviewData = await res.json();
      if (signal.aborted) return;
      setData(json);
      // Partial failures are reported per source by the route. Naming them here
      // is the only signal that a dash on a card means "unknown", not "zero".
      if (json.errors?.length) {
        toast.warning(`Dashboard figures unavailable: ${json.errors.join(', ')}.`);
      }
    } catch (err: unknown) {
      if (signal.aborted) return;
      console.warn('Admin dashboard overview fetch failed:', err);
      // Keep the figures already on screen instead of replacing them with
      // invented platform totals; an empty first load renders as dashes.
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
      toast.error('Could not load the dashboard figures.');
    } finally {
      if (!signal.aborted) setIsLoading(false);
    }
  }, [abortRead]);

  useEffect(() => {
    fetchData();

    const handleVerificationUpdated = () => {
      fetchData();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('vos:verification-updated', handleVerificationUpdated);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('vos:verification-updated', handleVerificationUpdated);
      }
    };
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

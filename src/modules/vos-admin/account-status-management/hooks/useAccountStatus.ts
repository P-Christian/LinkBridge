// src/modules/vos-admin/account-status-management/hooks/useAccountStatus.ts
"use client";

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useRequestAbort } from '@/hooks/useRequestAbort';
import { AccountStatusUser, StatusTransitionPayload, AppealDecisionPayload, AccountStatusMetrics } from '../types/account-status.types';

/**
 * The transition itself succeeded, so these are reported as a warning rather
 * than an error: an admin who is told it failed retries, and a retry is a second
 * status change on a live account.
 */
function warnPartial(warnings: unknown): void {
  if (Array.isArray(warnings) && warnings.length > 0) {
    toast.warning(warnings.filter((w) => typeof w === 'string').join(' '));
  }
}

export function useAccountStatus() {
  const [users, setUsers] = useState<AccountStatusUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metrics, setMetrics] = useState<AccountStatusMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortList = useRequestAbort();
  const abortDetail = useRequestAbort();

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const res = await fetch('/api/vos-admin/account-status?metrics=true');
      if (res.ok) {
        const json = await res.json();
        setMetrics(json.metrics ?? null);
      }
    } catch {
      // Non-blocking metric read failure
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async (
    statusFilter?: string,
    search?: string,
    page: number = 1,
    limit: number = 10,
    appealsOnly?: boolean
  ) => {
    setLoading(true);
    setError(null);
    // Status tab, search and paging each start a new read; only the newest one
    // may write, or the queue shows one page while the pager says another.
    const signal = abortList();
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'ALL') params.append('statusFilter', statusFilter);
      if (search && search.trim()) params.append('search', search.trim());
      if (appealsOnly) params.append('appealsOnly', 'true');
      params.append('page', String(page));
      params.append('limit', String(limit));

      const res = await fetch(`/api/vos-admin/account-status?${params.toString()}`, { signal });
      const json = await res.json();
      if (signal.aborted) return;
      if (!res.ok) throw new Error(json.error || 'Failed to fetch account status users');

      setUsers(json.users ?? []);
      setTotal(json.total ?? 0);
    } catch (err: unknown) {
      if (signal.aborted) return;
      setError((err as Error).message);
      setUsers([]);
      setTotal(0);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [abortList]);

  const fetchUserDetail = useCallback(async (userId: number): Promise<AccountStatusUser | null> => {
    setLoading(true);
    setError(null);
    // Opening another user's modal starts a new read. A superseded one returns
    // null instead of its user, otherwise the modal pre-fills the status-change
    // form from the previous user's record.
    const signal = abortDetail();
    try {
      const res = await fetch(`/api/vos-admin/account-status?userId=${userId}`, { signal });
      const json = await res.json();
      if (signal.aborted) return null;
      if (!res.ok) throw new Error(json.error || 'Failed to fetch user status details');
      return json.user;
    } catch (err: unknown) {
      if (signal.aborted) return null;
      setError((err as Error).message);
      return null;
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [abortDetail]);

  const changeStatus = useCallback(async (payload: StatusTransitionPayload): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch('/api/vos-admin/account-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update account status');
      warnPartial(json.warnings);
      return true;
    } catch (err: unknown) {
      setError((err as Error).message);
      return false;
    }
  }, []);

  const resolveAppealCase = useCallback(async (payload: AppealDecisionPayload & { userId: number }): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch('/api/vos-admin/account-status/appeals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to resolve appeal case');
      warnPartial(json.warnings);
      return true;
    } catch (err: unknown) {
      setError((err as Error).message);
      return false;
    }
  }, []);

  return {
    users,
    total,
    loading,
    metrics,
    metricsLoading,
    error,
    fetchUsers,
    fetchMetrics,
    fetchUserDetail,
    changeStatus,
    resolveAppealCase,
  };
}

"use client";

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useRequestAbort } from '@/hooks/useRequestAbort';
import { VsUser } from '../types/user.types';

export function useUsers() {
  const [users, setUsers] = useState<VsUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRead = useRequestAbort();

  const fetchUsers = useCallback(async (
    roleId?: number,
    search?: string,
    page: number = 1,
    limit: number = 10
  ) => {
    setLoading(true);
    setError(null);
    // Role tab, search and paging each start a new read; only the newest one may
    // write, or the table shows one page while the pager says another.
    const signal = abortRead();
    try {
      const params = new URLSearchParams();
      if (roleId && roleId !== 0) params.append('roleId', String(roleId));
      if (search && search.trim()) params.append('search', search.trim());
      params.append('page', String(page));
      params.append('limit', String(limit));

      const res = await fetch(`/api/vos-admin/users?${params.toString()}`, { signal });
      const json = await res.json();
      if (signal.aborted) return;
      if (!res.ok) throw new Error(json.error || 'Failed to fetch users');

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
  }, [abortRead]);

  const reviewIdentity = useCallback(async (
    verificationId: number,
    status: 'approved' | 'rejected',
    rejectionNote?: string
  ): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch('/api/vos-admin/users/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationId, status, rejectionNote }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to review verification');
      const warnings: string[] = Array.isArray(json.warnings) ? json.warnings : [];
      warnings.forEach((warning) => toast.warning(warning));
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
    error,
    fetchUsers,
    reviewIdentity,
  };
}

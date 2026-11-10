// src/modules/vos-admin/audit-trail/hooks/useAuditTrail.ts
"use client";

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useRequestAbort } from '@/hooks/useRequestAbort';
import * as XLSX from 'xlsx';
import { AuditRecord, AuditFilters, AuditKPIData, AuditCategoryConfig, DEFAULT_AUDIT_CONFIG } from '../types/audit.types';

export function useAuditTrail() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState<AuditKPIData>({
    todayEvents: null,
    failedEvents: null,
    deniedAccess: null,
    adminActions: null,
  });
  const [config, setConfig] = useState<AuditCategoryConfig>(DEFAULT_AUDIT_CONFIG);
  const [loading, setLoading] = useState(false);

  const abortRead = useRequestAbort();

  const fetchAuditLogs = useCallback(async (filters: AuditFilters) => {
    setLoading(true);
    // Each filter change or page click starts a new read; only the newest one
    // may write, or the table and KPI cards can show a superseded search while
    // the controls read for the current one.
    const signal = abortRead();
    try {
      const params = new URLSearchParams();
      params.append('page', String(filters.page));
      params.append('limit', String(filters.limit));

      if (filters.search?.trim()) params.append('search', filters.search.trim());
      if (filters.event_category && filters.event_category !== 'ALL') params.append('event_category', filters.event_category);
      if (filters.action && filters.action !== 'ALL') params.append('action', filters.action);
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.actor_type && filters.actor_type !== 'ALL') params.append('actor_type', filters.actor_type);
      if (filters.organization_type && filters.organization_type !== 'ALL') params.append('organization_type', filters.organization_type);
      if (filters.resource_type?.trim()) params.append('resource_type', filters.resource_type.trim());
      if (filters.actor_user_id) params.append('actor_user_id', String(filters.actor_user_id));
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);

      const res = await fetch(`/api/vos-admin/audit-trail?${params.toString()}`, { signal });
      const json = await res.json();
      if (signal.aborted) return;
      if (!res.ok) throw new Error(json.error || 'Failed to fetch audit logs');

      setRecords(json.records ?? []);
      setTotal(json.total ?? 0);
      if (json.kpis) {
        setKpis(json.kpis);
      }
    } catch (err: unknown) {
      if (signal.aborted) return;
      toast.error((err as Error).message);
      setRecords([]);
      setTotal(0);
      // The cards count the same read that just failed, so they cannot keep
      // showing the previous search's numbers.
      setKpis({
        todayEvents: null,
        failedEvents: null,
        deniedAccess: null,
        adminActions: null,
      });
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [abortRead]);

  const fetchAuditConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/vos-admin/audit-trail/config');
      const json = await res.json();
      if (res.ok && json.config) {
        setConfig(json.config);
        return;
      }
      // Without this the panel keeps showing its built-in defaults, and an admin
      // reads "everything off" as the stored configuration rather than as a
      // failed request.
      toast.error(json.error || 'Failed to load audit settings.');
    } catch (err: unknown) {
      console.warn("Failed to load audit config:", err);
      toast.error("Failed to load audit settings.");
    }
  }, []);

  const saveAuditConfig = useCallback(async (newConfig: AuditCategoryConfig): Promise<boolean> => {
    try {
      const res = await fetch('/api/vos-admin/audit-trail/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: newConfig }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save audit settings');

      if (Array.isArray(json.warnings) && json.warnings.length > 0) {
        // Some rows did not land, so the echoed config is not what the database
        // holds. Re-read it instead of painting the panel with unsaved state.
        toast.warning(json.warnings.join(' '));
        await fetchAuditConfig();
        return true;
      }

      if (json.config) {
        setConfig(json.config);
      }
      return true;
    } catch (err: unknown) {
      toast.error((err as Error).message);
      return false;
    }
  }, [fetchAuditConfig]);

  const exportCSV = useCallback(async (filters: AuditFilters) => {
    try {
      const params = new URLSearchParams();
      params.append('export', 'csv'); // Keep asking backend for CSV to avoid backend rewrites

      // Cleanly append filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== 'ALL' && value !== '') {
          const formattedValue = typeof value === 'string' ? value.trim() : String(value);
          if (formattedValue && key !== 'page' && key !== 'limit') {
            params.append(key, formattedValue);
          }
        }
      });

      const res = await fetch(`/api/vos-admin/audit-trail?${params.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || 'Failed to export audit data');
      }
      if (res.headers.get('X-Export-Truncated') === 'true') {
        toast.warning('Row limit reached — narrow the date range or filters for a complete export.');
      }

      // 1. Get the raw CSV text from the backend
      const blob = await res.blob();
      const csvText = await blob.text();

      // 2. Parse the CSV text into a SheetJS Workbook
      const workbook = XLSX.read(csvText, { type: 'string', raw: true });
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];

      // 3. Define auto-fitted column widths based on your screenshot
      worksheet['!cols'] = [
        { wch: 10 },  // A: Audit ID
        { wch: 22 },  // B: Timestamp
        { wch: 20 },  // C: Category
        { wch: 25 },  // D: Event Type
        { wch: 15 },  // E: Action
        { wch: 15 },  // F: Status
        { wch: 15 },  // G: Actor Type
        { wch: 15 },  // H: Actor User ID
        { wch: 25 },  // I: Actor Name
        { wch: 20 },  // J: Resource (Type)
        { wch: 15 },  // K: Resource ID
        { wch: 25 },  // L: Organization
        { wch: 70 },  // M: Reason (Made extra wide for log descriptions)
        { wch: 20 },  // N: IP Address
        { wch: 40 },  // O: Correlation ID
      ];

      // 4. Generate and download the .xlsx file
      const fileName = `audit_trail_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'An error occurred during export.'
      );
    }
  }, []);

  return {
    records,
    total,
    kpis,
    config,
    loading,
    fetchAuditLogs,
    fetchAuditConfig,
    saveAuditConfig,
    exportCSV, // Make sure to update this in your component UI as well!
  };
}
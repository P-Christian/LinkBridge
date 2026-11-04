// src/modules/vos-admin/audit-trail/components/AuditTrailPage.tsx
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useAuditTrail } from '../hooks/useAuditTrail';
import { AuditFilters as AuditFiltersType, AuditRecord } from '../types/audit.types';
import { AuditKPICards } from './AuditKPICards';
import { AuditFilters } from './AuditFilters';
import { AuditTable } from './AuditTable';
import { AuditDetailModal } from './AuditDetailModal';
import { AuditSettingsModal } from './AuditSettingsModal';
import { Card } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';
import { motion, Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

const getTodayStr = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

const DEFAULT_FILTERS: AuditFiltersType = {
  search: '',
  event_category: 'ALL',
  action: 'ALL',
  status: 'ALL',
  actor_type: 'ALL',
  organization_type: 'ALL',
  resource_type: '',
  date_from: getTodayStr(),
  date_to: getTodayStr(),
  page: 1,
  limit: 10,
};

export function AuditTrailPage() {
  const { records, total, kpis, config, loading, fetchAuditLogs, fetchAuditConfig, saveAuditConfig, exportCSV } = useAuditTrail();
  const [filters, setFilters] = useState<AuditFiltersType>(DEFAULT_FILTERS);
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const loadData = useCallback(() => {
    fetchAuditLogs(filters);
  }, [fetchAuditLogs, filters]);

  useEffect(() => {
    loadData();
    fetchAuditConfig();
  }, [loadData, fetchAuditConfig]);

  const handleFilterChange = (newFilters: Partial<AuditFiltersType>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    await exportCSV(filters);
    setIsExporting(false);
  };

  const handleViewRecord = (record: AuditRecord) => {
    setSelectedRecord(record);
    setModalOpen(true);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="h-full flex-1 overflow-y-auto p-4 sm:p-8 bg-secondary/10 space-y-6"
    >
      {/* Page Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row justify-between sm:items-center gap-4"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Audit Trail</h1>
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Centralized immutable security and operational event record store for governance and forensic analysis.
          </p>
        </div>
      </motion.div>

      {/* KPI Cards */}
      {/* `loading` is true on every filter change too, and the previous counts
          are still on hand, so only a first read with nothing to show blanks them. */}
      <AuditKPICards kpis={kpis} loading={loading && records.length === 0} />

      {/* Main Content Card */}
      <motion.div variants={itemVariants}>
        <Card className="p-6 shadow-xs gap-0 rounded-xl border border-border bg-card">
          {/* Filter Bar */}
          <AuditFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleReset}
            onExportCSV={handleExportCSV}
            onOpenSettings={() => setSettingsOpen(true)}
            isExporting={isExporting}
          />

          {/* Audit Table */}
          <AuditTable
            records={records}
            total={total}
            loading={loading}
            page={filters.page}
            limit={filters.limit}
            onPageChange={(newPage) => handleFilterChange({ page: newPage })}
            onLimitChange={(newLimit) => handleFilterChange({ limit: newLimit, page: 1 })}
            onViewRecord={handleViewRecord}
          />
        </Card>
      </motion.div>

      {/* Audit Detail Modal */}
      <AuditDetailModal
        record={selectedRecord}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedRecord(null);
        }}
      />

      {/* Audit Settings Customization Modal */}
      <AuditSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config}
        onSaveConfig={saveAuditConfig}
      />
    </motion.div>
  );
}

export default AuditTrailPage;


// src/modules/vos-admin/components/SchoolAdminDashboard.tsx
'use client';

import React from 'react';
import { RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdminDashboardData } from '../hooks/useAdminDashboardData';
import { AdminMetricCards } from './dashboard/AdminMetricCards';
import { AdminVelocityChart } from './dashboard/AdminVelocityChart';
import { AdminDistributionChart } from './dashboard/AdminDistributionChart';
import { AdminPendingQueue } from './dashboard/AdminPendingQueue';
import { AdminQuickShortcuts } from './dashboard/AdminQuickShortcuts';

export function SchoolAdminDashboard() {
  const { data, isLoading, refetch } = useAdminDashboardData();

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
      {/* Executive Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/90 to-background p-6 shadow-sm">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                <Shield className="h-3.5 w-3.5" />
                VOS Command Center
              </span>
              <span className="text-xs text-muted-foreground">• {formattedDate}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              VOS Admin Portal
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Platform-wide governance overview covering institutional accreditation, employer verifications, and AI matching telemetry.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="rounded-xl border-border/80 shadow-2xs hover:bg-muted"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
          </div>
        </div>
      </div>

      {/* Metric Cards Row */}
      <section>
        <AdminMetricCards kpis={data?.kpis || {
          totalUsers: null,
          activeUsers: null,
          pendingVerifications: 0,
          pendingCompanyVerifications: 0,
          pendingSchoolVerifications: 0,
          totalVerifiedSchools: 0,
          totalVerifiedCompanies: 0,
          geminiHealthStatus: 'NO_DATA',
          geminiSuccessRate: null,
          geminiAvgLatencyMs: null,
        }} isLoading={isLoading} />
      </section>

      {/* Visual Analytics Grid */}
      <section className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AdminVelocityChart data={data?.velocity || []} isLoading={isLoading} />
        </div>
        <div>
          <AdminDistributionChart data={data?.distribution || []} isLoading={isLoading} />
        </div>
      </section>

      {/* Operational Queues & Shortcuts */}
      <section className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <AdminPendingQueue
          items={data?.pendingActions || []}
          totalPending={data?.kpis.pendingVerifications}
          isLoading={isLoading}
        />
        <AdminQuickShortcuts />
      </section>
    </div>
  );
}

// src/modules/vos-admin/components/dashboard/AdminMetricCards.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { 
  GraduationCap, 
  Users, 
  Cpu, 
  ArrowUpRight, 
  ShieldAlert,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { AdminDashboardKPIs } from '../../types/dashboard';

interface AdminMetricCardsProps {
  kpis: AdminDashboardKPIs;
  isLoading?: boolean;
}

export function AdminMetricCards({ kpis, isLoading = false }: AdminMetricCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-36 rounded-2xl border border-border/80 bg-card p-5 shadow-xs animate-pulse">
            <div className="flex justify-between items-center mb-4">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-9 w-9 bg-muted rounded-xl" />
            </div>
            <div className="h-8 w-16 bg-muted rounded mb-2" />
            <div className="h-3 w-32 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Pending Verifications',
      value: kpis.pendingVerifications,
      subtitle: `${kpis.pendingCompanyVerifications} companies • ${kpis.pendingSchoolVerifications} schools`,
      badgeText: kpis.pendingVerifications > 0 ? 'Requires Action' : 'All Clear',
      badgeStatus: kpis.pendingVerifications > 0 ? 'warning' : 'success',
      icon: ShieldAlert,
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBgColor: 'bg-amber-500/10 border-amber-500/20',
      accentColor: 'border-t-amber-500',
      href: '/vos-sync/vos-admin/company-verification',
    },
    {
      title: 'Total Platform Users',
      value: kpis.totalUsers ?? '—',
      subtitle:
        kpis.activeUsers === null ? 'Active account count unavailable' : `${kpis.activeUsers} active accounts`,
      // No growth badge: the overview has no previous-period count to compare
      // against, so any percentage here would be invented.
      badgeText: null,
      badgeStatus: 'success',
      icon: Users,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBgColor: 'bg-blue-500/10 border-blue-500/20',
      accentColor: 'border-t-blue-500',
      href: '/vos-sync/vos-admin/users',
    },
    {
      title: 'Verified Institutions',
      value: kpis.totalVerifiedSchools,
      subtitle: `${kpis.totalVerifiedCompanies} partner employers`,
      badgeText: null,
      badgeStatus: 'success',
      icon: GraduationCap,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBgColor: 'bg-emerald-500/10 border-emerald-500/20',
      accentColor: 'border-t-emerald-500',
      href: '/vos-sync/vos-admin/school-verification',
    },
    {
      title: 'AI Engine Health',
      value: kpis.geminiSuccessRate === null ? '—' : `${kpis.geminiSuccessRate}%`,
      subtitle:
        kpis.geminiAvgLatencyMs === null
          ? 'No recent AI requests'
          : `${kpis.geminiAvgLatencyMs}ms avg latency`,
      badgeText: kpis.geminiHealthStatus,
      badgeStatus:
        kpis.geminiHealthStatus === 'HEALTHY' ? 'success' : kpis.geminiHealthStatus === 'NO_DATA' ? 'muted' : 'warning',
      icon: Cpu,
      iconColor: 'text-purple-600 dark:text-purple-400',
      iconBgColor: 'bg-purple-500/10 border-purple-500/20',
      accentColor: 'border-t-purple-500',
      href: '/vos-sync/vos-admin/gemini-monitoring',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Link
            key={idx}
            href={card.href}
            className={`group relative overflow-hidden rounded-2xl border border-border/80 border-t-[3.5px] ${card.accentColor} bg-card p-5 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5`}
          >
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {card.title}
              </p>
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${card.iconBgColor} ${card.iconColor} transition-transform duration-200 group-hover:scale-105`}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
            </div>

            <div className="mt-2.5 flex items-baseline gap-2">
              <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {card.value}
              </h3>
              {card.badgeText ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    card.badgeStatus === 'success'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : card.badgeStatus === 'warning'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {card.badgeStatus === 'success' ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : card.badgeStatus === 'warning' ? (
                    <AlertCircle className="h-3 w-3" />
                  ) : null}
                  {card.badgeText}
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-xs text-muted-foreground truncate">{card.subtitle}</p>

            <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              <span>View details</span>
              <ArrowUpRight className="h-3 w-3" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

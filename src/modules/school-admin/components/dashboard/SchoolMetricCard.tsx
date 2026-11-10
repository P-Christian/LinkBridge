// src/modules/school-admin/components/dashboard/SchoolMetricCard.tsx
'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SchoolMetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  badgeText?: string;
  badgeTrend?: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  topAccentColor?: string; // e.g. "border-t-blue-500"
  hoverBorderColor?: string; // e.g. "hover:border-blue-400/60"
  sparklineBars?: number[]; // Values 0 to 100 for mini bar visual, optional
}

export function SchoolMetricCard({
  title,
  value,
  subtitle,
  badgeText,
  badgeTrend = 'up',
  icon: Icon,
  iconColor,
  iconBgColor,
  topAccentColor = 'border-t-primary',
  hoverBorderColor = 'hover:border-primary/50',
  sparklineBars,
}: SchoolMetricCardProps) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-border/80 border-t-[3.5px] ${topAccentColor} bg-card p-5 shadow-xs transition-all duration-200 ${hoverBorderColor} hover:shadow-md hover:-translate-y-0.5`}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${iconBgColor} ${iconColor} transition-transform duration-200 group-hover:scale-105`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{value}</h3>
        {badgeText && (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              badgeTrend === 'up'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : badgeTrend === 'down'
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {badgeText}
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-muted-foreground truncate">{subtitle}</p>

      {/* Mini Visual Sparkline / Bar Graph Preview (if provided) */}
      {sparklineBars && sparklineBars.length > 0 && (
        <div className="mt-4 flex items-end gap-1.5 pt-1">
          {sparklineBars.map((height, idx) => (
            <div
              key={idx}
              className="w-full rounded-xs bg-muted/60 transition-colors hover:bg-primary/80"
              style={{
                height: `${Math.max(8, Math.min(height, 100) * 0.28)}px`,
                backgroundColor: idx === sparklineBars.length - 1 ? 'var(--primary)' : undefined,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// src/modules/vos-admin/components/dashboard/AdminVelocityChart.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { VerificationVelocityPoint } from '../../types/dashboard';

interface AdminVelocityChartProps {
  data: VerificationVelocityPoint[];
  isLoading?: boolean;
}

export function AdminVelocityChart({ data, isLoading = false }: AdminVelocityChartProps) {
  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-border/80 shadow-xs h-[360px] animate-pulse">
        <CardHeader>
          <div className="h-5 w-40 bg-muted rounded mb-2" />
          <div className="h-3 w-60 bg-muted rounded" />
        </CardHeader>
        <CardContent className="h-[240px] flex items-center justify-center">
          <div className="h-40 w-full bg-muted/40 rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  // The series only exists when the monthly counts could be read; an empty
  // chart would look the same as "nobody registered this month".
  if (data.length === 0) {
    return (
      <Card className="rounded-2xl border border-border/80 shadow-xs h-[360px]">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">
            Platform Growth & Velocity
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Monthly employer and institution registrations
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[240px] flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Growth counts are unavailable right now.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-border/80 shadow-xs flex flex-col justify-between">
      <CardHeader className="min-h-[72px] pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Platform Growth & Velocity
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Monthly employer and institution registrations
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              Companies
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Schools
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between pt-0">
        <div className="h-[230px] w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="adminColorCompanies" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="adminColorSchools" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const companies = payload.find((p) => p.dataKey === 'companies')?.value;
                    const schools = payload.find((p) => p.dataKey === 'schools')?.value;
                    return (
                      <div className="rounded-xl border border-border bg-popover/95 backdrop-blur-sm p-3 shadow-lg">
                        <p className="text-xs font-semibold text-popover-foreground mb-1.5">{label}</p>
                        <div className="space-y-1 text-xs">
                          <p className="flex items-center justify-between gap-4 text-blue-600 dark:text-blue-400">
                            <span>Companies:</span>
                            <span className="font-bold">{companies ?? '—'}</span>
                          </p>
                          <p className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                            <span>Institutions:</span>
                            <span className="font-bold">{schools ?? '—'}</span>
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="companies"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#adminColorCompanies)"
              />
              <Area
                type="monotone"
                dataKey="schools"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#adminColorSchools)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          <span>Reporting window: <strong>last 6 months</strong></span>
        </div>
      </CardContent>
    </Card>
  );
}

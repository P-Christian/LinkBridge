// src/modules/school-admin/components/dashboard/StudentEnrollmentVelocityChart.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export interface VelocityPoint {
  month: string;
  enrolled: number;
  placed: number;
}

interface StudentEnrollmentVelocityChartProps {
  data?: VelocityPoint[];
  totalStudents?: number;
  totalHired?: number;
}

export function StudentEnrollmentVelocityChart({
  data = [],
  totalStudents = 0,
  totalHired = 0,
}: StudentEnrollmentVelocityChartProps) {
  const chartPoints: VelocityPoint[] =
    data.length > 0
      ? data
      : [
          { month: 'Jun', enrolled: 0, placed: 0 },
          { month: 'Jul', enrolled: 0, placed: 0 },
          { month: 'Aug', enrolled: 0, placed: 0 },
          { month: 'Sep', enrolled: 0, placed: 0 },
          { month: 'Oct', enrolled: totalStudents, placed: totalHired },
        ];

  return (
    <Card className="group h-full rounded-2xl border border-border/80 border-t-[3.5px] border-t-blue-500 shadow-xs flex flex-col justify-between transition-all duration-200 hover:border-blue-400/60 dark:hover:border-blue-500/40 hover:shadow-md hover:-translate-y-0.5">
      <CardHeader className="min-h-[72px] pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Student & Placement Velocity
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Real candidate roster vs. employment placement activity
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              Enrolled ({totalStudents})
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Placed ({totalHired})
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between pt-0">
        <div className="h-[210px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEnrolled" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorPlaced" x1="0" y1="0" x2="0" y2="1">
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
                    return (
                      <div className="rounded-xl border border-border bg-popover/95 backdrop-blur-sm p-3 shadow-lg">
                        <p className="text-xs font-semibold text-popover-foreground mb-1.5">{label}</p>
                        <div className="space-y-1 text-xs">
                          <p className="flex items-center justify-between gap-4 text-blue-600 dark:text-blue-400">
                            <span>Students Enrolled:</span>
                            <span className="font-bold">{payload[0]?.value ?? 0}</span>
                          </p>
                          <p className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                            <span>Employed / Placed:</span>
                            <span className="font-bold">{payload[1]?.value ?? 0}</span>
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
                dataKey="enrolled"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorEnrolled)"
              />
              <Area
                type="monotone"
                dataKey="placed"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorPlaced)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          <span>Active Institution: <strong>Current Academic Term</strong></span>
          <span className="font-semibold text-foreground">{totalStudents} Total Students</span>
        </div>
      </CardContent>
    </Card>
  );
}

// src/modules/school-admin/components/dashboard/StudentPipelineSplitChart.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { FunnelStageStat } from '../../success-metrics/types/success-metrics.types';

interface PipelineStage {
  name: string;
  count: number;
  color: string;
}

interface StudentPipelineSplitChartProps {
  totalStudents?: number;
  totalApplications?: number;
  funnelStages?: FunnelStageStat[];
}

const STAGE_COLORS: Record<string, string> = {
  APPLIED: '#3b82f6',
  UNDER_REVIEW: '#6366f1',
  SHORTLISTED: '#8b5cf6',
  INTERVIEWING: '#f59e0b',
  HIRED: '#10b981',
};

export function StudentPipelineSplitChart({
  totalStudents = 0,
  totalApplications,
  funnelStages = [],
}: StudentPipelineSplitChartProps) {
  const hasRealData = funnelStages.some((s) => s.count > 0);

  // Derive discrete status counts from cumulative funnel stages (Option A: Application Funnel)
  // funnelStages: APPLIED (total applications), UNDER_REVIEW, INTERVIEWING, HIRED
  const cumulativeApplied = funnelStages.find((s) => s.stage === 'APPLIED')?.count || 0;
  const cumulativeUnderReview = funnelStages.find((s) => s.stage === 'UNDER_REVIEW')?.count || 0;
  const cumulativeInterviewing = funnelStages.find((s) => s.stage === 'INTERVIEWING')?.count || 0;
  const hiredCount = funnelStages.find((s) => s.stage === 'HIRED')?.count || 0;

  // Discrete partitions of applications:
  // Initial screening/applied: cumulativeApplied - cumulativeUnderReview
  // Under review: cumulativeUnderReview - cumulativeInterviewing
  // Interviewing: cumulativeInterviewing - hiredCount
  // Hired: hiredCount
  const appliedOnly = Math.max(0, cumulativeApplied - cumulativeUnderReview);
  const underReviewOnly = Math.max(0, cumulativeUnderReview - cumulativeInterviewing);
  const interviewingOnly = Math.max(0, cumulativeInterviewing - hiredCount);

  const applicationsTotal = totalApplications ?? (hasRealData ? cumulativeApplied : totalStudents);

  const data: PipelineStage[] = hasRealData
    ? [
        { name: 'Applied', count: appliedOnly, color: STAGE_COLORS.APPLIED },
        { name: 'Under Review', count: underReviewOnly, color: STAGE_COLORS.UNDER_REVIEW },
        { name: 'Interviewing', count: interviewingOnly, color: STAGE_COLORS.INTERVIEWING },
        { name: 'Hired', count: hiredCount, color: STAGE_COLORS.HIRED },
      ].filter((d) => d.count > 0)
    : [
        { name: 'Applied', count: 0, color: STAGE_COLORS.APPLIED },
        { name: 'Under Review', count: 0, color: STAGE_COLORS.UNDER_REVIEW },
        { name: 'Interviewing', count: 0, color: STAGE_COLORS.INTERVIEWING },
        { name: 'Hired', count: 0, color: STAGE_COLORS.HIRED },
      ];

  const totalActionCount = applicationsTotal > 0 ? applicationsTotal : data.reduce((acc, curr) => acc + curr.count, 0);
  const conversionRate =
    totalActionCount > 0 ? ((hiredCount / totalActionCount) * 100).toFixed(1) : '0.0';

  return (
    <Card className="group h-full rounded-2xl border border-border/80 border-t-[3.5px] border-t-purple-500 shadow-xs flex flex-col justify-between transition-all duration-200 hover:border-purple-400/60 dark:hover:border-purple-500/40 hover:shadow-md hover:-translate-y-0.5">
      <CardHeader className="min-h-[72px] pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Application Pipeline Split
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {totalActionCount} total applications submitted across stages
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between pt-0">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 h-[210px]">
          {/* Donut with center score */}
          <div className="relative h-[160px] w-[160px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  offset={20}
                  wrapperStyle={{ zIndex: 50, outline: 'none' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as PipelineStage;
                      const pct = totalActionCount > 0 ? Math.round((item.count / totalActionCount) * 100) : 0;
                      return (
                        <div className="rounded-lg border border-border bg-popover text-popover-foreground p-2.5 text-xs shadow-lg ring-1 ring-black/5 dark:ring-white/10 z-50">
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-muted-foreground mt-0.5">
                            {item.count} applications ({pct}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Pie
                  data={data.length > 0 ? data : [{ name: 'No Applications', count: 1, color: '#e2e8f0' }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={68}
                  paddingAngle={data.length > 1 ? 4 : 0}
                  dataKey="count"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Center Label */}
            <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-foreground">{totalActionCount}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                APPLICATIONS
              </span>
            </div>
          </div>

          {/* Right: Legend Breakdown */}
          <div className="w-full space-y-2 text-xs">
            {data.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-semibold text-foreground">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          <span>Hired outcomes</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {hiredCount} Hired ({conversionRate}% conversion)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

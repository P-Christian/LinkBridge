// src/modules/school-admin/success-metrics/components/PlacementFunnelChart.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FunnelStageStat } from '../types/success-metrics.types';
import { Info } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface PlacementFunnelChartProps {
  funnelStages: FunnelStageStat[];
}

const COLORS = [
  '#3b82f6', // blue-500 (Applied)
  '#6366f1', // indigo-500 (Under Review)
  '#8b5cf6', // purple-500 (Interviewing)
  '#10b981', // emerald-500 (Hired)
];

const CONVERSION_BASIS = ['applications', 'reviewed', 'interviewed'] as const;

export function PlacementFunnelChart({ funnelStages }: PlacementFunnelChartProps) {
  const chartData = funnelStages.map((stage, idx) => ({
    name: stage.label,
    count: stage.count,
    percentage: stage.percentageOfTotal,
    conversionFromPrevious: stage.conversionFromPrevious,
    fill: COLORS[idx % COLORS.length],
  }));

  const totalApplications = funnelStages.find((s) => s.stage === 'APPLIED')?.count || 0;

  return (
    <Card className="border shadow-xs">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold text-foreground">Hiring Conversion Funnel</CardTitle>
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="About cumulative funnel counts"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Info className="h-3 w-3" aria-hidden="true" />
                    Cumulative
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  Each stage includes everyone who reached it. An application can appear in more
                  than one stage.
                </TooltipContent>
              </UiTooltip>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Progression from job application to final employment placement
            </CardDescription>
          </div>
          <div className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {totalApplications} Total Applications
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                width={100}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.2, rx: 6 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
                        <p className="text-xs font-semibold text-popover-foreground">{data.name}</p>
                        <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                          <p className="flex justify-between gap-4">
                            <span>Count:</span>
                            <span className="font-semibold text-foreground">{data.count}</span>
                          </p>
                          <p className="flex justify-between gap-4">
                            <span>Share of applications:</span>
                            <span className="font-semibold text-foreground">{data.percentage}%</span>
                          </p>
                          {typeof data.conversionFromPrevious === 'number' ? (
                            <p className="flex justify-between gap-4">
                              <span>From previous stage:</span>
                              <span className="font-semibold text-foreground">
                                {data.conversionFromPrevious}%
                              </span>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={28}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Funnel Stage Badges Breakdown */}
        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-4">
          {funnelStages.map((stage, idx) => (
            <div key={stage.stage} className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-muted/40 p-2 text-center">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-xs font-medium text-muted-foreground">{stage.label}</span>
              </div>
              <span className="mt-0.5 text-sm font-bold text-foreground">{stage.count}</span>
              {typeof stage.conversionFromPrevious === 'number' ? (
                <>
                  <span className="text-[10px] font-medium text-foreground">
                    {stage.conversionFromPrevious}% of{' '}
                    {CONVERSION_BASIS[idx - 1] ?? 'previous stage'}
                  </span>
                  {stage.percentageOfTotal !== stage.conversionFromPrevious ? (
                    <span className="text-[10px] text-muted-foreground">
                      {stage.percentageOfTotal}% of all applications
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

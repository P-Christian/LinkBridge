// src/modules/vos-admin/components/dashboard/AdminDistributionChart.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { StatusDistributionItem } from '../../types/dashboard';

interface AdminDistributionChartProps {
  data: StatusDistributionItem[];
  isLoading?: boolean;
}

export function AdminDistributionChart({ data, isLoading = false }: AdminDistributionChartProps) {
  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-border/80 shadow-xs h-[360px] animate-pulse">
        <CardHeader>
          <div className="h-5 w-32 bg-muted rounded mb-2" />
          <div className="h-3 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent className="h-[240px] flex items-center justify-center">
          <div className="h-44 w-44 rounded-full bg-muted/40" />
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <Card className="rounded-2xl border border-border/80 shadow-xs flex flex-col justify-between">
      <CardHeader className="min-h-[72px] pb-2">
        <CardTitle className="text-base font-semibold text-foreground">
          Verification Breakdown
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Status allocation across all organizational entities
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between pt-0">
        <div className="h-[190px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} stroke="var(--background)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0];
                    const percentage = total > 0 ? ((Number(item.value) / total) * 100).toFixed(0) : 0;
                    return (
                      <div className="rounded-xl border border-border bg-popover/95 backdrop-blur-sm p-2.5 shadow-lg text-xs">
                        <p className="font-semibold text-popover-foreground">{item.name}</p>
                        <p className="text-muted-foreground mt-0.5">
                          Count: <strong className="text-foreground">{item.value}</strong> ({percentage}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold tracking-tight text-foreground">{total}</span>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Entities</span>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-xs">
          {data.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
              <span className="text-muted-foreground truncate">{item.name}</span>
              <span className="ml-auto font-semibold text-foreground text-[11px]">{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

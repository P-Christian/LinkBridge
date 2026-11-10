// src/modules/client/dashboard/components/HiringOverviewChart.tsx
"use client";

import React, { useMemo } from "react";
import { HiringOverviewChartData, TimeRangeKey } from "../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiPending } from "@/components/shared/KpiValue";

interface HiringOverviewChartProps {
  chartData?: HiringOverviewChartData;
  selectedRange: TimeRangeKey;
  onRangeChange: (range: TimeRangeKey) => void;
  isSwitching?: boolean;
}

const INTERVALS: { key: TimeRangeKey; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "3m", label: "3 months" },
  { key: "6m", label: "6 months" },
];

export default function HiringOverviewChart({
  chartData,
  selectedRange,
  onRangeChange,
  isSwitching = false,
}: HiringOverviewChartProps) {
  const currentData = useMemo(() => {
    if (!chartData || !chartData[selectedRange]) {
      return [];
    }
    return chartData[selectedRange];
  }, [chartData, selectedRange]);

  const totalInPeriod = useMemo(() => {
    return currentData.reduce((acc, curr) => acc + (curr.applications || 0), 0);
  }, [currentData]);

  // An unloaded range has no rows to sum, so 0 here would be a real-looking
  // answer to a question the server has not answered yet.
  const totalPending = isSwitching || !chartData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="bg-card/80 backdrop-blur-md border border-border/70 shadow-panel hover:shadow-panel-hover hover:border-primary/30 transition-[box-shadow,border-color] duration-200 rounded-2xl overflow-hidden py-0">
        <CardHeader className="p-4 sm:p-6 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-bold text-foreground dark:text-[#E6EAF5]">Hiring Overview</CardTitle>
              <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                <TrendingUp className="h-3 w-3" /> Trending Up
              </span>
            </div>
            <CardDescription className="text-sm md:text-xs text-muted-foreground dark:text-[#8A94AD]">
              Total of{" "}
              <strong className="text-foreground dark:text-white font-semibold">
                {totalPending ? <KpiPending /> : `${totalInPeriod} applications`}
              </strong>{" "}
              logged in this window. Click a data point to review applicants.
            </CardDescription>
          </div>

          {/* Time range switcher pills */}
          <div className="flex items-center p-1 bg-[#F4F6FA] dark:bg-[#0E1426] rounded-xl border border-[#E6EAF2] dark:border-[#1E2942] self-start sm:self-auto overflow-x-auto max-w-full">
            {INTERVALS.map((interval) => {
              const isActive = selectedRange === interval.key;
              return (
                <button
                  key={interval.key}
                  onClick={() => onRangeChange(interval.key)}
                  className="relative px-3 py-1.5 max-md:min-h-10 text-xs font-medium rounded-lg transition-colors whitespace-nowrap z-10"
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeChartTab"
                      className="absolute inset-0 bg-white dark:bg-[#121A2E] rounded-lg shadow-xs border border-[#E6EAF2] dark:border-[#1E2942]"
                      transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className={`relative z-20 ${isActive ? "text-foreground dark:text-white font-semibold" : "text-muted-foreground dark:text-[#8A94AD] hover:text-foreground"}`}>
                    {interval.label}
                  </span>
                </button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 pt-4">
          {isSwitching ? (
            <div className="h-[220px] sm:h-[290px] w-full flex flex-col justify-end gap-3 p-4">
              <Skeleton className="h-4 w-40 bg-muted/60" />
              <div className="flex items-end gap-3 h-full">
                <Skeleton className="h-1/3 flex-1 rounded-t-lg bg-muted/60" />
                <Skeleton className="h-2/3 flex-1 rounded-t-lg bg-muted/60" />
                <Skeleton className="h-1/2 flex-1 rounded-t-lg bg-muted/60" />
                <Skeleton className="h-4/5 flex-1 rounded-t-lg bg-muted/60" />
                <Skeleton className="h-3/4 flex-1 rounded-t-lg bg-muted/60" />
                <Skeleton className="h-full flex-1 rounded-t-lg bg-muted/60" />
              </div>
            </div>
          ) : (
            <div className="h-[220px] sm:h-[290px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={currentData}
                  margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="applicationGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgba(37,99,235,0.25)" stopOpacity={1} />
                      <stop offset="95%" stopColor="rgba(37,99,235,0.0)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="shortlistGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgba(59,130,246,0.18)" stopOpacity={1} />
                      <stop offset="95%" stopColor="rgba(59,130,246,0.0)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {/* Very light horizontal grid lines (#EEF1F6 light, #1E2942 dark) */}
                  <CartesianGrid
                    strokeDasharray="0"
                    vertical={false}
                    stroke="#EEF1F6"
                    className="dark:stroke-[#1E2942]"
                  />
                  <XAxis
                    dataKey="label"
                    stroke="#8A94AD"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    dy={8}
                  />
                  <YAxis
                    stroke="#8A94AD"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  {/* Hover tooltip with a vertical guide line */}
                  <Tooltip
                    cursor={{
                      stroke: "#3B82F6",
                      strokeWidth: 1.5,
                      strokeDasharray: "4 4",
                    }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-xl border border-[#E6EAF2] dark:border-[#1E2942] bg-white dark:bg-[#121A2E] p-3 shadow-lg text-xs space-y-1.5">
                            <p className="font-semibold text-foreground dark:text-[#E6EAF5] flex items-center gap-1.5">
                              <CalendarDays className="h-3.5 w-3.5 text-primary" />
                              {label}
                            </p>
                            <div className="flex items-center justify-between gap-4 text-muted-foreground dark:text-[#8A94AD]">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-blue-600" />
                                Applications:
                              </span>
                              <span className="font-bold text-foreground dark:text-white">{payload[0]?.value}</span>
                            </div>
                            {payload[1] && (
                              <div className="flex items-center justify-between gap-4 text-muted-foreground dark:text-[#8A94AD]">
                                <span className="flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                                  Shortlisted:
                                </span>
                                <span className="font-bold text-foreground dark:text-white">{payload[1]?.value}</span>
                              </div>
                            )}
                            <p className="text-[10px] text-primary pt-1 border-t border-border/50 font-medium">
                              Click to view applicants →
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="applications"
                    name="Applications"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#applicationGradient)"
                    animationDuration={400}
                  />
                  {currentData[0]?.shortlisted !== undefined && (
                    <Area
                      type="monotone"
                      dataKey="shortlisted"
                      name="Shortlisted"
                      stroke="#3B82F6"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fillOpacity={1}
                      fill="url(#shortlistGradient)"
                      animationDuration={400}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

"use client";

// src/modules/vos-admin/gemini-monitoring/pages/PeakUsageAnalyticsPage.tsx

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  TrendingUp,
  Zap,
  Blocks,
  Clock,
  Filter,
  Calendar,
  RotateCcw,
  RefreshCw,
  Activity,
  AlertTriangle,
  Flame,
  Cpu,
  X,
} from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.28,
      ease: [0.215, 0.61, 0.355, 1],
    },
  },
};

interface HourlyBucket {
  hourLabel: string;
  requests: number;
  tokens: number;
  errors: number;
  avgLatencyMs: number;
}

interface PeakUsageTrends {
  peakRpm: number;
  peakTpm: number;
  peakHourLabel: string | null;
  peakHourRequests: number;
  hourlyBuckets: HourlyBucket[];
}

interface AnalyticsData {
  success: boolean;
  configuredModel: string;
  kpis: {
    totalRequests: number;
    totalTokens: number;
    avgLatencyMs: number;
    successRate: number;
  };
  peakUsageTrends?: PeakUsageTrends;
  lastCheckedAt: string;
}

function getTodayPhDate(): string {
  const phMs = Date.now() + 8 * 3600 * 1000;
  return new Date(phMs).toISOString().slice(0, 10);
}

function getPhDateOffset(daysOffset: number): string {
  const phMs = Date.now() + 8 * 3600 * 1000 + daysOffset * 86400 * 1000;
  return new Date(phMs).toISOString().slice(0, 10);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const PROVIDER_FILTER_OPTIONS = [
  { value: "ALL", label: "All AI Engines" },
  { value: "GOOGLE_GEMINI", label: "Google Gemini (Cloud)" },
  { value: "LOCAL_AI", label: "Local AI (Self-Hosted)" },
];

const TIME_RANGE_OPTIONS = [
  { value: "1_DAY", label: "1 Day (Today)" },
  { value: "LAST_HOUR", label: "Last Hour" },
  { value: "7_DAYS", label: "7 Days" },
  { value: "28_DAYS", label: "28 Days" },
  { value: "THIS_MONTH", label: "This Month" },
  { value: "90_DAYS", label: "90 Days" },
  { value: "ALL_TIME", label: "All Time" },
  { value: "CUSTOM", label: "Custom Range" },
];

export function PeakUsageAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortAnalytics = useRequestAbort();

  const [selectedProvider, setSelectedProvider] = useState<string>("ALL");
  const [timeRange, setTimeRange] = useState<string>("1_DAY");
  const [dateFrom, setDateFrom] = useState<string>(() => getTodayPhDate());
  const [dateTo, setDateTo] = useState<string>(() => getTodayPhDate());

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedProvider !== "ALL") count++;
    if (timeRange !== "1_DAY") count++;
    return count;
  }, [selectedProvider, timeRange]);

  const fetchAnalytics = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setError(null);

    // Filters and the 30s poll share one payload: only the newest read may draw
    // the charts, or an old range lands over the one just selected.
    const signal = abortAnalytics();
    try {
      const params = new URLSearchParams();
      if (selectedProvider && selectedProvider !== "ALL") params.set("provider", selectedProvider);
      if (timeRange) params.set("time_range", timeRange);
      if (timeRange === "CUSTOM") {
        if (dateFrom) params.set("date_from", dateFrom);
        if (dateTo) params.set("date_to", dateTo);
      }

      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/vos-admin/gemini-monitoring${qs}`, { cache: "no-store", signal });
      if (signal.aborted) return;
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Telemetry read failed (${res.status}).`);
      }
      const json: AnalyticsData = await res.json();
      if (signal.aborted) return;
      setData(json);
    } catch (err) {
      if (signal.aborted) return;
      setError((err as Error)?.message || "Failed to load peak usage analytics.");
    } finally {
      if (!signal.aborted) setRefreshing(false);
    }
  }, [selectedProvider, timeRange, dateFrom, dateTo, abortAnalytics]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchAnalytics();
    });
    const interval = setInterval(() => {
      // The peak-usage read aggregates the whole call log; a page left open in a
      // background tab should not keep paying for it twice a minute.
      if (document.hidden) return;
      void fetchAnalytics(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  const handleTimeRangeChange = (val: string) => {
    setTimeRange(val);
    const today = getTodayPhDate();
    if (val === "1_DAY" || val === "TODAY") {
      setDateFrom(today);
      setDateTo(today);
    } else if (val === "7_DAYS") {
      setDateFrom(getPhDateOffset(-6));
      setDateTo(today);
    } else if (val === "28_DAYS") {
      setDateFrom(getPhDateOffset(-27));
      setDateTo(today);
    } else if (val === "THIS_MONTH") {
      setDateFrom(`${today.slice(0, 7)}-01`);
      setDateTo(today);
    } else if (val === "90_DAYS") {
      setDateFrom(getPhDateOffset(-89));
      setDateTo(today);
    } else if (val === "ALL_TIME") {
      setDateFrom("");
      setDateTo("");
    }
  };

  const handleReset = () => {
    setSelectedProvider("ALL");
    handleTimeRangeChange("1_DAY");
  };

  const hourlyBuckets = data?.peakUsageTrends?.hourlyBuckets || Array.from({ length: 24 }, (_, i) => ({
    hourLabel: `${i.toString().padStart(2, "0")}:00`,
    requests: 0,
    tokens: 0,
    errors: 0,
    avgLatencyMs: 0,
  }));

  const timeRangeLabel = TIME_RANGE_OPTIONS.find((o) => o.value === timeRange)?.label || "Selected Period";

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* ── Top Navigation & Breadcrumb ─────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex items-center justify-between gap-4">
        <Link
          href="/vos-sync/vos-admin/gemini-monitoring"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <motion.div
            whileHover={{ x: -3 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-xl bg-card border border-border group-hover:border-primary/40 shadow-xs transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </motion.div>
          <span>Back to Gemini AI Monitoring</span>
        </Link>
      </motion.div>

      {/* ── Page Header ────────────────────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-950 via-zinc-900 to-indigo-950 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 text-white p-6 sm:p-8 rounded-3xl border border-white/10 shadow-xl relative overflow-hidden"
      >
        <div className="absolute -right-10 -top-10 h-40 w-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
            <Flame className="h-7 w-7 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight">Peak Usage &amp; Surge Trends</h1>
              <Badge variant="outline" className="border-indigo-400/40 text-indigo-300 text-[10px] font-mono bg-white/5">
                Deep Analytics
              </Badge>
            </div>
            <p className="text-sm text-zinc-300 mt-1">
              Analyze invocation spikes, throughput density, and hourly load distributions
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Filter Toolbar ────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border border-border bg-card rounded-2xl shadow-xs p-4 sm:p-5 gap-2 ">
          {/* Top Row: Info & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between ">
            {/* Filter Badge & Active Count */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-xl text-xs font-semibold shrink-0">
                <Filter className="h-3.5 w-3.5 text-primary" />
                <span>Filters</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {activeFilterCount > 0 ? `${activeFilterCount} active filter${activeFilterCount > 1 ? "s" : ""}` : "All analytics data"}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {activeFilterCount > 0 && (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs rounded-xl font-medium gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted border-border"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              )}

              <Button
                onClick={() => fetchAnalytics(true)}
                disabled={refreshing}
                variant="outline"
                size="sm"
                className="h-9 px-3.5 text-xs rounded-xl font-bold gap-2 bg-card hover:bg-muted border-border text-foreground transition-all active:scale-98"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>

          {/* Bottom Row: Filter Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/50">
            {/* Provider Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Cpu className="h-3 w-3 text-primary" />
                <span>AI Engine</span>
              </label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-border bg-background font-medium w-full">
                  <SelectValue placeholder="All AI Engines" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {PROVIDER_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time Range Preset Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3 text-primary" />
                <span>Time Period</span>
              </label>
              <Select value={timeRange} onValueChange={handleTimeRangeChange}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-border bg-background font-medium w-full">
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {TIME_RANGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Date Pickers Animated Slide-in (when Custom Range is active) */}
          <AnimatePresence>
            {timeRange === "CUSTOM" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pt-1"
              >
                <div className="p-3 bg-muted/30 rounded-xl border border-border/60 flex flex-wrap items-center gap-3">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    Custom Range (PH Time UTC+8):
                  </span>
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 h-9">
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">From:</span>
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="h-7 text-xs border-0 p-0 shadow-none focus-visible:ring-0 w-28 bg-transparent"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 h-9">
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">To:</span>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="h-7 text-xs border-0 p-0 shadow-none focus-visible:ring-0 w-28 bg-transparent"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Filter Chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground font-medium mr-1">Active:</span>

              {selectedProvider !== "ALL" && (
                <Badge
                  variant="secondary"
                  className="text-[11px] gap-1 px-2.5 py-0.5 rounded-lg bg-secondary text-secondary-foreground border border-border font-medium"
                >
                  <span>Engine: {PROVIDER_FILTER_OPTIONS.find((o) => o.value === selectedProvider)?.label}</span>
                  <button
                    onClick={() => setSelectedProvider("ALL")}
                    className="hover:text-foreground ml-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}

              {timeRange !== "1_DAY" && (
                <Badge
                  variant="secondary"
                  className="text-[11px] gap-1 px-2.5 py-0.5 rounded-lg bg-secondary text-secondary-foreground border border-border font-medium"
                >
                  <span>Period: {TIME_RANGE_OPTIONS.find((o) => o.value === timeRange)?.label}</span>
                  <button
                    onClick={() => handleTimeRangeChange("1_DAY")}
                    className="hover:text-foreground ml-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}

              <button
                onClick={handleReset}
                className="text-[11px] text-primary hover:underline font-medium ml-1.5"
              >
                Clear all
              </button>
            </div>
          )}
        </Card>
      </motion.div>

      {error && (
        <motion.div
          variants={itemVariants}
          className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-center gap-3"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* ── Metric Cards ─────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Peak RPM */}
        <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
          <Card className="p-5 border border-border bg-card rounded-2xl shadow-xs space-y-2 h-full hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="uppercase tracking-wider">Peak Surge RPM</span>
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-3xl font-bold tracking-tight text-foreground font-mono">
              {data?.peakUsageTrends?.peakRpm ?? 0}{" "}
              <span className="text-sm font-normal text-muted-foreground font-sans">req/min</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Maximum single-minute request surge detected within {timeRangeLabel}
            </p>
          </Card>
        </motion.div>

        {/* Peak TPM */}
        <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
          <Card className="p-5 border border-border bg-card rounded-2xl shadow-xs space-y-2 h-full hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="uppercase tracking-wider">Peak Surge TPM</span>
              <Blocks className="h-4 w-4 text-violet-500" />
            </div>
            <div className="text-3xl font-bold tracking-tight text-foreground font-mono">
              {formatTokens(data?.peakUsageTrends?.peakTpm ?? 0)}{" "}
              <span className="text-sm font-normal text-muted-foreground font-sans">tokens/min</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Maximum single-minute token volume processed within {timeRangeLabel}
            </p>
          </Card>
        </motion.div>

        {/* Peak Traffic Window */}
        <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
          <Card className="p-5 border border-border bg-card rounded-2xl shadow-xs space-y-2 h-full hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="uppercase tracking-wider">Peak Traffic Window</span>
              <Clock className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-lg font-bold tracking-tight text-foreground truncate">
              {data?.peakUsageTrends?.peakHourLabel ? (
                <>
                  {data.peakUsageTrends.peakHourLabel}{" "}
                  <span className="text-sm font-normal text-indigo-600 dark:text-indigo-400 font-mono">
                    ({data.peakUsageTrends.peakHourRequests} requests)
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground font-normal text-base">No peak detected yet</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Highest concentration hour across Philippine local time (+08:00)
            </p>
          </Card>
        </motion.div>
      </motion.div>

      {/* ── 24-Hour Traffic Load & Surge Profile Chart ────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="p-6 border border-border bg-card rounded-2xl shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              <span className="font-bold text-base">Hourly Traffic Load &amp; Surge Timeline</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Timestamps rendered in Asia/Manila (UTC+8)
            </span>
          </div>

          <div className="h-64 flex items-end gap-1.5 sm:gap-2 pt-20 pb-3 px-3 bg-muted/20 rounded-xl border border-border/40 overflow-x-auto relative">
            {hourlyBuckets.map((b, index) => {
              const maxReq = Math.max(...hourlyBuckets.map((x) => x.requests), 1);
              const heightPercent = b.requests > 0 ? Math.max(10, Math.round((b.requests / maxReq) * 58)) : 4;
              const isPeak = b.requests > 0 && b.requests === maxReq;
              const tooltipAlignClass =
                index < 3
                  ? "left-0 translate-x-0"
                  : index > 20
                  ? "right-0 left-auto translate-x-0"
                  : "left-1/2 -translate-x-1/2";

              return (
                <div
                  key={b.hourLabel}
                  className="flex-1 min-w-[28px] sm:min-w-0 flex flex-col items-center gap-1.5 group relative h-full justify-end cursor-default"
                >
                  {/* Tooltip on hover — anchored inside top headroom so it is 100% visible and never clipped */}
                  <div
                    className={`absolute top-2.5 ${tooltipAlignClass} opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150 pointer-events-none z-30 bg-popover text-popover-foreground border border-border shadow-xl text-[11px] px-3 py-2 rounded-xl whitespace-nowrap`}
                  >
                    <div className="font-bold text-foreground flex items-center gap-1.5">
                      <span>{b.hourLabel}</span>
                      {isPeak && (
                        <span className="text-[9px] bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-semibold uppercase">
                          Peak Hour
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {b.requests} requests ({formatTokens(b.tokens)} tokens)
                    </div>
                    {b.avgLatencyMs > 0 && (
                      <div className="text-indigo-600 dark:text-indigo-400 font-mono font-semibold mt-0.5">
                        {b.avgLatencyMs} ms avg latency
                      </div>
                    )}
                  </div>

                  {/* Bar */}
                  <motion.div
                    key={`${b.hourLabel}-${timeRange}-${selectedProvider}`}
                    initial={{ height: "0%" }}
                    animate={{ height: `${heightPercent}%` }}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 24,
                      delay: index * 0.015,
                    }}
                    whileHover={{ scaleY: 1.05 }}
                    className={`w-full rounded-t-sm origin-bottom transition-colors duration-200 ${
                      isPeak
                        ? "bg-indigo-600 dark:bg-indigo-400 shadow-sm"
                        : b.requests > 0
                        ? "bg-indigo-500/70 dark:bg-indigo-500/50 group-hover:bg-indigo-500"
                        : "bg-muted-foreground/15"
                    }`}
                  />
                  {/* Label */}
                  <span className="text-[10px] text-muted-foreground font-mono truncate w-full text-center">
                    {b.hourLabel.slice(0, 2)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>

      {/* ── Detailed Hourly Breakdown Table ──────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="shadow-xs border border-border bg-card rounded-2xl py-0 gap-0 overflow-hidden">
          <CardHeader className="border-b border-border p-4 bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-500" />
              Hourly Invocations &amp; Latency Matrix
            </CardTitle>
            <CardDescription className="text-xs">
              Complete hourly breakdown of request volume, token usage, and response performance
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                    <th className="p-3 pl-4">Hour Window</th>
                    <th className="p-3 text-right">Requests</th>
                    <th className="p-3 text-right">Token Volume</th>
                    <th className="p-3 text-right">Avg Latency</th>
                    <th className="p-3 text-center">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <AnimatePresence mode="popLayout">
                    {hourlyBuckets.map((b, idx) => (
                      <motion.tr
                        key={`${b.hourLabel}-${timeRange}-${selectedProvider}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.01 }}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-3 pl-4 font-mono font-bold text-foreground">
                          {b.hourLabel} - {parseInt(b.hourLabel.slice(0, 2), 10) + 1}:00
                        </td>
                        <td className="p-3 text-right font-semibold text-foreground">{b.requests}</td>
                        <td className="p-3 text-right font-mono text-muted-foreground">{formatTokens(b.tokens)}</td>
                        <td className="p-3 text-right font-mono text-foreground">
                          {b.avgLatencyMs > 0 ? `${b.avgLatencyMs} ms` : "—"}
                        </td>
                        <td className="p-3 text-center">
                          {b.errors > 0 ? (
                            <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-0 text-[10px] font-bold">
                              {b.errors}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

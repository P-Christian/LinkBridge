"use client";

import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity,
  Cpu,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  Radio,
  Layers,
  TrendingDown,
  Blocks,
  Filter,
  RotateCcw,
  Calendar,
  ArrowRight,
  Flame,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Sliders,
} from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";

// ── Motion Variants ────────────────────────────────────────────────────────────

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

// ── Types ──────────────────────────────────────────────────────────────────────

interface GeminiKPIs {
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  successCount: number;
  failedCount: number;
  timeoutCount: number;
  rateLimitCount: number;
  successRate: number;
  lastSuccessAt: string | null;
  recentSuccessRate: number;
  recentAvgLatencyMs: number;
}

interface GeminiFeatureStat {
  feature: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  successCount: number;
  failedCount: number;
}

interface GeminiErrorStat {
  status400: number;
  status403: number;
  status429: number;
  status500: number;
  status503: number;
  timeouts: number;
}

interface GeminiFreeTierStatus {
  model: string;
  dailyFreeInputTokens: number;
  dailyFreeOutputTokens: number;
  todayPromptTokens: number;
  todayCompletionTokens: number;
  billableInputTokens: number;
  billableOutputTokens: number;
  estimatedCostUsd: number;
  freeTierActive: boolean;
}

interface AuditLogEntry {
  id: string;
  requestId: string;
  feature: string;
  provider: string;
  model: string;
  endpoint: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  finishReason: string | null;
  responseStatus: string;
  latencyMs: number;
  httpStatus: number;
  errorMessage: string | null;
  userId: number | null;
  companyId: number | null;
  userName: string | null;
  companyName: string | null;
  createdAt: string;
}

interface GeminiRateLimitStatus {
  model: string;
  rpmCurrent: number;
  rpmLimit: number;
  rpmPercent: number;
  tpmCurrent: number;
  tpmLimit: number;
  tpmPercent: number;
  rpdCurrent: number;
  rpdLimit: number;
  rpdPercent: number;
}

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

interface TelemetryData {
  success: boolean;
  configuredModel: string;
  apiKeyConfigured: boolean;
  serviceHealth: "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "NO_DATA";
  lastSuccessAt: string | null;
  recentSuccessRate: number;
  recentAvgLatencyMs: number;
  kpis: GeminiKPIs;
  peakUsageTrends?: PeakUsageTrends;
  freeTierStatus: GeminiFreeTierStatus;
  rateLimitStatus?: GeminiRateLimitStatus;
  featureBreakdown: GeminiFeatureStat[];
  errorBreakdown: GeminiErrorStat;
  auditLog: AuditLogEntry[];
  lastCheckedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

const FEATURE_LABEL_MAP: Record<string, string> = {
  AI_RERANKER: "AI Reranker",
  MATCH_EXPLAINER: "Match Explainer",
  QUERY_UNDERSTANDING: "Query Understanding",
  BEST_MATCH: "Best Match AI",
  ROLE_INTELLIGENCE: "Role Intelligence",
  REFINE_COMPANY_TEXT: "Refine Company Text",
  GENERATE_COMPANY_PROFILE: "Generate Company Profile",
  AUTO_CREATE_JOB: "Auto Create Job",
  JOB_REFINE_TEXT: "Refine Job Text",
  APPLICATION_AI_ANALYSIS: "Applicant AI Analysis",
  RESUME_ANALYSIS: "Resume Analysis",
  SKILL_SUGGESTION: "Skill Suggestion",
  KEYWORD_SUGGESTION: "Keyword Suggestion",
  TAXONOMY_CLASSIFICATION: "Taxonomy Classification",
};

const FEATURE_FILTER_OPTIONS = [
  { value: "ALL", label: "All AI Features" },
  { value: "AI_RERANKER", label: "AI Reranker" },
  { value: "MATCH_EXPLAINER", label: "Match Explainer" },
  { value: "QUERY_UNDERSTANDING", label: "Query Understanding" },
  { value: "BEST_MATCH", label: "Best Match AI" },
  { value: "ROLE_INTELLIGENCE", label: "Role Intelligence" },
  { value: "REFINE_COMPANY_TEXT", label: "Refine Company Text" },
  { value: "GENERATE_COMPANY_PROFILE", label: "Generate Company Profile" },
  { value: "AUTO_CREATE_JOB", label: "Auto Create Job" },
  { value: "JOB_REFINE_TEXT", label: "Refine Job Text" },
  { value: "APPLICATION_AI_ANALYSIS", label: "Applicant AI Analysis" },
  { value: "RESUME_ANALYSIS", label: "Resume Analysis" },
  { value: "SKILL_SUGGESTION", label: "Skill Suggestion" },
  { value: "KEYWORD_SUGGESTION", label: "Keyword Suggestion" },
  { value: "TAXONOMY_CLASSIFICATION", label: "Taxonomy Classification" },
];

function featureLabel(feature: string): string {
  if (!feature) return "General AI";
  if (FEATURE_LABEL_MAP[feature]) return FEATURE_LABEL_MAP[feature];

  // Graceful fallback for any snake_case / kebab-case / camelCase identifier
  return feature
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function timeSince(isoString: string | null): string {
  if (!isoString) return "No recent requests";
  const ms = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const HealthBadge = memo(({ health }: { health: "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "NO_DATA" }) => {
  return (
    <motion.div
      key={health}
      initial={{ scale: 0.9, opacity: 0.8 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 450, damping: 26 }}
      className="inline-flex"
    >
      {health === "HEALTHY" && (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 gap-1.5 px-3 py-1 font-bold">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Healthy
        </Badge>
      )}
      {health === "DEGRADED" && (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800 gap-1.5 px-3 py-1 font-bold">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Degraded
        </Badge>
      )}
      {health === "NO_DATA" && (
        <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1.5 px-3 py-1 font-bold">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" /> No Data Yet
        </Badge>
      )}
      {health === "UNAVAILABLE" && (
        <Badge variant="outline" className="bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300 dark:border-rose-800 gap-1.5 px-3 py-1 font-bold">
          <XCircle className="h-3.5 w-3.5 text-rose-500" /> Unavailable
        </Badge>
      )}
    </motion.div>
  );
});
HealthBadge.displayName = "HealthBadge";

const ResponseStatusBadge = memo(({ status }: { status: string }) => {
  return (
    <motion.div
      key={status}
      initial={{ scale: 0.9, opacity: 0.8 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 450, damping: 26 }}
      className="inline-flex"
    >
      {status === "SUCCESS" ? (
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-0 text-[10px] font-bold">
          SUCCESS
        </Badge>
      ) : status === "TIMEOUT" ? (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-0 text-[10px] font-bold">
          TIMEOUT
        </Badge>
      ) : (
        <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-0 text-[10px] font-bold">
          ERROR
        </Badge>
      )}
    </motion.div>
  );
});
ResponseStatusBadge.displayName = "ResponseStatusBadge";

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function GeminiMonitoringDashboard() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const abortTelemetry = useRequestAbort();

  // Filters State — defaults to 1_DAY (Today) and ALL providers
  const [selectedProvider, setSelectedProvider] = useState<string>("ALL");
  const [timeRange, setTimeRange] = useState<string>("1_DAY");
  const [dateFrom, setDateFrom] = useState<string>(() => getTodayPhDate());
  const [dateTo, setDateTo] = useState<string>(() => getTodayPhDate());
  const [selectedFeature, setSelectedFeature] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Audit Log Pagination State
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditPageSize, setAuditPageSize] = useState<number>(10);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedProvider !== "ALL") count++;
    if (timeRange !== "1_DAY") count++;
    if (selectedFeature !== "ALL") count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [selectedProvider, timeRange, selectedFeature, searchQuery]);

  const filteredAuditLogs: AuditLogEntry[] = useMemo(() => {
    const logs = data?.auditLog ?? [];
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase().trim();
    return logs.filter((log: AuditLogEntry) => {
      return (
        log.requestId?.toLowerCase().includes(q) ||
        log.feature?.toLowerCase().includes(q) ||
        featureLabel(log.feature).toLowerCase().includes(q) ||
        log.model?.toLowerCase().includes(q) ||
        log.endpoint?.toLowerCase().includes(q) ||
        log.responseStatus?.toLowerCase().includes(q) ||
        (log.userName && log.userName.toLowerCase().includes(q)) ||
        (log.companyName && log.companyName.toLowerCase().includes(q)) ||
        (log.errorMessage && log.errorMessage.toLowerCase().includes(q))
      );
    });
  }, [data?.auditLog, searchQuery]);

  const fetchTelemetry = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setFetchError(null);

    // Filters and the 30s poll share one payload: only the newest read may write
    // it, or a 28-day response lands on top of the range just selected.
    const signal = abortTelemetry();
    try {
      const params = new URLSearchParams();
      if (selectedProvider && selectedProvider !== "ALL") params.set("provider", selectedProvider);
      if (timeRange) params.set("time_range", timeRange);
      if (timeRange === "CUSTOM") {
        if (dateFrom) params.set("date_from", dateFrom);
        if (dateTo) params.set("date_to", dateTo);
      }
      if (selectedFeature && selectedFeature !== "ALL") params.set("feature", selectedFeature);

      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/vos-admin/gemini-monitoring${qs}`, { cache: "no-store", signal });
      if (signal.aborted) return;
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Telemetry read failed (${res.status}).`);
      }
      const json: TelemetryData = await res.json();
      if (signal.aborted) return;
      setData(json);
    } catch (err) {
      if (signal.aborted) return;
      setFetchError((err as Error)?.message || "Failed to load telemetry.");
    } finally {
      // The newest read clears both flags even if it only set one: the read it
      // replaced may have raised the other one.
      if (!signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [selectedProvider, timeRange, dateFrom, dateTo, selectedFeature, abortTelemetry]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchTelemetry();
    });
    const interval = setInterval(() => {
      // The telemetry read aggregates the whole call log; a dashboard left open
      // in a background tab should not keep paying for it twice a minute.
      if (document.hidden) return;
      void fetchTelemetry(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  const handleTimeRangeChange = (val: string) => {
    setTimeRange(val);
    setAuditPage(1);
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

  const handleResetFilters = () => {
    setSelectedProvider("ALL");
    handleTimeRangeChange("1_DAY");
    setSelectedFeature("ALL");
    setSearchQuery("");
    setAuditPage(1);
  };

  const configuredModel = data?.configuredModel || "gemini-2.0-flash";
  const serviceHealth = data?.serviceHealth || "NO_DATA";

  const rateLimitInfo = data?.rateLimitStatus || {
    model: configuredModel,
    rpmCurrent: 0,
    rpmLimit: 15,
    rpmPercent: 0,
    tpmCurrent: 0,
    tpmLimit: 1_000_000,
    tpmPercent: 0,
    rpdCurrent: 0,
    rpdLimit: 1500,
    rpdPercent: 0,
  };

  const errorStats = data?.errorBreakdown || {
    status400: 0,
    status403: 0,
    status429: 0,
    status500: 0,
    status503: 0,
    timeouts: 0,
  };

  const timeRangeLabel = TIME_RANGE_OPTIONS.find((o) => o.value === timeRange)?.label || "Selected Period";

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Banner Skeleton */}
        <div className="h-36 rounded-3xl bg-muted/60 border border-border" />

        {/* Filter Bar Skeleton */}
        <div className="h-16 rounded-2xl bg-muted/40 border border-border" />

        {/* Health Bar Skeleton */}
        <div className="h-16 rounded-2xl bg-muted/40 border border-border" />

        {/* KPI Grid Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-muted/40 border border-border" />
          ))}
        </div>

        {/* Quotas Skeleton */}
        <div className="h-44 rounded-2xl bg-muted/40 border border-border" />

        {/* Peak Usage Trends Skeleton */}
        <div className="h-52 rounded-2xl bg-muted/40 border border-border" />

        {/* Tables Skeleton */}
        <div className="h-64 rounded-2xl bg-muted/40 border border-border" />
        <div className="h-64 rounded-2xl bg-muted/40 border border-border" />
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Filter Toolbar ────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border border-border bg-card rounded-2xl shadow-xs p-4 sm:p-5 gap-4">
          {/* Top Row: Search & Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input + Active Counter */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs by request ID, user, company, endpoint..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setAuditPage(1);
                  }}
                  className="pl-9 pr-8 h-9 text-xs rounded-xl border-border bg-background"
                />
                {searchQuery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setAuditPage(1);
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Active Filter Count Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-secondary text-secondary-foreground rounded-lg text-xs font-semibold shrink-0">
                <Filter className="h-3.5 w-3.5 text-primary" />
                <span>
                  {activeFilterCount > 0 ? `${activeFilterCount} active` : "All traffic"}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
              {activeFilterCount > 0 && (
                <Button
                  onClick={handleResetFilters}
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs rounded-xl font-medium gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted border-border"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              )}

              <Button
                onClick={() => fetchTelemetry(true)}
                disabled={refreshing}
                variant="outline"
                size="sm"
                className="h-9 px-3.5 text-xs rounded-xl font-bold gap-2 bg-card hover:bg-muted border-border text-foreground transition-all active:scale-98"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
                <span>Refresh</span>
              </Button>

              <Link href="/vos-sync/vos-admin/ai-config">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs rounded-xl font-semibold gap-1.5 border-border bg-card hover:bg-muted text-foreground transition-all"
                >
                  <Sliders className="h-3.5 w-3.5 text-primary" />
                  <span>Configure Models</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Bottom Row: Filter Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-3 border-t border-border/50">
            {/* Provider Filter (Cloud Gemini vs Local AI) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Cpu className="h-3 w-3 text-primary" />
                <span>AI Engine</span>
              </label>
              <Select
                value={selectedProvider}
                onValueChange={(val) => {
                  setSelectedProvider(val);
                  setAuditPage(1);
                }}
              >
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

            {/* Feature Dropdown */}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3 text-primary" />
                <span>AI Feature</span>
              </label>
              <Select
                value={selectedFeature}
                onValueChange={(val) => {
                  setSelectedFeature(val);
                  setAuditPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl border-border bg-background font-medium w-full">
                  <SelectValue placeholder="All AI Features" />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-xl">
                  {FEATURE_FILTER_OPTIONS.map((opt) => (
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
                        onChange={(e) => {
                          setDateFrom(e.target.value);
                          setAuditPage(1);
                        }}
                        className="h-7 text-xs border-0 p-0 shadow-none focus-visible:ring-0 w-28 bg-transparent"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 h-9">
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">To:</span>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => {
                          setDateTo(e.target.value);
                          setAuditPage(1);
                        }}
                        className="h-7 text-xs border-0 p-0 shadow-none focus-visible:ring-0 w-28 bg-transparent"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {fetchError && (
        <motion.div
          variants={itemVariants}
          className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-center gap-3"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <span>{fetchError}</span>
        </motion.div>
      )}

      {/* ── Setup Notice for No Data ─────── */}
      {serviceHealth === "NO_DATA" && !fetchError && (
        <motion.div
          variants={itemVariants}
          className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-foreground text-sm space-y-1"
        >
          <div className="flex items-center gap-2 font-bold text-blue-600 dark:text-blue-400">
            <Cpu className="h-4 w-4 text-blue-500" />
            Waiting for Telemetry Data
          </div>
          <p className="text-xs text-muted-foreground">
            Live telemetry will appear here automatically when AI requests are made (e.g. Talent Search, AI Profile Generation, Job Auto-Creation).
          </p>
        </motion.div>
      )}

      {/* ── Service Health ────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="shadow-xs border border-border bg-card rounded-2xl p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <Radio className={`h-4 w-4 ${serviceHealth === "HEALTHY" ? "text-emerald-500 animate-pulse" : "text-amber-500"}`} />
            <span className="text-sm font-bold">Service Health</span>
            <HealthBadge health={serviceHealth} />
            <code className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded-md text-foreground border border-border/60">
              {configuredModel}
            </code>
            <span className="text-xs text-muted-foreground ml-2">
              Last successful request: <strong>{timeSince(data?.lastSuccessAt ?? null)}</strong>
            </span>
            <span className="text-xs text-muted-foreground">
              · Success rate (last 5 min): <strong className="text-foreground">{data?.recentSuccessRate ?? 100}%</strong>
            </span>
            <span className="text-xs text-muted-foreground">
              · Avg latency (last 5 min): <strong className="text-foreground">{data?.recentAvgLatencyMs ?? 0} ms</strong>
            </span>
          </div>
        </Card>
      </motion.div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        {[
          {
            label:
              timeRange === "1_DAY" || timeRange === "TODAY"
                ? "Requests (Today)"
                : timeRange === "LAST_HOUR"
                ? "Requests (Last Hour)"
                : timeRange === "7_DAYS"
                ? "Requests (7 Days)"
                : timeRange === "28_DAYS"
                ? "Requests (28 Days)"
                : timeRange === "THIS_MONTH"
                ? "Requests (This Month)"
                : timeRange === "90_DAYS"
                ? "Requests (90 Days)"
                : timeRange === "ALL_TIME"
                ? "Requests (All Time)"
                : "Requests (Filtered)",
            value: data?.kpis.totalRequests ?? 0,
            icon: <Activity className="h-4 w-4 text-indigo-500" />,
            unit: "",
          },
          { label: "Input Tokens", value: formatTokens(data?.kpis.totalPromptTokens ?? 0), icon: <Zap className="h-4 w-4 text-amber-500" />, unit: "" },
          { label: "Output Tokens", value: formatTokens(data?.kpis.totalCompletionTokens ?? 0), icon: <Blocks className="h-4 w-4 text-violet-500" />, unit: "" },
          { label: "Avg Latency", value: `${data?.kpis.avgLatencyMs ?? 0}`, icon: <Clock className="h-4 w-4 text-blue-500" />, unit: "ms" },
          { label: "Success Rate", value: `${data?.kpis.successRate ?? 100}`, icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, unit: "%" },
          { label: "Failed", value: (data?.kpis.failedCount ?? 0) + (data?.kpis.timeoutCount ?? 0), icon: <TrendingDown className="h-4 w-4 text-rose-500" />, unit: "" },
        ].map((kpi) => (
          <motion.div
            key={kpi.label}
            whileHover={{ y: -2, transition: { duration: 0.16, ease: "easeOut" } }}
            whileTap={{ scale: 0.99 }}
          >
            <Card className="shadow-xs border border-border bg-card rounded-2xl p-4 space-y-2 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                {kpi.icon}
              </div>
              <div className="text-xl font-bold tracking-tight text-foreground">
                {kpi.value}<span className="text-sm font-normal text-muted-foreground ml-0.5">{kpi.unit}</span>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Rate Limit Quotas (RPM / TPM / RPD) ────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="shadow-xs border border-border bg-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-indigo-500" />
              <span className="font-bold text-sm">Model Rate Limits &amp; Quotas</span>
              <code className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                {rateLimitInfo.model}
              </code>
            </div>
            <span className="text-xs text-muted-foreground font-medium">Text-out model limits</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* RPM */}
            <div className="space-y-1.5 p-3.5 bg-muted/30 rounded-xl border border-border/50">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-muted-foreground">Requests Per Min (RPM)</span>
                <span className="font-mono font-bold text-foreground">
                  {rateLimitInfo.rpmCurrent} / {rateLimitInfo.rpmLimit}
                </span>
              </div>
              <Progress value={rateLimitInfo.rpmPercent} className="h-2" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Current utilization</span>
                <span className="font-semibold">{rateLimitInfo.rpmPercent}%</span>
              </div>
            </div>

            {/* TPM */}
            <div className="space-y-1.5 p-3.5 bg-muted/30 rounded-xl border border-border/50">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-muted-foreground">Tokens Per Min (TPM)</span>
                <span className="font-mono font-bold text-foreground">
                  {formatTokens(rateLimitInfo.tpmCurrent)} / {formatTokens(rateLimitInfo.tpmLimit)}
                </span>
              </div>
              <Progress value={rateLimitInfo.tpmPercent} className="h-2" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Current utilization</span>
                <span className="font-semibold">{rateLimitInfo.tpmPercent}%</span>
              </div>
            </div>

            {/* RPD */}
            <div className="space-y-1.5 p-3.5 bg-muted/30 rounded-xl border border-border/50">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-muted-foreground">Requests Per Day (RPD)</span>
                <span className="font-mono font-bold text-foreground">
                  {rateLimitInfo.rpdCurrent} / {rateLimitInfo.rpdLimit}
                </span>
              </div>
              <Progress value={rateLimitInfo.rpdPercent} className="h-2" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Daily utilization</span>
                <span className="font-semibold">{rateLimitInfo.rpdPercent}%</span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ── Peak Usage & Traffic Trends Action Card ───────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="shadow-xs border border-border bg-gradient-to-br from-card via-card to-indigo-950/10 dark:to-indigo-950/20 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">Peak Usage &amp; Surge Trends</span>
                  <Badge variant="outline" className="text-[10px] font-mono border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300">
                    Deep Analytics
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Hourly traffic density, single-minute surge rates, and latency timelines
                </p>
              </div>
            </div>

            <Button
              asChild
              variant="default"
              size="sm"
              className="h-9 px-4 text-xs rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-xs shrink-0 self-start sm:self-auto"
            >
              <Link href="/vos-sync/vos-admin/gemini-monitoring/analytics">
                <span>View Full Surge Analytics</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Peak RPM */}
            <div className="p-3 bg-muted/30 rounded-xl border border-border/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Peak Surge RPM</span>
                <span className="text-base font-bold font-mono text-foreground">
                  {data?.peakUsageTrends?.peakRpm ?? 0} <span className="text-xs font-normal text-muted-foreground">req/min</span>
                </span>
              </div>
              <Zap className="h-4 w-4 text-amber-500 shrink-0" />
            </div>

            {/* Peak TPM */}
            <div className="p-3 bg-muted/30 rounded-xl border border-border/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Peak Surge TPM</span>
                <span className="text-base font-bold font-mono text-foreground">
                  {formatTokens(data?.peakUsageTrends?.peakTpm ?? 0)} <span className="text-xs font-normal text-muted-foreground">tokens/min</span>
                </span>
              </div>
              <Blocks className="h-4 w-4 text-violet-500 shrink-0" />
            </div>

            {/* Peak Busy Window */}
            <div className="p-3 bg-muted/30 rounded-xl border border-border/50 flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Peak Traffic Window</span>
                <span className="text-xs font-bold text-foreground truncate block">
                  {data?.peakUsageTrends?.peakHourLabel ? (
                    <>
                      {data.peakUsageTrends.peakHourLabel}{" "}
                      <span className="font-normal text-indigo-600 dark:text-indigo-400 font-mono">
                        ({data.peakUsageTrends.peakHourRequests} reqs)
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground font-normal">No peak detected yet</span>
                  )}
                </span>
              </div>
              <Clock className="h-4 w-4 text-indigo-500 shrink-0 ml-2" />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ── Feature Breakdown Table ───────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="shadow-xs border border-border bg-card rounded-2xl py-0 gap-0 overflow-hidden">
          <CardHeader className="border-b border-border p-4 bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" />
              Feature Telemetry Breakdown
            </CardTitle>
            <CardDescription className="text-xs">
              Request distribution across AI features for {timeRangeLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                    <th className="p-3 pl-4">Feature</th>
                    <th className="p-3 text-right">Requests</th>
                    <th className="p-3 text-right">Input Tokens</th>
                    <th className="p-3 text-right">Output Tokens</th>
                    <th className="p-3 text-right">Avg Latency</th>
                    <th className="p-3 text-center">Success</th>
                    <th className="p-3 text-center">Failed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data?.featureBreakdown ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs">
                        No AI requests recorded today. Invoking an AI feature will populate this table live.
                      </td>
                    </tr>
                  ) : (
                    (data?.featureBreakdown ?? []).map((fb) => (
                      <tr key={fb.feature} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 pl-4 font-bold text-foreground flex items-center gap-2">
                          {featureLabel(fb.feature)}
                        </td>
                        <td className="p-3 text-right font-semibold text-foreground">{fb.requests}</td>
                        <td className="p-3 text-right font-mono text-muted-foreground">{formatTokens(fb.promptTokens)}</td>
                        <td className="p-3 text-right font-mono text-muted-foreground">{formatTokens(fb.completionTokens)}</td>
                        <td className="p-3 text-right font-mono text-foreground">{fb.avgLatencyMs} ms</td>
                        <td className="p-3 text-center text-emerald-600 dark:text-emerald-400 font-semibold">{fb.successCount}</td>
                        <td className="p-3 text-center text-rose-600 dark:text-rose-400 font-semibold">{fb.failedCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Error Breakdown ───────────────────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        {[
          { label: "400 Invalid", value: errorStats.status400, color: "text-orange-600 dark:text-orange-400" },
          { label: "403 Auth", value: errorStats.status403, color: "text-rose-600 dark:text-rose-400" },
          { label: "429 Rate Limit", value: errorStats.status429, color: "text-amber-600 dark:text-amber-400" },
          { label: "500 Internal", value: errorStats.status500, color: "text-rose-600 dark:text-rose-400" },
          { label: "503 Unavailable", value: errorStats.status503, color: "text-violet-600 dark:text-violet-400" },
          { label: "Timeouts", value: errorStats.timeouts, color: "text-zinc-600 dark:text-zinc-400" },
        ].map((e) => (
          <motion.div
            key={e.label}
            whileHover={{ y: -2, transition: { duration: 0.16, ease: "easeOut" } }}
            whileTap={{ scale: 0.99 }}
          >
            <Card className="shadow-xs border border-border bg-card rounded-2xl p-4 space-y-1 hover:shadow-md transition-shadow">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{e.label}</p>
              <p className={`text-2xl font-bold ${e.value > 0 ? e.color : "text-muted-foreground"}`}>{e.value}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Audit Log ─────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="shadow-xs border border-border bg-card rounded-2xl py-0 gap-0 overflow-hidden">
          <CardHeader className="border-b border-border p-4 bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-500" />
              Request Audit Log
            </CardTitle>
            <CardDescription className="text-xs">
              Live invocations — timestamps in PH Local Time (+08:00)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                    <th className="p-3 pl-4">Timestamp</th>
                    <th className="p-3">Feature</th>
                    <th className="p-3">Model</th>
                    <th className="p-3 text-right">In / Out Tokens</th>
                    <th className="p-3 text-right">Latency</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Requested By</th>
                  </tr>
                </thead>
                {filteredAuditLogs.length === 0 ? (
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs">
                        {searchQuery ? `No requests matching "${searchQuery}".` : "No requests recorded yet."}
                      </td>
                    </tr>
                  </tbody>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.tbody
                      key={`${auditPage}-${searchQuery}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="divide-y divide-border"
                    >
                      {filteredAuditLogs
                        .slice((auditPage - 1) * auditPageSize, auditPage * auditPageSize)
                        .map((log) => (
                          <tr
                            key={log.id}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="p-3 pl-4 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                              {log.createdAt}
                            </td>
                            <td className="p-3 font-semibold text-foreground whitespace-nowrap">{featureLabel(log.feature)}</td>
                            <td className="p-3 font-mono text-[10px] text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{log.model}</td>
                            <td className="p-3 text-right font-mono text-muted-foreground whitespace-nowrap">
                              {formatTokens(log.promptTokens)} / {formatTokens(log.completionTokens)}
                            </td>
                            <td className="p-3 text-right font-mono text-foreground whitespace-nowrap">{log.latencyMs} ms</td>
                            <td className="p-3 text-center">
                              <ResponseStatusBadge status={log.responseStatus} />
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              <div className="flex flex-col items-end">
                                <span className="font-semibold text-foreground text-[11px]">
                                  {log.userName || (log.userId ? `User #${log.userId}` : "System / Guest")}
                                </span>
                                {log.companyName && (
                                  <span className="text-[10px] text-muted-foreground font-normal">
                                    {log.companyName}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </motion.tbody>
                  </AnimatePresence>
                )}
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredAuditLogs.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 border-t border-border bg-muted/20 text-xs">
                <div className="text-muted-foreground">
                  Showing{" "}
                  <strong className="text-foreground">
                    {(auditPage - 1) * auditPageSize + 1}
                  </strong>{" "}
                  to{" "}
                  <strong className="text-foreground">
                    {Math.min(auditPage * auditPageSize, filteredAuditLogs.length)}
                  </strong>{" "}
                  of <strong className="text-foreground">{filteredAuditLogs.length}</strong>{" "}
                  entries
                  {searchQuery && (
                    <span className="ml-1 text-[11px] text-muted-foreground">
                      (filtered from {(data?.auditLog ?? []).length} total)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <span>Rows:</span>
                    <Select
                      value={String(auditPageSize)}
                      onValueChange={(val) => {
                        setAuditPageSize(Number(val));
                        setAuditPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 w-16 text-xs rounded-lg border-border bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="10" className="text-xs">
                          10
                        </SelectItem>
                        <SelectItem value="25" className="text-xs">
                          25
                        </SelectItem>
                        <SelectItem value="50" className="text-xs">
                          50
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      disabled={auditPage <= 1}
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-2 text-xs font-semibold text-foreground">
                      {auditPage} /{" "}
                      {Math.max(
                        1,
                        Math.ceil(filteredAuditLogs.length / auditPageSize)
                      )}
                    </span>
                    <Button
                      onClick={() =>
                        setAuditPage((p) =>
                          Math.min(
                            Math.ceil(
                              filteredAuditLogs.length / auditPageSize
                            ),
                            p + 1
                          )
                        )
                      }
                      disabled={
                        auditPage >=
                        Math.ceil(
                          filteredAuditLogs.length / auditPageSize
                        )
                      }
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

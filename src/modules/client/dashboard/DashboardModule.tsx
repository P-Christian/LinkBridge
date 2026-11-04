// src/modules/client/dashboard/DashboardModule.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import DashboardHeader from "./components/DashboardHeader";
import KpiSummaryGrid from "./components/KpiSummaryGrid";
import HiringOverviewChart from "./components/HiringOverviewChart";
import JobPerformanceTable from "./components/JobPerformanceTable";
import RecentApplicantsCard from "./components/RecentApplicantsCard";
import UpcomingInterviewsCard from "./components/UpcomingInterviewsCard";
import ActionRequiredCard from "./components/ActionRequiredCard";
import DashboardSkeleton from "./components/DashboardSkeleton";
import { useClientKeyboardShortcuts } from "./hooks/useClientKeyboardShortcuts";
import { DashboardData, CompanyInfo, TimeRangeKey } from "./types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw, RefreshCw, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface DashboardModuleProps {
  userName?: string;
  initialData?: DashboardData | null;
}

const TIMERANGE_STORAGE_KEY = "vos_client_hiring_timerange";

export default function DashboardModule({ userName, initialData = null }: DashboardModuleProps) {
  const router = useRouter();

  // Register client portal keyboard shortcuts (G+D, G+J, N)
  useClientKeyboardShortcuts();

  const [data, setData] = useState<DashboardData | null>(initialData);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [activeSection, setActiveSection] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const isFirstMountRef = useRef(Boolean(initialData));

  // Time range sync with localStorage (deterministic SSR default to avoid hydration mismatch)
  const [selectedRange, setSelectedRange] = useState<TimeRangeKey>("30d");
  const [isSwitchingRange, setIsSwitchingRange] = useState(false);

  useEffect(() => {
    let isMounted = true;
    queueMicrotask(() => {
      if (!isMounted) return;
      try {
        const saved = localStorage.getItem(TIMERANGE_STORAGE_KEY) as TimeRangeKey;
        if (saved && ["7d", "30d", "3m", "6m"].includes(saved)) {
          setSelectedRange(saved);
        }
      } catch {
        // Ignore
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Live updated timestamp
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [timeAgoLabel, setTimeAgoLabel] = useState<string>("Just now");

  const handleRangeChange = useCallback((range: TimeRangeKey) => {
    setIsSwitchingRange(true);
    setSelectedRange(range);
    try {
      localStorage.setItem(TIMERANGE_STORAGE_KEY, range);
    } catch {
      // Ignore
    }
    // Quick skeleton transition
    setTimeout(() => {
      setIsSwitchingRange(false);
    }, 280);
  }, []);

  // Update "Last updated X min ago" label periodically
  useEffect(() => {
    const updateLabel = () => {
      const diffSec = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (diffSec < 60) {
        setTimeAgoLabel("Just now");
      } else if (diffSec < 120) {
        setTimeAgoLabel("Updated 1 min ago");
      } else {
        const mins = Math.floor(diffSec / 60);
        setTimeAgoLabel(`Updated ${mins} min ago`);
      }
    };

    updateLabel();
    const interval = setInterval(updateLabel, 30000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      const response = await fetch("/api/client/dashboard");
      if (!response.ok) {
        throw new Error("Failed to load dashboard metrics.");
      }
      const json: DashboardData = await response.json();
      if (json.onboardingRequired) {
        router.push("/vos-sync/client/company-profile");
        return;
      }
      setData(json);
      setLastUpdated(new Date());
      if (isRefresh) {
        toast.success("Dashboard metrics updated");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred fetching dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    if (initialData?.onboardingRequired) {
      router.push("/vos-sync/client/company-profile");
    }
  }, [initialData, router]);

  useEffect(() => {
    if (isFirstMountRef.current && initialData) {
      isFirstMountRef.current = false;
      return;
    }
    isFirstMountRef.current = false;
    fetchDashboard();
  }, [fetchDashboard, reloadKey, initialData]);

  const baseStats = useMemo(() => {
    return data?.stats ?? {
      activeJobs: 0,
      hiredCount: 0,
      upcomingInterviewsCount: 0,
      totalApplicants: 0,
      totalJobs: 0,
      shortlistedCount: 0,
    };
  }, [data?.stats]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <Card className="border-destructive/30 shadow-md">
          <CardContent className="p-6 space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h3 className="text-lg font-bold text-foreground">Sync Failure</h3>
            <p className="text-sm text-muted-foreground">
              {error || "Could not retrieve company profile information."}
            </p>
            <Button
              onClick={() => setReloadKey((k) => k + 1)}
              className="w-full max-md:min-h-10 flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const company = data.company ?? ({} as CompanyInfo);

  const jobPerformance = data.jobPerformance ?? data.recentJobs ?? [];
  const recentApplicants = data.recentApplicants ?? [];
  const upcomingInterviews = data.upcomingInterviews ?? [];
  const actionsRequired = data.actionsRequired ?? [];
  const chartData = data.chartData;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-4 md:space-y-6 pb-14 font-sans"
    >
      {/* 1. Header / Greeting with Post a Job CTA */}
      <DashboardHeader company={company} userName={userName} />

      {/* 2. Live update status row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5 font-medium">
          <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
          <span>{timeAgoLabel}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchDashboard(true)}
          disabled={refreshing}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
          title="Refresh dashboard data"
          aria-label="Refresh dashboard data"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin text-primary" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* 4. KPI Summary 4-card Grid */}
      <KpiSummaryGrid stats={baseStats} />

      {/* 5. Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-stretch">
        {/* Mobile-only switcher for the four content sections */}
        <div role="group" aria-label="Dashboard section" className="md:hidden max-md:order-2 flex items-center gap-1 rounded-xl border bg-card p-1">
          {["Hiring Overview", "Job Performance", "Upcoming Interviews", "Recent Applicants"].map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setActiveSection(i)}
              aria-pressed={activeSection === i}
              className={`flex-1 min-h-10 rounded-lg px-2 py-1 text-[11px] leading-tight text-center font-medium transition-colors ${activeSection === i ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={`max-md:order-3 lg:col-span-2${activeSection === 0 ? "" : " max-md:hidden"}`}>
          <HiringOverviewChart
            chartData={chartData}
            selectedRange={selectedRange}
            onRangeChange={handleRangeChange}
            isSwitching={isSwitchingRange}
          />
        </div>

        <div className={`max-md:order-3${activeSection === 1 ? "" : " max-md:hidden"}`}>
          <JobPerformanceTable jobs={jobPerformance} />
        </div>

        <div className={`max-md:order-3${activeSection === 2 ? "" : " max-md:hidden"}`}>
          <UpcomingInterviewsCard interviews={upcomingInterviews} />
        </div>

        <div className={`max-md:order-3${activeSection === 3 ? "" : " max-md:hidden"}`}>
          <RecentApplicantsCard applicants={recentApplicants} />
        </div>

        {/* Action Required: Needs Attention */}
        <div className="max-md:order-1">
          <ActionRequiredCard initialActions={actionsRequired} />
        </div>
      </div>
    </motion.div>
  );
}

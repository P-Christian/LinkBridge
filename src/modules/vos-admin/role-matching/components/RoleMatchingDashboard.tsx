// src/modules/vos-admin/role-matching/components/RoleMatchingDashboard.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FolderTree,
  Briefcase,
  Search,
  Play,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Inbox,
  Layers,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardMetrics } from "../types";
import { fetchDashboardMetrics } from "../services/roleMatchingService";
import { MatchingTaxonomyEditor } from "./MatchingTaxonomyEditor";
import { toast } from "sonner";

export function MatchingIntelligenceDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const m = await fetchDashboardMetrics();
      setMetrics(m);
    } catch (err: unknown) {
      setMetrics(null);
      toast.error((err as Error)?.message || "Failed to load metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadData();
    });
  }, [loadData]);

  // `—` rather than `0`: an unread taxonomy must not be reported as an empty one.
  const shown = (value: number | undefined) => (value === undefined ? "—" : value);

  const metricsData = [
    {
      title: "Job Categories",
      icon: FolderTree,
      iconColor: "text-indigo-500",
      value: shown(metrics?.totalCategories),
      subtext: "High-level domains",
    },
    {
      title: "Standard Roles",
      icon: Briefcase,
      iconColor: "text-blue-500",
      value: shown(metrics?.totalStandardRoles),
      subtext: "Classified job titles",
    },
    {
      title: "Keywords & Synonyms",
      icon: Search,
      iconColor: "text-emerald-500",
      value: shown(metrics?.totalSearchKeywords),
      subtext: "Search match terms",
    },
    {
      title: "Role Skill Mappings",
      icon: CheckCircle2,
      iconColor: "text-violet-500",
      value: shown(metrics?.totalRoleSkills),
      subtext: "Weighted competencies",
    },
  ];

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Matching Intelligence
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Maintain and govern the official job taxonomy, matching rules, search terms, and client-submitted intelligence requests used across VOS Sync.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-9 px-4 rounded-xl text-xs gap-2 shrink-0 border-zinc-200 dark:border-zinc-800 hover:bg-muted active:scale-95 transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Data
          </Button>
          <Link href="/vos-sync/vos-admin/job-roles/tester">
            <Button
              size="sm"
              className="h-9 px-4 rounded-xl text-xs gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Match Test Studio
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {metricsData.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.03 }}
            >
              <Card className="rounded-2xl border-zinc-200 dark:border-zinc-800 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs font-semibold text-zinc-500">{item.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${item.iconColor}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{item.value}</div>
                  <p className="text-xs text-zinc-400 mt-1">{item.subtext}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {/* Pending Requests Highlight Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.12 }}
        >
          <Card className="rounded-2xl border-amber-300/80 dark:border-amber-700/80 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs hover:border-amber-400 dark:hover:border-amber-600 transition-colors h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-amber-700 dark:text-amber-400">Pending Requests</CardTitle>
              <Inbox className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-amber-700 dark:text-amber-300">{shown(metrics?.pendingRequests)}</div>
              <p className="text-xs text-amber-500/80 mt-1">Awaiting admin review</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Navigation Cards — 3 Streamlined Governance Hubs */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Quick Intelligence Navigation</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Approval Queue */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.18, delay: 0.15 }}
          >
            <Link href="/vos-sync/vos-admin/job-roles/approval-queue" className="block h-full">
              <div className="p-5 rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 hover:border-amber-500 dark:hover:border-amber-500 transition-all group h-full flex flex-col justify-between cursor-pointer">
                <div>
                  <Inbox className="h-6 w-6 text-amber-600 dark:text-amber-400 mb-3" />
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors flex items-center justify-between">
                    Approval Queue{" "}
                    {(metrics?.pendingRequests ?? 0) > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                        {metrics?.pendingRequests}
                      </span>
                    )}
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h4>
                  <p className="text-xs text-zinc-500 mt-1">
                    Review client-suggested categories and taxonomy modifications before they become official.
                  </p>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Matching Taxonomy Editor */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.18, delay: 0.18 }}
          >
            <Link href="/vos-sync/vos-admin/job-roles/taxonomy" className="block h-full">
              <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all group h-full flex flex-col justify-between cursor-pointer">
                <div>
                  <Layers className="h-6 w-6 text-indigo-600 mb-3" />
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 transition-colors flex items-center justify-between">
                    Matching Taxonomy <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h4>
                  <p className="text-xs text-zinc-500 mt-1">
                    Manage categories, standard roles, core skills with matching weights, and search keywords.
                  </p>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Match Test Studio */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.18, delay: 0.21 }}
          >
            <Link href="/vos-sync/vos-admin/job-roles/tester" className="block h-full">
              <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all group h-full flex flex-col justify-between cursor-pointer">
                <div>
                  <Activity className="h-6 w-6 text-emerald-600 mb-3" />
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 transition-colors flex items-center justify-between">
                    Match Test Studio <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h4>
                  <p className="text-xs text-zinc-500 mt-1">
                    Test and validate role classification, keyword matching, and skill similarity scores in real-time.
                  </p>
                </div>
              </div>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Matching Taxonomy Visualization & Management */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.24 }}
        className="space-y-3"
      >
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Matching Taxonomy</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Hierarchical governance view of job categories, canonical roles, core skills with matching weights, and search keywords.
          </p>
        </div>
        <MatchingTaxonomyEditor />
      </motion.div>
    </div>
  );
}

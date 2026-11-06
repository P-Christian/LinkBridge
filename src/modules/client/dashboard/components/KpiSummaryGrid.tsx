// src/modules/client/dashboard/components/KpiSummaryGrid.tsx
"use client";

import React from "react";
import Link from "next/link";
import { DashboardStats } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Users, UserCheck, Calendar, ArrowUpRight, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import AnimatedNumber from "./AnimatedNumber";
import { cn } from "@/lib/utils";

interface KpiSummaryGridProps {
  stats: DashboardStats;
}

/** Each KPI gets its own hue so the row is scannable at a glance. */
const TONES = {
  blue: { chip: "from-blue-500 to-indigo-500 shadow-blue-500/30", glow: "bg-blue-500/20", bar: "from-blue-500 to-indigo-500" },
  violet: { chip: "from-violet-500 to-fuchsia-500 shadow-violet-500/30", glow: "bg-violet-500/20", bar: "from-violet-500 to-fuchsia-500" },
  emerald: { chip: "from-emerald-500 to-teal-500 shadow-emerald-500/30", glow: "bg-emerald-500/20", bar: "from-emerald-500 to-teal-500" },
  amber: { chip: "from-amber-500 to-orange-500 shadow-amber-500/30", glow: "bg-amber-500/20", bar: "from-amber-500 to-orange-500" },
} as const;

function Delta({ text }: { text: string }) {
  const up = text.startsWith("↑");
  const down = text.startsWith("↓");
  if (!up && !down) return <span className="text-muted-foreground">{text}</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs md:text-[11px] font-semibold",
        up ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
      )}
    >
      {text}
    </span>
  );
}

export default function KpiSummaryGrid({ stats }: KpiSummaryGridProps) {
  const cards = [
    {
      title: "Active Jobs",
      value: stats.activeJobs ?? 0,
      deltaText: stats.activeJobsDelta || "Active listings",
      icon: Briefcase,
      route: "/linkbridge/client/jobs",
      tone: TONES.blue,
    },
    {
      title: "Total Applicants",
      value: stats.totalApplicants ?? 0,
      deltaText:
        stats.applicantsGrowthPercent !== undefined
          ? stats.applicantsGrowthPercent >= 0
            ? `↑ ${stats.applicantsGrowthPercent}% this month`
            : `↓ ${Math.abs(stats.applicantsGrowthPercent)}% this month`
          : "Steady intake",
      icon: Users,
      route: "/linkbridge/client/applicants",
      tone: TONES.violet,
    },
    {
      title: "Shortlisted Candidates",
      value: stats.shortlistedCount ?? 0,
      deltaText: stats.shortlistedWeeklyGrowth || "In review pipeline",
      icon: UserCheck,
      route: "/linkbridge/client/applicants?status=SHORTLISTED",
      tone: TONES.emerald,
    },
    {
      title: "Upcoming Interviews",
      value: stats.upcomingInterviewsCount ?? 0,
      deltaText: stats.nextInterviewSummary || "Scheduled sessions",
      icon: Calendar,
      route: "/linkbridge/client/interviews",
      tone: TONES.amber,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -3, transition: { duration: 0.15 } }}
          >
            <Link
              href={card.route}
              aria-label={`${card.title}: ${card.value}. View details`}
              className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card className="relative h-full overflow-hidden rounded-2xl py-0 gap-0 bg-card/80 backdrop-blur-md border border-border/70 shadow-panel group-hover:shadow-panel-hover group-hover:border-primary/30 transition-[box-shadow,border-color] duration-200">
                {/* accent bar + corner glow */}
                <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", card.tone.bar)} />
                <div
                  aria-hidden="true"
                  className={cn("pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl opacity-50 transition-opacity duration-300 group-hover:opacity-100", card.tone.glow)}
                />

                <CardContent className="relative px-5 py-5 max-md:px-3 max-md:py-3.5 flex flex-col justify-between h-full space-y-4 max-md:space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm md:text-xs max-md:text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                      {card.title}
                    </span>
                    <div
                      className={cn(
                        "h-9 w-9 max-md:h-7 max-md:w-7 shrink-0 rounded-xl bg-gradient-to-br text-white shadow-md flex items-center justify-center",
                        card.tone.chip
                      )}
                    >
                      <Icon className="h-4.5 w-4.5 max-md:h-3.5 max-md:w-3.5" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-3xl max-md:text-2xl font-bold tracking-tight text-foreground tabular-nums">
                      <AnimatedNumber value={card.value} />
                      <ArrowUpRight
                        className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="text-sm md:text-xs max-md:text-xs font-medium">
                      <Delta text={card.deltaText} />
                    </div>
                  </div>

                  <div className="pt-1 max-md:pt-1.5 flex items-center justify-between text-xs md:text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity border-t border-border/50">
                    <span>View details</span>
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

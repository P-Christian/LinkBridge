// src/modules/client/jobs/components/JobCard.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import {
  MapPin,
  Users,
  Clock,
  Briefcase,
  Landmark,
  Banknote,
  ChevronRight,
  PlayCircle,
  RotateCcw,
} from "lucide-react";
import JobStatusBadge from "./JobStatusBadge";
import { JobPosting, JobStatus, JOB_TYPE_LABELS } from "../types";
import { pluralizeApplicants } from "../job-helpers";
import { cn } from "@/lib/utils";

// A disabled control must not stay wrapped in a link, otherwise clicking it
// still navigates to an empty applicants page.
function ApplicantsGate({
  enabled,
  href,
  children,
}: {
  enabled: boolean;
  href: string;
  children: React.ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <Link href={href} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}

interface JobCardProps {
  job: JobPosting;
  onView: (job: JobPosting) => void;
  onEdit: (job: JobPosting) => void;
  onStatusChange: (
    jobId: number,
    newStatus: JobStatus
  ) => void;
}

const parseJsonField = (value: string | null | undefined): Record<string, unknown> => {
  if (!value) return {};
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // ignore
    }
  }
  return {};
};

function formatSalary(min?: number | null, max?: number | null, negotiable?: boolean, salaryType?: string): string {
  const typeSuffix = salaryType === "Hourly Rate" ? " / hr" : "";
  if (negotiable) return "Negotiable";
  if (!min && !max) return "Undisclosed";
  if (min && max) return `₱${min.toLocaleString()} – ₱${max.toLocaleString()}${typeSuffix}`;
  if (min) return `₱${min.toLocaleString()} ${typeSuffix}`;
  if (max) return `Up to ₱${max.toLocaleString()}${typeSuffix}`;
  return "—";
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// Border accent per status
const STATUS_BORDER: Record<JobStatus, string> = {
  ACTIVE: "border-l-primary",
  DRAFT: "border-l-amber-500",
  CLOSED: "border-l-rose-500",
};

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.2, ease: "easeIn" as const },
  },
};

export default function JobCard({
  job,
  onView,
  onStatusChange,
}: JobCardProps) {
  const descData = parseJsonField(job.job_description);
  const reqsData = parseJsonField(job.job_requirements);

  const category = (descData.job_category as string) || (job.job_category as string) || "";
  const arrangement = (descData.work_arrangement as string) || (job.work_arrangement as string) || "Remote";
  const salaryType = (reqsData.salary_type as string) || (job.salary_type as string) || "Salary Range";

  const totalApplicants = job.applicants_count ?? 0;
  const activeApplicants = job.active_applicants_count ?? totalApplicants;
  const hasApplicants = totalApplicants > 0;
  const applicantsHref = `/linkbridge/client/applicants?job_id=${job.job_id}`;

  return (
    <motion.div
      layout="position"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-full"
    >
      <TooltipProvider delayDuration={2000}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card
              onClick={() => onView(job)}
              className={[
                "group hover:shadow-md py-0 overflow-hidden cursor-pointer",
                "border border-border/80 hover:border-primary/50",
                "bg-card shadow-sm",
                "hover:-translate-y-[1px]",
                "border-l-4",
                STATUS_BORDER[job.status] ?? "border-l-muted",
                "transition-all duration-300 ease-in-out",
              ].join(" ")}
            >
              <CardContent className="p-5 sm:p-6 max-md:p-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                  {/* ── Left: Main Job Details ──────────────────────── */}
                  <div className="min-w-0 flex-1 space-y-2.5">

                    {/* Title & Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-foreground text-sm sm:text-base leading-snug tracking-tight group-hover:text-primary transition-colors duration-200">
                        {job.job_title}
                      </h3>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <JobStatusBadge status={job.status} />
                        {category && (
                          <Badge variant="outline" className="text-xs md:text-[10px] py-0.5 px-2 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/40 dark:border-emerald-800/30 rounded-md">
                            {category}
                          </Badge>
                        )}
                        {arrangement && (
                          <Badge variant="outline" className="text-xs md:text-[10px] py-0.5 px-2 font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/40 dark:border-blue-800/30 rounded-md">
                            {arrangement}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Department */}
                    {job.job_department && (
                      <div className="text-sm md:text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                        <Landmark className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                        <span>{job.job_department} Department</span>
                      </div>
                    )}

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm md:text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                        {job.job_location}
                      </span>
                      <span className="h-3 w-px bg-border hidden sm:block" />
                      <span className="flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                        {JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
                      </span>
                      <span className="h-3 w-px bg-border hidden sm:block" />
                      <span
                        className="flex items-center gap-1.5"
                        title={`${totalApplicants} total including rejected and hired · ${activeApplicants} still in the pipeline`}
                      >
                        <Users className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                        {pluralizeApplicants(totalApplicants)}
                      </span>
                      <span className="h-3 w-px bg-border hidden sm:block" />
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                        Posted {timeAgo(job.created_at)}
                      </span>
                    </div>

                    {/* Salary badge */}
                    <div className="pt-0.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20 px-3 py-1 rounded-lg border border-emerald-100/50 dark:border-emerald-800/20">
                        <Banknote className="h-3.5 w-3.5" />
                        {formatSalary(job.salary_min, job.salary_max, job.salary_negotiable, salaryType)}
                      </span>
                    </div>
                  </div>

                  {/* ── Right: Dynamic Context-Aware Action ─────────────── */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
                    {job.status === "DRAFT" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStatusChange(job.job_id, "ACTIVE");
                        }}
                        className="h-9 px-3.5 text-sm md:text-xs gap-2 rounded-xl border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 transition-all duration-200 font-semibold shadow-xs max-md:min-h-10"
                        title="Publish this job to make it active and receive applications"
                      >
                        <PlayCircle className="h-3.5 w-3.5 text-primary" />
                        Make Active
                      </Button>
                    ) : job.status === "CLOSED" ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStatusChange(job.job_id, "ACTIVE");
                          }}
                          className="h-9 px-3 text-sm md:text-xs gap-1.5 rounded-xl border-border hover:border-primary hover:text-primary hover:bg-primary/5 transition-all font-semibold shadow-xs max-md:min-h-10"
                          title="Reopen and activate this job posting"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reopen
                        </Button>
                        <ApplicantsGate enabled={hasApplicants} href={applicantsHref}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!hasApplicants}
                            title={
                              hasApplicants
                                ? `View past applicants · ${activeApplicants} still in the pipeline`
                                : "No applicants yet for this posting"
                            }
                            className={cn(
                              "h-9 px-2.5 text-sm md:text-xs gap-1.5 rounded-xl text-muted-foreground font-semibold max-md:min-h-10 disabled:pointer-events-auto",
                              hasApplicants && "hover:text-foreground"
                            )}
                          >
                            <Users className="h-3.5 w-3.5" />
                            <span className="px-1.5 py-0.2 bg-muted text-muted-foreground rounded-full text-xs md:text-[10px] font-bold">
                              {activeApplicants}
                            </span>
                          </Button>
                        </ApplicantsGate>
                      </div>
                    ) : (
                      <ApplicantsGate enabled={hasApplicants} href={applicantsHref}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!hasApplicants}
                          title={
                            hasApplicants
                              ? undefined
                              : "No applicants yet for this posting"
                          }
                          className={cn(
                            "h-9 px-3.5 text-sm md:text-xs gap-2 rounded-xl border-border transition-all duration-200 font-semibold shadow-xs max-md:min-h-10 disabled:pointer-events-auto",
                            hasApplicants
                              ? "hover:border-primary hover:text-primary hover:bg-primary/5"
                              : "text-muted-foreground"
                          )}
                        >
                          <Users className={cn("h-3.5 w-3.5", hasApplicants && "text-primary")} />
                          View Applicants
                          <span
                            className={cn(
                              "ml-0.5 px-1.5 py-0.2 rounded-full text-xs md:text-[10px] font-bold",
                              hasApplicants ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            )}
                            title={hasApplicants ? `${totalApplicants} total including rejected and hired` : undefined}
                          >
                            {activeApplicants}
                          </span>
                          {hasApplicants && (
                            <ChevronRight className="h-3 w-3 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                          )}
                        </Button>
                      </ApplicantsGate>
                    )}
                  </div>

                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-sm md:text-xs">
            Click to preview and edit job details
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </motion.div>
  );
}


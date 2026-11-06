// src/modules/client/dashboard/components/JobPerformanceTable.tsx
"use client";

import React, { useCallback, useMemo } from "react";
import { JobPerformanceItem } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, ArrowRight, Users, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface JobPerformanceTableProps {
  jobs: JobPerformanceItem[];
}

export default function JobPerformanceTable({ jobs }: JobPerformanceTableProps) {
  const router = useRouter();

  const handleNavigateAll = useCallback(() => {
    router.push("/linkbridge/client/jobs");
  }, [router]);

  const handleNavigateJob = useCallback((jobId: number) => {
    router.push(`/linkbridge/client/jobs?jobId=${jobId}`);
  }, [router]);

  const isActive = (st?: string) => {
    if (!st) return false;
    const s = st.toUpperCase();
    return s === "ACTIVE" || s === "PUBLISHED" || s === "OPEN";
  };

  const displayedJobs = useMemo(() => {
    return [...jobs]
      .sort((a, b) => {
        const aApps = a.applicantsCount ?? a.applicants_count ?? 0;
        const bApps = b.applicantsCount ?? b.applicants_count ?? 0;
        if (aApps !== bApps) return bApps - aApps;
        const aDate = new Date(a.postedAt || a.created_at || 0).getTime();
        const bDate = new Date(b.postedAt || b.created_at || 0).getTime();
        return bDate - aDate;
      })
      .slice(0, 10);
  }, [jobs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <Card className="text-card-foreground gap-0 py-0 bg-card/80 backdrop-blur-md border border-border/70 shadow-panel hover:shadow-panel-hover hover:border-primary/30 transition-[box-shadow,border-color] duration-200 rounded-2xl overflow-hidden flex flex-col justify-between h-full py-0">
        <div>
          <CardHeader className=" py-4  flex flex-row items-center justify-between border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/15 to-sky-500/20 text-primary ring-1 ring-primary/15 flex items-center justify-center">
                <Briefcase className="h-4 w-4" />
              </div>
              <CardTitle className="text-base font-bold text-foreground">Job Performance</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNavigateAll}
              className="text-sm md:text-xs font-semibold text-primary hover:text-primary/90 h-8 max-md:min-h-10 px-2.5 flex items-center gap-1 group"
            >
              View All Jobs
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            {displayedJobs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm md:text-xs space-y-2">
                <Briefcase className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p>No active jobs posted yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/linkbridge/client/jobs")}
                  className="text-sm md:text-xs font-semibold mt-1 max-md:min-h-10"
                >
                  Create First Job
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                <div className="grid grid-cols-12 px-5 max-md:px-4 py-2.5 text-xs md:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider max-md:tracking-normal bg-muted/40">
                  <span className="col-span-6 min-w-0 truncate">Job</span>
                  <span className="col-span-2 text-center min-w-0 truncate">
                    <span className="max-md:hidden">Applicants</span>
                    <span className="hidden max-md:inline">Apps</span>
                  </span>
                  <span className="col-span-2 text-center min-w-0 truncate">
                    <span className="max-md:hidden">Shortlisted</span>
                    <span className="hidden max-md:inline">Shortlist</span>
                  </span>
                  <span className="col-span-2 text-right min-w-0 truncate">Status</span>
                </div>

                {displayedJobs.map((job) => {
                  const id = job.id || job.job_id || 0;
                  const title = job.title || job.job_title || "Job Posting";
                  const department = job.department || job.job_department || "General";
                  const location = job.location || job.job_location || "";
                  const applicantsCount = job.applicantsCount ?? job.applicants_count ?? 0;
                  const shortlistedCount = job.shortlistedCount ?? 0;
                  const isJobActive = isActive(job.status);

                  return (
                    <div
                      key={id}
                      onClick={() => handleNavigateJob(id)}
                      className="grid grid-cols-12 items-center px-5 py-3.5 hover:bg-muted/40 transition-colors cursor-pointer group text-sm md:text-xs"
                    >
                      <div className="col-span-6 pr-2">
                        <p className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {title}
                        </p>
                        <p className="text-xs md:text-[11px] text-muted-foreground truncate pt-0.5">
                          {department} {location ? `• ${location}` : ""}
                        </p>
                      </div>

                      <div className="col-span-2 text-center font-semibold text-foreground flex items-center justify-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground sm:hidden" />
                        <span>{applicantsCount}</span>
                      </div>

                      <div className="col-span-2 text-center font-semibold text-foreground flex items-center justify-center gap-1">
                        <UserCheck className="h-3.5 w-3.5 text-muted-foreground sm:hidden" />
                        <span>{shortlistedCount}</span>
                      </div>

                      <div className="col-span-2 text-right">
                        {isJobActive ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs md:text-[10px] font-semibold px-2 py-0.5">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground border-border text-xs md:text-[10px] px-2 py-0.5">
                            {job.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </div>

        <div className="p-4 bg-muted/20 border-t border-border/60 flex items-center justify-between">
          <span className="text-sm md:text-xs text-muted-foreground">Showing top 10 postings</span>
 
        </div>
      </Card>
    </motion.div>
  );
}

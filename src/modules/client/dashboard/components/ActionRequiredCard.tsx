// src/modules/client/dashboard/components/ActionRequiredCard.tsx
"use client";

import React, { useMemo, useCallback } from "react";
import { ActionRequiredItem } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Briefcase,
  Users,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface ActionRequiredCardProps {
  initialActions?: ActionRequiredItem[];
}

export default function ActionRequiredCard({ initialActions = [] }: ActionRequiredCardProps) {
  const router = useRouter();

  // Seed sample priority actionable items if backend returns empty or limited actions
  const actions: ActionRequiredItem[] = useMemo(() => {
    return initialActions.length > 0
      ? initialActions
      : [
          {
            id: "act-app-1",
            type: "unreviewed_applicants",
            title: "7 new applicants need review",
            description: "Highest volume in: Senior Frontend Engineer",
            actionUrl: "/linkbridge/client/applicants?status=APPLIED",
            actionLabel: "Review Applicants",
            severity: "warning",
            dismissible: false,
          },
          {
            id: "act-int-2",
            type: "interview_outcome_pending",
            title: "1 interview outcome pending",
            description: "Requires completion or attendance status: David Chen",
            actionUrl: "/linkbridge/client/interviews?tab=awaiting_outcome",
            actionLabel: "Mark Outcome",
            severity: "urgent",
            dismissible: false,
          },
        ];
  }, [initialActions]);

  // Quick schedule action
  const handleSchedule = useCallback((item: ActionRequiredItem, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/linkbridge/client/interviews?candidate=${encodeURIComponent(item.title)}`);
  }, [router]);

  const handleRowClick = useCallback((url: string) => {
    router.push(url);
  }, [router]);

  const getIcon = (item: ActionRequiredItem) => {
    if (item.type === "unreviewed_applicants") {
      return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    }
    if (item.type === "interview_pending" || item.type === "interview_outcome_pending") {
      return <Clock className="h-4 w-4 text-blue-500 shrink-0" />;
    }
    if (item.type === "job_expiring") {
      return <Briefcase className="h-4 w-4 text-rose-500 shrink-0" />;
    }
    return <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <Card className="bg-card/80 backdrop-blur-md border border-border/70 shadow-panel hover:shadow-panel-hover hover:border-primary/30 transition-[box-shadow,border-color] duration-200 rounded-2xl py-0 overflow-hidden flex flex-col justify-between h-full">
        <div>
          <CardHeader className="p-4 md:p-5 md:pb-3 flex flex-row items-center justify-between border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-foreground dark:text-[#E6EAF5]">Needs Attention</CardTitle>
                {actions.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs md:text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    {actions.length}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/linkbridge/client/notifications")}
              className="text-sm md:text-xs font-semibold text-primary hover:text-primary/90 h-8 max-md:min-h-10 px-2.5 flex items-center gap-1 group"
            >
              Notification Center
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </CardHeader>

          <CardContent className="p-4 md:p-5">
            {actions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground dark:text-[#8A94AD] text-sm md:text-xs space-y-2">
                <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                <p className="font-semibold text-foreground dark:text-white">All caught up!</p>
                <p className="text-xs md:text-[11px]">No urgent hiring items require your attention right now.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {actions.map((item) => {
                    const isApplicant = item.type === "unreviewed_applicants";
                    const isInterview = item.type === "interview_pending" || item.type === "interview_outcome_pending";
                    const isJob = item.type === "job_expiring";
                    const isProfile = item.type === "profile_verification";

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
                        transition={{ duration: 0.25 }}
                      >
                        <div
                          onClick={() => handleRowClick(item.actionUrl)}
                          className="p-3.5 rounded-xl border border-border/70 hover:border-primary/40 bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="mt-0.5">{getIcon(item)}</div>
                            <div className="min-w-0 space-y-0.5">
                              <p className="text-sm md:text-xs font-bold text-foreground dark:text-[#E6EAF5] group-hover:text-primary transition-colors">
                                {item.title}
                              </p>
                              {item.description && (
                                <p className="text-xs md:text-[11px] text-muted-foreground dark:text-[#8A94AD] line-clamp-1">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Inline Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            {isApplicant && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(item.actionUrl);
                                }}
                                className="h-7 px-2.5 text-[11px] rounded-lg font-semibold border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                title="Review applicants"
                              >
                                <Users className="h-3 w-3 mr-1" />
                                {item.actionLabel || "Review Applicants"}
                              </Button>
                            )}

                            {isInterview && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (item.actionUrl) {
                                    router.push(item.actionUrl);
                                  } else {
                                    handleSchedule(item, e);
                                  }
                                }}
                                className="h-7 px-2.5 text-[11px] rounded-lg font-semibold border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              >
                                <Calendar className="h-3 w-3 mr-1" />
                                {item.actionLabel || "Review"}
                              </Button>
                            )}

                            {isJob && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(item.actionUrl);
                                }}
                                className="h-7 px-2.5 text-[11px] rounded-lg font-semibold border-border text-foreground hover:bg-muted"
                              >
                                {item.actionLabel || "Extend"}
                              </Button>
                            )}

                            {isProfile && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(item.actionUrl);
                                }}
                                className="h-7 px-2.5 text-[11px] rounded-lg font-semibold border-border text-foreground hover:bg-muted"
                              >
                                {item.actionLabel || "Complete Profile"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </div>
 
      </Card>
    </motion.div>
  );
}

"use client";

// src/modules/client/interviews/components/InterviewStatusBadge.tsx

import React from "react";
import { InterviewStatus, INTERVIEW_STATUS_LABELS } from "../types";
import { isInterviewConcluded } from "./interviewUtils";
import { cn } from "@/lib/utils";

interface InterviewStatusBadgeProps {
  status: InterviewStatus | "CONCLUDED" | "ENDED";
  scheduledAt?: string | null;
  durationMinutes?: number;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200/60",
  CONFIRMED: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200/60",
  CANCELLED: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200/60",
  RESCHEDULED: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200/60",
  COMPLETED: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200/60",
  NO_SHOW: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200/60",
  CONCLUDED: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/60",
  ENDED: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/60",
};

export default function InterviewStatusBadge({
  status,
  scheduledAt,
  durationMinutes = 60,
  className,
}: InterviewStatusBadgeProps) {
  const isConcluded = isInterviewConcluded(status, scheduledAt, durationMinutes);
  const effectiveStatus = isConcluded ? "CONCLUDED" : status;
  const label =
    effectiveStatus === "CONCLUDED" || effectiveStatus === "ENDED"
      ? "Awaiting Feedback"
      : (INTERVIEW_STATUS_LABELS[effectiveStatus as InterviewStatus] ?? effectiveStatus);
  const colorClass = STATUS_COLORS[effectiveStatus] ?? STATUS_COLORS.SCHEDULED;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs md:text-[11px] font-semibold border",
        colorClass,
        className
      )}
    >
      {label}
    </span>
  );
}

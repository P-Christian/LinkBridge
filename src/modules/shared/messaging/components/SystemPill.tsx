"use client";

// src/modules/shared/messaging/components/SystemPill.tsx

import React from "react";
import { Info, Calendar, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
  text?: string | null;
}

function formatTimestampInText(str: string): string {
  return str.replace(
    /(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2})?)/g,
    (match) => {
      try {
        const clean = match.replace(" ", "T");
        const d = new Date(clean);
        if (isNaN(d.getTime())) return match;
        const dateStr = d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const timeStr = d.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        return `${dateStr} at ${timeStr}`;
      } catch {
        return match;
      }
    }
  );
}

/** Fallback renderer for system messages: renders interactive cards for interviews/assessments, or permanent pill. */
export default function SystemPill({ text }: Props) {
  const pathname = usePathname();
  const isFreelancer = pathname?.includes("/freelancer");

  const raw = text ?? "System event";
  const formatted = formatTimestampInText(raw);
  const lower = raw.toLowerCase();

  // Interview card only for actual scheduled/rescheduled events, never for stage status updates
  const isInterview =
    (lower.includes("interview scheduled") || lower.includes("interview rescheduled")) &&
    !lower.includes("updated to") &&
    !lower.includes("moved to");

  const isAssessment = lower.includes("assessment");

  // Role-aware text transformation: employers shouldn't see "Your application"
  let displayText = formatted;
  if (!isFreelancer) {
    displayText = displayText
      .replace(/^Your application for /i, "Candidate's application for ")
      .replace(/^You were hired for /i, "Candidate was hired for ")
      .replace(/^You applied for /i, "Candidate applied for ")
      .replace(/^Client hired you\.?/i, "Candidate was hired.");
  }

  if (isInterview) {
    return (
      <div className="w-full max-w-sm sm:max-w-md rounded-2xl border border-violet-500/20 bg-card/80 p-3.5 backdrop-blur-xl shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-violet-700 dark:text-violet-300 pb-2 border-b border-violet-500/10">
          <Calendar className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
          <span>Interview Scheduled</span>
        </div>
        <p className="py-2.5 text-xs text-foreground leading-relaxed text-center font-medium">
          {displayText}
        </p>
        <div className="pt-2 border-t border-violet-500/10 flex justify-center">
          <Link
            href={isFreelancer ? "/linkbridge/freelancer/applications" : "/linkbridge/client/interviews"}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Go to Interview Schedule</span>
          </Link>
        </div>
      </div>
    );
  }

  if (isAssessment) {
    return (
      <div className="w-full max-w-sm sm:max-w-md rounded-2xl border border-indigo-500/20 bg-card/80 p-3.5 backdrop-blur-xl shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 pb-2 border-b border-indigo-500/10">
          <ClipboardCheck className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span>Assessment Update</span>
        </div>
        <p className="py-2.5 text-xs text-foreground leading-relaxed text-center font-medium">
          {displayText}
        </p>
        <div className="pt-2 border-t border-indigo-500/10 flex justify-center">
          <Link
            href={isFreelancer ? "/linkbridge/freelancer/applications" : "/linkbridge/client/applicants"}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            <span>{isFreelancer ? "Complete Assessment" : "Review Assessment"}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
      <Info className="h-3 w-3 text-zinc-400 shrink-0" />
      <span className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
        {formatted}
      </span>
    </div>
  );
}

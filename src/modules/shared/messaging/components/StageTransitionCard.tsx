"use client";

// src/modules/shared/messaging/components/StageTransitionCard.tsx

import React, { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, GitCommitHorizontal, Loader2, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Message, StageTransitionCardData } from "@/modules/client/messaging/types";
import SystemPill from "./SystemPill";

interface Props {
  message: Message;
}

const STAGE_TYPE_STYLES: Record<string, string> = {
  APPLIED: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  SCREENING: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  ASSESSMENT: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
  INTERVIEW: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
  OFFER: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  HIRED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  REJECTED: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  WITHDRAWN: "bg-muted text-muted-foreground border-border/60",
};

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseFallbackContent(content?: string | null): { from?: string; to?: string } {
  if (!content) return {};
  const arrowMatch = content.match(
    /(?:Stage updated:\s*)?(?:From\s+)?["']?([^"'\n➔\->]+)["']?\s*(?:➔|->)\s*["']?([^"'\n]+)["']?/i
  );
  if (arrowMatch) {
    return { from: arrowMatch[1]?.trim(), to: arrowMatch[2]?.trim() };
  }
  const moveMatch = content.match(/(?:Application moved to stage:\s*|Moved to\s+)(.+)/i);
  if (moveMatch) {
    return { to: moveMatch[1]?.trim() };
  }
  return {};
}

export default function StageTransitionCard({ message }: Props) {
  const initialData = (message.system_card_data as StageTransitionCardData) ?? null;
  const [data, setData] = useState<StageTransitionCardData | null>(initialData);
  const [loading, setLoading] = useState(!initialData?.to_stage_name);
  const pathname = usePathname();

  useEffect(() => {
    if (initialData?.to_stage_name && initialData?.has_scheduled_interview !== undefined) {
      return;
    }

    let cancelled = false;
    fetch(`/api/messaging/system-card?message_id=${message.message_id}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          setData(json && !json.error ? json : null);
        }
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [message.message_id, initialData]);

  if (loading) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-primary/10 bg-card/70 p-3.5 backdrop-blur-xl flex items-center gap-2.5 shadow-xs">
        <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
        <span className="text-xs text-muted-foreground">Loading stage update...</span>
      </div>
    );
  }

  // Fallback to text parsing if system-card API did not return structured stage data
  const fallback = parseFallbackContent(message.message_content);
  const fromStageName = data?.from_stage_name || fallback.from || null;
  const toStageName = data?.to_stage_name || fallback.to || null;
  const fromStageType = data?.from_stage_type ? data.from_stage_type.toUpperCase() : null;
  const toStageType = data?.to_stage_type ? data.to_stage_type.toUpperCase() : null;

  if (!toStageName) {
    return <SystemPill text={message.message_content} />;
  }

  const isFreelancer = pathname?.includes("/freelancer") || data?.viewer_role === "FREELANCER";

  const fromStyle = (fromStageType && STAGE_TYPE_STYLES[fromStageType]) || "bg-primary/10 text-primary border-primary/20";
  const toStyle = (toStageType && STAGE_TYPE_STYLES[toStageType]) || "bg-primary/15 text-primary border-primary/30";
  const displayDate = formatDisplayDate(data?.created_at || message.created_at);

  const isAssessmentStage =
    toStageType === "ASSESSMENT" ||
    toStageName.toLowerCase().includes("assessment");

 
  const targetAppId = data?.application_id || message.system_message?.application_id || null;

  return (
    <div
      role="status"
      aria-label={`Stage updated to ${toStageName}`}
      className="w-full max-w-sm sm:max-w-md rounded-2xl border border-primary/15 bg-card/75 p-3.5 backdrop-blur-xl shadow-xs transition hover:border-primary/30"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-primary/10 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <GitCommitHorizontal className="h-4 w-4 text-primary shrink-0" />
          <span>{isFreelancer ? "Application Stage Updated" : "Candidate Stage Updated"}</span>
        </div>
        {displayDate && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span>{displayDate}</span>
          </div>
        )}
      </div>

      {/* Transition Badges Flow */}
      <div className="pt-3 pb-1 flex items-center justify-center gap-2 flex-wrap sm:flex-nowrap">
        {fromStageName ? (
          <>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold truncate max-w-[150px] sm:max-w-[180px] ${fromStyle}`}
              title={fromStageName}
            >
              {fromStageName}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold truncate max-w-[150px] sm:max-w-[180px] shadow-xs ${toStyle}`}
              title={toStageName}
            >
              {toStageName}
            </span>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Moved to:</span>
            <span
              className={`rounded-full border px-3.5 py-1 text-xs font-semibold shadow-xs ${toStyle}`}
              title={toStageName}
            >
              {toStageName}
            </span>
          </div>
        )}
      </div>

    
 

      {/* Action CTA for Assessment */}
      {isAssessmentStage && (
        <div className="mt-3 pt-2.5 border-t border-primary/10 flex justify-center">
          {isFreelancer ? (
            <Link
              href={targetAppId ? `/linkbridge/freelancer/applications?action=assessment&application_id=${targetAppId}` : "/linkbridge/freelancer/applications"}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span>Complete Assessment</span>
            </Link>
          ) : (
            <Link
              href={targetAppId ? `/linkbridge/client/applicants?application_id=${targetAppId}` : "/linkbridge/client/applicants"}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span>Review Assessment</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

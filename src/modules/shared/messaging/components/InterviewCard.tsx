"use client";

// src/modules/shared/messaging/components/InterviewCard.tsx

import React, { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import {
  CalendarDays,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Loader2,
  Monitor,
  MapPin,
  RefreshCw,
  Video,
  Building,
} from "lucide-react";
import { Message, HiringViewerRole } from "@/modules/client/messaging/types";
import SystemPill from "./SystemPill";
import { usePathname } from "next/navigation";

interface InterviewDetails {
  interview_id: number;
  scheduled_at: string | null;
  duration_minutes: number;
  timezone: string;
  interview_format: string;
  meeting_link: string | null;
  meeting_location: string | null;
  interview_status: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface InterviewCandidate {
  user_id?: number;
  name: string;
  avatar?: string | null;
}

interface InterviewJob {
  job_id?: number | null;
  title: string;
}

interface InterviewCardData {
  event_type: string;
  viewer_role?: HiringViewerRole;

  // Domain Entity Projection
  interview?: InterviewDetails;
  candidate?: InterviewCandidate;
  job?: InterviewJob;

  // Flat fallback properties
  interview_id?: number;
  scheduled_at?: string | null;
  duration_minutes?: number;
  timezone?: string;
  interview_format?: string;
  meeting_link?: string | null;
  meeting_location?: string | null;
  interview_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  applicant_name?: string | null;
  job_title?: string | null;
}

interface Props {
  message: Message;
}

interface StatusConfig {
  icon: React.ReactNode;
  label: string;
  accent: string;
  badgeColor: string;
}

const STATUS_CONFIGS: Record<string, StatusConfig> = {
  SCHEDULED: {
    icon: <CalendarDays className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />,
    label: "Interview Scheduled",
    accent: "bg-violet-50/90 dark:bg-violet-950/40 border-violet-200/60 dark:border-violet-800/40",
    badgeColor: "bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300",
  },
  CONFIRMED: {
    icon: <CalendarCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />,
    label: "Interview Confirmed",
    accent: "bg-blue-50/90 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-800/40",
    badgeColor: "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300",
  },
  RESCHEDULED: {
    icon: <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />,
    label: "Interview Rescheduled",
    accent: "bg-amber-50/90 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/40",
    badgeColor: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300",
  },
  CONCLUDED: {
    icon: <Clock className="h-4 w-4 text-zinc-600 dark:text-zinc-400 shrink-0" />,
    label: "Interview Ended",
    accent: "bg-zinc-50/90 dark:bg-zinc-900/40 border-zinc-200/60 dark:border-zinc-800/40",
    badgeColor: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
  },
  COMPLETED: {
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
    label: "Interview Completed",
    accent: "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/40",
    badgeColor: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300",
  },
  CANCELLED: {
    icon: <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />,
    label: "Interview Cancelled",
    accent: "bg-rose-50/90 dark:bg-rose-950/40 border-rose-200/60 dark:border-rose-800/40",
    badgeColor: "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300",
  },
  NOT_ATTENDED: {
    icon: <AlertCircle className="h-4 w-4 text-zinc-600 dark:text-zinc-400 shrink-0" />,
    label: "Interview — No Show",
    accent: "bg-zinc-50/90 dark:bg-zinc-900/40 border-zinc-200/60 dark:border-zinc-800/40",
    badgeColor: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
  },
  NO_SHOW: {
    icon: <AlertCircle className="h-4 w-4 text-zinc-600 dark:text-zinc-400 shrink-0" />,
    label: "Interview — No Show",
    accent: "bg-zinc-50/90 dark:bg-zinc-900/40 border-zinc-200/60 dark:border-zinc-800/40",
    badgeColor: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
  },
};

const ACTIVE_JOIN_STATUSES = new Set(["SCHEDULED", "CONFIRMED", "RESCHEDULED"]);

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatScheduledAt(dateStr: string | null, timezone: string): string {
  if (!dateStr) return "TBD";
  try {
    return new Date(dateStr).toLocaleString("en-PH", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function tzAbbr(tz: string): string {
  const abbrs: Record<string, string> = {
    "Asia/Manila": "PHT",
    "Asia/Singapore": "SGT",
    "UTC": "UTC",
  };
  return abbrs[tz] ?? tz;
}

function normalizeMeetingLink(link?: string | null): string {
  if (!link || !link.trim()) return "";
  const trimmed = link.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getInterviewHeadline(
  status: string,
  isCandidate: boolean,
  candidateName: string,
  jobTitle: string
): React.ReactNode {
  switch (status) {
    case "COMPLETED":
      return isCandidate ? (
        <span>
          Your interview for <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{jobTitle}</strong> has been completed
        </span>
      ) : (
        <span>
          Interview with <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{candidateName}</strong> • {jobTitle} completed
        </span>
      );
    case "CANCELLED":
      return isCandidate ? (
        <span>
          Your interview for <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{jobTitle}</strong> was cancelled
        </span>
      ) : (
        <span>
          Interview with <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{candidateName}</strong> • {jobTitle} was cancelled
        </span>
      );
    case "RESCHEDULED":
      return isCandidate ? (
        <span>
          Your interview for <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{jobTitle}</strong> was rescheduled
        </span>
      ) : (
        <span>
          Interview rescheduled with <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{candidateName}</strong> • {jobTitle}
        </span>
      );
    case "CONFIRMED":
      return isCandidate ? (
        <span>
          Your interview for <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{jobTitle}</strong> is confirmed
        </span>
      ) : (
        <span>
          Interview confirmed with <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{candidateName}</strong> • {jobTitle}
        </span>
      );
    case "NOT_ATTENDED":
    case "NO_SHOW":
      return isCandidate ? (
        <span>
          Interview session for <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{jobTitle}</strong> was missed
        </span>
      ) : (
        <span>
          Candidate did not attend interview for <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{jobTitle}</strong>
        </span>
      );
    case "CONCLUDED":
      return isCandidate ? (
        <span>
          Interview session for <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{jobTitle}</strong> has ended
        </span>
      ) : (
        <span>
          Interview session with <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{candidateName}</strong> • {jobTitle} has ended
        </span>
      );
    case "SCHEDULED":
    default:
      return isCandidate ? (
        <span>
          Interview scheduled for <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{jobTitle}</strong>
        </span>
      ) : (
        <span>
          Interview scheduled with <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{candidateName}</strong> • {jobTitle}
        </span>
      );
  }
}

function useIsInterviewPast(scheduledAt: string | null, durationMinutes: number): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!scheduledAt) return () => {};
      const endTime = new Date(scheduledAt.replace(" ", "T")).getTime() + durationMinutes * 60_000;
      const delay = endTime - Date.now();
      if (delay <= 0) return () => {};
      const timer = setTimeout(onStoreChange, delay);
      return () => clearTimeout(timer);
    },
    [scheduledAt, durationMinutes]
  );

  const getSnapshot = useCallback(() => {
    if (!scheduledAt) return false;
    const endTime = new Date(scheduledAt.replace(" ", "T")).getTime() + durationMinutes * 60_000;
    return endTime <= Date.now();
  }, [scheduledAt, durationMinutes]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default function InterviewCard({ message }: Props) {
  const pathname = usePathname();
  const isFreelancerPath = pathname?.includes("/freelancer/");

  const initialData = (message as unknown as { system_card_data?: InterviewCardData }).system_card_data ?? null;
  const [data, setData] = useState<InterviewCardData | null>(initialData);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;

    fetch(`/api/messaging/system-card?message_id=${message.message_id}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setData(json && !json.error ? json : null);
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

  const eventType = message.system_message?.event_type ?? "INTERVIEW_SCHEDULED";
  const viewerRole = data?.viewer_role ?? (isFreelancerPath ? "FREELANCER" : "CLIENT");
  const isCandidate = viewerRole === "FREELANCER" || viewerRole === "CANDIDATE";

  // Contextual Domain Entities
  const scheduledAt = data?.interview?.scheduled_at ?? data?.scheduled_at ?? null;
  const durationMinutes = data?.interview?.duration_minutes ?? data?.duration_minutes ?? 60;
  const timezone = data?.interview?.timezone ?? data?.timezone ?? "Asia/Manila";
  const interviewFormat = data?.interview?.interview_format ?? data?.interview_format ?? "ONLINE";
  const meetingLink = data?.interview?.meeting_link ?? data?.meeting_link ?? null;
  const meetingLocation = data?.interview?.meeting_location ?? data?.meeting_location ?? null;
  const interviewStatus = data?.interview?.interview_status ?? data?.interview_status ?? null;
  const createdAt = data?.interview?.created_at ?? data?.created_at ?? null;
  const updatedAt = data?.interview?.updated_at ?? data?.updated_at ?? null;

  const isPast = useIsInterviewPast(scheduledAt, durationMinutes);

  const candidateName = data?.candidate?.name ?? data?.applicant_name ?? "Candidate";
  const jobTitle = data?.job?.title ?? data?.job_title ?? "Position";

  const rawStatus = interviewStatus ?? (eventType === "INTERVIEW_UPDATED" ? "RESCHEDULED" : "SCHEDULED");
  const statusBadge = isPast && ACTIVE_JOIN_STATUSES.has(rawStatus.toUpperCase()) ? "CONCLUDED" : rawStatus;
  const statusCfg = STATUS_CONFIGS[statusBadge] ?? STATUS_CONFIGS["SCHEDULED"];

  if (loading) {
    return (
      <div className={`w-80 max-md:w-full rounded-2xl border p-4 ${statusCfg.accent} flex items-center gap-3 shadow-xs`}>
        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        <span className="text-xs text-muted-foreground">Loading interview details...</span>
      </div>
    );
  }

  if (!data || (data as unknown as Record<string, unknown>).error) {
    return <SystemPill text={message.message_content} />;
  }

  const isOnline = interviewFormat === "ONLINE";
  const displayDate = updatedAt || createdAt || message.created_at;
  const canJoinMeeting =
    isOnline &&
    Boolean(meetingLink) &&
    ACTIVE_JOIN_STATUSES.has(rawStatus.toUpperCase()) &&
    !isPast;

  return (
    <div className={`w-full sm:w-96 rounded-2xl border shadow-xs overflow-hidden ${statusCfg.accent}`}>
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-inherit flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusCfg.icon}
          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
            {statusCfg.label}
          </span>
        </div>
        {displayDate && (
          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
            <CalendarDays className="h-3 w-3 shrink-0" />
            {formatDate(displayDate)}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Dynamic Contextual Headline */}
        <div className="text-xs text-muted-foreground leading-snug">
          {getInterviewHeadline(statusBadge, isCandidate, candidateName, jobTitle)}
        </div>

        {/* Date/Time Banner */}
        <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-card/60 border border-inherit/60">
          <CalendarDays className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-card-foreground">
              {formatScheduledAt(scheduledAt, timezone)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {tzAbbr(timezone)} timezone
            </p>
          </div>
        </div>

        {/* Status + Duration + Format Row */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${statusCfg.badgeColor}`}>
            {statusBadge}
          </span>
          <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-card/70 px-2 py-0.5 rounded-md border border-border/60">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span>{durationMinutes} min</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-card/70 px-2 py-0.5 rounded-md border border-border/60">
            {isOnline ? (
              <Video className="h-3 w-3 text-primary" />
            ) : (
              <Building className="h-3 w-3 text-muted-foreground" />
            )}
            <span>{isOnline ? "Online Meeting" : interviewFormat}</span>
          </div>
        </div>

        {/* Meeting Link or Physical Location */}
        {canJoinMeeting ? (
          <a
            href={normalizeMeetingLink(meetingLink)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition max-md:min-h-11"
          >
            <Monitor className="h-3.5 w-3.5 shrink-0" />
            Join Online Meeting
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : !isOnline && meetingLocation ? (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-card border border-border/60 text-xs text-foreground">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate flex-1 font-medium">{meetingLocation}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}



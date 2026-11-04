"use client";

// src/modules/client/interviews/components/InterviewList.tsx

import React, { useMemo } from "react";
import Image from "next/image";
import { Interview } from "../types";
import InterviewStatusBadge from "./InterviewStatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  Eye,
  MessageSquare,
  RefreshCw,
  XCircle,
  CheckCircle2,
  MoreHorizontal,
  FileQuestion,
  AlertCircle,
} from "lucide-react";
import {
  dateBlockParts,
  formatInterviewTime,
  formatLabel,
  isActiveInterview,
  needsFeedback,
  parseScheduled,
  relativeDayLabel,
  totalScreeningCount,
} from "./interviewUtils";

interface InterviewListProps {
  interviews: Interview[];
  onViewDetails: (interview: Interview) => void;
  onOpenEvaluation: (interview: Interview) => void;
  onReschedule: (interview: Interview) => void;
  onOpenCancelModal: (interview: Interview) => void;
}

type App = NonNullable<Interview["applications"]>[number];
type GroupKey = "today" | "upcoming" | "past";

const GROUP_META: Record<GroupKey, { label: string; hint: string }> = {
  today: { label: "Today", hint: "Happening today" },
  upcoming: { label: "Upcoming", hint: "Soonest first" },
  past: { label: "Past", hint: "Most recent first" },
};

function CandidateAvatar({ name, avatar }: { name?: string; avatar?: string | null }) {
  const [imgError, setImgError] = React.useState(false);

  if (avatar && !imgError) {
    return (
      <Image
        src={avatar}
        alt={name || "Candidate"}
        width={64}
        height={64}
        onError={() => setImgError(true)}
        className="h-10 w-10 rounded-full object-cover ring-2 ring-white dark:ring-zinc-950"
      />
    );
  }

  return (
    <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-sm ring-2 ring-white dark:ring-zinc-950">
      {(name?.[0] || "C").toUpperCase()}
    </div>
  );
}

function AvatarStack({ apps }: { apps: App[] }) {
  const shown = apps.slice(0, 3);
  const extra = apps.length - shown.length;

  if (shown.length === 0) {
    return (
      <div className="h-10 w-10 rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-400">
        <Calendar className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div className="flex items-center -space-x-3 shrink-0">
      {shown.map((a) => (
        <CandidateAvatar
          key={a.interview_application_id || a.application_id}
          name={a.applicant_name}
          avatar={a.applicant_avatar}
        />
      ))}
      {extra > 0 && (
        <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-xs font-bold ring-2 ring-white dark:ring-zinc-950">
          +{extra}
        </div>
      )}
    </div>
  );
}

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function groupOf(item: Interview, todayStart: number): GroupKey {
  const d = parseScheduled(item.scheduled_at);
  if (!d) return "past";
  const start = dayStart(d);
  if (start === todayStart) return "today";
  return start > todayStart ? "upcoming" : "past";
}

function InterviewRow({
  item,
  onViewDetails,
  onOpenEvaluation,
  onReschedule,
  onOpenCancelModal,
}: { item: Interview } & Omit<InterviewListProps, "interviews">) {
  const applications = item.applications ?? [];
  const first = applications[0];
  const appCount = applications.length;
  const active = isActiveInterview(item);
  const completed = item.interview_status === "COMPLETED";
  const overdue = needsFeedback(item);
  const relative = relativeDayLabel(item.scheduled_at);
  const date = dateBlockParts(item.scheduled_at);
  const screeningTotal = totalScreeningCount(item);
  const isToday = relative === "Today";
  const isOnline = item.interview_format === "ONLINE";

  const jobs = Array.from(new Set(applications.map((a) => a.job_title).filter(Boolean)));
  const roleText =
    jobs.length === 0 ? "Position not specified" : jobs.length === 1 ? jobs[0] : `${jobs.length} roles`;

  const title =
    appCount === 0
      ? "Open interview slot"
      : appCount === 1
      ? first.applicant_name || "Candidate"
      : `${first.applicant_name || "Candidate"} +${appCount - 1} more`;

  return (
    <li
      className={`p-4 sm:p-5 transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
        isToday ? "bg-indigo-50/30 dark:bg-indigo-950/10" : ""
      }`}
    >
      <div className="flex items-start gap-4 min-w-0">
        {/* Date block */}
        <div
          className={`w-14 shrink-0 rounded-xl border text-center overflow-hidden ${
            isToday ? "border-indigo-300 dark:border-indigo-800" : "border-zinc-200 dark:border-zinc-800"
          }`}
        >
          <div
            className={`text-[10px] font-bold uppercase tracking-wider py-0.5 ${
              isToday ? "bg-indigo-600 text-white" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500"
            }`}
          >
            {date.month}
          </div>
          <div className="text-lg font-bold leading-tight pt-0.5 text-zinc-900 dark:text-zinc-100">{date.day}</div>
          <div className="text-[10px] text-zinc-400 pb-1">{date.weekday}</div>
        </div>

        {/* Candidate avatar(s) */}
        <AvatarStack apps={applications} />

        {/* Main info */}
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{title}</h4>
            {overdue ? (
              <Badge
                variant="outline"
                className="text-[11px] font-semibold px-2 py-0 rounded-full gap-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50"
              >
                <AlertCircle className="h-3 w-3" />
                Awaiting feedback
              </Badge>
            ) : (
              <InterviewStatusBadge
                status={item.interview_status}
                scheduledAt={item.scheduled_at}
                durationMinutes={item.duration_minutes}
              />
            )}
            {relative && (
              <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0 rounded-full text-zinc-500">
                {relative}
              </Badge>
            )}
          </div>

          <p className="text-sm md:text-xs text-zinc-500 truncate">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{roleText}</span>
            {appCount > 1 && <span> · {appCount} candidates in this batch</span>}
          </p>

          <div className="flex items-center gap-x-4 gap-y-1 text-sm md:text-xs text-zinc-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-indigo-500" />
              {formatInterviewTime(item.scheduled_at)} · {item.duration_minutes ?? 60} min
            </span>
            <span className="flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
              {isOnline ? (
                <Video className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <MapPin className="h-3.5 w-3.5 text-amber-500" />
              )}
              {formatLabel(item.interview_format)}
            </span>
            {screeningTotal > 0 && (
              <span className="flex items-center gap-1">
                <FileQuestion className="h-3.5 w-3.5 text-zinc-400" />
                {screeningTotal} screening answer{screeningTotal !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap lg:justify-end shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDetails(item)}
          className="h-8 max-md:min-h-10 text-sm md:text-xs rounded-lg gap-1.5 font-semibold"
        >
          <Eye className="h-3.5 w-3.5 text-zinc-500" />
          View details
        </Button>

        {active && (
          <Button
            size="sm"
            onClick={() => onOpenEvaluation(item)}
            className={`h-8 max-md:min-h-10 text-sm md:text-xs rounded-lg gap-1.5 text-white border-0 font-semibold ${
              overdue
                ? "bg-[#14a800] hover:bg-[#118f00]"
                : "bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Record feedback
          </Button>
        )}

        {completed && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenEvaluation(item)}
            className="h-8 max-md:min-h-10 text-sm md:text-xs rounded-lg gap-1.5 text-emerald-600 border-emerald-200 dark:border-emerald-900/50 font-semibold"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            View feedback
          </Button>
        )}

        {active && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="More actions"
                className="h-8 w-8 max-md:size-10 p-0 rounded-lg text-zinc-500"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onReschedule(item)} className="gap-2 text-sm md:text-xs">
                <RefreshCw className="h-3.5 w-3.5 text-sky-500" />
                Reschedule
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onOpenCancelModal(item)}
                className="gap-2 text-sm md:text-xs text-rose-600 dark:text-rose-400 focus:text-rose-600"
              >
                <XCircle className="h-3.5 w-3.5" />
                Cancel interview
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
}

export default function InterviewList({
  interviews,
  onViewDetails,
  onOpenEvaluation,
  onReschedule,
  onOpenCancelModal,
}: InterviewListProps) {
  const groups = useMemo(() => {
    const todayStart = dayStart(new Date());
    const buckets: Record<GroupKey, Interview[]> = { today: [], upcoming: [], past: [] };
    interviews.forEach((i) => buckets[groupOf(i, todayStart)].push(i));

    const time = (i: Interview) => parseScheduled(i.scheduled_at)?.getTime() ?? 0;
    buckets.today.sort((a, b) => time(a) - time(b));
    buckets.upcoming.sort((a, b) => time(a) - time(b));
    buckets.past.sort((a, b) => time(b) - time(a));

    return (["today", "upcoming", "past"] as GroupKey[])
      .filter((k) => buckets[k].length > 0)
      .map((k) => ({ key: k, items: buckets[k] }));
  }, [interviews]);

  if (interviews.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
          <Calendar className="h-6 w-6 text-zinc-400" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No interviews match your filters</h3>
        <p className="text-sm md:text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
          Try a different status or search term, or schedule a new interview.
        </p>
      </div>
    );
  }

  return (
    <div>
      {groups.map(({ key, items }) => (
        <section key={key} aria-label={GROUP_META[key].label}>
          <div className="flex items-baseline gap-2 px-5 py-2 bg-zinc-50/80 dark:bg-zinc-900/50 border-y border-zinc-100 dark:border-zinc-800 first:border-t-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
              {GROUP_META[key].label}
            </h3>
            <span className="text-xs text-zinc-400">
              {items.length} · {GROUP_META[key].hint}
            </span>
          </div>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {items.map((item) => (
              <InterviewRow
                key={item.interview_id}
                item={item}
                onViewDetails={onViewDetails}
                onOpenEvaluation={onOpenEvaluation}
                onReschedule={onReschedule}
                onOpenCancelModal={onOpenCancelModal}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
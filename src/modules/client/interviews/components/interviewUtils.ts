// src/modules/client/interviews/components/interviewUtils.ts
import { Interview } from "../types";

type InterviewApp = NonNullable<Interview["applications"]>[number];

export const ACTIVE_STATUSES = ["SCHEDULED", "CONFIRMED", "RESCHEDULED"] as const;

export function isActiveInterview(interview: Interview): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(interview.interview_status);
}

/** Returns true if an active interview has passed its scheduled end time. */
export function isInterviewConcluded(
  status?: string | null,
  scheduledAt?: string | null,
  durationMinutes: number = 60
): boolean {
  if (!status) return false;
  const upper = status.toUpperCase();
  if (!ACTIVE_STATUSES.includes(upper as (typeof ACTIVE_STATUSES)[number])) {
    return false;
  }
  const d = parseScheduled(scheduledAt);
  if (!d) return false;
  const end = d.getTime() + durationMinutes * 60_000;
  return end <= Date.now();
}

/** scheduled_at may arrive as "YYYY-MM-DD HH:mm:ss"; normalise so every browser parses it. */
export function parseScheduled(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

export function formatInterviewDate(value?: string | null, long = false): string {
  const d = parseScheduled(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-PH", {
    weekday: long ? "long" : "short",
    month: long ? "long" : "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatInterviewTime(value?: string | null): string {
  const d = parseScheduled(value);
  if (!d) return "—";
  return d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function dateBlockParts(value?: string | null) {
  const d = parseScheduled(value);
  if (!d) return { month: "—", day: "–", weekday: "" };
  return {
    month: d.toLocaleDateString("en-PH", { month: "short" }),
    day: String(d.getDate()),
    weekday: d.toLocaleDateString("en-PH", { weekday: "short" }),
  };
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today", "Tomorrow", "Yesterday", "In 3 days", "5 days ago" */
export function relativeDayLabel(value?: string | null): string | null {
  const d = parseScheduled(value);
  if (!d) return null;
  const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff <= 14) return `In ${diff} days`;
  if (diff < -1 && diff >= -14) return `${Math.abs(diff)} days ago`;
  return null;
}

/** An active interview whose time has passed and still has no feedback recorded. */
export function needsFeedback(interview: Interview): boolean {
  const d = parseScheduled(interview.scheduled_at);
  if (!d || !isActiveInterview(interview)) return false;
  const end = d.getTime() + (interview.duration_minutes ?? 60) * 60_000;
  return end < Date.now();
}

export function normalizeLink(link: string): string {
  return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}

export function screeningCount(app: InterviewApp): number {
  return app.screening_answers?.length ?? 0;
}

export function totalScreeningCount(interview: Interview): number {
  return (interview.applications ?? []).reduce((sum, a) => sum + screeningCount(a), 0);
}

export function attendanceMeta(status?: string | null) {
  switch (status) {
    case "ATTENDED":
      return {
        label: "Attended",
        className:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
      };
    case "NO_SHOW":
      return {
        label: "No show",
        className:
          "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50",
      };
    default:
      return {
        label: "Awaiting attendance",
        className:
          "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800",
      };
  }
}

export function formatLabel(format?: string | null): string {
  if (!format) return "—";
  return format.charAt(0) + format.slice(1).toLowerCase();
}

/** Short candidate summary: "Laplace Dummy", "Laplace Dummy +2 more". */
export function candidateSummary(interview: Interview): { title: string; subtitle: string } {
  const apps = interview.applications ?? [];
  if (apps.length === 0) return { title: "Open interview slot", subtitle: "No candidates assigned" };

  const first = apps[0].applicant_name || "Candidate";
  const title = apps.length === 1 ? first : `${first} +${apps.length - 1} more`;

  const jobs = Array.from(new Set(apps.map((a) => a.job_title).filter(Boolean)));
  const subtitle =
    jobs.length === 0 ? "Position not specified" : jobs.length === 1 ? jobs[0]! : `${jobs.length} different roles`;

  return { title, subtitle };
}

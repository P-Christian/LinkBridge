// src/modules/client/notifications/utils/notificationVisuals.ts
//
// Shared helpers used by the feed, the list, the item and the bell dropdown,
// so icons, labels, relative times and category matching stay consistent.

import {
  Bell,
  Briefcase,
  Calendar,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  ClipboardList,
  FileText,
  FileX,
  MessageSquare,
  Send,
  Sparkles,
  UserCheck,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Notification } from "../types";

/* ── Visuals ─────────────────────────────────────────────────────── */

export interface NotificationVisual {
  icon: LucideIcon;
  /** Short label shown as a chip under the message */
  label: string;
  /** Classes for the round icon badge */
  badge: string;
  /** Text colour matching the badge tone */
  text: string;
}

const TONES = {
  emerald: {
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  rose: {
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    text: "text-rose-600 dark:text-rose-400",
  },
  amber: {
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
  },
  sky: {
    badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    text: "text-sky-600 dark:text-sky-400",
  },
  indigo: {
    badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  violet: {
    badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    text: "text-violet-600 dark:text-violet-400",
  },
  primary: {
    badge: "bg-primary/10 text-primary border-primary/20",
    text: "text-primary",
  },
  muted: {
    badge: "bg-muted text-muted-foreground border-border",
    text: "text-muted-foreground",
  },
} as const;

type Tone = keyof typeof TONES;

function visual(icon: LucideIcon, label: string, tone: Tone): NotificationVisual {
  return { icon, label, ...TONES[tone] };
}

export type NotificationKind =
  | "shortlist"
  | "closed"
  | "interview"
  | "application"
  | "assessment"
  | "message"
  | "invitation"
  | "job"
  | "team"
  | "product"
  | "marketing"
  | "default";

// Order matters: the first rule that matches wins.
const RULES: { kind: NotificationKind; keys: string[]; text: string[] }[] = [
  { kind: "shortlist", keys: ["SHORTLIST"], text: ["shortlist", "hired"] },
  { kind: "closed", keys: ["WITHDRAW", "REJECT"], text: ["withdr", "reject"] },
  { kind: "interview", keys: ["INTERVIEW"], text: ["interview"] },
  { kind: "assessment", keys: ["ASSESSMENT"], text: ["assessment"] },
  { kind: "application", keys: ["APPLICATION"], text: ["application"] },
  { kind: "message", keys: ["MESSAGE"], text: ["message"] },
  { kind: "invitation", keys: ["INVITATION"], text: ["invitation", "invite"] },
  { kind: "job", keys: ["JOB"], text: ["job"] },
  { kind: "team", keys: ["TEAM"], text: ["team"] },
  { kind: "product", keys: ["PRODUCT"], text: [] },
  { kind: "marketing", keys: ["MARKETING"], text: [] },
];

/**
 * Classifies a notification from its structured fields first, then the title,
 * and only then the message body, so a message that merely mentions
 * "application" can't override a clearly typed interview notification.
 */
function getNotificationKind(notification: Notification): NotificationKind {
  const category = (notification.category || "").toUpperCase();
  const eventType = (notification.event_type || "").toUpperCase();
  const key = `${category} ${eventType}`;
  const title = (notification.title || "").toLowerCase();
  const message = (notification.message || "").toLowerCase();

  const byKey = RULES.find((r) => r.keys.some((k) => key.includes(k)));
  const byTitle = byKey ? undefined : RULES.find((r) => r.text.some((t) => title.includes(t)));

  let kind: NotificationKind = byKey?.kind ?? byTitle?.kind ?? "default";
  if (kind === "default") {
    if (message.includes("shortlist")) kind = "shortlist";
    else if (message.includes("application")) kind = "application";
  }

  return kind;
}

/** Picks an icon, label and colour for a notification. */
export function getNotificationVisual(notification: Notification): NotificationVisual {
  const category = (notification.category || "").toUpperCase();
  const eventType = (notification.event_type || "").toUpperCase();
  const key = `${category} ${eventType}`;
  const title = (notification.title || "").toLowerCase();

  const kind = getNotificationKind(notification);

  switch (kind) {
    case "shortlist":
      return visual(UserCheck, "Shortlisted", "emerald");
    case "closed":
      return visual(FileX, "Application update", "rose");
    case "interview":
      if (key.includes("CANCEL") || title.includes("cancel")) {
        return visual(CalendarX, "Interview cancelled", "rose");
      }
      if (key.includes("RESCHEDULE") || title.includes("resched")) {
        return visual(CalendarClock, "Rescheduled", "amber");
      }
      return visual(Calendar, "Interview", "amber");
    case "application":
      return visual(FileText, "Application", "primary");
    case "assessment":
      return visual(ClipboardList, "Assessment", "primary");
    case "message":
      return visual(MessageSquare, "Message", "sky");
    case "invitation":
      return visual(Send, "Invitation", "indigo");
    case "job":
      if (
        key.includes("JOB_APPROVED") ||
        title.includes("job approved") ||
        title.includes("posting approved")
      ) {
        return visual(CheckCircle2, "Job approved", "emerald");
      }
      return visual(Briefcase, "Job", "emerald");
    case "team":
      return visual(Users, "Team", "indigo");
    case "product":
      return visual(Zap, "Product update", "violet");
    case "marketing":
      return visual(Sparkles, "News", "violet");
    default:
      return visual(Bell, "Update", "muted");
  }
}

/* ── Time ────────────────────────────────────────────────────────── */

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

/** Full timestamp for tooltips, e.g. "Oct 14, 2026, 4:05 PM" */
export function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}
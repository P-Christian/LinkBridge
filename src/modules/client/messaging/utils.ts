// src/modules/client/messaging/utils.ts

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Parses "YYYY-MM-DD HH:mm:ss" (or ISO-ish) strings as LOCAL time.
 * Same behaviour as the previous per-file copies: any "T" / "Z" is stripped.
 */
export function parseDate(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date(0);
  const clean = String(dateStr).replace("T", " ").replace("Z", "").trim();
  const [datePart = "", timePart = "00:00:00"] = clean.split(" ");
  const [year = 1970, month = 1, day = 1] = datePart
    .split("-")
    .map((n) => parseInt(n, 10) || 0);
  const time = timePart.split(".")[0] || "00:00:00";
  const [hour = 0, minute = 0, second = 0] = time
    .split(":")
    .map((n) => parseInt(n, 10) || 0);
  return new Date(year, (month || 1) - 1, day || 1, hour, minute, second);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Whole calendar days between `date` and today (0 = today, 1 = yesterday). */
export function daysAgo(date: Date, now: Date = new Date()): number {
  return Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);
}

export function formatClock(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
}

/** Conversation list: "4:17 PM", "Yesterday", "Tue", "Aug 14", "Aug 14, 2025" */
export function formatListTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = parseDate(dateStr);
  if (isNaN(date.getTime())) return "";

  const diff = daysAgo(date);
  if (diff <= 0) return formatClock(date);
  if (diff === 1) return "Yesterday";
  if (diff < 7) return WEEKDAYS[date.getDay()];

  const base = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === new Date().getFullYear()
    ? base
    : `${base}, ${date.getFullYear()}`;
}

/** Under a message: "4:17 PM", "Yesterday, 4:17 PM", "Aug 14, 4:17 PM" */
export function formatMessageTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = parseDate(dateStr);
  if (isNaN(date.getTime())) return "";

  const diff = daysAgo(date);
  const clock = formatClock(date);
  if (diff <= 0) return clock;
  if (diff === 1) return `Yesterday, ${clock}`;

  const base = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === new Date().getFullYear()
    ? `${base}, ${clock}`
    : `${base}, ${date.getFullYear()}, ${clock}`;
}

/** Tooltip text: "Aug 14, 2026, 4:17 PM" */
export function formatFullDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = parseDate(dateStr);
  if (isNaN(date.getTime())) return "";
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}, ${formatClock(date)}`;
}

/** Divider label: "Today", "Yesterday", "August 14, 2026" */
export function formatDayLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = parseDate(dateStr);
  if (isNaN(date.getTime())) return "";

  const diff = daysAgo(date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Separator label: "Today, 9:20 AM", "Yesterday, 9:20 AM", "Aug 14, 2026, 9:20 AM" */
export function formatSeparatorLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = parseDate(dateStr);
  if (isNaN(date.getTime())) return "";

  const diff = daysAgo(date);
  const time = formatClock(date);
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;

  const currentYear = new Date().getFullYear();
  const base = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === currentYear
    ? `${base}, ${time}`
    : `${base}, ${date.getFullYear()}, ${time}`;
}

export function isSameDay(a: string, b: string): boolean {
  if (!a || !b) return false;
  const dateA = parseDate(a);
  const dateB = parseDate(b);
  if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return false;
  return startOfDay(dateA).getTime() === startOfDay(dateB).getTime();
}

export function minutesBetween(a: string, b: string): number {
  return Math.abs(parseDate(a).getTime() - parseDate(b).getTime()) / 60_000;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

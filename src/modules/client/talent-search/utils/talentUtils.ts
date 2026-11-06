import { formatAssetUrl } from "@/lib/utils";
import { TalentFilters } from "../types";

/**
 * Resolves proxied asset URL for image values
 */
export function getImageUrl(value: string | null | undefined): string {
  return formatAssetUrl(value) || "";
}
/**
 * Format experience duration
 */
export function formatExperienceYears(years: number): string {
  if (years === 0) return "No experience listed";
  if (years < 1) return `${Math.round(years * 12)} months`;
  const wholeYears = Math.floor(years);
  const months = Math.round((years - wholeYears) * 12);
  if (months === 0) return `${wholeYears} yr${wholeYears !== 1 ? "s" : ""}`;
  return `${wholeYears} yr${wholeYears !== 1 ? "s" : ""} ${months} mo`;
}

/**
 * Format a date range (e.g. "Jan 2022 – Present")
 */
export function formatDateRange(startDate: string | null, endDate: string | null, isCurrent: boolean): string {
  const format = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const start = startDate ? format(startDate) : "—";
  const end = isCurrent ? "Present" : endDate ? format(endDate) : "—";
  return `${start} – ${end}`;
}

/**
 * Truncate text to a max length with ellipsis
 */
export function truncate(text: string | null | undefined, maxLen: number): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

/**
 * Get initials from name (up to 2 chars)
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Match score badge color class
 */
export function matchScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "";
  if (score >= 85) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  if (score >= 70) return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
  if (score >= 50) return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  return "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30";
}

/**
 * Platform icon name to emoji map (for social links)
 */
export const PLATFORM_ICONS: Record<string, string> = {
  linkedin: "🔗",
  github: "💻",
  portfolio: "🌐",
  website: "🌐",
  twitter: "🐦",
  facebook: "📘",
  instagram: "📸",
  youtube: "▶️",
  behance: "🎨",
  dribbble: "🎯",
  default: "🔗",
};

export function getPlatformIcon(platform: string): string {
  const key = platform.toLowerCase();
  for (const [k, v] of Object.entries(PLATFORM_ICONS)) {
    if (key.includes(k)) return v;
  }
  return PLATFORM_ICONS.default;
}

/**
 * Builds URLSearchParams for talent search. Multi-value filters are sent as
 * repeated params so values may themselves contain commas.
 */
export function buildTalentSearchParams(
  filters: TalentFilters,
  page: number,
  limit: number,
  jobId?: string
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.keyword) params.set("keyword", filters.keyword);
  for (const skill of filters.skills) params.append("skills", skill);
  for (const location of filters.locations) params.append("location", location);
  for (const school of filters.schools) {
    params.append("school_id", school.id !== null ? String(school.id) : school.name);
  }
  const expLevels = (filters.experience_levels && filters.experience_levels.length > 0)
    ? filters.experience_levels
    : filters.experience_level ? [filters.experience_level] : [];
  for (const level of expLevels) {
    params.append("experience_level", level);
  }
  for (const ws of filters.work_setups ?? []) {
    params.append("work_setup", ws);
  }
  if (jobId) params.set("job_id", jobId);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return params;
}

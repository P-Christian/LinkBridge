import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * cn()
 * Standard shadcn helper: merges conditional classnames + tailwind conflict resolution.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Date helpers
 */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getPHTimeString(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
}

/**
 * An absolute instant (ISO string, epoch ms, or Date) expressed as the Manila
 * wall clock that vs_* datetime columns store. Slicing an ISO string instead
 * keeps UTC digits in a +08:00 column, eight hours early for every reader that
 * assumes the column is Manila time. Returns null when the input is not a date.
 */
export function toPHWallClock(value: string | number | Date): string | null {
  const ms =
    value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
}

/**
 * vs_* datetimes are Manila wall clocks with no offset; unparseable input
 * returns the raw value so one bad row cannot blank the table.
 */
export function formatWallClock(value: string | null | undefined, locale: string = "en-PH"): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDateLong(d: Date, locale: string = "en-PH"): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(d);
}

export function formatDateTime(d: Date, locale: string = "en-PH"): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function isValidDate(val: unknown): val is Date {
  return val instanceof Date && !Number.isNaN(val.getTime());
}

/**
 * Formatting helpers
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = "PHP",
  locale: string = "en-PH"
): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : (amount as number);
  const safeValue = (value === null || value === undefined || isNaN(value) || !Number.isFinite(value)) ? 0 : value;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(safeValue);
}

export function formatNumber(
  value: number,
  locale: string = "en-PH",
  maximumFractionDigits: number = 2
): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(safe);
}

export function titleCase(input: string): string {
  return input
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Normalizes raw Directus asset IDs, full Directus asset URLs (e.g. http://host:port/assets/UUID),
 * and /assets/ paths into the application's internal proxied /api/assets/[id] endpoint.
 */
export function formatAssetUrl(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl || !pathOrUrl.trim()) return null;
  const trimmed = pathOrUrl.trim();

  // Already proxied via an internal asset endpoint
  if (
    trimmed.startsWith("/api/assets/") ||
    trimmed.startsWith("/api/client/assets/") ||
    trimmed.startsWith("/api/freelancer/assets/") 
  ) {
    return trimmed;
  }

  // Data URIs should remain intact
  if (trimmed.startsWith("data:")) {
    return trimmed;
  }

  // Matches full Directus URL (e.g. http://host:8056/assets/UUID) or relative path /assets/UUID
  const assetsMatch = trimmed.match(/\/assets\/([^/?#]+)(\?[^#]*)?(#.*)?$/u);
  if (assetsMatch?.[1]) {
    const fileId = assetsMatch[1];
    const query = assetsMatch[2] || "";
    return `/api/assets/${fileId}${query}`;
  }

  // External third-party URLs (e.g. Google OAuth avatars, external CDNs) without /assets/
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Raw file ID or UUID, optionally with query string
  const [basePart, ...queryParts] = trimmed.split("?");
  const query = queryParts.length > 0 ? `?${queryParts.join("?")}` : "";
  return `/api/assets/${encodeURIComponent(basePart)}${query}`;
}

/**
 * Safe clipboard copy with fallback for non-secure contexts (HTTP, LAN IPs, older browsers)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined" || !text) return false;

  // 1. Try modern Async Clipboard API if supported and in secure context
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy fallback if writeText fails or is blocked
    }
  }

  // 2. Fallback for non-secure contexts (HTTP / LAN IPs) using temporary textarea
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.opacity = "0";
    textarea.setAttribute("readonly", "");
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textarea);
    return successful;
  } catch {
    return false;
  }
}

/**
 * RFC4122 v4 compliant UUID generator with fallback for non-secure contexts (HTTP, LAN IPs, older browsers)
 */
export function generateUUID(): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Normalizes raw job type database enums (e.g. FULL_TIME, PART_TIME) into human-readable labels.
 */
export function formatJobType(type?: string | null): string {
  if (!type) return "";
  const normalized = type.trim().toUpperCase();
  const mapping: Record<string, string> = {
    FULL_TIME: "Full-Time",
    PART_TIME: "Part-Time",
    CONTRACT: "Contract",
    FREELANCE: "Freelance",
    INTERNSHIP: "Internship",
    TEMPORARY: "Temporary",
    COMMISSION: "Commission",
  };
  if (mapping[normalized]) return mapping[normalized];
  return type
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

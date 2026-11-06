// src/modules/client/jobs/job-helpers.ts
//
// Shared by JobCard, JobList controls and JobDetailSheet.
// I only had the sheet's code, so a few fields (department, category, applicant count,
// posted date) are read through getJobMeta() with several candidate key names.
// If your API uses different names, edit the key lists in getJobMeta(): that's the only place.

type Loose = Record<string, unknown>;

function pick(obj: object, keys: string[]): unknown {
  const o = obj as Loose;
  for (const key of keys) {
    const v = o[key];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function asText(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && "name" in (v as Loose)) return String((v as Loose).name ?? "");
  return "";
}

export interface JobMeta {
  department: string;
  category: string;
  arrangement: string;
  applicantCount: number | null;
  activeApplicantCount: number | null;
  postedAt: string;
}

export function getJobMeta(job: object): JobMeta {
  const rawCount = pick(job, [
    "applicant_count",
    "applicants_count",
    "total_applicants",
    "applications_count",
  ]);
  const count = rawCount === undefined ? NaN : Number(rawCount);

  const rawActiveCount = pick(job, [
    "active_applicant_count",
    "active_applicants_count",
    "pending_applicants_count",
  ]);
  const activeCount = rawActiveCount === undefined ? NaN : Number(rawActiveCount);

  return {
    department: asText(pick(job, ["department", "job_department"])),
    category: asText(pick(job, ["category", "job_category", "category_name"])),
    arrangement: asText(pick(job, ["work_arrangement", "work_setup", "job_setup"])),
    applicantCount: Number.isFinite(count) ? count : null,
    activeApplicantCount: Number.isFinite(activeCount) ? activeCount : null,
    postedAt: asText(pick(job, ["created_at", "posted_at", "date_posted"])),
  };
}

// ─── Status ───────────────────────────────────────────────────────────────────

export const JOB_STATUSES = ["ACTIVE", "DRAFT", "CLOSED"] as const;

interface StatusStyle {
  label: string;
  dot: string; // small colored dot
  bar: string; // card left accent
  badge: string; // pill (used for non-active statuses)
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  ACTIVE: {
    label: "Active",
    dot: "bg-emerald-500",
    bar: "border-l-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  DRAFT: {
    label: "Draft",
    dot: "bg-amber-500",
    bar: "border-l-amber-400",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
  CLOSED: {
    label: "Closed",
    dot: "bg-zinc-400",
    bar: "border-l-zinc-300 dark:border-l-zinc-600",
    badge: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  },
};

export function getStatusStyle(status: string): StatusStyle {
  return (
    STATUS_STYLES[status] ?? {
      label: status,
      dot: "bg-zinc-400",
      bar: "border-l-zinc-300",
      badge: "bg-zinc-100 text-zinc-600",
    }
  );
}

// ─── Formatting ───────────────────────────────────────────────────────────────

interface SalaryFields {
  salary_negotiable?: boolean | number | null;
  currency?: string | null;
  salary_type?: string | null;
  salary_min?: number | string | null;
  salary_max?: number | string | null;
}

export function formatSalary(job: SalaryFields): string {
  if (job.salary_negotiable) return "Negotiable";
  const currency = job.currency ?? "PHP";
  const min = job.salary_min ? Number(job.salary_min) : 0;
  const max = job.salary_max ? Number(job.salary_max) : 0;

  if (job.salary_type === "Fixed Salary" && min) return `${currency} ${min.toLocaleString()} / mo`;
  if (min && max) return `${currency} ${min.toLocaleString()} – ${max.toLocaleString()} / mo`;
  if (min) return `${currency} ${min.toLocaleString()}+ / mo`;
  return "Salary not disclosed";
}

/** "3 Manuel L Quezon National Highway, San Miguel, Cordova, 6017 Cebu, Philippines" → "Cordova, Cebu" */
export function shortLocation(location: string | null | undefined): string {
  if (!location) return "";
  const parts = location
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 2) return parts.join(", ");
  if (/^philippines$/i.test(parts[parts.length - 1])) parts.pop();
  return parts
    .slice(-2)
    .map((p) => p.replace(/^\d{4,}\s*/, ""))
    .join(", ");
}

/**
 * A single clean line for one of the employer's own address fields. Employers routinely
 * paste several branches into one field, so only the first entry is kept.
 */
function firstAddressEntry(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .split(/[\n\r;]+/)
    .map((p) => p.trim())
    .filter(Boolean)[0] ?? "";
}

const hasToken = (haystack: string, needle: string) =>
  new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(haystack);

/**
 * Builds one corporate headquarters line from the structured company fields.
 * A street address that already carries a postal code or country is treated as
 * complete, because the separate city/province columns are often stale and would
 * otherwise append a second, conflicting region.
 */
export function companyHeadquarters(
  address: string | null | undefined,
  city: string | null | undefined,
  province: string | null | undefined
): string {
  const street = firstAddressEntry(address);
  if (!street) return "";

  const parts = street.split(",").map((p) => p.trim()).filter(Boolean);
  const country = /^philippines$/i.test(parts[parts.length - 1] ?? "") ? parts.pop()! : "";
  const written = parts.join(", ");

  const hasPostalCode = parts.some((p) => /\b\d{4}\b/.test(p));
  const selfContained = hasPostalCode || (!!country && parts.length >= 3);
  if (selfContained) return [...parts, country].filter(Boolean).join(", ");

  const tail: string[] = [];
  for (const part of [firstAddressEntry(city), firstAddressEntry(province)]) {
    if (!part || hasToken(written, part) || tail.some((t) => hasToken(t, part))) continue;
    tail.push(part);
  }

  return [...parts, ...tail, country].filter(Boolean).join(", ");
}

export function pluralizeApplicants(count: number): string {
  return `${count} ${count === 1 ? "applicant" : "applicants"}`;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function formatPosted(value: string): string {
  if (!value) return "";
  const date = new Date(value.replace(" ", "T"));
  if (isNaN(date.getTime())) return "";

  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 7) return `Posted ${days} days ago`;

  const label = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
  });
  return `Posted ${label}`;
}

export const applicantsHref = (jobId: number) => `/linkbridge/client/applicants?job_id=${jobId}`;

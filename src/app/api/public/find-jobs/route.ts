import { NextRequest, NextResponse } from "next/server";
import type { PublicJobPosting, PopularPreset } from "@/modules/public/find-jobs/types";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getDirectusHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

function normalizeString(val: string): string {
  return val
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
}

function formatJobType(val: string): string {
  const norm = normalizeString(val);
  if (norm === "full time" || norm === "fulltime") return "Full Time";
  if (norm === "part time" || norm === "parttime") return "Part Time";
  if (norm === "freelance") return "Freelance";
  if (norm === "contract") return "Contract";
  if (norm === "internship") return "Internship";
  return val.replace(/[_-]+/g, " ");
}

function formatWorkSetup(val: string): string {
  const norm = normalizeString(val);
  if (norm.includes("remote")) return "Remote";
  if (norm.includes("hybrid")) return "Hybrid";
  if (norm.includes("site") || norm.includes("office")) return "On-site";
  return val.replace(/[_-]+/g, " ");
}

const EXCLUDED_WORK_SETUPS = new Set(["on-site", "onsite", "all"]);
const EXCLUDED_JOB_TYPES = new Set(["full time", "fulltime", "all"]);
// Work setup or employment type only qualifies if active listings reach a major volume (50+)
const MIN_METADATA_JOB_THRESHOLD = 50;

function isGenericRoleOrCategory(str: string): boolean {
  const norm = str.trim().toLowerCase();
  return (
    !norm ||
    norm === "other" ||
    norm === "unassigned" ||
    norm === "general" ||
    norm === "none" ||
    norm === "n/a" ||
    norm === "all"
  );
}

export function computePopularPresets(rawJobs: Record<string, unknown>[]): PopularPreset[] {
  if (!Array.isArray(rawJobs) || rawJobs.length === 0) {
    return [];
  }

  const setupCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  const roleCounts = new Map<string, number>();

  for (const j of rawJobs) {
    // 1. Work setup (strictly exclude On-site and All)
    const rawSetup = String(j.work_arrangement || j.work_setup || "").trim();
    if (rawSetup) {
      const formatted = formatWorkSetup(rawSetup);
      if (formatted && !EXCLUDED_WORK_SETUPS.has(formatted.toLowerCase())) {
        setupCounts.set(formatted, (setupCounts.get(formatted) || 0) + 1);
      }
    }

    // 2. Job type (strictly exclude Full Time and All)
    const rawType = String(j.job_type || "").trim();
    if (rawType) {
      const formatted = formatJobType(rawType);
      if (formatted && !EXCLUDED_JOB_TYPES.has(formatted.toLowerCase())) {
        typeCounts.set(formatted, (typeCounts.get(formatted) || 0) + 1);
      }
    }

    // 3. Category / Role
    const category = String(j.job_category || "").trim();
    const title = String(j.job_title || "").trim();
    if (category && !isGenericRoleOrCategory(category)) {
      roleCounts.set(category, (roleCounts.get(category) || 0) + 1);
    } else if (title && !isGenericRoleOrCategory(title)) {
      roleCounts.set(title, (roleCounts.get(title) || 0) + 1);
    }
  }

  const presets: PopularPreset[] = [];
  const seenLabels = new Set<string>();

  // Work Setup: ONLY included if job count reaches significant volume (>= 50 active listings)
  const sortedSetups = Array.from(setupCounts.entries()).sort((a, b) => b[1] - a[1]);
  if (sortedSetups.length > 0 && sortedSetups[0][1] >= MIN_METADATA_JOB_THRESHOLD) {
    const label = sortedSetups[0][0];
    presets.push({
      label,
      type: "work_setup",
      count: sortedSetups[0][1],
    });
    seenLabels.add(label.toLowerCase());
  }

  // Employment Type: ONLY included if job count reaches significant volume (>= 50 active listings)
  const sortedTypes = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]);
  if (sortedTypes.length > 0 && sortedTypes[0][1] >= MIN_METADATA_JOB_THRESHOLD) {
    const label = sortedTypes[0][0];
    if (!seenLabels.has(label.toLowerCase())) {
      presets.push({
        label,
        type: "job_type",
        count: sortedTypes[0][1],
      });
      seenLabels.add(label.toLowerCase());
    }
  }

  // Top Roles / Categories (fill up to 5 presets total)
  const sortedRoles = Array.from(roleCounts.entries()).sort((a, b) => b[1] - a[1]);
  for (const [role, count] of sortedRoles) {
    if (presets.length >= 5) break;
    if (count > 0 && !seenLabels.has(role.toLowerCase())) {
      presets.push({
        label: role,
        type: "keyword",
        count,
      });
      seenLabels.add(role.toLowerCase());
    }
  }

  return presets;
}

/**
 * Tokenized per-word location matching
 */
function matchesLocation(locationInput: string, targetText: string): boolean {
  if (!locationInput || !locationInput.trim()) return true;

  const rawLower = locationInput.toLowerCase().trim();
  const targetLower = targetText.toLowerCase();

  const tokens = rawLower
    .split(/[\s,.-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t !== "philippines" && t !== "ph" && t !== "city");

  if (tokens.length === 0) {
    return targetLower.includes(rawLower);
  }

  return tokens.every((token) => targetLower.includes(token));
}

/**
 * Computes relevance score strictly matching Job Title, Company Name, and Category
 * (Excludes job description to prevent false positive matches on unrelated roles)
 */
function computeRelevanceScore(
  query: string,
  jobTitle: string,
  companyName: string,
  category: string
): number {
  if (!query) return 0;

  const qLower = query.toLowerCase().trim();
  const titleLower = jobTitle.toLowerCase().trim();
  const compLower = companyName.toLowerCase().trim();
  const catLower = category.toLowerCase().trim();

  let score = 0;

  // 1. Complete exact match on Title or Company Name
  if (titleLower === qLower) score += 1000;
  if (compLower === qLower) score += 800;
  if (catLower === qLower) score += 600;

  // 2. Title / Company starts with query phrase
  if (titleLower.startsWith(qLower)) score += 500;
  if (compLower.startsWith(qLower)) score += 400;

  // 3. Title / Company contains full phrase
  if (titleLower.includes(qLower)) score += 300;
  if (compLower.includes(qLower)) score += 200;
  if (catLower.includes(qLower)) score += 150;

  // 4. Token / Word match scoring
  const tokens = qLower.split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length > 0) {
    tokens.forEach((token) => {
      if (titleLower.includes(token)) score += 60;
      if (compLower.includes(token)) score += 40;
      if (catLower.includes(token)) score += 30;
    });
  }

  return score;
}

export interface GetPublicJobsOptions {
  q?: string;
  jobType?: string;
  workSetup?: string;
  location?: string;
  jobId?: string;
  limit?: number;
  page?: number;
}

const JOB_SCAN_LIMIT = 200;
const SALARY_VISIBILITY_FIELD = "show_salary_range";
// Public projection: never select "*", so internal columns (draft status, creator id,
// moderation fields) stay inside Directus.
const PUBLIC_JOB_FIELDS = [
  "job_id",
  "company_id",
  "job_title",
  "job_category",
  "job_description",
  "job_type",
  "work_arrangement",
  "job_location",
  "salary_min",
  "salary_max",
  "currency",
  "experience_level",
  "created_at",
];

async function fetchActivePostings(fields: string): Promise<Record<string, unknown>[] | null> {
  const url = `${DIRECTUS_BASE}/items/vs_job_posting?filter[status][_eq]=ACTIVE&sort[]=-created_at&limit=${JOB_SCAN_LIMIT}&fields=${fields}`;
  const res = await fetch(url, { headers: getDirectusHeaders(), cache: "no-store" });
  if (!res.ok) return null;
  const json = await res.json();
  return (json.data || []) as Record<string, unknown>[];
}

export async function getPublicJobs(options: GetPublicJobsOptions = {}) {
  if (!DIRECTUS_BASE) {
    throw new Error("Directus API base URL not configured.");
  }

  const q = options.q?.trim().toLowerCase() || "";
  const jobType = options.jobType?.trim() || "";
  const workSetup = options.workSetup?.trim() || "";
  const location = options.location?.trim() || "";
  const jobId = options.jobId?.trim() || "";
  const limit = Math.min(Number(options.limit || 12), 50);
  const page = Math.max(Number(options.page || 1), 1);
  const offset = (page - 1) * limit;

  // ACTIVE postings only, including the retry path when the salary-visibility column is unavailable.
  let rawJobs: Record<string, unknown>[] =
    (await fetchActivePostings([...PUBLIC_JOB_FIELDS, SALARY_VISIBILITY_FIELD].join(","))) ??
    (await fetchActivePostings(PUBLIC_JOB_FIELDS.join(","))) ??
    [];

  if (jobId) {
    rawJobs = rawJobs.filter((j) => String(j.job_id || j.id) === jobId);
  }

  const popularPresets = computePopularPresets(rawJobs);

  // Fetch company details for master data lookup
  const companyIds = Array.from(new Set(rawJobs.map((j) => Number(j.company_id)).filter(Boolean)));
  const companyMap: Record<number, Record<string, unknown>> = {};

  if (companyIds.length > 0) {
    const compUrl = `${DIRECTUS_BASE}/items/vs_company?filter[company_id][_in]=${companyIds.join(",")}&fields=company_id,company_code,company_name,company_logo,company_city,company_province,company_address,verification_status&limit=${companyIds.length}`;
    const compRes = await fetch(compUrl, { headers: getDirectusHeaders(), cache: "no-store" });
    if (compRes.ok) {
      const compJson = await compRes.json();
      (compJson.data || []).forEach((c: Record<string, unknown>) => {
        companyMap[Number(c.company_id)] = c;
      });
    }
  }

  // Keyword Search with Relevance Sorting (Strictly Title, Company, and Category)
  if (q) {
    const scoredJobs = rawJobs
      .map((j) => {
        const cid = Number(j.company_id);
        const comp = companyMap[cid] || {};
        const title = String(j.job_title || "");
        const compName = String(comp.company_name || j.company_name || "");
        const category = String(j.job_category || "");

        const score = computeRelevanceScore(q, title, compName, category);
        return { job: j, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    rawJobs = scoredJobs.map((item) => item.job);
  }

  // Job Type Filter (Normalized comparison: FULL_TIME, Full-Time -> Full Time)
  if (jobType && jobType.toLowerCase() !== "all") {
    const targetTypeNorm = normalizeString(jobType);
    rawJobs = rawJobs.filter((j) => {
      const rawTypeNorm = normalizeString(String(j.job_type || ""));
      return rawTypeNorm === targetTypeNorm;
    });
  }

  // Work Setup Filter (Normalized comparison: Remote, On-site, Hybrid)
  if (workSetup && workSetup.toLowerCase() !== "all") {
    const targetSetupNorm = normalizeString(workSetup);
    rawJobs = rawJobs.filter((j) => {
      const rawSetupNorm = normalizeString(String(j.work_arrangement || j.work_setup || ""));
      return rawSetupNorm.includes(targetSetupNorm) || targetSetupNorm.includes(rawSetupNorm);
    });
  }

  // Per-Word Location Filter
  if (location) {
    rawJobs = rawJobs.filter((j) => {
      const cid = Number(j.company_id);
      const comp = companyMap[cid] || {};
      const compLoc = [comp.company_city, comp.company_province, comp.company_address].filter(Boolean).join(" ");
      const jobLoc = String(j.job_location || j.location || "");
      const fullLocationText = `${jobLoc} ${compLoc} Philippines`;
      return matchesLocation(location, fullLocationText);
    });
  }

  const totalCount = rawJobs.length;
  const paginatedJobs = rawJobs.slice(offset, offset + limit);

  // Format output with normalized strings
  const formattedJobs: PublicJobPosting[] = paginatedJobs.map((j) => {
    const cid = Number(j.company_id);
    const comp = companyMap[cid] || {};
    const logoRaw = (comp.company_logo || j.company_logo) as string | null;
    // Falsy show_salary_range means the employer did not disclose the range.
    const salaryVisible = !(
      j.show_salary_range === false || j.show_salary_range === 0 || j.show_salary_range === "0"
    );

    const logoUrl = logoRaw
      ? logoRaw.startsWith("http") || logoRaw.startsWith("/")
        ? logoRaw
        : `/api/assets/${logoRaw}`
      : null;

    const compLoc = [comp.company_city, comp.company_province].filter(Boolean).map(String).join(", ");
    const jobLoc = String(j.job_location || j.location || compLoc || "Philippines");

    return {
      job_id: Number(j.job_id || j.id),
      company_id: cid,
      company_code: (comp.company_code as string) || null,
      company_name: String(comp.company_name || j.company_name || "Hiring Organization"),
      company_logo_url: logoUrl,
      company_location: compLoc || jobLoc,
      company_verification_status: String(comp.verification_status || "VERIFIED"),

      job_title: String(j.job_title || "Open Position"),
      job_description: String(j.job_description || ""),
      job_type: formatJobType(String(j.job_type || "Full Time")),
      work_setup: formatWorkSetup(String(j.work_arrangement || j.work_setup || "On-site")),
      location: jobLoc,

      salary_min: salaryVisible && j.salary_min != null ? Number(j.salary_min) : null,
      salary_max: salaryVisible && j.salary_max != null ? Number(j.salary_max) : null,
      salary_currency: String(j.currency || j.salary_currency || "PHP"),
      show_salary_range: salaryVisible,

      experience_level: String(j.experience_level || "Not Specified"),
      created_at: String(j.created_at || j.date_created || new Date().toISOString()),
    };
  });

  return {
    data: formattedJobs,
    meta: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
      popularPresets,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const jobType = searchParams.get("job_type")?.trim() || "";
    const workSetup = searchParams.get("work_setup")?.trim() || "";
    const location = searchParams.get("location")?.trim() || "";
    const jobId = searchParams.get("job_id")?.trim() || "";
    const limit = Math.min(Number(searchParams.get("limit") || 12), 50);
    const page = Math.max(Number(searchParams.get("page") || 1), 1);

    const result = await getPublicJobs({ q, jobType, workSetup, location, jobId, limit, page });
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("GET /api/public/find-jobs error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// src/modules/vos-admin/gemini-monitoring/services/geminiMonitoring.repo.ts
// Directus repository for Gemini Monitoring dashboard.
// Aggregates raw facts from gemini_requests — never reads derived/cost fields (those don't exist in DB).
// All cost computation is done here using GEMINI_MODELS_CONFIG.

import { getModelConfig, calculateBillableCost } from "@/lib/gemini/geminiModelsConfig";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

/** PH date string YYYY-MM-DD for today in Asia/Manila (UTC+8) */
function getTodayPhDate(): string {
  const phMs = Date.now() + 8 * 3600 * 1000;
  return new Date(phMs).toISOString().slice(0, 10);
}

export interface GeminiRequestRow {
  id: string;
  request_id: string;
  user_id: number | null;
  company_id: number | null;
  provider: string;
  feature: string;
  request_type: string;
  endpoint: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  finish_reason: string | null;
  response_status: string;
  latency_ms: number;
  status: number;
  error_message: string | null;
  created_at: string;
}

export interface GeminiKPIs {
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  successCount: number;
  failedCount: number;
  timeoutCount: number;
  rateLimitCount: number;
  successRate: number;
  // Health based on recent traffic (no GCP ping)
  lastSuccessAt: string | null;
  recentSuccessRate: number;
  recentAvgLatencyMs: number;
}

export interface GeminiFeatureStat {
  feature: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  successCount: number;
  failedCount: number;
}

export interface GeminiErrorStat {
  status400: number;
  status403: number;
  status429: number;
  status500: number;
  status503: number;
  timeouts: number;
}

export interface GeminiFreeTierStatus {
  model: string;
  dailyFreeInputTokens: number;
  dailyFreeOutputTokens: number;
  todayPromptTokens: number;
  todayCompletionTokens: number;
  billableInputTokens: number;
  billableOutputTokens: number;
  estimatedCostUsd: number;
  freeTierActive: boolean;
}

export interface GeminiRateLimitStatus {
  model: string;
  rpmCurrent: number;
  rpmLimit: number;
  rpmPercent: number;
  tpmCurrent: number;
  tpmLimit: number;
  tpmPercent: number;
  rpdCurrent: number;
  rpdLimit: number;
  rpdPercent: number;
}

/** Fetch raw request rows from Directus with fallback collection names */
async function fetchDirectusRequests(queryParams: URLSearchParams): Promise<GeminiRequestRow[]> {
  if (!DIRECTUS_BASE) {
    throw new Error("Gemini telemetry could not be read: the CMS base URL is not configured.");
  }

  let res: Response;
  try {
    res = await fetch(`${DIRECTUS_BASE}/items/vs_gemini_requests?${queryParams}`, {
      headers: getHeaders(),
      cache: "no-store",
    });

    if (res.status === 404) {
      res = await fetch(`${DIRECTUS_BASE}/items/gemini_requests?${queryParams}`, {
        headers: getHeaders(),
        cache: "no-store",
      });
    }
  } catch (err) {
    throw new Error(`Gemini telemetry could not be read: ${(err as Error)?.message}`);
  }

  // Neither collection existing is a genuine "no telemetry yet". Every other
  // failure used to answer with an empty array, which the dashboard then
  // reported as zero requests, a 100% success rate and NO_DATA health.
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Gemini telemetry could not be read (${res.status}).`);
  }

  const json = await res.json().catch(() => null);
  // A 200 whose body will not parse is not "no rows" — answering [] here rendered
  // an empty dashboard with a 100% success rate.
  if (!Array.isArray(json?.data)) {
    throw new Error("Gemini telemetry could not be read: the CMS returned an unreadable response.");
  }
  return json.data as GeminiRequestRow[];
}

export interface HourlyBucket {
  hourLabel: string;
  requests: number;
  tokens: number;
  errors: number;
  avgLatencyMs: number;
}

export interface PeakUsageTrends {
  peakRpm: number;
  peakTpm: number;
  peakHourLabel: string | null;
  peakHourRequests: number;
  hourlyBuckets: HourlyBucket[];
}

/** Compute time range date boundaries in Asia/Manila (UTC+8) */
export function getTimeRangeBounds(timeRange?: string | null): { dateFrom: string; dateTo: string } | null {
  if (!timeRange || timeRange === "ALL_TIME" || timeRange === "CUSTOM") return null;

  const now = new Date(Date.now() + 8 * 3600 * 1000);
  const todayStr = now.toISOString().slice(0, 10);

  if (timeRange === "LAST_HOUR") {
    const lastHour = new Date(Date.now() + 8 * 3600 * 1000 - 60 * 60 * 1000);
    return {
      dateFrom: lastHour.toISOString().slice(0, 19),
      dateTo: now.toISOString().slice(0, 19),
    };
  }
  if (timeRange === "1_DAY" || timeRange === "TODAY") {
    return {
      dateFrom: `${todayStr}T00:00:00`,
      dateTo: `${todayStr}T23:59:59`,
    };
  }
  if (timeRange === "7_DAYS") {
    const d = new Date(Date.now() + 8 * 3600 * 1000 - 6 * 86400 * 1000);
    return {
      dateFrom: `${d.toISOString().slice(0, 10)}T00:00:00`,
      dateTo: `${todayStr}T23:59:59`,
    };
  }
  if (timeRange === "28_DAYS") {
    const d = new Date(Date.now() + 8 * 3600 * 1000 - 27 * 86400 * 1000);
    return {
      dateFrom: `${d.toISOString().slice(0, 10)}T00:00:00`,
      dateTo: `${todayStr}T23:59:59`,
    };
  }
  if (timeRange === "THIS_MONTH") {
    const firstOfMonth = `${todayStr.slice(0, 7)}-01`;
    return {
      dateFrom: `${firstOfMonth}T00:00:00`,
      dateTo: `${todayStr}T23:59:59`,
    };
  }
  if (timeRange === "90_DAYS") {
    const d = new Date(Date.now() + 8 * 3600 * 1000 - 89 * 86400 * 1000);
    return {
      dateFrom: `${d.toISOString().slice(0, 10)}T00:00:00`,
      dateTo: `${todayStr}T23:59:59`,
    };
  }

  return null;
}

/** Fetch today's raw request rows from Directus or filtered by time range / provider */
export async function fetchTelemetryRequests(options?: {
  timeRange?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  feature?: string | null;
  provider?: string | null;
  isAllTime?: boolean;
}): Promise<GeminiRequestRow[]> {
  const params = new URLSearchParams({
    limit: "-1",
    sort: "-created_at",
  });

  const rangeBounds = getTimeRangeBounds(options?.timeRange);

  if (options?.isAllTime || options?.timeRange === "ALL_TIME") {
    // No date boundary filtering for All Time
  } else if (rangeBounds) {
    params.set("filter[created_at][_gte]", rangeBounds.dateFrom);
    params.set("filter[created_at][_lte]", rangeBounds.dateTo);
  } else if (options?.dateFrom && options?.dateTo) {
    params.set("filter[created_at][_gte]", `${options.dateFrom}T00:00:00`);
    params.set("filter[created_at][_lte]", `${options.dateTo}T23:59:59`);
  } else if (options?.dateFrom) {
    params.set("filter[created_at][_gte]", `${options.dateFrom}T00:00:00`);
  } else if (options?.dateTo) {
    params.set("filter[created_at][_lte]", `${options.dateTo}T23:59:59`);
  } else {
    const today = getTodayPhDate();
    params.set("filter[created_at][_gte]", `${today}T00:00:00`);
  }

  if (options?.feature && options.feature !== "ALL") {
    params.set("filter[feature][_eq]", options.feature);
  }

  if (options?.provider && options.provider !== "ALL") {
    if (options.provider === "LOCAL_AI") {
      params.set("filter[provider][_in]", "LOCAL_AI,OLLAMA,LOCAL,VLLM");
    } else if (options.provider === "GOOGLE_GEMINI") {
      params.set("filter[provider][_in]", "GOOGLE_GEMINI,GEMINI");
    } else {
      params.set("filter[provider][_eq]", options.provider);
    }
  }

  return fetchDirectusRequests(params);
}

export async function fetchTodayRequests(): Promise<GeminiRequestRow[]> {
  return fetchTelemetryRequests();
}

/** Fetch recent N rows regardless of date (for audit log and health indicator) */
export async function fetchRecentRequests(
  limit = 25,
  options?: {
    timeRange?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    feature?: string | null;
    provider?: string | null;
    isAllTime?: boolean;
  }
): Promise<GeminiRequestRow[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    sort: "-created_at",
  });

  const rangeBounds = getTimeRangeBounds(options?.timeRange);

  if (!options?.isAllTime && options?.timeRange !== "ALL_TIME") {
    if (rangeBounds) {
      params.set("filter[created_at][_gte]", rangeBounds.dateFrom);
      params.set("filter[created_at][_lte]", rangeBounds.dateTo);
    } else {
      if (options?.dateFrom) {
        params.set("filter[created_at][_gte]", `${options.dateFrom}T00:00:00`);
      }
      if (options?.dateTo) {
        params.set("filter[created_at][_lte]", `${options.dateTo}T23:59:59`);
      }
    }
  }

  if (options?.feature && options.feature !== "ALL") {
    params.set("filter[feature][_eq]", options.feature);
  }

  if (options?.provider && options.provider !== "ALL") {
    if (options.provider === "LOCAL_AI") {
      params.set("filter[provider][_in]", "LOCAL_AI,OLLAMA,LOCAL,VLLM");
    } else if (options.provider === "GOOGLE_GEMINI") {
      params.set("filter[provider][_in]", "GOOGLE_GEMINI,GEMINI");
    } else {
      params.set("filter[provider][_eq]", options.provider);
    }
  }

  return fetchDirectusRequests(params);
}

/** Compute peak usage trends (Peak RPM, Peak TPM, Peak Busy Window & Hourly distribution) */
export function computePeakUsageTrends(rows: GeminiRequestRow[]): PeakUsageTrends {
  if (rows.length === 0) {
    const emptyBuckets: HourlyBucket[] = Array.from({ length: 24 }, (_, i) => {
      const hStr = i.toString().padStart(2, "0");
      return {
        hourLabel: `${hStr}:00`,
        requests: 0,
        tokens: 0,
        errors: 0,
        avgLatencyMs: 0,
      };
    });
    return {
      peakRpm: 0,
      peakTpm: 0,
      peakHourLabel: null,
      peakHourRequests: 0,
      hourlyBuckets: emptyBuckets,
    };
  }

  // 1. Group by 1-minute bucket to calculate Peak RPM and Peak TPM
  const minuteMap = new Map<string, { requests: number; tokens: number }>();
  for (const r of rows) {
    if (!r.created_at) continue;
    const minuteKey = r.created_at.slice(0, 16);
    const curr = minuteMap.get(minuteKey) || { requests: 0, tokens: 0 };
    curr.requests += 1;
    curr.tokens += (r.total_tokens ?? 0);
    minuteMap.set(minuteKey, curr);
  }

  let peakRpm = 0;
  let peakTpm = 0;
  for (const stat of minuteMap.values()) {
    if (stat.requests > peakRpm) peakRpm = stat.requests;
    if (stat.tokens > peakTpm) peakTpm = stat.tokens;
  }

  // 2. Group into 24-hour buckets (00:00 to 23:00)
  const hourMap = new Map<number, { requests: number; tokens: number; errors: number; latencyTotal: number }>();
  for (let i = 0; i < 24; i++) {
    hourMap.set(i, { requests: 0, tokens: 0, errors: 0, latencyTotal: 0 });
  }

  for (const r of rows) {
    if (!r.created_at) continue;
    const date = new Date(r.created_at);
    let hour = date.getHours();
    if (isNaN(hour)) {
      const match = r.created_at.match(/(\d{2}):\d{2}/);
      if (match) hour = parseInt(match[1], 10);
      else hour = 0;
    }
    const stat = hourMap.get(hour);
    if (stat) {
      stat.requests += 1;
      stat.tokens += (r.total_tokens ?? 0);
      if (r.response_status === "ERROR" || (r.status && r.status >= 400)) {
        stat.errors += 1;
      }
      stat.latencyTotal += (r.latency_ms ?? 0);
    }
  }

  let peakHour = -1;
  let peakHourRequests = 0;

  const hourlyBuckets: HourlyBucket[] = [];
  for (let i = 0; i < 24; i++) {
    const stat = hourMap.get(i)!;
    const hStr = i.toString().padStart(2, "0");
    const avgLatencyMs = stat.requests > 0 ? Math.round(stat.latencyTotal / stat.requests) : 0;
    hourlyBuckets.push({
      hourLabel: `${hStr}:00`,
      requests: stat.requests,
      tokens: stat.tokens,
      errors: stat.errors,
      avgLatencyMs,
    });

    if (stat.requests > peakHourRequests) {
      peakHourRequests = stat.requests;
      peakHour = i;
    }
  }

  let peakHourLabel: string | null = null;
  if (peakHour >= 0 && peakHourRequests > 0) {
    const startHour12 = peakHour % 12 === 0 ? 12 : peakHour % 12;
    const startAmPm = peakHour < 12 ? "AM" : "PM";
    const endHour = (peakHour + 1) % 24;
    const endHour12 = endHour % 12 === 0 ? 12 : endHour % 12;
    const endAmPm = endHour < 12 ? "AM" : "PM";
    peakHourLabel = `${startHour12}:00 ${startAmPm} - ${endHour12}:00 ${endAmPm}`;
  }

  return {
    peakRpm,
    peakTpm,
    peakHourLabel,
    peakHourRequests,
    hourlyBuckets,
  };
}

/** Compute KPI summary from today's rows + health from recent rows */
export function computeKPIs(todayRows: GeminiRequestRow[], recentRows: GeminiRequestRow[]): GeminiKPIs {
  const totalRequests = todayRows.length;
  const totalPromptTokens = todayRows.reduce((s, r) => s + (r.prompt_tokens ?? 0), 0);
  const totalCompletionTokens = todayRows.reduce((s, r) => s + (r.completion_tokens ?? 0), 0);
  const totalTokens = totalPromptTokens + totalCompletionTokens;
  const avgLatencyMs = totalRequests > 0
    ? Math.round(todayRows.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / totalRequests)
    : 0;
  const successCount = todayRows.filter((r) => r.response_status === "SUCCESS").length;
  const failedCount = todayRows.filter((r) => r.response_status === "ERROR").length;
  const timeoutCount = todayRows.filter((r) => r.response_status === "TIMEOUT").length;
  const rateLimitCount = todayRows.filter((r) => r.status === 429).length;
  const successRate = totalRequests > 0
    ? Math.round((successCount / totalRequests) * 1000) / 10
    : 100;

  // Health indicator from recent traffic — replaces GCP ping
  const last5MinMs = 5 * 60 * 1000;
  const cutoff = Date.now() - last5MinMs;
  const recent5Min = recentRows.filter((r) => new Date(r.created_at).getTime() > cutoff);
  const recentSuccessCount = recent5Min.filter((r) => r.response_status === "SUCCESS").length;
  const recentSuccessRate = recent5Min.length > 0
    ? Math.round((recentSuccessCount / recent5Min.length) * 1000) / 10
    : 100;
  const recentAvgLatencyMs = recent5Min.length > 0
    ? Math.round(recent5Min.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / recent5Min.length)
    : 0;

  const lastSuccess = recentRows.find((r) => r.response_status === "SUCCESS");
  const lastSuccessAt = lastSuccess?.created_at ?? null;

  return {
    totalRequests,
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens,
    avgLatencyMs,
    successCount,
    failedCount,
    timeoutCount,
    rateLimitCount,
    successRate,
    lastSuccessAt,
    recentSuccessRate,
    recentAvgLatencyMs,
  };
}

/** Compute per-feature breakdown from today's rows */
export function computeFeatureBreakdown(todayRows: GeminiRequestRow[]): GeminiFeatureStat[] {
  const map = new Map<string, GeminiFeatureStat>();

  for (const r of todayRows) {
    const feature = r.feature ?? "UNKNOWN";
    if (!map.has(feature)) {
      map.set(feature, {
        feature,
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        avgLatencyMs: 0,
        successCount: 0,
        failedCount: 0,
      });
    }
    const stat = map.get(feature)!;
    stat.requests++;
    stat.promptTokens += r.prompt_tokens ?? 0;
    stat.completionTokens += r.completion_tokens ?? 0;
    stat.totalTokens += r.total_tokens ?? 0;
    stat.avgLatencyMs += r.latency_ms ?? 0;
    if (r.response_status === "SUCCESS") stat.successCount++;
    else stat.failedCount++;
  }

  // Finalize avgLatencyMs
  for (const stat of map.values()) {
    if (stat.requests > 0) stat.avgLatencyMs = Math.round(stat.avgLatencyMs / stat.requests);
  }

  return Array.from(map.values());
}

/** Compute error breakdown from today's rows */
export function computeErrorBreakdown(todayRows: GeminiRequestRow[]): GeminiErrorStat {
  return {
    status400: todayRows.filter((r) => r.status === 400).length,
    status403: todayRows.filter((r) => r.status === 403).length,
    status429: todayRows.filter((r) => r.status === 429).length,
    status500: todayRows.filter((r) => r.status === 500).length,
    status503: todayRows.filter((r) => r.status === 503).length,
    timeouts: todayRows.filter((r) => r.response_status === "TIMEOUT").length,
  };
}

/** Compute free-tier status and dynamic billable cost for the configured model */
export function computeFreeTierStatus(
  todayRows: GeminiRequestRow[],
  configuredModel: string
): GeminiFreeTierStatus {
  // Filter to requests for the configured model only
  const modelRows = todayRows.filter((r) => r.model === configuredModel || r.model.includes(configuredModel));
  const todayPromptTokens = modelRows.reduce((s, r) => s + (r.prompt_tokens ?? 0), 0);
  const todayCompletionTokens = modelRows.reduce((s, r) => s + (r.completion_tokens ?? 0), 0);

  const { billableInputTokens, billableOutputTokens, estimatedCostUsd, freeTierActive } =
    calculateBillableCost(todayPromptTokens, todayCompletionTokens, configuredModel);

  const cfg = getModelConfig(configuredModel);

  return {
    model: configuredModel,
    dailyFreeInputTokens: cfg.dailyFreeInputTokens,
    dailyFreeOutputTokens: cfg.dailyFreeOutputTokens,
    todayPromptTokens,
    todayCompletionTokens,
    billableInputTokens,
    billableOutputTokens,
    estimatedCostUsd,
    freeTierActive,
  };
}

/** Compute live rate limit quota utilization (RPM, TPM, RPD) for the model */
export function computeRateLimitStatus(
  recentRows: GeminiRequestRow[],
  todayRows: GeminiRequestRow[],
  configuredModel: string
): GeminiRateLimitStatus {
  const cfg = getModelConfig(configuredModel);
  const nowMs = Date.now();
  const last60sCutoff = nowMs - 60 * 1000;

  // Requests in the last 60 seconds
  const last60sRows = recentRows.filter((r) => new Date(r.created_at).getTime() >= last60sCutoff);

  const rpmCurrent = last60sRows.length;
  const tpmCurrent = last60sRows.reduce((s, r) => s + (r.total_tokens ?? 0), 0);
  const rpdCurrent = todayRows.length;

  const rpmLimit = cfg.rpmLimit;
  const tpmLimit = cfg.tpmLimit;
  const rpdLimit = cfg.rpdLimit;

  const rpmPercent = Math.min(100, Math.round((rpmCurrent / rpmLimit) * 100));
  const tpmPercent = Math.min(100, Math.round((tpmCurrent / tpmLimit) * 100));
  const rpdPercent = Math.min(100, Math.round((rpdCurrent / rpdLimit) * 100));

  return {
    model: configuredModel,
    rpmCurrent,
    rpmLimit,
    rpmPercent,
    tpmCurrent,
    tpmLimit,
    tpmPercent,
    rpdCurrent,
    rpdLimit,
    rpdPercent,
  };
}

/** Batch resolve user names (from vs_user) and company names (from vs_company_profile) */
export async function resolveAttributionNames(
  userIds: (number | null)[],
  companyIds: (number | null)[]
): Promise<{
  userNames: Record<number, string>;
  companyNames: Record<number, string>;
}> {
  const validUserIds = Array.from(new Set(userIds.filter((id): id is number => Boolean(id && id > 0))));
  const validCompanyIds = Array.from(new Set(companyIds.filter((id): id is number => Boolean(id && id > 0))));

  const userNames: Record<number, string> = {};
  const companyNames: Record<number, string> = {};

  if (!DIRECTUS_BASE) return { userNames, companyNames };

  const promises: Promise<void>[] = [];

  if (validUserIds.length > 0) {
    promises.push(
      (async () => {
        try {
          const userUrl = `${DIRECTUS_BASE}/items/vs_user?filter[user_id][_in]=${validUserIds.join(",")}&fields=user_id,user_fname,user_lname,user_email&limit=-1`;
          const res = await fetch(userUrl, { headers: getHeaders(), cache: "no-store" });
          if (res.ok) {
            const json = await res.json();
            for (const u of json.data || []) {
              const fullName = `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim();
              userNames[u.user_id] = fullName || u.user_email || `User #${u.user_id}`;
            }
          }
        } catch (err) {
          console.warn("[gemini-monitoring] ⚠️ Failed to resolve user names:", err);
        }
      })()
    );
  }

  if (validCompanyIds.length > 0) {
    promises.push(
      (async () => {
        try {
          const compUrl = `${DIRECTUS_BASE}/items/vs_company?filter[company_id][_in]=${validCompanyIds.join(",")}&fields=company_id,company_name&limit=-1`;
          const res = await fetch(compUrl, { headers: getHeaders(), cache: "no-store" });
          if (res.ok) {
            const json = await res.json();
            for (const c of json.data || []) {
              if (c.company_id && c.company_name) {
                companyNames[c.company_id] = c.company_name;
              }
            }
          }
        } catch (err) {
          console.warn("[gemini-monitoring] ⚠️ Failed to resolve company names:", err);
        }
      })()
    );
  }

  await Promise.all(promises);

  return { userNames, companyNames };
}

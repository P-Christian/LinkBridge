// src/app/api/vos-admin/gemini-monitoring/route.ts
// Aggregates Gemini telemetry from Directus gemini_requests.
// All cost/billing computed dynamically from GEMINI_MODELS_CONFIG — nothing stored in DB.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";
import {
  fetchTelemetryRequests,
  fetchRecentRequests,
  computeKPIs,
  computePeakUsageTrends,
  computeFeatureBreakdown,
  computeErrorBreakdown,
  computeFreeTierStatus,
  computeRateLimitStatus,
  resolveAttributionNames,
  GeminiRequestRow,
} from "@/modules/vos-admin/gemini-monitoring/services/geminiMonitoring.repo";

export const revalidate = 0;

/** Authorize caller as Administrator (Role ID 3 or ADMIN role) */
async function authorizeAdmin(req: NextRequest) {
  const session = await authenticateRequest(req);
  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  const roleName = (session.roleName || "").toUpperCase();
  if (session.roleId !== 3 && roleName !== "ADMIN") {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Forbidden: Restricted to administrators." },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, session };
}

export async function GET(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.authorized) return auth.response;

  const url = new URL(req.url);
  const timeRange = url.searchParams.get("time_range") || null;
  const provider = url.searchParams.get("provider") || null;
  const datePreset = url.searchParams.get("date_preset") || null;
  const dateFrom = url.searchParams.get("date_from") || null;
  const dateTo = url.searchParams.get("date_to") || null;
  const feature = url.searchParams.get("feature") || null;

  const isAllTime = datePreset === "ALL_TIME" || timeRange === "ALL_TIME" || (dateFrom === "" && dateTo === "" && datePreset !== "TODAY" && !timeRange);

  const filterOptions = { timeRange, provider, dateFrom, dateTo, feature, isAllTime };

  const configuredModel =
    process.env.GEMINI_MODEL || process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemini-2.0-flash";
  const apiKeyConfigured = Boolean(
    process.env.GEMINI_API_KEY
  );

  // PH local timestamp for response
  const phTimezoneOffsetMs = 8 * 3600 * 1000;
  const nowPh = new Date(Date.now() + phTimezoneOffsetMs).toISOString().replace("Z", "+08:00");

  // Fetch from Directus in parallel
  let todayRows: GeminiRequestRow[];
  let recentRows: GeminiRequestRow[];
  try {
    [todayRows, recentRows] = await Promise.all([
      fetchTelemetryRequests(filterOptions),
      fetchRecentRequests(100, filterOptions),
    ]);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Gemini telemetry could not be read.") },
      { status: 502 }
    );
  }

  const kpis = computeKPIs(todayRows, recentRows);
  const peakUsageTrends = computePeakUsageTrends(todayRows);
  const featureBreakdown = computeFeatureBreakdown(todayRows);
  const errorBreakdown = computeErrorBreakdown(todayRows);
  const freeTierStatus = computeFreeTierStatus(todayRows, configuredModel);
  const rateLimitStatus = computeRateLimitStatus(recentRows, todayRows, configuredModel);

  // Determine service health from recent traffic — no GCP endpoint ping
  // NO_DATA = collection not yet set up or no requests made today
  // HEALTHY  = last 5 min success rate ≥ 95% and latency < 3s
  // DEGRADED = recent failures or slow responses
  // UNAVAILABLE = recent requests exist but majority are failing
  let serviceHealth: "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "NO_DATA";
  if (recentRows.length === 0) {
    serviceHealth = "NO_DATA";
  } else if (kpis.recentSuccessRate >= 95 && kpis.recentAvgLatencyMs < 3000) {
    serviceHealth = "HEALTHY";
  } else if (kpis.recentSuccessRate >= 50) {
    serviceHealth = "DEGRADED";
  } else {
    serviceHealth = "UNAVAILABLE";
  }

  // Batch resolve user names and company names for attribution
  const userIds = recentRows.map((r) => r.user_id);
  const companyIds = recentRows.map((r) => r.company_id);
  const { userNames, companyNames } = await resolveAttributionNames(userIds, companyIds);

  // Audit log — most recent 20 requests formatted as YYYY-MM-DD HH:mm:ss
  const auditLog = recentRows.map((r) => {
    let formattedDate = r.created_at || "";
    if (r.created_at) {
      try {
        const d = new Date(r.created_at);
        if (!isNaN(d.getTime())) {
          const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hourCycle: "h23",
          }).formatToParts(d);

          const m: Record<string, string> = {};
          for (const p of parts) {
            m[p.type] = p.value;
          }
          formattedDate = `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}:${m.second}`;
        } else {
          formattedDate = String(r.created_at).replace("T", " ").split(".")[0];
        }
      } catch {
        formattedDate = String(r.created_at).replace("T", " ").split(".")[0];
      }
    }


    const isAdminRequest = (r.endpoint && r.endpoint.includes("vos-admin")) || r.feature === "ROLE_INTELLIGENCE";
    const isFreelancerRequest = (r.endpoint && (r.endpoint.includes("freelancer") || r.endpoint.includes("applicant"))) || r.feature === "MATCH_EXPLAINER";

    let resolvedCompanyName: string | null = null;
    if (r.company_id) {
      resolvedCompanyName = companyNames[r.company_id] ?? `Company #${r.company_id}`;
    } else if (isAdminRequest) {
      resolvedCompanyName = "Admin";
    } else if (isFreelancerRequest) {
      resolvedCompanyName = "User"; // Freelancer/jobseeker has no company — do not render company line
    } else {
      resolvedCompanyName = "Unknown";
    }

    return {
      id: r.id,
      requestId: r.request_id,
      feature: r.feature,
      provider: r.provider,
      model: r.model,
      endpoint: r.endpoint,
      promptTokens: r.prompt_tokens,
      completionTokens: r.completion_tokens,
      totalTokens: r.total_tokens,
      finishReason: r.finish_reason,
      responseStatus: r.response_status,
      latencyMs: r.latency_ms,
      userId: r.user_id,
      companyId: r.company_id,
      userName: r.user_id ? (userNames[r.user_id] ?? `User #${r.user_id}`) : (isAdminRequest ? (userNames[1] ?? "User #1") : null),
      companyName: resolvedCompanyName,
      createdAt: formattedDate,
    };
  });




  return NextResponse.json({
    success: true,
    configuredModel,
    apiKeyConfigured,
    serviceHealth,
    lastSuccessAt: kpis.lastSuccessAt,
    recentSuccessRate: kpis.recentSuccessRate,
    recentAvgLatencyMs: kpis.recentAvgLatencyMs,
    kpis,
    peakUsageTrends,
    freeTierStatus,
    rateLimitStatus,
    featureBreakdown,
    errorBreakdown,
    auditLog,
    lastCheckedAt: nowPh,
  });
}

// src/app/api/vos-admin/dashboard/overview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";
import type {
  AdminDashboardOverviewData,
  AdminDashboardKPIs,
  VerificationVelocityPoint,
  StatusDistributionItem,
  PendingActionItem,
} from "@/modules/vos-admin/types/dashboard";
import {
  fetchTelemetryRequests,
  fetchRecentRequests,
  computeKPIs,
} from "@/modules/vos-admin/gemini-monitoring/services/geminiMonitoring.repo";

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

const ROW_SCAN_LIMIT = 500;

const phMonthLabel = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

/**
 * vs_* timestamps are written as Manila wall clock (getPHTimeString), so the
 * monthly windows are built in that same frame: bucketing on the server's UTC
 * clock would move the first eight hours of every month into the month before.
 */
function phMonthWindows(months: number): { label: string; from: string; to: string }[] {
  const ph = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const out: { label: string; from: string; to: string }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(ph.getUTCFullYear(), ph.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    out.push({
      label: phMonthLabel.format(start),
      from: `${start.toISOString().slice(0, 10)}T00:00:00`,
      to: `${end.toISOString().slice(0, 10)}T00:00:00`,
    });
  }
  return out;
}

/** A Directus aggregate count, or null when the read could not be answered. */
async function countItems(url: string, headers: Record<string, string>): Promise<number | null> {
  try {
    const res = await fetch(`${DIRECTUS_BASE}/items/${url}`, { headers, cache: "no-store" });
    if (!res.ok) {
      console.error(`Dashboard count failed (${res.status}) for ${url}`);
      return null;
    }
    const json: unknown = await res.json();
    const first = (json as { data?: { count?: Record<string, unknown> | unknown }[] })?.data?.[0];
    const raw = first?.count;
    const value = Number(raw && typeof raw === "object" ? Object.values(raw)[0] : raw);
    return Number.isFinite(value) ? value : null;
  } catch (err: unknown) {
    console.error(`Dashboard count threw for ${url}:`, err);
    return null;
  }
}

function rowsFrom(json: unknown): Record<string, unknown>[] {
  const data = (json as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isAdministratorSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Admin access required." : "Unauthorized." },
        { status: session ? 403 : 401 }
      );
    }

    // Which sources could not be read. A dashboard figure that is unknown is
    // returned as null and named here; it is never replaced with a plausible
    // number, because an admin acting on invented totals is worse than one
    // waiting for the read to come back.
    const errors: string[] = [];

    let companies: Record<string, unknown>[] = [];
    let companyVerifications: Record<string, unknown>[] = [];
    let schools: Record<string, unknown>[] = [];
    let geminiTelemetry: Record<string, unknown> | null = null;
    let totalUsers: number | null = null;
    let activeUsers: number | null = null;

    const velocityWindows = phMonthWindows(6);
    const companyCounts = velocityWindows.map(() => null as number | null);
    const schoolCounts = velocityWindows.map(() => null as number | null);

    if (DIRECTUS_BASE) {
      const headers = getDirectusHeaders();
      const windowed = (pk: string, w: { from: string; to: string }) =>
        `aggregate[count]=${pk}&filter[created_at][_gte]=${w.from}&filter[created_at][_lt]=${w.to}`;

      // Run fetches in parallel with resilient error handling
      const [compRes, compVerifRes, schoolRes, geminiRes, countResults] = await Promise.all([
        fetch(`${DIRECTUS_BASE}/items/vs_company?fields=company_id,company_name,verification_status,created_at&limit=${ROW_SCAN_LIMIT}`, { headers, cache: "no-store" }).catch(() => null),
        fetch(`${DIRECTUS_BASE}/items/vs_company_verifications?fields=id,company_id,status,created_at&sort=-created_at,-id&limit=${ROW_SCAN_LIMIT}`, { headers, cache: "no-store" }).catch(() => null),
        fetch(`${DIRECTUS_BASE}/items/vs_school?fields=school_id,school_name,verification_status,school_status,created_at&limit=${ROW_SCAN_LIMIT}`, { headers, cache: "no-store" }).catch(() => null),
        (async () => {
          try {
            const [todayRows, recentRows] = await Promise.all([
              fetchTelemetryRequests(),
              fetchRecentRequests(100),
            ]);
            return { ok: true, kpis: computeKPIs(todayRows, recentRows) };
          } catch {
            return { ok: false };
          }
        })(),
        Promise.all([
          countItems("vs_user?aggregate[count]=user_id", headers),
          countItems("vs_user?aggregate[count]=user_id&filter[status][_eq]=ACTIVE", headers),
          ...velocityWindows.map((w) => countItems(`vs_company?${windowed("company_id", w)}`, headers)),
          ...velocityWindows.map((w) => countItems(`vs_school?${windowed("school_id", w)}`, headers)),
        ]),
      ]);

      if (compRes?.ok) {
        companies = rowsFrom(await compRes.json().catch(() => null));
      } else {
        errors.push("Employer accounts");
      }

      if (compVerifRes?.ok) {
        companyVerifications = rowsFrom(await compVerifRes.json().catch(() => null));
      } else {
        errors.push("Employer verification attempts");
      }

      if (schoolRes?.ok) {
        schools = rowsFrom(await schoolRes.json().catch(() => null));
      } else {
        errors.push("Institutions");
      }

      if (geminiRes?.ok) {
        const kpis = (geminiRes as { ok: true; kpis: ReturnType<typeof computeKPIs> }).kpis;
        const noRecentData = kpis.recentSuccessRate === 100 && kpis.recentAvgLatencyMs === 0;
        geminiTelemetry = {
          serviceHealth: noRecentData
            ? "STANDBY"
            : kpis.recentSuccessRate >= 95 && kpis.recentAvgLatencyMs < 3000
            ? "HEALTHY"
            : kpis.recentSuccessRate >= 50
            ? "DEGRADED"
            : "UNAVAILABLE",
          recentSuccessRate: kpis.recentSuccessRate,
          recentAvgLatencyMs: kpis.recentAvgLatencyMs,
        };
      } else {
        errors.push("AI engine telemetry");
      }

      [totalUsers, activeUsers] = countResults;
      const offset = 2;
      velocityWindows.forEach((_, i) => {
        companyCounts[i] = countResults[offset + i] ?? null;
        schoolCounts[i] = countResults[offset + velocityWindows.length + i] ?? null;
      });
      if (countResults.slice(2).some((v) => v === null)) {
        errors.push("Monthly registration counts");
      }

      // A capped row read silently undercounts every bucket derived from it, so
      // the panels that need each record (not just a total) say so.
      if (companies.length >= ROW_SCAN_LIMIT) errors.push(`Employer accounts (only the ${ROW_SCAN_LIMIT} newest read)`);
      if (schools.length >= ROW_SCAN_LIMIT) errors.push(`Institutions (only the ${ROW_SCAN_LIMIT} newest read)`);
    } else {
      errors.push("Directus is not configured");
    }

    // Map latest verification attempt for each company
    const latestCompanyVerifMap: Record<number, Record<string, unknown>> = {};
    companyVerifications.forEach((v) => {
      const cid = Number(v.company_id);
      if (!latestCompanyVerifMap[cid]) {
        latestCompanyVerifMap[cid] = v;
      }
    });

    // Helper: align with Company Management getCompanyStatusBucket()
    const getCompanyBucket = (c: Record<string, unknown>) => {
      const cid = Number(c.company_id);
      const cv = latestCompanyVerifMap[cid];
      const compStatus = String(c.verification_status || "").toUpperCase();
      const verifStatus = String(cv?.status || "").toUpperCase();

      if (compStatus === "VERIFIED" || verifStatus === "APPROVED") return "VERIFIED";
      if (compStatus === "REJECTED" || compStatus === "SUSPENDED" || verifStatus === "REJECTED" || verifStatus === "SUSPENDED") return "REJECTED";
      if (verifStatus === "CORRECTION_REQUIRED") return "NEEDS_REVISION";
      if (compStatus === "PENDING_VERIFICATION" || verifStatus === "PENDING_VERIFICATION" || verifStatus === "IN_REVIEW") {
        return "PENDING_VERIFICATION";
      }
      return "DRAFT";
    };

    // Calculations
    const pendingCompanies = companies.filter((c) => getCompanyBucket(c) === "PENDING_VERIFICATION");
    const verifiedCompanies = companies.filter((c) => getCompanyBucket(c) === "VERIFIED");

    // Align with School Management computeSchoolKpis()
    const pendingSchools = schools.filter((s) => {
      const st = String(s.verification_status || "").toUpperCase();
      return st === "PENDING_VERIFICATION" || st === "DRAFT" || st === "CORRECTION_REQUIRED";
    });

    const verifiedSchools = schools.filter((s) => {
      const st = String(s.verification_status || "").toUpperCase();
      return st === "VERIFIED" || st === "APPROVED";
    });

    const pendingVerifications = pendingCompanies.length + pendingSchools.length;

    // Gemini telemetry values. Absent telemetry is reported as no data, never
    // as a 100% success rate or a latency the platform never measured.
    const geminiHealthStatus = (geminiTelemetry?.serviceHealth as
      | "HEALTHY"
      | "DEGRADED"
      | "UNAVAILABLE"
      | "NO_DATA"
      | "STANDBY"
      | undefined) ?? "STANDBY";
    const geminiSuccessRate =
      typeof geminiTelemetry?.recentSuccessRate === "number"
        ? geminiTelemetry.recentSuccessRate
        : null;
    const geminiAvgLatencyMs =
      typeof geminiTelemetry?.recentAvgLatencyMs === "number"
        ? geminiTelemetry.recentAvgLatencyMs
        : null;

    const kpis: AdminDashboardKPIs = {
      totalUsers,
      activeUsers,
      pendingVerifications,
      pendingCompanyVerifications: pendingCompanies.length,
      pendingSchoolVerifications: pendingSchools.length,
      totalVerifiedSchools: verifiedSchools.length,
      totalVerifiedCompanies: verifiedCompanies.length,
      geminiHealthStatus,
      geminiSuccessRate,
      geminiAvgLatencyMs,
    };

    // Pending Action Queue (top 5 pending, combined and sorted by submission date descending)
    const pendingActions: PendingActionItem[] = [
      ...pendingCompanies.map((c, i) => ({
        // company_id is the key; a row without one still needs a stable key, so
        // it falls back to its position rather than a random value that
        // remounts the row on every refresh.
        id: (c.company_id as string | number) ?? `company-${i}`,
        type: "COMPANY" as const,
        name: String(c.company_name || "Company Applicant"),
        submittedAt: (c.created_at as string) || null,
        detail: "Company Verification Review Required",
        reviewUrl: `/linkbridge/admin/company-verification?companyId=${c.company_id}`,
      })),
      ...pendingSchools.map((s, i) => ({
        id: (s.school_id as string | number) ?? `school-${i}`,
        type: "SCHOOL" as const,
        name: String(s.school_name || "School Applicant"),
        submittedAt: (s.created_at as string) || null,
        detail: "Institutional Accreditation Review Required",
        reviewUrl: `/linkbridge/admin/school-verification?schoolId=${s.school_id}`,
      })),
    ]
      .sort((a, b) => {
        const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 5);

    // Distribution breakdown
    const distribution: StatusDistributionItem[] = [
      { name: "Verified Companies", value: verifiedCompanies.length, fill: "#3b82f6" },
      { name: "Verified Schools", value: verifiedSchools.length, fill: "#10b981" },
      { name: "Pending Review", value: pendingVerifications, fill: "#f59e0b" },
      {
        name: "Needs Correction / Other",
        value: Math.max(
          (companies.length + schools.length) -
            (verifiedCompanies.length + verifiedSchools.length + pendingVerifications),
          0
        ),
        fill: "#64748b",
      },
    ];

    // Monthly registration velocity, counted in Directus so a month's total is
    // the whole table, not whatever survived the 500-row scan above.
    const velocity: VerificationVelocityPoint[] = velocityWindows.map((w, i) => ({
      month: w.label,
      companies: companyCounts[i],
      schools: schoolCounts[i],
    }));

    const responsePayload: AdminDashboardOverviewData = {
      kpis,
      velocity,
      distribution,
      pendingActions,
      errors,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(responsePayload);
  } catch (err: unknown) {
    console.error("Dashboard overview API error:", err);
    return NextResponse.json({ error: safeErrorMessage(err, "Internal server error") }, { status: 500 });
  }
}

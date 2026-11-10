// src/app/api/client/dashboard/route.ts
import { getClientDashboardData } from "@/modules/client/dashboard/services/client-dashboard.service";
import { withRoute } from "@/lib/server/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withRoute(async ({ session }) => {
  const data = await getClientDashboardData(Number(session.userId));
  // A Directus outage now rejects instead of returning zeroed KPIs, and
  // `withRoute` turns that into a 502 so the module shows its retry state
  // rather than a dashboard that reports no jobs, applicants or interviews.
  return data;
}, { auth: "client" });

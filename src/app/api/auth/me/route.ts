// src/app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/auth-utils";
import {
  authenticateRequestDetailed,
  isAdministratorSession,
  isClientSession,
  isFreelancerSession,
  isSchoolAdminSession,
} from "@/lib/authenticated-session";
import { directusSettled } from "@/lib/server/directus";

/**
 * Clears the cookie, because the credential is genuinely finished: no token,
 * a token we did not sign, an account that may not authenticate, or a revoked
 * session. The body keeps `authenticated: false` so callers that only read the
 * JSON see the same guest answer as before.
 */
function signedOut(): NextResponse {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.delete(COOKIE_NAME);
  return response;
}

/**
 * Directus could not answer about this account. Reporting that as a logout
 * would delete a perfectly good cookie on a transient 5xx, so the credential
 * survives and the caller retries; guarded API routes still fail closed on
 * their own lookups.
 */
function unavailable(): NextResponse {
  return NextResponse.json(
    { authenticated: false, unavailable: true },
    { status: 503 }
  );
}

export async function GET(req: NextRequest) {
  const outcome = await authenticateRequestDetailed(req);

  if (outcome.status === "unavailable") return unavailable();
  if (outcome.status !== "authenticated") return signedOut();

  const { session } = outcome;
  const claims = { roleId: session.roleId, roleName: session.roleName };

  // Role names are written by several signup flows with slightly different
  // spellings, so the id/name table lives in authenticated-session and this
  // route reads the same predicates the API guards use. An account that
  // matches none of them keeps the historical freelancer default.
  let role = "employee";
  let dashboard = "/vos-sync/freelancer/dashboard";

  if (isClientSession(claims)) {
    role = "employer";
    dashboard = "/vos-sync/client/dashboard";
  } else if (isAdministratorSession(claims)) {
    role = "admin";
    dashboard = "/vos-sync/vos-admin";
  } else if (isSchoolAdminSession(claims)) {
    role = "school";
    dashboard = "/vos-sync/school-admin";
  } else if (isFreelancerSession(claims)) {
    role = "employee";
  }

  let companyId: number | null = null;
  let companyCode: string | null = null;

  if (role === "employer") {
    // `directusSettled` hands back the raw Directus envelope, and it does not
    // throw: a failed company lookup must not turn a valid session into a 500.
    const link = await directusSettled<{ data?: Array<{ company_id: unknown }> }>(
      "/items/vs_company_user",
      {
        query: `filter[user_id][_eq]=${encodeURIComponent(String(session.userId))}&fields=company_id&limit=1`,
        cache: "no-store",
      }
    );
    if (!link.ok) {
      console.error(`[auth/me] Employer company link lookup failed: ${link.error}`);
    } else {
      const raw = link.data?.data?.[0]?.company_id;
      const resolved =
        typeof raw === "object" && raw !== null
          ? (raw as { company_id?: unknown }).company_id
          : raw;
      const id = Number(resolved);

      if (Number.isSafeInteger(id) && id > 0) {
        companyId = id;
        const company = await directusSettled<{
          data?: { company_code?: string };
        }>(`/items/vs_company/${id}`, {
          query: "fields=company_id,company_code",
          cache: "no-store",
        });
        if (!company.ok) {
          console.error(`[auth/me] Employer company lookup failed: ${company.error}`);
        } else {
          companyCode = company.data?.data?.company_code || null;
        }
      }
    }
  }

  return NextResponse.json({
    authenticated: true,
    role,
    dashboard,
    userId: session.userId,
    companyId,
    companyCode,
  });
}

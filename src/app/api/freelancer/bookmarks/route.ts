import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isFreelancerSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

// GET — Fetch logged-in freelancer's bookmarked jobs
export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isFreelancerSession(session)) {
      return NextResponse.json({ error: "Forbidden: freelancer role required." }, { status: 403 });
    }

    const userId = Number(session.userId);

    // Fetch bookmarks for this user
    const bkRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_bookmark?filter[user_id][_eq]=${userId}&sort[]=-bookmarked_at&fields=*&limit=200`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!bkRes.ok) {
      const err = await bkRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.errors?.[0]?.message ?? "Failed to load bookmarks." },
        { status: bkRes.status }
      );
    }

    const bkJson = await bkRes.json();
    const bookmarks: Record<string, unknown>[] = bkJson.data ?? [];

    if (bookmarks.length === 0) {
      return NextResponse.json({ bookmarks: [] });
    }

    // Enrich with job details (title, type, location, work_arrangement, salary)
    const jobIds = [...new Set(bookmarks.map((b) => b.job_id as number))];
    const jobsRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_posting?filter[job_id][_in]=${jobIds.join(",")}&fields=job_id,job_title,job_type,job_location,work_arrangement,salary_min,salary_max,currency,salary_negotiable,company_id&limit=500`,
      { headers: getHeaders(), cache: "no-store" }
    );

    const jobsMap: Record<number, Record<string, unknown>> = {};
    if (jobsRes.ok) {
      const jobsJson = await jobsRes.json();
      const jobs: Record<string, unknown>[] = jobsJson.data ?? [];
      jobs.forEach((j) => {
        jobsMap[j.job_id as number] = j;
      });
    }

    // Enrich with company names and logos
    const companyIds = [
      ...new Set(
        Object.values(jobsMap)
          .map((j) => j.company_id as number)
          .filter(Boolean)
      ),
    ];
    const companyMap: Record<number, { name: string; logo: string | null }> = {};
    if (companyIds.length > 0) {
      const compRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_company?filter[company_id][_in]=${companyIds.join(",")}&fields=company_id,company_name,company_logo&limit=200`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (compRes.ok) {
        const compJson = await compRes.json();
        const companies: Record<string, unknown>[] = compJson.data ?? [];
        companies.forEach((c) => {
          companyMap[c.company_id as number] = {
            name: c.company_name as string,
            logo: (c.company_logo as string) ?? null,
          };
        });
      }
    }

    // Check for active referral claims for these bookmarked jobs
    const referralMap: Record<number, { is_referred: boolean; referrer_name: string | null; school_name: string | null; referral_expires_at: string | null }> = {};
    if (jobIds.length > 0) {
      try {
        const claimsRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_job_referral_claim?filter[candidate_user_id][_eq]=${userId}&filter[job_id][_in]=${jobIds.join(",")}&filter[claim_status][_eq]=ACTIVE&fields=job_id,referral_id.expires_at,referral_id.referrer_user_id.user_fname,referral_id.referrer_user_id.user_lname,referral_id.referrer_user_id.user_id&limit=100`,
          { headers: getHeaders(), cache: "no-store" }
        );
        if (claimsRes.ok) {
          const claimsJson = await claimsRes.json();
          const claims = claimsJson.data || [];
          for (const c of claims) {
            const jId = Number(c.job_id);
            const refUser = c.referral_id?.referrer_user_id;
            const expAt = c.referral_id?.expires_at || null;
            let refName = "A friend";
            if (refUser) {
              refName = `${refUser.user_fname ?? ""} ${refUser.user_lname ?? ""}`.trim() || refName;
            }
            referralMap[jId] = {
              is_referred: true,
              referrer_name: refName,
              school_name: null,
              referral_expires_at: expAt,
            };
          }
        }
      } catch (err) {
        console.error("Error checking referral claims for bookmarks:", err);
      }
    }

    // Merge all data
    const enriched = bookmarks.map((bk) => {
      const job = jobsMap[bk.job_id as number] ?? {};
      const companyId = job.company_id as number;
      const company = companyId ? companyMap[companyId] : null;
      const refInfo = referralMap[bk.job_id as number];
      return {
        ...bk,
        job_title: job.job_title ?? null,
        job_type: job.job_type ?? null,
        job_location: job.job_location ?? null,
        work_arrangement: job.work_arrangement ?? null,
        salary_min: job.salary_min ?? null,
        salary_max: job.salary_max ?? null,
        currency: job.currency ?? null,
        salary_negotiable: job.salary_negotiable ?? false,
        company_name: company?.name ?? null,
        company_logo: company?.logo ?? null,
        is_referred: refInfo?.is_referred ?? false,
        referrer_name: refInfo?.referrer_name ?? null,
        school_name: refInfo?.school_name ?? null,
        referral_expires_at: refInfo?.referral_expires_at ?? null,
      };
    });

    return NextResponse.json({ bookmarks: enriched });
  } catch (err: unknown) {
    console.error("GET /api/freelancer/bookmarks error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// POST — Bookmark a job
export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isFreelancerSession(session)) {
      return NextResponse.json({ error: "Forbidden: freelancer role required." }, { status: 403 });
    }

    const userId = Number(session.userId);

    const body = await req.json().catch(() => null);
    if (!body?.job_id) {
      return NextResponse.json({ error: "job_id is required." }, { status: 400 });
    }

    // Check for duplicate bookmark
    const dupCheck = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_bookmark?filter[job_id][_eq]=${body.job_id}&filter[user_id][_eq]=${userId}&fields=bookmark_id&limit=1`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (dupCheck.ok) {
      const dupJson = await dupCheck.json();
      if ((dupJson.data ?? []).length > 0) {
        return NextResponse.json(
          { error: "You have already bookmarked this job." },
          { status: 409 }
        );
      }
    }

    const payload = {
      job_id: Number(body.job_id),
      user_id: userId,
    };

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_job_bookmark`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: json.errors?.[0]?.message ?? "Failed to bookmark job." },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Job bookmarked successfully.",
      bookmark: json.data,
    });
  } catch (err: unknown) {
    console.error("POST /api/freelancer/bookmarks error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// DELETE — Remove a bookmark
export async function DELETE(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isFreelancerSession(session)) {
      return NextResponse.json({ error: "Forbidden: freelancer role required." }, { status: 403 });
    }

    const userId = Number(session.userId);

    const body = await req.json().catch(() => null);
    if (!body?.job_id) {
      return NextResponse.json({ error: "job_id is required." }, { status: 400 });
    }

    // Find the bookmark record first
    const getRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_bookmark?filter[job_id][_eq]=${body.job_id}&filter[user_id][_eq]=${userId}&fields=bookmark_id&limit=1`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!getRes.ok) {
      return NextResponse.json(
        { error: "Failed to find bookmark." },
        { status: getRes.status }
      );
    }

    const getJson = await getRes.json();
    const records = getJson.data ?? [];
    if (records.length === 0) {
      return NextResponse.json({ error: "Bookmark not found." }, { status: 404 });
    }

    const bookmarkId = records[0].bookmark_id;

    // Delete the record
    const delRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_bookmark/${bookmarkId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });

    if (!delRes.ok) {
      return NextResponse.json(
        { error: "Failed to remove bookmark." },
        { status: delRes.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Bookmark removed successfully.",
    });
  } catch (err: unknown) {
    console.error("DELETE /api/freelancer/bookmarks error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

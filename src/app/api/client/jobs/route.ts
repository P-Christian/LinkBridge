import { NextRequest, NextResponse } from "next/server";
import * as jobService from "./service.directus";
import { checkRestrictionState } from "@/lib/status-validator";
import { getPHTimeString } from "@/lib/utils";
import { snapshotCompanyPipeline } from "@/modules/client/pipeline/services/job-pipeline.service";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
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

async function resolveCompany(userId: number): Promise<{
  companyId: number | null;
  verification_status: string | null;
  error: string | null;
}> {
  const linkUrl = `${DIRECTUS_BASE}/items/vs_company_user?filter[user_id][_eq]=${userId}&fields=company_id&limit=1`;
  const linkRes = await fetch(linkUrl, { headers: getHeaders(), cache: "no-store" });
  const linkJson = await linkRes.json();
  const link = linkJson.data?.[0];
  if (!link) return { companyId: null, verification_status: null, error: "No company associated." };

  const companyRes = await fetch(
    `${DIRECTUS_BASE}/items/vs_company/${link.company_id}?fields=company_id,verification_status`,
    { headers: getHeaders(), cache: "no-store" }
  );
  const companyJson = await companyRes.json();
  const company = companyJson.data;

  return {
    companyId: company?.company_id ?? null,
    verification_status: company?.verification_status ?? null,
    error: null,
  };
}

async function attachCompanyToJob<T extends { company_id?: string | number | null }>(job: T) {
  if (!job || !job.company_id) return job;
  try {
    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_company/${job.company_id}?fields=*`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (!res.ok) return job;
    const json = await res.json();
    const companyData = json.data;
    if (!companyData) return job;

    return {
      ...job,
      company: {
        company_id: companyData.company_id,
        company_name: companyData.company_name,
        company_logo: companyData.company_logo,
        company_cover: companyData.company_cover,
        company_email: companyData.company_email,
        company_contact: companyData.company_contact,
        company_address: companyData.company_address,
        company_city: companyData.company_city,
        company_province: companyData.company_province,
        company_facebook: companyData.company_facebook,
        company_linkedin: companyData.company_linkedin,
        company_instagram: companyData.company_instagram,
        company_x: companyData.company_x,
        company_youtube: companyData.company_youtube,
      },
      // fallback flat fields
      company_name: companyData.company_name || null,
      company_logo: companyData.company_logo || null,
      company_cover: companyData.company_cover || null,
      company_email: companyData.company_email || null,
      company_contact: companyData.company_contact || null,
      company_address: companyData.company_address || null,
      company_city: companyData.company_city || null,
      company_province: companyData.company_province || null,
      company_facebook: companyData.company_facebook || null,
      company_linkedin: companyData.company_linkedin || null,
      company_instagram: companyData.company_instagram || null,
      company_x: companyData.company_x || null,
      company_youtube: companyData.company_youtube || null,
    };
  } catch (err) {
    console.error("attachCompanyToJob error:", err);
    return job;
  }
}

// ─────────────────────────────────────────────
// GET — List all job postings for the company
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isClientSession(session)) {
      return NextResponse.json({ error: "Forbidden: employer access required." }, { status: 403 });
    }

    const userId = Number(session.userId);

    const { companyId, error } = await resolveCompany(userId);
    if (error || !companyId)
      return NextResponse.json({ error: error ?? "Company not found." }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const jobs = await jobService.getJobs(companyId, status);
    const jobsWithCompany = await Promise.all(jobs.map((j) => attachCompanyToJob(j)));

    return NextResponse.json({ jobs: jobsWithCompany });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// POST — Create a new job posting
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isClientSession(session)) {
      return NextResponse.json({ error: "Forbidden: employer access required." }, { status: 403 });
    }

    const userId = Number(session.userId);

    // Validate PUBLISH_JOBS Restriction
    const restriction = await checkRestrictionState(userId, "PUBLISH_JOBS");
    if (restriction.restricted) {
      if (restriction.reason === "unavailable") {
        return NextResponse.json(
          { error: "Your account status could not be verified, so the job was not posted. Please try again." },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "Your job posting privileges are temporarily suspended." },
        { status: 403 }
      );
    }

    const { companyId, verification_status, error } = await resolveCompany(userId);
    if (error || !companyId)
      return NextResponse.json({ error: error ?? "Company not found." }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

    // Required fields
    const errors: string[] = [];
    if (!body.job_title?.trim()) errors.push("Job title is required.");
    if (!body.job_type?.trim()) errors.push("Job type is required.");
    if (!body.job_location?.trim()) errors.push("Job location is required.");
    if (!body.salary_min && !body.salary_max && !body.salary_negotiable)
      errors.push("Salary information is required.");

    // BUSINESS RULE: Only VERIFIED companies can post jobs
    if (verification_status !== "VERIFIED") {
      return NextResponse.json(
        {
          error:
            "Posting jobs is restricted for unapproved companies. Your company verification status is currently " +
            (verification_status ?? "DRAFT") +
            ". Admin approval is required before you can post jobs.",
        },
        { status: 403 }
      );
    }

    if (errors.length > 0)
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

    const nowPH = getPHTimeString();

    const targetStatus = body.status ?? "ACTIVE";

    const jobPayload = {
      company_id: companyId,
      created_by_user_id: userId,
      job_title: body.job_title?.trim(),
      job_description: body.job_description || null,
      job_requirements: body.job_requirements || null,
      job_type: body.job_type?.trim(),
      job_location: body.job_location?.trim(),
      job_department: body.job_department?.trim() || null,
      salary_min: body.salary_min ?? null,
      salary_max: body.salary_max ?? null,
      salary_negotiable: body.salary_negotiable ?? false,
      experience_level: body.experience_level?.trim() || null,
      status: targetStatus,
      is_deleted: 0,
      created_at: nowPH,
      updated_at: nowPH,
      skills: body.skills,
      benefits: body.benefits,
      screening_questions: body.screening_questions,
    };

    const { job: createdJob, warnings } = await jobService.createJob(jobPayload);

    // Initial Job Pipeline Snapshot
    if (createdJob?.job_id) {
      try {
        await snapshotCompanyPipeline(
          Number(createdJob.job_id),
          companyId,
          body.source_pipeline_id ? Number(body.source_pipeline_id) : undefined
        );
      } catch (pipeErr) {
        console.error("[POST /api/client/jobs] Failed to snapshot pipeline for job:", pipeErr);
        warnings.push("The job was created but its review pipeline was not set up, so applicants cannot be advanced until you configure one.");
      }
    }

    const jobWithCompany = await attachCompanyToJob(createdJob);

    return NextResponse.json({
      success: true,
      message: "Job posting created successfully.",
      job: jobWithCompany,
      warnings,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

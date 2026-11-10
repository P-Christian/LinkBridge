/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/client/jobs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as jobService from "../service.directus";
import { checkRestrictionState } from "@/lib/status-validator";
import { getPHTimeString } from "@/lib/utils";
import {
  authenticateRequest,
  isAdministratorSession,
  isClientSession,
} from "@/lib/authenticated-session";

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

async function getCompanyId(userId: number): Promise<number | null> {
  const res = await fetch(
    `${DIRECTUS_BASE}/items/vs_company_user?filter[user_id][_eq]=${userId}&fields=company_id&limit=1`,
    { headers: getHeaders(), cache: "no-store" }
  );
  // An unreadable link is not "no link": falling through to the null branch
  // answered 403/404 and a recruiter read that as having no company at all.
  if (!res.ok) throw new Error(`Company link lookup failed (${res.status}).`);
  const json = await res.json();
  return json.data?.[0]?.company_id ?? null;
}

async function attachCompanyToJob(job: any) {
  if (!job || !job.company_id) return job;
  try {
    const companyFields = [
      "company_id",
      "company_name",
      "company_logo",
      "company_cover",
      "company_email",
      "company_contact",
      "company_address",
      "company_city",
      "company_province",
      "company_facebook",
      "company_linkedin",
      "company_instagram",
      "company_x",
      "company_youtube",
    ].join(",");
    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_company/${job.company_id}?fields=${companyFields}`,
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

// GET — Fetch single job. The employer that owns the posting, or an admin.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const isAdmin = isAdministratorSession(session);
    const isClient = isClientSession(session);
    if (!isAdmin && !isClient) {
      return NextResponse.json(
        { error: "Forbidden: Client or Admin access required." },
        { status: 403 }
      );
    }

    const job = await jobService.getJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job posting not found." }, { status: 404 });
    }

    if (!isAdmin) {
      const callerCompanyId = await getCompanyId(Number(session.userId));
      if (!callerCompanyId) {
        return NextResponse.json(
          { error: "Company association not found." },
          { status: 403 }
        );
      }
      if (job.company_id !== callerCompanyId) {
        return NextResponse.json(
          { error: "Forbidden: job belongs to another organization." },
          { status: 403 }
        );
      }
    }

    const jobWithCompany = await attachCompanyToJob(job);
    return NextResponse.json({ job: jobWithCompany });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// PATCH — Update job
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const isAdmin = isAdministratorSession(session);
    const isClient = isClientSession(session);
    if (!isAdmin && !isClient) {
      return NextResponse.json(
        { error: "Forbidden: Client or Admin access required." },
        { status: 403 }
      );
    }

    const userId = Number(session.userId);
    let callerCompanyId: number | null = null;
    if (!isAdmin) {
      callerCompanyId = await getCompanyId(userId);
      if (!callerCompanyId) {
        return NextResponse.json(
          { error: "Company association not found." },
          { status: 403 }
        );
      }
    }

    const existingJob = await jobService.getJob(id);
    if (!existingJob) {
      return NextResponse.json({ error: "Job posting not found." }, { status: 404 });
    }

    if (!isAdmin && existingJob.company_id !== callerCompanyId) {
      return NextResponse.json(
        { error: "Forbidden: job belongs to another organization." },
        { status: 403 }
      );
    }

    const restriction = await checkRestrictionState(userId, "PUBLISH_JOBS");
    if (restriction.restricted) {
      if (restriction.reason === "unavailable") {
        return NextResponse.json(
          { error: "Your account status could not be verified, so this job was not updated. Please try again." },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "Your job posting privileges are temporarily suspended." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body)
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

    const ALLOWED_FIELDS = [
      "job_title",
      "job_description",
      "job_requirements",
      "job_type",
      "job_location",
      "job_department",
      "salary_min",
      "salary_max",
      "salary_negotiable",
      "experience_level",
      "status",
      "skills",
      "benefits",
      "screening_questions",
    ];

    const safePayload: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in body) safePayload[key] = body[key];
    }

    const nowPH = getPHTimeString();
    safePayload.updated_at = nowPH;

    const { job: updatedJob, warnings } = await jobService.updateJob(id, safePayload);
    const jobWithCompany = await attachCompanyToJob(updatedJob);

    return NextResponse.json({ success: true, job: jobWithCompany, warnings });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// DELETE — Soft-delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const isAdmin = isAdministratorSession(session);
    const isClient = isClientSession(session);
    if (!isAdmin && !isClient) {
      return NextResponse.json(
        { error: "Forbidden: Client or Admin access required." },
        { status: 403 }
      );
    }

    if (!isAdmin) {
      const callerCompanyId = await getCompanyId(Number(session.userId));
      if (!callerCompanyId) {
        return NextResponse.json(
          { error: "Company association not found." },
          { status: 403 }
        );
      }
      const existingJob = await jobService.getJob(id);
      if (!existingJob) {
        return NextResponse.json({ error: "Job posting not found." }, { status: 404 });
      }
      if (existingJob.company_id !== callerCompanyId) {
        return NextResponse.json(
          { error: "Forbidden: job belongs to another organization." },
          { status: 403 }
        );
      }
    }

    await jobService.deleteJob(id);
    return NextResponse.json({ success: true, message: "Job posting closed." });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

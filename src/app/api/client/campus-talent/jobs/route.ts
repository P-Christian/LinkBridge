// src/app/api/client/campus-talent/jobs/route.ts
// GET: Returns the authenticated recruiter's company active job postings
// for the job selector in the Campus Talent match interface.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";
import { DirectusError, directusItems, directusItemsWhereIn } from "@/lib/server/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    const userId = Number(session.userId);
    const { isVerified, verification_status, companyId } = await checkCompanyVerificationStatus(userId);
    if (!isVerified || !companyId) {
      return NextResponse.json(
        { error: `Restricted: Company status is ${verification_status}.` },
        { status: 403 }
      );
    }

    const fields = [
      "job_id",
      "job_title",
      "job_type",
      "job_category",
      "experience_level",
      "education",
      "job_qualifications",
      "job_responsibilities",
      "status",
    ].join(",");

    const jobs = await directusItems<{ job_id: number; [field: string]: unknown }>("vs_job_posting", {
      query: `filter[company_id][_eq]=${companyId}&filter[status][_eq]=ACTIVE&fields=${fields}&sort[]=job_title&limit=-1`,
    });

    // One batched read replaces a request per job: the serial version capped each
    // job at 50 skills and, when a read failed, returned the job with none, so a
    // role the recruiter picked for its skills could be matched against an empty
    // requirement list.
    const skillRows = await directusItemsWhereIn<{
      job_id: number;
      skill_id?: { skill_name?: string } | null;
    }>("vs_job_skills_map", "job_id", jobs.map((j) => j.job_id), "job_id,skill_id.skill_name,skill_id.id");

    const skillsByJob = new Map<number, Array<{ skill_name: string; is_required: number }>>();
    for (const row of skillRows) {
      const list = skillsByJob.get(Number(row.job_id)) ?? [];
      // vs_job_skills_map does not have an is_required column — default all to PREFERRED
      list.push({ skill_name: row.skill_id?.skill_name ?? "", is_required: 0 });
      skillsByJob.set(Number(row.job_id), list);
    }

    const enrichedJobs = jobs.map((job) => ({
      ...job,
      skills: skillsByJob.get(Number(job.job_id)) ?? [],
    }));

    return NextResponse.json({ data: enrichedJobs, total: enrichedJobs.length, companyId });
  } catch (err: unknown) {
    console.error("[campus-talent/jobs GET]", err);
    const upstream = err instanceof DirectusError;
    return NextResponse.json(
      { error: upstream ? "Jobs could not be read. Please try again." : "Internal server error." },
      { status: upstream ? 502 : 500 }
    );
  }
}

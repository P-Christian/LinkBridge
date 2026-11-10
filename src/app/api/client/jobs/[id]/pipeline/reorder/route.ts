import { NextRequest, NextResponse } from "next/server";
import {
  canModifyJobPipeline,
  getJobCompanyId,
  reorderJobPipelineStages,
} from "@/modules/client/pipeline/services/job-pipeline.service";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (
  process.env.DIRECTUS_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  ""
).replace(/\/$/, "");

const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) headers.Authorization = `Bearer ${DIRECTUS_TOKEN}`;
  return headers;
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jobId = Number(id);
    if (!jobId || isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID." }, { status: 400 });
    }

    const session = await authenticateRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    const userId = Number(session.userId);
    const companyId = await getCompanyId(userId);
    if (!companyId) {
      return NextResponse.json({ error: "Company association not found." }, { status: 404 });
    }

    const jobCompanyId = await getJobCompanyId(jobId);
    if (!jobCompanyId) {
      return NextResponse.json({ error: "Job posting not found." }, { status: 404 });
    }
    if (jobCompanyId !== companyId) {
      return NextResponse.json(
        { error: "Forbidden: job belongs to another organization." },
        { status: 403 }
      );
    }

    // Backend Immutability Gate
    const lockCheck = await canModifyJobPipeline(jobId);
    if (!lockCheck.canModify) {
      return NextResponse.json(
        {
          error: lockCheck.error || "Cannot modify pipeline because applications exist.",
          application_count: lockCheck.applicationCount,
        },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.ordered_stage_ids)) {
      return NextResponse.json(
        { error: "ordered_stage_ids array is required." },
        { status: 400 }
      );
    }

    const orderedStageIds = body.ordered_stage_ids
      .map(Number)
      .filter((n: number) => !isNaN(n) && n > 0);

    const result = await reorderJobPipelineStages(
      jobId,
      orderedStageIds
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to reorder stages." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/client/jobs/[id]/pipeline/reorder error:", err);
    return NextResponse.json(
      { error: "Failed to reorder stages." },
      { status: 500 }
    );
  }
}

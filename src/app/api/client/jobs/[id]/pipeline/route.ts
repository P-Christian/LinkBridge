import { NextRequest, NextResponse } from "next/server";
import {
  canModifyJobPipeline,
  getJobCompanyId,
  getJobPipeline,
  snapshotCompanyPipeline,
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

export async function GET(
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

    // Verify job belongs to this company
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

    const pipeline = await getJobPipeline(jobId, companyId);
    if (!pipeline) {
      return NextResponse.json(
        { error: "Failed to resolve or bootstrap job pipeline." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pipeline,
    });
  } catch (err) {
    console.error("GET /api/client/jobs/[id]/pipeline error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve job pipeline." },
      { status: 500 }
    );
  }
}

export async function POST(
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

    // Verify job belongs to this company
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

    const body = await req.json().catch(() => ({}));
    const sourcePipelineId = body?.source_pipeline_id ? Number(body.source_pipeline_id) : undefined;

    const newSnapshot = await snapshotCompanyPipeline(jobId, companyId, sourcePipelineId);
    if (!newSnapshot) {
      return NextResponse.json(
        { error: "Failed to generate job pipeline snapshot." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pipeline: newSnapshot,
    });
  } catch (err) {
    console.error("POST /api/client/jobs/[id]/pipeline error:", err);
    return NextResponse.json(
      { error: "Failed to reset job pipeline snapshot." },
      { status: 500 }
    );
  }
}

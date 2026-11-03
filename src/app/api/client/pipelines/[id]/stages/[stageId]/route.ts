import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  isClientSession,
} from "@/lib/authenticated-session";
import {
  deletePipelineStage,
  parseAssessmentSubmissionWindow,
  updatePipelineStage,
} from "@/modules/client/pipeline/services/pipeline.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (
  process.env.DIRECTUS_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  ""
).replace(/\/$/, "");

const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const ALLOWED_COLORS = new Set(["sky", "blue", "indigo", "purple", "violet", "amber", "emerald", "rose", "zinc"]);

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    const { id, stageId } = await params;
    const pipelineId = Number(id);
    const sId = Number(stageId);
    if (!pipelineId || isNaN(pipelineId) || !sId || isNaN(sId)) {
      return NextResponse.json({ error: "Invalid parameters." }, { status: 400 });
    }

    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }
    const userId = Number(session.userId);
    const companyId = await getCompanyId(userId);
    if (!companyId) {
      return NextResponse.json({ error: "Company association not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request payload required." }, { status: 400 });
    }

    let windowDays: number | null | undefined;
    let windowProvided = false;
    if ("assessment_submission_window_days" in body) {
      windowProvided = true;
      const parsed = parseAssessmentSubmissionWindow(
        (body as { assessment_submission_window_days?: unknown }).assessment_submission_window_days
      );
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      windowDays = parsed.days;
    }

    if (windowProvided) {
      const stageRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_company_pipeline_stages/${sId}?fields=id,pipeline_id,stage_type`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (!stageRes.ok) {
        return NextResponse.json({ error: "Pipeline stage not found." }, { status: 404 });
      }
      const stageJson = (await stageRes.json()) as {
        data?: { id?: number; pipeline_id?: number; stage_type?: string };
      };
      const row = stageJson.data;
      if (!row || Number(row.pipeline_id) !== pipelineId) {
        return NextResponse.json({ error: "Pipeline stage not found." }, { status: 404 });
      }
      if (row.stage_type !== "ASSESSMENT") {
        return NextResponse.json(
          { error: "Submission window can only be set on ASSESSMENT stages." },
          { status: 422 }
        );
      }
    }

    const stageName = body.stage_name !== undefined ? String(body.stage_name).trim() : undefined;
    if (stageName !== undefined) {
      if (!stageName) return NextResponse.json({ error: "Stage name cannot be empty." }, { status: 400 });
      if (stageName.length > 100) return NextResponse.json({ error: "Stage name cannot exceed 100 characters." }, { status: 400 });
    }

    const color = body.color !== undefined ? String(body.color).trim() : undefined;
    if (color !== undefined && !ALLOWED_COLORS.has(color)) {
      return NextResponse.json({ error: "Invalid color key." }, { status: 400 });
    }

    const description = body.description !== undefined ? String(body.description).trim().slice(0, 500) : undefined;
    const stageOrder = body.stage_order !== undefined && Number.isInteger(Number(body.stage_order)) && Number(body.stage_order) > 0 ? Number(body.stage_order) : undefined;

    const success = await updatePipelineStage(pipelineId, sId, companyId, {
      stage_name: stageName,
      color,
      description,
      stage_order: stageOrder,
      ...(windowProvided ? { assessment_submission_window_days: windowDays as number | null } : {}),
    });

    if (!success) {
      return NextResponse.json({ error: "Failed to update stage." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/client/pipelines/[id]/stages/[stageId] error:", err);
    return NextResponse.json(
      { error: "Failed to update stage." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    const { id, stageId } = await params;
    const pipelineId = Number(id);
    const sId = Number(stageId);
    if (!pipelineId || isNaN(pipelineId) || !sId || isNaN(sId)) {
      return NextResponse.json({ error: "Invalid parameters." }, { status: 400 });
    }

    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    const userId = Number(session.userId);
    const companyId = await getCompanyId(userId);
    if (!companyId) {
      return NextResponse.json({ error: "Company association not found." }, { status: 404 });
    }

    const result = await deletePipelineStage(pipelineId, sId, companyId);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to delete stage." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/client/pipelines/[id]/stages/[stageId] error:", err);
    return NextResponse.json(
      { error: "Failed to delete stage." },
      { status: 500 }
    );
  }
}

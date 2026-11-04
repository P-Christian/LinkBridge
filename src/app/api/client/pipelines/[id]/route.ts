import { NextRequest, NextResponse } from "next/server";
import {
  deleteCompanyPipeline,
  getPipelineWithDetails,
  updateCompanyPipeline,
} from "@/modules/client/pipeline/services/pipeline.service";
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
    const pipelineId = Number(id);
    if (!pipelineId || isNaN(pipelineId)) {
      return NextResponse.json({ error: "Invalid pipeline ID." }, { status: 400 });
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

    const pipeline = await getPipelineWithDetails(pipelineId, companyId);
    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      pipeline,
    });
  } catch (err) {
    console.error("GET /api/client/pipelines/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve pipeline." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pipelineId = Number(id);
    if (!pipelineId || isNaN(pipelineId)) {
      return NextResponse.json({ error: "Invalid pipeline ID." }, { status: 400 });
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

    const existingPipeline = await getPipelineWithDetails(pipelineId, companyId);
    if (!existingPipeline) {
      return NextResponse.json({ error: "Pipeline not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Request payload required." }, { status: 400 });
    }

    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    if (name !== undefined) {
      if (!name) return NextResponse.json({ error: "Pipeline name cannot be empty." }, { status: 400 });
      if (name.length > 100) return NextResponse.json({ error: "Pipeline name cannot exceed 100 characters." }, { status: 400 });
    }

    const status = body.status;
    if (status !== undefined && status !== "ACTIVE" && status !== "ARCHIVED") {
      return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
    }

    const success = await updateCompanyPipeline(pipelineId, companyId, {
      name,
      is_default: body.is_default !== undefined ? Boolean(body.is_default) : undefined,
      status,
    });

    if (!success) {
      return NextResponse.json({ error: "Failed to update pipeline." }, { status: 500 });
    }

    const updated = await getPipelineWithDetails(pipelineId, companyId);

    return NextResponse.json({
      success: true,
      pipeline: updated,
    });
  } catch (err) {
    console.error("PATCH /api/client/pipelines/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update pipeline." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pipelineId = Number(id);
    if (!pipelineId || isNaN(pipelineId)) {
      return NextResponse.json({ error: "Invalid pipeline ID." }, { status: 400 });
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

    const result = await deleteCompanyPipeline(pipelineId, companyId);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to delete pipeline." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Pipeline template deleted successfully.",
    });
  } catch (err) {
    console.error("DELETE /api/client/pipelines/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete pipeline template." },
      { status: 500 }
    );
  }
}

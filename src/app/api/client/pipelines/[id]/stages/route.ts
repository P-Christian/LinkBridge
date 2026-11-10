import { NextRequest, NextResponse } from "next/server";
import { addPipelineStage } from "@/modules/client/pipeline/services/pipeline.service";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";

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

export async function POST(
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

    const body = await req.json().catch(() => null);
    const stageName = typeof body?.stage_name === "string" ? body.stage_name.trim() : "";
    if (!stageName) {
      return NextResponse.json({ error: "Stage name is required." }, { status: 400 });
    }
    if (stageName.length > 100) {
      return NextResponse.json({ error: "Stage name cannot exceed 100 characters." }, { status: 400 });
    }

    if (!body?.stage_type) {
      return NextResponse.json({ error: "Canonical stage type is required." }, { status: 400 });
    }

    const color = typeof body?.color === "string" && ALLOWED_COLORS.has(body.color.trim()) ? body.color.trim() : undefined;
    const description = typeof body?.description === "string" ? body.description.trim().slice(0, 500) : undefined;

    const stage = await addPipelineStage(pipelineId, companyId, {
      stage_name: stageName,
      stage_type: body.stage_type,
      color,
      description,
    });

    if (!stage) {
      return NextResponse.json({ error: "Failed to create stage." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      stage,
    });
  } catch (err) {
    console.error("POST /api/client/pipelines/[id]/stages error:", err);
    return NextResponse.json(
      { error: "Failed to add stage." },
      { status: 500 }
    );
  }
}

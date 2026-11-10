import { NextRequest, NextResponse } from "next/server";
import {
  createCompanyPipeline,
  getCompanyPipelines,
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
    const companyId = await getCompanyId(userId);
    if (!companyId) {
      return NextResponse.json({ error: "Company association not found." }, { status: 404 });
    }

    const pipelines = await getCompanyPipelines(companyId);

    return NextResponse.json({
      success: true,
      pipelines,
    });
  } catch (err) {
    console.error("GET /api/client/pipelines error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve pipelines." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
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
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Pipeline name is required." }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: "Pipeline name cannot exceed 100 characters." }, { status: 400 });
    }

    const newPipeline = await createCompanyPipeline(companyId, {
      name,
      is_default: Boolean(body.is_default),
    });

    if (!newPipeline) {
      return NextResponse.json({ error: "Failed to create pipeline." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      pipeline: newPipeline,
    });
  } catch (err) {
    console.error("POST /api/client/pipelines error:", err);
    return NextResponse.json(
      { error: "Failed to create pipeline." },
      { status: 500 }
    );
  }
}

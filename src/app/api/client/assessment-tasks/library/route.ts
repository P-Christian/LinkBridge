// src/app/api/client/assessment-tasks/library/route.ts
// Company-scoped assessment-task library across all pipelines/stages.
// The caller copies a row into the create form; no live reference is kept.

import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  isClientSession,
} from "@/lib/authenticated-session";
import { listCompanyAssessmentTaskLibrary } from "@/modules/client/pipeline/services/assessment-task.library";

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

async function resolveClientCompany(
  userId: string | number
): Promise<{ companyId: number | null; unavailable: boolean }> {
  const res = await fetch(
    `${DIRECTUS_BASE}/items/vs_company_user?filter[user_id][_eq]=${String(userId)}&fields=company_id&limit=1`,
    { headers: getHeaders(), cache: "no-store" }
  );
  if (!res.ok) return { companyId: null, unavailable: true };
  const json = (await res.json()) as {
    data?: Array<{ company_id?: number | string }>;
  };
  const raw = json.data?.[0]?.company_id ?? null;
  if (raw === null || raw === undefined) return { companyId: null, unavailable: false };
  const id = Number(raw);
  return {
    companyId: Number.isSafeInteger(id) && id > 0 ? id : null,
    unavailable: false,
  };
}

export async function GET(req: NextRequest) {
  const session = await authenticateRequest(req);
  if (!session)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!isClientSession(session))
    return NextResponse.json(
      { error: "Client account required." },
      { status: 403 }
    );

  const { companyId, unavailable } = await resolveClientCompany(session.userId);
  if (unavailable)
    return NextResponse.json(
      { error: "Your company association could not be read. Please try again." },
      { status: 502 }
    );
  if (!companyId)
    return NextResponse.json(
      { error: "Company association not found." },
      { status: 404 }
    );

  try {
    const result = await listCompanyAssessmentTaskLibrary(companyId);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Failed to load assessment task library." },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, tasks: result.data });
  } catch (err) {
    console.error("GET assessment-task library error:", err);
    return NextResponse.json(
      { error: "Failed to load assessment task library." },
      { status: 500 }
    );
  }
}

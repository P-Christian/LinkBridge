import { NextRequest, NextResponse } from "next/server";
import { transitionApplicationStage } from "@/modules/client/pipeline/services/job-pipeline.service";
import {
  loadCompanyApplication,
  resolveReviewerCompany,
} from "@/modules/client/assessment-review/services/context";
import { createAuditRecordRepo } from "@/modules/vos-admin/audit-trail/services/audit.repo";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (
  process.env.DIRECTUS_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  ""
).replace(/\/$/, "");

const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

type ClientScope =
  | { ok: true; userId: number; companyId: number }
  | { ok: false; error: string; status: number };

async function resolveClientScope(
  req: NextRequest,
  applicationId: number
): Promise<ClientScope> {
  const session = await authenticateRequest(req);
  if (!session) return { ok: false, error: "Unauthorized.", status: 401 };
  if (!isClientSession(session)) {
    return { ok: false, error: "Client account required.", status: 403 };
  }
  const verification = await checkCompanyVerificationStatus(Number(session.userId));
  if (!verification.isVerified) {
    return {
      ok: false,
      error: `Restricted: Your company verification status is currently ${verification.verification_status}. This action is restricted until your company is verified by an admin.`,
      status: 403,
    };
  }
  const reviewer = await resolveReviewerCompany(session.userId);
  if (reviewer.unavailable) {
    return {
      ok: false,
      error: "Your company association could not be read. Please try again.",
      status: 502,
    };
  }
  if (!reviewer.companyId) {
    return { ok: false, error: "Company association not found.", status: 403 };
  }
  const companyId = reviewer.companyId;

  const owned = await loadCompanyApplication(applicationId, companyId);
  if (owned.unavailable) {
    return {
      ok: false,
      error: "The application could not be read. Please try again.",
      status: 502,
    };
  }
  if (!owned.application) {
    return { ok: false, error: "Application not found.", status: 404 };
  }
  return { ok: true, userId: Number(session.userId), companyId };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const applicationId = Number(id);
    if (!applicationId || isNaN(applicationId)) {
      return NextResponse.json({ error: "Invalid application ID." }, { status: 400 });
    }

    const scope = await resolveClientScope(req, applicationId);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }
    const userId = scope.userId;
    const companyId = scope.companyId;

    const appCheckRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_application/${applicationId}?fields=application_id,job_id`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (appCheckRes.status === 404) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }
    if (!appCheckRes.ok) {
      return NextResponse.json(
        { error: "The application could not be verified. Please try again." },
        { status: 502 }
      );
    }
    const appCheckJson = await appCheckRes.json();
    const targetJobId = Number(appCheckJson.data?.job_id);
    if (!targetJobId) {
      return NextResponse.json({ error: "Application is not associated with a valid job." }, { status: 400 });
    }

    const jobCheckRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_posting/${targetJobId}?fields=job_id,company_id`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (jobCheckRes.status === 404) {
      return NextResponse.json({ error: "Associated job posting not found." }, { status: 404 });
    }
    if (!jobCheckRes.ok) {
      return NextResponse.json(
        { error: "The job posting could not be verified. Please try again." },
        { status: 502 }
      );
    }
    const jobCheckJson = await jobCheckRes.json();
    const jobCompanyId = Number(jobCheckJson.data?.company_id);
    if (jobCompanyId !== companyId) {
      return NextResponse.json(
        { error: "Forbidden: Candidate application belongs to another organization." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const toStageId = body?.to_stage_id ? Number(body.to_stage_id) : null;
    if (!toStageId || !Number.isSafeInteger(toStageId) || toStageId <= 0) {
      return NextResponse.json(
        { error: "to_stage_id is required and must be a positive integer." },
        { status: 400 }
      );
    }

    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 10 || reason.length > 500) {
      return NextResponse.json(
        { error: "reason is required and must be between 10 and 500 characters." },
        { status: 400 }
      );
    }

    const result = await transitionApplicationStage({
      applicationId,
      toStageId,
      changedByUserId: userId,
      changeReason: `Readiness bypassed: ${reason}`,
      notes: reason,
      bypassReadiness: { reason },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to transition candidate stage.", code: result.code },
        { status: result.statusCode || 422 }
      );
    }

    const waived = result.waived ?? [];
    createAuditRecordRepo({
      event_type: "STAGE_READINESS_BYPASS",
      event_category: "APPLICATION",
      action: "STAGE_TRANSITION",
      status: "SUCCESS",
      actor_type: "USER",
      actor_user_id: userId,
      actor_company_id: companyId,
      resource_type: "JOB_APPLICATION",
      resource_id: String(applicationId),
      organization_type: "EMPLOYER",
      organization_id: companyId,
      reason,
      old_values: { from_stage_id: result.fromStage?.id ?? null, waived },
      new_values: { to_stage_id: toStageId, bypassed: true },
    }).catch((err) => console.error("[Stage Readiness Bypass Audit] Error:", err));

    return NextResponse.json({
      success: true,
      moved: result.moved ?? true,
      bypassed: true,
      waived,
      application: result.application,
      from_stage: result.fromStage,
      to_stage: result.toStage,
    });
  } catch (err: unknown) {
    console.error("POST /api/client/applicants/[id]/stage/bypass error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

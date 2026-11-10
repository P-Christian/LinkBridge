import { NextRequest, NextResponse } from "next/server";
import {
  getAssessmentMoveRequirement,
  notifyFreelancerOfAssessmentOutcome,
  transitionApplicationStage,
} from "@/modules/client/pipeline/services/job-pipeline.service";
import {
  loadCompanyApplication,
  resolveReviewerCompany,
} from "@/modules/client/assessment-review/services/context";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { createNotification } from "@/lib/notifications";
import { createSystemMessage } from "@/lib/messaging/system-message";

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

// Signed session required; proves the application's job belongs to the
// caller's company and fails closed (404) so existence is not leaked.
async function resolveClientScope(
  req: NextRequest,
  applicationId: number
): Promise<ClientScope> {
  const session = await authenticateRequest(req);
  if (!session) return { ok: false, error: "Unauthorized.", status: 401 };
  if (!isClientSession(session)) {
    return { ok: false, error: "Client account required.", status: 403 };
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

// Move-time pre-check for the assessment confirm flow: reports whether moving
// the application to `to_stage_id` requires an assessment_outcome. Read-only;
// the PATCH below remains authoritative.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const applicationId = Number(id);
  if (!applicationId || isNaN(applicationId)) {
    return NextResponse.json({ error: "Invalid application ID." }, { status: 400 });
  }

  const scope = await resolveClientScope(req, applicationId);
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  const toStageId = Number(new URL(req.url).searchParams.get("to_stage_id"));
  if (!toStageId || isNaN(toStageId)) {
    return NextResponse.json(
      { error: "to_stage_id query parameter is required and must be a valid number." },
      { status: 400 }
    );
  }

  const requirement = await getAssessmentMoveRequirement({ applicationId, toStageId });
  if (requirement.error) {
    return NextResponse.json(
      { error: requirement.error },
      { status: requirement.statusCode ?? 422 }
    );
  }

  return NextResponse.json({
    requires_outcome: requirement.requiresOutcome,
    from_stage: requirement.fromStage ?? null,
    to_stage: requirement.toStage ?? null,
  });
}

export async function PATCH(
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

    // IDOR Protection: Verify application belongs to a job owned by this company
    const appCheckRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_application/${applicationId}?fields=application_id,job_id`,
      { headers: getHeaders(), cache: "no-store" }
    );
    // Only 404 means the application is gone. Other failures have to stay
    // distinguishable or an outage reads to the recruiter as "this candidate's
    // application does not exist".
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

    if (!toStageId || isNaN(toStageId)) {
      return NextResponse.json(
        { error: "to_stage_id is required and must be a valid number." },
        { status: 400 }
      );
    }

    const rawOutcome = body?.assessment_outcome;
    let assessmentOutcome: "PASS" | "FAIL" | undefined;
    if (rawOutcome !== undefined && rawOutcome !== null) {
      if (rawOutcome !== "PASS" && rawOutcome !== "FAIL") {
        return NextResponse.json(
          { error: 'assessment_outcome must be "PASS" or "FAIL" when provided.' },
          { status: 400 }
        );
      }
      assessmentOutcome = rawOutcome;
    }
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 1000) : undefined;

    const result = await transitionApplicationStage({
      applicationId,
      toStageId,
      changedByUserId: userId,
      changeReason: notes,
      notes,
      assessmentOutcome,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to transition candidate stage." },
        { status: result.statusCode || 422 }
      );
    }

    // FAIL outcome records on the attempt and STAYS: no transition, no
    // history write (service returns before those steps). The service
    // already emitted ASSESSMENT_FAILED best-effort; this backup covers
    // the FAIL-stay path idempotently if the service write raced.
    if (result.moved === false) {
      const failApp = result.application as Record<string, unknown> | undefined;
      const failFreelancerId = failApp?.user_id ? Number(failApp.user_id) : null;
      if (result.outcome === "FAIL" && failFreelancerId && result.fromStage) {
        notifyFreelancerOfAssessmentOutcome({
          applicationId,
          freelancerUserId: failFreelancerId,
          actingUserId: userId,
          fromStageName: result.fromStage.stage_name,
          outcome: "FAIL",
        }).catch((err) => console.error("[Candidate Stage Notification] Error:", err));
      }
      return NextResponse.json({
        success: true,
        moved: false,
        outcome: result.outcome ?? assessmentOutcome ?? null,
        message: `Assessment marked as failed — candidate stays at "${result.fromStage?.stage_name ?? "the assessment stage"}".`,
        application: result.application,
        from_stage: result.fromStage,
        to_stage: result.toStage,
        noop: result.noop ?? false,
      });
    }
    // Dispatch background notifications if moved to a new stage.
    if (!result.noop && result.toStage && result.application) {
      const appData = result.application as Record<string, unknown>;
      const jobseekerId = appData.user_id ? Number(appData.user_id) : null;
      const jobId = appData.job_id ? Number(appData.job_id) : null;

      // Fetch job title for clean notification
      let jobTitle = "Job Posting";
      if (jobId) {
        try {
          const jRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_posting/${jobId}?fields=job_title`, {
            headers: getHeaders(),
            cache: "no-store",
          });
          if (jRes.ok) {
            const jJson = await jRes.json();
            jobTitle = jJson.data?.job_title || jobTitle;
          }
        } catch {}
      }

      if (jobseekerId) {
        // Sanitize dynamic stage name to prevent phishing/markup injection
        const cleanStageName =
          result.toStage.stage_name
            .replace(/[^\w\s\-().,/]/g, "")
            .trim()
            .slice(0, 50) || "Updated Stage";

        createNotification({
          event_type: "application_status_changed",
          recipient_user_id: jobseekerId,
          entity_type: "job_application",
          entity_id: applicationId,
          category: "APPLICATION_STATUS_UPDATED",
          title: `Application Moved to ${cleanStageName}`,
          message: `Your application for "${jobTitle}" has progressed to "${cleanStageName}".`,
          action_url: "/linkbridge/freelancer/applications",
        }).catch((err) => console.error("[Candidate Stage Notification] Error:", err));

        // System message inside conversation if available
        const fromStageName = result.fromStage?.stage_name ? result.fromStage.stage_name.trim() : null;
        const systemText =
          result.toStage.stage_type === "HIRED"
            ? "Candidate was hired."
            : fromStageName
            ? `Stage updated: ${fromStageName} ➔ ${cleanStageName}`
            : `Application moved to stage: ${cleanStageName}`;

        const statusEventType =
          result.toStage.stage_type === "HIRED" ? "HIRED" : "APPLICATION_STATUS_CHANGED";

        createSystemMessage({
          clientId: userId,
          freelancerId: jobseekerId,
          jobId: jobId,
          text: systemText,
          senderId: userId,
          systemEventType: statusEventType,
          applicationId: applicationId,
          stageHistoryId: result.stageHistoryId ?? null,
        }).catch((e) => console.error("[Stage System Message] Error:", e));
      }

      if (result.outcome === "PASS" && jobseekerId && result.fromStage) {
        notifyFreelancerOfAssessmentOutcome({
          applicationId,
          freelancerUserId: jobseekerId,
          actingUserId: userId,
          fromStageName: result.fromStage.stage_name,
          outcome: "PASS",
        }).catch((err) => console.error("[Candidate Stage Notification] Error:", err));
      }
    }

    return NextResponse.json({
      success: true,
      moved: result.moved ?? true,
      outcome: result.outcome ?? assessmentOutcome ?? null,
      message: result.noop
        ? `Application is already in "${result.toStage?.stage_name}".`
        : `Application moved to "${result.toStage?.stage_name}".`,
      application: result.application,
      from_stage: result.fromStage,
      to_stage: result.toStage,
      noop: result.noop ?? false,
    });
  } catch (err: unknown) {
    console.error("PATCH /api/client/applicants/[id]/stage error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

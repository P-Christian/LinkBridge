// Employer assessment review: GET attempt history + employer task view,
// POST review actions. Client-only; correct_choice_key never leaves this
// employer surface. Never moves the application stage.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import {
  loadCompanyApplication,
  resolveAssessmentHistory,
  resolveReviewContext,
  resolveReviewerCompany,
} from "@/modules/client/assessment-review/services/context";
import {
  readAssessmentReview,
  readStageHistories,
} from "@/modules/client/assessment-review/services/read";
import { resolveAssessmentDeadline } from "@/modules/freelancer/freelancer-applications/services/assessment/deadline";
import {
  applyReviewAction,
  type ReviewPostAction,
} from "@/modules/client/assessment-review/services/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function parseApplicationId(raw: string): number | null {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await authenticateRequest(req);
  if (!session) return errorResponse("Unauthorized.", 401);
  if (!isClientSession(session)) return errorResponse("Client account required.", 403);

  const { id } = await params;
  const applicationId = parseApplicationId(id);
  if (!applicationId) return errorResponse("Application not found.", 404);

  const reviewer = await resolveReviewerCompany(session.userId);
  if (reviewer.unavailable) {
    return errorResponse("Your company association could not be read. Please try again.", 502);
  }
  if (!reviewer.companyId) return errorResponse("Company association not found.", 403);
  const companyId = reviewer.companyId;

  try {
    const owned = await loadCompanyApplication(applicationId, companyId);
    if (owned.unavailable) {
      return errorResponse("The application could not be read. Please try again.", 502);
    }
    if (!owned.application) return errorResponse("Application not found.", 404);
    const application = owned.application;
    const context = await resolveReviewContext(application);
    const history = await resolveAssessmentHistory(application);
    if (context.kind === "empty") {
      const stages = await readStageHistories(history, applicationId);
      return NextResponse.json(
        { application_id: applicationId, stage_id: application.current_stage_id, tasks: [], attempts: [], stages, deadline: null },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const view = await readAssessmentReview(context);
    const stages = await readStageHistories(history, applicationId);
    const deadline = await resolveAssessmentDeadline(applicationId, context.stageId);
    return NextResponse.json({ ...view, stages, deadline }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[client-assessment-review] read error:", error);
    return errorResponse("Assessment review could not be loaded.", 502);
  }
}

const REVIEW_ACTIONS: readonly ReviewPostAction[] = [
  "START_REVIEW",
  "PASS",
  "FAIL",
  "REQUEST_REVISION",
];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await authenticateRequest(req);
  if (!session) return errorResponse("Unauthorized.", 401);
  if (!isClientSession(session)) return errorResponse("Client account required.", 403);

  const { id } = await params;
  const applicationId = parseApplicationId(id);
  if (!applicationId) return errorResponse("Application not found.", 404);

  const reviewer = await resolveReviewerCompany(session.userId);
  if (reviewer.unavailable) {
    return errorResponse("Your company association could not be read. Please try again.", 502);
  }
  if (!reviewer.companyId) return errorResponse("Company association not found.", 403);
  const companyId = reviewer.companyId;

  const body = (await req.json().catch(() => null)) as {
    action?: unknown;
    attempt_id?: unknown;
    review_notes?: unknown;
  } | null;
  const action = body?.action;
  const attemptId = Number(body?.attempt_id);
  if (typeof action !== "string" || !REVIEW_ACTIONS.includes(action as ReviewPostAction)) {
    return errorResponse("action must be START_REVIEW, PASS, FAIL, or REQUEST_REVISION.", 400);
  }
  if (!Number.isSafeInteger(attemptId) || attemptId <= 0) {
    return errorResponse("attempt_id is required and must be a valid number.", 400);
  }
  const reviewNotes =
    typeof body?.review_notes === "string" ? body.review_notes : null;

  try {
    const owned = await loadCompanyApplication(applicationId, companyId);
    if (owned.unavailable) {
      return errorResponse("The application could not be read. Please try again.", 502);
    }
    if (!owned.application) return errorResponse("Application not found.", 404);
    const context = await resolveReviewContext(owned.application);
    if (context.kind === "empty") {
      return errorResponse("No assessment is available for this application stage.", 409);
    }
    const reviewerId = Number(session.userId);
    const result = await applyReviewAction(context, {
      attemptId,
      action: action as ReviewPostAction,
      reviewNotes,
      reviewerUserId: Number.isSafeInteger(reviewerId) ? reviewerId : 0,
    });
    if (!result.ok) return errorResponse(result.error, result.status);
    return NextResponse.json(
      {
        attempt: result.attempt,
        successor: result.successor,
        already_applied: result.alreadyApplied,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[client-assessment-review] review error:", error);
    return errorResponse("Assessment review could not be completed.", 502);
  }
}

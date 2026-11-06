// Employer review actions on assessment attempts. Uses the shared state
// machine only; never touches vs_job_application stage/status columns and
// never calls the pipeline transition service.

import { createNotification } from "@/lib/notifications";
import {
  applyAttemptAction,
  AssessmentTransitionError,
  createRevisionAttempt,
  toAttemptDTO,
  type AssessmentAttemptDTO,
  type AttemptAction,
  type PersistedAttemptStatus,
} from "@/modules/shared/assessment";
import type { ActiveReviewContext } from "./context";
import { directusGetOne, directusList, directusPatch, directusPost, nowPH } from "./directus";

export type ReviewPostAction = "START_REVIEW" | "PASS" | "FAIL" | "REQUEST_REVISION";

export type ReviewResult =
  | { ok: true; attempt: AssessmentAttemptDTO; successor: AssessmentAttemptDTO | null; alreadyApplied: boolean }
  | { ok: false; status: number; error: string };

const ACTION_MAP: Record<ReviewPostAction, AttemptAction> = {
  START_REVIEW: "BEGIN_REVIEW",
  PASS: "MARK_PASSED",
  FAIL: "MARK_FAILED",
  REQUEST_REVISION: "REQUEST_REVISION",
};

const REVIEW_NOTES_MAX_LENGTH = 5000;

function actionNeedsNotes(action: ReviewPostAction): boolean {
  return action === "FAIL" || action === "REQUEST_REVISION";
}

function notifyEventFor(action: ReviewPostAction): {
  event: string;
  category: string;
  title: string;
  message: string;
} {
  if (action === "PASS") {
    return {
      event: "ASSESSMENT_PASSED",
      category: "ASSESSMENT_PASSED",
      title: "Assessment passed",
      message: "Your assessment has been marked as passed.",
    };
  }
  if (action === "FAIL") {
    return {
      event: "ASSESSMENT_FAILED",
      category: "ASSESSMENT_FAILED",
      title: "Assessment result",
      message: "Your assessment has been reviewed. Please check the reviewer notes.",
    };
  }
  return {
    event: "ASSESSMENT_NEEDS_REVISION",
    category: "ASSESSMENT_NEEDS_REVISION",
    title: "Assessment needs revision",
    message: "Your assessment needs revision. Please check the reviewer notes and resubmit.",
  };
}

async function findAttemptInContext(
  context: ActiveReviewContext,
  attemptId: number,
): Promise<Record<string, unknown> | null> {
  const row = await directusGetOne("vs_application_assessment_attempts", attemptId, "*");
  if (!row) return null;
  if (Number(row.application_id) !== context.application.application_id) return null;
  if (Number(row.job_stage_id) !== context.stageId) return null;
  return row;
}

async function findSuccessor(reviewedAttemptId: number): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    "filter[predecessor_attempt_id][_eq]": String(reviewedAttemptId),
    fields: "id,application_id,job_stage_id,attempt_number,predecessor_attempt_id,status,submitted_at,reviewed_at,reviewed_by,review_notes",
    limit: "1",
  });
  const rows = await directusList("vs_application_assessment_attempts", params);
  return rows[0] ?? null;
}

function toDTO(row: Record<string, unknown>): AssessmentAttemptDTO {
  return toAttemptDTO({
    id: Number(row.id),
    application_id: Number(row.application_id),
    job_stage_id: Number(row.job_stage_id),
    attempt_number: Number(row.attempt_number),
    predecessor_attempt_id:
      row.predecessor_attempt_id === null || row.predecessor_attempt_id === undefined
        ? null
        : Number(row.predecessor_attempt_id),
    status: row.status as PersistedAttemptStatus,
    submitted_at: typeof row.submitted_at === "string" ? row.submitted_at : null,
    reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    reviewed_by: typeof row.reviewed_by === "number" ? row.reviewed_by : null,
    review_notes: typeof row.review_notes === "string" ? row.review_notes : null,
  });
}

export async function applyReviewAction(
  context: ActiveReviewContext,
  input: { attemptId: number; action: ReviewPostAction; reviewNotes: string | null; reviewerUserId: number },
): Promise<ReviewResult> {
  if (actionNeedsNotes(input.action) && !input.reviewNotes?.trim()) {
    return { ok: false, status: 422, error: "Review notes are required for this action." };
  }
  if ((input.reviewNotes?.trim() ?? "").length > REVIEW_NOTES_MAX_LENGTH) {
    return { ok: false, status: 422, error: "Review notes must not exceed 5000 characters." };
  }
  const row = await findAttemptInContext(context, input.attemptId);
  if (!row) return { ok: false, status: 404, error: "Assessment attempt not found." };
  const current = row.status as PersistedAttemptStatus;

  let nextStatus: PersistedAttemptStatus;
  try {
    nextStatus = applyAttemptAction(current, ACTION_MAP[input.action]);
  } catch (error) {
    if (error instanceof AssessmentTransitionError) {
      const status = error.code === "ILLEGAL_TRANSITION" || error.code === "PRECONDITION" ? 422 : 409;
      return { ok: false, status, error: error.message };
    }
    return { ok: false, status: 409, error: "Review action is not allowed for this attempt." };
  }

  // Idempotent repeat: already in the target status, no write, no notify.
  // A repeated revision request returns the existing linked successor so a
  // duplicate never creates a second successor attempt.
  if (nextStatus === current) {
    if (input.action === "REQUEST_REVISION") {
      const repeatExisting = await findSuccessor(input.attemptId);
      return {
        ok: true,
        attempt: toDTO(row),
        successor: repeatExisting ? toDTO(repeatExisting) : null,
        alreadyApplied: true,
      };
    }
    return { ok: true, attempt: toDTO(row), successor: null, alreadyApplied: true };
  }

  const reviewedAt = nowPH();
  const patchBody: Record<string, unknown> = {
    status: nextStatus,
    reviewed_at: reviewedAt,
    reviewed_by: input.reviewerUserId,
    review_notes: input.reviewNotes?.trim() ? input.reviewNotes.trim() : row.review_notes ?? null,
  };
  const patched = await directusPatch("vs_application_assessment_attempts", input.attemptId, patchBody);
  if (!patched) return { ok: false, status: 502, error: "Review action could not be saved." };

  let successor: AssessmentAttemptDTO | null = null;
  if (input.action === "REQUEST_REVISION") {
    const existing = await findSuccessor(input.attemptId);
    if (existing) {
      successor = toDTO(existing);
    } else {
      const revision = createRevisionAttempt(
        {
          id: input.attemptId,
          application_id: context.application.application_id,
          job_stage_id: context.stageId,
          attempt_number: Number(row.attempt_number),
          predecessor_attempt_id: null,
          status: "NEEDS_REVISION",
          submitted_at: null,
          reviewed_at: null,
          reviewed_by: null,
          review_notes: null,
        },
        0,
      );
      const created = await directusPost("vs_application_assessment_attempts", {
        application_id: revision.application_id,
        job_stage_id: revision.job_stage_id,
        attempt_number: revision.attempt_number,
        predecessor_attempt_id: input.attemptId,
        status: "IN_PROGRESS",
        submitted_at: null,
        reviewed_at: null,
        reviewed_by: null,
        review_notes: null,
      });
      if (!created.ok || !created.row) {
        return { ok: false, status: 502, error: "Revision attempt could not be created." };
      }
      const successorId = Number(created.row.id);
      // Copy predecessor responses as editable starting values (same proof refs).
      const copyParams = new URLSearchParams({
        "filter[attempt_id][_eq]": String(input.attemptId),
        fields: "job_task_id,selected_choice_key,response_text,proof_file_id,proof_file_name",
        limit: "-1",
      });
      const prior = await directusList("vs_application_assessment_responses", copyParams);
      for (const entry of prior) {
        await directusPost("vs_application_assessment_responses", {
          attempt_id: successorId,
          job_task_id: Number(entry.job_task_id),
          selected_choice_key: typeof entry.selected_choice_key === "string" ? entry.selected_choice_key : null,
          response_text: typeof entry.response_text === "string" ? entry.response_text : null,
          proof_file_id: typeof entry.proof_file_id === "string" ? entry.proof_file_id : null,
          proof_file_name: typeof entry.proof_file_name === "string" ? entry.proof_file_name : null,
        });
      }
      successor = toDTO({
        ...created.row,
        application_id: revision.application_id,
        job_stage_id: revision.job_stage_id,
        attempt_number: revision.attempt_number,
        predecessor_attempt_id: input.attemptId,
        status: "IN_PROGRESS",
      });
    }
  }

  // Outcome notifications go to the freelancer only; never the acting client.
  if (input.action === "PASS" || input.action === "FAIL" || input.action === "REQUEST_REVISION") {
    const meta = notifyEventFor(input.action);
    const freelancerId = Number(context.application.user_id);
    if (Number.isSafeInteger(freelancerId) && freelancerId > 0 && freelancerId !== input.reviewerUserId) {
      try {
        const alreadyNotified = await directusList(
          "vs_notification_event",
          new URLSearchParams({
            "filter[event_type][_eq]": meta.event,
            "filter[entity_type][_eq]": "job_application",
            "filter[entity_id][_eq]": String(context.application.application_id),
            fields: "event_id",
            limit: "1",
          }),
        );
        if (alreadyNotified.length === 0) {
          await createNotification({
            event_type: meta.event,
            recipient_user_id: freelancerId,
            entity_type: "job_application",
            entity_id: context.application.application_id,
            category: meta.category,
            title: meta.title,
            message: meta.message,
            action_url: `/linkbridge/freelancer/applications?assessment=${context.application.application_id}`,
          }).catch((error: unknown) => console.error("[assessment-review] notify error:", error));
        }
      } catch (error) {
        console.error("[assessment-review] notify dedupe check failed:", error);
      }
    }
  }

  const updated = await directusGetOne("vs_application_assessment_attempts", input.attemptId, "*");
  return {
    ok: true,
    attempt: toDTO(updated ?? { ...row, ...patchBody, id: input.attemptId }),
    successor,
    alreadyApplied: false,
  };
}

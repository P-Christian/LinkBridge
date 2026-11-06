// Assessment submit: required-response validation, state-machine transition,
// and hiring-team notification. Never moves the application stage.

import { createNotification } from "@/lib/notifications";
import {
  applyAttemptAction,
  validateTaskResponse,
  type AssessmentAttemptDTO,
  type TaskResponseValidation,
} from "@/modules/shared/assessment";
import { toAttemptDTO } from "@/modules/shared/assessment";
import type { ActiveAssessmentContext } from "./context";
import { directusGetOne, directusList, nowPH } from "./directus";
import { asValidatableTask } from "./snapshot";
import { loadLatestAttempt, loadResponseRows, persistAttemptSubmit } from "./store";

export interface SubmitIssue {
  job_task_id: number;
  message: string;
}

export type SubmitResult =
  | { ok: true; attempt: AssessmentAttemptDTO; alreadySubmitted: boolean }
  | { ok: false; status: 409 | 422 | 502; error: string; issues?: SubmitIssue[] };

function submitInputFor(
  taskType: string,
  selected: string | null,
  text: string | null,
  proofId: string | null,
  proofName: string | null,
): Record<string, unknown> {
  if (taskType === "SINGLE_CHOICE") {
    return { task_type: taskType, selected_choice_key: selected ?? "" };
  }
  if (taskType === "TEXT_RESPONSE" || taskType === "EXTERNAL_TASK") {
    return { task_type: taskType, response_text: text ?? "" };
  }
  return {
    task_type: taskType,
    proof_file_id: proofId ?? "",
    proof_file_name: proofName,
  };
}

function issueMessage(result: TaskResponseValidation): string {
  const issues = result.error?.issues ?? [];
  return (
    issues
      .map((issue) => `${issue.path.map(String).join(".") || "value"}: ${issue.message}`)
      .join("; ") || "Invalid response."
  );
}

async function notifyHiringUsers(
  jobId: number,
  applicationId: number,
  freelancerUserId: string | number,
): Promise<void> {
  try {
    const job = await directusGetOne("vs_job_posting", jobId, "job_id,job_title,company_id");
    const companyId = job ? Number(job.company_id) : NaN;
    if (!Number.isSafeInteger(companyId) || companyId <= 0) return;
    const params = new URLSearchParams({
      "filter[company_id][_eq]": String(companyId),
      fields: "user_id",
      limit: "100",
    });
    const links = await directusList("vs_company_user", params);
    const recipients = new Set<number>();
    for (const link of links) {
      const userId = Number(link.user_id);
      if (Number.isSafeInteger(userId) && userId > 0 && userId !== Number(freelancerUserId)) {
        recipients.add(userId);
      }
    }
    const jobTitle = job && typeof job.job_title === "string" ? job.job_title : `job #${jobId}`;
    for (const recipientId of recipients) {
      await createNotification({
        event_type: "ASSESSMENT_SUBMITTED",
        recipient_user_id: recipientId,
        entity_type: "job_application",
        entity_id: applicationId,
        category: "ASSESSMENT_SUBMITTED",
        title: "Assessment submitted",
        message: `A candidate submitted their assessment for "${jobTitle}".`,
        action_url: `/linkbridge/client/applicants/${applicationId}`,
      }).catch((error: unknown) => console.error("[freelancer-assessment] notify error:", error));
    }
  } catch (error) {
    console.error("[freelancer-assessment] hiring-team notification failed:", error);
  }
}

export async function submitAssessment(
  context: ActiveAssessmentContext,
  freelancerUserId: string | number,
): Promise<SubmitResult> {
  const attempt = await loadLatestAttempt(
    context.application.application_id,
    context.stageId,
  );
  if (!attempt) {
    return { ok: false, status: 409, error: "No assessment attempt exists. Save a draft first." };
  }
  if (attempt.status === "SUBMITTED") return { ok: true, attempt: toAttemptDTO(attempt), alreadySubmitted: true };

  let nextStatus: ReturnType<typeof applyAttemptAction>;
  try {
    nextStatus = applyAttemptAction(attempt.status, "SUBMIT");
  } catch {
    return { ok: false, status: 409, error: `Submit is not allowed when the attempt is ${attempt.status}.` };
  }

  const rows = await loadResponseRows(attempt.id);
  const rowByTask = new Map(rows.map((row) => [row.job_task_id, row]));
  for (const row of rows) {
    if (!context.taskById.has(row.job_task_id)) {
      return {
        ok: false,
        status: 422,
        error: "Responses reference tasks outside this assessment stage.",
        issues: [{ job_task_id: row.job_task_id, message: "job_task_id is not part of the current stage." }],
      };
    }
  }

  const issues: SubmitIssue[] = [];
  for (const row of context.rows) {
    const snapshot = context.taskById.get(row.id);
    if (!snapshot || !snapshot.is_required) continue;
    const stored = rowByTask.get(row.id);
    const result = validateTaskResponse(
      asValidatableTask(snapshot),
      submitInputFor(
        snapshot.task_type,
        stored?.selected_choice_key ?? null,
        stored?.response_text ?? null,
        stored?.proof_file_id ?? null,
        stored?.proof_file_name ?? null,
      ),
      "submit",
    );
    if (!result.success) {
      issues.push({ job_task_id: row.id, message: issueMessage(result) });
    }
  }
  if (issues.length > 0) {
    return { ok: false, status: 422, error: "Required assessment tasks are missing or invalid.", issues };
  }

  const submittedAt = nowPH();
  const persisted = await persistAttemptSubmit(attempt.id, nextStatus, submittedAt);
  if (!persisted) return { ok: false, status: 502, error: "Assessment submit could not be saved." };

  await notifyHiringUsers(
    context.application.job_id,
    context.application.application_id,
    freelancerUserId,
  );
  return {
    ok: true,
    attempt: toAttemptDTO({ ...attempt, status: nextStatus, submitted_at: submittedAt }),
    alreadySubmitted: false,
  };
}

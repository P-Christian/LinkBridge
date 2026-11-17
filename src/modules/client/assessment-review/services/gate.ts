// ASSESSMENT progression gate for transitionApplicationStage. A configured
// (non-universal) move out of a stage with required assessment tasks is gated
// on actual submission state: required tasks must be answered and the latest
// attempt submitted before a move-time assessment_outcome ("PASS" | "FAIL")
// is accepted. Universal REJECTED/WITHDRAWN exits and stages without required
// tasks always pass.

import type { JobPipelineStage } from "@/modules/client/pipeline/types";
import { directusList, directusPatch, directusPost, nowPH } from "./directus";

export type AssessmentOutcome = "PASS" | "FAIL";

export function isValidAssessmentOutcome(value: unknown): value is AssessmentOutcome {
  return value === "PASS" || value === "FAIL";
}

export interface RequiredAssessmentStatus {
  hasTasks: boolean; // any task row on the stage
  hasRequiredTasks: boolean; // at least one is_required = true
  requiredPending: boolean; // required work is not submitted/complete
  latestStatus: string | null; // latest attempt status for (application, stage)
}

function isNonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRequiredFlag(value: unknown): boolean {
  return value === true || value === 1;
}

function isSubmittedStatus(status: string | null): boolean {
  return status === "SUBMITTED" || status === "UNDER_REVIEW" || status === "PASSED";
}

function isTaskAnswered(taskType: unknown, response: Record<string, unknown> | undefined): boolean {
  if (!response) return false;
  switch (String(taskType)) {
    case "SINGLE_CHOICE":
      return isNonBlank(response["selected_choice_key"]);
    case "TEXT_RESPONSE":
    case "EXTERNAL_TASK":
      return isNonBlank(response["response_text"]);
    case "FILE_UPLOAD":
      return isNonBlank(response["proof_file_id"]);
    default:
      return false;
  }
}

/**
 * Reads the required-task submission state for (application, stage).
 * Fail-closed: every read error propagates to the caller.
 */
export async function getRequiredAssessmentStatus(input: {
  applicationId: number;
  stageId: number;
}): Promise<RequiredAssessmentStatus> {
  const taskParams = new URLSearchParams({
    "filter[job_stage_id][_eq]": String(input.stageId),
    fields: "id,task_type,is_required,sort_order",
    limit: "-1",
  });
  const taskRows = await directusList("vs_job_pipeline_assessment_tasks", taskParams);
  if (taskRows.length === 0) {
    return { hasTasks: false, hasRequiredTasks: false, requiredPending: false, latestStatus: null };
  }
  const requiredTasks = taskRows.filter((row) => isRequiredFlag(row["is_required"]));
  if (requiredTasks.length === 0) {
    return { hasTasks: true, hasRequiredTasks: false, requiredPending: false, latestStatus: null };
  }

  const attemptParams = new URLSearchParams({
    "filter[application_id][_eq]": String(input.applicationId),
    "filter[job_stage_id][_eq]": String(input.stageId),
    fields: "id,status,attempt_number",
    "sort[]": "-attempt_number",
    limit: "1",
  });
  const attemptRows = await directusList("vs_application_assessment_attempts", attemptParams);
  const latestAttempt = attemptRows[0];
  const latestId = latestAttempt?.["id"];
  const latestStatus =
    typeof latestAttempt?.["status"] === "string" ? (latestAttempt["status"] as string) : null;
  if (latestId === undefined || latestId === null) {
    return { hasTasks: true, hasRequiredTasks: true, requiredPending: true, latestStatus };
  }

  const responseParams = new URLSearchParams({
    "filter[attempt_id][_eq]": String(Number(latestId)),
    fields: "job_task_id,selected_choice_key,response_text,proof_file_id,proof_file_name",
    limit: "-1",
  });
  const responseRows = await directusList("vs_application_assessment_responses", responseParams);
  const responseByTaskId = new Map<number, Record<string, unknown>>();
  for (const row of responseRows) {
    const taskId = Number(row["job_task_id"]);
    if (Number.isSafeInteger(taskId) && !responseByTaskId.has(taskId)) {
      responseByTaskId.set(taskId, row);
    }
  }

  const allRequiredAnswered = requiredTasks.every((task) =>
    isTaskAnswered(task["task_type"], responseByTaskId.get(Number(task["id"]))),
  );
  const requiredPending = !allRequiredAnswered || !isSubmittedStatus(latestStatus);
  return { hasTasks: true, hasRequiredTasks: true, requiredPending, latestStatus };
}

/**
 * True when a move out of `fromStage` must carry a move-time assessment
 * outcome: a configured (non-universal) route off a stage with required
 * assessment tasks. Universal exits and task-free stages bypass.
 */
export async function isQualifyingAssessmentMove(input: {
  fromStage: JobPipelineStage;
  isUniversalExit: boolean;
  hasConfiguredTransition: boolean;
  applicationId?: number;
}): Promise<boolean> {
  if (input.isUniversalExit) return false;
  if (!input.hasConfiguredTransition) return false;

  if (input.applicationId !== undefined) {
    const status = await getRequiredAssessmentStatus({
      applicationId: input.applicationId,
      stageId: input.fromStage.id,
    });
    return status.hasRequiredTasks;
  }

  const taskParams = new URLSearchParams({
    "filter[job_stage_id][_eq]": String(input.fromStage.id),
    fields: "id,task_type,is_required,sort_order",
    limit: "-1",
  });
  const taskRows = await directusList("vs_job_pipeline_assessment_tasks", taskParams);
  return taskRows.some((row) => isRequiredFlag(row["is_required"]));
}

export type AssessmentGateResult =
  | { error: string; statusCode: 409 | 422 | 503; code: string }
  | null;

export async function checkAssessmentGate(input: {
  applicationId: number;
  fromStage: JobPipelineStage;
  isUniversalExit: boolean;
  hasConfiguredTransition: boolean;
  assessmentOutcome: unknown;
}): Promise<AssessmentGateResult> {
  if (input.isUniversalExit) return null;

  let status: RequiredAssessmentStatus;
  try {
    status = await getRequiredAssessmentStatus({
      applicationId: input.applicationId,
      stageId: input.fromStage.id,
    });
  } catch (error) {
    console.error("[assessment-review] gate lookup failed:", error);
    return {
      error: "Assessment progress could not be verified. Please try again.",
      statusCode: 503,
      code: "ASSESSMENT_CHECK_FAILED",
    };
  }

  if (!status.hasRequiredTasks) return null;

  if (status.requiredPending) {
    if (input.assessmentOutcome === "FAIL") return null;
    return {
      error:
        "Required assessment tasks are not complete. The candidate cannot advance until the assessment is submitted.",
      statusCode: 422,
      code: "ASSESSMENT_REQUIRED_PENDING",
    };
  }

  if (!isValidAssessmentOutcome(input.assessmentOutcome)) {
    return {
      error:
        "An assessment decision (Pass or Fail) is required to move this candidate out of the assessment stage.",
      statusCode: 409,
      code: "ASSESSMENT_OUTCOME_REQUIRED",
    };
  }
  if (input.assessmentOutcome === "FAIL") return null;

  if (!isSubmittedStatus(status.latestStatus)) {
    return {
      error: "This assessment has not been submitted. Request a revision or reject the candidate.",
      statusCode: 409,
      code: "ASSESSMENT_NOT_SUBMITTED",
    };
  }
  return null;
}

/**
 * Records the move-time outcome on the latest attempt for
 * (application_id, job_stage_id): sets status to PASSED/FAILED with
 * reviewed_at/reviewed_by. Creates attempt_number 1 in the decided terminal
 * status when no attempt row exists yet.
 */
export async function recordAssessmentMoveOutcome(input: {
  applicationId: number;
  jobStageId: number;
  outcome: AssessmentOutcome;
  reviewedBy: number | null;
}): Promise<string | null> {
  const status = input.outcome === "PASS" ? "PASSED" : "FAILED";
  const reviewedAt = nowPH();
  try {
    const attemptParams = new URLSearchParams({
      "filter[application_id][_eq]": String(input.applicationId),
      "filter[job_stage_id][_eq]": String(input.jobStageId),
      fields: "id,attempt_number,status",
      "sort[]": "-attempt_number",
      limit: "1",
    });
    const attemptRows = await directusList("vs_application_assessment_attempts", attemptParams);
    const latestId = attemptRows[0]?.["id"];

    if (latestId !== undefined && latestId !== null) {
      const saved = await directusPatch("vs_application_assessment_attempts", Number(latestId), {
        status,
        reviewed_at: reviewedAt,
        reviewed_by: input.reviewedBy,
      });
      if (!saved) return "The assessment decision could not be saved. Please try again.";
      return null;
    }

    const created = await directusPost("vs_application_assessment_attempts", {
      application_id: input.applicationId,
      job_stage_id: input.jobStageId,
      attempt_number: 1,
      predecessor_attempt_id: null,
      status,
      submitted_at: null,
      reviewed_at: reviewedAt,
      reviewed_by: input.reviewedBy,
      review_notes: null,
    });
    if (!created.ok) return "The assessment decision could not be saved. Please try again.";
    return null;
  } catch (error) {
    console.error("[assessment-review] outcome record failed:", error);
    return "The assessment decision could not be saved. Please try again.";
  }
}

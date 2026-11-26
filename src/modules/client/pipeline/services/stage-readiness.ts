// src/modules/client/pipeline/services/stage-readiness.ts

import { getRequiredAssessmentStatus } from "@/modules/client/assessment-review/services/gate";

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

export type ReadinessCode =
  | "SCREENING_INCOMPLETE"
  | "RESUME_MISSING"
  | "ASSESSMENT_REQUIRED_PENDING"
  | "READINESS_CHECK_FAILED";

export interface StageReadiness {
  blocking: boolean;
  missing: string[];
  code: ReadinessCode | null;
}

export interface StageReadinessBlock {
  error: string;
  statusCode: 422 | 503;
  code: ReadinessCode;
  missing: string[];
}

function isRequiredFlag(value: unknown): boolean {
  return value === true || value === 1;
}

function isAnsweredForTaskType(
  taskType: string,
  response:
    | {
        selected_choice_key?: string | null;
        response_text?: string | null;
        proof_file_id?: string | null;
      }
    | undefined
): boolean {
  if (!response) return false;
  switch (taskType) {
    case "SINGLE_CHOICE":
      return isNonBlank(response.selected_choice_key);
    case "TEXT_RESPONSE":
    case "EXTERNAL_TASK":
      return isNonBlank(response.response_text);
    case "FILE_UPLOAD":
      return isNonBlank(response.proof_file_id);
    default:
      return false;
  }
}

function isSubmittedAttemptStatus(status: string | null): boolean {
  return status === "SUBMITTED" || status === "UNDER_REVIEW" || status === "PASSED";
}

export function summarizeAssessmentReadiness(input: {
  tasks: Array<{ id: number; is_required: boolean | number; task_type: string }>;
  responses: Array<{
    job_task_id: number;
    selected_choice_key?: string | null;
    response_text?: string | null;
    proof_file_id?: string | null;
  }>;
  latestStatus: string | null;
}): StageReadiness {
  const requiredTasks = input.tasks.filter((t) => isRequiredFlag(t.is_required));
  if (requiredTasks.length === 0) {
    return { blocking: false, missing: [], code: null };
  }
  const responseByTaskId = new Map<number, (typeof input.responses)[number]>();
  for (const r of input.responses) {
    const taskId = Number(r.job_task_id);
    if (Number.isSafeInteger(taskId) && !responseByTaskId.has(taskId)) {
      responseByTaskId.set(taskId, r);
    }
  }
  const allAnswered = requiredTasks.every((t) =>
    isAnsweredForTaskType(String(t.task_type), responseByTaskId.get(Number(t.id)))
  );
  const requiredPending = !allAnswered || !isSubmittedAttemptStatus(input.latestStatus);
  if (requiredPending) {
    return { blocking: true, missing: ["assessment"], code: "ASSESSMENT_REQUIRED_PENDING" };
  }
  return { blocking: false, missing: [], code: null };
}

function isNonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function screeningAnswerLabel(missingCount: number): string {
  return missingCount === 1 ? "1 screening answer" : `${missingCount} screening answers`;
}

export function summarizeScreeningReadiness(input: {
  questionIds: number[];
  answeredQuestionIds: number[];
  hasResume: boolean;
}): StageReadiness {
  const uniqueQuestionIds = [...new Set(input.questionIds.filter((id) => Number.isSafeInteger(id)))];
  const answered = new Set(
    input.answeredQuestionIds.filter((id) => Number.isSafeInteger(id))
  );
  const missingCount = uniqueQuestionIds.filter((id) => !answered.has(id)).length;
  const missing: string[] = [];
  if (missingCount > 0) missing.push(screeningAnswerLabel(missingCount));
  if (!input.hasResume) missing.push("resume");
  if (missing.length === 0) {
    return { blocking: false, missing, code: null };
  }
  return {
    blocking: true,
    missing,
    code: missingCount > 0 ? "SCREENING_INCOMPLETE" : "RESUME_MISSING",
  };
}

interface ScreeningQuestionRow {
  question_id: number;
}

interface ScreeningAnswerRow {
  question_id: number;
  answer_text?: string | null;
}

interface SeekerResumeRow {
  id: number;
  file_url?: string | null;
  file_name?: string | null;
}

async function fetchScreeningQuestionIds(jobId: number): Promise<number[]> {
  const res = await fetch(
    `${DIRECTUS_BASE}/items/vs_job_screening_question?filter[job_id][_eq]=${jobId}&fields=question_id&limit=-1`,
    { headers: getHeaders(), cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Screening questions read failed (${res.status}).`);
  const json = await res.json();
  const rows: ScreeningQuestionRow[] = Array.isArray(json.data) ? json.data : [];
  return rows.map((r) => Number(r.question_id)).filter((id) => Number.isSafeInteger(id));
}

async function fetchAnsweredQuestionIds(applicationId: number): Promise<number[]> {
  const res = await fetch(
    `${DIRECTUS_BASE}/items/vs_job_application_answer?filter[application_id][_eq]=${applicationId}&fields=question_id,answer_text&limit=-1`,
    { headers: getHeaders(), cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Screening answers read failed (${res.status}).`);
  const json = await res.json();
  const rows: ScreeningAnswerRow[] = Array.isArray(json.data) ? json.data : [];
  return rows
    .filter((r) => isNonBlank(r.answer_text))
    .map((r) => Number(r.question_id))
    .filter((id) => Number.isSafeInteger(id));
}

async function hasSeekerResume(userId: number): Promise<boolean> {
  const res = await fetch(
    `${DIRECTUS_BASE}/items/vs_job_seeker_resumes?filter[user_id][_eq]=${userId}&fields=id,file_url,file_name&limit=-1`,
    { headers: getHeaders(), cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Resumes read failed (${res.status}).`);
  const json = await res.json();
  const rows: SeekerResumeRow[] = Array.isArray(json.data) ? json.data : [];
  return rows.some((r) => isNonBlank(r.file_url) || isNonBlank(r.file_name));
}

// Authoritative check used by the transition service. Fail-closed.
export async function checkStageReadiness(input: {
  applicationId: number;
  jobId: number;
  userId: number;
  resumeId: number | null;
  stageId: number;
  stageType: string;
  isUniversalExit: boolean;
  assessmentOutcome?: unknown;
}): Promise<StageReadinessBlock | null> {
  if (input.isUniversalExit) return null;
  if (input.assessmentOutcome === "FAIL") return null;
  try {
    if (input.stageType === "SCREENING") {
      const [questionIds, answeredQuestionIds] = await Promise.all([
        fetchScreeningQuestionIds(input.jobId),
        fetchAnsweredQuestionIds(input.applicationId),
      ]);
      const hasResume =
        input.resumeId != null || (await hasSeekerResume(input.userId));
      const summary = summarizeScreeningReadiness({
        questionIds,
        answeredQuestionIds,
        hasResume,
      });
      if (!summary.blocking || !summary.code) return null;
      return {
        error: `Cannot advance candidate: required items are incomplete (${summary.missing.join(", ")}).`,
        statusCode: 422,
        code: summary.code,
        missing: summary.missing,
      };
    }
    if (input.stageType === "ASSESSMENT") {
      const status = await getRequiredAssessmentStatus({
        applicationId: input.applicationId,
        stageId: input.stageId,
      });
      if (status.requiredPending) {
        return {
          error: "Cannot advance candidate: the required assessment is not submitted.",
          statusCode: 422,
          code: "ASSESSMENT_REQUIRED_PENDING",
          missing: ["assessment"],
        };
      }
      return null;
    }
    return null;
  } catch (err) {
    console.error("[stage-readiness] check failed:", err);
    return {
      error: "Stage requirements could not be verified. Please try again.",
      statusCode: 503,
      code: "READINESS_CHECK_FAILED",
      missing: [],
    };
  }
}

// Display-only summary for list/detail payloads. Fail-open (log + blocking:false on read error).
export async function evaluateStageReadiness(input: {
  applicationId: number;
  jobId: number;
  userId: number;
  resumeId: number | null;
  stageId: number;
  stageType: string;
}): Promise<StageReadiness> {
  try {
    const block = await checkStageReadiness({
      ...input,
      isUniversalExit: false,
      assessmentOutcome: undefined,
    });
    if (!block) return { blocking: false, missing: [], code: null };
    if (block.code === "READINESS_CHECK_FAILED") {
      return { blocking: false, missing: [], code: null };
    }
    return { blocking: true, missing: block.missing, code: block.code };
  } catch (err) {
    console.error("[stage-readiness] evaluate failed:", err);
    return { blocking: false, missing: [], code: null };
  }
}

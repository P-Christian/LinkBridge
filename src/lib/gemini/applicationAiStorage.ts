// src/lib/gemini/applicationAiStorage.ts
// Unified Persistence Layer for Application & Candidate AI Intelligence.
// Interacts with `vs_application_ai_analysis` using an append-only, immutable history model.

import {
  DirectusError,
  directusItems,
  directusRequest,
} from "@/lib/server/directus";

export type ApplicationAiMode =
  | "CANDIDATE_EVALUATION"
  | "BEST_MATCH"
  | "MATCH_EXPLAINER"
  | "INTERVIEW_ANALYSIS"
  | "SCREENING_ANALYSIS";

export interface AlternativeJobMatch {
  job_id: number;
  job_title: string;
  match_score: number;
  reasoning: string;
}

export interface ApplicationAiAnalysisRecord {
  analysis_id: number;
  evaluation_mode: ApplicationAiMode;
  application_id: number;
  job_id: number;
  user_id: number;
  company_id: number;
  is_current: number; // 1 or 0
  superseded_by_analysis_id?: number | null;
  match_score?: number | null;
  fit_level?: string | null;
  executive_summary?: string | null;
  strengths?: string[] | null;
  gaps_or_considerations?: string[] | null;
  screening_assessment?: Record<string, unknown> | string | null;
  recommendation?: Record<string, unknown> | string | null;
  alternative_job_recommendations?: AlternativeJobMatch[] | null;
  evidence?: Array<Record<string, unknown>> | null;
  match_breakdown?: Record<string, number> | null;
  raw_ai_response?: Record<string, unknown> | null;
  ai_model?: string | null;
  prompt_version?: string | null;
  evaluated_by_user_id?: number | null;
  created_at: string;
  updated_at?: string;
}

export interface SaveAiAnalysisParams {
  evaluation_mode: ApplicationAiMode;
  application_id: number;
  job_id: number;
  user_id: number;
  company_id: number;
  match_score?: number | null;
  fit_level?: string | null;
  executive_summary?: string | null;
  strengths?: string[] | null;
  gaps_or_considerations?: string[] | null;
  screening_assessment?: Record<string, unknown> | string | null;
  recommendation?: Record<string, unknown> | string | null;
  alternative_job_recommendations?: AlternativeJobMatch[] | null;
  evidence?: Array<Record<string, unknown>> | null;
  match_breakdown?: Record<string, number> | null;
  raw_ai_response?: Record<string, unknown> | null;
  ai_model?: string | null;
  prompt_version?: string | null;
  evaluated_by_user_id?: number | null;
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemini-2.0-flash";

/**
 * Fetch the currently active (is_current = 1) AI analysis record for a given application and mode.
 *
 * `null` means the application has no active evaluation. It used to also mean
 * "Directus could not be reached", and the client route answered that with HTTP
 * 200 and no analysis — which the modal treats as "never scored" and answers by
 * spending a Gemini call and superseding the record that was actually stored.
 */
export async function getActiveApplicationAiAnalysis(
  applicationId: number,
  mode: ApplicationAiMode
): Promise<ApplicationAiAnalysisRecord | null> {
  if (!applicationId) return null;

  const rows = await directusItems<ApplicationAiAnalysisRecord>("vs_application_ai_analysis", {
    query:
      `filter[application_id][_eq]=${applicationId}` +
      `&filter[evaluation_mode][_eq]=${mode}` +
      "&filter[is_current][_eq]=1&sort[]=-created_at&limit=1",
  });

  return rows[0] ?? null;
}

/**
 * Save a fresh AI analysis record using append-only immutable history:
 * 1. Queries any existing active record (is_current = 1).
 * 2. Inserts new record with is_current = 1.
 * 3. Updates previous record with is_current = 0 and superseded_by_analysis_id = newRecordId.
 *
 * Throws when any step fails. Returning `null` instead let the caller show an
 * evaluation that no history row backs, so the next page load re-ran the model.
 */
export async function saveApplicationAiAnalysis(
  params: SaveAiAnalysisParams
): Promise<ApplicationAiAnalysisRecord> {
  if (!params.application_id) {
    throw new DirectusError(400, "application_id is required to store an evaluation.");
  }

  // 1. Fetch current active record ID for this (application_id, mode)
  const prevRecord = await getActiveApplicationAiAnalysis(params.application_id, params.evaluation_mode);

  // 2. Insert new record
  const payload = {
    ...params,
    is_current: 1,
    ai_model: params.ai_model || GEMINI_MODEL,
    prompt_version: params.prompt_version || "1.0",
  };

  const insertEnvelope = await directusRequest<{ data?: ApplicationAiAnalysisRecord }>(
    "/items/vs_application_ai_analysis",
    { method: "POST", body: payload }
  );

  const createdRecord = insertEnvelope?.data ?? null;
  if (!createdRecord?.analysis_id) {
    throw new DirectusError(502, "Stored evaluation did not come back with an id.");
  }

  // 3. Mark previous record as superseded
  if (prevRecord?.analysis_id) {
    await directusRequest(`/items/vs_application_ai_analysis/${prevRecord.analysis_id}`, {
      method: "PATCH",
      body: {
        is_current: 0,
        superseded_by_analysis_id: createdRecord.analysis_id,
      },
    });
  }

  return createdRecord;
}

/**
 * Fetch full version history of evaluations for an application.
 */
export async function getApplicationAiAnalysisHistory(
  applicationId: number,
  mode?: ApplicationAiMode
): Promise<ApplicationAiAnalysisRecord[]> {
  if (!applicationId) return [];

  const query =
    `filter[application_id][_eq]=${applicationId}&sort[]=-created_at&limit=-1` +
    (mode ? `&filter[evaluation_mode][_eq]=${mode}` : "");

  return directusItems<ApplicationAiAnalysisRecord>("vs_application_ai_analysis", { query });
}

const DELETE_PAGE_SIZE = 200;
const DELETE_MAX_PAGES = 25;

export interface DeleteAiAnalysisParams {
  /** Owner of the personal data (the candidate the application belongs to). Required. */
  userId: number;
  /** Narrow the purge to a single application. */
  applicationId?: number;
  /** Narrow the purge to a single evaluation mode. */
  mode?: ApplicationAiMode;
}

/**
 * PRIV-009: hard-delete retained AI evaluations (including superseded
 * `is_current = 0` history rows) for a data subject.
 *
 * `vs_application_ai_analysis.user_id` is the candidate the application belongs
 * to (see the save path in api/client/applicants/[id]/ai-analysis), so a
 * freelancer-initiated deletion request can key purely on their own user id.
 * `userId` is mandatory and is always part of the filter: this function can
 * never remove rows belonging to somebody else.
 *
 * Returns the number of rows deleted.
 *
 * Throws rather than returning a short count: the caller reports this number to
 * the data subject as proof that their retained evaluations are gone, and a
 * purge that stopped early — or whose list read never ran — is not a purge.
 */
export async function deleteApplicationAiAnalysis(
  params: DeleteAiAnalysisParams
): Promise<number> {
  const userId = Number(params.userId);
  if (!userId) throw new DirectusError(400, "A user id is required to purge AI evaluations.");

  const filters: string[] = [`filter[user_id][_eq]=${userId}`];
  if (params.applicationId) {
    filters.push(`filter[application_id][_eq]=${Number(params.applicationId)}`);
  }
  if (params.mode) {
    filters.push(`filter[evaluation_mode][_eq]=${params.mode}`);
  }

  let deleted = 0;

  for (let page = 0; page < DELETE_MAX_PAGES; page++) {
    // Rows vanish as they are deleted, so the same query yields the next batch.
    const rows = await directusItems<{ analysis_id: number }>("vs_application_ai_analysis", {
      query: `${filters.join("&")}&fields[]=analysis_id&sort[]=analysis_id&limit=${DELETE_PAGE_SIZE}`,
    });

    if (rows.length === 0) return deleted;

    for (const row of rows) {
      const analysisId = Number(row?.analysis_id);
      if (!analysisId) {
        throw new DirectusError(502, "An AI evaluation row came back without an id, so the purge stopped.");
      }

      await directusRequest(`/items/vs_application_ai_analysis/${analysisId}`, {
        method: "DELETE",
      });
      deleted++;
    }

    if (rows.length < DELETE_PAGE_SIZE) return deleted;
  }

  throw new DirectusError(
    502,
    `AI evaluation purge stopped after ${DELETE_MAX_PAGES * DELETE_PAGE_SIZE} rows with more still to delete.`
  );
}

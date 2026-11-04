// src/modules/client/pipeline/services/assessment-task.library.ts
// Company-scoped assessment-task library: every task across all of the
// company's pipelines/stages, labelled for the reuse picker. Copy-only;
// the editor prefills the create form from a row, never a live reference.

import { getCompanyPipelines, getPipelineWithDetails } from "./pipeline.service";
import {
  normalizeRow,
  type AssessmentTaskResult,
  type CompanyAssessmentTaskRow,
} from "./assessment-task.store";
import { chunk, mapPool } from "@/lib/server/pool";

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

export interface LibraryTask extends CompanyAssessmentTaskRow {
  stage_name: string;
  pipeline_name: string;
}

/**
 * One `_in=` query per 200 stage ids: the old single query concatenated every
 * id, so a large company could exceed what Directus accepts in one request URL.
 * Result size is unchanged (`limit=-1` still returns every task).
 */
async function fetchTasksForStages(
  ids: readonly number[],
  stageLabels: Map<number, { stage_name: string; pipeline_name: string }>
): Promise<LibraryTask[]> {
  const batches = await mapPool(
    chunk(ids, 200),
    async (batch) => {
      const res = await fetch(
        `${DIRECTUS_BASE}/items/vs_company_pipeline_assessment_tasks?filter[company_stage_id][_in]=${batch.join(",")}&limit=-1`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (!res.ok) throw new Error(`Directus library list failed: ${res.status}`);
      const json = (await res.json()) as { data?: Record<string, unknown>[] };
      return json.data ?? [];
    },
    4
  );

  const tasks: LibraryTask[] = [];
  for (const raw of batches.flat()) {
    const row = normalizeRow(raw);
    const labels = stageLabels.get(row.company_stage_id);
    if (!labels) continue;
    tasks.push({ ...row, ...labels });
  }
  return tasks;
}

/**
 * Lists the company's assessment tasks across ALL its pipelines/stages.
 * Company-scoped only: pipelines are resolved via company ownership, then
 * only ASSESSMENT stage ids are queried.
 */
export async function listCompanyAssessmentTaskLibrary(
  companyId: number
): Promise<AssessmentTaskResult<LibraryTask[]>> {
  try {
    const pipelines = await getCompanyPipelines(companyId);
    const stageLabels = new Map<
      number,
      { stage_name: string; pipeline_name: string }
    >();
    // `getCompanyPipelines` already hydrates, so this is normally free; pool it
    // so a cold company with an unbundled pipeline list stays bounded.
    const detailed = await mapPool(pipelines, async (pipeline) =>
      pipeline.stages !== undefined
        ? pipeline
        : getPipelineWithDetails(pipeline.id, companyId)
    );
    for (const pipeline of detailed) {
      if (!pipeline || pipeline.company_id !== companyId) continue;
      for (const stage of pipeline.stages ?? []) {
        if (stage.stage_type === "ASSESSMENT") {
          stageLabels.set(stage.id, {
            stage_name: stage.stage_name,
            pipeline_name: pipeline.name,
          });
        }
      }
    }
    if (stageLabels.size === 0) return { ok: true, data: [] };

    const tasks = await fetchTasksForStages([...stageLabels.keys()], stageLabels);
    return { ok: true, data: tasks };
  } catch (error) {
    console.error(
      "[assessment-task.library] listCompanyAssessmentTaskLibrary error:",
      error
    );
    return { ok: false, error: "DIRECTUS_ERROR" };
  }
}

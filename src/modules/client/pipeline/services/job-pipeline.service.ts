// src/modules/client/pipeline/services/job-pipeline.service.ts

import {
  CanonicalStageType,
  CUSTOM_ALLOWED_STAGE_TYPES,
  JobPipelineStage,
  JobPipelineTransition,
  JobPipelineVersion,
  LEGACY_STATUS_TO_CANONICAL_MAP,
  CANONICAL_TO_LEGACY_STATUS_MAP,
  STAGE_TYPE_DETAILS,
} from "../types";
import {
  getPipelineWithDetails,
  seedDefaultCompanyPipeline,
} from "./pipeline.service";
import { copyCompanyTasksToJobStage } from "./job-assessment-task.service";
import { checkAssessmentGate, isQualifyingAssessmentMove, isValidAssessmentOutcome, recordAssessmentMoveOutcome } from "@/modules/client/assessment-review/services/gate";
import {
  deriveAssessmentDeadline,
  parseWindowDays,
} from "@/modules/freelancer/freelancer-applications/services/assessment/deadline";
import { createNotification } from "@/lib/notifications";
import { formatDateLong, getPHTimeString } from "@/lib/utils";
import { chunk, mapPool } from "@/lib/server/pool";
import {
  directusItems,
  directusItemsWhereIn,
  directusSettled,
} from "@/lib/server/directus";

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

/**
 * Best-effort delete of one Directus item during snapshot compensation.
 */
async function deleteJobSnapshotItem(
  collection: string,
  id: number
): Promise<void> {
  try {
    await fetch(`${DIRECTUS_BASE}/items/${collection}/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
  } catch (err) {
    console.error(
      `[job-pipeline.service] compensation delete failed for ${collection}#${id}:`,
      err
    );
  }
}

/**
 * Snapshot compensation: deletes every created job task, transition, stage,
 * and pipeline version in reverse child-to-parent order so no partial active
 * version remains after a failed snapshot.
 */
async function compensateJobSnapshot(
  versionId: number | null,
  stageIds: number[],
  transitionIds: number[],
  taskIds: number[]
): Promise<void> {
  for (const taskId of taskIds) {
    await deleteJobSnapshotItem("vs_job_pipeline_assessment_tasks", taskId);
  }
  for (let i = transitionIds.length - 1; i >= 0; i--) {
    await deleteJobSnapshotItem("vs_job_pipeline_transitions", transitionIds[i]);
  }
  for (let i = stageIds.length - 1; i >= 0; i--) {
    await deleteJobSnapshotItem("vs_job_pipeline_stages", stageIds[i]);
  }
  if (versionId !== null) {
    await deleteJobSnapshotItem("vs_job_pipeline_versions", versionId);
  }
}

/**
 * Checks whether applications exist for a given job.
 * Authoritative backend lock check to prevent race conditions.
 */
export async function getJobApplicationCount(jobId: number): Promise<number> {
  try {
    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_application?filter[job_id][_eq]=${jobId}&filter[application_status][_neq]=WITHDRAWN&aggregate[count]=application_id`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (res.ok) {
      const json = await res.json();
      const count = Number(json.data?.[0]?.count?.application_id ?? json.data?.[0]?.count ?? 0);
      if (!isNaN(count)) return count;
    }

    // Fallback direct count fetch. Un-capped: this number is quoted back to the
    // employer as the reason their pipeline is locked, and a short read made it a
    // wrong figure rather than a missing one.
    const listRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_application?filter[job_id][_eq]=${jobId}&filter[application_status][_neq]=WITHDRAWN&fields=application_id&limit=-1`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (listRes.ok) {
      const listJson = await listRes.json();
      return (listJson.data ?? []).length;
    }

    // Both queries failed - return -1 to signal failure instead of failing open
    return -1;
  } catch (err) {
    console.error(`[job-pipeline.service] Error checking applications for job #${jobId}:`, err);
    return -1;
  }
}

/**
 * `-1` means the count itself could not be read. Every write path calls
 * `canModifyJobPipeline`, which refuses to edit in that case, so a read that
 * reported the pipeline as editable promised an edit the server was about to
 * answer with 409.
 */
function isPipelineLocked(applicationCount: number): boolean {
  return applicationCount !== 0;
}

/**
 * Validates whether the active job pipeline version can be modified.
 * Immutability rule: active job pipeline version is locked if application_count > 0.
 * Fail-closed policy: modification is refused if application count cannot be determined safely.
 */
export async function canModifyJobPipeline(
  jobId: number
): Promise<{ canModify: boolean; applicationCount: number; error?: string }> {
  const count = await getJobApplicationCount(jobId);
  if (count < 0) {
    return {
      canModify: false,
      applicationCount: 0,
      error: "Unable to verify application lock status. Pipeline modification is temporarily locked for safety.",
    };
  }
  if (count > 0) {
    return {
      canModify: false,
      applicationCount: count,
      error: `This job's hiring pipeline is immutable because it has already received ${count} application(s). Modifying active candidate workflow is forbidden.`,
    };
  }
  return { canModify: true, applicationCount: 0 };
}

/**
 * Retrieves the company_id associated with a job posting.
 */
export async function getJobCompanyId(jobId: number): Promise<number | null> {
  try {
    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_posting/${jobId}?fields=job_id,company_id`,
      { headers: getHeaders(), cache: "no-store" }
    );
    // 404 is the only answer that means "this job does not exist". Every other
    // failure used to return null as well, so a Directus blip was reported to
    // the recruiter as a missing job and their pipeline looked deleted.
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Job lookup failed (${res.status}).`);
    const json = await res.json();
    return json.data?.company_id ?? null;
  } catch (err) {
    console.error(`[job-pipeline.service] Error fetching job #${jobId}:`, err);
    throw err;
  }
}

/**
 * Snapshots a company pipeline template into a dedicated Job Pipeline Version.
 * Copies all stages and re-maps transitions with new job-stage IDs.
 */
export async function snapshotCompanyPipeline(
  jobId: number,
  companyId: number,
  sourcePipelineId?: number
): Promise<JobPipelineVersion | null> {
  let createdVersionId: number | null = null;
  const createdJobStageIds: number[] = [];
  const createdJobTransitionIds: number[] = [];
  const createdJobTaskIds: number[] = [];

  const rollbackAndFail = async (message: string): Promise<null> => {
    console.error(`[job-pipeline.service] snapshotCompanyPipeline aborting: ${message}`);
    await compensateJobSnapshot(
      createdVersionId,
      createdJobStageIds,
      createdJobTransitionIds,
      createdJobTaskIds
    );
    return null;
  };

  try {
    const nowPH = getPHTimeString();

    // 1. Resolve source company pipeline template
    let sourcePipeline = sourcePipelineId
      ? await getPipelineWithDetails(sourcePipelineId, companyId)
      : null;

    if (!sourcePipeline) {
      // Find company default pipeline
      const defRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_company_pipelines?filter[company_id][_eq]=${companyId}&filter[is_default][_eq]=true&limit=1`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (defRes.ok) {
        const defJson = await defRes.json();
        const defItem = defJson.data?.[0];
        if (defItem) {
          sourcePipeline = await getPipelineWithDetails(defItem.id, companyId);
        }
      }
    }

    // If company has no default pipeline, automatically seed it
    if (!sourcePipeline) {
      sourcePipeline = await seedDefaultCompanyPipeline(companyId);
    }

    if (!sourcePipeline || !sourcePipeline.stages || sourcePipeline.stages.length === 0) {
      throw new Error(`Failed to resolve company pipeline template for company #${companyId}`);
    }

    // 2. Determine version number for this job
    const prevVersionsRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_pipeline_versions?filter[job_id][_eq]=${jobId}&sort=-version&limit=1`,
      { headers: getHeaders(), cache: "no-store" }
    );
    let nextVersion = 1;
    if (prevVersionsRes.ok) {
      const prevJson = await prevVersionsRes.json();
      const latest = prevJson.data?.[0];
      if (latest) {
        nextVersion = (latest.version ?? 0) + 1;
      }
    }

    // 3. Create new Job Pipeline Version header
    const createVerRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_pipeline_versions`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        job_id: jobId,
        source_pipeline_id: sourcePipeline.id,
        version: nextVersion,
        is_active: true,
        created_at: nowPH,
      }),
    });

    if (!createVerRes.ok) {
      console.error("[job-pipeline.service] Failed creating job pipeline version header:", await createVerRes.text());
      return null;
    }

    const verJson = await createVerRes.json();
    const jobPipeline = verJson.data as JobPipelineVersion;
    if (!jobPipeline?.id) return null;
    createdVersionId = jobPipeline.id;

    // 4. Copy Stages into vs_job_pipeline_stages & build ID map: companyStageId -> jobStageId
    const companyToJobStageMap = new Map<number, number>();
    const createdJobStages: JobPipelineStage[] = [];

    for (const compStage of sourcePipeline.stages) {
      const stRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_pipeline_stages`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          job_pipeline_id: jobPipeline.id,
          stage_name: compStage.stage_name,
          stage_type: compStage.stage_type,
          stage_order: compStage.stage_order,
          color: compStage.color,
          description: compStage.description,
          is_terminal: compStage.is_terminal,
          is_system: compStage.is_system,
          assessment_submission_window_days: compStage.assessment_submission_window_days ?? null,
          created_at: nowPH,
        }),
      });

      if (!stRes.ok) {
        return rollbackAndFail(
          `job stage creation failed for company stage #${compStage.id}`
        );
      }
      const stJson = await stRes.json();
      const newJobStage = stJson.data as JobPipelineStage;
      if (!newJobStage?.id) {
        return rollbackAndFail(
          `job stage creation returned no id for company stage #${compStage.id}`
        );
      }
      companyToJobStageMap.set(compStage.id, newJobStage.id);
      createdJobStages.push(newJobStage);
      createdJobStageIds.push(newJobStage.id);
    }

    // 5. Copy Transitions into vs_job_pipeline_transitions with remapped IDs
    const createdJobTransitions: JobPipelineTransition[] = [];
    for (const compTrans of sourcePipeline.transitions ?? []) {
      const mappedFromId = companyToJobStageMap.get(compTrans.from_stage_id);
      const mappedToId = companyToJobStageMap.get(compTrans.to_stage_id);

      if (mappedFromId && mappedToId) {
        const trRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_pipeline_transitions`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            job_pipeline_id: jobPipeline.id,
            from_stage_id: mappedFromId,
            to_stage_id: mappedToId,
            created_at: nowPH,
          }),
        });

        if (!trRes.ok) {
          return rollbackAndFail(
            `job transition creation failed (${mappedFromId} -> ${mappedToId})`
          );
        }
        const trJson = await trRes.json();
        const newTr = trJson.data as JobPipelineTransition;
        if (!newTr?.id) {
          return rollbackAndFail(
            `job transition creation returned no id (${mappedFromId} -> ${mappedToId})`
          );
        }
        createdJobTransitions.push(newTr);
        createdJobTransitionIds.push(newTr.id);
      }
    }

    // 6. Copy assessment tasks for each ASSESSMENT stage into frozen job rows.
    // Supports zero or multiple ASSESSMENT stages in the template.
    for (const compStage of sourcePipeline.stages) {
      if (compStage.stage_type !== "ASSESSMENT") continue;
      const jobStageId = companyToJobStageMap.get(compStage.id);
      if (!jobStageId) {
        return rollbackAndFail(
          `missing job stage mapping for company ASSESSMENT stage #${compStage.id}`
        );
      }
      const copied = await copyCompanyTasksToJobStage(jobStageId, compStage.id);
      // Thread partial ids into compensation BEFORE checking ok, so a
      // mid-loop copy failure still rolls back rows created before it.
      for (const taskId of copied.createdIds) {
        createdJobTaskIds.push(taskId);
      }
      if (!copied.ok) {
        return rollbackAndFail(
          `assessment task snapshot failed for company stage #${compStage.id}`
        );
      }
    }

    // 7. Deactivate previous active versions only after the full snapshot
    // succeeded, so a failed snapshot never leaves a partial active version.
    const prevActiveRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_pipeline_versions?filter[job_id][_eq]=${jobId}&filter[is_active][_eq]=true&filter[id][_neq]=${jobPipeline.id}&fields=id&limit=-1`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (prevActiveRes.ok) {
      const prevActiveJson = await prevActiveRes.json();
      const prevVersions: Array<{ id: number }> = prevActiveJson.data ?? [];
      for (const prevVer of prevVersions) {
        const deactivateRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_job_pipeline_versions/${prevVer.id}`,
          {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify({ is_active: false }),
          }
        );
        // Two active versions would make the next read ambiguous, and an employer
        // editing the retired template is worse than a re-sync that reports failure.
        if (!deactivateRes.ok) {
          return rollbackAndFail(
            `could not retire the previous active pipeline version #${prevVer.id} (${deactivateRes.status})`
          );
        }
      }
    }

    return {
      ...jobPipeline,
      stages: createdJobStages,
      transitions: createdJobTransitions,
      is_locked: false,
      application_count: 0,
    };
  } catch (err) {
    console.error("[job-pipeline.service] snapshotCompanyPipeline error:", err);
    await compensateJobSnapshot(
      createdVersionId,
      createdJobStageIds,
      createdJobTransitionIds,
      createdJobTaskIds
    );
    return null;
  }
}

/**
 * Bootstraps a job pipeline for an existing job that doesn't have one yet.
 * Also performs non-destructive backward-compatible migration of any existing applications.
 */
export async function bootstrapJobPipeline(
  jobId: number,
  companyId?: number
): Promise<JobPipelineVersion | null> {
  try {
    const resolvedCompanyId = companyId ?? (await getJobCompanyId(jobId));
    if (!resolvedCompanyId) return null;

    const snapshot = await snapshotCompanyPipeline(jobId, resolvedCompanyId);
    if (!snapshot) return null;

    // Resolve existing applications for this job and map them to their canonical stage.
    // Un-capped: applications past the limit never receive a stage on the new
    // snapshot, so they drop off the hiring board without any error.
    const appsRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_application?filter[job_id][_eq]=${jobId}&fields=application_id,application_status,current_stage_id&limit=-1`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (appsRes.ok) {
      const appsJson = await appsRes.json();
      const applications: Array<{
        application_id: number;
        application_status: string;
        current_stage_id?: number | null;
      }> = appsJson.data ?? [];

      const stages = snapshot.stages ?? [];
      const stageByType = new Map<CanonicalStageType, JobPipelineStage>();
      for (const st of stages) {
        if (!stageByType.has(st.stage_type)) {
          stageByType.set(st.stage_type, st);
        }
      }

      const appliedStage = stageByType.get("APPLIED") ?? stages[0];
      const nowPH = getPHTimeString();

      for (const app of applications) {
        if (!app.current_stage_id) {
          const rawStatus = (app.application_status || "APPLIED").toUpperCase();
          const canonicalType = LEGACY_STATUS_TO_CANONICAL_MAP[rawStatus] || "APPLIED";
          const matchedStage = stageByType.get(canonicalType) || appliedStage;

          if (matchedStage) {
            // Update application with current_stage_id
            const patchRes = await fetch(
              `${DIRECTUS_BASE}/items/vs_job_application/${app.application_id}`,
              {
                method: "PATCH",
                headers: getHeaders(),
                body: JSON.stringify({ current_stage_id: matchedStage.id }),
              }
            );
            // A history row for a stage the application never got would put the
            // audit trail and the candidate's actual position out of sync.
            if (!patchRes.ok) {
              console.error(
                `[job-pipeline.service] legacy stage migration failed for application #${app.application_id}: ${patchRes.status}`
              );
              continue;
            }

            // Write initial stage history record if none exists
            await fetch(`${DIRECTUS_BASE}/items/vs_application_stage_history`, {
              method: "POST",
              headers: getHeaders(),
              body: JSON.stringify({
                application_id: app.application_id,
                from_stage_id: null,
                to_stage_id: matchedStage.id,
                changed_by: null,
                change_reason: `Legacy ATS migration (${rawStatus} → ${canonicalType})`,
                created_at: nowPH,
              }),
            });
          }
        }
      }
    }

    return snapshot;
  } catch (err) {
    console.error(`[job-pipeline.service] bootstrapJobPipeline error for job #${jobId}:`, err);
    return null;
  }
}

/**
 * Retrieves the active job pipeline version for a job with stages and transitions.
 * If the job does not have a pipeline yet, it automatically bootstraps one.
 */
export async function getJobPipeline(
  jobId: number,
  companyId?: number
): Promise<JobPipelineVersion | null> {
  try {
    // 1. Fetch active version
    // Sorted newest-first because legacy rows can leave two versions flagged
    // active; without a sort, limit=1 would hand back an arbitrary one and the
    // employer would edit the version they had just replaced.
    const verRes = await directusSettled<{ data?: JobPipelineVersion[] }>(
      "/items/vs_job_pipeline_versions",
      {
        query: `filter[job_id][_eq]=${jobId}&filter[is_active][_eq]=true&sort[]=-version&limit=1`,
      }
    );

    // A failed read used to fall straight into the bootstrap below, which
    // INSERTS a new version with fresh stage ids. An unreachable Directus
    // therefore duplicated a job's pipeline and remapped every application onto
    // the copy. Only a read that succeeded and found nothing may bootstrap.
    if (!verRes.ok) return null;

    const activeVersionRow = verRes.data?.data?.[0] ?? null;
    let activeVersion: JobPipelineVersion | null = activeVersionRow;

    // 2. If no active version exists, bootstrap from company default
    if (!activeVersion) {
      activeVersion = await bootstrapJobPipeline(jobId, companyId);
      if (!activeVersion) return null;
    }

    // 3. Fetch stages for this job pipeline version
    const stages = await directusItems<JobPipelineStage>("vs_job_pipeline_stages", {
      query: `filter[job_pipeline_id][_eq]=${activeVersion.id}&sort=stage_order&limit=-1`,
    });

    // 4. Fetch transitions
    const transitions = await directusItems<JobPipelineTransition>("vs_job_pipeline_transitions", {
      query: `filter[job_pipeline_id][_eq]=${activeVersion.id}&limit=-1`,
    });

    // 5. Enrich stages with allowed_next_stage_ids
    const stageIdSet = new Set(stages.map((s) => Number(s.id)));
    const transitionMap = new Map<number, number[]>();
    for (const t of transitions) {
      const fromId = Number(t.from_stage_id);
      const toId = Number(t.to_stage_id);
      if (!isNaN(fromId) && !isNaN(toId) && stageIdSet.has(fromId) && stageIdSet.has(toId)) {
        const list = transitionMap.get(fromId) ?? [];
        list.push(toId);
        transitionMap.set(fromId, list);
      }
    }

    const enrichedStages = stages.map((s) => ({
      ...s,
      is_system: Boolean(s.is_system),
      is_terminal: Boolean(s.is_terminal),
      allowed_next_stage_ids: transitionMap.get(Number(s.id)) ?? [],
    }));

    // 6. Locking state comes from the live application count
    const applicationCount = await getJobApplicationCount(jobId);

    return {
      ...activeVersion,
      stages: enrichedStages,
      transitions,
      is_locked: isPipelineLocked(applicationCount),
      application_count: applicationCount,
    };
  } catch (err) {
    console.error(`[job-pipeline.service] getJobPipeline error for job #${jobId}:`, err);
    return null;
  }
}

/**
 * Batch variant of `getJobPipeline` for list endpoints.
 *
 * The single-job path costs four round trips per job, so an applicants or
 * interviews list over N jobs pays 4N sequentially — measured at 12 s for this
 * company. This resolves every job's active pipeline in a fixed handful of
 * `_in=` queries instead. Output is identical to calling `getJobPipeline` for
 * each id, including bootstrap-on-missing and the `-1` application-count
 * failure signal.
 */
export async function getJobPipelinesForJobs(
  jobIds: readonly number[],
  companyId?: number
): Promise<Record<number, JobPipelineVersion | null>> {
  const unique = [
    ...new Set(jobIds.filter((id) => Number.isSafeInteger(id) && id > 0)),
  ];
  const result: Record<number, JobPipelineVersion | null> = {};
  if (unique.length === 0) return result;

  try {
    // 1. Active versions for every job.
    const wanted = new Set(unique);
    const versionByJob = new Map<number, JobPipelineVersion>();
    const versionRows = await directusItemsWhereIn<JobPipelineVersion>(
      "vs_job_pipeline_versions",
      "job_id",
      unique,
      "*",
      { extra: "filter[is_active][_eq]=true&sort[]=-version" }
    );
    for (const version of versionRows) {
      const jobId = Number(version.job_id);
      if (wanted.has(jobId) && !versionByJob.has(jobId)) {
        versionByJob.set(jobId, version);
      }
    }

    // 2. Jobs with no active version bootstrap exactly as the single-job path does.
    const missing = unique.filter((id) => !versionByJob.has(id));
    if (missing.length > 0) {
      const created = await mapPool(
        missing,
        (jobId) => bootstrapJobPipeline(jobId, companyId)
      );
      created.forEach((version, i) => {
        if (version) versionByJob.set(missing[i], version);
      });
    }

    const pipelineIds = [...versionByJob.values()]
      .map((version) => Number(version.id))
      .filter((id) => Number.isSafeInteger(id) && id > 0);

    // 3 + 4. Stages and transitions, independent so they overlap. Both read in
    // batches and reject on failure: a pipeline that comes back with no stages
    // is what the employer then saves, and the real stages are gone.
    const [stageRows, transitionRows] = await Promise.all([
      directusItemsWhereIn<JobPipelineStage>(
        "vs_job_pipeline_stages",
        "job_pipeline_id",
        pipelineIds,
        "*",
        { extra: "sort=stage_order" }
      ),
      directusItemsWhereIn<JobPipelineTransition>(
        "vs_job_pipeline_transitions",
        "job_pipeline_id",
        pipelineIds,
        "*"
      ),
    ]);

    const stagesByPipeline = new Map<number, JobPipelineStage[]>();
    for (const stage of stageRows) {
      const pid = Number(stage.job_pipeline_id);
      const list = stagesByPipeline.get(pid);
      if (list) list.push(stage);
      else stagesByPipeline.set(pid, [stage]);
    }
    const transitionsByPipeline = new Map<number, JobPipelineTransition[]>();
    for (const transition of transitionRows) {
      const pid = Number(transition.job_pipeline_id);
      const list = transitionsByPipeline.get(pid);
      if (list) list.push(transition);
      else transitionsByPipeline.set(pid, [transition]);
    }

    // 5. One grouped aggregate for the lock state; falls back to the per-job
    //    counter (which returns -1 on failure) if the aggregate is unusable.
    const countByJob = new Map<number, number>();
    let countsSettled = true;
    const countPages = await mapPool(chunk(unique, 200), async (batch) => {
      const res = await fetch(
        `${DIRECTUS_BASE}/items/vs_job_application?filter[job_id][_in]=${batch.join(
          ","
        )}&filter[application_status][_neq]=WITHDRAWN&aggregate[count]=application_id&groupBy=job_id&limit=-1`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (!res.ok) {
        countsSettled = false;
        return [];
      }
      const json = (await res.json()) as {
        data?: {
          job_id: number | string;
          count?: { application_id?: string | number } | string | number;
        }[];
      };
      return json.data ?? [];
    });
    for (const row of countPages.flat()) {
      const raw =
        row.count && typeof row.count === "object"
          ? row.count.application_id
          : row.count;
      const count = Number(raw ?? 0);
      countByJob.set(Number(row.job_id), isNaN(count) ? 0 : count);
    }
    if (!countsSettled) {
      const counts = await mapPool(unique, (jobId) =>
        getJobApplicationCount(jobId)
      );
      counts.forEach((count, i) => countByJob.set(unique[i], count));
    }

    for (const jobId of unique) {
      const version = versionByJob.get(jobId);
      if (!version) {
        result[jobId] = null;
        continue;
      }
      const stages = stagesByPipeline.get(Number(version.id)) ?? [];
      const transitions = transitionsByPipeline.get(Number(version.id)) ?? [];

      const stageIdSet = new Set(stages.map((s) => Number(s.id)));
      const transitionMap = new Map<number, number[]>();
      for (const t of transitions) {
        const fromId = Number(t.from_stage_id);
        const toId = Number(t.to_stage_id);
        if (
          !isNaN(fromId) &&
          !isNaN(toId) &&
          stageIdSet.has(fromId) &&
          stageIdSet.has(toId)
        ) {
          const list = transitionMap.get(fromId) ?? [];
          list.push(toId);
          transitionMap.set(fromId, list);
        }
      }

      const applicationCount = countByJob.get(jobId) ?? 0;
      result[jobId] = {
        ...version,
        stages: stages.map((s) => ({
          ...s,
          is_system: Boolean(s.is_system),
          is_terminal: Boolean(s.is_terminal),
          allowed_next_stage_ids: transitionMap.get(Number(s.id)) ?? [],
        })),
        transitions,
        is_locked: isPipelineLocked(applicationCount),
        application_count: applicationCount,
      };
    }

    return result;
  } catch (err) {
    console.error(
      "[job-pipeline.service] getJobPipelinesForJobs error:",
      err
    );
    // Never leave a list with null pipelines because the batch path broke.
    const fallback = await mapPool(unique, (jobId) =>
      getJobPipeline(jobId, companyId)
    );
    fallback.forEach((pipeline, i) => {
      result[unique[i]] = pipeline;
    });
    return result;
  }
}

/**
 * Adds a new stage to an active job pipeline version.
 * Blocked if application_count > 0.
 */
export async function addJobPipelineStage(
  jobId: number,
  data: {
    stage_name: string;
    stage_type: CanonicalStageType;
    color?: string;
    description?: string;
  }
): Promise<{ success: boolean; stage?: JobPipelineStage; error?: string }> {
  try {
    const lockCheck = await canModifyJobPipeline(jobId);
    if (!lockCheck.canModify) {
      return { success: false, error: lockCheck.error };
    }

    const pipeline = await getJobPipeline(jobId);
    if (!pipeline) return { success: false, error: "Job pipeline not found." };

    const currentStages = pipeline.stages ?? [];
    if (currentStages.length >= 25) {
      return { success: false, error: "Maximum 25 stages allowed per pipeline." };
    }

    if (!CUSTOM_ALLOWED_STAGE_TYPES.includes(data.stage_type)) {
      return {
        success: false,
        error: `Custom stages must be an intermediate evaluation step (${CUSTOM_ALLOWED_STAGE_TYPES.join(", ")}).`,
      };
    }

    const isTerminal = false;
    const maxOrder = currentStages.reduce((max, s) => Math.max(max, s.stage_order), 0);
    const stageOrder = maxOrder + 1;

    const defaultColor = STAGE_TYPE_DETAILS[data.stage_type]?.defaultColor || "sky";
    const nowPH = getPHTimeString();

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_job_pipeline_stages`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        job_pipeline_id: pipeline.id,
        stage_name: data.stage_name.trim(),
        stage_type: data.stage_type,
        stage_order: stageOrder,
        color: data.color || defaultColor,
        description: data.description?.trim() || null,
        is_terminal: isTerminal,
        is_system: false,
        created_at: nowPH,
      }),
    });

    if (!res.ok) {
      return { success: false, error: "Failed to create job pipeline stage." };
    }

    const json = await res.json();
    return { success: true, stage: json.data };
  } catch (err) {
    console.error("[job-pipeline.service] addJobPipelineStage error:", err);
    return { success: false, error: "Exception creating job stage." };
  }
}

/**
 * Updates a stage in an active job pipeline version.
 * Blocked if application_count > 0.
 */
export async function updateJobPipelineStage(
  jobId: number,
  stageId: number,
  data: {
    stage_name?: string;
    color?: string;
    description?: string;
    stage_order?: number;
    assessment_submission_window_days?: number | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const lockCheck = await canModifyJobPipeline(jobId);
    if (!lockCheck.canModify) {
      return { success: false, error: lockCheck.error };
    }

    const pipeline = await getJobPipeline(jobId);
    if (!pipeline) return { success: false, error: "Job pipeline not found." };

    const stage = pipeline.stages?.find((s) => s.id === stageId);
    if (!stage) return { success: false, error: "Stage not found in this job pipeline." };

    const updatePayload: Record<string, unknown> = {};
    if (data.stage_name !== undefined) updatePayload.stage_name = data.stage_name.trim();
    if (data.color !== undefined) updatePayload.color = data.color;
    if (data.description !== undefined) updatePayload.description = data.description.trim() || null;
    if (data.stage_order !== undefined) updatePayload.stage_order = data.stage_order;
    if (data.assessment_submission_window_days !== undefined) {
      updatePayload.assessment_submission_window_days = data.assessment_submission_window_days;
    }

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_job_pipeline_stages/${stageId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updatePayload),
    });

    return { success: res.ok };
  } catch (err) {
    console.error("[job-pipeline.service] updateJobPipelineStage error:", err);
    return { success: false, error: "Exception updating stage." };
  }
}

/**
 * Deletes a stage from an active job pipeline version.
 * Blocked if application_count > 0 or if stage is a system stage.
 */
export async function deleteJobPipelineStage(
  jobId: number,
  stageId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const lockCheck = await canModifyJobPipeline(jobId);
    if (!lockCheck.canModify) {
      return { success: false, error: lockCheck.error };
    }

    const pipeline = await getJobPipeline(jobId);
    if (!pipeline) return { success: false, error: "Job pipeline not found." };

    const stage = pipeline.stages?.find((s) => s.id === stageId);
    if (!stage) return { success: false, error: "Stage not found in this job pipeline." };

    if (stage.is_system) {
      return { success: false, error: "System stages are required and cannot be deleted." };
    }

    // 1. Delete associated transitions
    const transToDelete = (pipeline.transitions ?? []).filter(
      (t) => t.from_stage_id === stageId || t.to_stage_id === stageId
    );
    for (const t of transToDelete) {
      await fetch(`${DIRECTUS_BASE}/items/vs_job_pipeline_transitions/${t.id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
    }

    // 2. Delete the stage
    const res = await fetch(`${DIRECTUS_BASE}/items/vs_job_pipeline_stages/${stageId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });

    return { success: res.ok };
  } catch (err) {
    console.error("[job-pipeline.service] deleteJobPipelineStage error:", err);
    return { success: false, error: "Exception deleting stage." };
  }
}

/**
 * Replaces transition routes for a stage in a job pipeline.
 * Blocked if application_count > 0.
 */
export async function updateJobPipelineTransitions(
  jobId: number,
  fromStageId: number,
  targetStageIds: number[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const lockCheck = await canModifyJobPipeline(jobId);
    if (!lockCheck.canModify) {
      return { success: false, error: lockCheck.error };
    }

    const pipeline = await getJobPipeline(jobId);
    if (!pipeline) return { success: false, error: "Job pipeline not found." };

    const stages = pipeline.stages ?? [];
    // Directus hands back these ids as numbers today, but every other read in
    // this module coerces: a string id here would reject the employer's own
    // stages as "does not belong to this job pipeline".
    const fromStage = stages.find((s) => Number(s.id) === fromStageId);
    if (!fromStage) return { success: false, error: "Source stage not found in this job pipeline." };

    // Terminal integrity: Terminal stages cannot have outgoing transitions
    if (fromStage.is_terminal) {
      return { success: false, error: "Terminal stages cannot have outgoing transitions." };
    }

    // Stage ownership validation: all targets must belong to this job pipeline
    const stageIdSet = new Set(stages.map((s) => Number(s.id)));
    for (const toId of targetStageIds) {
      if (!stageIdSet.has(toId)) {
        return { success: false, error: `Destination stage #${toId} does not belong to this job pipeline.` };
      }
      if (toId === fromStageId) {
        return { success: false, error: "Self-transitions are not permitted." };
      }
      const targetStage = stages.find((s) => Number(s.id) === toId);
      if (targetStage?.stage_type === "APPLIED") {
        return { success: false, error: "Transitions targeting the initial intake stage (APPLIED) are not permitted." };
      }
    }

    // 1. Diff-and-apply: add the routes that are missing, then retire the ones
    // the employer removed. Deleting first used to leave the stage with no
    // outgoing routes whenever the insert half failed, and no write outcome was
    // checked, so a rejected Directus call still reported success.
    const existing = (pipeline.transitions ?? []).filter(
      (t) => Number(t.from_stage_id) === fromStageId
    );
    const existingToIds = new Set(existing.map((t) => Number(t.to_stage_id)));
    const nowPH = getPHTimeString();

    const createdIds: number[] = [];
    for (const toId of targetStageIds) {
      if (existingToIds.has(toId)) continue;
      const res = await fetch(`${DIRECTUS_BASE}/items/vs_job_pipeline_transitions`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          job_pipeline_id: pipeline.id,
          from_stage_id: fromStageId,
          to_stage_id: toId,
          created_at: nowPH,
        }),
      });
      if (!res.ok) {
        for (const id of createdIds) {
          await deleteJobSnapshotItem("vs_job_pipeline_transitions", id);
        }
        return {
          success: false,
          error: `The route to stage #${toId} could not be saved. Existing routes are unchanged.`,
        };
      }
      const resJson = await res.json().catch(() => null);
      const newId = Number(resJson?.data?.id);
      if (Number.isSafeInteger(newId)) createdIds.push(newId);
    }

    const keptToIds = new Set(targetStageIds);
    const retiredFailures: number[] = [];
    for (const t of existing) {
      const toId = Number(t.to_stage_id);
      if (keptToIds.has(toId)) continue;
      const res = await fetch(`${DIRECTUS_BASE}/items/vs_job_pipeline_transitions/${t.id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (!res.ok) retiredFailures.push(toId);
    }

    if (retiredFailures.length > 0) {
      return {
        success: false,
        error: `The saved routes are live, but the route to stage ${retiredFailures
          .map((id) => `#${id}`)
          .join(", ")} could not be retired.`,
      };
    }

    return { success: true };
  } catch (err) {
    console.error("[job-pipeline.service] updateJobPipelineTransitions error:", err);
    return { success: false, error: "Exception updating transitions." };
  }
}

/**
 * Batch reorders stages for a job pipeline.
 * Blocked if application_count > 0.
 */
export async function reorderJobPipelineStages(
  jobId: number,
  orderedStageIds: number[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const lockCheck = await canModifyJobPipeline(jobId);
    if (!lockCheck.canModify) {
      return { success: false, error: lockCheck.error };
    }

    const pipeline = await getJobPipeline(jobId);
    if (!pipeline) return { success: false, error: "Job pipeline not found." };

    const stages = pipeline.stages ?? [];
    const stageMap = new Map(stages.map((s) => [Number(s.id), s]));

    // Deduplicate requested stage IDs to guard against payload anomalies
    const deduplicatedIds = Array.from(new Set(orderedStageIds));

    // Pin entry stage: APPLIED must always remain at position 1
    const appliedStage = stages.find((s) => s.stage_type === "APPLIED" || (s.is_system && s.stage_order === 1));
    const filteredOrderedIds = deduplicatedIds.filter(
      (id) => (appliedStage ? id !== Number(appliedStage.id) : true)
    );
    const finalOrderedIds = appliedStage
      ? [Number(appliedStage.id), ...filteredOrderedIds]
      : deduplicatedIds;

    const nowPH = getPHTimeString();
    let order = 1;
    const applied: { stageId: number; previousOrder: number }[] = [];
    for (const stageId of finalOrderedIds) {
      const stage = stageMap.get(stageId);
      if (!stage) continue;
      const res = await fetch(`${DIRECTUS_BASE}/items/vs_job_pipeline_stages/${stageId}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({
          stage_order: order++,
          updated_at: nowPH,
        }),
      });
      if (!res.ok) {
        // Put the rows already written back the way they were: the hook rolls its
        // optimistic order off the screen on failure, and half-applied orders
        // would leave the table and every later read disagreeing about who is
        // stage 3.
        for (const done of applied.reverse()) {
          await fetch(`${DIRECTUS_BASE}/items/vs_job_pipeline_stages/${done.stageId}`, {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify({ stage_order: done.previousOrder, updated_at: nowPH }),
          });
        }
        return {
          success: false,
          error: `Stage #${stageId} could not be reordered. The sequence was left as it was.`,
        };
      }
      applied.push({ stageId, previousOrder: stage.stage_order });
    }

    return { success: true };
  } catch (err) {
    console.error("[job-pipeline.service] reorderJobPipelineStages error:", err);
    return { success: false, error: "Exception reordering stages." };
  }
}

/**
 * Assigns the initial stage and writes the authoritative stage history record
 * when an application is submitted to a job.
 */
export async function assignInitialStageToApplication(
  jobId: number,
  applicationId: number,
  userId?: number
): Promise<{ success: boolean; currentStageId?: number }> {
  try {
    const pipeline = await getJobPipeline(jobId);
    if (!pipeline?.stages || pipeline.stages.length === 0) {
      throw new Error(`Failed to resolve pipeline for job #${jobId}`);
    }

    const appliedStage =
      pipeline.stages.find((s) => s.stage_type === "APPLIED") ?? pipeline.stages[0];

    const nowPH = getPHTimeString();

    // 1. Update application with current_stage_id and canonical status
    await fetch(`${DIRECTUS_BASE}/items/vs_job_application/${applicationId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({
        current_stage_id: appliedStage.id,
        application_status: "APPLIED",
        status_updated_at: nowPH,
      }),
    });

    // 2. Insert authoritative audit record into vs_application_stage_history
    await fetch(`${DIRECTUS_BASE}/items/vs_application_stage_history`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        application_id: applicationId,
        from_stage_id: null,
        to_stage_id: appliedStage.id,
        changed_by: userId ?? null,
        change_reason: "Initial Application Submission",
        metadata: {
          job_pipeline_id: pipeline.id,
          stage_name: appliedStage.stage_name,
          stage_type: appliedStage.stage_type,
        },
        created_at: nowPH,
      }),
    });

    return { success: true, currentStageId: appliedStage.id };
  } catch (err) {
    console.error("[job-pipeline.service] assignInitialStageToApplication error:", err);
    return { success: false };
  }
}

interface StageMoveContext {
  appData: Record<string, unknown>;
  pipeline: JobPipelineVersion;
  fromStage: JobPipelineStage;
  toStage: JobPipelineStage;
  hasConfiguredTransition: boolean;
  isUniversalExit: boolean;
}

type StageMoveResolution =
  | { ok: true; context: StageMoveContext }
  | { ok: false; error: string; statusCode: number };

/**
 * Resolves the endpoints of a stage move against the job's active pipeline
 * and classifies the route as a configured transition or a universal
 * REJECTED/WITHDRAWN exit. Shared by the move itself and the assessment
 * move-time pre-check.
 */
async function resolveStageMoveContext(
  applicationId: number,
  toStageId: number
): Promise<StageMoveResolution> {
  // 1. Fetch application
  const appRes = await fetch(
    `${DIRECTUS_BASE}/items/vs_job_application/${applicationId}?fields=application_id,job_id,user_id,application_status,current_stage_id,client_notes`,
    { headers: getHeaders(), cache: "no-store" }
  );
  if (!appRes.ok) {
    return { ok: false, error: "Application not found.", statusCode: 404 };
  }
  const appJson = await appRes.json();
  const appData = appJson.data;
  if (!appData) {
    return { ok: false, error: "Application not found.", statusCode: 404 };
  }

  const jobId = Number(appData.job_id);
  if (!jobId) {
    return { ok: false, error: "Application is not associated with a valid job.", statusCode: 400 };
  }

  // 2. Fetch active job pipeline version
  const pipeline = await getJobPipeline(jobId);
  if (!pipeline || !pipeline.stages || pipeline.stages.length === 0) {
    return { ok: false, error: "Job pipeline not found or has no stages.", statusCode: 500 };
  }

  const stages = pipeline.stages;
  const transitions = pipeline.transitions ?? [];

  // 3. Resolve fromStage
  const unresolvedFrom = appData.current_stage_id
    ? stages.find((s) => s.id === Number(appData.current_stage_id))
    : undefined;
  const canonicalStatus = (appData.application_status || "APPLIED").toUpperCase();
  const fromStage =
    unresolvedFrom ||
    stages.find((s) => s.stage_type === canonicalStatus) ||
    stages.find((s) => s.stage_type === "APPLIED") ||
    stages[0];

  if (!fromStage) {
    return { ok: false, error: "Could not resolve candidate current stage in this pipeline.", statusCode: 422 };
  }

  // 4. Resolve toStage (Must belong to the same pipeline version!)
  const toStage = stages.find((s) => s.id === Number(toStageId));
  if (!toStage) {
    return {
      ok: false,
      error: `Target stage #${toStageId} does not belong to this job's active pipeline.`,
      statusCode: 422,
    };
  }

  // Transition classification:
  // Either explicit transition exists, OR target is a Universal Exit (REJECTED / WITHDRAWN) from non-terminal stage
  const hasConfiguredTransition = transitions.some(
    (t) => t.from_stage_id === fromStage.id && t.to_stage_id === toStage.id
  );
  const isUniversalExit = toStage.stage_type === "REJECTED" || toStage.stage_type === "WITHDRAWN";

  return {
    ok: true,
    context: { appData, pipeline, fromStage, toStage, hasConfiguredTransition, isUniversalExit },
  };
}

export interface AssessmentMoveRequirement {
  requiresOutcome: boolean;
  fromStage?: JobPipelineStage;
  toStage?: JobPipelineStage;
  error?: string;
  statusCode?: number;
}

/**
 * Move-time pre-check for the client confirm flow: reports whether moving
 * the application to `toStageId` qualifies for the assessment outcome gate
 * (task-bearing ASSESSMENT stage, configured non-universal route). Never
 * writes; the PATCH remains authoritative.
 */
export async function getAssessmentMoveRequirement(input: {
  applicationId: number;
  toStageId: number;
}): Promise<AssessmentMoveRequirement> {
  try {
    const resolved = await resolveStageMoveContext(input.applicationId, input.toStageId);
    if (!resolved.ok) {
      return { requiresOutcome: false, error: resolved.error, statusCode: resolved.statusCode };
    }
    const { fromStage, toStage, hasConfiguredTransition, isUniversalExit } = resolved.context;

    if (fromStage.id === toStage.id) {
      return { requiresOutcome: false, fromStage, toStage };
    }
    if (fromStage.is_terminal) {
      return {
        requiresOutcome: false,
        error: `Candidate is in terminal stage "${fromStage.stage_name}" and cannot be transitioned further.`,
        statusCode: 422,
      };
    }
    if (!hasConfiguredTransition && !isUniversalExit) {
      return {
        requiresOutcome: false,
        error: `Transition from "${fromStage.stage_name}" to "${toStage.stage_name}" is not configured in this job's pipeline.`,
        statusCode: 422,
      };
    }

    const qualifying = await isQualifyingAssessmentMove({
      fromStage,
      isUniversalExit,
      hasConfiguredTransition,
    });
    return { requiresOutcome: qualifying, fromStage, toStage };
  } catch (err) {
    console.error("[job-pipeline.service] getAssessmentMoveRequirement error:", err);
    return {
      requiresOutcome: false,
      error: err instanceof Error ? err.message : "Internal error checking assessment requirement.",
      statusCode: 500,
    };
  }
}

export interface TransitionStageParams {
  applicationId: number;
  toStageId: number;
  changedByUserId?: number | null;
  changeReason?: string | null;
  notes?: string | null;
  assessmentOutcome?: string | null;
}

export interface TransitionStageResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  noop?: boolean;
  moved?: boolean;
  outcome?: "PASS" | "FAIL" | null;
  application?: Record<string, unknown>;
  fromStage?: JobPipelineStage;
  toStage?: JobPipelineStage;
  stageHistoryId?: number | null;
}

async function hasStageTasks(stageId: number): Promise<boolean> {
  try {
    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_pipeline_assessment_tasks?filter[job_stage_id][_eq]=${stageId}&fields=id&limit=1`,
      { headers: getHeaders(), cache: "no-store" },
    );
    if (!res.ok) return false;
    const json = await res.json();
    return Array.isArray(json.data) && json.data.length > 0;
  } catch {
    return false;
  }
}

async function hasAssessmentAssignedEvent(applicationId: number): Promise<boolean> {
  try {
    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_notification_event?filter[event_type][_eq]=ASSESSMENT_ASSIGNED&filter[entity_type][_eq]=job_application&filter[entity_id][_eq]=${applicationId}&fields=event_id&limit=1`,
      { headers: getHeaders(), cache: "no-store" },
    );
    if (!res.ok) return false;
    const json = await res.json();
    return Array.isArray(json.data) && json.data.length > 0;
  } catch {
    return false;
  }
}

/**
 * Best-effort arrival notification for a move INTO an ASSESSMENT stage.
 * Sends only to the application's freelancer (never the acting client),
 * only when the stage carries a submission window and at least one task,
 * and only once per application (existing ASSESSMENT_ASSIGNED event skips).
 * Never throws; notification failure must not fail the stage move.
 */
async function notifyFreelancerOfAssessmentAssignment(input: {
  applicationId: number;
  freelancerUserId: number;
  actingUserId?: number | null;
  toStage: JobPipelineStage;
  entryTime: string;
}): Promise<void> {
  try {
    const freelancerId = input.freelancerUserId;
    if (!Number.isSafeInteger(freelancerId) || freelancerId <= 0) return;
    if (input.actingUserId !== null && input.actingUserId !== undefined && freelancerId === input.actingUserId) return;
    const windowDays = parseWindowDays(input.toStage.assessment_submission_window_days);
    if (windowDays === null) return;
    if (!(await hasStageTasks(input.toStage.id))) return;
    if (await hasAssessmentAssignedEvent(input.applicationId)) return;
    const deadline = deriveAssessmentDeadline(input.entryTime, windowDays);
    if (!deadline) return;
    const formatted = formatDateLong(new Date(deadline));
    await createNotification({
      event_type: "ASSESSMENT_ASSIGNED",
      recipient_user_id: freelancerId,
      entity_type: "job_application",
      entity_id: input.applicationId,
      category: "ASSESSMENT_ASSIGNED",
      title: "Assessment assigned",
      message: `You have until ${formatted} to complete your assessment.`,
      action_url: `/linkbridge/freelancer/applications?assessment=${input.applicationId}`,
    }).catch((error: unknown) => console.error("[job-pipeline.service] assessment arrival notify error:", error));
  } catch (error) {
    console.error("[job-pipeline.service] assessment arrival notification failed:", error);
  }
}

/**
 * Best-effort move-time assessment outcome notification to the freelancer.
 * Exactly once per decision: PASS -> ASSESSMENT_PASSED, FAIL ->
 * ASSESSMENT_FAILED. Mirrors the ASSESSMENT_ASSIGNED idempotency (existing
 * event type + entity check). Never notifies the acting client. Never
 * throws; notification failure must not fail the stage move.
 */
async function hasAssessmentOutcomeEvent(
  applicationId: number,
  eventType: "ASSESSMENT_PASSED" | "ASSESSMENT_FAILED"
): Promise<boolean> {
  try {
    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_notification_event?filter[event_type][_eq]=${eventType}&filter[entity_type][_eq]=job_application&filter[entity_id][_eq]=${applicationId}&fields=event_id&limit=1`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (!res.ok) return false;
    const json = await res.json();
    return Array.isArray(json.data) && json.data.length > 0;
  } catch {
    return false;
  }
}

export async function notifyFreelancerOfAssessmentOutcome(input: {
  applicationId: number;
  freelancerUserId: number;
  actingUserId?: number | null;
  fromStageName: string;
  outcome: "PASS" | "FAIL";
}): Promise<void> {
  try {
    const freelancerId = input.freelancerUserId;
    if (!Number.isSafeInteger(freelancerId) || freelancerId <= 0) return;
    if (input.actingUserId !== null && input.actingUserId !== undefined && freelancerId === input.actingUserId) return;
    const eventType = input.outcome === "PASS" ? "ASSESSMENT_PASSED" : "ASSESSMENT_FAILED";
    if (await hasAssessmentOutcomeEvent(input.applicationId, eventType)) return;
    const passed = input.outcome === "PASS";
    await createNotification({
      event_type: eventType,
      recipient_user_id: freelancerId,
      entity_type: "job_application",
      entity_id: input.applicationId,
      category: eventType,
      title: passed ? "Assessment passed" : "Assessment not passed",
      message: passed
        ? `Your assessment for "${input.fromStageName}" was marked as passed.`
        : `Your assessment for "${input.fromStageName}" was marked as failed.`,
      action_url: `/linkbridge/freelancer/applications?assessment=${input.applicationId}`,
    }).catch((error: unknown) => console.error("[job-pipeline.service] assessment outcome notify error:", error));
  } catch (error) {
    console.error("[job-pipeline.service] assessment outcome notification failed:", error);
  }
}

/**
 * Transitions an application to a new ATS pipeline stage according to authoritative
 * job pipeline rules, configured transitions, universal exits, and audit history.
 */
export async function transitionApplicationStage({
  applicationId,
  toStageId,
  changedByUserId,
  changeReason,
  notes,
  assessmentOutcome,
}: TransitionStageParams): Promise<TransitionStageResult> {
  try {
    const nowPH = getPHTimeString();

    const resolved = await resolveStageMoveContext(applicationId, toStageId);
    if (!resolved.ok) {
      return { success: false, error: resolved.error, statusCode: resolved.statusCode };
    }
    const { appData, pipeline, fromStage, toStage, hasConfiguredTransition, isUniversalExit } =
      resolved.context;

    // 5. Guard: No-op if already in the target stage
    if (fromStage.id === toStage.id) {
      return {
        success: true,
        noop: true,
        application: appData,
        fromStage,
        toStage,
      };
    }

    // 6. Guard: Cannot move OUT of a terminal stage or terminal status
    const rawAppStatus = String(appData.application_status || "").toUpperCase();
    const isTerminalStatus = rawAppStatus === "REJECTED" || rawAppStatus === "WITHDRAWN" || rawAppStatus === "HIRED";

    if (fromStage.is_terminal || isTerminalStatus) {
      return {
        success: false,
        error: `Candidate is in terminal stage "${fromStage.stage_name}" and cannot be transitioned further.`,
        statusCode: 422,
      };
    }

    // 7. Transition validation: the route must be a configured transition
    // or a universal REJECTED/WITHDRAWN exit (flags resolved above).
    if (!hasConfiguredTransition && !isUniversalExit) {
      return {
        success: false,
        error: `Transition from "${fromStage.stage_name}" to "${toStage.stage_name}" is not configured in this job's pipeline.`,
        statusCode: 422,
      };
    }

    // 7b. ASSESSMENT progression gate: a configured (non-universal) move out
    // of a task-bearing ASSESSMENT stage requires a move-time
    // assessment_outcome. Universal REJECTED/WITHDRAWN exits and task-free
    // stages always pass.
    const gateError = await checkAssessmentGate({
      applicationId,
      fromStage,
      isUniversalExit,
      hasConfiguredTransition,
      assessmentOutcome,
    });
    if (gateError) {
      return { success: false, error: gateError, statusCode: 409 };
    }

    // 7c. Record the move-time outcome on the latest attempt before
    // performing the move. Non-qualifying moves never reach a write here:
    // the gate above rejects a missing outcome, and the qualifying re-check
    // below guards a gratuitous one. FAIL records and STAYS (no transition,
    // no history write); PASS records then moves exactly as before.
    let moveOutcome: "PASS" | "FAIL" | null = null;
    if (isValidAssessmentOutcome(assessmentOutcome)) {
      const qualifying = await isQualifyingAssessmentMove({
        fromStage,
        isUniversalExit,
        hasConfiguredTransition,
      });
      if (qualifying) {
        const recordError = await recordAssessmentMoveOutcome({
          applicationId,
          jobStageId: fromStage.id,
          outcome: assessmentOutcome,
          reviewedBy: changedByUserId ?? null,
        });
        if (recordError) {
          return { success: false, error: recordError, statusCode: 502 };
        }
        moveOutcome = assessmentOutcome;
        if (assessmentOutcome === "FAIL") {
          await notifyFreelancerOfAssessmentOutcome({
            applicationId,
            freelancerUserId: Number(appData.user_id),
            actingUserId: changedByUserId ?? null,
            fromStageName: fromStage.stage_name,
            outcome: "FAIL",
          });
          return {
            success: true,
            moved: false,
            outcome: "FAIL",
            application: appData,
            fromStage,
            toStage: fromStage,
          };
        }
      }
    }

    // 8. Update vs_job_application:
    // Set current_stage_id, application_status (canonical synchronization!), client_notes, status_updated_at
    const dbStatus =
      CANONICAL_TO_LEGACY_STATUS_MAP[toStage.stage_type] ?? toStage.stage_type;

    const patchPayload: Record<string, unknown> = {
      current_stage_id: toStage.id,
      application_status: dbStatus,
      status_updated_at: nowPH,
    };
    if (notes !== undefined && notes !== null) {
      patchPayload.client_notes = notes;
    }

    const patchRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_application/${applicationId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(patchPayload),
    });
    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error("[job-pipeline.service] Failed to update application current_stage_id:", errText);
      return { success: false, error: "Failed to update application stage.", statusCode: 500 };
    }
    const updatedAppJson = await patchRes.json();

    // 9. Write audit record into vs_application_stage_history
    const reason = notes || changeReason || `Moved from "${fromStage.stage_name}" to "${toStage.stage_name}"`;
    let stageHistoryId: number | null = null;
    try {
      const stageHistoryRes = await fetch(`${DIRECTUS_BASE}/items/vs_application_stage_history`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          application_id: applicationId,
          from_stage_id: fromStage.id,
          to_stage_id: toStage.id,
          changed_by: changedByUserId ?? null,
          change_reason: reason,
          metadata: {
            from_stage_name: fromStage.stage_name,
            to_stage_name: toStage.stage_name,
            from_stage_type: fromStage.stage_type,
            to_stage_type: toStage.stage_type,
            job_pipeline_id: pipeline.id,
          },
          created_at: nowPH,
        }),
      });
      if (stageHistoryRes.ok) {
        const shJson = await stageHistoryRes.json();
        stageHistoryId = shJson.data?.id ? Number(shJson.data.id) : null;
      }
    } catch (e) {
      console.error("[job-pipeline.service] vs_application_stage_history insert error:", e);
    }

    // 10. Arrival notification: the history row above is the stage-entry
    // timestamp, so the deadline derives from the same nowPH instant.
    if (toStage.stage_type === "ASSESSMENT") {
      await notifyFreelancerOfAssessmentAssignment({
        applicationId,
        freelancerUserId: Number(appData.user_id),
        actingUserId: changedByUserId ?? null,
        toStage,
        entryTime: nowPH,
      });
    }

    if (moveOutcome === "PASS") {
      await notifyFreelancerOfAssessmentOutcome({
        applicationId,
        freelancerUserId: Number(appData.user_id),
        actingUserId: changedByUserId ?? null,
        fromStageName: fromStage.stage_name,
        outcome: "PASS",
      });
    }

        // 11. Interview status synchronization upon reaching terminal stages:
    // When an applicant reaches HIRED, REJECTED, or WITHDRAWN, automatically synchronize pending/open interviews.
    const terminalType =
      toStage.stage_type === "HIRED" || dbStatus === "HIRED"
        ? "HIRED"
        : toStage.stage_type === "REJECTED" || dbStatus === "REJECTED"
        ? "REJECTED"
        : toStage.stage_type === "WITHDRAWN" || dbStatus === "WITHDRAWN"
        ? "WITHDRAWN"
        : null;

    if (terminalType) {
      await syncInterviewsOnTerminalStage({
        applicationId,
        terminalType,
        changedByUserId: changedByUserId ?? null,
        nowPH,
      });
    }

    return {
      success: true,
      moved: true,
      outcome: moveOutcome,
      application: updatedAppJson.data ?? { ...appData, ...patchPayload },
      fromStage,
      toStage,
      stageHistoryId,
    };
  } catch (err) {
    console.error("[job-pipeline.service] transitionApplicationStage error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Internal error transitioning application stage.",
      statusCode: 500,
    };
  }
}

export type TerminalStageType = "HIRED" | "REJECTED" | "WITHDRAWN";

interface SyncInterviewsOnTerminalStageParams {
  applicationId: number;
  terminalType: TerminalStageType;
  changedByUserId?: number | null;
  nowPH: string;
}

/**
 * Automatically synchronize interview schedules when a candidate reaches a terminal stage (HIRED, REJECTED, WITHDRAWN).
 * - Concluded/past active interviews: marks candidate attendance and completes/closes the session to prevent false pending alerts.
 * - Future upcoming interviews: cancels single-candidate sessions (or removes candidate from active queues).
 */
export async function syncInterviewsOnTerminalStage({
  applicationId,
  terminalType,
  changedByUserId,
  nowPH,
}: SyncInterviewsOnTerminalStageParams): Promise<void> {
  try {
    // 1. Fetch all interview application junction records for this candidate
    const junctionRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_interview_application?filter[application_id][_eq]=${applicationId}&fields=interview_application_id,interview_id,attendance_status,candidate_notes&limit=-1`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!junctionRes.ok) {
      console.error(
        `[job-pipeline.service] syncInterviewsOnTerminalStage: Failed to fetch interview applications for app ${applicationId} (${junctionRes.status})`
      );
      return;
    }

    const junctionRows = (await junctionRes.json()).data as Array<{
      interview_application_id: number;
      interview_id: number;
      attendance_status: string;
      candidate_notes?: string | null;
    }>;

    if (!Array.isArray(junctionRows) || junctionRows.length === 0) {
      return;
    }

    const ACTIVE_STATUSES = new Set(["SCHEDULED", "CONFIRMED", "RESCHEDULED"]);
    const nowMs = Date.now();

    const futureCancelReasons: Record<TerminalStageType, string> = {
      HIRED: "Candidate hired",
      REJECTED: "Candidate application rejected",
      WITHDRAWN: "Candidate withdrew application",
    };

    const futureSingleNotes: Record<TerminalStageType, string> = {
      HIRED: "Cancelled — candidate hired.",
      REJECTED: "Cancelled — candidate rejected.",
      WITHDRAWN: "Cancelled — candidate withdrew.",
    };

    const futureGroupNotes: Record<TerminalStageType, string> = {
      HIRED: "Cancelled for this candidate — candidate hired.",
      REJECTED: "Cancelled for this candidate — candidate rejected.",
      WITHDRAWN: "Cancelled for this candidate — candidate withdrew.",
    };

    for (const j of junctionRows) {
      if (!j.interview_id) continue;

      // 2. Fetch parent interview details
      const parentRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_interview/${j.interview_id}?fields=interview_id,interview_status,scheduled_at,duration_minutes`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (!parentRes.ok) continue;
      const parentIv = (await parentRes.json()).data;
      if (!parentIv) continue;

      const parentStatus = String(parentIv.interview_status || "").toUpperCase();
      const isParentActive = ACTIVE_STATUSES.has(parentStatus);
      const isCandidatePending = String(j.attendance_status || "").toUpperCase() === "PENDING";

      // If interview is already completed/cancelled and candidate attendance is not pending, skip
      if (!isParentActive && !isCandidatePending) {
        continue;
      }

      // Check whether scheduled time has passed or is in the future
      let isPast = true;
      if (parentIv.scheduled_at) {
        const d = new Date(String(parentIv.scheduled_at).replace(" ", "T"));
        if (!isNaN(d.getTime())) {
          isPast = d.getTime() <= nowMs;
        }
      }

      if (isPast) {
        // --- PAST INTERVIEW ---
        if (terminalType === "WITHDRAWN") {
          // Candidate withdrew: update junction note
          await fetch(`${DIRECTUS_BASE}/items/vs_interview_application/${j.interview_application_id}`, {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify({
              candidate_notes: j.candidate_notes || "Candidate withdrew application.",
            }),
          }).catch((err) =>
            console.error("[job-pipeline.service] Failed to update interview application notes:", err)
          );

          if (isParentActive) {
            // Check if single or multi-candidate
            const allRes = await fetch(
              `${DIRECTUS_BASE}/items/vs_interview_application?filter[interview_id][_eq]=${j.interview_id}&fields=interview_application_id,attendance_status&limit=-1`,
              { headers: getHeaders(), cache: "no-store" }
            );
            const allCandidates = allRes.ok ? ((await allRes.json()).data ?? []) : [];
            const otherCandidates = allCandidates.filter(
              (c: { interview_application_id: number }) => c.interview_application_id !== j.interview_application_id
            );

            if (otherCandidates.length === 0) {
              // Single candidate: cancel the past unresolved session
              await fetch(`${DIRECTUS_BASE}/items/vs_interview/${j.interview_id}`, {
                method: "PATCH",
                headers: getHeaders(),
                body: JSON.stringify({
                  interview_status: "CANCELLED",
                  cancel_reason: "Candidate withdrew application",
                  updated_by_user_id: changedByUserId ?? undefined,
                  updated_at: nowPH,
                }),
              }).catch((err) =>
                console.error("[job-pipeline.service] Failed to cancel withdrawn interview session:", err)
              );
            } else {
              // Multi-candidate: if all others are non-pending, mark completed
              const othersResolved = otherCandidates.every(
                (c: { attendance_status: string }) => String(c.attendance_status || "").toUpperCase() !== "PENDING"
              );
              if (othersResolved) {
                await fetch(`${DIRECTUS_BASE}/items/vs_interview/${j.interview_id}`, {
                  method: "PATCH",
                  headers: getHeaders(),
                  body: JSON.stringify({
                    interview_status: "COMPLETED",
                    updated_by_user_id: changedByUserId ?? undefined,
                    updated_at: nowPH,
                  }),
                }).catch((err) =>
                  console.error("[job-pipeline.service] Failed to complete past multi-candidate session:", err)
                );
              }
            }
          }
        } else {
          // HIRED or REJECTED: Candidate sat the past interview (decision made based on or after interview)
          const pastNote =
            terminalType === "HIRED"
              ? "Attended — candidate hired."
              : "Attended — interview concluded before application rejection.";

          if (isCandidatePending) {
            await fetch(`${DIRECTUS_BASE}/items/vs_interview_application/${j.interview_application_id}`, {
              method: "PATCH",
              headers: getHeaders(),
              body: JSON.stringify({
                attendance_status: "ATTENDED",
                candidate_notes: j.candidate_notes || pastNote,
              }),
            }).catch((err) =>
              console.error("[job-pipeline.service] Failed to update interview application attendance:", err)
            );
          }

          if (isParentActive) {
            const allRes = await fetch(
              `${DIRECTUS_BASE}/items/vs_interview_application?filter[interview_id][_eq]=${j.interview_id}&fields=interview_application_id,attendance_status&limit=-1`,
              { headers: getHeaders(), cache: "no-store" }
            );
            if (allRes.ok) {
              const allCandidates = (await allRes.json()).data ?? [];
              const allResolved = allCandidates.every(
                (c: { interview_application_id: number; attendance_status: string }) =>
                  c.interview_application_id === j.interview_application_id ||
                  String(c.attendance_status || "").toUpperCase() !== "PENDING"
              );
              if (allResolved) {
                await fetch(`${DIRECTUS_BASE}/items/vs_interview/${j.interview_id}`, {
                  method: "PATCH",
                  headers: getHeaders(),
                  body: JSON.stringify({
                    interview_status: "COMPLETED",
                    updated_by_user_id: changedByUserId ?? undefined,
                    updated_at: nowPH,
                  }),
                }).catch((err) =>
                  console.error("[job-pipeline.service] Failed to complete past interview session:", err)
                );
              }
            }
          }
        }
      } else {
        // --- FUTURE / UPCOMING INTERVIEW ---
        // Candidate reached a terminal stage, so upcoming interview should be cancelled
        const allRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_interview_application?filter[interview_id][_eq]=${j.interview_id}&fields=interview_application_id&limit=-1`,
          { headers: getHeaders(), cache: "no-store" }
        );
        const allCandidates = allRes.ok ? ((await allRes.json()).data ?? []) : [];
        const hasOtherCandidates = allCandidates.some(
          (c: { interview_application_id: number }) => c.interview_application_id !== j.interview_application_id
        );

        if (!hasOtherCandidates && isParentActive) {
          // Single-candidate session: Cancel the entire interview
          await fetch(`${DIRECTUS_BASE}/items/vs_interview/${j.interview_id}`, {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify({
              interview_status: "CANCELLED",
              cancel_reason: futureCancelReasons[terminalType],
              updated_by_user_id: changedByUserId ?? undefined,
              updated_at: nowPH,
            }),
          }).catch((err) =>
            console.error("[job-pipeline.service] Failed to cancel future interview session:", err)
          );

          await fetch(`${DIRECTUS_BASE}/items/vs_interview_application/${j.interview_application_id}`, {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify({
              candidate_notes: futureSingleNotes[terminalType],
            }),
          }).catch((err) =>
            console.error("[job-pipeline.service] Failed to annotate cancelled junction record:", err)
          );
        } else {
          // Multi-candidate session: Do not cancel the session for others, annotate this candidate
          await fetch(`${DIRECTUS_BASE}/items/vs_interview_application/${j.interview_application_id}`, {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify({
              candidate_notes: futureGroupNotes[terminalType],
            }),
          }).catch((err) =>
            console.error("[job-pipeline.service] Failed to annotate multi-candidate junction record:", err)
          );
        }
      }
    }
  } catch (err) {
    console.error("[job-pipeline.service] syncInterviewsOnTerminalStage unexpected error:", err);
  }
}

/**
 * Backward-compatible helper for hiring specifically.
 */
export async function syncInterviewsOnCandidateHire(
  params: Omit<SyncInterviewsOnTerminalStageParams, "terminalType">
): Promise<void> {
  return syncInterviewsOnTerminalStage({ ...params, terminalType: "HIRED" });
}

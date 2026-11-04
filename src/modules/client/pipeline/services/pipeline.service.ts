// src/modules/client/pipeline/services/pipeline.service.ts

import {
  CanonicalStageType,
  CANONICAL_STAGE_TYPES,
  CompanyPipeline,
  CUSTOM_ALLOWED_STAGE_TYPES,
  PipelineStage,
  PipelineTransition,
  STAGE_TYPE_DETAILS,
  TERMINAL_STAGE_TYPES,
} from "../types";
import { getPHTimeString } from "@/lib/utils";
import { mapPool } from "@/lib/server/pool";

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

// Default 8-stage canonical pipeline configuration
export const DEFAULT_PIPELINE_STAGES: Array<{
  stage_name: string;
  stage_type: CanonicalStageType;
  stage_order: number;
  color: string;
  description: string;
  is_terminal: boolean;
  is_system: boolean;
}> = [
  {
    stage_name: "Application Received",
    stage_type: "APPLIED",
    stage_order: 1,
    color: "sky",
    description: "New candidate submission awaiting initial review.",
    is_terminal: false,
    is_system: true,
  },
  {
    stage_name: "Screening",
    stage_type: "SCREENING",
    stage_order: 2,
    color: "blue",
    description: "Initial profile and resume evaluation.",
    is_terminal: false,
    is_system: false,
  },
  {
    stage_name: "Assessment",
    stage_type: "ASSESSMENT",
    stage_order: 3,
    color: "indigo",
    description: "Technical challenge, evaluation test, or assignment.",
    is_terminal: false,
    is_system: false,
  },
  {
    stage_name: "Interview",
    stage_type: "INTERVIEW",
    stage_order: 4,
    color: "purple",
    description: "Live technical or hiring manager interview rounds.",
    is_terminal: false,
    is_system: false,
  },
  {
    stage_name: "Offer",
    stage_type: "OFFER",
    stage_order: 5,
    color: "amber",
    description: "Formal job offer extended to candidate.",
    is_terminal: false,
    is_system: false,
  },
  {
    stage_name: "Hired",
    stage_type: "HIRED",
    stage_order: 6,
    color: "emerald",
    description: "Candidate accepted the offer and is officially hired.",
    is_terminal: true,
    is_system: true,
  },
  {
    stage_name: "Rejected",
    stage_type: "REJECTED",
    stage_order: 7,
    color: "rose",
    description: "Candidate did not meet requirements or was declined.",
    is_terminal: true,
    is_system: true,
  },
  {
    stage_name: "Withdrawn",
    stage_type: "WITHDRAWN",
    stage_order: 8,
    color: "zinc",
    description: "Candidate voluntarily withdrew application.",
    is_terminal: true,
    is_system: true,
  },
];

/**
 * Validates canonical stage type
 */
export function isValidStageType(stageType: string): stageType is CanonicalStageType {
  return CANONICAL_STAGE_TYPES.includes(stageType as CanonicalStageType);
}

/**
 * Validates terminal integrity for a stage type
 */
export function isTerminalStageType(stageType: CanonicalStageType): boolean {
  return TERMINAL_STAGE_TYPES.includes(stageType);
}

export const MAX_ASSESSMENT_SUBMISSION_WINDOW_DAYS = 365;

export function parseAssessmentSubmissionWindow(
  value: unknown
): { ok: true; days: number | null } | { ok: false; error: string } {
  if (value === null) return { ok: true, days: null };
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return {
      ok: false,
      error: "Submission window must be a whole number of days, or null to clear.",
    };
  }
  if (value < 0) {
    return { ok: false, error: "Submission window must be a non-negative number of days." };
  }
  if (value > MAX_ASSESSMENT_SUBMISSION_WINDOW_DAYS) {
    return {
      ok: false,
      error: `Submission window must not exceed ${MAX_ASSESSMENT_SUBMISSION_WINDOW_DAYS} days.`,
    };
  }
  return { ok: true, days: value };
}

/**
 * Retrieves all company pipelines, seeding the default template if none exist.
 */
export async function getCompanyPipelines(companyId: number): Promise<CompanyPipeline[]> {
  try {
    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_company_pipelines?filter[company_id][_eq]=${companyId}&filter[status][_neq]=ARCHIVED&sort=id`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!res.ok) {
      console.error(`[pipeline.service] Error fetching pipelines for company ${companyId}: ${res.status}`);
      return [];
    }

    const json = (await res.json()) as { data?: CompanyPipeline[] };
    let pipelines = json.data ?? [];

    // If company has no pipelines, seed default company pipeline
    if (pipelines.length === 0) {
      const seeded = await seedDefaultCompanyPipeline(companyId);
      if (seeded) {
        pipelines = [seeded];
      }
    }

    // Hydrate stages and transitions for each pipeline
    return await mapPool(
      pipelines,
      async (pipeline) =>
        (await getPipelineWithDetails(pipeline.id, companyId)) ?? pipeline
    );
  } catch (error) {
    console.error("[pipeline.service] getCompanyPipelines exception:", error);
    return [];
  }
}

/**
 * Retrieves a single pipeline with full stages and transitions
 */
export async function getPipelineWithDetails(
  pipelineId: number,
  companyId: number
): Promise<CompanyPipeline | null> {
  try {
    // 1. Fetch pipeline
    const pipeRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_company_pipelines/${pipelineId}?filter[company_id][_eq]=${companyId}`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!pipeRes.ok) return null;
    const pipeJson = (await pipeRes.json()) as { data?: CompanyPipeline };
    const pipeline = pipeJson.data;
    if (!pipeline || pipeline.company_id !== companyId) return null;

    // 2. Fetch stages
    const stagesRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_company_pipeline_stages?filter[pipeline_id][_eq]=${pipelineId}&sort=stage_order&limit=-1`,
      { headers: getHeaders(), cache: "no-store" }
    );
    const stagesJson = (await stagesRes.json()) as { data?: PipelineStage[] };
    const stages = stagesJson.data ?? [];

    // 3. Fetch transitions
    const transRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_company_pipeline_transitions?filter[pipeline_id][_eq]=${pipelineId}&limit=-1`,
      { headers: getHeaders(), cache: "no-store" }
    );
    const transJson = (await transRes.json()) as { data?: PipelineTransition[] };
    const transitions = transJson.data ?? [];

    // 4. Enrich stages with allowed_next_stage_ids
    const stageIdSet = new Set(stages.map((s) => Number(s.id)));
    const transitionMap = new Map<number, number[]>();
    for (const t of transitions) {
      const fromId = Number(typeof t.from_stage_id === "object" && t.from_stage_id !== null ? (t.from_stage_id as { id?: unknown }).id : t.from_stage_id);
      const toId = Number(typeof t.to_stage_id === "object" && t.to_stage_id !== null ? (t.to_stage_id as { id?: unknown }).id : t.to_stage_id);
      // Only include transitions where BOTH fromId and toId currently exist in the pipeline stages
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

    return {
      ...pipeline,
      stages: enrichedStages,
      transitions,
    };
  } catch (error) {
    console.error(`[pipeline.service] getPipelineWithDetails error:`, error);
    return null;
  }
}

/**
 * Automatically seeds the standard default pipeline for a company
 */
export async function seedDefaultCompanyPipeline(companyId: number): Promise<CompanyPipeline | null> {
  try {
    const nowPH = getPHTimeString();

    // 1. Create pipeline header
    const createRes = await fetch(`${DIRECTUS_BASE}/items/vs_company_pipelines`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        company_id: companyId,
        name: "Default ATS Pipeline",
        is_default: true,
        version: 1,
        status: "ACTIVE",
        created_at: nowPH,
        updated_at: nowPH,
      }),
    });

    if (!createRes.ok) {
      console.error("[pipeline.service] Failed creating default pipeline header:", await createRes.text());
      return null;
    }

    const createJson = (await createRes.json()) as { data?: CompanyPipeline };
    const newPipeline = createJson.data;
    if (!newPipeline?.id) return null;

    // 2. Insert 8 canonical stages
    const createdStages: PipelineStage[] = [];
    for (const s of DEFAULT_PIPELINE_STAGES) {
      const stageRes = await fetch(`${DIRECTUS_BASE}/items/vs_company_pipeline_stages`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          pipeline_id: newPipeline.id,
          stage_name: s.stage_name,
          stage_type: s.stage_type,
          stage_order: s.stage_order,
          color: s.color,
          description: s.description,
          is_terminal: s.is_terminal,
          is_system: s.is_system,
          created_at: getPHTimeString(),
          updated_at: getPHTimeString(),
        }),
      });

      if (stageRes.ok) {
        const stageJson = (await stageRes.json()) as { data?: PipelineStage };
        if (stageJson.data) createdStages.push(stageJson.data);
      }
    }

    // 3. Insert default linear transitions:
    // Application Received -> Screening
    // Screening -> Assessment
    // Screening -> Interview
    // Assessment -> Interview
    // Interview -> Offer
    // Offer -> Hired
    const stageByType = new Map<CanonicalStageType, PipelineStage>();
    for (const st of createdStages) {
      stageByType.set(st.stage_type, st);
    }

    const defaultTransitionPairs: Array<[CanonicalStageType, CanonicalStageType]> = [
      ["APPLIED", "SCREENING"],
      ["SCREENING", "ASSESSMENT"],
      ["SCREENING", "INTERVIEW"],
      ["ASSESSMENT", "INTERVIEW"],
      ["INTERVIEW", "OFFER"],
      ["OFFER", "HIRED"],
    ];

    const createdTransitions: PipelineTransition[] = [];
    for (const [fromType, toType] of defaultTransitionPairs) {
      const fromSt = stageByType.get(fromType);
      const toSt = stageByType.get(toType);
      if (fromSt && toSt) {
        const tRes = await fetch(`${DIRECTUS_BASE}/items/vs_company_pipeline_transitions`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            pipeline_id: newPipeline.id,
            from_stage_id: fromSt.id,
            to_stage_id: toSt.id,
            created_at: getPHTimeString(),
          }),
        });
        if (tRes.ok) {
          const tJson = (await tRes.json()) as { data?: PipelineTransition };
          if (tJson.data) createdTransitions.push(tJson.data);
        }
      }
    }

    return {
      ...newPipeline,
      stages: createdStages,
      transitions: createdTransitions,
    };
  } catch (error) {
    console.error("[pipeline.service] seedDefaultCompanyPipeline exception:", error);
    return null;
  }
}

/**
 * Creates a new company pipeline
 */
export async function createCompanyPipeline(
  companyId: number,
  data: { name: string; is_default?: boolean }
): Promise<CompanyPipeline | null> {
  try {
    const nowPH = getPHTimeString();

    // Enforce quota: maximum 20 pipeline templates per company
    const countRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_company_pipelines?filter[company_id][_eq]=${companyId}&filter[status][_neq]=ARCHIVED&aggregate[count]=id`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (countRes.ok) {
      const countJson = await countRes.json();
      const currentCount = Number(countJson.data?.[0]?.count?.id ?? countJson.data?.[0]?.count ?? 0);
      if (currentCount >= 20) {
        console.warn(`[pipeline.service] Company ${companyId} reached maximum 20 pipeline templates limit.`);
        return null;
      }
    }

    if (data.is_default) {
      // Unset previous defaults by ID
      const checkRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_company_pipelines?filter[company_id][_eq]=${companyId}&fields=id,is_default`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (checkRes.ok) {
        const checkJson = (await checkRes.json()) as {
          data?: Array<{ id: number; is_default: boolean | number }>;
        };
        const existingList = checkJson.data ?? [];
        for (const pipe of existingList) {
          if (Boolean(pipe.is_default)) {
            await fetch(`${DIRECTUS_BASE}/items/vs_company_pipelines/${pipe.id}`, {
              method: "PATCH",
              headers: getHeaders(),
              body: JSON.stringify({ is_default: false, updated_at: nowPH }),
            });
          }
        }
      }
    }

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_company_pipelines`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        company_id: companyId,
        name: data.name.trim(),
        is_default: Boolean(data.is_default),
        version: 1,
        status: "ACTIVE",
        created_at: nowPH,
        updated_at: nowPH,
      }),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as { data?: CompanyPipeline };
    const newPipeline = json.data;
    if (!newPipeline) return null;

    // Clone standard 8 canonical stages to initialize the custom pipeline
    const createdStages: PipelineStage[] = [];
    for (const s of DEFAULT_PIPELINE_STAGES) {
      const stageRes = await fetch(`${DIRECTUS_BASE}/items/vs_company_pipeline_stages`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          pipeline_id: newPipeline.id,
          stage_name: s.stage_name,
          stage_type: s.stage_type,
          stage_order: s.stage_order,
          color: s.color,
          description: s.description,
          is_terminal: s.is_terminal,
          is_system: s.is_system,
          created_at: nowPH,
          updated_at: nowPH,
        }),
      });

      if (stageRes.ok) {
        const stageJson = (await stageRes.json()) as { data?: PipelineStage };
        if (stageJson.data) createdStages.push(stageJson.data);
      }
    }

    // Insert default linear transitions
    const stageByType = new Map<CanonicalStageType, PipelineStage>();
    for (const st of createdStages) {
      stageByType.set(st.stage_type, st);
    }

    const defaultTransitionPairs: Array<[CanonicalStageType, CanonicalStageType]> = [
      ["APPLIED", "SCREENING"],
      ["SCREENING", "ASSESSMENT"],
      ["SCREENING", "INTERVIEW"],
      ["ASSESSMENT", "INTERVIEW"],
      ["INTERVIEW", "OFFER"],
      ["OFFER", "HIRED"],
    ];

    for (const [fromType, toType] of defaultTransitionPairs) {
      const fromSt = stageByType.get(fromType);
      const toSt = stageByType.get(toType);
      if (fromSt && toSt) {
        await fetch(`${DIRECTUS_BASE}/items/vs_company_pipeline_transitions`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            pipeline_id: newPipeline.id,
            from_stage_id: fromSt.id,
            to_stage_id: toSt.id,
            created_at: nowPH,
          }),
        });
      }
    }

    return await getPipelineWithDetails(newPipeline.id, companyId);
  } catch (error) {
    console.error("[pipeline.service] createCompanyPipeline error:", error);
    return null;
  }
}

/**
 * Updates company pipeline metadata
 */
export async function updateCompanyPipeline(
  pipelineId: number,
  companyId: number,
  payload: { name?: string; is_default?: boolean; status?: "ACTIVE" | "ARCHIVED" }
): Promise<boolean> {
  try {
    const nowPH = getPHTimeString();

    // Verify pipeline belongs to company
    const pipeline = await getPipelineWithDetails(pipelineId, companyId);
    if (!pipeline || pipeline.company_id !== companyId) {
      console.warn(`[pipeline.service] Unauthorized update attempt for pipeline ${pipelineId} by company ${companyId}`);
      return false;
    }

    if (payload.is_default) {
      // Unset previous defaults by ID
      const checkRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_company_pipelines?filter[company_id][_eq]=${companyId}&fields=id,is_default`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (checkRes.ok) {
        const checkJson = (await checkRes.json()) as {
          data?: Array<{ id: number; is_default: boolean | number }>;
        };
        const existingList = checkJson.data ?? [];
        for (const pipe of existingList) {
          if (pipe.id !== pipelineId && Boolean(pipe.is_default)) {
            await fetch(`${DIRECTUS_BASE}/items/vs_company_pipelines/${pipe.id}`, {
              method: "PATCH",
              headers: getHeaders(),
              body: JSON.stringify({ is_default: false, updated_at: nowPH }),
            });
          }
        }
      }
    }

    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_company_pipelines/${pipelineId}`,
      {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({
          ...payload,
          updated_at: nowPH,
        }),
      }
    );

    return res.ok;
  } catch (error) {
    console.error("[pipeline.service] updateCompanyPipeline error:", error);
    return false;
  }
}

/**
 * Soft deletes / archives a company pipeline template
 */
export async function deleteCompanyPipeline(
  pipelineId: number,
  companyId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const pipeline = await getPipelineWithDetails(pipelineId, companyId);
    if (!pipeline || pipeline.company_id !== companyId) {
      return { success: false, error: "Pipeline template not found or unauthorized." };
    }

    if (pipeline.is_default) {
      return {
        success: false,
        error: "The default pipeline template cannot be deleted. Please set another template as default first.",
      };
    }

    // Verify company has more than one active pipeline template
    const countRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_company_pipelines?filter[company_id][_eq]=${companyId}&filter[status][_neq]=ARCHIVED&aggregate[count]=id`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (countRes.ok) {
      const countJson = await countRes.json();
      const currentCount = Number(countJson.data?.[0]?.count?.id ?? countJson.data?.[0]?.count ?? 0);
      if (currentCount <= 1) {
        return {
          success: false,
          error: "At least one active pipeline template is required.",
        };
      }
    }

    const nowPH = getPHTimeString();
    const res = await fetch(`${DIRECTUS_BASE}/items/vs_company_pipelines/${pipelineId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({
        status: "ARCHIVED",
        updated_at: nowPH,
      }),
    });

    if (!res.ok) {
      console.error("[pipeline.service] deleteCompanyPipeline failed:", await res.text());
      return { success: false, error: "Failed to delete pipeline template." };
    }

    return { success: true };
  } catch (error) {
    console.error("[pipeline.service] deleteCompanyPipeline error:", error);
    return { success: false, error: "An unexpected error occurred while deleting the pipeline template." };
  }
}

/**
 * Adds a new stage to a pipeline
 */
export async function addPipelineStage(
  pipelineId: number,
  companyId: number,
  data: {
    stage_name: string;
    stage_type: CanonicalStageType;
    color?: string;
    description?: string;
  }
): Promise<PipelineStage | null> {
  try {
    // Verify pipeline belongs to company
    const pipeline = await getPipelineWithDetails(pipelineId, companyId);
    if (!pipeline) throw new Error("Pipeline not found or unauthorized.");

    const currentStages = pipeline.stages ?? [];
    if (currentStages.length >= 25) {
      throw new Error("Maximum 25 stages allowed per pipeline.");
    }

    if (!CUSTOM_ALLOWED_STAGE_TYPES.includes(data.stage_type)) {
      throw new Error(
        `Custom stages must be an intermediate evaluation step (${CUSTOM_ALLOWED_STAGE_TYPES.join(", ")}).`
      );
    }

    // Terminal integrity: custom stages are evaluation steps and cannot be terminal
    const isTerminal = false;

    // Calculate next stage_order
    const maxOrder = currentStages.reduce((max, s) => Math.max(max, s.stage_order), 0);
    const stageOrder = maxOrder + 1;

    const defaultColor = STAGE_TYPE_DETAILS[data.stage_type]?.defaultColor || "sky";
    const nowPH = getPHTimeString();

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_company_pipeline_stages`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        pipeline_id: pipelineId,
        stage_name: data.stage_name.trim(),
        stage_type: data.stage_type,
        stage_order: stageOrder,
        color: data.color || defaultColor,
        description: data.description?.trim() || null,
        is_terminal: isTerminal,
        is_system: false,
        created_at: nowPH,
        updated_at: nowPH,
      }),
    });

    if (!res.ok) {
      console.error("[pipeline.service] addPipelineStage failed:", await res.text());
      return null;
    }

    const json = (await res.json()) as { data?: PipelineStage };
    return json.data ?? null;
  } catch (error) {
    console.error("[pipeline.service] addPipelineStage error:", error);
    return null;
  }
}

/**
 * Updates a stage in a pipeline
 */
export async function updatePipelineStage(
  pipelineId: number,
  stageId: number,
  companyId: number,
  data: {
    stage_name?: string;
    color?: string;
    description?: string;
    stage_order?: number;
    assessment_submission_window_days?: number | null;
  }
): Promise<boolean> {
  try {
    const pipeline = await getPipelineWithDetails(pipelineId, companyId);
    if (!pipeline) return false;

    const stage = pipeline.stages?.find((s) => s.id === stageId);
    if (!stage) return false;

    const nowPH = getPHTimeString();
    const updatePayload: Record<string, unknown> = {
      updated_at: nowPH,
    };

    if (data.stage_name !== undefined) updatePayload.stage_name = data.stage_name.trim();
    if (data.color !== undefined) updatePayload.color = data.color;
    if (data.description !== undefined) updatePayload.description = data.description.trim() || null;
    if (data.stage_order !== undefined) updatePayload.stage_order = data.stage_order;
    if (data.assessment_submission_window_days !== undefined) {
      updatePayload.assessment_submission_window_days = data.assessment_submission_window_days;
    }

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_company_pipeline_stages/${stageId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updatePayload),
    });

    return res.ok;
  } catch (error) {
    console.error("[pipeline.service] updatePipelineStage error:", error);
    return false;
  }
}

/**
 * Deletes a stage from a pipeline (system stages cannot be deleted)
 */
export async function deletePipelineStage(
  pipelineId: number,
  stageId: number,
  companyId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const pipeline = await getPipelineWithDetails(pipelineId, companyId);
    if (!pipeline) return { success: false, error: "Pipeline not found." };

    const stage = pipeline.stages?.find((s) => s.id === stageId);
    if (!stage) return { success: false, error: "Stage not found." };

    if (stage.is_system) {
      return { success: false, error: "System stages are required and cannot be deleted." };
    }

    // 1. Delete transitions referencing this stage from pipeline.transitions
    const targetStageNum = Number(stageId);
    const transToDelete = (pipeline.transitions ?? []).filter((t) => {
      const fromId = Number(typeof t.from_stage_id === "object" && t.from_stage_id !== null ? (t.from_stage_id as { id?: unknown }).id : t.from_stage_id);
      const toId = Number(typeof t.to_stage_id === "object" && t.to_stage_id !== null ? (t.to_stage_id as { id?: unknown }).id : t.to_stage_id);
      return fromId === targetStageNum || toId === targetStageNum;
    });
    for (const t of transToDelete) {
      await fetch(`${DIRECTUS_BASE}/items/vs_company_pipeline_transitions/${t.id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
    }

    // Direct query cleanup in Directus for any transitions involving this stage
    try {
      const directTransRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_company_pipeline_transitions?filter[_or][0][from_stage_id][_eq]=${stageId}&filter[_or][1][to_stage_id][_eq]=${stageId}&limit=-1`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (directTransRes.ok) {
        const directTransJson = (await directTransRes.json()) as { data?: { id: number }[] };
        for (const dt of directTransJson.data ?? []) {
          await fetch(`${DIRECTUS_BASE}/items/vs_company_pipeline_transitions/${dt.id}`, {
            method: "DELETE",
            headers: getHeaders(),
          });
        }
      }
    } catch (cleanErr) {
      console.warn("[pipeline.service] direct transition cleanup error:", cleanErr);
    }

    // 2. Delete the stage
    const res = await fetch(`${DIRECTUS_BASE}/items/vs_company_pipeline_stages/${stageId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });

    return { success: res.ok };
  } catch (error) {
    console.error("[pipeline.service] deletePipelineStage error:", error);
    return { success: false, error: "Failed to delete stage." };
  }
}

/**
 * Replaces transitions for a stage or entire pipeline
 */
export async function updateStageTransitions(
  pipelineId: number,
  fromStageId: number,
  targetStageIds: number[],
  companyId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const pipeline = await getPipelineWithDetails(pipelineId, companyId);
    if (!pipeline) return { success: false, error: "Pipeline not found." };

    const stages = pipeline.stages ?? [];
    const fromStage = stages.find((s) => s.id === fromStageId);
    if (!fromStage) return { success: false, error: "Source stage not found." };

    // Terminal integrity: Terminal stages cannot have outgoing transitions
    if (fromStage.is_terminal) {
      return { success: false, error: "Terminal stages cannot have outgoing transitions." };
    }

    // Sanitize targetStageIds: filter to only stages that currently exist in this pipeline and are not self or APPLIED
    const stageIdSet = new Set(stages.map((s) => Number(s.id)));
    const validTargetStageIds = (targetStageIds ?? [])
      .map(Number)
      .filter((toId) => {
        if (!stageIdSet.has(toId)) return false;
        if (toId === fromStageId) return false;
        const targetStage = stages.find((s) => Number(s.id) === toId);
        if (targetStage?.stage_type === "APPLIED") return false;
        return true;
      });

    // 1. Delete existing transitions where from_stage_id === fromStageId
    const existingForStage = (pipeline.transitions ?? []).filter((t) => {
      const fId = Number(typeof t.from_stage_id === "object" && t.from_stage_id !== null ? (t.from_stage_id as { id?: unknown }).id : t.from_stage_id);
      return fId === fromStageId;
    });
    for (const t of existingForStage) {
      await fetch(`${DIRECTUS_BASE}/items/vs_company_pipeline_transitions/${t.id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
    }

    // Also remove any orphaned transitions in this pipeline pointing to deleted/non-existent stages
    const orphanedTransitions = (pipeline.transitions ?? []).filter((t) => {
      const fId = Number(typeof t.from_stage_id === "object" && t.from_stage_id !== null ? (t.from_stage_id as { id?: unknown }).id : t.from_stage_id);
      const toId = Number(typeof t.to_stage_id === "object" && t.to_stage_id !== null ? (t.to_stage_id as { id?: unknown }).id : t.to_stage_id);
      return !stageIdSet.has(fId) || !stageIdSet.has(toId);
    });
    for (const ot of orphanedTransitions) {
      await fetch(`${DIRECTUS_BASE}/items/vs_company_pipeline_transitions/${ot.id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
    }

    // 2. Insert new transitions
    const nowPH = getPHTimeString();
    for (const toId of validTargetStageIds) {
      await fetch(`${DIRECTUS_BASE}/items/vs_company_pipeline_transitions`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          pipeline_id: pipelineId,
          from_stage_id: fromStageId,
          to_stage_id: toId,
          created_at: nowPH,
        }),
      });
    }

    return { success: true };
  } catch (error) {
    console.error("[pipeline.service] updateStageTransitions error:", error);
    return { success: false, error: "Failed to update transitions." };
  }
}

/**
 * Batch reorders stages for a pipeline
 */
export async function reorderPipelineStages(
  pipelineId: number,
  orderedStageIds: number[],
  companyId: number
): Promise<boolean> {
  try {
    const pipeline = await getPipelineWithDetails(pipelineId, companyId);
    if (!pipeline) return false;

    const stages = pipeline.stages ?? [];
    const stageMap = new Map(stages.map((s) => [s.id, s]));

    // Deduplicate requested stage IDs to guard against payload anomalies
    const deduplicatedIds = Array.from(new Set(orderedStageIds));

    // Pin entry stage: APPLIED must always remain at position 1
    const appliedStage = stages.find((s) => s.stage_type === "APPLIED" || (s.is_system && s.stage_order === 1));
    const filteredOrderedIds = deduplicatedIds.filter(
      (id) => (appliedStage ? id !== appliedStage.id : true)
    );
    const finalOrderedIds = appliedStage ? [appliedStage.id, ...filteredOrderedIds] : deduplicatedIds;

    const nowPH = getPHTimeString();
    let order = 1;
    for (const stageId of finalOrderedIds) {
      if (stageMap.has(stageId)) {
        await fetch(`${DIRECTUS_BASE}/items/vs_company_pipeline_stages/${stageId}`, {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({
            stage_order: order++,
            updated_at: nowPH,
          }),
        });
      }
    }

    return true;
  } catch (error) {
    console.error("[pipeline.service] reorderPipelineStages error:", error);
    return false;
  }
}

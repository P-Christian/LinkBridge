// src/modules/client/pipeline/components/assessment-task-editor/task-api.ts
// Wire helpers for the assessment task editor: error shaping + list fetch.

import type { CompanyAssessmentTaskRow } from "../../services/assessment-task.service";

export async function readErrorMessage(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as {
      error?: string;
      details?: string | string[];
    };
    if (typeof json.error === "string" && json.error) return json.error;
  } catch {
    // Fall through to the generic message below.
  }
  return `Request failed (${res.status}).`;
}

export async function fetchTaskList(
  listUrl: string,
  signal?: AbortSignal
): Promise<CompanyAssessmentTaskRow[]> {
  const res = await fetch(listUrl, { cache: "no-store", ...(signal ? { signal } : {}) });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const json = (await res.json()) as {
    tasks?: CompanyAssessmentTaskRow[];
  };
  const tasks = Array.isArray(json.tasks) ? json.tasks : [];
  return [...tasks].sort((a, b) => a.sort_order - b.sort_order);
}

// src/modules/vos-admin/role-matching/services/roleMatchingService.ts

import {
  JobCategory,
  StandardRole,
  SearchKeyword,
  RoleSkillMapping,
  DashboardMetrics,
  SimulationResult,
  MasterSkill,
  IntelligenceRequest,
  IntelligenceRequestStatus,
  IntelligenceRequestAction,
  ReviewRequestPayload,
  CandidateSimulationProfile,
} from "../types";

const BASE_URL = "/api/vos-admin/job-roles";

/**
 * The routes answer a failed read or write with the reason ("Could not create
 * the master skill \"Kubernetes\", so nothing was mapped."), but every caller
 * here threw its own hard-coded sentence, so the admin never saw which of the
 * taxonomy writes actually landed.
 */
async function fail(res: Response, fallback: string): Promise<never> {
  const errJson = await res.json().catch(() => null);
  const message = (errJson as { error?: unknown } | null)?.error;
  throw new Error(typeof message === "string" && message ? message : fallback);
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const res = await fetch(`${BASE_URL}`);
  if (!res.ok) return fail(res, "Failed to fetch metrics.");
  return res.json();
}

// Categories
export async function fetchJobCategories(signal?: AbortSignal): Promise<JobCategory[]> {
  const res = await fetch(`${BASE_URL}/categories`, { cache: "no-store", signal });
  if (!res.ok) return fail(res, "Failed to fetch job categories.");
  const data = await res.json();
  return data.categories ?? [];
}

export async function createJobCategory(payload: Partial<JobCategory>): Promise<JobCategory> {
  const res = await fetch(`${BASE_URL}/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return fail(res, "Failed to create job category.");
  return res.json();
}

export async function updateJobCategory(payload: Partial<JobCategory>): Promise<JobCategory> {
  const res = await fetch(`${BASE_URL}/categories`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return fail(res, "Failed to update job category.");
  return res.json();
}

export async function deleteJobCategory(categoryId: number): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/categories?id=${categoryId}`, { method: "DELETE" });
  if (!res.ok) return fail(res, "Failed to delete job category.");
  return true;
}

// Standard Roles
export async function fetchStandardRoles(categoryId?: number): Promise<StandardRole[]> {
  const url = categoryId ? `${BASE_URL}/roles?category_id=${categoryId}` : `${BASE_URL}/roles`;
  const res = await fetch(url);
  if (!res.ok) return fail(res, "Failed to fetch standard roles.");
  const data = await res.json();
  return data.roles ?? [];
}

export async function createStandardRole(payload: Partial<StandardRole>): Promise<StandardRole> {
  const res = await fetch(`${BASE_URL}/roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return fail(res, "Failed to create standard role.");
  return res.json();
}

export async function updateStandardRole(payload: Partial<StandardRole>): Promise<StandardRole> {
  const res = await fetch(`${BASE_URL}/roles`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return fail(res, "Failed to update standard role.");
  return res.json();
}

export async function deleteStandardRole(roleId: number): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/roles?id=${roleId}`, { method: "DELETE" });
  if (!res.ok) return fail(res, "Failed to delete standard role.");
  return true;
}

// Keywords & Synonyms
export async function fetchSearchKeywords(roleId?: number): Promise<SearchKeyword[]> {
  const url = roleId ? `${BASE_URL}/keywords?role_id=${roleId}` : `${BASE_URL}/keywords`;
  const res = await fetch(url);
  if (!res.ok) return fail(res, "Failed to fetch search keywords.");
  const data = await res.json();
  return data.keywords ?? [];
}

export async function createSearchKeyword(payload: Partial<SearchKeyword>): Promise<SearchKeyword> {
  const res = await fetch(`${BASE_URL}/keywords`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return fail(res, "Failed to create search keyword.");
  return res.json();
}

export async function updateSearchKeyword(payload: Partial<SearchKeyword>): Promise<SearchKeyword> {
  const res = await fetch(`${BASE_URL}/keywords`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return fail(res, "Failed to update search keyword.");
  return res.json();
}


export async function deleteSearchKeyword(aliasId: number): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/keywords?id=${aliasId}`, { method: "DELETE" });
  if (!res.ok) return fail(res, "Failed to delete search keyword.");
  return true;
}

// Role Skills
export interface RoleSkillRead {
  skills: RoleSkillMapping[];
  warnings: string[];
}

export async function fetchRoleSkills(roleId?: number): Promise<RoleSkillRead> {
  const url = roleId ? `${BASE_URL}/skills?role_id=${roleId}` : `${BASE_URL}/skills`;
  const res = await fetch(url);
  if (!res.ok) return fail(res, "Failed to fetch role skills.");
  const data = await res.json();
  return {
    skills: data.skills ?? [],
    warnings: Array.isArray(data.warnings) ? (data.warnings as string[]) : [],
  };
}

export async function createRoleSkill(payload: Partial<RoleSkillMapping>): Promise<RoleSkillMapping> {
  const res = await fetch(`${BASE_URL}/skills`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return fail(res, "Failed to add role skill.");
  return res.json();
}

export async function updateRoleSkill(payload: Partial<RoleSkillMapping>): Promise<RoleSkillMapping> {
  const res = await fetch(`${BASE_URL}/skills`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return fail(res, "Failed to update role skill.");
  return res.json();
}

export async function deleteRoleSkill(id: number): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/skills?id=${id}`, { method: "DELETE" });
  if (!res.ok) return fail(res, "Failed to delete role skill.");
  return true;
}

export async function fetchMasterSkills(): Promise<MasterSkill[]> {
  const res = await fetch(`${BASE_URL}/skills?master=true`);
  if (!res.ok) return fail(res, "Failed to fetch master skills.");
  const data = await res.json();
  return data.master_skills ?? [];
}

export async function runMatchSimulation(
  keyword: string,
  candidateId?: number,
  candidate?: CandidateSimulationProfile
): Promise<SimulationResult> {
  const res = await fetch(`${BASE_URL}/tester`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword, candidate_id: candidateId, candidate }),
  });
  if (!res.ok) return fail(res, "Failed to run match simulation.");
  return res.json();
}

// Intelligence Requests (Approval Queue)
export async function fetchIntelligenceRequests(
  status?: IntelligenceRequestStatus
): Promise<IntelligenceRequest[]> {
  const url = status
    ? `${BASE_URL}/suggestions?status=${status}`
    : `${BASE_URL}/suggestions`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch intelligence requests.");
  const data = await res.json();
  return data.requests ?? [];
}

export async function reviewIntelligenceRequest(
  suggestionId: number,
  action: IntelligenceRequestAction,
  payload?: Omit<ReviewRequestPayload, "action">
): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/suggestions`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suggestion_id: suggestionId, action, ...payload }),
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errJson.error || "Failed to review intelligence request.");
  }
  const json = await res.json().catch(() => ({}));
  return json.warnings ?? [];
}

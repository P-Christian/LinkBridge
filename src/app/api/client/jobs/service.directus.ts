// src/app/api/client/jobs/service.directus.ts
import { JobPosting, JobType, ExperienceLevel, JobStatus } from "@/modules/client/jobs/types";
import { directusItemsWhereIn } from "@/lib/server/directus";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

/**
 * `status` is interpolated into a Directus filter query string, so only these
 * enums reach the API; an unknown value returns no rows instead of widening the
 * query.
 */
const ALLOWED_JOB_STATUSES: readonly string[] = ["ACTIVE", "DRAFT", "CLOSED"];

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DirectusJobSkillMap {
  job_id: number;
  skill_id: number | { id: number; skill_name?: string };
  source?: "MANUAL" | "TEMPLATE" | "KEYWORD" | "HISTORY";
  confidence_score?: number | null;
}

interface DirectusJobBenefitMap {
  job_id: number;
  benefit_id: number | { id: number; benefit_name?: string };
}

interface DirectusScreeningQuestion {
  job_id: number;
  question_text: string;
}

interface DirectusJobPosting {
  job_id: number;
  company_id: number;
  created_by_user_id: number;
  job_title: string;
  job_type: string;
  job_location: string;
  job_department?: string | null;
  job_description?: string;
  category_id?: number | null;
  job_category?: string;
  work_arrangement?: string;
  number_of_openings?: number;
  job_responsibilities?: string;
  job_qualifications?: string;
  salary_type?: string;
  currency?: string;
  salary_min?: number | string | null;
  salary_max?: number | string | null;
  salary_negotiable?: boolean | number;
  experience_level?: string | null;
  education?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function getJobSkills(jobIds: number[]): Promise<Record<number, { id: number; skill_name: string; source?: string; confidence_score?: number | null }[]>> {
  const result: Record<number, { id: number; skill_name: string; source?: string; confidence_score?: number | null }[]> = {};
  jobIds.forEach(id => { result[id] = []; });
  if (jobIds.length === 0) return result;

  try {
    const maps = await directusItemsWhereIn<DirectusJobSkillMap>(
      "vs_job_skills_map",
      "job_id",
      jobIds,
      "job_id,skill_id,skill_id.*,source,confidence_score"
    );

    const unresolvedMaps: { job_id: number; skill_id: number; source: string; confidence_score: number | null }[] = [];
    const unresolvedIds: number[] = [];

    maps.forEach((m) => {
      const sourceVal = m.source || "MANUAL";
      const confidenceVal = m.confidence_score != null ? Number(m.confidence_score) : null;

      if (m.skill_id && typeof m.skill_id === "object") {
        result[m.job_id].push({
          id: m.skill_id.id,
          skill_name: m.skill_id.skill_name || "",
          source: sourceVal,
          confidence_score: confidenceVal
        });
      } else if (m.skill_id && typeof m.skill_id === "number") {
        unresolvedMaps.push({
          job_id: m.job_id,
          skill_id: m.skill_id,
          source: sourceVal,
          confidence_score: confidenceVal
        });
        unresolvedIds.push(m.skill_id);
      }
    });

    if (unresolvedIds.length > 0) {
      // Kept in its own guard so a failed master-table read only costs the names
      // of skills whose relation was never populated; the ones resolved from the
      // map rows above still render.
      try {
        const skills = await directusItemsWhereIn<{ id: number; skill_name?: string }>(
          "vs_master_skills",
          "id",
          unresolvedIds,
          "id,skill_name"
        );
        const skillsMap: Record<number, string> = {};
        skills.forEach((s) => {
          skillsMap[s.id] = s.skill_name || "";
        });
        unresolvedMaps.forEach(um => {
          result[um.job_id].push({
            id: um.skill_id,
            skill_name: skillsMap[um.skill_id] || "",
            source: um.source,
            confidence_score: um.confidence_score
          });
        });
      } catch (err) {
        console.error("Error resolving skill names:", err);
      }
    }
  } catch (err) {
    console.error("Error fetching job skills:", err);
  }
  return result;
}

async function getJobBenefits(jobIds: number[]): Promise<Record<number, string[]>> {
  const result: Record<number, string[]> = {};
  jobIds.forEach(id => { result[id] = []; });
  if (jobIds.length === 0) return result;

  try {
    const maps = await directusItemsWhereIn<DirectusJobBenefitMap>(
      "vs_job_benefits_map",
      "job_id",
      jobIds,
      "job_id,benefit_id,benefit_id.*"
    );

    const unresolvedMaps: { job_id: number; benefit_id: number }[] = [];
    const unresolvedIds: number[] = [];

    maps.forEach((m) => {
      if (m.benefit_id && typeof m.benefit_id === "object") {
        result[m.job_id].push(m.benefit_id.benefit_name || "");
      } else if (m.benefit_id && typeof m.benefit_id === "number") {
        unresolvedMaps.push({ job_id: m.job_id, benefit_id: m.benefit_id });
        unresolvedIds.push(m.benefit_id);
      }
    });

    if (unresolvedIds.length > 0) {
      try {
        const benefits = await directusItemsWhereIn<{ id: number; benefit_name?: string }>(
          "vs_master_benefits",
          "id",
          unresolvedIds,
          "id,benefit_name"
        );
        const benefitsMap: Record<number, string> = {};
        benefits.forEach((b) => {
          benefitsMap[b.id] = b.benefit_name || "";
        });
        unresolvedMaps.forEach(um => {
          const name = benefitsMap[um.benefit_id];
          if (name) result[um.job_id].push(name);
        });
      } catch (err) {
        console.error("Error resolving benefit names:", err);
      }
    }
  } catch (err) {
    console.error("Error fetching job benefits:", err);
  }
  return result;
}

async function getJobScreeningQuestions(jobIds: number[]): Promise<Record<number, string[]>> {
  const result: Record<number, string[]> = {};
  jobIds.forEach(id => { result[id] = []; });
  if (jobIds.length === 0) return result;

  try {
    const questions = await directusItemsWhereIn<DirectusScreeningQuestion>(
      "vs_job_screening_question",
      "job_id",
      jobIds,
      "job_id,question_text"
    );
    questions.forEach((q) => {
      result[q.job_id].push(q.question_text || "");
    });
  } catch (err) {
    console.error("Error fetching screening questions:", err);
  }
  return result;
}

// Candidates sitting on a terminal stage are done with the job, so they must not
// inflate the "needs attention" badge. Mirrors the isTerminal rule in ApplicantsModule.
const TERMINAL_APPLICATION_STATUSES = ["HIRED", "REJECTED", "WITHDRAWN"];

interface ApplicantCounts {
  total: number;
  active: number;
}

async function getApplicantsCounts(jobIds: number[]): Promise<Record<number, ApplicantCounts>> {
  const result: Record<number, ApplicantCounts> = {};
  jobIds.forEach(id => { result[id] = { total: 0, active: 0 }; });
  if (jobIds.length === 0) return result;

  try {
    const apps = await directusItemsWhereIn<{ job_id: number; application_status?: string | null }>(
      "vs_job_application",
      "job_id",
      jobIds,
      "job_id,application_status"
    );
    apps.forEach((app) => {
      const counts = result[app.job_id];
      if (!counts) return;
      counts.total++;
      const isTerminal = TERMINAL_APPLICATION_STATUSES.includes(
        String(app.application_status ?? "").toUpperCase()
      );
      if (!isTerminal) counts.active++;
    });
  } catch (err) {
    console.error("Error fetching applicants counts:", err);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA SERIALIZER HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function mapToFrontendJob(
  rawJob: DirectusJobPosting,
  skills: { id: number; skill_name: string; source?: string; confidence_score?: number | null }[],
  benefits: string[],
  screeningQuestions: string[],
  applicantCounts: ApplicantCounts = { total: 0, active: 0 }
): JobPosting {
  const descriptionObj = {
    text: rawJob.job_description || "",
    category_id: rawJob.category_id != null ? Number(rawJob.category_id) : null,
    job_category: rawJob.job_category || "",
    work_arrangement: rawJob.work_arrangement || "Remote",
    number_of_openings: String(rawJob.number_of_openings || 1),
    job_responsibilities: rawJob.job_responsibilities || ""
  };

  const requirementsObj = {
    text: rawJob.job_qualifications || "",
    job_qualifications: rawJob.job_qualifications || "",
    skills: skills || [],
    salary_type: rawJob.salary_type || "Salary Range",
    currency: rawJob.currency || "PHP",
    benefits: benefits || [],
    education: rawJob.education || "",
    screening_questions: screeningQuestions || []
  };

  return {
    job_id: rawJob.job_id,
    company_id: rawJob.company_id,
    job_title: rawJob.job_title,
    job_description: JSON.stringify(descriptionObj),
    job_requirements: JSON.stringify(requirementsObj),
    job_type: rawJob.job_type as JobType,
    job_location: rawJob.job_location,
    job_department: rawJob.job_department,
    salary_min: rawJob.salary_min != null ? Number(rawJob.salary_min) : null,
    salary_max: rawJob.salary_max != null ? Number(rawJob.salary_max) : null,
    salary_negotiable: !!rawJob.salary_negotiable,
    experience_level: rawJob.experience_level as ExperienceLevel | null,
    status: rawJob.status as JobStatus,
    applicants_count: applicantCounts.total,
    active_applicants_count: applicantCounts.active,
    created_at: rawJob.created_at,
    updated_at: rawJob.updated_at,
    // Flat fields fallback
    category_id: rawJob.category_id != null ? Number(rawJob.category_id) : null,
    job_category: rawJob.job_category,
    work_arrangement: rawJob.work_arrangement,
    number_of_openings: String(rawJob.number_of_openings || 1),
    job_responsibilities: rawJob.job_responsibilities,
    job_qualifications: rawJob.job_qualifications,
    skills,
    salary_type: rawJob.salary_type,
    currency: rawJob.currency,
    benefits,
    education: rawJob.education || undefined,
    screening_questions: screeningQuestions
  };
}

interface ParsedPayloadDescription {
  text?: string;
  category_id?: number | null;
  job_category?: string;
  work_arrangement?: string;
  number_of_openings?: string | number;
  job_responsibilities?: string;
}

interface ParsedPayloadRequirements {
  text?: string;
  job_qualifications?: string;
  skills?: { id: number; skill_name?: string; source?: string; confidence_score?: number | null }[];
  salary_type?: string;
  currency?: string;
  benefits?: string[];
  education?: string;
  screening_questions?: string[];
}

function parsePayload(payload: Record<string, unknown>) {
  const jobPayload: Partial<DirectusJobPosting> = {};
  
  if (payload.company_id !== undefined) jobPayload.company_id = Number(payload.company_id);
  if (payload.created_by_user_id !== undefined) jobPayload.created_by_user_id = Number(payload.created_by_user_id);
  if (payload.job_title !== undefined) jobPayload.job_title = String(payload.job_title);
  if (payload.job_type !== undefined) jobPayload.job_type = String(payload.job_type);
  if (payload.job_location !== undefined) jobPayload.job_location = String(payload.job_location);
  if (payload.job_department !== undefined) jobPayload.job_department = payload.job_department ? String(payload.job_department) : null;
  if (payload.salary_min !== undefined) jobPayload.salary_min = payload.salary_min != null ? Number(payload.salary_min) : null;
  if (payload.salary_max !== undefined) jobPayload.salary_max = payload.salary_max != null ? Number(payload.salary_max) : null;
  if (payload.salary_negotiable !== undefined) jobPayload.salary_negotiable = payload.salary_negotiable ? 1 : 0;
  if (payload.experience_level !== undefined) jobPayload.experience_level = payload.experience_level ? String(payload.experience_level) : null;
  if (payload.status !== undefined) jobPayload.status = String(payload.status);
  if (payload.created_at !== undefined) jobPayload.created_at = String(payload.created_at);
  if (payload.updated_at !== undefined) jobPayload.updated_at = String(payload.updated_at);
  if (payload.category_id !== undefined) jobPayload.category_id = payload.category_id != null ? Number(payload.category_id) : null;

  let skills: { id: number; skill_name?: string; source?: string; confidence_score?: number | null }[] | undefined = undefined;
  let benefits: string[] | undefined = undefined;
  let screeningQuestions: string[] | undefined = undefined;

  if (payload.job_description !== undefined) {
    let parsedDesc: ParsedPayloadDescription = {};
    if (typeof payload.job_description === "string") {
      try {
        parsedDesc = JSON.parse(payload.job_description);
      } catch {
        parsedDesc = { text: payload.job_description };
      }
    } else {
      parsedDesc = (payload.job_description as ParsedPayloadDescription) || {};
    }
    jobPayload.job_description = parsedDesc.text || "";
    jobPayload.category_id = parsedDesc.category_id != null ? Number(parsedDesc.category_id) : (jobPayload.category_id ?? null);
    jobPayload.job_category = parsedDesc.job_category || "";
    jobPayload.work_arrangement = parsedDesc.work_arrangement || "Remote";
    jobPayload.number_of_openings = Number(parsedDesc.number_of_openings || 1);
    jobPayload.job_responsibilities = parsedDesc.job_responsibilities || "";
  }

  if (payload.job_requirements !== undefined) {
    let parsedReqs: ParsedPayloadRequirements = {};
    if (typeof payload.job_requirements === "string") {
      try {
        parsedReqs = JSON.parse(payload.job_requirements);
      } catch {
        parsedReqs = { text: payload.job_requirements };
      }
    } else {
      parsedReqs = (payload.job_requirements as ParsedPayloadRequirements) || {};
    }
    jobPayload.job_qualifications = parsedReqs.job_qualifications || parsedReqs.text || "";
    jobPayload.salary_type = parsedReqs.salary_type || "Salary Range";
    jobPayload.currency = parsedReqs.currency || "PHP";
    jobPayload.education = parsedReqs.education || null;

    skills = parsedReqs.skills || [];
    benefits = parsedReqs.benefits || [];
    screeningQuestions = parsedReqs.screening_questions || [];
  }

  if (payload.skills !== undefined && Array.isArray(payload.skills)) {
    skills = payload.skills as { id: number; skill_name?: string; source?: string; confidence_score?: number | null }[];
  }
  if (payload.benefits !== undefined && Array.isArray(payload.benefits)) {
    benefits = payload.benefits as string[];
  }
  if (payload.screening_questions !== undefined && Array.isArray(payload.screening_questions)) {
    screeningQuestions = payload.screening_questions as string[];
  }

  return { jobPayload, skills, benefits, screeningQuestions };
}

/**
 * Replaces one section of a job's child rows (skills, benefits or screening
 * questions) and returns a warning per leg that failed.
 *
 * Every response used to be discarded, so a partial run still answered "Job
 * saved" with rows missing — and when the existing-rows read failed, the old
 * rows stayed and the new ones were appended on top, duplicating the set.
 */
async function replaceJobChildren(
  collection: string,
  idField: string,
  label: string,
  jobId: number,
  rows: Record<string, unknown>[]
): Promise<string[]> {
  // The job row is already committed by the time this runs, so a transport
  // error has to come back as a warning — throwing here would tell the
  // employer the save failed and invite them to create a second job.
  try {
    const listRes = await fetch(
      `${DIRECTUS_BASE}/items/${collection}?filter[job_id][_eq]=${jobId}&fields=${idField}&limit=-1`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (!listRes.ok) {
      return [`The job's saved ${label}s could not be read, so they were left unchanged.`];
    }

    const existing = ((await listRes.json()) as { data?: Record<string, number>[] }).data ?? [];
    for (const item of existing) {
      const del = await fetch(`${DIRECTUS_BASE}/items/${collection}/${item[idField]}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (!del.ok) {
        // Writing now would leave the old rows and the new ones coexisting.
        return [`An existing ${label} could not be removed, so the new ${label}s were not saved.`];
      }
    }

    const warnings: string[] = [];
    for (const row of rows) {
      const post = await fetch(`${DIRECTUS_BASE}/items/${collection}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ ...row, job_id: jobId }),
      });
      if (!post.ok) {
        const errText = await post.text().catch(() => "");
        console.error(`[jobs] Failed to save ${label} row for job #${jobId}:`, post.status, errText);
        warnings.push(`A ${label} could not be saved.`);
      }
    }

    return warnings;
  } catch (err) {
    console.error(`[jobs] ${label} sync failed:`, err);
    return [`The job's ${label}s could not be updated.`];
  }
}

/** Resolve a benefit name to its master row, creating it when it is absent. */
async function resolveBenefitId(name: string): Promise<number | null> {
  try {
    const findRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_master_benefits?filter[benefit_name][_eq]=${encodeURIComponent(name)}&fields=id&limit=1`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (!findRes.ok) return null;
    const found = ((await findRes.json()) as { data?: { id: number }[] }).data ?? [];
    if (found.length > 0) return found[0].id;

    const createRes = await fetch(`${DIRECTUS_BASE}/items/vs_master_benefits`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ benefit_name: name }),
    });
    if (!createRes.ok) return null;
    const created = (await createRes.json()) as { data?: { id?: number } };
    return created.data?.id ?? null;
  } catch (err) {
    console.error("[jobs] benefit lookup failed:", name, err);
    return null;
  }
}

/** Resolve a skill (by id and/or name) to its master row, creating it when absent. */
async function resolveSkillId(skill: {
  id?: number | null;
  skill_name?: string | null;
}): Promise<number | null> {
  const name = skill.skill_name?.trim();
  const rawId = skill.id != null ? Number(skill.id) : null;

  // 1. If an integer ID is provided, verify it exists in vs_master_skills (and isn't a mock timestamp)
  if (rawId && Number.isSafeInteger(rawId) && rawId < 1_000_000_000) {
    try {
      const checkRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_master_skills/${rawId}?fields=id`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (checkRes.ok) {
        const checkJson = (await checkRes.json()) as { data?: { id?: number } };
        if (checkJson.data?.id) return checkJson.data.id;
      }
    } catch {
      // Fall through to name lookup
    }
  }

  // 2. If name is available, look up by skill_name
  if (name) {
    try {
      const findRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_master_skills?filter[skill_name][_eq]=${encodeURIComponent(name)}&fields=id&limit=1`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (findRes.ok) {
        const found = ((await findRes.json()) as { data?: { id: number }[] }).data ?? [];
        if (found.length > 0 && found[0].id) return found[0].id;
      }

      // Fallback case-insensitive check
      const findIRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_master_skills?filter[skill_name][_icontains]=${encodeURIComponent(name)}&fields=id,skill_name&limit=5`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (findIRes.ok) {
        const foundList = ((await findIRes.json()) as { data?: { id: number; skill_name?: string }[] }).data ?? [];
        const exactCi = foundList.find(
          (s) => s.skill_name?.toLowerCase() === name.toLowerCase()
        );
        if (exactCi?.id) return exactCi.id;
      }

      // 3. If absent, create master skill row
      const createRes = await fetch(`${DIRECTUS_BASE}/items/vs_master_skills`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ skill_name: name, skill_category: "General" }),
      });
      if (createRes.ok) {
        const created = (await createRes.json()) as { data?: { id?: number } };
        if (created.data?.id) return created.data.id;
      }
    } catch (err) {
      console.error("[jobs] skill lookup/creation failed:", name, err);
      return null;
    }
  }

  return null;
}

async function syncJobRelations(
  jobId: number,
  skills: { id?: number; skill_name?: string; source?: string; confidence_score?: number | null }[],
  benefitNames: string[],
  questions: string[],
  syncSkills = true,
  syncBenefits = true,
  syncQuestions = true
): Promise<string[]> {
  const warnings: string[] = [];

  if (syncSkills) {
    const skillRows: Record<string, unknown>[] = [];
    for (const skill of skills) {
      if (!skill) continue;
      const resolvedId = await resolveSkillId(skill);
      if (resolvedId) {
        skillRows.push({
          skill_id: resolvedId,
          source: skill.source || "MANUAL",
          confidence_score:
            skill.confidence_score != null ? Number(skill.confidence_score) : null,
        });
      } else {
        warnings.push(`The skill "${skill.skill_name || skill.id}" could not be saved.`);
      }
    }
    warnings.push(
      ...(await replaceJobChildren(
        "vs_job_skills_map",
        "id",
        "skill",
        jobId,
        skillRows
      ))
    );
  }

  if (syncBenefits) {
    const benefitRows: Record<string, unknown>[] = [];
    for (const name of benefitNames) {
      if (!name) continue;
      const benefitId = await resolveBenefitId(name);
      if (benefitId) {
        benefitRows.push({ benefit_id: benefitId });
      } else {
        warnings.push(`The benefit "${name}" could not be saved.`);
      }
    }
    warnings.push(
      ...(await replaceJobChildren("vs_job_benefits_map", "id", "benefit", jobId, benefitRows))
    );
  }

  if (syncQuestions) {
    warnings.push(
      ...(await replaceJobChildren(
        "vs_job_screening_question",
        "question_id",
        "screening question",
        jobId,
        questions.filter(Boolean).map((question) => ({ question_text: question }))
      ))
    );
  }

  return warnings;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED SERVICE INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export async function getJobs(companyId: number, status: string | null): Promise<JobPosting[]> {
  if (status && status !== "ALL" && !ALLOWED_JOB_STATUSES.includes(status)) return [];

  let filterQuery = `filter[company_id][_eq]=${companyId}`;
  if (status && status !== "ALL") filterQuery += `&filter[status][_eq]=${encodeURIComponent(status)}`;

  // limit=-1 because the route renders this list as "every job you have posted";
  // Directus' implicit 100 would silently drop the oldest postings.
  const jobsUrl = `${DIRECTUS_BASE}/items/vs_job_posting?${filterQuery}&sort[]=-created_at&fields=*&limit=-1`;
  const res = await fetch(jobsUrl, { headers: getHeaders(), cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.message || "Failed to load jobs.");
  }
  const json = await res.json();
  const rawJobs: DirectusJobPosting[] = json.data ?? [];

  if (rawJobs.length === 0) return [];

  const jobIds = rawJobs.map((j) => j.job_id);
  const [skillsMap, benefitsMap, questionsMap, applicantsCountsMap] = await Promise.all([
    getJobSkills(jobIds),
    getJobBenefits(jobIds),
    getJobScreeningQuestions(jobIds),
    getApplicantsCounts(jobIds)
  ]);

  return rawJobs.map((j) => mapToFrontendJob(
    j,
    skillsMap[j.job_id] || [],
    benefitsMap[j.job_id] || [],
    questionsMap[j.job_id] || [],
    applicantsCountsMap[j.job_id] || { total: 0, active: 0 }
  ));
}

export async function getJob(id: string): Promise<JobPosting> {
  const res = await fetch(`${DIRECTUS_BASE}/items/vs_job_posting/${id}?fields=*`, {
    headers: getHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.message || "Job not found.");
  }
  const json = await res.json();
  const rawJob: DirectusJobPosting = json.data;

  if (!rawJob) throw new Error("Job not found.");

  const jobId = rawJob.job_id;
  const [skillsMap, benefitsMap, questionsMap, applicantsCountsMap] = await Promise.all([
    getJobSkills([jobId]),
    getJobBenefits([jobId]),
    getJobScreeningQuestions([jobId]),
    getApplicantsCounts([jobId])
  ]);

  return mapToFrontendJob(
    rawJob,
    skillsMap[jobId] || [],
    benefitsMap[jobId] || [],
    questionsMap[jobId] || [],
    applicantsCountsMap[jobId] || { total: 0, active: 0 }
  );
}

export async function createJob(
  payload: Record<string, unknown>
): Promise<{ job: JobPosting; warnings: string[] }> {
  const { jobPayload, skills, benefits, screeningQuestions } = parsePayload(payload);

  const res = await fetch(`${DIRECTUS_BASE}/items/vs_job_posting`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(jobPayload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.message || "Failed to create job posting.");
  }
  const json = await res.json();
  const createdRawJob: DirectusJobPosting = json.data;
  const newJobId = createdRawJob.job_id;

  const warnings = await syncJobRelations(
    newJobId,
    skills || [],
    benefits || [],
    screeningQuestions || []
  );

  // Fire-and-forget: learn skill → job title association for future recommendations
  learnSkillTemplates(jobPayload.job_title || "", skills || []).catch(() => null);

  return { job: await getJob(String(newJobId)), warnings };
}

export async function updateJob(
  id: string,
  payload: Record<string, unknown>
): Promise<{ job: JobPosting; warnings: string[] }> {
  const { jobPayload, skills, benefits, screeningQuestions } = parsePayload(payload);

  const res = await fetch(`${DIRECTUS_BASE}/items/vs_job_posting/${id}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(jobPayload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.message || "Failed to update job.");
  }

  const numericId = Number(id);

  const hasSkills = skills !== undefined;
  const hasBenefits = benefits !== undefined;
  const hasQuestions = screeningQuestions !== undefined;

  const warnings: string[] = [];
  if (hasSkills || hasBenefits || hasQuestions) {
    warnings.push(
      ...(await syncJobRelations(
        numericId,
        skills || [],
        benefits || [],
        screeningQuestions || [],
        hasSkills,
        hasBenefits,
        hasQuestions
      ))
    );
  }

  // Fire-and-forget: learn skill → job title association for future recommendations
  if (hasSkills && jobPayload.job_title) {
    learnSkillTemplates(jobPayload.job_title, skills || []).catch(() => null);
  }

  return { job: await getJob(id), warnings };
}

export async function deleteJob(id: string): Promise<void> {
  const res = await fetch(`${DIRECTUS_BASE}/items/vs_job_posting/${id}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ status: "CLOSED" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.message || "Failed to close job.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-LEARNING: Record job title → skill associations when jobs are saved
// ─────────────────────────────────────────────────────────────────────────────
async function learnSkillTemplates(
  jobTitle: string,
  skills: { id: number; source?: string; confidence_score?: number | null }[]
): Promise<void> {
  if (!jobTitle.trim() || skills.length === 0) return;

  // Only learn from skills that were manually chosen or came from templates
  // Ignore source=KEYWORD (lower confidence) to keep templates high-quality
  const learnableSkills = skills.filter(
    (s) => s.id > 0 && s.source !== "KEYWORD"
  );

  for (const skill of learnableSkills) {
    try {
      // Check if this (job_title, skill_id) pair already exists
      const checkUrl = `${DIRECTUS_BASE}/items/vs_job_title_skill_templates` +
        `?filter[job_title][_eq]=${encodeURIComponent(jobTitle.trim())}` +
        `&filter[skill_id][_eq]=${skill.id}&fields=id&limit=1`;

      const checkRes = await fetch(checkUrl, { headers: getHeaders(), cache: "no-store" });
      if (checkRes.ok) {
        const checkJson = await checkRes.json();
        if ((checkJson.data || []).length > 0) continue; // already exists, skip
      }

      // Determine weight from confidence score or default to 80 (learned)
      const weight = skill.confidence_score != null
        ? Math.min(Math.max(Math.round(Number(skill.confidence_score)), 10), 100)
        : 80;

      await fetch(`${DIRECTUS_BASE}/items/vs_job_title_skill_templates`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          job_title: jobTitle.trim(),
          skill_id: skill.id,
          weight,
          created_at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      // Non-critical — don't fail job save if learning fails
      console.error("[learnSkillTemplates] Error recording template:", err);
    }
  }
}

interface DirectusSkillTemplate {
  weight?: number;
  skill_id?: number | { id: number; skill_name?: string };
}

interface DirectusSkillKeywordMapping {
  weight?: number;
  keyword?: string;
  skill_id?: number | { id: number; skill_name?: string };
}

export async function recommendSkills(title: string, description: string): Promise<{ id: number; skill_name: string; source: "TEMPLATE" | "KEYWORD"; weight: number }[]> {
  const rawRecs: { id: number; source: "TEMPLATE" | "KEYWORD"; weight: number }[] = [];
  const seenIds = new Set<number>();

  // Helper: resolve skill_id which may be a plain number or an expanded M2O object
  const resolveSkillId = (skillId: unknown): number | null => {
    if (typeof skillId === "number") return skillId;
    if (skillId && typeof skillId === "object" && "id" in skillId) return (skillId as { id: number }).id;
    return null;
  };

  // 1. Job Title Templates — exact match first, then fuzzy word-by-word
  if (title.trim()) {
    try {
      const url = `${DIRECTUS_BASE}/items/vs_job_title_skill_templates?filter[job_title][_eq]=${encodeURIComponent(title.trim())}&fields=weight,skill_id,skill_id.id,skill_id.skill_name&sort[]=-weight&limit=20`;
      const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        const templates: DirectusSkillTemplate[] = json.data || [];
        templates.forEach((t) => {
          const skillId = resolveSkillId(t.skill_id);
          if (skillId && !seenIds.has(skillId)) {
            seenIds.add(skillId);
            rawRecs.push({ id: skillId, source: "TEMPLATE", weight: t.weight || 100 });
          }
        });
      }
    } catch (err) {
      console.error("Error fetching job title skill templates:", err);
    }

    // 1b. Fuzzy fallback: word-by-word _icontains if exact match yielded nothing
    if (rawRecs.length === 0) {
      try {
        const titleWords = title
          .toLowerCase()
          .split(/[\s,.\-();/:]+/)
          .map(w => w.trim())
          .filter(w => w.length >= 3);
        const uniqueWords = Array.from(new Set(titleWords));

        for (const word of uniqueWords.slice(0, 5)) {
          const url = `${DIRECTUS_BASE}/items/vs_job_title_skill_templates?filter[job_title][_icontains]=${encodeURIComponent(word)}&fields=weight,skill_id,skill_id.id,skill_id.skill_name&sort[]=-weight&limit=10`;
          const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
          if (res.ok) {
            const json = await res.json();
            const templates: DirectusSkillTemplate[] = json.data || [];
            templates.forEach((t) => {
              const skillId = resolveSkillId(t.skill_id);
              if (skillId && !seenIds.has(skillId)) {
                seenIds.add(skillId);
                rawRecs.push({ id: skillId, source: "TEMPLATE", weight: Math.round((t.weight || 100) * 0.85) });
              }
            });
          }
        }
      } catch (err) {
        console.error("Error fetching fuzzy job title templates:", err);
      }
    }
  }

  // 2. Keyword Mapping — runs against BOTH title and description
  const combinedText = `${title} ${description}`.trim();
  if (combinedText) {
    try {
      const keywords = combinedText
        .toLowerCase()
        .split(/[\s,.\-();/:\n\r]+/)
        .map(w => w.trim())
        .filter(w => w.length >= 2);
      const uniqueKeywords = Array.from(new Set(keywords));

      if (uniqueKeywords.length > 0) {
        let filterStr = "";
        uniqueKeywords.slice(0, 50).forEach((kw, idx) => {
          filterStr += `&filter[keyword][_in][${idx}]=${encodeURIComponent(kw)}`;
        });

        const url = `${DIRECTUS_BASE}/items/vs_skill_keyword_mapping?${filterStr}&fields=weight,keyword,skill_id,skill_id.id,skill_id.skill_name&sort[]=-weight`;
        const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          const mappings: DirectusSkillKeywordMapping[] = json.data || [];
          mappings.forEach((m) => {
            const skillId = resolveSkillId(m.skill_id);
            if (skillId && !seenIds.has(skillId)) {
              seenIds.add(skillId);
              rawRecs.push({ id: skillId, source: "KEYWORD", weight: m.weight || 50 });
            }
          });
        }
      }
    } catch (err) {
      console.error("Error fetching keyword mappings:", err);
    }
  }

  if (rawRecs.length === 0) return [];

  // 3. Batch resolve skill names from vs_master_skills
  const skillNameMap: Record<number, string> = {};
  try {
    const ids = rawRecs.map(r => r.id);
    const skillsRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_master_skills?filter[id][_in]=${ids.join(",")}&fields=id,skill_name&limit=${ids.length}`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (skillsRes.ok) {
      const skillsJson = await skillsRes.json();
      const skills: { id: number; skill_name?: string }[] = skillsJson.data || [];
      skills.forEach(s => { skillNameMap[s.id] = s.skill_name || ""; });
    }
  } catch (err) {
    console.error("Error batch-resolving skill names:", err);
  }

  const recommendations = rawRecs
    .map(r => ({
      id: r.id,
      skill_name: skillNameMap[r.id] || "",
      source: r.source,
      weight: r.weight,
    }))
    .filter(r => r.skill_name.length > 0);

  return recommendations.sort((a, b) => b.weight - a.weight);
}


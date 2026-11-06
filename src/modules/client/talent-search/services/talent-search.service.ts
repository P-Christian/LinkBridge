// src/modules/client/talent-search/services/talent-search.service.ts

import {
  MatchMode,
  matchSchool,
  type CandidateRetrievalResult,
  type MatchContext,
} from "../../../matching-engine";
import {
  readCertificationRows,
  readEducationRows,
  readJobPreferenceRows,
  readSavedApplicantRows,
  readSocialLinkRows,
  readUserRows,
  readUserSkillRows,
  readWorkRows,
  type JobPostingRow,
  type JobSkillRow,
  type TalentProfileRow,
} from "./talent-search.repo";
import {
  EXP_LEVEL_RANGE,
  OPTIONAL_SECTIONS,
  groupByUser,
  locationMatchVariants,
} from "./talent-search.helpers";
import type {
  CandidateRows,
  NormalizedCandidateItem,
  TalentResult,
} from "./talent-search.record";
import type { ResolvedTaxonomyContext } from "./talent-search.taxonomy";

/**
 * What one search has to admit to the recruiter as it runs: an optional section
 * that failed to load, a scan that hit its ceiling. A non-empty list also makes
 * the ranking uncacheable — see the write in the route.
 */
export type SearchAdmissions = {
  warnings: string[];
  degradedSections: string[];
};

/**
 * Attach reads + join for one set of profile rows. The cold path calls this with
 * the whole corpus, a warm page calls it with the page's rows, so both read the
 * same columns and degrade the same way.
 *
 * The id lists are read in batches. One `_in=` request carrying every profile id
 * exceeds what the transport accepts long before the corpus is exhausted, and
 * each of these reads used to answer `[]` when it failed — the candidates then
 * carried no skills, history or education, so the matcher scored real people at
 * zero.
 *
 * Tiered failure policy: the core reads stay fail-closed, because a recruiter
 * must never be told "no matching talent" when Directus is down. Only the two
 * optional attaches degrade, and they degrade loudly — the warning names the
 * section.
 */
export async function loadCandidates(
  rows: TalentProfileRow[],
  companyId: number | null,
  admissions: SearchAdmissions
): Promise<{ candidates: Map<number, CandidateRows>; savedUserIds: Set<number> }> {
  const userIds = rows.map((p) => p.user_id);

  const optionalRead = async <T>(collection: string, read: Promise<T[]>): Promise<T[]> => {
    try {
      return await read;
    } catch (err) {
      admissions.degradedSections.push(collection);
      admissions.warnings.push(
        `${OPTIONAL_SECTIONS[collection] ?? collection} could not be loaded right now, so they are missing from these results and do not count toward any match.`
      );
      console.error(`[talent-search] ⚠️  Optional read failed, continuing without it: ${collection}`, err);
      return [];
    }
  };

  const [users, skillRows, workRows, eduRows, certRows, socialRows, jobPrefRows, savedRows] = await Promise.all([
    readUserRows(userIds),
    readUserSkillRows(userIds),
    readWorkRows(userIds),
    readEducationRows(userIds),
    optionalRead("vs_certifications", readCertificationRows(userIds)),
    optionalRead("vs_user_social_links", readSocialLinkRows(userIds)),
    optionalRead("vs_job_preferences", readJobPreferenceRows(userIds)),
    readSavedApplicantRows(companyId),
  ]);

  const usersMap = new Map(users.map((u) => [u.user_id, u]));
  const jobPrefsMap = new Map(jobPrefRows.map((j) => [j.user_id, j]));

  const skillsByName = new Map<number, string[]>();
  for (const row of skillRows) {
    const name = row.skill_id?.skill_name;
    if (!name) continue;
    if (!skillsByName.has(row.user_id)) skillsByName.set(row.user_id, []);
    skillsByName.get(row.user_id)!.push(name);
  }

  const workMap = groupByUser(workRows);
  const eduMap = groupByUser(eduRows);
  const certsMap = groupByUser(certRows);
  const socialMap = groupByUser(socialRows);

  const savedUserIds = new Set<number>(savedRows.map((s) => s.applicant_user_id));

  const candidates = new Map<number, CandidateRows>();
  const seenIdentities = new Set<string>();

  for (const profile of rows) {
    const user = usersMap.get(profile.user_id);
    // A profile with no user row has no name or location to show or match on, so
    // it leaves the corpus entirely rather than scoring as blank.
    if (!user) continue;

    // Deduplicate duplicate profiles sharing identical name
    const fullName = `${(user.user_fname || "").trim().toLowerCase()} ${(user.user_lname || "").trim().toLowerCase()}`.trim();
    if (fullName) {
      if (seenIdentities.has(fullName)) continue;
      seenIdentities.add(fullName);
    }

    candidates.set(profile.user_id, {
      profile,
      user,
      skills: skillsByName.get(profile.user_id) ?? [],
      work: workMap.get(profile.user_id) ?? [],
      edu: eduMap.get(profile.user_id) ?? [],
      certs: certsMap.get(profile.user_id) ?? [],
      social: socialMap.get(profile.user_id) ?? [],
      jobPreference: jobPrefsMap.get(profile.user_id) ?? null,
    });
  }

  return { candidates, savedUserIds };
}

/** A posting's own level only ever contributes its band's lower bound. */
export function requiredExperienceYears(jobData: JobPostingRow | null): number {
  if (!jobData?.experience_level) return 0;
  return EXP_LEVEL_RANGE[jobData.experience_level.toUpperCase()]?.[0] ?? 0;
}

/** Which evaluator set a search runs against. */
export function resolveEngineMode(input: {
  jobId: number;
  keyword: string;
  skills: string[];
  hasSearchCriteria: boolean;
}): MatchMode {
  const { jobId, keyword, skills, hasSearchCriteria } = input;
  if (jobId && keyword) return MatchMode.HYBRID;
  if (jobId) return MatchMode.JOB_MATCH;
  if (skills.length > 0) return MatchMode.SKILL_MATCH;
  if (keyword) return MatchMode.ROLE_SIMILARITY;
  if (hasSearchCriteria) return MatchMode.HYBRID;
  return MatchMode.BROWSE;
}

/**
 * The inputs every evaluator reads. Warm and cold paths call this with the same
 * arguments, which is what lets a page turn reproduce the ranking it came from.
 */
export function buildMatchContext(input: {
  engineMode: MatchMode;
  jobId: number;
  jobSkills: string[];
  locations: string[];
  requiredExperience: number;
  effectiveSkills: string[];
  matchKeyword: string;
  taxonomy: ResolvedTaxonomyContext;
}): MatchContext {
  return {
    mode: input.engineMode,
    keyword: input.matchKeyword, // Use Gemini-resolved role keyword for scoring
    // A posting's skills are always read fresh; the skills a keyword expands to
    // come from the cached entry, because re-deriving them is the scan this skips.
    requestedSkills: input.jobId ? input.jobSkills : input.effectiveSkills,
    effectiveSkills: input.effectiveSkills,
    jobId: input.jobId || undefined,
    // The engine takes a single location; multi-tag matching happens in the
    // pre-scoring filters below.
    location: input.locations[0] ?? "",
    requiredExperience: input.requiredExperience,
    taxonomyContext: input.taxonomy,
  };
}

/** The `vs_job_skills_map` rows reduced to the names the matcher compares. */
export function toSkillNames(rows: JobSkillRow[]): string[] {
  return rows.map((r) => r.skill_id?.skill_name ?? "").filter(Boolean);
}

/**
 * Sidebar filters that narrow the pool BEFORE the six evaluators run, so no
 * candidate is scored and then discarded. The experience filter cannot join them
 * here: its input, relevant_experience_years, is produced by the engine. Skill
 * and location compare the normalized profile; school compares the raw education
 * rows, because the normalized entry keeps no school id.
 *
 * The per-filter counts are returned, not just logged: "8 of 35 survived" only
 * becomes debuggable when you can see which filter took the other 27.
 */
export function applyPreScoringFilters(input: {
  pool: CandidateRetrievalResult[];
  items: Map<number, NormalizedCandidateItem>;
  requestedSkills: string[];
  jobId: number;
  locations: string[];
  schoolFilters: string[];
  workSetupFilters?: string[];
}): { pool: CandidateRetrievalResult[]; removed: Record<string, number> } {
  let pool = input.pool;
  const removed: Record<string, number> = {};

  if (input.requestedSkills.length > 0 && !input.jobId) {
    const wanted = input.requestedSkills.map((s) => s.toLowerCase());
    const before = pool.length;
    pool = pool.filter(({ candidate }) =>
      candidate.skills.some((s) => wanted.includes(s.toLowerCase()))
    );
    removed.skills = before - pool.length;
  }

  if (input.locations.length > 0) {
    const variants = input.locations.map(locationMatchVariants);
    const before = pool.length;
    pool = pool.filter(
      ({ candidate }) =>
        variants.some((group) => group.some((v) => candidate.location.toLowerCase().includes(v)))
    );
    removed.location = before - pool.length;
  }

  if (input.schoolFilters.length > 0) {
    const before = pool.length;
    pool = pool.filter(({ candidate }) => {
      const edu = input.items.get(candidate.id)?.edu ?? [];
      return edu.some((e) =>
        input.schoolFilters.some(
          (school) =>
            String(e.school_id?.school_id ?? null) === school ||
            (e.school_id?.school_name && matchSchool(school, e.school_id.school_name).matched)
        )
      );
    });
    removed.school = before - pool.length;
  }

  if (input.workSetupFilters && input.workSetupFilters.length > 0) {
    const wanted = input.workSetupFilters.map((s) => s.toLowerCase().trim());
    const before = pool.length;
    pool = pool.filter(({ candidate }) => {
      const ws = input.items.get(candidate.id)?.jobPreference?.work_setup?.toLowerCase().trim();
      return ws ? wanted.includes(ws) : false;
    });
    removed.work_setup = before - pool.length;
  }

  return { pool, removed };
}

/** The one sidebar filter that can only run after scoring. Supports multi-select OR logic. */
export function applyExperienceFilter<T extends { relevant_experience_years: number }>(
  talents: T[],
  experienceLevels: string[] | string
): T[] {
  const levels = Array.isArray(experienceLevels)
    ? experienceLevels.filter(Boolean)
    : experienceLevels ? [experienceLevels] : [];
  if (levels.length === 0) return talents;

  return talents.filter((t) =>
    levels.some((level) => {
      const [minYears, maxYears] = EXP_LEVEL_RANGE[level.toUpperCase()] ?? [0, 99];
      return t.relevant_experience_years >= minYears && t.relevant_experience_years <= maxYears;
    })
  );
}

/**
 * Sort in place. Search mode orders by relevance; browse mode has no relevance to
 * order by, so it orders on profile completeness, then experience, then newest
 * profile id.
 *
 * NOTE: keyword-based post-filtering is intentionally absent. Layer 1 (retrieval)
 * and Layer 2 (scoring) already determine relevance; a second keyword gate here
 * would reject valid candidates whose title or summary differs from the query but
 * whose skills and experience are highly relevant.
 */
export function sortTalents(talents: TalentResult[], searchMode: "browse" | "search"): void {
  if (searchMode === "search") {
    talents.sort((a, b) => {
      const scoreA = a.ranking_score ?? a.match_score ?? 0;
      const scoreB = b.ranking_score ?? b.match_score ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const matchA = a.match_score ?? 0;
      const matchB = b.match_score ?? 0;
      if (matchB !== matchA) return matchB - matchA;
      if (b.relevant_experience_years !== a.relevant_experience_years) {
        return b.relevant_experience_years - a.relevant_experience_years;
      }
      return b.profile_id - a.profile_id;
    });
    return;
  }
  talents.sort((a, b) => {
    const aCompleteness = (a.skills.length > 0 ? 10 : 0) + a.experience_years;
    const bCompleteness = (b.skills.length > 0 ? 10 : 0) + b.experience_years;
    return bCompleteness - aCompleteness || b.profile_id - a.profile_id;
  });
}

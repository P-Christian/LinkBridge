// src/app/api/client/talent-search/route.ts

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";
import {
  runMatchingEngine,
  normalizeRawCandidate,
  MatchMode,
  MatchContext,
  MatchResult,
  cleanText,
  analyzeQuery,
  retrieveCandidatePool,
  isSchoolQuery,
  matchSchool,
} from "@/modules/matching-engine";
import { expandQueryWithGemini, shouldExpandWithGemini } from "@/lib/gemini/queryUnderstanding";
import { rerankCandidatesWithGemini } from "@/lib/gemini/aiReranker";
import { orderEducation } from "@/modules/client/education/order-education";
import { DirectusError, directusItems, directusItemsWhereIn } from "@/lib/server/directus";
import { toId } from "@/lib/server/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Row ceiling for every Directus read in this route. The profile corpus and the
 * taxonomy tables are scanned whole — truncating them would silently change
 * which candidates are findable — so this sits far above current data volume and
 * only exists to stop an unbounded `limit=-1` read from exhausting memory.
 */
const MAX_SCAN_ROWS = 10_000;

interface TalentProfileRow {
  profile_id: number;
  user_id: number;
  profile_headline?: string;
  professional_summary?: string;
}

/** Rows attached to every candidate profile by the bulk reads below. */
interface BulkUserRow {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_email: string;
  user_city?: string;
  user_province?: string;
  profile_image_url?: string;
}

interface BulkSkillRow {
  user_id: number;
  skill_id?: { skill_name?: string };
}

interface BulkWorkRow {
  user_id: number;
  company_name: string;
  job_title: string;
  job_description?: string;
  start_date?: string;
  end_date?: string;
  is_current_role?: boolean;
  employment_type?: string;
  location?: string;
}

interface BulkCertRow {
  user_id: number;
  certificate_name: string;
  issuing_organization?: string;
}

interface BulkSocialRow {
  user_id: number;
  platform_name: string;
  profile_url: string;
}

interface JobPostingRow {
  job_id: number;
  job_title?: string;
  job_location?: string;
  experience_level?: string;
}

/** Query text, AI payloads and candidate names stay out of production logs. */
function debugLog(...args: unknown[]): void {
  if (process.env.NODE_ENV !== "production") console.log(...args);
}

function maskEmail(email?: string | null): string {
  if (!email || typeof email !== "string") return "";
  const parts = email.trim().split("@");
  if (parts.length !== 2) return "***";
  const [name, domain] = parts;
  if (name.length <= 2) return `${name.slice(0, 1)}***@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}

/**
 * Skills, location and school filters arrive as repeated query params so a
 * single value may itself contain a comma.
 */
function getListParam(searchParams: URLSearchParams, name: string): string[] {
  return searchParams.getAll(name).map((value) => value.trim()).filter(Boolean);
}

/**
 * Paging params arrive as free text, and `Math.max(1, Number("abc"))` is NaN —
 * which sliced the result to nothing and returned `page: null`.
 */
function getIntParam(searchParams: URLSearchParams, name: string, fallback: number): number {
  const value = Number(searchParams.get(name));
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

/**
 * PSGC registers places as "City of Cebu", while profiles free-type "Cebu City".
 * Matching the bare name too keeps a clicked suggestion from returning nothing.
 */
function locationMatchVariants(location: string): string[] {
  const lowered = location.toLowerCase();
  const bare = lowered.replace(/^(?:city|municipality|province) of /, "");
  return bare === lowered ? [lowered] : [lowered, bare];
}

// ── DB-Backed Taxonomy Types ──────────────────────────────────────────────────

export interface RoleSkillMappingRow {
  role_id: { role_id: number };
  skill_id: { id: number; skill_name: string };
  importance_weight: number;
  is_required: number;
}

export interface RoleTaxonomyAliasRow {
  alias_id: number;
  alias_name: string;
  normalized_alias: string;
  match_weight: number;
  role_id: {
    role_id: number;
    role_name: string;
    category_id?: {
      category_id: number;
      category_code: string;
      category_name: string;
    };
  };
}

export interface ResolvedTaxonomyContext {
  keyword: string;
  resolved_role: string | null;
  resolved_role_id: number | null;
  category_code: string | null;
  category_name: string | null;
  matched_alias: string | null;
  match_weight: number;
  expanded_aliases: string[];
}

function resolveRoleTaxonomy(
  keyword: string,
  dbAliases: RoleTaxonomyAliasRow[]
): ResolvedTaxonomyContext {
  const original = (keyword || "").trim();
  const cleanedKey = cleanText(original);
  if (!cleanedKey) {
    return {
      keyword: "",
      resolved_role: null,
      resolved_role_id: null,
      category_code: null,
      category_name: null,
      matched_alias: null,
      match_weight: 1.0,
      expanded_aliases: [],
    };
  }

  // 1. Exact normalized alias match (using cleanText to strip hyphens, underscores, dots, etc.)
  const exactAlias = dbAliases.find((a) => cleanText(a.normalized_alias) === cleanedKey);
  // 2. Partial containment match — also compare space-stripped versions (e.g. "webdeveloper" vs "web developer")
  const cleanedKeyNoSpaces = cleanedKey.replace(/\s+/g, "");
  const partialAlias =
    exactAlias ??
    dbAliases.find((a) => {
      const norm = cleanText(a.normalized_alias);
      const normNoSpaces = norm.replace(/\s+/g, "");
      return (
        norm &&
        (cleanedKey.includes(norm) ||
          norm.includes(cleanedKey) ||
          cleanedKeyNoSpaces === normNoSpaces ||
          cleanedKeyNoSpaces.includes(normNoSpaces) ||
          normNoSpaces.includes(cleanedKeyNoSpaces))
      );
    });

  if (partialAlias && partialAlias.role_id) {
    const matched = partialAlias;
    const roleName = matched.role_id.role_name;
    const roleId = matched.role_id.role_id;
    const catCode = matched.role_id.category_id?.category_code ?? null;
    const catName = matched.role_id.category_id?.category_name ?? null;

    // Expand all aliases in the same role OR same category for broader matching
    const expanded = dbAliases
      .filter(
        (a) =>
          a.role_id?.role_id === roleId ||
          (catCode && a.role_id?.category_id?.category_code === catCode)
      )
      .map((a) => cleanText(a.normalized_alias));

    return {
      keyword,
      resolved_role: roleName,
      resolved_role_id: roleId,
      category_code: catCode,
      category_name: catName,
      matched_alias: matched.alias_name,
      match_weight: Number(matched.match_weight ?? 1.0),
      expanded_aliases: Array.from(new Set([cleanedKey, ...expanded])).filter(Boolean),
    };
  }

  // No DB match — no category inflation, just use the raw keyword
  return {
    keyword,
    resolved_role: null,
    resolved_role_id: null,
    category_code: null,
    category_name: null,
    matched_alias: keyword,
    match_weight: 1.0,
    expanded_aliases: [cleanedKey],
  };
}

export interface TalentEducationBulkRow {
  user_id: number;
  employee_education_id?: number;
  education_status?: string;
  school_id?: { school_name?: string; school_id?: number };
  school_course_id?: { course_name?: string };
  start_date?: string;
  end_date?: string;
}

export interface TalentResult {  user_id: number;
  profile_id: number;
  name: string;
  email: string;
  profile_image_url: string | null;
  headline: string | null;
  summary: string | null;
  location: string;
  skills: string[];
  experience_years: number;
  relevant_experience_years: number;
  work_experience: Array<{
    company_name: string;
    job_title: string;
    start_date: string | null;
    end_date: string | null;
    is_current_role: boolean;
    employment_type: string | null;
  }>;
  education: Array<{
    id: number | null;
    school_name: string | null;
    school_id: number | null;
    course_name: string | null;
    education_status: string | null;
    start_date: string | null;
    end_date: string | null;
  }>;
  education_count: number;
  availability_status: string;
  is_saved: boolean;
  match_score: number | null;
  ranking_score: number | null;
  match_result: MatchResult | null;
  match_breakdown: {
    mode: MatchMode;
    overallScore: number;
    rankingScore: number;
    confidence: MatchResult["confidence"];
    sections: MatchResult["compatibility"]["sections"];
    explanation: MatchResult["explanation"];
    evidence: MatchResult["evidence"];
  } | null;
  ai_explanation: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    const userId = Number(session.userId);
    const { isVerified, verification_status, companyId } = await checkCompanyVerificationStatus(userId);
    if (!isVerified || !companyId) {
      return NextResponse.json(
        {
          error: `Restricted: Your company verification status is ${verification_status}. Talent Search is only available to verified companies.`,
          verification_status,
          talents: [],
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const keyword = (searchParams.get("keyword") || "").trim();
    const requestedSkills = getListParam(searchParams, "skills");
    const locations = getListParam(searchParams, "location");
    const schoolFilters = getListParam(searchParams, "school_id");
    const experienceLevel = searchParams.get("experience_level") || "";
    const page = getIntParam(searchParams, "page", 1);
    const limit = Math.min(50, getIntParam(searchParams, "limit", 20));
    // Interpolated raw into the job reads below. A percent-encoded `&filter[…]`
    // inside this value came back from `searchParams` already decoded, so the
    // caller could append their own filter segments — including replacing the
    // `company_id` scope that keeps one employer out of another's postings.
    const requestedJobId = toId(searchParams.get("job_id")) ?? 0;

    // ────────────────────────────────────────────
    // 1. Fetch profiles + DB Taxonomy aliases in parallel
    // ────────────────────────────────────────────
    // Taxonomy rows feed the matcher. Reading them as `[]` when Directus was
    // unreachable made every role, alias and skill requirement vanish, and the
    // recruiter was told the market had no matching talent.
    const [profiles, dbAliases, dbRoleSkills] = await Promise.all([
      directusItems<TalentProfileRow>("vs_job_seeker_profile", {
        query:
          `filter[profile_visibility][_in]=Public,Recruiters Only` +
          `&fields=profile_id,user_id,profile_headline,professional_summary,profile_visibility` +
          `&limit=${MAX_SCAN_ROWS}`,
      }),
      directusItems<RoleTaxonomyAliasRow>("vs_role_title_alias", {
        query:
          `fields=alias_id,alias_name,normalized_alias,match_weight,role_id.role_id,role_id.role_name,role_id.category_id.category_id,role_id.category_id.category_code,role_id.category_id.category_name` +
          `&limit=${MAX_SCAN_ROWS}`,
      }),
      directusItems<RoleSkillMappingRow>("vs_role_skill_mapping", {
        query:
          `fields=role_id.role_id,skill_id.id,skill_id.skill_name,importance_weight,is_required` +
          `&limit=${MAX_SCAN_ROWS}`,
      }),
    ]);

    // The scan ceiling is a memory guard, not a licence to search a partial
    // index. If a read came back full, talent beyond the first MAX_SCAN_ROWS is
    // invisible to this run, and a "no matches" list would be read as the market
    // being empty rather than as a truncated scan.
    const scanTruncated =
      profiles.length >= MAX_SCAN_ROWS ||
      dbAliases.length >= MAX_SCAN_ROWS ||
      dbRoleSkills.length >= MAX_SCAN_ROWS;
    const scanWarnings = scanTruncated
      ? [
          `This search could only read the first ${MAX_SCAN_ROWS} profile and taxonomy rows, so results may be incomplete.`,
        ]
      : [];

    // ────────────────────────────────────────────
    // Gemini Layer A: Query Understanding (runs BEFORE taxonomy + retrieval)
    // Converts natural language to canonical role keyword for matching
    // e.g. "I need someone who builds websites with React" → "React Developer"
    // ────────────────────────────────────────────
    let geminiQueryIntent = null;
    let matchKeyword = keyword; // effective keyword used for matching (may be Gemini-resolved)

    const isSchoolSearch = isSchoolQuery(keyword);

    if (keyword && !isSchoolSearch && shouldExpandWithGemini(keyword)) {
      debugLog(`[talent-search] 🤖 Gemini Layer A: expanding query "${keyword}"`);
      geminiQueryIntent = await expandQueryWithGemini(keyword, { userId: userId ?? undefined, companyId: companyId ?? undefined }).catch(() => null);

      if (geminiQueryIntent) {
        debugLog(`[talent-search] 🤖 Gemini Layer A result:`, JSON.stringify(geminiQueryIntent));
      } else {
        console.log(`[talent-search] ⚠️  Gemini Layer A: failed or no API key — using raw keyword`);
      }

      // Use Gemini resolved role as effective search keyword when confidence is high enough
      if (
        geminiQueryIntent &&
        geminiQueryIntent.resolved_role &&
        (geminiQueryIntent.confidence === "HIGH" || geminiQueryIntent.confidence === "MEDIUM")
      ) {
        matchKeyword = geminiQueryIntent.resolved_role;
        debugLog(`[talent-search] 🤖 Gemini Layer A: matchKeyword resolved → "${matchKeyword}"`);
      } else {
        debugLog(`[talent-search] ℹ️  Gemini Layer A: keeping original keyword → "${matchKeyword}"`);
      }
    } else if (isSchoolSearch) {
      debugLog(`[talent-search] 🎓 School search detected — preserving original keyword "${keyword}"`);
    } else {
      debugLog(`[talent-search] ℹ️  Gemini Layer A: skipped (query too short or not applicable) — keyword="${keyword}"`);
    }

    // Resolve Role Taxonomy using the effective match keyword (Gemini-resolved or original)
    const taxonomyContext = resolveRoleTaxonomy(matchKeyword, dbAliases);
    debugLog(`[talent-search] 📚 Taxonomy resolved:`, JSON.stringify({
      matchKeyword,
      resolved_role: taxonomyContext.resolved_role,
      resolved_role_id: taxonomyContext.resolved_role_id,
      category_code: taxonomyContext.category_code,
      aliases_count: taxonomyContext.expanded_aliases.length,
    }));

    // Build role → skill name list map from DB
    const roleSkillsMap = new Map<number, string[]>();
    for (const row of dbRoleSkills) {
      const roleId = row.role_id?.role_id;
      const skillName = row.skill_id?.skill_name;
      if (!roleId || !skillName) continue;
      if (!roleSkillsMap.has(roleId)) roleSkillsMap.set(roleId, []);
      roleSkillsMap.get(roleId)!.push(skillName);
    }

    // Auto-expand requestedSkills with DB role skills when user specified no explicit skills
    // and the keyword resolved to a known DB role
    let effectiveRequestedSkills = requestedSkills;
    if (requestedSkills.length === 0 && taxonomyContext.resolved_role_id !== null) {
      const roleId = taxonomyContext.resolved_role_id;
      const roleSkills = roleSkillsMap.get(roleId) ?? [];
      if (roleSkills.length > 0) {
        effectiveRequestedSkills = roleSkills;
      }
    }

    // Merge Gemini inferred skills if query understanding enriched the query
    if (geminiQueryIntent && geminiQueryIntent.inferred_skills.length > 0 && requestedSkills.length === 0) {
      effectiveRequestedSkills = Array.from(
        new Set([...effectiveRequestedSkills, ...geminiQueryIntent.inferred_skills])
      );
    }
    console.log(`[talent-search] 🎯 Effective skills for scoring (${effectiveRequestedSkills.length}):`, effectiveRequestedSkills.slice(0, 10));

    if (profiles.length === 0) {
      return NextResponse.json({
        search_mode: "browse",
        search_context: taxonomyContext,
        talents: [],
        total: 0,
        page,
        limit,
        warnings: scanWarnings,
      });
    }

    const profileUserIds = profiles.map((p) => p.user_id);

    // ────────────────────────────────────────────
    // 2. Bulk fetch associated data in parallel
    //
    // The id lists are read in batches. One `_in=` request carrying every
    // profile id exceeds what the transport accepts long before the corpus is
    // exhausted, and each of these reads used to answer `[]` when it failed —
    // the candidates then carried no skills, history or education, so the
    // matcher scored real people at zero.
    // ────────────────────────────────────────────
    const [users, skillRows, workRows, eduRows, certRows, socialRows, savedRows, jobRows] =
      await Promise.all([
        // vs_user — basic info + location
        directusItemsWhereIn<BulkUserRow>("vs_user", "user_id", profileUserIds,
          "user_id,user_fname,user_lname,user_email,user_city,user_province,profile_image_url"),
        // vs_user_skills_map — skills
        directusItemsWhereIn<BulkSkillRow>("vs_user_skills_map", "user_id", profileUserIds,
          "user_id,skill_id.skill_name"),
        // vs_work_experience
        directusItemsWhereIn<BulkWorkRow>("vs_work_experience", "user_id", profileUserIds,
          "user_id,company_name,job_title,job_description,start_date,end_date,is_current_role,employment_type,location"),
        // vs_employee_education with school join
        directusItemsWhereIn<TalentEducationBulkRow>("vs_employee_education", "user_id", profileUserIds,
          "user_id,employee_education_id,education_status,school_id.school_name,school_id.school_id,school_course_id.course_name,start_date,end_date"),
        // vs_certifications
        directusItemsWhereIn<BulkCertRow>("vs_certifications", "user_id", profileUserIds,
          "user_id,certificate_name,issuing_organization"),
        // vs_user_social_links
        directusItemsWhereIn<BulkSocialRow>("vs_user_social_links", "user_id", profileUserIds,
          "user_id,platform_name,profile_url"),
        // vs_saved_applicant — which of these are already saved by this company
        companyId
          ? directusItems<{ applicant_user_id: number }>("vs_saved_applicant", {
              query: `filter[company_id][_eq]=${companyId}&fields=applicant_user_id&limit=${MAX_SCAN_ROWS}`,
            })
          : Promise.resolve([] as { applicant_user_id: number }[]),
        // vs_job_posting — if job_id provided for AI match (strictly scoped to caller's company)
        requestedJobId && companyId
          ? directusItems<JobPostingRow>("vs_job_posting", {
              query:
                `filter[job_id][_eq]=${requestedJobId}&filter[company_id][_eq]=${companyId}` +
                `&fields=job_id,job_title,job_location,experience_level&limit=1`,
            })
          : Promise.resolve([] as JobPostingRow[]),
      ]);

    const savedUserIds = new Set<number>();
    savedRows.forEach((s) => savedUserIds.add(s.applicant_user_id));

    // The job read above is scoped to the caller's company. An id belonging to
    // someone else (or a deleted posting) used to fall straight through to an
    // unscoped browse: the recruiter asked to match talent to one posting and
    // got the whole market ranked as if it had.
    const jobData = jobRows[0] ?? null;
    if (requestedJobId && !jobData) {
      return NextResponse.json(
        {
          error: "That job posting is no longer available on your account.",
          talents: [],
          total: 0,
          page,
          limit,
        },
        { status: 404 }
      );
    }

    // Job skills for match
    let jobSkills: string[] = [];
    if (requestedJobId) {
      const jobSkillRows = await directusItems<{ skill_id?: { skill_name?: string } }>(
        "vs_job_skills_map",
        {
          query: `filter[job_id][_eq]=${requestedJobId}&fields=skill_id.skill_name&limit=${MAX_SCAN_ROWS}`,
        }
      );
      jobSkills = jobSkillRows
        .map((r) => r.skill_id?.skill_name ?? "")
        .filter(Boolean);
    }

    // ────────────────────────────────────────────
    // 3. Build lookup maps
    // ────────────────────────────────────────────
    const usersMap = new Map(users.map((u) => [u.user_id, u]));

    const skillsMap = new Map<number, string[]>();
    for (const row of skillRows) {
      const name = row.skill_id?.skill_name;
      if (!name) continue;
      if (!skillsMap.has(row.user_id)) skillsMap.set(row.user_id, []);
      skillsMap.get(row.user_id)!.push(name);
    }

    const workMap = new Map<number, typeof workRows>();
    for (const row of workRows) {
      if (!workMap.has(row.user_id)) workMap.set(row.user_id, []);
      workMap.get(row.user_id)!.push(row);
    }

    const eduMap = new Map<number, typeof eduRows>();
    for (const row of eduRows) {
      if (!eduMap.has(row.user_id)) eduMap.set(row.user_id, []);
      eduMap.get(row.user_id)!.push(row);
    }

    const certsMap = new Map<number, typeof certRows>();
    for (const row of certRows) {
      if (!certsMap.has(row.user_id)) certsMap.set(row.user_id, []);
      certsMap.get(row.user_id)!.push(row);
    }

    const socialMap = new Map<number, typeof socialRows>();
    for (const row of socialRows) {
      if (!socialMap.has(row.user_id)) socialMap.set(row.user_id, []);
      socialMap.get(row.user_id)!.push(row);
    }

    // ────────────────────────────────────────────
    // 4. Build talent records + compute compatibility
    // ────────────────────────────────────────────
    const expLevelRange: Record<string, [number, number]> = {
      ENTRY: [0, 2],
      JUNIOR: [0, 3],
      MID: [2, 6],
      SENIOR: [5, 99],
      MANAGER: [7, 99],
      EXECUTIVE: [10, 99],
    };

    const requiredExpYears = jobData?.experience_level
      ? (expLevelRange[jobData.experience_level.toUpperCase()]?.[0] ?? 0)
      : 0;

    const hasSearchCriteria = Boolean(
      keyword ||
        requestedSkills.length > 0 ||
        requestedJobId ||
        locations.length > 0 ||
        experienceLevel ||
        schoolFilters.length > 0
    );

    const searchMode: "browse" | "search" = hasSearchCriteria ? "search" : "browse";

    let activeEngineMode: MatchMode = MatchMode.BROWSE;
    if (requestedJobId && keyword) {
      activeEngineMode = MatchMode.HYBRID;
    } else if (requestedJobId) {
      activeEngineMode = MatchMode.JOB_MATCH;
    } else if (requestedSkills.length > 0) {
      activeEngineMode = MatchMode.SKILL_MATCH;
    } else if (keyword) {
      activeEngineMode = MatchMode.ROLE_SIMILARITY;
    } else if (hasSearchCriteria) {
      activeEngineMode = MatchMode.HYBRID;
    }

    const matchContext: MatchContext = {
      mode: activeEngineMode,
      keyword: matchKeyword, // Use Gemini-resolved role keyword for scoring
      requestedSkills: requestedJobId ? jobSkills : effectiveRequestedSkills,
      jobId: requestedJobId || undefined,
      // The engine takes a single location; multi-tag matching happens in the
      // post-filter below.
      location: locations[0] ?? "",
      requiredExperience: requiredExpYears,
      taxonomyContext,
    };

    // Layer 1: High-Recall Candidate Retrieval Filter (Jaro-Winkler, Levenshtein, Token Overlap, Taxonomy Expansion)
    const normalizedProfilesMap = new Map();
    const normalizedProfilesList = [];

    for (const profile of profiles) {
      const user = usersMap.get(profile.user_id);
      if (!user) continue;

      const skills = skillsMap.get(profile.user_id) ?? [];
      const work = workMap.get(profile.user_id) ?? [];
      const edu = eduMap.get(profile.user_id) ?? [];
      const certs = certsMap.get(profile.user_id) ?? [];
      const social = socialMap.get(profile.user_id) ?? [];
      const location = [user.user_city, user.user_province].filter(Boolean).join(", ");

      const normalized = normalizeRawCandidate({
        user_id: profile.user_id,
        name: `${user.user_fname} ${user.user_lname}`.trim(),
        email: user.user_email,
        headline: profile.profile_headline,
        summary: profile.professional_summary,
        location,
        // Derived exactly as the talent-profile route does it — there is no
        // availability column. Left out, the normalizer defaulted everyone to
        // "AVAILABLE" and the card told the employer a working candidate was free.
        availability_status: work.some((w) => w.is_current_role) ? "EMPLOYED" : "AVAILABLE",
        skills,
        work_experience: work,
        education: edu.map((e) => ({
          id: e.employee_education_id ?? null,
          status: e.education_status ?? null,
          school_name: e.school_id?.school_name,
          course_name: e.school_course_id?.course_name,
          start_date: e.start_date,
          end_date: e.end_date,
        })),
        certifications: certs,
        social_links: social,
      });

      normalizedProfilesMap.set(profile.user_id, { profile, user, skills, work, edu, certs, social, normalized });
      normalizedProfilesList.push(normalized);
    }

    const analyzedQuery = analyzeQuery(matchKeyword);
    console.log(`[talent-search] 🔍 Layer 1: scanning ${normalizedProfilesList.length} total profiles...`);
    const retrievedPool = retrieveCandidatePool(normalizedProfilesList, analyzedQuery, taxonomyContext, 0, keyword, effectiveRequestedSkills);
    console.log(`[talent-search] ✅ Layer 1 pool: ${retrievedPool.length} candidates retained for Layer 2 scoring`);

    // Layer 2: Run Matching Engine & Final Scoring on Retrieved Candidate Pool
    const allTalents: TalentResult[] = (retrievedPool
      .map(({ candidate }) => {
        const item = normalizedProfilesMap.get(candidate.id);
        if (!item) return null;

        const { profile, user, work, edu, normalized } = item;

        // Run VOS Sync Matching Engine Pipeline
        const engineResult = runMatchingEngine(normalized, matchContext);

        // Find relevant exp years from experience evaluator trace/evidence
        const expEvidence = engineResult.evidence.find((e) => e.type === "EXPERIENCE");
        const relYearsMatch = expEvidence?.value.match(/([\d\.]+)\s*yrs/);
        const relYears = relYearsMatch ? Number(relYearsMatch[1]) : 0;

        // Match score percentage & badges are shown ONLY when matching against a specific Job Posting (requestedJobId)
        const showMatchScore = Boolean(requestedJobId);

        // Full education history in shared deterministic order; compact
        // surfaces preview from this array and expose the remainder via
        // education_count instead of dropping rows here.
        const orderedEdu = orderEducation<TalentEducationBulkRow>(edu, {
          status: (e) => e.education_status,
          endDate: (e) => e.end_date,
          startDate: (e) => e.start_date,
          id: (e) => e.employee_education_id,
        });

        return {
          user_id: profile.user_id,
          profile_id: profile.profile_id,
          name: normalized.name,
          email: maskEmail(normalized.email),
          profile_image_url: user.profile_image_url ?? null,
          headline: normalized.headline,
          summary: normalized.summary,
          location: normalized.location,
          skills: normalized.skills,
          experience_years: Number(
            (
              work.reduce((acc: number, w: { start_date?: string; end_date?: string; is_current_role?: boolean }) => {
                if (!w.start_date) return acc;
                const s = new Date(w.start_date);
                const e = w.is_current_role ? new Date() : w.end_date ? new Date(w.end_date) : new Date();
                return acc + Math.max((e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()), 0);
              }, 0) / 12
            ).toFixed(1)
          ),
          relevant_experience_years: relYears,
          work_experience: work.slice(0, 3).map((w: { company_name?: string; job_title?: string; start_date?: string; end_date?: string; is_current_role?: boolean; employment_type?: string }) => ({
            company_name: w.company_name,
            job_title: w.job_title,
            start_date: w.start_date ?? null,
            end_date: w.end_date ?? null,
            is_current_role: w.is_current_role ?? false,
            employment_type: w.employment_type ?? null,
          })),
          education: orderedEdu.map((e) => ({
            id: e.employee_education_id ?? null,
            school_name: e.school_id?.school_name ?? null,
            school_id: e.school_id?.school_id ?? null,
            course_name: e.school_course_id?.course_name ?? null,
            education_status: e.education_status ?? null,
            start_date: e.start_date ?? null,
            end_date: e.end_date ?? null,
          })),
          education_count: edu.length,
          availability_status: normalized.availability,
          is_saved: savedUserIds.has(profile.user_id),
          match_score: showMatchScore ? engineResult.compatibility.score : null,
          ranking_score: searchMode === "search" ? engineResult.ranking.score : null,
          match_result: showMatchScore ? engineResult : null,
          match_breakdown: showMatchScore ? {
            mode: engineResult.mode,
            overallScore: engineResult.compatibility.score,
            rankingScore: engineResult.ranking.score,
            confidence: engineResult.confidence,
            sections: engineResult.compatibility.sections,
            explanation: engineResult.explanation,
            evidence: engineResult.evidence,
          } : null,
          ai_explanation: null as string | null,
        };
      })
      .filter((t): t is TalentResult => t !== null)) as TalentResult[];

    console.log(`[talent-search] ✅ Layer 2 scored: ${allTalents.length} candidates after engine scoring`);
    for (const t of allTalents) {
      console.log(
        `  🎯 [Layer 2 Candidate] ID #${t.user_id} ${t.name} | Ranking Score: ${t.ranking_score ?? "N/A"} | Match Score: ${t.match_score ?? "N/A"} | Relevant Exp: ${t.relevant_experience_years} yrs`
      );
    }

    // ────────────────────────────────────────────
    // 5. Explicit sidebar filters (skills, location, experience, school)
    // NOTE: Keyword-based post-filtering is intentionally removed.
    //       Layer 1 (retrieval) and Layer 2 (scoring) already determine relevance.
    //       A second keyword gate here would reject valid candidates whose title/summary
    //       differs from the query but whose skills and experience are highly relevant.
    // ────────────────────────────────────────────
    let filtered = allTalents;
    console.log(`[talent-search] ✅ Layer 2 candidates entering ranking: ${filtered.length}`);

    // Filter by user-specified skills only (not expanded DB role skills — those are for scoring only)
    if (requestedSkills.length > 0 && !requestedJobId) {
      console.log(`[talent-search] 🏷️ Filtering by requested skills: [${requestedSkills.join(", ")}]`);
    }
    if (requestedSkills.length > 0 && !requestedJobId) {
      filtered = filtered.filter((t) => {
        const lowerSkills = t.skills.map((s: string) => s.toLowerCase());
        return requestedSkills.some((rs) => lowerSkills.includes(rs.toLowerCase()));
      });
    }

    if (locations.length > 0) {
      const variants = locations.map(locationMatchVariants);
      filtered = filtered.filter((t) => {
        const talentLocation = t.location.toLowerCase();
        return variants.some((group) => group.some((v) => talentLocation.includes(v)));
      });
    }

    if (experienceLevel) {
      const [minYears, maxYears] = expLevelRange[experienceLevel.toUpperCase()] ?? [0, 99];
      filtered = filtered.filter(
        (t) => t.relevant_experience_years >= minYears && t.relevant_experience_years <= maxYears
      );
    }

    if (schoolFilters.length > 0) {
      filtered = filtered.filter((t) =>
        t.education.some((e) =>
          schoolFilters.some(
            (school) =>
              String(e.school_id) === school ||
              (e.school_name && matchSchool(school, e.school_name).matched)
          )
        )
      );
    }

    // Sort mode logic
    if (searchMode === "search") {
      filtered.sort((a, b) => (b.ranking_score ?? b.match_score ?? 0) - (a.ranking_score ?? a.match_score ?? 0));
    } else {
      // Browse mode sorting: profile completeness + experience + profile_id desc
      filtered.sort((a, b) => {
        const aCompleteness = (a.skills.length > 0 ? 10 : 0) + a.experience_years;
        const bCompleteness = (b.skills.length > 0 ? 10 : 0) + b.experience_years;
        return bCompleteness - aCompleteness || b.profile_id - a.profile_id;
      });
    }

    const total = filtered.length;
    console.log(`[talent-search] 🏁 Final ranked candidates (${total} total, page ${page}, limit ${limit}):`);
    filtered.slice(0, 5).forEach((t, i) => {
      console.log(`  #${i + 1} ID #${t.user_id} ${t.name} (Headline: "${t.headline || 'None'}", Ranking: ${t.ranking_score ?? t.match_score ?? 0})`);
    });

    // ────────────────────────────────────────────
    // 6. Gemini Layer B: AI Reranking (job match mode only, top 50)
    // Note: Layer B semantic reranking requires both an active job posting (requestedJobId)
    // and a search query prompt (keyword) to semantically measure relevance against the prompt.
    // When no search keyword is provided, candidates remain ordered deterministically by Layer 2 ranking_score.
    // ────────────────────────────────────────────
    let aiReranked = false;
    if (requestedJobId && keyword && filtered.length > 1) {
      console.log(`[talent-search] 🤖 Gemini Layer B: reranking top ${Math.min(filtered.length, 50)} candidates for job ${requestedJobId}...`);
      const rerankInput = filtered.slice(0, 50).map((t) => ({
        id: t.user_id,
        title: t.headline,
        skills: t.skills,
        summary: t.summary,
      }));
      const { ranked_ids, used_ai } = await rerankCandidatesWithGemini(keyword, rerankInput, { userId: userId ?? undefined, companyId: companyId ?? undefined });
      if (used_ai && ranked_ids.length > 0) {
        aiReranked = true;
        const rankMap = new Map(ranked_ids.map((id, idx) => [id, idx]));
        const top50Reranked = filtered
          .slice(0, 50)
          .sort((a, b) => (rankMap.get(a.user_id) ?? 99) - (rankMap.get(b.user_id) ?? 99));
        filtered = [...top50Reranked, ...filtered.slice(50)];
        console.log(`[talent-search] 🤖 Gemini Layer B: ✅ reranked ${ranked_ids.length} candidates`);
      } else {
        console.log(`[talent-search] ⚠️  Gemini Layer B: rerank failed or skipped — keeping Layer 2 order`);
      }
    }

    const paginated = filtered.slice((page - 1) * limit, page * limit);

    // ────────────────────────────────────────────
    // 7. Gemini Layer C: Match Explanations (Lazy execution on drawer open)
    // Note: Layer C match explanations are handled lazily via POST /api/client/talent-search/explain
    // when a candidate profile drawer is opened by the recruiter, preventing unnecessary Gemini API calls on page turns.
    // ────────────────────────────────────────────

    return NextResponse.json({
      search_mode: searchMode,
      search_context: searchMode === "search" ? taxonomyContext : null,
      talents: paginated,
      total,
      page,
      limit,
      ai_reranked: aiReranked,
      warnings: scanWarnings,
    });
  } catch (err: unknown) {
    console.error("[talent-search GET] Error:", err);
    // An unreachable Directus is not "the market has no matching talent". The
    // reads above reject on failure so this is the only place an outage can
    // surface, and it must not be shaped like a successful empty search.
    if (err instanceof DirectusError) {
      return NextResponse.json(
        { error: "Talent search is unavailable right now. Please try again.", talents: [], total: 0 },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: "Failed to search talent profiles." }, { status: 500 });
  }
}

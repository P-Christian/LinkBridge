// src/app/api/client/talent-search/route.ts

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";
import { analyzeQuery, retrieveCandidatePool, getOrLoadTaxonomy, type NormalizedProfile } from "@/modules/matching-engine";
import { DirectusError } from "@/lib/server/directus";
import { toId } from "@/lib/server/route";
import {
  buildBaseSearchKey,
  buildRankingKey,
  getBaseScoredPool,
  // getCachedRerank,
  getRankedSearch,
  setBaseScoredPool,
  // setCachedRerank,
  setRankedSearch,
} from "./search-ranking-cache";
import {
  MAX_SCAN_ROWS,
  readCompanyJobPosting,
  readJobSkillRows,
  readMostRecentlyWrittenProfile,
  readProfilesByUserIds,
  scanSearchableProfiles,
  type JobPostingRow,
} from "@/modules/client/talent-search/services/talent-search.repo";
import {
  debugLog,
  getIntParam,
  getListParam,
  layerLog,
  newestWriteMs,
} from "@/modules/client/talent-search/services/talent-search.helpers";
import {
  TALENT_SORTS,
  type TalentSort,
} from "@/modules/client/talent-search/types";
import {
  buildRoleSkillsMap,
  expandEffectiveSkills,
  resolveRoleTaxonomy,
  type ResolvedTaxonomyContext,
} from "@/modules/client/talent-search/services/talent-search.taxonomy";
import {
  buildTalentRecord,
  normalizeCandidate,
  type CandidateRows,
  type NormalizedCandidateItem,
  type RecordContext,
  type TalentResult,
} from "@/modules/client/talent-search/services/talent-search.record";
import {
  rerankTalents,
  understandQuery,
  type TalentRerank,
} from "@/modules/client/talent-search/services/talent-search.ai";
import {
  buildMatchContext,
  filterTalentResults,
  loadCandidates,
  requiredExperienceYears,
  resolveEngineMode,
  sortTalents,
  toSkillNames,
  type SearchAdmissions,
} from "@/modules/client/talent-search/services/talent-search.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Talent search: read the corpus, retrieve, score, filter, rank, page.
 *
 * This handler owns only the request, the cache branch and the trace. Every read
 * lives in `talent-search.repo.ts`, every pipeline step in the sibling service
 * modules, so a warm page and the cold search that ranked it go through the same
 * functions with the same arguments.
 */
export async function GET(req: NextRequest) {
  try {
    // One structured line per search says where the time went and how many
    // candidates survived each hand-off. Durations and counts only: query text,
    // candidate names and profile data never enter this line.
    const startedAt = Date.now();
    const stageMs: Record<string, number> = {};
    const counts: Record<string, number | string | boolean> = {};
    let lastMark = startedAt;
    const mark = (stage: string): void => {
      const now = Date.now();
      stageMs[stage] = (stageMs[stage] ?? 0) + (now - lastMark);
      lastMark = now;
    };
    const emitTrace = (): void => {
      console.log(
        JSON.stringify({
          event: "talent_search",
          total_ms: Date.now() - startedAt,
          stage_ms: stageMs,
          ...counts,
        })
      );
    };

    const session = await authenticateRequest(req);
    if (!session) {
      layerLog("AUTH", "❌ no session — 401");
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      layerLog("AUTH", `❌ session is not a client/employer account — 403`, { userId: session.userId });
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    const userId = Number(session.userId);
    const { isVerified, verification_status, companyId, readFailed } = await checkCompanyVerificationStatus(userId);
    if (!isVerified || !companyId) {
      layerLog("AUTH", `❌ company is not verified — search refused`, { userId, verification_status, readFailed });
      return NextResponse.json(
        {
          error: `Restricted: Your company verification status is ${verification_status}. Talent Search is only available to verified companies.`,
          verification_status,
          talents: [],
        },
        { status: 403 }
      );
    }
    mark("auth");

    const { searchParams } = new URL(req.url);
    const keyword = (searchParams.get("keyword") || "").trim();
    const requestedSkills = getListParam(searchParams, "skills");
    const locations = getListParam(searchParams, "location");
    const schoolFilters = getListParam(searchParams, "school_id");
    const experienceLevels = getListParam(searchParams, "experience_level");
    const workSetupFilters = getListParam(searchParams, "work_setup");
    const page = getIntParam(searchParams, "page", 1);
    const limit = Math.min(50, Math.max(1, getIntParam(searchParams, "limit", 20)));
    // An unknown value falls back to the engine's own policy rather than 400ing,
    // because the order is a display choice and a stale bookmark must still work.
    const requestedSortParam = (searchParams.get("sort") || "").trim() as TalentSort;
    const requestedSort: TalentSort = TALENT_SORTS.includes(requestedSortParam)
      ? requestedSortParam
      : "relevance";
    // Interpolated raw into the job reads below. A percent-encoded `&filter[…]`
    // inside this value came back from `searchParams` already decoded, so the
    // caller could append their own filter segments — including replacing the
    // `company_id` scope that keeps one employer out of another's postings.
    const requestedJobId = toId(searchParams.get("job_id")) ?? 0;
    counts.job_match = requestedJobId > 0;

    layerLog("REQUEST", keyword ? `keyword="${keyword}"` : "no keyword", {
      skills: requestedSkills.length,
      locations: locations.length,
      schools: schoolFilters.length,
      experience: experienceLevels.join(",") || null,
      workSetup: workSetupFilters.join(",") || null,
      job: requestedJobId || null,
      page,
      limit,
      sort: requestedSort,
    });

    // Anything this run has to admit to the recruiter: a truncated scan, an
    // optional section that failed to load. A non-empty list also makes the
    // ranking uncacheable — see the write at the end of the handler.
    const admissions: SearchAdmissions = { warnings: [], degradedSections: [] };
    const { warnings, degradedSections } = admissions;

    // ────────────────────────────────────────────
    // 1. The job posting, and whether it is the caller's
    //
    // This read is scoped to the caller's company. An id belonging to someone
    // else (or a deleted posting) used to fall straight through to an unscoped
    // browse: the recruiter asked to match talent to one posting and got the
    // whole market ranked as if it had. It runs before anything else, because
    // the ranked-id cache below is keyed on this job id and `vs_job_skills_map`
    // is filtered by job id alone — which is only safe once this has proved
    // ownership.
    // ────────────────────────────────────────────
    let jobData: JobPostingRow | null = null;
    let jobSkills: string[] = [];
    if (requestedJobId) {
      const jobRows = await readCompanyJobPosting(requestedJobId, companyId);
      jobData = jobRows[0] ?? null;
      if (!jobData) {
        layerLog("JOB", `❌ job ${requestedJobId} is not a posting of company ${companyId} — 404, nothing was searched or cached`);
        mark("job");
        emitTrace();
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

      jobSkills = toSkillNames(await readJobSkillRows(requestedJobId));
      layerLog("JOB", `ownership proven, matching against posting "${jobData.job_title}"`, {
        jobId: jobData.job_id,
        jobSkills: jobSkills.length,
        postingLevel: jobData.experience_level ?? null,
      });
    } else {
      layerLog("JOB", "no job_id — this is not a posting match, so no match percentage is shown");
    }
    mark("job");
    counts.job_skills = jobSkills.length;

    // ────────────────────────────────────────────
    // 2. What both paths must agree on
    //
    // A warm page and the search that ranked it must produce identical records,
    // so everything the scoring depends on except the candidate's own rows is
    // resolved here, before the cache branches.
    // ────────────────────────────────────────────
    const hasSearchCriteria = Boolean(
      keyword ||
        requestedSkills.length > 0 ||
        requestedJobId ||
        locations.length > 0 ||
        experienceLevels.length > 0 ||
        workSetupFilters.length > 0 ||
        schoolFilters.length > 0
    );

    const searchMode: "browse" | "search" = hasSearchCriteria ? "search" : "browse";
    const engineMode = resolveEngineMode({
      jobId: requestedJobId,
      keyword,
      skills: requestedSkills,
      hasSearchCriteria,
    });
    const requiredExperience = requiredExperienceYears(jobData);

    const matchContextFor = (
      effectiveSkills: string[],
      matchKw: string,
      taxonomy: ResolvedTaxonomyContext
    ) =>
      buildMatchContext({
        engineMode,
        jobId: requestedJobId,
        jobSkills,
        locations,
        requiredExperience,
        effectiveSkills,
        matchKeyword: matchKw,
        taxonomy,
      });

    layerLog("MODE", `engine ${engineMode}, list ordered as ${searchMode}`, {
      requiredExperience,
      engineLocation: locations[0] ?? null,
      skillsTakenFromPosting: requestedJobId ? jobSkills.length : 0,
    });

    // ────────────────────────────────────────────
    // 3. Gemini Layer A: query understanding & Ranked-id cache
    //
    // Query understanding runs before the cache and taxonomy so that near-identical
    // queries (e.g. "web dev", "web development", "web developer") resolve to
    // the same canonical role keyword and share the exact same ranking cache entry.
    // ────────────────────────────────────────────
    const query = await understandQuery({ keyword, userId, companyId });
    mark("layer_a");
    counts.layer_a = query.outcome;
    counts.layer_a_rewrote = query.rewrote;
    layerLog("LAYER_A", query.intent ? `AI intent ${query.outcome}` : "no AI intent — raw keyword used", {
      raw: `"${keyword}"`,
      matched: `"${query.matchKeyword}"`,
      confidence: query.intent?.confidence ?? null,
      inferredSkills: query.intent?.inferred_skills.length ?? 0,
    });

    const canonicalKeyword = (query.matchKeyword || keyword).trim().toLowerCase();
    const rankingKey = buildRankingKey({
      jobId: requestedJobId,
      keyword: canonicalKeyword,
      skills: requestedSkills,
      locations,
      schools: schoolFilters,
      experienceLevels,
      workSetups: workSetupFilters,
      sort: requestedSort,
    });

    let ranked = getRankedSearch(rankingKey);
    if (ranked) {
      // Coarse invalidation on top of the entry's max age: the newest write to
      // any profile row. It catches a freelancer editing their own profile, and
      // nothing else — the attached tables carry no timestamp — so the max age
      // stays the real bound.
      const rankedAt = ranked.newestProfileWrite;
      const [newest] = await readMostRecentlyWrittenProfile();
      const newestWrite = newest?.updated_at ? Date.parse(newest.updated_at) : NaN;
      if (!Number.isNaN(newestWrite) && rankedAt !== null && newestWrite > rankedAt) {
        layerLog("CACHE", "❌ discarded: a profile row was written after this ranking was made", {
          coveredWritesUpTo: rankedAt === null ? null : new Date(rankedAt).toISOString(),
          newestWriteNow: new Date(newestWrite).toISOString(),
        });
        ranked = null;
      } else {
        layerLog("CACHE", `hit — reusing the order this same search produced`, {
          ageMs: Date.now() - ranked.savedAt,
          ranked: ranked.ids.length,
          total: ranked.total,
          mode: ranked.mode,
          aiReranked: ranked.aiReranked,
          matchKeyword: ranked.matchKeyword,
          role: ranked.taxonomy.resolved_role,
          effectiveSkills: ranked.effectiveSkills.length,
        });
      }
    } else {
      layerLog("CACHE", "miss — this search scans, retrieves, scores and ranks from scratch");
    }
    mark("cache");
    counts.cache = ranked ? "hit" : "miss";

    if (ranked) {
      const start = (page - 1) * limit;
      const pageIds = ranked.ids.slice(start, start + limit);
      layerLog("SLICE", `page ${page} is positions ${start + 1}-${start + pageIds.length} of the stored order`, {
        pageIds: pageIds.length,
        of: ranked.ids.length,
      });

      // Re-read visibility: a candidate who went private since the ranking was
      // written must not appear on a warm page.
      const pageRows = await readProfilesByUserIds(pageIds);
      const visible = new Set(pageRows.map((r) => r.user_id));
      const hidden = pageIds.filter((id) => !visible.has(id));
      if (hidden.length > 0) {
        layerLog("SLICE", `⚠️ ${hidden.length} id(s) in this page are no longer searchable — private or deleted since the ranking was written`, {
          userIds: hidden.join(","),
        });
      }

      const { candidates, savedUserIds } = await loadCandidates(pageRows, companyId, admissions);
      layerLog("ATTACH", `seven bulk reads for ${pageRows.length} profiles only`, {
        saved: savedUserIds.size,
        degradedSections: degradedSections.length,
      });
      const recordContext: RecordContext = {
        matchContext: matchContextFor(ranked.effectiveSkills, ranked.matchKeyword, ranked.taxonomy),
        showMatchScore: Boolean(requestedJobId),
        rankingEnabled: ranked.mode === "search",
        savedUserIds,
      };
      layerLog("SKIP", "no corpus scan, no Layer A, no taxonomy, no Layer 1, no filters, no Layer B — the stored order decided all of that");

      const warmTalents = pageIds
        .map((id) => candidates.get(id))
        .filter((rows): rows is CandidateRows => Boolean(rows))
        .map((rows) => buildTalentRecord(rows, normalizeCandidate(rows), recordContext));
      for (const t of warmTalents) {
        debugLog(`[talent-search] WARM       │ #${t.user_id} ${t.name} | rank ${t.ranking_score ?? "N/A"} | match ${t.match_score ?? "N/A"} | ${t.availability_status} | saved=${t.is_saved}`);
      }

      // Honest stages only: retrieval and scoring did not run for this request,
      // so the line reports what was hydrated and what visibility dropped.
      counts.hydrated = candidates.size;
      counts.hidden_since_ranking = pageIds.length - candidates.size;
      counts.after_filter = ranked.total;
      counts.mode = ranked.mode;
      counts.ai_reranked = ranked.aiReranked;
      counts.cached_age_ms = Date.now() - ranked.savedAt;
      counts.warnings = warnings.length;
      counts.page = page;
      counts.limit = limit;
      mark("attach");
      emitTrace();
      layerLog("RESPONSE", `${warmTalents.length} talent cards from cache, page ${page}`, {
        total: ranked.total,
        mode: ranked.mode,
        warnings: warnings.length,
        ms: Date.now() - startedAt,
      });

      return NextResponse.json({
        search_mode: ranked.mode,
        search_context: ranked.mode === "search" ? ranked.taxonomy : null,
        talents: warmTalents,
        total: ranked.total,
        page,
        limit,
        sort: requestedSort,
        ai_reranked: ranked.aiReranked,
        warnings,
      });
    }

    // ────────────────────────────────────────────
    // 3b. Tier 1 Base Scored Pool check
    //
    // If exact filter ranking is a miss, check if we already scored the corpus
    // for this canonical keyword and job posting. If so, sidebar filters can be
    // applied in-memory in < 1ms, skipping all Directus scans and Layer 1.
    // ────────────────────────────────────────────
    const baseKey = buildBaseSearchKey({
      companyId,
      jobId: requestedJobId,
      keyword: canonicalKeyword,
      skills: requestedSkills,
    });

    let basePool = getBaseScoredPool(baseKey);
    if (basePool) {
      const [newest] = await readMostRecentlyWrittenProfile();
      const newestWrite = newest?.updated_at ? Date.parse(newest.updated_at) : NaN;
      if (!Number.isNaN(newestWrite) && basePool.newestProfileWrite !== null && newestWrite > basePool.newestProfileWrite) {
        layerLog("CACHE", "❌ base pool discarded: a profile row was written after this pool was scored", {
          coveredWritesUpTo: new Date(basePool.newestProfileWrite).toISOString(),
          newestWriteNow: new Date(newestWrite).toISOString(),
        });
        basePool = null;
      }
    }

    if (basePool) {
      layerLog("CACHE", `hit (base pool) — reusing ${basePool.talents.length} scored candidates for "${canonicalKeyword}"`, {
        ageMs: Date.now() - basePool.savedAt,
        candidates: basePool.talents.length,
        matchKeyword: basePool.matchKeyword,
        role: basePool.taxonomy.resolved_role,
      });

      let filtered = filterTalentResults(basePool.talents, {
        locations,
        schools: schoolFilters,
        workSetups: workSetupFilters,
        experienceLevels,
      });

      const dropped = basePool.talents.length - filtered.length;
      layerLog(
        "FILTER",
        `${basePool.talents.length} → ${filtered.length} after sidebar filters${dropped > 0 ? ` (${dropped} dropped)` : " (none set or all passed)"}`,
        {
          locations: locations.length,
          schools: schoolFilters.length,
          workSetups: workSetupFilters.length,
          experienceLevels: experienceLevels.length,
        }
      );

      sortTalents(filtered, searchMode, requestedSort);

      // Layer B reorders the head of the list and blends an AI adjustment into
      // those candidates' ranking_score. Under a recruiter-chosen order that work
      // is thrown away by the sort below it and paid for anyway, so the call is
      // skipped and the response says plainly that the order is not AI-derived.
      let rerank: TalentRerank = {
        talents: filtered,
        aiReranked: false,
        outcome: "not_applicable",
      };
      if (requestedSort === "relevance") {
        rerank = await rerankTalents({
          keyword: basePool.matchKeyword || canonicalKeyword,
          jobId: requestedJobId,
          userId,
          companyId,
          talents: filtered,
        });
      }
      filtered = rerank.talents;

      const total = filtered.length;
      const paginated = filtered.slice((page - 1) * limit, page * limit);

      setRankedSearch(rankingKey, {
        ids: filtered.map((t) => t.user_id),
        total,
        mode: searchMode,
        aiReranked: rerank.aiReranked,
        taxonomy: basePool.taxonomy,
        matchKeyword: basePool.matchKeyword,
        effectiveSkills: basePool.effectiveSkills,
        newestProfileWrite: basePool.newestProfileWrite,
        savedAt: Date.now(),
      });

      counts.mode = searchMode;
      counts.ai_reranked = rerank.aiReranked;
      counts.after_filter = total;
      counts.page = page;
      counts.limit = limit;
      counts.cache = "hit_base";
      mark("rank");
      emitTrace();

      return NextResponse.json({
        search_mode: searchMode,
        search_context: searchMode === "search" ? basePool.taxonomy : null,
        talents: paginated,
        total,
        page,
        limit,
        sort: requestedSort,
        ai_reranked: rerank.aiReranked,
        warnings,
      });
    }

    // ────────────────────────────────────────────
    // 4. Cold path: scan the corpus + DB taxonomy aliases
    //
    // Taxonomy rows feed the matcher. Reading them as `[]` when Directus was
    // unreachable made every role, alias and skill requirement vanish, and the
    // recruiter was told the market had no matching talent.
    // ────────────────────────────────────────────
    const [profiles, { aliases: dbAliases, roleSkills: dbRoleSkills }] = await Promise.all([
      scanSearchableProfiles(),
      getOrLoadTaxonomy(),
    ]);

    // The scan ceiling is a memory guard, not a licence to search a partial
    // index. If a read came back full, talent beyond the first MAX_SCAN_ROWS is
    // invisible to this run, and a "no matches" list would be read as the market
    // being empty rather than as a truncated scan.
    const scanTruncated =
      profiles.length >= MAX_SCAN_ROWS ||
      dbAliases.length >= MAX_SCAN_ROWS ||
      dbRoleSkills.length >= MAX_SCAN_ROWS;
    if (scanTruncated) {
      layerLog("INGEST", `❗ a scan hit the ${MAX_SCAN_ROWS}-row ceiling — talent beyond it is invisible to this run`, {
        profiles: profiles.length,
        aliases: dbAliases.length,
        roleSkillRows: dbRoleSkills.length,
      });
      warnings.push(
        `This search could only read the first ${MAX_SCAN_ROWS} profile and taxonomy rows, so results may be incomplete.`
      );
    } else {
      layerLog("INGEST", "scanned the corpus and both taxonomy tables whole", {
        profiles: profiles.length,
        aliases: dbAliases.length,
        roleSkillRows: dbRoleSkills.length,
      });
    }
    mark("ingest");
    counts.corpus = profiles.length;
    if (scanTruncated) counts.truncated = true;

    // Resolve Role Taxonomy using the effective match keyword (Gemini-resolved or original)
    const taxonomy = resolveRoleTaxonomy(query.matchKeyword, dbAliases);
    layerLog("TAXONOMY", taxonomy.resolved_role ? `matched alias "${taxonomy.matched_alias}" → role ${taxonomy.resolved_role}` : "no DB role for this keyword — matching on the raw text only", {
      roleId: taxonomy.resolved_role_id,
      category: taxonomy.category_code,
      matchWeight: taxonomy.match_weight,
      expandedAliases: taxonomy.expanded_aliases.length,
    });

    // Build role → skill name list map from DB, once: this walks every
    // `vs_role_skill_mapping` row.
    const roleSkillsMap = buildRoleSkillsMap(dbRoleSkills);

    // Auto-expand the requested skills with the resolved role's DB skills, plus
    // Gemini's inferred skills — but only when the recruiter named none.
    const effectiveSkills = expandEffectiveSkills({
      requestedSkills,
      taxonomy,
      roleSkillsMap,
      inferredSkills: query.intent?.inferred_skills ?? [],
    });
    layerLog(
      "SKILLS",
      effectiveSkills.length
        ? `${effectiveSkills.length} skills scored against: ${effectiveSkills.slice(0, 10).join(", ")}${effectiveSkills.length > 10 ? " …" : ""}`
        : "no skills to score against",
      {
        recruiterSelected: requestedSkills.length,
        fromRole: taxonomy.resolved_role_id === null ? 0 : (roleSkillsMap.get(taxonomy.resolved_role_id) ?? []).length,
        fromAi: query.intent?.inferred_skills.length ?? 0,
      }
    );
    mark("taxonomy");
    counts.effective_skills = effectiveSkills.length;

    if (profiles.length === 0) {
      emitTrace();
      layerLog("RESPONSE", "❗ the corpus scan returned no visible profile at all — empty list, nothing cached", { ms: Date.now() - startedAt });
      return NextResponse.json({
        search_mode: "browse",
        search_context: taxonomy,
        talents: [],
        total: 0,
        page,
        limit,
        warnings,
      });
    }

    // ────────────────────────────────────────────
    // 5. Attach the corpus, normalize it, retrieve
    // ────────────────────────────────────────────
    const { candidates, savedUserIds } = await loadCandidates(profiles, companyId, admissions);
    layerLog("ATTACH", `seven bulk reads joined ${candidates.size} candidates`, {
      scanned: profiles.length,
      noUserRow: profiles.length - candidates.size,
      savedByCompany: savedUserIds.size,
      degradedSections: degradedSections.length,
    });
    mark("attach");
    counts.attached = candidates.size;

    const normalizedProfilesMap = new Map<number, NormalizedCandidateItem>();
    const normalizedProfilesList: NormalizedProfile[] = [];

    for (const rows of candidates.values()) {
      const normalized = normalizeCandidate(rows);
      normalizedProfilesMap.set(rows.profile.user_id, { ...rows, normalized });
      normalizedProfilesList.push(normalized);
    }
    layerLog("NORMALIZE", "profiles shaped for the evaluators", {
      with: normalizedProfilesList.length,
      noSkills: normalizedProfilesList.filter((p) => p.skills.length === 0).length,
      noWorkHistory: normalizedProfilesList.filter((p) => p.workHistory.length === 0).length,
      employed: normalizedProfilesList.filter((p) => p.availability === "EMPLOYED").length,
      avgCompleteness: normalizedProfilesList.length === 0
        ? null
        : Math.round(normalizedProfilesList.reduce((a, p) => a + p.profileCompletenessScore, 0) / normalizedProfilesList.length),
    });
    mark("normalize");
    counts.normalized = normalizedProfilesList.length;

    // Layer 1: high-recall retrieval (fuzzy, token overlap, taxonomy expansion)
    const analyzedQuery = analyzeQuery(query.matchKeyword);
    const retrievedPool = retrieveCandidatePool(
      normalizedProfilesList,
      analyzedQuery,
      taxonomy,
      0,
      keyword,
      effectiveSkills,
      engineMode
    );
    mark("layer_1");
    counts.layer_1 = retrievedPool.length;

    // Filter by relevance eligibility when in search mode (hybrid relevance)
    const eligiblePool =
      searchMode === "browse"
        ? retrievedPool
        : retrievedPool.filter((r) => r.eligibility?.eligible);

    counts.eligible = eligiblePool.length;
    counts.excluded_relevance = retrievedPool.length - eligiblePool.length;

    if (retrievedPool.length > 0) {
      const reasons = new Map<string, number>();
      for (const r of retrievedPool) reasons.set(r.retrievalReason, (reasons.get(r.retrievalReason) ?? 0) + 1);
      layerLog(
        "LAYER_1",
        `retrieval completed: ${eligiblePool.length} of ${retrievedPool.length} eligible (${retrievedPool.length - eligiblePool.length} excluded as NO_RELEVANCE)`,
        {
          retrieved: retrievedPool.length,
          of: normalizedProfilesList.length,
          eligible: eligiblePool.length,
          scored: retrievedPool.filter((r) => r.retrievalScore > 0).length,
          top: Math.max(...retrievedPool.map((r) => r.retrievalScore)),
          why: [...reasons].map(([k, v]) => `${k}×${v}`).join(" "),
        }
      );
    } else {
      layerLog("LAYER_1", "retrieval returned nothing", { of: normalizedProfilesList.length });
    }

    // Layer 2: score all eligible candidates to create the base scored pool
    const sharedContext: RecordContext = {
      matchContext: matchContextFor(effectiveSkills, query.matchKeyword, taxonomy),
      showMatchScore: Boolean(requestedJobId),
      rankingEnabled: searchMode === "search",
      savedUserIds,
    };

    const baseTalents: TalentResult[] = eligiblePool
      .map(({ candidate, retrievalScore, retrievalReason }) => {
        const item = normalizedProfilesMap.get(candidate.id);
        if (!item) return null;
        // Layer 1's verdict rides along for the development line only. Nothing
        // that produces a score reads it, which is the defect TS-10 fixes.
        return buildTalentRecord(item, item.normalized, {
          ...sharedContext,
          retrieval: { score: retrievalScore, reason: retrievalReason },
        });
      })
      .filter((t): t is TalentResult => t !== null);

    mark("layer_2");
    counts.layer_2 = baseTalents.length;

    // Cache the base scored pool for this role keyword before applying transient sidebar filters
    if (warnings.length === 0) {
      setBaseScoredPool(baseKey, {
        talents: baseTalents,
        taxonomy,
        matchKeyword: query.matchKeyword,
        effectiveSkills,
        newestProfileWrite: newestWriteMs(profiles),
        savedAt: Date.now(),
      });
    }

    // ────────────────────────────────────────────
    // 6. Filter & Rank
    // ────────────────────────────────────────────
    let filtered = filterTalentResults(baseTalents, {
      locations,
      schools: schoolFilters,
      workSetups: workSetupFilters,
      experienceLevels,
    });
    const droppedCount = baseTalents.length - filtered.length;
    layerLog(
      "FILTER",
      `${baseTalents.length} → ${filtered.length} after sidebar filters${droppedCount > 0 ? ` (${droppedCount} dropped)` : " (none set or all passed)"}`,
      {
        locations: locations.length,
        schools: schoolFilters.length,
        workSetups: workSetupFilters.length,
        experienceLevels: experienceLevels.length,
      }
    );

    sortTalents(filtered, searchMode, requestedSort);
    layerLog(
      "RANK",
      requestedSort !== "relevance"
        ? `ordered by the recruiter's choice: ${requestedSort}`
        : `ordered by ${searchMode === "search" ? "ranking_score, then match_score" : "profile completeness + experience, then newest profile_id"}`,
      { total: filtered.length }
    );

    const total = filtered.length;
    mark("rank");
    counts.after_filter = total;
    filtered.slice(0, 5).forEach((t, i) => {
      debugLog(`[talent-search] RANK       │ #${i + 1} ${t.user_id} ${t.name} "${t.headline || "no headline"}" → ${t.ranking_score ?? t.match_score ?? 0}`);
    });

    let rerank: TalentRerank = {
      talents: filtered,
      aiReranked: false,
      outcome: "not_applicable",
    };
    if (requestedSort === "relevance") {
      rerank = await rerankTalents({
        keyword: query.matchKeyword || keyword,
        jobId: requestedJobId,
        userId,
        companyId,
        talents: filtered,
      });
    }
    filtered = rerank.talents;
    counts.layer_b = rerank.outcome;
    mark("layer_b");
    layerLog(
      "LAYER_B",
      rerank.outcome === "reranked"
        ? "AI reordered the head of the list; the tail kept its Layer 2 rank"
        : rerank.outcome === "skipped"
          ? "AI rerank failed or was declined — the deterministic Layer 2 order stands"
          : "not applicable — needs a keyword and more than one candidate",
      { jobId: requestedJobId || null, keyword: keyword || null, candidates: total, aiReranked: rerank.aiReranked }
    );

    const paginated = filtered.slice((page - 1) * limit, page * limit);

    // Store the order, never the rows. A degraded or truncated run is not
    // written: page turns would then keep serving the outage's ranking until the
    // entry aged out, long after Directus recovered.
    if (warnings.length === 0) {
      setRankedSearch(rankingKey, {
        ids: filtered.map((t) => t.user_id),
        total,
        mode: searchMode,
        aiReranked: rerank.aiReranked,
        taxonomy,
        matchKeyword: query.matchKeyword,
        effectiveSkills,
        newestProfileWrite: newestWriteMs(profiles),
        savedAt: Date.now(),
      });
      counts.cached = true;
      layerLog("CACHE", "stored this order — the next page of the same search skips everything above", {
        ids: total,
        matchKeyword: query.matchKeyword,
        effectiveSkills: effectiveSkills.length,
      });
    } else {
      counts.cached = false;
      layerLog("CACHE", `❌ NOT stored — a degraded or truncated run is never cached, so page turns recompute`, { warnings: warnings.length });
    }

    counts.mode = searchMode;
    counts.ai_reranked = rerank.aiReranked;
    counts.degraded = degradedSections.length;
    counts.warnings = warnings.length;
    counts.page = page;
    counts.limit = limit;
    emitTrace();
    layerLog("RESPONSE", `${paginated.length} talent cards, page ${page} of ${total}`, {
      mode: searchMode,
      ai_reranked: rerank.aiReranked,
      degradedSections: degradedSections.length,
      warnings: warnings.length,
      ms: Date.now() - startedAt,
    });

    return NextResponse.json({
      search_mode: searchMode,
      search_context: searchMode === "search" ? taxonomy : null,
      talents: paginated,
      total,
      page,
      limit,
      sort: requestedSort,
      ai_reranked: rerank.aiReranked,
      warnings,
    });
  } catch (err: unknown) {
    console.error("[talent-search GET] Error:", err);
    // An unreachable Directus is not "the market has no matching talent". The
    // reads above reject on failure so this is the only place an outage can
    // surface, and it must not be shaped like a successful empty search.
    if (err instanceof DirectusError) {
      layerLog("ERROR", "❌ a required Directus read failed — 502, deliberately NOT an empty search", { detail: err.message });
      return NextResponse.json(
        { error: "Talent search is unavailable right now. Please try again.", talents: [], total: 0 },
        { status: 502 }
      );
    }
    layerLog("ERROR", "❌ unexpected failure — 500", { detail: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to search talent profiles." }, { status: 500 });
  }
}

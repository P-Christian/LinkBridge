// src/app/api/vos-admin/job-roles/ai-suggest/route.ts
// Context-aware AI suggestions with Two-Layer Deduplication against Master Taxonomy

import { NextRequest, NextResponse } from "next/server";
import { callGeminiMonitored } from "@/lib/gemini/geminiMonitoring";
import { evaluateTaxonomyProposal, GovernanceResult } from "@/modules/vos-admin/role-matching/services/taxonomy/taxonomyGovernanceService";
import { requireAdministrator } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

export const revalidate = 0;

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AiSuggestedKeyword {
  alias: string;
  weight: number;
  type: "SYNONYM" | "KEYWORD" | "ABBREVIATION" | "EXACT";
  is_new_keyword?: boolean;
}

export interface AiSuggestedSkill {
  skill_name: string;
  importance_weight: number;
  is_required: boolean;
  matched_master_id?: number | null;
  is_new_skill?: boolean;
}

export interface AiSuggestResult {
  description: string;
  keywords: AiSuggestedKeyword[];
  skills: AiSuggestedSkill[];
  cached: boolean;
  governance?: GovernanceResult;
}

// ── Normalization Helper ──────────────────────────────────────────────────────

function normalizeToken(str: string): string {
  return str
    .toLowerCase()
    .replace(/[._\-/\s]/g, "")
    .trim();
}

// ── Server-side Cache (10 min TTL) ───────────────────────────────────────────

interface CacheEntry {
  data: Omit<AiSuggestResult, "cached">;
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const suggestCache = new Map<string, CacheEntry>();

function getCacheKey(roleName: string, categoryName: string): string {
  return `${roleName.trim().toLowerCase()}::${categoryName.trim().toLowerCase()}`;
}

function getFromCache(key: string): Omit<AiSuggestResult, "cached"> | null {
  const entry = suggestCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    suggestCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: Omit<AiSuggestResult, "cached">): void {
  suggestCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Context-Aware Prompt ──────────────────────────────────────────────────────

function buildPrompt(
  roleName: string,
  categoryName: string,
  existingSkills: { skill_id?: number; name: string }[] = [],
  existingKeywords: string[] = [],
  previousSuggestions: string[] = []
): string {
  const skillsContext =
    existingSkills.length > 0
      ? `\nCURRENT EXISTING SKILLS ALREADY MAPPED TO THIS ROLE (DO NOT SUGGEST THESE OR THEIR VARIATIONS/SYNONYMS):\n${existingSkills
          .map((s) => `- ${s.name}`)
          .join("\n")}\n`
      : "";

  const keywordsContext =
    existingKeywords.length > 0
      ? `\nCURRENT EXISTING KEYWORDS ALREADY MAPPED TO THIS ROLE (DO NOT SUGGEST THESE OR THEIR VARIATIONS):\n${existingKeywords
          .map((k) => `- ${k}`)
          .join("\n")}\n`
      : "";

  const previousContext =
    previousSuggestions.length > 0
      ? `\nPREVIOUS SUGGESTIONS ALREADY SHOWN IN THIS SESSION (DO NOT REPEAT THESE CANDIDATES):\n${previousSuggestions
          .slice(-25)
          .map((p) => `- ${p}`)
          .join("\n")}\n`
      : "";

  return `You are a job taxonomy and recruitment intelligence expert for a modern job marketplace.

For the standard job role "${roleName}" in the category "${categoryName}", suggest NEW, DISTINCT, and COMPLEMENTARY skills and search keywords.
${skillsContext}${keywordsContext}${previousContext}
Return ONLY a valid JSON object with exactly this structure (no markdown, no extra text):
{
  "description": "One professional sentence (max 120 chars) describing what this role does.",
  "keywords": [
    { "alias": "lowercase distinct alias or search term", "weight": 0.50-1.00, "type": "SYNONYM|KEYWORD|ABBREVIATION|EXACT" }
  ],
  "skills": [
    { "skill_name": "Exact distinct skill name", "importance_weight": 0.50-1.00, "is_required": true|false }
  ]
}

Rules:
- DO NOT return any skill, keyword, or session candidate listed above.
- keywords: 5 to 8 distinct search phrases, synonyms, and abbreviations. All lowercase. weight >= 0.50.
- skills: 5 to 8 distinct technical or professional competencies. importance_weight = 0.50-1.00.
- Return ONLY valid JSON. No markdown fences, no explanation text.`;
}

// ── Parser ────────────────────────────────────────────────────────────────────

function parseGeminiResponse(raw: string): {
  description: string;
  keywords: { alias: string; weight: number; type: "SYNONYM" | "KEYWORD" | "ABBREVIATION" | "EXACT" }[];
  skills: { skill_name: string; importance_weight: number; is_required: boolean }[];
} | null {
  try {
    let cleaned = raw.trim();

    const matchJsonFence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (matchJsonFence && matchJsonFence[1]) {
      cleaned = matchJsonFence[1].trim();
    }

    const startIdx = cleaned.indexOf("{");
    const endIdx = cleaned.lastIndexOf("}");
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleaned = cleaned.slice(startIdx, endIdx + 1);
    }

    const parsed = JSON.parse(cleaned) as {
      description?: string;
      keywords?: { alias?: string; weight?: number; type?: string }[];
      skills?: { skill_name?: string; importance_weight?: number; is_required?: boolean }[];
    };

    const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
    const keywords = (parsed.keywords ?? [])
      .filter((k) => typeof k.alias === "string" && k.alias.trim())
      .map((k) => ({
        alias: k.alias!.trim().toLowerCase(),
        weight: Math.min(1.0, Math.max(0.5, Number(k.weight) || 0.8)),
        type: (["SYNONYM", "KEYWORD", "ABBREVIATION", "EXACT"].includes(k.type ?? "")
          ? k.type!
          : "SYNONYM") as AiSuggestedKeyword["type"],
      }));

    const skills = (parsed.skills ?? [])
      .filter((s) => typeof s.skill_name === "string" && s.skill_name.trim())
      .map((s) => ({
        skill_name: s.skill_name!.trim(),
        importance_weight: Math.min(1.0, Math.max(0.1, Number(s.importance_weight) || 0.8)),
        is_required: Boolean(s.is_required),
      }));

    return { description, keywords, skills };
  } catch {
    console.error("[ai-suggest] ❌ JSON parsing failed. Raw snippet:", raw.slice(0, 300));
    return null;
  }
}

// ── Route Handlers ────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    status: "online",
    endpoint: "/api/vos-admin/job-roles/ai-suggest",
    methods: ["POST"],
    description: "Generates deduplicated job role skills, keywords, and descriptions using Gemini AI.",
  });
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdministrator(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const body = await req.json();
    const roleName: string = (body.role_name ?? "").trim();
    const categoryName: string = (body.category_name ?? "General").trim();
    const existingSkills: { skill_id?: number; name: string }[] = body.existing_skills ?? [];
    const existingKeywords: string[] = body.existing_keywords ?? [];
    const previousSuggestions: string[] = body.previous_suggestions ?? [];
    const forceRefresh: boolean = Boolean(body.force_refresh || body.refresh);

    if (!roleName) {
      return NextResponse.json({ error: "role_name is required" }, { status: 400 });
    }

    const cacheKey = getCacheKey(roleName, categoryName);

    // Cache hit check (unless force_refresh is requested)
    if (!forceRefresh) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        const existingSkillTokens = new Set(
          existingSkills.map((s) => normalizeToken(s.name)).filter(Boolean)
        );
        const existingKeywordTokens = new Set(
          existingKeywords.map((k) => normalizeToken(k)).filter(Boolean)
        );

        const filteredSkills = cached.skills.filter(
          (s) => !existingSkillTokens.has(normalizeToken(s.skill_name))
        );
        const filteredKeywords = cached.keywords.filter(
          (k) => !existingKeywordTokens.has(normalizeToken(k.alias))
        );

        if (filteredSkills.length > 0 || filteredKeywords.length > 0) {
          return NextResponse.json({
            ...cached,
            skills: filteredSkills,
            keywords: filteredKeywords,
            cached: true,
          });
        }
      }
    }

    // Call Gemini AI
    const prompt = buildPrompt(roleName, categoryName, existingSkills, existingKeywords, previousSuggestions);

    let raw: string | null = null;
    try {
      raw = await callGeminiMonitored({
        prompt,
        feature: "ROLE_INTELLIGENCE",
        endpoint: "/api/vos-admin/job-roles/ai-suggest",
        timeoutMs: 15000,
        userId: admin.adminId,
      });
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message || "AI service temporarily unavailable.";
      return NextResponse.json({ error: errorMsg }, { status: 503 });
    }

    if (!raw) {
      return NextResponse.json(
        { error: "AI service returned no response. Please check rate limits or try again." },
        { status: 503 }
      );
    }

    const parsed = parseGeminiResponse(raw);
    if (!parsed) {
      return NextResponse.json(
        { error: "Failed to parse structured response from AI service." },
        { status: 500 }
      );
    }

    // ── LAYER 2: Server-Side Deduplication & Master Taxonomy Matching ─────────
    // Fetch master skills library to match against canonical entities.
    // This lookup is what marks a suggestion as an existing skill; skipped, every
    // answer comes back `is_new_skill` with no master id, and approving one writes
    // a duplicate row into the master taxonomy.
    const masterRes = await fetch(`${DIRECTUS_BASE}/items/vs_master_skills?limit=-1`, {
      headers: getHeaders(),
      cache: "no-store",
    });
    if (!masterRes.ok) {
      return NextResponse.json(
        {
          error:
            "The master skill library could not be read, so no suggestions are shown. Try again.",
        },
        { status: 502 }
      );
    }
    const masterSkillsList: { id: number; skill_name: string }[] =
      (await masterRes.json()).data ?? [];

    // Build normalized lookup sets of existing items & previous session suggestions
    const existingSkillTokens = new Set(
      existingSkills.map((s) => normalizeToken(s.name)).filter(Boolean)
    );
    const existingKeywordTokens = new Set(
      existingKeywords.map((k) => normalizeToken(k)).filter(Boolean)
    );
    const previousSuggestionTokens = new Set(
      previousSuggestions.map((p) => normalizeToken(p)).filter(Boolean)
    );

    // 1. Process and deduplicate skills
    const seenSkillTokens = new Set<string>();
    const deduplicatedSkills: AiSuggestedSkill[] = [];

    for (const s of parsed.skills) {
      const norm = normalizeToken(s.skill_name);
      if (
        !norm ||
        existingSkillTokens.has(norm) ||
        previousSuggestionTokens.has(norm) ||
        seenSkillTokens.has(norm)
      ) {
        continue; // Skip existing, session-shown, or redundant
      }
      seenSkillTokens.add(norm);

      // Match against master skills library
      const matchedMaster = masterSkillsList.find(
        (m) => normalizeToken(m.skill_name) === norm
      );

      deduplicatedSkills.push({
        skill_name: matchedMaster ? matchedMaster.skill_name : s.skill_name,
        importance_weight: s.importance_weight,
        is_required: s.is_required,
        matched_master_id: matchedMaster ? matchedMaster.id : null,
        is_new_skill: !matchedMaster,
      });
    }

    // 2. Process and deduplicate keywords
    const seenKeywordTokens = new Set<string>();
    const deduplicatedKeywords: AiSuggestedKeyword[] = [];

    for (const k of parsed.keywords) {
      const norm = normalizeToken(k.alias);
      if (
        !norm ||
        existingKeywordTokens.has(norm) ||
        previousSuggestionTokens.has(norm) ||
        seenKeywordTokens.has(norm)
      ) {
        continue; // Skip existing, session-shown, or redundant
      }
      seenKeywordTokens.add(norm);

      deduplicatedKeywords.push({
        alias: k.alias,
        weight: k.weight,
        type: k.type,
        is_new_keyword: true,
      });
    }

    // ── Shared Governance Evaluation ──────────────────────────────────────────
    const governance = await evaluateTaxonomyProposal({
      roleName,
      categoryName,
      keywords: deduplicatedKeywords.map((k) => ({ name: k.alias, weight: k.weight, type: k.type })),
      skills: deduplicatedSkills.map((s) => ({
        name: s.skill_name,
        weight: s.importance_weight,
        isRequired: s.is_required,
      })),
    });

    const finalResult: AiSuggestResult = {
      description: parsed.description,
      keywords: deduplicatedKeywords,
      skills: deduplicatedSkills,
      cached: false,
      governance,
    };

    // Cache if clean
    setCache(cacheKey, finalResult);

    return NextResponse.json(finalResult);
  } catch (err: unknown) {
    const msg = safeErrorMessage(err, "Internal server error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

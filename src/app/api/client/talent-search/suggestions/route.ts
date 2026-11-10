// src/app/api/client/talent-search/suggestions/route.ts

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";
import { cleanText, COMMON_SCHOOL_ALIASES, generateSchoolAcronym } from "@/modules/matching-engine";
import {
  filterAndRank,
  rankByRelevance,
} from "@/modules/client/talent-search/utils/filterMatching";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const PSGC_PROVINCES_URL = "https://psgc.gitlab.io/api/provinces/";
const PSGC_CITIES_URL = "https://psgc.gitlab.io/api/cities-municipalities/";
const PSGC_REGIONS_URL = "https://psgc.gitlab.io/api/regions/";

export const MIN_TERM_LENGTH = 2;
const MAX_TERM_LENGTH = 80;
const RESPONSE_LIMIT = 20;
/** Oversampled page size so prefix/acronym hits can be ranked before the cut. */
const RECALL_LIMIT = 50;
/** Registry tables change rarely; the TTL keeps typing off the upstream API. */
const REGISTRY_TTL_MS = 30 * 60 * 1000;
/** Schools stay a per-term query; this keeps repeat typing off Directus. */
const TERM_CACHE_TTL_MS = 5 * 60 * 1000;
const TERM_CACHE_MAX = 200;

interface TermCacheEntry<T> {
  expiresAt: number;
  value: T;
}

const termCache = new Map<string, TermCacheEntry<unknown>>();

/**
 * Results — including legitimately empty ones — are cached; a rejected loader
 * is never stored, so an upstream outage cannot pin empty suggestions.
 */
async function cachedTermLookup<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = termCache.get(key) as TermCacheEntry<T> | undefined;
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const value = await load();
  termCache.set(key, { expiresAt: Date.now() + TERM_CACHE_TTL_MS, value });
  if (termCache.size > TERM_CACHE_MAX) {
    const oldest = termCache.keys().next().value;
    if (oldest !== undefined) termCache.delete(oldest);
  }
  return value;
}

const cacheKey = (type: string, term: string) => `${type}|${term.toLowerCase()}`;

export type SuggestionType = "skills" | "locations" | "schools";

export interface Suggestion {
  value: string;
  label: string;
  hint: string | null;
}

const SUGGESTION_TYPES: SuggestionType[] = ["skills", "locations", "schools"];

/** Not a suggestion type — asks for the complete skills + PSGC payload once. */
const REGISTRY_TYPE = "registry";

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

function normalizeTerm(raw: string): string {
  return raw.trim().slice(0, MAX_TERM_LENGTH);
}

async function fetchCollectionItems(path: string): Promise<unknown[]> {
  if (!DIRECTUS_BASE) throw new Error("Directus API base URL is not configured.");
  const res = await fetch(`${DIRECTUS_BASE}/items/${path}`, {
    headers: getHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Directus responded ${res.status} for ${path.split("?")[0]}.`);
  const json = (await res.json()) as { data?: unknown[] };
  return Array.isArray(json.data) ? json.data : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// ── Skills: vs_master_skills registry ─────────────────────────────────────────

let skillRegistry: { names: string[]; expiresAt: number } | null = null;

/**
 * `vs_master_skills` is read whole, once per TTL, so typing filters an in-memory
 * list instead of issuing a Directus query per keystroke.
 */
async function loadSkillNames(): Promise<string[]> {
  const now = Date.now();
  if (skillRegistry && skillRegistry.expiresAt > now) return skillRegistry.names;

  const rows = (await fetchCollectionItems(
    "vs_master_skills?fields=skill_name&sort=skill_name&limit=-1"
  )) as { skill_name?: unknown }[];
  const names = [
    ...new Set(
      rows
        .map((row) => asString(row.skill_name))
        .filter((name): name is string => name !== null)
    ),
  ];

  // Never cache an outage: an empty table read must not pin empty suggestions.
  if (names.length === 0) return skillRegistry?.names ?? [];
  skillRegistry = { names, expiresAt: now + REGISTRY_TTL_MS };
  return names;
}

async function suggestSkills(term: string): Promise<Suggestion[]> {
  const names = await loadSkillNames();
  return filterAndRank(names, (name) => name, term, RESPONSE_LIMIT).map((name) => ({
    value: name,
    label: name,
    hint: null,
  }));
}

// ── Schools: vs_school registry ───────────────────────────────────────────────

interface SchoolRow {
  school_id: number;
  school_name: string;
  city_municipality: string | null;
  province: string | null;
  school_status: string | null;
  verification_status: string | null;
}

const EXCLUDED_VERIFICATION = ["REJECTED", "SUSPENDED", "INACTIVE"];
const EXCLUDED_STATUS = ["Inactive", "Suspended"];
/** Bounds the OR-tree when a typed acronym expands through the alias dictionary. */
const MAX_ALIAS_TERMS = 3;

function buildSchoolSearchTerms(term: string): string[] {
  const terms = [term];
  const cleaned = cleanText(term) || term.toLowerCase();
  const aliases = COMMON_SCHOOL_ALIASES[cleaned] ?? [];
  for (const alias of aliases) {
    if (terms.length >= MAX_ALIAS_TERMS + 1) break;
    if (!terms.includes(alias)) terms.push(alias);
  }
  return terms;
}

function schoolQuery(terms: string[]): string {
  const query = new URLSearchParams({
    fields: "school_id,school_name,city_municipality,province,school_status,verification_status",
    sort: "school_name,school_id",
    limit: String(RECALL_LIMIT),
  });
  terms.forEach((term, termIndex) => {
    (["school_name", "city_municipality", "province"] as const).forEach((field, fieldIndex) => {
      query.set(
        `filter[_or][${termIndex * 3 + fieldIndex}][${field}][_icontains]`,
        term
      );
    });
  });
  return query.toString();
}

function suggestSchoolsFromRows(rows: SchoolRow[], term: string): Suggestion[] {
  const cleaned = cleanText(term) || term.toLowerCase();
  const usable = rows.filter(
    (row) =>
      typeof row.school_id === "number" &&
      !!row.school_name &&
      !EXCLUDED_VERIFICATION.includes(String(row.verification_status)) &&
      !EXCLUDED_STATUS.includes(String(row.school_status))
  );

  const deduped = new Map<number, SchoolRow>();
  for (const row of usable) deduped.set(row.school_id, row);

  // An acronym typed by the recruiter ("dlsu") must survive even though
  // `_icontains` only returned it through the alias dictionary.
  const byAcronym = [...deduped.values()].filter((row) => {
    const acronym = generateSchoolAcronym(row.school_name);
    return acronym && acronym === cleaned.replace(/\s+/g, "");
  });
  const merged = new Map<number, SchoolRow>();
  for (const row of [...byAcronym, ...deduped.values()]) merged.set(row.school_id, row);

  return rankByRelevance([...merged.values()], (r) => r.school_name, term)
    .slice(0, RESPONSE_LIMIT)
    .map((row) => ({
      value: String(row.school_id),
      label: row.school_name,
      hint: [row.city_municipality, row.province].filter(Boolean).join(", ") || null,
    }));
}

async function querySchools(term: string): Promise<Suggestion[]> {
  const rows = (await fetchCollectionItems(
    `vs_school?${schoolQuery(buildSchoolSearchTerms(term))}`
  )) as SchoolRow[];
  return suggestSchoolsFromRows(rows, term);
}

function suggestSchools(term: string): Promise<Suggestion[]> {
  return cachedTermLookup(cacheKey("schools", term), () => querySchools(term));
}

// ── Locations: PSGC registry (no location table exists in the platform DB) ───

interface PsgcRow {
  code?: unknown;
  name?: unknown;
  provinceCode?: unknown;
  regionCode?: unknown;
}

interface LocationEntry {
  name: string;
  parent: string | null;
}

let locationRegistry: { entries: LocationEntry[]; expiresAt: number } | null = null;

async function fetchPsgcRows(url: string): Promise<PsgcRow[]> {
  try {
    const res = await fetch(url, { cache: "default" });
    if (!res.ok) return [];
    const json: unknown = await res.json();
    if (!Array.isArray(json)) return [];
    return json.filter((row): row is PsgcRow => !!row && typeof row === "object");
  } catch {
    return [];
  }
}

function indexNamesByCode(rows: PsgcRow[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const row of rows) {
    const code = asString(row.code);
    const name = asString(row.name);
    if (code && name) index.set(code, name);
  }
  return index;
}

function toEntries(rows: PsgcRow[], parentOf?: (row: PsgcRow) => string | null): LocationEntry[] {
  const entries: LocationEntry[] = [];
  for (const row of rows) {
    const name = asString(row.name);
    if (!name) continue;
    entries.push({ name, parent: parentOf ? parentOf(row) : null });
  }
  return entries;
}

async function loadLocationRegistry(): Promise<LocationEntry[]> {
  const now = Date.now();
  if (locationRegistry && locationRegistry.expiresAt > now) return locationRegistry.entries;

  const [provinceRows, cityRows, regionRows] = await Promise.all([
    fetchPsgcRows(PSGC_PROVINCES_URL),
    fetchPsgcRows(PSGC_CITIES_URL),
    fetchPsgcRows(PSGC_REGIONS_URL),
  ]);

  const provinceNameByCode = indexNamesByCode(provinceRows);
  const regionNameByCode = indexNamesByCode(regionRows);
  // Metro Manila cities carry no province, so their region names the entry.
  const parentOfCity = (row: PsgcRow): string | null => {
    const provinceCode = asString(row.provinceCode);
    const regionCode = asString(row.regionCode);
    return (
      (provinceCode ? provinceNameByCode.get(provinceCode) : null) ??
      (regionCode ? regionNameByCode.get(regionCode) : null) ??
      null
    );
  };

  const entries = [
    ...toEntries(provinceRows),
    ...toEntries(cityRows, parentOfCity),
  ];

  // Never cache an outage: a transient PSGC failure must not pin empty results.
  if (provinceRows.length === 0 && cityRows.length === 0) return [];
  locationRegistry = { entries, expiresAt: now + REGISTRY_TTL_MS };
  return entries;
}

/** A city name already substring-matches profiles in "<city>, <province>", so
 *  duplicate names across provinces collapse to one selectable tag. */
function toLocationSuggestions(entries: LocationEntry[]): Suggestion[] {
  const deduped = new Map<string, Suggestion>();
  for (const entry of entries) {
    const key = entry.name.toLowerCase();
    if (deduped.has(key)) continue;
    deduped.set(key, {
      value: entry.name,
      label: entry.name,
      hint: entry.parent,
    });
  }
  return [...deduped.values()];
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized.", suggestions: [] }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required.", suggestions: [] }, { status: 403 });
    }

    const { isVerified, verification_status } = await checkCompanyVerificationStatus(
      Number(session.userId)
    );
    if (!isVerified) {
      return NextResponse.json(
        {
          error: `Restricted: Your company verification status is ${verification_status}.`,
          suggestions: [],
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawType = searchParams.get("type") || "";

    // One page-load call hands the browser the whole skills + PSGC registry, so
    // every later keystroke is answered locally instead of over the network.
    if (rawType === REGISTRY_TYPE) {
      const [names, entries] = await Promise.all([loadSkillNames(), loadLocationRegistry()]);
      const locations = toLocationSuggestions(entries);
      if (names.length === 0 && locations.length === 0) {
        return NextResponse.json({ error: "Registry is unavailable." }, { status: 503 });
      }
      return NextResponse.json(
        { skills: names, locations },
        // Cookie-scoped, so `private`: a reload within 5 min reuses the snapshot.
        { headers: { "Cache-Control": "private, max-age=300" } }
      );
    }

    const type = rawType as SuggestionType;
    if (!SUGGESTION_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "Unknown suggestion type.", suggestions: [] },
        { status: 400 }
      );
    }

    const term = normalizeTerm(searchParams.get("q") || "");
    if (term.length < MIN_TERM_LENGTH) {
      return NextResponse.json({ suggestions: [] });
    }

    if (type === "skills") {
      return NextResponse.json({ suggestions: await suggestSkills(term) });
    }

    if (type === "schools") {
      return NextResponse.json({ suggestions: await suggestSchools(term) });
    }

    const locations = toLocationSuggestions(await loadLocationRegistry());
    if (locations.length === 0) {
      return NextResponse.json({
        suggestions: [],
        error: "Location registry is unavailable — type a city or province instead.",
      });
    }
    return NextResponse.json({
      suggestions: filterAndRank(locations, (item) => item.label, term, RESPONSE_LIMIT),
    });
  } catch (err: unknown) {
    console.error("[talent-search suggestions] Error:", err);
    return NextResponse.json({
      suggestions: [],
      error: "Suggestions are unavailable — you can still type the value and press Enter.",
    });
  }
}

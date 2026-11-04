// src/modules/client/talent-search/services/talent-search.helpers.ts

/**
 * Pure utilities for the talent search pipeline. Nothing here reads Directus or
 * scores a candidate.
 */

/** Sidebar bands. A posting's own level maps to its band's lower bound. */
export const EXP_LEVEL_RANGE: Record<string, [number, number]> = {
  ENTRY: [0, 1],
  JUNIOR: [0, 2],
  MID: [3, 5],
  SENIOR: [6, 99],
  MANAGER: [7, 99],
  EXECUTIVE: [10, 99],
};

/**
 * Attaches that only feed a low-weight bonus evaluator. Their absence costs a
 * section of a profile, not the search, so they are the only reads allowed to
 * degrade — and each one is named to the recruiter in plain words.
 */
export const OPTIONAL_SECTIONS: Record<string, string> = {
  vs_certifications: "Certifications",
  vs_user_social_links: "Portfolio and social links",
};

/** Query text, AI payloads and candidate names stay out of production logs. */
export function debugLog(...args: unknown[]): void {
  if (process.env.NODE_ENV !== "production") console.log(...args);
}

/**
 * One line per pipeline layer, so a dev run reads as the decisions the search
 * made rather than only their timings. Development only, like `debugLog`: the
 * production trace is the single JSON line, and candidate identity never
 * reaches it.
 *
 * `stats` values stay primitives — pass a length, not the array.
 */
export function layerLog(
  layer: string,
  detail: string,
  stats?: Record<string, string | number | boolean | null | undefined>
): void {
  if (process.env.NODE_ENV === "production") return;
  const tail = stats
    ? Object.entries(stats)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => " " + key + "=" + value)
        .join("")
    : "";
  console.log("[talent-search] " + layer.padEnd(10) + "| " + detail + tail);
}

/**
 * Skills, location and school filters arrive as repeated query params so a
 * single value may itself contain a comma.
 */
export function getListParam(searchParams: URLSearchParams, name: string): string[] {
  return searchParams.getAll(name).map((value) => value.trim()).filter(Boolean);
}

/**
 * Paging parameters arrive as free text. Invalid, missing,
 * negative, fractional, or non-integer values fall back to
 * the supplied default.
 */
export function getIntParam(
  searchParams: URLSearchParams,
  name: string,
  fallback: number
): number {
  const value = Number(searchParams.get(name));
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

/**
 * PSGC registers places as "City of Cebu", while profiles free-type "Cebu City".
 * Matching the bare name too keeps a clicked suggestion from returning nothing.
 */
export function locationMatchVariants(location: string): string[] {
  const lowered = location.toLowerCase();
  const bare = lowered.replace(/^(?:city|municipality|province) of /, "");
  return bare === lowered ? [lowered] : [lowered, bare];
}

/** Groups bulk attach rows under the candidate they belong to. */
export function groupByUser<R extends { user_id: number }>(rows: R[]): Map<number, R[]> {
  const byUser = new Map<number, R[]>();
  for (const row of rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    byUser.get(row.user_id)!.push(row);
  }
  return byUser;
}

/**
 * Newest write across the rows that were scanned, used as the coarse freshness
 * stamp on a cached ranking. Unparseable dates are ignored rather than treated
 * as the oldest possible value.
 */
export function newestWriteMs(rows: { updated_at?: string }[]): number | null {
  let newest: number | null = null;
  for (const row of rows) {
    const at = row.updated_at ? Date.parse(row.updated_at) : NaN;
    if (!Number.isNaN(at) && (newest === null || at > newest)) newest = at;
  }
  return newest;
}

// src/modules/vos-admin/request-management/dashboard/school-demand.selectors.ts
//
// Pure unresolved-demand derivation over the existing school-request DTO.
// Every export is a total function over readonly inputs: no React, no fetch,
// no clock reads. Callers inject `now` so age math stays deterministic.
// Name/city/province normalization is display-only and never a write identity.

import type { VsSchoolRequest } from "../types/request.types";

/** One requester identity; numeric and expanded DTO shapes share `id:<n>`. */
export interface RequesterIdentity {
  readonly requesterKey: string;
  readonly requesterId: number | null;
  readonly displayName: string | null;
}

/** Case-preserving display form plus a lowercase display-comparison key. */
export interface NormalizedSchoolDisplay {
  readonly displayName: string;
  readonly displayCity: string | null;
  readonly displayProvince: string | null;
  readonly normalizedKey: string;
}

/** Matched requests for one exact school id; rows stay individually actionable. */
export interface AwaitingSchoolGroup {
  readonly matchedSchoolId: number;
  readonly requests: readonly VsSchoolRequest[];
  readonly requestCount: number; readonly distinctRequesterCount: number;
  readonly requesterKeys: readonly string[];
  readonly displayName: string;
  readonly displayCity: string | null; readonly displayProvince: string | null;
  readonly normalizedKey: string;
  readonly oldestCreatedAt: string | null; readonly latestCreatedAt: string | null;
}

/** Headline unresolved-demand numbers for the dashboard KPI strip. */
export interface SchoolDemandKpis {
  readonly unroutedCount: number; readonly awaitingSchoolCount: number;
  readonly distinctRequesterCount: number;
  readonly oldestUnresolvedAt: string | null; readonly oldestUnresolvedAgeDays: number | null;
}

const DAY_MS = 86_400_000;
const UNKNOWN_REQUESTER: RequesterIdentity = { requesterKey: "unknown", requesterId: null, displayName: null };

/** Trim plus collapse inner whitespace; non-strings and blanks become "". */
function collapsePart(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

/** Display identity for one row: case-preserving display plus lowercase key. */
export function normalizeSchoolDisplay(
  request: Pick<VsSchoolRequest, "requested_school_name" | "city_municipality" | "province">,
): NormalizedSchoolDisplay {
  const displayName = collapsePart(request.requested_school_name);
  const city = collapsePart(request.city_municipality);
  const province = collapsePart(request.province);
  return {
    displayName,
    displayCity: city === "" ? null : city,
    displayProvince: province === "" ? null : province,
    normalizedKey: JSON.stringify([displayName.toLowerCase(), city.toLowerCase(), province.toLowerCase()]),
  };
}

/** Numeric and expanded requester shapes collapse to one `id:<n>` identity. */
export function extractRequesterIdentity(requestedBy: VsSchoolRequest["requested_by"]): RequesterIdentity {
  if (typeof requestedBy === "number") {
    return Number.isInteger(requestedBy)
      ? { requesterKey: `id:${requestedBy}`, requesterId: requestedBy, displayName: null }
      : UNKNOWN_REQUESTER;
  }
  if (typeof requestedBy === "object" && requestedBy !== null && Number.isInteger(requestedBy.user_id)) {
    const display = `${collapsePart(requestedBy.user_fname)} ${collapsePart(requestedBy.user_lname)}`.trim();
    return {
      requesterKey: `id:${requestedBy.user_id}`,
      requesterId: requestedBy.user_id,
      displayName: display === "" ? null : display,
    };
  }
  return UNKNOWN_REQUESTER;
}

/** Exact matched school id, or null when the row names no school. */
function matchedSchoolIdOf(request: VsSchoolRequest): number | null {
  const id = request.matched_school_id;
  return typeof id === "number" && Number.isInteger(id) ? id : null;
}

/** VOS work: every unresolved request, matched or not. */
function isActionableDemand(request: VsSchoolRequest): boolean {
  return request.request_status === "Pending" || request.request_status === "AwaitingOptIn";
}

/** Unmatched queue in input order: Pending or claims with no matched school. */
export function selectUnroutedRequests(requests: readonly VsSchoolRequest[]): readonly VsSchoolRequest[] {
  return requests.filter(
    (request) => isActionableDemand(request) && matchedSchoolIdOf(request) === null
  );
}

/** Millis for a valid timestamp, else null; invalid dates never throw. */
function timeOf(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const millis = Date.parse(value);
  return Number.isNaN(millis) ? null : millis;
}

/** Oldest-first row order; invalid dates sort last, ties break by row id. */
function byOldestFirst(a: VsSchoolRequest, b: VsSchoolRequest): number {
  const aTime = timeOf(a.created_at);
  const bTime = timeOf(b.created_at);
  if (aTime !== null && bTime !== null && aTime !== bTime) return aTime - bTime;
  if (aTime !== null) return -1;
  if (bTime !== null) return 1;
  return a.school_request_id - b.school_request_id;
}

/** Matched Pending or AwaitingOptIn requests, grouped by exact school id. Count */
/** desc, oldest asc (dateless last), display key, then numeric school id ascending. */
export function groupAwaitingAccountDemand(requests: readonly VsSchoolRequest[]): readonly AwaitingSchoolGroup[] {
  const buckets = new Map<number, VsSchoolRequest[]>();
  for (const request of requests) {
    if (request.request_status !== "Pending" && request.request_status !== "AwaitingOptIn") continue;
    const id = matchedSchoolIdOf(request);
    if (id === null) continue;
    const bucket = buckets.get(id);
    if (bucket === undefined) buckets.set(id, [request]);
    else bucket.push(request);
  }
  const groups: AwaitingSchoolGroup[] = [];
  for (const [matchedSchoolId, rows] of buckets) {
    const ordered = [...rows].sort(byOldestFirst);
    const seen = new Set<string>();
    const requesterKeys: string[] = [];
    let oldestCreatedAt: string | null = null;
    let latestCreatedAt: string | null = null;
    for (const row of ordered) {
      const key = extractRequesterIdentity(row.requested_by).requesterKey;
      if (!seen.has(key)) { seen.add(key); requesterKeys.push(key); }
      if (timeOf(row.created_at) === null) continue;
      if (oldestCreatedAt === null) oldestCreatedAt = row.created_at;
      latestCreatedAt = row.created_at;
    }
    const representative = ordered.find(() => true);
    if (representative === undefined) continue;
    const display = normalizeSchoolDisplay(representative);
    groups.push({
      matchedSchoolId, requests: ordered, requestCount: ordered.length,
      distinctRequesterCount: requesterKeys.length, requesterKeys,
      displayName: display.displayName, displayCity: display.displayCity,
      displayProvince: display.displayProvince, normalizedKey: display.normalizedKey,
      oldestCreatedAt, latestCreatedAt,
    });
  }
  return groups.sort((a, b) => {
    if (a.requestCount !== b.requestCount) return b.requestCount - a.requestCount;
    const aOldest = timeOf(a.oldestCreatedAt);
    const bOldest = timeOf(b.oldestCreatedAt);
    if (aOldest !== null && bOldest !== null && aOldest !== bOldest) return aOldest - bOldest;
    if (aOldest !== null) return -1;
    if (bOldest !== null) return 1;
    if (a.normalizedKey !== b.normalizedKey) return a.normalizedKey < b.normalizedKey ? -1 : 1;
    return a.matchedSchoolId - b.matchedSchoolId;
  });
}

/** Headline KPIs over unresolved rows with a caller-injected clock. */
export function deriveSchoolDemandKpis(
  requests: readonly VsSchoolRequest[],
  now: number | string | Date,
): SchoolDemandKpis {
  const clock = typeof now === "number" ? now : typeof now === "string" ? Date.parse(now) : now.getTime();
  const seen = new Set<string>();
  let oldestUnresolvedAt: string | null = null;
  let oldestMillis: number | null = null;
  for (const request of requests) {
    if (!isActionableDemand(request)) continue;
    seen.add(extractRequesterIdentity(request.requested_by).requesterKey);
    const millis = timeOf(request.created_at);
    if (millis === null) continue;
    if (oldestMillis === null || millis < oldestMillis) { oldestMillis = millis; oldestUnresolvedAt = request.created_at; }
  }
  const validClock = typeof clock === "number" && !Number.isNaN(clock) ? clock : null;
  return {
    unroutedCount: selectUnroutedRequests(requests).length,
    awaitingSchoolCount: groupAwaitingAccountDemand(requests).length,
    distinctRequesterCount: seen.size, oldestUnresolvedAt,
    oldestUnresolvedAgeDays:
      oldestMillis === null || validClock === null
        ? null
        : Math.max(0, Math.floor((validClock - oldestMillis) / DAY_MS)),
  };
}

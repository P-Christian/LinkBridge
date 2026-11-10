// src/lib/server/paging.ts
//
// Caller-supplied paging bounds come straight from the query string and are
// interpolated into Directus filter URLs, so every route that pages must clamp
// them the same way: `?limit=-1` must not dump a whole table and a negative
// offset must not shift the sort.

/** Message threads: default and ceiling for `?limit=`. */
export const MESSAGE_PAGE_DEFAULT_LIMIT = 50;
export const MESSAGE_PAGE_MAX_LIMIT = 100;

export function clampInt(
  value: string | null | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/** Clamped `limit`/`offset` pair for a thread-style list. */
export function pageParams(searchParams: URLSearchParams): {
  limit: number;
  offset: number;
} {
  return {
    limit: clampInt(
      searchParams.get("limit"),
      MESSAGE_PAGE_DEFAULT_LIMIT,
      1,
      MESSAGE_PAGE_MAX_LIMIT
    ),
    offset: clampInt(searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER),
  };
}

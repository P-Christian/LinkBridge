// src/modules/client/talent-search/utils/filterMatching.ts

/**
 * Shared by the suggestions API and the browser-side registry cache so a
 * recruiter sees the same ordering whichever one answered.
 */
export function rankByRelevance<T>(rows: T[], getText: (row: T) => string, term: string): T[] {
  const needle = term.toLowerCase();
  const weight = (row: T): number => {
    const text = getText(row).trim().toLowerCase();
    if (text === needle) return 0;
    if (text.startsWith(needle)) return 1;
    if (text.split(/\s+/).some((token) => token.startsWith(needle))) return 2;
    return 3;
  };
  return [...rows].sort(
    (a, b) => weight(a) - weight(b) || getText(a).localeCompare(getText(b))
  );
}

/** Substring recall (mirrors Directus `_icontains`) ordered by relevance. */
export function filterAndRank<T>(
  rows: T[],
  getText: (row: T) => string,
  term: string,
  limit: number
): T[] {
  const needle = term.toLowerCase();
  const matched = rows.filter((row) => getText(row).toLowerCase().includes(needle));
  return rankByRelevance(matched, getText, term).slice(0, limit);
}

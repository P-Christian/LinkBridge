"use client";

// src/modules/client/talent-search/hooks/useTalentSearch.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  TalentCard,
  TalentFilters,
  TalentSort,
  EMPTY_FILTERS,
  RoleTaxonomyContext,
} from "../types";
import {
  buildTalentSearchParams,
  parseTalentSearchQuery,
  toShareableSearch,
} from "../utils/talentUtils";

const DEFAULT_LIMIT = 20;
const DEFAULT_SORT: TalentSort = "relevance";

interface SearchOverrides {
  filters?: TalentFilters;
  page?: number;
  jobId?: string;
  limit?: number;
  sort?: TalentSort;
  append?: boolean;
}

/**
 * Keeps the address bar in step with the query that produced the page, so a
 * search survives a reload and can be pasted to a colleague.
 */
function writeSearchUrl(
  filters: TalentFilters,
  page: number,
  limit: number,
  jobId: string,
  sort: TalentSort
): void {
  const query = toShareableSearch(
    buildTalentSearchParams(filters, page, limit, jobId || undefined, sort)
  );
  const { pathname } = window.location;
  window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
}

export function useTalentSearch(initialQuery: string) {
  const initial = useMemo(() => parseTalentSearchQuery(initialQuery), [initialQuery]);

  const [talents, setTalents] = useState<TalentCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initial.page);
  const [limit, setLimit] = useState(initial.limit);
  const [sort, setSort] = useState<TalentSort>(initial.sort);
  const [hasSearched, setHasSearched] = useState(false);
  const [aiReranked, setAiReranked] = useState(false);

  const [filters, setFilters] = useState<TalentFilters>(initial.filters);
  const [jobIdForMatch, setJobIdForMatch] = useState("");
  const [searchContext, setSearchContext] = useState<RoleTaxonomyContext | null>(null);

  // Pager clicks and filter edits each start a request, and any of them can
  // answer last. Only the most recent one may write, otherwise the grid ends up
  // showing a page the user already left.
  const searchSeqRef = useRef(0);

  // Paging runs a search per page turn, so a scan-truncation warning from the
  // server is shown once per distinct message rather than stacked per page.
  const warnedRef = useRef("");

  const search = useCallback(
    async (overrides: SearchOverrides = {}) => {
      const activeFilters = overrides.filters ?? filters;
      const activePage = overrides.page ?? page;
      const activeJobId = overrides.jobId ?? jobIdForMatch;
      const activeLimit = overrides.limit ?? limit;
      const activeSort = overrides.sort ?? sort;
      const isAppend = Boolean(overrides.append);

      const seq = ++searchSeqRef.current;
      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const params = buildTalentSearchParams(
          activeFilters,
          activePage,
          activeLimit,
          activeJobId || undefined,
          activeSort
        );

        const res = await fetch(`/api/client/talent-search?${params.toString()}`);
        const json = await res.json();

        if (seq !== searchSeqRef.current) return;
        if (!res.ok) {
          throw new Error(json.error || "Failed to load talent.");
        }

        const newTalents: TalentCard[] = json.talents ?? [];
        setTalents((prev) => {
          if (!isAppend) return newTalents;
          const existingIds = new Set(prev.map((t) => t.user_id));
          const uniqueNew = newTalents.filter((t) => !existingIds.has(t.user_id));
          return [...prev, ...uniqueNew];
        });
        setTotal(json.total ?? 0);
        setSearchContext(json.search_context ?? null);
        setAiReranked(Boolean(json.ai_reranked));
        setPage(activePage);
        setHasSearched(true);
        writeSearchUrl(activeFilters, activePage, activeLimit, activeJobId, activeSort);

        const warnings: string[] = Array.isArray(json.warnings)
          ? (json.warnings as string[])
          : [];
        const joined = warnings.join(" ");
        if (joined && joined !== warnedRef.current) {
          warnedRef.current = joined;
          warnings.forEach((w) => toast.warning(w));
        }
      } catch (err: unknown) {
        if (seq !== searchSeqRef.current) return;
        const msg = err instanceof Error ? err.message : "Failed to load talent.";
        // The previous answer set belongs to a different query, so leaving it
        // on screen would present it as though it answered this one.
        if (!isAppend) {
          setTalents([]);
          setTotal(0);
          setSearchContext(null);
          setAiReranked(false);
          setError(msg);
        }
        toast.error(msg);
      } finally {
        if (seq === searchSeqRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [filters, page, jobIdForMatch, limit, sort]
  );

  const updateFilter = useCallback(
    <K extends keyof TalentFilters>(key: K, value: TalentFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  /**
   * A shared link is the query, so it is also the thing to run: the first render
   * shows the skeleton rather than an empty screen asking for a click.
   *
   * Two details are load-bearing. The request is scheduled, not called inline,
   * because `search` sets `loading` synchronously and an effect may not do that.
   * And it is keyed on `initialQuery` alone behind a latest-callback ref: dev
   * StrictMode runs this effect twice and clears the first timer, so a ref that
   * latched "already ran" would cancel the only search that ever got scheduled.
   */
  const runRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    runRef.current = search;
  });

  useEffect(() => {
    if (!initialQuery.trim()) return;
    const startTimer = setTimeout(() => void runRef.current?.(), 0);
    return () => clearTimeout(startTimer);
  }, [initialQuery]);

  /**
   * The panel's "Clear filters" empties every filter but keeps the keyword and
   * the chosen order, and the panel only re-runs on Apply — so six setState calls
   * alone would leave the grid showing the filtered page, page number included.
   * The cleared filters are passed straight to `search` because the `search`
   * callback still closes over the pre-clear `filters` within this tick.
   */
  const clearFilters = useCallback(() => {
    const cleared: TalentFilters = {
      ...filters,
      skills: [],
      locations: [],
      experience_level: "",
      experience_levels: [],
      schools: [],
      work_setups: [],
    };
    setFilters(cleared);
    void search({ filters: cleared, page: 1 });
  }, [filters, search]);

  /** Changing the order or the page size re-runs from page 1; deep pages of a
   *  different-sized list are not the same list. */
  const changeSort = useCallback(
    (next: TalentSort) => {
      setSort(next);
      void search({ sort: next, page: 1 });
    },
    [search]
  );

  const changeLimit = useCallback(
    (next: number) => {
      setLimit(next);
      void search({ limit: next, page: 1 });
    },
    [search]
  );

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setLimit(DEFAULT_LIMIT);
    setSort(DEFAULT_SORT);
    setJobIdForMatch("");
    setTalents([]);
    setTotal(0);
    setSearchContext(null);
    setAiReranked(false);
    setHasSearched(false);
    setLoadingMore(false);
    setError("");
    warnedRef.current = "";
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const totalPages = Math.ceil(total / limit);
  const hasMore = talents.length < total;

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    void search({ page: page + 1, append: true });
  }, [loading, loadingMore, hasMore, page, search]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      void search({ page: newPage });
    },
    [search]
  );

  /** Toggle saved state optimistically */
  const toggleSaved = useCallback((userId: number, isSaved: boolean) => {
    setTalents((prev) =>
      prev.map((t) => (t.user_id === userId ? { ...t, is_saved: isSaved } : t))
    );
  }, []);

  return {
    talents,
    loading,
    loadingMore,
    error,
    total,
    searchContext,
    aiReranked,
    page,
    totalPages,
    limit,
    sort,
    hasSearched,
    hasMore,
    filters,
    jobIdForMatch,
    setJobIdForMatch,
    updateFilter,
    search,
    loadMore,
    clearFilters,
    changeSort,
    changeLimit,
    resetFilters,
    handlePageChange,
    toggleSaved,
  };
}

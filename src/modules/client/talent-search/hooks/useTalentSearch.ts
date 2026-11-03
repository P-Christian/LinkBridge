"use client";

// src/modules/client/talent-search/hooks/useTalentSearch.ts

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { TalentCard, TalentFilters, EMPTY_FILTERS } from "../types";
import { buildTalentSearchParams } from "../utils/talentUtils";

const PAGE_LIMIT = 20;

export function useTalentSearch() {
  const [talents, setTalents] = useState<TalentCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);

  const [filters, setFilters] = useState<TalentFilters>(EMPTY_FILTERS);
  const [jobIdForMatch, setJobIdForMatch] = useState("");

  // Pager clicks and filter edits each start a request, and any of them can
  // answer last. Only the most recent one may write, otherwise the grid ends up
  // showing a page the user already left.
  const searchSeqRef = useRef(0);

  // Paging runs a search per page turn, so a scan-truncation warning from the
  // server is shown once per distinct message rather than stacked per page.
  const warnedRef = useRef("");

  const search = useCallback(
    async (overrideFilters?: TalentFilters, overridePage?: number, overrideJobId?: string) => {
      const activeFilters = overrideFilters ?? filters;
      const activePage = overridePage ?? page;
      const activeJobId = overrideJobId ?? jobIdForMatch;

      const seq = ++searchSeqRef.current;
      setLoading(true);
      setError("");

      try {
        const params = buildTalentSearchParams(
          activeFilters,
          activePage,
          PAGE_LIMIT,
          activeJobId || undefined
        );

        const res = await fetch(`/api/client/talent-search?${params.toString()}`);
        const json = await res.json();

        if (seq !== searchSeqRef.current) return;
        if (!res.ok) {
          throw new Error(json.error || "Failed to load talent.");
        }

        setTalents(json.talents ?? []);
        setTotal(json.total ?? 0);
        setPage(activePage);
        setHasSearched(true);

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
        setError(msg);
        toast.error(msg);
      } finally {
        if (seq === searchSeqRef.current) setLoading(false);
      }
    },
    [filters, page, jobIdForMatch]
  );

  const updateFilter = useCallback(
    <K extends keyof TalentFilters>(key: K, value: TalentFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setJobIdForMatch("");
    setTalents([]);
    setTotal(0);
    setHasSearched(false);
    setError("");
    warnedRef.current = "";
  }, []);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      search(undefined, newPage);
    },
    [search]
  );

  /** Toggle saved state optimistically */
  const toggleSaved = useCallback((userId: number, isSaved: boolean) => {
    setTalents((prev) =>
      prev.map((t) => (t.user_id === userId ? { ...t, is_saved: isSaved } : t))
    );
  }, []);

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return {
    talents,
    loading,
    error,
    total,
    page,
    totalPages,
    hasSearched,
    filters,
    jobIdForMatch,
    setJobIdForMatch,
    updateFilter,
    search,
    resetFilters,
    handlePageChange,
    toggleSaved,
    PAGE_LIMIT,
  };
}

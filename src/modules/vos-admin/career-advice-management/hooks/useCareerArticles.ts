"use client";

// src/modules/vos-admin/career-advice-management/hooks/useCareerArticles.ts
import { useState, useEffect, useCallback } from "react";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import { CareerArticle, ArticleFilters, PaginatedArticlesResponse } from "../types/article.types";

interface UseCareerArticlesReturn {
  articles: CareerArticle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  filters: ArticleFilters;
  setFilters: React.Dispatch<React.SetStateAction<ArticleFilters>>;
  refresh: () => Promise<void>;
  updateFilter: <K extends keyof ArticleFilters>(key: K, value: ArticleFilters[K]) => void;
}

export function useCareerArticles(initialFilters?: Partial<ArticleFilters>): UseCareerArticlesReturn {
  const [filters, setFilters] = useState<ArticleFilters>({
    page: 1,
    limit: 10,
    status: "ALL",
    category: "ALL",
    sort_by: "created_at",
    sort_order: "desc",
    search: "",
    ...initialFilters,
  });

  const [data, setData] = useState<PaginatedArticlesResponse>({
    articles: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const abortRead = useRequestAbort();

  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const signal = abortRead();
    try {
      const queryParams = new URLSearchParams();
      if (filters.page) queryParams.set("page", String(filters.page));
      if (filters.limit) queryParams.set("limit", String(filters.limit));
      if (filters.status && filters.status !== "ALL") queryParams.set("status", filters.status);
      if (filters.category && filters.category !== "ALL") queryParams.set("category", filters.category);
      if (filters.search) queryParams.set("search", filters.search);
      if (filters.sort_by) queryParams.set("sort_by", filters.sort_by);
      if (filters.sort_order) queryParams.set("sort_order", filters.sort_order);

      const res = await fetch(`/api/vos-admin/career-articles?${queryParams.toString()}`, { signal });
      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      if (signal.aborted) return;
      setData(json);
    } catch (err: unknown) {
      if (signal.aborted) return;
      console.error("[useCareerArticles] fetch error:", err);
      const message = err instanceof Error ? err.message : "Failed to load articles";
      setError(message);
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [filters, abortRead]);

  useEffect(() => {
    // The rule reads through the useCallback; the only synchronous state here is
    // the "loading" flag the fetch itself needs before its first await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchArticles();
  }, [fetchArticles]);

  const updateFilter = useCallback(<K extends keyof ArticleFilters>(key: K, value: ArticleFilters[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === "page" ? (value as number) : 1, // Reset to page 1 on search/filter update
    }));
  }, []);

  return {
    articles: data.articles,
    total: data.total,
    page: data.page,
    limit: data.limit,
    totalPages: data.totalPages,
    isLoading,
    error,
    filters,
    setFilters,
    refresh: fetchArticles,
    updateFilter,
  };
}

"use client";

// src/modules/client/talent-search/hooks/useFilterSuggestions.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { FilterSuggestion, FilterSuggestionType } from "../types";
import { loadFilterRegistry, searchFilterRegistry } from "../utils/filterRegistry";

const ENDPOINT = "/api/client/talent-search/suggestions";
const DEBOUNCE_MS = 250;
/** Registry lookups below this length are too noisy to be useful. */
export const MIN_SUGGESTION_TERM = 2;

interface SuggestionState {
  /** Verbatim input, so trailing spaces survive while typing. */
  query: string;
  /** Trimmed term currently in flight; empty until it clears MIN_SUGGESTION_TERM. */
  term: string;
  items: FilterSuggestion[];
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: SuggestionState = {
  query: "",
  term: "",
  items: [],
  loading: false,
  error: null,
};

function toError(reason: "response" | "network"): string {
  return reason === "network"
    ? "Could not reach the suggestion service."
    : "No suggestions came back. Please try again.";
}

interface CacheEntry {
  expiresAt: number;
  items: FilterSuggestion[];
}

/**
 * Backspace/retype is the dominant pattern in a typeahead, and the desktop
 * sidebar plus the mobile filter panel mount two instances of every field, so
 * terms are memoised here before they ever reach the network.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_TERMS = 80;
const suggestionCache = new Map<string, CacheEntry>();

function cacheKey(type: FilterSuggestionType, term: string): string {
  return `${type}|${term.toLowerCase()}`;
}

function readCache(key: string): FilterSuggestion[] | null {
  const hit = suggestionCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    suggestionCache.delete(key);
    return null;
  }
  return hit.items;
}

function writeCache(key: string, items: FilterSuggestion[]): void {
  suggestionCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, items });
  // Map iterates in insertion order, so the oldest terms are dropped first.
  for (const staleKey of suggestionCache.keys()) {
    if (suggestionCache.size <= CACHE_MAX_TERMS) break;
    suggestionCache.delete(staleKey);
  }
}

export function useFilterSuggestions(type: FilterSuggestionType) {
  const [state, setState] = useState<SuggestionState>(INITIAL_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The effect only cancels the pending timer on unmount; every state change is
  // driven from the input handler, which keeps the debounce out of render.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  // Page load warms the shared registry, and a dropdown already open re-filters
  // from it the moment the snapshot lands.
  useEffect(() => {
    void loadFilterRegistry().then(() => {
      setState((prev) => {
        const local =
          prev.term.length >= MIN_SUGGESTION_TERM ? searchFilterRegistry(type, prev.term) : null;
        return local ? { ...prev, items: local, loading: false, error: null } : prev;
      });
    });
  }, [type]);

  const request = useCallback(
    async (term: string) => {
      const key = cacheKey(type, term);
      const cached = readCache(key);
      if (cached) {
        setState((prev) =>
          prev.term !== term ? prev : { ...prev, items: cached, loading: false, error: null }
        );
        return;
      }

      try {
        const res = await fetch(`${ENDPOINT}?type=${type}&q=${encodeURIComponent(term)}`);
        const json = (await res.json()) as {
          suggestions?: FilterSuggestion[];
          error?: string;
        };
        const items = Array.isArray(json.suggestions) ? json.suggestions : [];
        const error = json.error ?? (res.ok ? null : toError("response"));
        if (res.ok && !error) writeCache(key, items);
        setState((prev) =>
          // Drop responses for a term the recruiter has already typed past.
          prev.term !== term ? prev : { ...prev, items, loading: false, error }
        );
      } catch {
        setState((prev) =>
          prev.term !== term ? prev : { ...prev, items: [], loading: false, error: toError("network") }
        );
      }
    },
    [type]
  );

  const setQuery = useCallback(
    (value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const term = value.trim();

      if (term.length < MIN_SUGGESTION_TERM) {
        setState({ query: value, term: "", items: [], loading: false, error: null });
        return;
      }

      const cached = readCache(cacheKey(type, term));
      if (cached) {
        setState({ query: value, term, items: cached, loading: false, error: null });
        return;
      }

      // Skills and locations live in the preloaded snapshot, so they answer
      // synchronously; only schools still needs the debounced round trip.
      const local = searchFilterRegistry(type, term);
      if (local) {
        setState({ query: value, term, items: local, loading: false, error: null });
        return;
      }

      setState({ query: value, term, items: [], loading: true, error: null });
      timerRef.current = setTimeout(() => {
        void request(term);
      }, DEBOUNCE_MS);
    },
    [request, type]
  );

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState(INITIAL_STATE);
  }, []);

  return {
    query: state.query,
    suggestions: state.items,
    loading: state.loading,
    error: state.error,
    setQuery,
    reset,
  };
}

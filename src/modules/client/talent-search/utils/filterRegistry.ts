"use client";

// src/modules/client/talent-search/utils/filterRegistry.ts

import { FilterSuggestion, FilterSuggestionType } from "../types";
import { filterAndRank } from "./filterMatching";

const ENDPOINT = "/api/client/talent-search/suggestions";
const RESPONSE_LIMIT = 20;

interface FilterRegistry {
  skills: string[];
  locations: FilterSuggestion[];
}

let registry: FilterRegistry | null = null;
let inflight: Promise<FilterRegistry | null> | null = null;

/**
 * The whole `vs_master_skills` table and the PSGC place list are pulled once per
 * page load; skills and location typing then filter this snapshot in memory.
 */
export function loadFilterRegistry(): Promise<FilterRegistry | null> {
  if (registry) return Promise.resolve(registry);
  if (!inflight) {
    inflight = fetch(`${ENDPOINT}?type=registry`, { cache: "default" })
      .then((res) => (res.ok ? (res.json() as Promise<FilterRegistry>) : null))
      .then((payload) => {
        if (!payload || !Array.isArray(payload.skills) || !Array.isArray(payload.locations)) {
          return null;
        }
        registry = payload;
        return registry;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Returns null while the snapshot is absent, so callers fall back to the API. */
export function searchFilterRegistry(
  type: FilterSuggestionType,
  term: string
): FilterSuggestion[] | null {
  if (!registry || type === "schools") return null;

  if (type === "skills") {
    return filterAndRank(registry.skills, (name) => name, term, RESPONSE_LIMIT).map((name) => ({
      value: name,
      label: name,
      hint: null,
    }));
  }
  return filterAndRank(registry.locations, (item) => item.label, term, RESPONSE_LIMIT);
}

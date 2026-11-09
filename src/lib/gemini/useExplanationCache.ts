// src/lib/gemini/useExplanationCache.ts

const CACHE_PREFIX = "vos_ai_exp_";

function buildCacheKey(keyword: string | undefined | null, userId: number): string {
  const normKey = (keyword || "").trim().toLowerCase() || "__suitability__";
  return `${CACHE_PREFIX}${normKey}_${userId}`;
}

export function getCachedExplanation(keyword: string | undefined | null, userId: number): string | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const key = buildCacheKey(keyword, userId);
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setCachedExplanation(keyword: string | undefined | null, userId: number, explanation: string): void {
  if (typeof window === "undefined" || !userId || !explanation) return;
  try {
    const key = buildCacheKey(keyword, userId);
    sessionStorage.setItem(key, explanation);
  } catch {
    // Ignore storage quota errors
  }
}

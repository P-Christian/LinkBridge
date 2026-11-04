// src/lib/rate-limit.ts
import { NextResponse } from "next/server";

interface WindowEntry {
  requests: number;
  resetAt: number;
}

/**
 * Process-local, bounded fixed-window counter. It is an abuse barrier for
 * single-instance deployments, not a distributed guarantee; a Redis-backed
 * limiter can replace it without changing the call sites.
 */
const MAX_TRACKED_KEYS = 10_000;
const windows = new Map<string, WindowEntry>();

/**
 * First hop of `x-forwarded-for`, falling back to `x-real-ip`. Both are
 * attacker-controlled when this app is reached directly, so this identity is
 * only ever one of two buckets — the account or token identity is the other.
 */
export function getClientIp(request: { headers: Headers }): string {
  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedIp || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function evictOldest(): void {
  for (const [key, entry] of windows) {
    if (entry.resetAt <= Date.now()) windows.delete(key);
  }
  if (windows.size < MAX_TRACKED_KEYS) return;
  const oldest = windows.keys().next();
  if (!oldest.done) windows.delete(oldest.value);
}

/**
 * Consume one unit of `scope`'s budget for `identity`.
 *
 * @returns `0` when the request is allowed, otherwise the milliseconds left in
 * the window that blocked it.
 */
export function rateLimitRetryAfterMs(
  scope: string,
  identity: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): number {
  const key = `${scope}|${String(identity).toLowerCase()}`;
  const current = windows.get(key);

  if (!current || current.resetAt <= now) {
    if (!current && windows.size >= MAX_TRACKED_KEYS) evictOldest();
    windows.set(key, { requests: 1, resetAt: now + windowMs });
    return 0;
  }

  if (current.requests >= limit) return Math.max(0, current.resetAt - now);
  current.requests += 1;
  return 0;
}

/** 429 in the `{ ok, message }` shape every auth endpoint already returns. */
export function tooManyRequestsResponse(retryAfterMs: number): NextResponse {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return NextResponse.json(
    {
      ok: false,
      message: `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
      retry_after_seconds: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    }
  );
}

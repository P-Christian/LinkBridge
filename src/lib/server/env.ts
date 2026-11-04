// src/lib/server/env.ts
// Server-only. Bundling DIRECTUS_STATIC_TOKEN into a client chunk would leak it,
// so the whole directory asserts its boundary once at import time.
if (typeof window !== "undefined") {
  throw new Error("@/lib/server/* is server-only and must not be imported from client code.");
}

/**
 * `.env.local` carries trailing `# …` notes on these lines, which roughly six
 * route files already strip by hand. Next.js removes them at load time but a
 * plain Node process does not, so the shared helper has to be the safe one.
 */
function sanitizeEnv(value: string | undefined): string {
  return (value ?? "").split("#")[0].trim();
}

/**
 * Resolves the Directus base URL. `NEXT_PUBLIC_API_BASE_URL` wins because ~129
 * call sites already read it first; `DIRECTUS_URL` is kept as the fallback that
 * the module services (education-verification, school-request-routing,
 * pipeline) expect. Trailing slash is stripped so `/items/...` concatenation is
 * safe.
 */
export function directusBase(): string {
  return sanitizeEnv(
    process.env.NEXT_PUBLIC_API_BASE_URL || process.env.DIRECTUS_URL
  ).replace(/\/+$/, "");
}

export function directusToken(): string | undefined {
  const token = sanitizeEnv(process.env.DIRECTUS_STATIC_TOKEN);
  return token || undefined;
}

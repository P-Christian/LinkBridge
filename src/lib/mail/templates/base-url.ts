// src/lib/mail/templates/base-url.ts

/**
 * Asynchronously resolves the base URL by inspecting incoming request headers
 * (e.g. Next.js headers(), x-forwarded-host, origin, referer) so links dynamically
 * match whatever client URL / tunnel / domain was used to trigger the action.
 */
export async function resolveBaseUrl(explicitBaseUrl?: string): Promise<string> {
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  try {
    const { headers } = await import("next/headers");
    const h = await headers();

    // 1. Origin header (sent by fetch / browser client)
    const origin = h.get("origin");
    if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
      return origin.replace(/\/$/, "");
    }

    // 2. x-forwarded-host / host (e.g., msi-lo.tail054015.ts.net from Tailscale or proxy)
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
      const proto =
        h.get("x-forwarded-proto") ||
        (h.get("x-forwarded-ssl") === "on" ? "https" : "https");
      return `${proto}://${host}`.replace(/\/$/, "");
    }

    // 3. Referer header (fallback to origin of the page that submitted the form)
    const referer = h.get("referer");
    if (referer) {
      try {
        const parsed = new URL(referer);
        if (!parsed.hostname.includes("localhost") && !parsed.hostname.includes("127.0.0.1")) {
          return parsed.origin.replace(/\/$/, "");
        }
      } catch {
        // Ignore URL parsing errors
      }
    }

    // 4. If host header is present even on local port (e.g. localhost:4000 vs 3000)
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ||
        (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  } catch {
    // Outside active request context or next/headers unavailable
  }

  return getBaseUrl();
}

/**
 * Synchronous fallback resolver.
 */
export function getBaseUrl(explicitBaseUrl?: string): string {
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function getReferralBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL is required to generate referral links.");
  }
  return "http://localhost:4000";
}

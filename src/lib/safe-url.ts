// src/lib/safe-url.ts
// Unauthenticated pages render employer/candidate-supplied strings as anchors, so only
// these schemes may reach an href. Anything else (javascript:, data:, vbscript:, file:,
// a protocol-relative or app-relative value) returns null and must render as plain text.
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function safeUrl(url: string | null | undefined): string | null {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Bare hosts ("company.com") have always been meant as https links.
    try {
      parsed = new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
  if ((parsed.protocol === "http:" || parsed.protocol === "https:") && !parsed.hostname) return null;

  return parsed.toString();
}

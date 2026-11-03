// src/lib/mail/templates/escape-html.ts
/**
 * PRIV-007: outbound emails are HTML, and every value interpolated into a
 * template body is data supplied by a principal (candidate name, employer
 * company name, job title, free-text notes, feedback, rejection reasons).
 * Templates must therefore escape at the entry of each interpolated value.
 *
 * The only values that may be injected raw are fragments the template itself
 * builds as markup (see `renderMeetingLink` in templates/interview.ts).
 */
export function escapeHtml(value?: string | number | null): string {
  if (!value) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Attribute-safe absolute http(s) URL for an `href`, or null when the value is
 * not one. Principal-supplied links (meeting links, admin-supplied login URLs)
 * go through this so a `javascript:`/`data:`/`file:` payload can never become a
 * clickable anchor; callers fall back to rendering the escaped text instead.
 */
export function safeHttpUrl(value?: string | number | null): string | null {
  const raw = value === null || value === undefined ? "" : String(value).trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return escapeHtml(parsed.toString());
  } catch {
    return null;
  }
}

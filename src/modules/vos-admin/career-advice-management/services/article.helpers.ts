// src/modules/vos-admin/career-advice-management/services/article.helpers.ts

export const DEFAULT_CAREER_CATEGORIES = [
  "Resume Tips",
  "Interview Prep",
  "Salary Guides",
  "Career Strategy",
  "Remote Work",
  "Leadership",
  "Freelancing",
  "Job Search",
  "Skill Building",
] as const;

/**
 * Generates an SEO-safe slug from a title string.
 * Example: "How to Ace Your 2025 Interview!" -> "how-to-ace-your-2025-interview"
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove special characters
    .replace(/[\s_-]+/g, "-")  // collapse whitespace and hyphens
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}

/**
 * Calculates estimated read time in minutes based on average 200 words per minute.
 * Strips HTML tags prior to word counting.
 */
export function calculateReadTime(contentHtmlOrText: string): number {
  if (!contentHtmlOrText) return 1;
  const strippedText = contentHtmlOrText.replace(/<[^>]*>/g, " ");
  const words = strippedText.trim().split(/\s+/).filter(Boolean);
  const wordsPerMinute = 200;
  const minutes = Math.ceil(words.length / wordsPerMinute);
  return Math.max(1, minutes);
}

/**
 * Strips HTML tags and trims to an excerpt max length.
 */
export function createExcerptFromHtml(html: string, maxLength: number = 180): string {
  if (!html) return "";
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

/**
 * Returns the current date-time formatted explicitly as a pure UTC SQL string:
 * "YYYY-MM-DD HH:mm:ss"
 * Prevents local system timezone translation issues in MySQL datetime columns.
 */
export function getUtcNowSqlString(): string {
  const now = new Date();
  return now.toISOString().slice(0, 19).replace("T", " ");
}

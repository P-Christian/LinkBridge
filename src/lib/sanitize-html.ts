// src/lib/sanitize-html.ts
/**
 * Parser-based HTML sanitizer for rich text rendered with
 * `dangerouslySetInnerHTML`.
 *
 * The previous implementation matched tags with a single-pass regex, which
 * cannot model what the browser will parse: `>` is legal inside a quoted
 * attribute, entities decode before the tag is read, and out-of-order stripping
 * can reconstitute a dangerous token. DOMPurify works on a real DOM tree, so
 * what it emits is what the browser sees.
 *
 * `isomorphic-dompurify` resolves to the jsdom-backed build on the server and
 * to the browser build in the client bundle, so one set of rules covers SSR,
 * RSC and client rendering.
 */
import DOMPurify from "isomorphic-dompurify";

const BASIC_ALLOWED_TAGS = [
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "p",
  "br",
  "hr",
  "ul",
  "ol",
  "li",
  "div",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "code",
  "sub",
  "sup",
  "a",
];

// TipTap article bodies also emit images and tables; job descriptions never do,
// so this wider set is only used for the career-advice editor output.
const ARTICLE_ALLOWED_TAGS = [
  ...BASIC_ALLOWED_TAGS,
  "img",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

const ALLOWED_ATTR = [
  "href",
  "target",
  "rel",
  "src",
  "alt",
  "title",
  "colspan",
  "rowspan",
  "class",
];

/**
 * `ALLOWED_URI_REGEXP` is deliberately left alone: DOMPurify then tests it
 * against every attribute value, which silently drops `target="_blank"` and
 * `colspan`. The schemes the app wants are enforced on `href`/`src` in the hook
 * below instead.
 */
const ALLOWED_LINK_URI = /^(?:https?:|mailto:|#|\/(?!\/))/i;
const ALLOWED_IMAGE_URI = /^(?:https?:|\/(?!\/)|data:image\/(?:png|jpe?g|gif|webp);)/i;

const BASE_CONFIG = {
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  WHOLE_DOCUMENT: false,
};

const BASIC_CONFIG = { ...BASE_CONFIG, ALLOWED_TAGS: BASIC_ALLOWED_TAGS };
const ARTICLE_CONFIG = { ...BASE_CONFIG, ALLOWED_TAGS: ARTICLE_ALLOWED_TAGS };

function stripControlChars(value: string): string {
  return value.replace(/[\s\0-\u001f]+/gu, "");
}

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    const href = node.getAttribute("href");
    if (href === null) return;
    if (!ALLOWED_LINK_URI.test(stripControlChars(href))) {
      node.removeAttribute("href");
      return;
    }
    if (node.hasAttribute("target")) {
      node.setAttribute("rel", "noopener noreferrer");
    }
    return;
  }

  if (node.tagName === "IMG") {
    const src = node.getAttribute("src");
    if (src !== null && !ALLOWED_IMAGE_URI.test(stripControlChars(src))) {
      node.removeAttribute("src");
    }
  }
});

function sanitize(
  dirtyHtml: string | null | undefined,
  config: typeof BASIC_CONFIG
): string {
  if (!dirtyHtml || typeof dirtyHtml !== "string") return "";
  return DOMPurify.sanitize(dirtyHtml, config);
}

export function sanitizeHtml(dirtyHtml: string | null | undefined): string {
  return sanitize(dirtyHtml, BASIC_CONFIG);
}

export function sanitizeArticleHtml(dirtyHtml: string | null | undefined): string {
  return sanitize(dirtyHtml, ARTICLE_CONFIG);
}

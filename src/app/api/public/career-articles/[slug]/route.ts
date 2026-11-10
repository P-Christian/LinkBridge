// src/app/api/public/career-articles/[slug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { formatAssetUrl } from "@/lib/utils";
import { safeErrorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (DIRECTUS_TOKEN) headers["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return headers;
}

// Public allowlist: draft/internal columns (status, author_id, ai_generated, updated_at) never leave Directus.
const PUBLIC_ARTICLE_FIELDS = [
  "article_id",
  "title",
  "slug",
  "category",
  "excerpt",
  "content",
  "featured_image_id",
  "featured_image_url",
  "author_name",
  "author_role",
  "read_time_minutes",
  "is_featured",
  "seo_title",
  "seo_description",
  "created_at",
  "published_at",
].join(",");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const queryParams = new URLSearchParams();
    queryParams.append("filter[slug][_eq]", slug);
    queryParams.append("filter[status][_eq]", "PUBLISHED");
    queryParams.append("fields", PUBLIC_ARTICLE_FIELDS);
    queryParams.append("limit", "1");

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_career_articles?${queryParams.toString()}`, {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch article" }, { status: 500 });
    }

    const json = await res.json();
    const article = json.data?.[0];

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Cover image URL is rewritten for the browser; the response stays on the public allowlist.
    const formattedArticle = {
      article_id: article.article_id,
      title: article.title,
      slug: article.slug,
      category: article.category,
      excerpt: article.excerpt,
      content: article.content,
      featured_image_id: article.featured_image_id,
      featured_image_url: formatAssetUrl(article.featured_image_url) || article.featured_image_url,
      author_name: article.author_name,
      author_role: article.author_role,
      read_time_minutes: article.read_time_minutes,
      is_featured: Boolean(article.is_featured === 1 || article.is_featured === true),
      seo_title: article.seo_title,
      seo_description: article.seo_description,
      created_at: article.created_at,
      published_at: article.published_at,
    };

    return NextResponse.json({ data: formattedArticle });
  } catch (err: unknown) {
    console.error("[api/public/career-articles/[slug] GET] Error:", err);
    const message = safeErrorMessage(err, "Failed to load article");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// src/app/api/public/career-articles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { formatAssetUrl } from "@/lib/utils";
import { CareerArticle } from "@/modules/vos-admin/career-advice-management/types/article.types";
import { safeErrorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (DIRECTUS_TOKEN) headers["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return headers;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const limit = Math.min(Math.max(Math.floor(Number(searchParams.get("limit"))) || 12, 1), 50);
    const page = Math.max(Math.floor(Number(searchParams.get("page"))) || 1, 1);
    const offset = (page - 1) * limit;

    const queryParams = new URLSearchParams();
    queryParams.append("limit", String(limit));
    queryParams.append("offset", String(offset));
    queryParams.append("meta", "filter_count");
    queryParams.append("sort", "-published_at,-created_at");

    // Strictly enforce published status for public view
    queryParams.append("filter[status][_eq]", "PUBLISHED");

    if (category && category !== "ALL") {
      queryParams.append("filter[category][_eq]", category);
    }

    if (search && search.trim()) {
      const s = search.trim();
      queryParams.append("filter[_or][0][title][_icontains]", s);
      queryParams.append("filter[_or][1][excerpt][_icontains]", s);
    }

    // Include lightweight fields for cards (exclude huge content body if just listing)
    queryParams.append(
      "fields",
      "article_id,title,slug,category,excerpt,featured_image_url,featured_image_id,author_name,author_role,read_time_minutes,is_featured,published_at,created_at"
    );

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_career_articles?${queryParams.toString()}`, {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 });
    }

    const json = await res.json();
    const rawArticles = json.data || [];
    const total = json.meta?.filter_count ?? rawArticles.length;

    // Normalize asset URLs for browser delivery
    const articles: CareerArticle[] = rawArticles.map((art: CareerArticle) => ({
      ...art,
      featured_image_url: formatAssetUrl(art.featured_image_url) || art.featured_image_url,
      is_featured: Boolean(art.is_featured),
    }));

    // Find the primary featured article
    const featuredArticle = articles.find((a) => a.is_featured) || articles[0] || null;

    return NextResponse.json({
      articles,
      featuredArticle,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err: unknown) {
    console.error("[api/public/career-articles GET] Error:", err);
    const message = safeErrorMessage(err, "Failed to load career articles");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

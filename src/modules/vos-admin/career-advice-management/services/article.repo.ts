// src/modules/vos-admin/career-advice-management/services/article.repo.ts
import { ArticleFilters, CareerArticle, ArticleAsset } from "../types/article.types";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (DIRECTUS_TOKEN) {
    headers["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  }
  return headers;
}

export async function fetchArticlesFromRepo(filters: ArticleFilters): Promise<{ articles: CareerArticle[]; total: number }> {
  const page = Math.max(1, Math.trunc(Number(filters.page)) || 1);
  const limit = Math.min(100, Math.max(1, Math.trunc(Number(filters.limit)) || 10));
  const offset = (page - 1) * limit;

  const queryParams = new URLSearchParams();
  queryParams.append("limit", String(limit));
  queryParams.append("offset", String(offset));
  queryParams.append("meta", "filter_count");

  // Sorting
  const sortDirection = filters.sort_order === "asc" ? "" : "-";
  const sortBy = filters.sort_by || "created_at";
  queryParams.append("sort", `${sortDirection}${sortBy}`);

  // Filtering
  if (filters.status && filters.status !== "ALL") {
    queryParams.append("filter[status][_eq]", filters.status);
  }

  if (filters.category && filters.category !== "ALL") {
    queryParams.append("filter[category][_eq]", filters.category);
  }

  if (typeof filters.is_featured === "boolean") {
    queryParams.append("filter[is_featured][_eq]", filters.is_featured ? "1" : "0");
  }

  if (filters.search && filters.search.trim()) {
    const s = filters.search.trim();
    queryParams.append("filter[_or][0][title][_icontains]", s);
    queryParams.append("filter[_or][1][excerpt][_icontains]", s);
    queryParams.append("filter[_or][2][author_name][_icontains]", s);
  }

  const res = await fetch(`${DIRECTUS_BASE}/items/vs_career_articles?${queryParams.toString()}`, {
    method: "GET",
    headers: getHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch career articles: HTTP ${res.status} - ${errorText}`);
  }

  const json = await res.json();
  const rawArticles = json.data || [];
  const total = json.meta?.filter_count ?? rawArticles.length;

  const articles: CareerArticle[] = rawArticles.map((item: CareerArticle) => ({
    ...item,
    is_featured: Boolean(item.is_featured),
    ai_generated: Boolean(item.ai_generated),
  }));

  return { articles, total };
}

export async function fetchArticleByIdFromRepo(articleId: number): Promise<CareerArticle | null> {
  const res = await fetch(`${DIRECTUS_BASE}/items/vs_career_articles/${articleId}`, {
    method: "GET",
    headers: getHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch article #${articleId}: HTTP ${res.status}`);
  }

  const json = await res.json();
  const item = json.data;
  if (!item) return null;

  // Fetch linked assets from vs_career_article_assets
  const assetsRes = await fetch(
    `${DIRECTUS_BASE}/items/vs_career_article_assets?filter[article_id][_eq]=${articleId}&sort=display_order,created_at&limit=-1`,
    {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    }
  );

  // A failed asset read used to fall through as an empty list, so an editor
  // opened during a CMS outage presented the article as having no images and a
  // save from it could drop them. Only a missing collection is a real "no
  // assets"; anything else has to fail the request.
  if (!assetsRes.ok && assetsRes.status !== 404) {
    const errorText = await assetsRes.text().catch(() => "");
    throw new Error(
      `Failed to fetch assets for article #${articleId}: HTTP ${assetsRes.status} - ${errorText}`
    );
  }

  let assets: ArticleAsset[] = [];
  if (assetsRes.ok) {
    const assetsJson = await assetsRes.json();
    assets = assetsJson.data || [];
  }

  return {
    ...item,
    is_featured: Boolean(item.is_featured === 1 || item.is_featured === true),
    ai_generated: Boolean(item.ai_generated === 1 || item.ai_generated === true),
    assets,
  };
}

export async function createArticleInRepo(data: Partial<CareerArticle>): Promise<CareerArticle> {
  const payload = {
    ...data,
    is_featured: data.is_featured ? 1 : 0,
    ai_generated: data.ai_generated ? 1 : 0,
  };

  const res = await fetch(`${DIRECTUS_BASE}/items/vs_career_articles`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create article: HTTP ${res.status} - ${errorText}`);
  }

  const json = await res.json();
  return {
    ...json.data,
    is_featured: Boolean(json.data.is_featured === 1 || json.data.is_featured === true),
    ai_generated: Boolean(json.data.ai_generated === 1 || json.data.ai_generated === true),
  };
}

export async function updateArticleInRepo(articleId: number, data: Partial<CareerArticle>): Promise<CareerArticle> {
  const payload: Record<string, unknown> = { ...data };
  if ("is_featured" in data) payload.is_featured = data.is_featured ? 1 : 0;
  if ("ai_generated" in data) payload.ai_generated = data.ai_generated ? 1 : 0;

  delete payload.article_id;
  delete payload.assets;

  const res = await fetch(`${DIRECTUS_BASE}/items/vs_career_articles/${articleId}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to update article #${articleId}: HTTP ${res.status} - ${errorText}`);
  }

  const json = await res.json();
  return {
    ...json.data,
    is_featured: Boolean(json.data.is_featured === 1 || json.data.is_featured === true),
    ai_generated: Boolean(json.data.ai_generated === 1 || json.data.ai_generated === true),
  };
}

export async function deleteArticleFromRepo(articleId: number): Promise<boolean> {
  const res = await fetch(`${DIRECTUS_BASE}/items/vs_career_articles/${articleId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!res.ok && res.status !== 404) {
    const errorText = await res.text();
    throw new Error(`Failed to delete article #${articleId}: HTTP ${res.status} - ${errorText}`);
  }

  return true;
}

export async function addAssetToArticleInRepo(asset: Partial<ArticleAsset>): Promise<ArticleAsset> {
  const res = await fetch(`${DIRECTUS_BASE}/items/vs_career_article_assets`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(asset),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to register asset: HTTP ${res.status} - ${errorText}`);
  }

  const json = await res.json();
  return json.data;
}

export async function updateAssetInRepo(assetId: number, data: Partial<ArticleAsset>): Promise<ArticleAsset> {
  const res = await fetch(`${DIRECTUS_BASE}/items/vs_career_article_assets/${assetId}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to update asset #${assetId}: HTTP ${res.status} - ${errorText}`);
  }

  const json = await res.json();
  return json.data;
}

export async function deleteAssetFromRepo(assetId: number): Promise<boolean> {
  const res = await fetch(`${DIRECTUS_BASE}/items/vs_career_article_assets/${assetId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  // The caller ignores the return value and answers the admin with "Asset
  // deleted", so a rejected delete has to throw or the image disappears from
  // the panel while still being served from the article.
  if (!res.ok && res.status !== 404) {
    const errorText = await res.text();
    throw new Error(`Failed to delete asset #${assetId}: HTTP ${res.status} - ${errorText}`);
  }

  return true;
}

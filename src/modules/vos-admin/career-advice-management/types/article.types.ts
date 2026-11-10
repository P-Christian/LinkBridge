// src/modules/vos-admin/career-advice-management/types/article.types.ts

export type ArticleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type AssetRole = "FEATURED_COVER" | "INLINE_BODY" | "GALLERY" | "ATTACHMENT";

export interface ArticleAsset {
  asset_id?: number;
  article_id?: number;
  directus_file_id: string; // char(36) UUID
  file_url: string;
  file_name?: string | null;
  file_type?: string | null;
  file_size_bytes?: number | null;
  asset_role: AssetRole;
  caption?: string | null;
  display_order?: number;
  created_at?: string;
}

export interface CareerArticle {
  article_id: number;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string; // HTML from TipTap
  featured_image_id?: string | null;
  featured_image_url?: string | null;
  author_id?: number | null;
  author_name: string;
  author_role: string;
  read_time_minutes: number;
  status: ArticleStatus;
  is_featured: boolean;
  ai_generated: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
  created_at: string;
  updated_at?: string | null;
  published_at?: string | null;
  assets?: ArticleAsset[];
}

export interface ArticleFilters {
  search?: string;
  category?: string;
  status?: ArticleStatus | "ALL";
  is_featured?: boolean | "ALL";
  page?: number;
  limit?: number;
  sort_by?: "created_at" | "published_at" | "title" | "read_time_minutes";
  sort_order?: "asc" | "desc";
}

export interface PaginatedArticlesResponse {
  articles: CareerArticle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AiAssistRequestPayload {
  action: "generate_draft" | "proofread" | "generate_seo" | "suggest_topics";
  topic?: string;
  category?: string;
  target_audience?: string;
  raw_text?: string;
  title?: string;
  content?: string;
}

export interface AiAssistResponsePayload {
  title?: string;
  slug?: string;
  category?: string;
  excerpt?: string;
  content?: string;
  seo_title?: string;
  seo_description?: string;
  proofread_text?: string;
  suggestions?: string[];
}

// src/modules/vos-admin/career-advice-management/types/article.schema.ts
import { z } from "zod";

export const ArticleStatusEnum = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const AssetRoleEnum = z.enum(["FEATURED_COVER", "INLINE_BODY", "GALLERY", "ATTACHMENT"]);

export const ArticleAssetSchema = z.object({
  asset_id: z.number().optional(),
  article_id: z.number().optional(),
  directus_file_id: z.string().min(1, "Directus file UUID is required"),
  file_url: z.string().url("Valid image URL is required"),
  file_name: z.string().optional().nullable(),
  file_type: z.string().optional().nullable(),
  file_size_bytes: z.number().optional().nullable(),
  asset_role: AssetRoleEnum.default("INLINE_BODY"),
  caption: z.string().optional().nullable(),
  display_order: z.number().default(0),
});

export const CreateCareerArticleSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(255),
  slug: z.string().min(2, "Slug is required").max(255),
  category: z.string().min(1, "Category is required"),
  excerpt: z.string().min(5, "Excerpt must be at least 5 characters"),
  content: z.string().min(10, "Article content must not be empty"),
  featured_image_id: z.string().optional().nullable(),
  featured_image_url: z.string().optional().nullable(),
  author_id: z.number().optional().nullable(),
  author_name: z.string().min(1, "Author name is required").default("VOS Career Team"),
  author_role: z.string().min(1, "Author role is required").default("Career Specialist"),
  read_time_minutes: z.number().min(1).default(5),
  status: ArticleStatusEnum.default("DRAFT"),
  is_featured: z.boolean().default(false),
  ai_generated: z.boolean().default(false),
  seo_title: z.string().max(255).optional().nullable(),
  seo_description: z.string().optional().nullable(),
  published_at: z.string().optional().nullable(),
  assets: z.array(ArticleAssetSchema).optional(),
});

export const UpdateCareerArticleSchema = CreateCareerArticleSchema.partial().extend({
  article_id: z.number().optional(),
});

export const ArticleFilterSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  status: z.union([ArticleStatusEnum, z.literal("ALL")]).optional(),
  is_featured: z.union([z.boolean(), z.literal("ALL")]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sort_by: z.enum(["created_at", "published_at", "title", "read_time_minutes"]).default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export const AiArticleActionSchema = z.object({
  action: z.enum(["generate_draft", "proofread", "generate_seo", "suggest_topics"]),
  topic: z.string().optional(),
  category: z.string().optional(),
  target_audience: z.string().optional(),
  raw_text: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
});

export type CreateCareerArticleInput = z.infer<typeof CreateCareerArticleSchema>;
export type UpdateCareerArticleInput = z.infer<typeof UpdateCareerArticleSchema>;
export type ArticleFilterInput = z.infer<typeof ArticleFilterSchema>;
export type AiArticleActionInput = z.infer<typeof AiArticleActionSchema>;

// src/modules/vos-admin/career-advice-management/services/article.service.ts
import {
  fetchArticlesFromRepo,
  fetchArticleByIdFromRepo,
  createArticleInRepo,
  updateArticleInRepo,
  deleteArticleFromRepo,
  addAssetToArticleInRepo,
  updateAssetInRepo,
  deleteAssetFromRepo,
} from "./article.repo";
import { generateSlug, calculateReadTime, createExcerptFromHtml, getUtcNowSqlString } from "./article.helpers";
import {
  CareerArticle,
  ArticleFilters,
  PaginatedArticlesResponse,
  ArticleAsset,
} from "../types/article.types";
import {
  CreateCareerArticleInput,
  UpdateCareerArticleInput,
} from "../types/article.schema";

export class CareerArticleService {
  static async listArticles(filters: ArticleFilters): Promise<PaginatedArticlesResponse> {
    const limit = filters.limit || 10;
    const page = filters.page || 1;
    const { articles, total } = await fetchArticlesFromRepo(filters);

    return {
      articles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  static async getArticleById(id: number): Promise<CareerArticle | null> {
    return await fetchArticleByIdFromRepo(id);
  }

  static async createArticle(input: CreateCareerArticleInput, userId?: number): Promise<CareerArticle> {
    const slug = input.slug?.trim() || generateSlug(input.title);
    const readTime = input.read_time_minutes || calculateReadTime(input.content);
    const excerpt = input.excerpt?.trim() || createExcerptFromHtml(input.content);

    // Save strictly in UTC
    const publishedAt =
      input.status === "PUBLISHED" ? getUtcNowSqlString() : null;

    const newArticle = await createArticleInRepo({
      ...input,
      slug,
      excerpt,
      read_time_minutes: readTime,
      author_id: input.author_id ?? userId,
      published_at: publishedAt,
    });

    // If initial assets are provided, associate them with the article
    if (input.assets && input.assets.length > 0) {
      for (const asset of input.assets) {
        await addAssetToArticleInRepo({
          ...asset,
          article_id: newArticle.article_id,
        });
      }
    }

    return (await this.getArticleById(newArticle.article_id)) || newArticle;
  }

  static async updateArticle(id: number, input: UpdateCareerArticleInput): Promise<CareerArticle> {
    const existing = await fetchArticleByIdFromRepo(id);
    if (!existing) {
      throw new Error(`Career article #${id} not found.`);
    }

    const updates: Partial<CareerArticle> = { ...input };

    if (input.content && !input.read_time_minutes) {
      updates.read_time_minutes = calculateReadTime(input.content);
    }

    if (input.title && !input.slug) {
      updates.slug = generateSlug(input.title);
    }

    // Set published_at timestamp strictly in UTC when status transitions to PUBLISHED
    if (input.status === "PUBLISHED" && existing.status !== "PUBLISHED") {
      updates.published_at = getUtcNowSqlString();
    }

    return await updateArticleInRepo(id, updates);
  }

  static async deleteArticle(id: number): Promise<boolean> {
    return await deleteArticleFromRepo(id);
  }

  static async attachAsset(articleId: number, asset: Partial<ArticleAsset>): Promise<ArticleAsset> {
    return await addAssetToArticleInRepo({
      ...asset,
      article_id: articleId,
    });
  }

  static async updateAsset(assetId: number, data: Partial<ArticleAsset>): Promise<ArticleAsset> {
    return await updateAssetInRepo(assetId, data);
  }

  static async removeAsset(assetId: number): Promise<boolean> {
    return await deleteAssetFromRepo(assetId);
  }
}

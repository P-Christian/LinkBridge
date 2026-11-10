"use client";

// src/modules/vos-admin/career-advice-management/hooks/useCareerArticleMutations.ts
import { useState } from "react";
import { CareerArticle, ArticleAsset } from "../types/article.types";
import { CreateCareerArticleInput, UpdateCareerArticleInput } from "../types/article.schema";
import { toast } from "sonner";

export function useCareerArticleMutations(onSuccess?: () => void) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createArticle = async (input: CreateCareerArticleInput): Promise<CareerArticle | null> => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/vos-admin/career-articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || "Failed to create article");
      }

      const json = await res.json();
      toast.success("Article created successfully!");
      if (onSuccess) onSuccess();
      return json.data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create article";
      toast.error(message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateArticle = async (id: number, input: UpdateCareerArticleInput): Promise<CareerArticle | null> => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/vos-admin/career-articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || "Failed to update article");
      }

      const json = await res.json();
      toast.success("Article updated successfully!");
      if (onSuccess) onSuccess();
      return json.data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update article";
      toast.error(message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteArticle = async (id: number): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/vos-admin/career-articles/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || "Failed to delete article");
      }

      toast.success("Article deleted successfully");
      if (onSuccess) onSuccess();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete article";
      toast.error(message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadMedia = async (
    file: File,
    articleId?: number,
    assetRole: string = "INLINE_BODY",
    caption?: string
  ): Promise<{
    file_id: string;
    file_url: string;
    file_name?: string;
    file_type?: string;
    file_size_bytes?: number;
    asset?: ArticleAsset;
  } | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (articleId) formData.append("article_id", String(articleId));
      formData.append("asset_role", assetRole);
      if (caption) formData.append("caption", caption);

      const res = await fetch("/api/vos-admin/career-articles/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to upload file");
      }

      const json = await res.json();
      toast.success("Image uploaded successfully");
      return json.data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload error";
      toast.error(message);
      return null;
    }
  };

  return {
    isSubmitting,
    createArticle,
    updateArticle,
    deleteArticle,
    uploadMedia,
  };
}

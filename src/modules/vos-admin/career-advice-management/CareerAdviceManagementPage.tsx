// src/modules/vos-admin/career-advice-management/CareerAdviceManagementPage.tsx
"use client";

import React, { useState } from "react";
import { Plus, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCareerArticles } from "./hooks/useCareerArticles";
import { useCareerArticleMutations } from "./hooks/useCareerArticleMutations";
import {
  ArticleTable,
  ArticleFilterBar,
  ArticleEditorInline,
  ArticleDeleteDialog,
} from "./components";
import { CareerArticle } from "./types/article.types";
import { CreateCareerArticleInput } from "./types/article.schema";

export function CareerAdviceManagementPage() {
  const {
    articles,
    total,
    page,
    limit,
    totalPages,
    isLoading,
    filters,
    refresh,
    updateFilter,
    setFilters,
  } = useCareerArticles();

  const {
    isSubmitting,
    createArticle,
    updateArticle,
    deleteArticle,
    uploadMedia,
  } = useCareerArticleMutations(refresh);

  // View Mode: 'LIST' or 'EDITOR'
  const [viewMode, setViewMode] = useState<"LIST" | "EDITOR">("LIST");
  const [selectedArticle, setSelectedArticle] = useState<CareerArticle | null>(null);

  // Delete State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<CareerArticle | null>(null);

  const handleOpenCreate = () => {
    setSelectedArticle(null);
    setViewMode("EDITOR");
  };

  const handleOpenEdit = (article: CareerArticle) => {
    setSelectedArticle(article);
    setViewMode("EDITOR");
  };

  const handleOpenDelete = (article: CareerArticle) => {
    setArticleToDelete(article);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!articleToDelete) return;
    const ok = await deleteArticle(articleToDelete.article_id);
    if (ok) {
      setIsDeleteDialogOpen(false);
      setArticleToDelete(null);
    }
  };

  const handleSaveArticle = async (payload: CreateCareerArticleInput, articleId?: number) => {
    if (articleId) {
      const updated = await updateArticle(articleId, payload);
      if (updated) {
        setViewMode("LIST");
        setSelectedArticle(null);
      }
    } else {
      const created = await createArticle(payload);
      if (created) {
        setViewMode("LIST");
        setSelectedArticle(null);
      }
    }
  };

  const handleToggleFeatured = async (article: CareerArticle) => {
    await updateArticle(article.article_id, {
      is_featured: !article.is_featured,
    });
  };

  // If in EDITOR mode, render the full-page inline article writing suite
  if (viewMode === "EDITOR") {
    return (
      <ArticleEditorInline
        article={selectedArticle}
        onBack={() => {
          setViewMode("LIST");
          setSelectedArticle(null);
        }}
        onSave={handleSaveArticle}
        onUploadMedia={uploadMedia}
        isSubmitting={isSubmitting}
      />
    );
  }

  // Otherwise, render the standard Masterlist view
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-y-auto gap-6 p-4 md:p-6 lg:p-8">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> Career Advice Articles
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Create, edit, and publish advice articles released on the LinkBridge landing page.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleOpenCreate}
            size="sm"
            className="text-xs shadow-xs"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Article
          </Button>
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <ArticleFilterBar
        filters={filters}
        onChange={updateFilter}
        onReset={() =>
          setFilters({
            page: 1,
            limit: 10,
            status: "ALL",
            category: "ALL",
            search: "",
            sort_by: "created_at",
            sort_order: "desc",
          })
        }
      />

      {/* Data Table */}
      <ArticleTable
        articles={articles}
        isLoading={isLoading}
        onEdit={handleOpenEdit}
        onDelete={handleOpenDelete}
        onToggleFeatured={handleToggleFeatured}
      />

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{(page - 1) * limit + 1}</span> to{" "}
            <span className="font-medium text-foreground">{Math.min(page * limit, total)}</span> of{" "}
            <span className="font-medium text-foreground">{total}</span> articles
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updateFilter("page", page - 1)}
              disabled={page <= 1}
              className="h-8 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
            </Button>
            <span className="text-xs font-medium px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updateFilter("page", page + 1)}
              disabled={page >= totalPages}
              className="h-8 text-xs"
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ArticleDeleteDialog
        isOpen={isDeleteDialogOpen}
        isDeleting={isSubmitting}
        article={articleToDelete}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setArticleToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

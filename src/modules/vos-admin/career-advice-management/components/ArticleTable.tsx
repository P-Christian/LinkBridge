// src/modules/vos-admin/career-advice-management/components/ArticleTable.tsx
"use client";

import React from "react";
import { CareerArticle } from "../types/article.types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Sparkles,
  Star,
  Clock,
  BookOpen,
} from "lucide-react";
import { formatAssetUrl } from "@/lib/utils";
import Image from "next/image";

interface ArticleTableProps {
  articles: CareerArticle[];
  isLoading: boolean;
  onEdit: (article: CareerArticle) => void;
  onDelete: (article: CareerArticle) => void;
  onToggleFeatured?: (article: CareerArticle) => void;
}

export function ArticleTable({
  articles,
  isLoading,
  onEdit,
  onDelete,
  onToggleFeatured,
}: ArticleTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Published</Badge>;
      case "ARCHIVED":
        return <Badge variant="secondary" className="text-muted-foreground">Archived</Badge>;
      case "DRAFT":
      default:
        return <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30">Draft</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground">Loading career advice articles...</p>
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-12 text-center">
        <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <h3 className="text-sm font-semibold text-foreground">No articles found</h3>
        <p className="text-xs text-muted-foreground max-w-sm mt-1">
          No articles match your current search or filter criteria. Click &quot;Create Article&quot; to write your first post.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[340px] text-xs">Article</TableHead>
            <TableHead className="text-xs">Category</TableHead>
            <TableHead className="text-xs">Author</TableHead>
            <TableHead className="text-xs">Read Time</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs">Featured</TableHead>
            <TableHead className="text-xs text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {articles.map((article) => (
            <TableRow key={article.article_id} className="hover:bg-muted/30">
              {/* Article Title & Cover */}
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {article.featured_image_url ? (
                      <Image
                        src={formatAssetUrl(article.featured_image_url) || article.featured_image_url}
                        alt={article.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                        No cover
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground max-w-[240px]" title={article.title}>
                      {article.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[180px]">
                        /{article.slug}
                      </span>
                      {article.ai_generated && (
                        <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] bg-primary/10 text-primary font-medium" title="Draft generated with AI">
                          <Sparkles className="h-2.5 w-2.5" /> AI
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </TableCell>

              {/* Category */}
              <TableCell>
                <Badge variant="outline" className="text-xs font-normal">
                  {article.category}
                </Badge>
              </TableCell>

              {/* Author */}
              <TableCell>
                <div>
                  <p className="text-xs font-medium text-foreground">{article.author_name}</p>
                  <p className="text-[10px] text-muted-foreground">{article.author_role}</p>
                </div>
              </TableCell>

              {/* Read Time */}
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {article.read_time_minutes} min
                </span>
              </TableCell>

              {/* Status */}
              <TableCell>{getStatusBadge(article.status)}</TableCell>

              {/* Featured Toggle */}
              <TableCell>
                {article.is_featured ? (
                  <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px]">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Featured
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>

              {/* Actions Dropdown */}
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="text-xs">
                    <DropdownMenuItem onClick={() => onEdit(article)}>
                      <Edit className="mr-2 h-3.5 w-3.5" /> Edit Article
                    </DropdownMenuItem>
                    {onToggleFeatured && (
                      <DropdownMenuItem onClick={() => onToggleFeatured(article)}>
                        <Star className="mr-2 h-3.5 w-3.5" />
                        {article.is_featured ? "Remove from Featured" : "Mark as Featured"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(article)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Article
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

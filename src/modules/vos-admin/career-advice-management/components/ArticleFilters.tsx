// src/modules/vos-admin/career-advice-management/components/ArticleFilters.tsx
"use client";

import React from "react";
import { Search, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DEFAULT_CAREER_CATEGORIES } from "../services/article.helpers";
import { ArticleFilters as ArticleFiltersType, ArticleStatus } from "../types/article.types";

interface ArticleFilterBarProps {
  filters: ArticleFiltersType;
  onChange: (key: keyof ArticleFiltersType, value: ArticleFiltersType[keyof ArticleFiltersType]) => void;
  onReset: () => void;
}

export function ArticleFilterBar({ filters, onChange, onReset }: ArticleFilterBarProps) {
  const statuses: { label: string; value: ArticleStatus | "ALL" }[] = [
    { label: "All Statuses", value: "ALL" },
    { label: "Published", value: "PUBLISHED" },
    { label: "Drafts", value: "DRAFT" },
    { label: "Archived", value: "ARCHIVED" },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border shadow-xs">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by title, excerpt, or author..."
          value={filters.search || ""}
          onChange={(e) => onChange("search", e.target.value)}
          className="pl-8 text-xs h-9 bg-background"
        />
      </div>

      {/* Filter Options */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Category Dropdown */}
        <select
          value={filters.category || "ALL"}
          onChange={(e) => onChange("category", e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="ALL">All Categories</option>
          {DEFAULT_CAREER_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Status Dropdown */}
        <select
          value={filters.status || "ALL"}
          onChange={(e) => onChange("status", e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {statuses.map((st) => (
            <option key={st.value} value={st.value}>
              {st.label}
            </option>
          ))}
        </select>

        {/* Reset Button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-9 text-xs text-muted-foreground hover:text-foreground"
          title="Reset Filters"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Reset
        </Button>
      </div>
    </div>
  );
}

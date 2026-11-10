// src/modules/public/find-jobs/components/JobHeroBanner.tsx
"use client";

import React from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { PopularPreset } from "../types";

interface Props {
  searchQuery: string;
  locationQuery: string;
  onSearchChange: (q: string) => void;
  onLocationChange: (loc: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  totalJobs: number;
  popularPresets?: PopularPreset[];
  selectedJobType?: string;
  selectedWorkSetup?: string;
  appliedSearchQuery?: string;
  onQuickPresetClick?: (preset: PopularPreset) => void;
  onQuickCategoryClick?: (cat: string) => void;
  isLoading?: boolean;
}

export function JobHeroBanner({
  searchQuery,
  locationQuery,
  onSearchChange,
  onLocationChange,
  onSearchSubmit,
  popularPresets = [],
  selectedJobType = "All",
  selectedWorkSetup = "All",
  appliedSearchQuery = "",
  onQuickPresetClick,
  onQuickCategoryClick,
  isLoading = false,
}: Props) {
  const handleTagClick = (preset: PopularPreset) => {
    if (onQuickPresetClick) {
      onQuickPresetClick(preset);
    } else if (onQuickCategoryClick) {
      onQuickCategoryClick(preset.label);
    }
  };

  const isSearchEmpty = !searchQuery.trim() && !locationQuery.trim();

  return (
    <div className="relative overflow-hidden border-b border-border/60 pt-4 pb-16 md:pt-22 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wide uppercase shadow-2xs">
          <span>Discover Your Next Career Opportunity</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-foreground tracking-tight leading-tight">
          Explore <span className="text-primary underline decoration-primary/30 underline-offset-8">Top Open Jobs</span> Across the Philippines
        </h1>

        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Connect directly with verified employers, remote opportunities, and career openings without hassle.
        </p>

        {/* Hero Search Bar Box */}
        <form
          onSubmit={(e) => {
            if (isSearchEmpty) {
              e.preventDefault();
              return;
            }
            onSearchSubmit(e);
          }}
          className="bg-white/90 dark:bg-card/75 border border-border/80 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-3 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-3 backdrop-blur-xl"
        >
          {/* Keyword Search Input */}
          <div className="md:col-span-5 relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Job title, keyword, or company..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 h-12 bg-background border-0 focus-visible:ring-1 focus-visible:ring-primary text-base md:text-sm font-medium"
            />
          </div>

          {/* Location Input */}
          <div className="md:col-span-4 relative flex items-center border-t md:border-t-0 md:border-l pt-3 md:pt-0 pl-0 md:pl-3">
            <MapPin className="absolute left-3.5 md:left-6 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="City, province, or Remote..."
              value={locationQuery}
              onChange={(e) => onLocationChange(e.target.value)}
              className="pl-10 h-12 bg-background border-0 focus-visible:ring-1 focus-visible:ring-primary text-base md:text-sm font-medium"
            />
          </div>

          {/* Search Button */}
          <div className="md:col-span-3">
            <Button
              type="submit"
              size="lg"
              disabled={isLoading || isSearchEmpty}
              className="w-full h-12 text-sm font-bold gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {isLoading ? "Searching..." : "Search Jobs"}
            </Button>

          </div>
        </form>

        {/* Popular Quick Search Tags - 100% dynamic from database */}
        {popularPresets.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/80">Popular:</span>
            {popularPresets.map((preset) => {
              const isActive =
                preset.type === "work_setup"
                  ? selectedWorkSetup.toLowerCase() === preset.label.toLowerCase()
                  : preset.type === "job_type"
                  ? selectedJobType.toLowerCase() === preset.label.toLowerCase()
                  : appliedSearchQuery.trim().toLowerCase() === preset.label.trim().toLowerCase();

              return (
                <button
                  key={`${preset.type}-${preset.label}`}
                  type="button"
                  onClick={() => handleTagClick(preset)}
                  aria-pressed={isActive}
                  className={
                    isActive
                      ? "px-3 py-1 rounded-full border border-primary bg-primary text-primary-foreground font-semibold shadow-xs shadow-primary/25 transition-all text-[11px]"
                      : "px-3 py-1 rounded-full border border-primary/15 bg-card/80 hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-muted-foreground transition-all text-[11px] font-medium"
                  }
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// src/modules/client/applicants/components/ApplicantFilterPanel.tsx
"use client";

import React from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  APPLIED_WINDOWS,
  ApplicantFiltersState,
  EXPERIENCE_BUCKETS,
  PROFILE_BUCKETS,
  STAGE_TAG_OPTIONS,
  countActiveFilters,
} from "../utils/applicantFilters";
import type { CanonicalStageType } from "@/modules/client/pipeline/types";

interface ApplicantFilterPanelProps {
  filters: ApplicantFiltersState;
  onChange: (next: ApplicantFiltersState) => void;
}

function toggleIn<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/80 bg-card/80 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

export default function ApplicantFilterPanel({
  filters,
  onChange,
}: ApplicantFilterPanelProps) {
  const activeCount = countActiveFilters(filters);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={
            activeCount
              ? `Filter candidates (${activeCount} active)`
              : "Filter candidates"
          }
          className="h-10 shrink-0 gap-1.5 rounded-xl border-border/80 bg-background/70 px-3 text-xs font-medium hover:bg-muted/70 sm:text-sm max-md:min-h-10"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <Badge
              variant="secondary"
              className="h-4 min-w-4 rounded-full px-1.5 text-[10px] font-bold"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[300px] space-y-4 p-4">
        <PopoverTitle className="sr-only">Filter candidates</PopoverTitle>

        <FilterGroup title="Experience">
          {EXPERIENCE_BUCKETS.map((bucket) => (
            <FilterChip
              key={bucket.id}
              label={bucket.label}
              selected={filters.experience.includes(bucket.id)}
              onClick={() =>
                onChange({
                  ...filters,
                  experience: toggleIn(filters.experience, bucket.id),
                })
              }
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Profile completion">
          {PROFILE_BUCKETS.map((bucket) => (
            <FilterChip
              key={bucket.id}
              label={bucket.label}
              selected={filters.profile.includes(bucket.id)}
              onClick={() =>
                onChange({ ...filters, profile: toggleIn(filters.profile, bucket.id) })
              }
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Date applied">
          {APPLIED_WINDOWS.map((window) => (
            <FilterChip
              key={window.id}
              label={window.label}
              selected={filters.appliedWithin === window.id}
              onClick={() =>
                onChange({
                  ...filters,
                  appliedWithin:
                    filters.appliedWithin === window.id ? null : window.id,
                })
              }
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Stage">
          {STAGE_TAG_OPTIONS.map((stage) => (
            <FilterChip
              key={stage.id}
              label={stage.label}
              selected={filters.stageTypes.includes(stage.id)}
              onClick={() =>
                onChange({
                  ...filters,
                  stageTypes: toggleIn(
                    filters.stageTypes,
                    stage.id as CanonicalStageType
                  ),
                })
              }
            />
          ))}
        </FilterGroup>

        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          <p className="text-[11px] text-muted-foreground">
            {activeCount === 0
              ? "No filters applied"
              : `${activeCount} filter${activeCount === 1 ? "" : "s"} applied`}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={activeCount === 0}
            onClick={() => onChange({ ...filters, experience: [], profile: [], appliedWithin: null, stageTypes: [] })}
            className="h-7 text-xs text-muted-foreground max-md:min-h-9"
          >
            Clear all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

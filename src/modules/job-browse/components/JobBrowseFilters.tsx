import React from "react";
import { Search, SlidersHorizontal, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MultiSelectFilter } from "./MultiSelectFilter";
import {
  JobType,
  WorkArrangement,
  ExperienceLevel,
  DatePostedFilter,
  JOB_TYPE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  DATE_POSTED_OPTIONS,
} from "../types";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  filterJobTypes: JobType[];
  onJobTypesChange: (v: JobType[]) => void;
  filterArrangements: WorkArrangement[];
  onArrangementsChange: (v: WorkArrangement[]) => void;
  filterExperienceLevels: ExperienceLevel[];
  onExperienceLevelsChange: (v: ExperienceLevel[]) => void;
  filterDatePosted: DatePostedFilter;
  onDatePostedChange: (v: DatePostedFilter) => void;
  hasActiveFilters?: boolean;
  onClearAll?: () => void;
  totalCount: number;
  filteredCount: number;
}

const JOB_TYPE_OPTIONS = (Object.entries(JOB_TYPE_LABELS) as [JobType, string][]).map(([k, v]) => ({
  value: k,
  label: v,
}));

const ARRANGEMENT_OPTIONS: { value: WorkArrangement; label: string }[] = [
  { value: "Remote", label: "Remote" },
  { value: "Hybrid", label: "Hybrid" },
  { value: "On-site", label: "On-site" },
];

const EXPERIENCE_OPTIONS = (Object.entries(EXPERIENCE_LEVEL_LABELS) as [ExperienceLevel, string][]).map(([k, v]) => ({
  value: k,
  label: v,
}));

export function JobBrowseFilters({
  search,
  onSearchChange,
  filterJobTypes,
  onJobTypesChange,
  filterArrangements,
  onArrangementsChange,
  filterExperienceLevels,
  onExperienceLevelsChange,
  filterDatePosted,
  onDatePostedChange,
  hasActiveFilters,
  onClearAll,
  totalCount,
  filteredCount,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          id="job-browse-search"
          placeholder="Search jobs, companies, locations..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-11 md:h-10 rounded-xl text-base md:text-sm"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm md:text-xs text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filter:</span>
        </div>

        {/* Job Type (Multi-Select) */}
        <MultiSelectFilter
          title="Job Types"
          allLabel="All Types"
          options={JOB_TYPE_OPTIONS}
          selectedValues={filterJobTypes}
          onSelectionChange={(vals) => onJobTypesChange(vals as JobType[])}
          triggerClassName="w-40"
        />

        {/* Work Arrangement (Multi-Select) */}
        <MultiSelectFilter
          title="Arrangements"
          allLabel="All Arrangements"
          options={ARRANGEMENT_OPTIONS}
          selectedValues={filterArrangements}
          onSelectionChange={(vals) => onArrangementsChange(vals as WorkArrangement[])}
          triggerClassName="w-44"
        />

        {/* Experience Level (Multi-Select) */}
        <MultiSelectFilter
          title="Levels"
          allLabel="All Levels"
          options={EXPERIENCE_OPTIONS}
          selectedValues={filterExperienceLevels}
          onSelectionChange={(vals) => onExperienceLevelsChange(vals as ExperienceLevel[])}
          triggerClassName="w-40"
        />

        {/* Date Posted */}
        <SearchableSelect
          value={filterDatePosted}
          onValueChange={(v) => onDatePostedChange(v as DatePostedFilter)}
          options={DATE_POSTED_OPTIONS}
          placeholder="Date Posted"
          triggerClassName="h-8 w-44 text-sm md:text-xs rounded-lg max-md:min-h-11 border-zinc-200 dark:border-zinc-800"
        />

        {/* Clear Filters Button */}
        {hasActiveFilters && onClearAll && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-8 text-xs px-2.5 rounded-lg text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1.5 font-medium transition-colors max-md:min-h-11"
          >
            <RotateCcw className="h-3 w-3" />
            Clear Filters
          </Button>
        )}

        <span className="ml-auto text-sm md:text-xs text-muted-foreground">
          {filteredCount === totalCount
            ? `${totalCount} active job${totalCount !== 1 ? "s" : ""}`
            : `${filteredCount} of ${totalCount} active jobs`}
        </span>
      </div>
    </div>
  );
}

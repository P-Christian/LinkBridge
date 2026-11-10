// src/modules/client/applicants/components/ApplicantFilters.tsx
"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, X } from "lucide-react";
import { ApplicantFilterStatus } from "../types";
import { ApplicantFiltersState } from "../utils/applicantFilters";
import ApplicantFilterPanel from "./ApplicantFilterPanel";
import { JobPipelineStage, STAGE_COLOR_CLASSES } from "@/modules/client/pipeline/types";
import { cn } from "@/lib/utils";

interface ApplicantFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  status: ApplicantFilterStatus;
  onStatusChange: (v: ApplicantFilterStatus) => void;
  filters: ApplicantFiltersState;
  onFiltersChange: (v: ApplicantFiltersState) => void;
  counts?: Record<string, number>;
  pipelineStages?: JobPipelineStage[];
  /** Number of candidates currently shown; announced to screen readers. */
  resultCount?: number;
}

const CANONICAL_ALL_JOBS_OPTIONS: Array<{
  key: ApplicantFilterStatus;
  label: string;
  description: string;
  dotColor?: string | null;
}> = [
  {
    key: "ALL",
    label: "All Candidates",
    description: "All applicants across all jobs and hiring stages.",
    dotColor: null,
  },
  {
    key: "ACTIVE_PIPELINE",
    label: "Active Pipeline",
    description: "In-progress candidates in non-terminal stages (Applied, Screening, Assessment, Interview, Offer).",
    dotColor: null,
  },
  {
    key: "APPLIED",
    label: "Applied",
    description: "New candidate submissions awaiting initial review.",
    dotColor: "bg-sky-500",
  },
  {
    key: "SCREENING",
    label: "Screening",
    description: "Candidates undergoing profile and resume evaluation.",
    dotColor: "bg-blue-500",
  },
  {
    key: "ASSESSMENT",
    label: "Assessment",
    description: "Technical challenges, skills tests, or take-home assignments.",
    dotColor: "bg-indigo-500",
  },
  {
    key: "INTERVIEW",
    label: "Interview",
    description: "Candidates in active live technical or manager interview rounds.",
    dotColor: "bg-purple-500",
  },
  {
    key: "OFFER",
    label: "Offer",
    description: "Formal job offer extended to candidate.",
    dotColor: "bg-amber-500",
  },
  {
    key: "HIRED",
    label: "Hired",
    description: "Candidates accepted and officially hired (Terminal).",
    dotColor: "bg-emerald-500",
  },
  {
    key: "REJECTED",
    label: "Rejected",
    description: "Candidates not moving forward in the hiring process (Terminal).",
    dotColor: "bg-rose-500",
  },
  {
    key: "WITHDRAWN",
    label: "Withdrawn",
    description: "Candidates who voluntarily withdrew application (Terminal).",
    dotColor: "bg-zinc-500",
  },
];

export default function ApplicantFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  filters,
  onFiltersChange,
  counts,
  pipelineStages,
  resultCount,
}: ApplicantFiltersProps) {
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Press "/" anywhere on the page (outside a text field) to jump to the search box.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hasDynamicStages = Boolean(pipelineStages && pipelineStages.length > 0);

  const filterTabs = React.useMemo(() => {
    if (!hasDynamicStages || !pipelineStages) {
      return CANONICAL_ALL_JOBS_OPTIONS.map((item) => ({
        key: item.key,
        label: item.label,
        description: item.description,
        dotColor: item.dotColor ?? null,
      }));
    }

    const items: Array<{
      key: ApplicantFilterStatus;
      label: string;
      description: string;
      dotColor?: string | null;
    }> = [
      {
        key: "ALL" as ApplicantFilterStatus,
        label: "All Candidates",
        description: "All applicants across all stages for this job.",
        dotColor: null,
      },
      {
        key: "ACTIVE_PIPELINE" as ApplicantFilterStatus,
        label: "Active Pipeline",
        description: "In-progress candidates in non-terminal stages.",
        dotColor: null,
      },
    ];

    for (const stage of pipelineStages) {
      items.push({
        key: `STAGE_${stage.id}`,
        label: stage.stage_name,
        description:
          stage.description ||
          `${stage.stage_name} (${stage.stage_type})${
            stage.is_terminal ? " - Terminal stage" : ""
          }`,
        dotColor: STAGE_COLOR_CLASSES[stage.color]?.dot || "bg-primary",
      });
    }

    return items;
  }, [hasDynamicStages, pipelineStages]);

  return (
    <div className="space-y-3 min-w-0">
      {/* ── All Filter Tabs in a Single Unified Row ──────────────────────── */}
      <div
        role="group"
        aria-label="Filter candidates by stage"
        className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar scroll-smooth"
      >
        {filterTabs.map((item) => {
          const isSelected = status === item.key;
          const count = counts ? counts[item.key] ?? 0 : undefined;

          return (
            <Tooltip key={item.key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onStatusChange(item.key)}
                  aria-pressed={isSelected}
                  aria-label={`${item.label} filter (${item.description})`}
                  className={cn(
                    "group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/25 font-semibold"
                      : "bg-card/80 hover:bg-muted/80 text-muted-foreground hover:text-foreground border-border/80"
                  )}
                >
                  {item.dotColor && (
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        isSelected ? "bg-primary-foreground" : item.dotColor
                      )}
                    />
                  )}
                  <span>{item.label}</span>
                  {typeof count === "number" && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center rounded-full font-bold pointer-events-none transition-colors",
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground group-hover:bg-muted/90 group-hover:text-foreground"
                      )}
                    >
                      {count}
                    </Badge>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p className="font-semibold mb-0.5">{item.label}</p>
                <p className="opacity-90">{item.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* ── Search Bar + Multi-select Filters ─────────────────────────────── */}
      <div className="flex items-center gap-2 w-full">
        <div className="relative flex-1 min-w-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <Input
            ref={searchRef}
            id="applicant-search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (search) onSearchChange("");
                else e.currentTarget.blur();
              }
            }}
            aria-label="Search candidates"
            autoComplete="off"
            placeholder="Search by candidate name, email, job title, or skill..."
            className="h-10 pl-9 pr-9 text-xs sm:text-sm bg-background/70 border-border/80 focus-visible:ring-primary/20 rounded-xl"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                onSearchChange("");
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <kbd
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border/80 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline-block"
            >
              /
            </kbd>
          )}
        </div>

        <ApplicantFilterPanel filters={filters} onChange={onFiltersChange} />

        {typeof resultCount === "number" && (
          <p role="status" aria-live="polite" className="sr-only">
            {resultCount} {resultCount === 1 ? "candidate" : "candidates"} shown
          </p>
        )}
      </div>
    </div>
  );
}




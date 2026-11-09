"use client";

// src/modules/client/talent-search/components/TalentFilters.tsx

import React, {  useState } from "react";
import { Filter, ChevronDown, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  TalentFilters as TalentFiltersValue,
  ExperienceLevel,
  EXPERIENCE_LEVEL_LABELS,
  WorkSetup,
  WORK_SETUP_LABELS,
  FilterSuggestion,
  SchoolFilter,
} from "../types";
import AutocompleteFilterField from "./AutocompleteFilterField";

 

interface TalentFiltersProps {
  filters: TalentFiltersValue;
  onFilterChange: <K extends keyof TalentFiltersValue>(key: K, value: TalentFiltersValue[K]) => void;
  onApply: () => void;
  onClear: () => void;
}

interface FilterTag {
  key: string;
  label: string;
}

function schoolTagKey(school: SchoolFilter): string {
  return school.id !== null ? `id:${school.id}` : `name:${school.name.toLowerCase()}`;
}

function FilterSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/70 pb-3 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-xs font-semibold text-foreground/85 uppercase tracking-wider py-2 hover:text-foreground transition-colors max-md:min-h-10"
      >
        <span>{title}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="pt-1 pb-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TagChips({ tags, onRemove, removePrefix }: { tags: FilterTag[]; onRemove: (tag: FilterTag) => void; removePrefix: string }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      <AnimatePresence>
        {tags.map((tag) => (
          <motion.span
            layout
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            key={tag.key}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20 font-medium shadow-2xs"
          >
            <span className="max-w-40 truncate" title={tag.label}>{tag.label}</span>
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className="hover:text-destructive transition-colors p-0.5"
              title={`Remove ${removePrefix} ${tag.label}`}
              aria-label={`Remove ${removePrefix} ${tag.label}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function TalentFiltersPanel({ filters, onFilterChange, onApply, onClear }: TalentFiltersProps) {
  // The desktop sidebar and the mobile sheet can both be mounted, so the shared
  // highlight is scoped to one panel instance.
 

  const addSkill = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || filters.skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;
    onFilterChange("skills", [...filters.skills, trimmed]);
  };

  const addLocation = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || filters.locations.some((l) => l.toLowerCase() === trimmed.toLowerCase())) return;
    onFilterChange("locations", [...filters.locations, trimmed]);
  };

  const addSchool = (school: SchoolFilter) => {
    const name = school.name.trim();
    if (!name) return;
    const exists = filters.schools.some(
      (s) => (s.id !== null && school.id !== null ? s.id === school.id : s.name.toLowerCase() === name.toLowerCase())
    );
    if (exists) return;
    onFilterChange("schools", [...filters.schools, { ...school, name }]);
  };

  /** The registry returns the school id as the suggestion value. */
  const addSuggestedSchool = (suggestion: FilterSuggestion) => {
    addSchool({
      id: /^\d+$/.test(suggestion.value) ? Number(suggestion.value) : null,
      name: suggestion.label,
      campus: suggestion.hint,
    });
  };

  const skillTags: FilterTag[] = filters.skills.map((skill) => ({ key: skill, label: skill }));
  const locationTags: FilterTag[] = filters.locations.map((location) => ({ key: location, label: location }));
  const schoolTags: FilterTag[] = filters.schools.map((school) => ({
    key: schoolTagKey(school),
    label: school.campus ? `${school.name} — ${school.campus}` : school.name,
  }));

  const activeCount = [
    filters.skills.length > 0,
    filters.locations.length > 0,
    ((filters.experience_levels && filters.experience_levels.length > 0) || !!filters.experience_level),
    filters.schools.length > 0,
    (filters.work_setups && filters.work_setups.length > 0),
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Preferences</span>
          <AnimatePresence>
            {activeCount > 0 && (
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <Badge className="h-5 px-1.5 text-xs bg-primary text-primary-foreground border-0 font-bold">
                  {activeCount}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors max-md:min-h-10"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1">
        {/* Skills */}
        <FilterSection title="Skills">
          <div className="space-y-2.5">
            <AutocompleteFilterField
              type="skills"
              placeholder="Search skills…"
              selected={filters.skills}
              onPick={(suggestion) => addSkill(suggestion.label)}
            />
            <TagChips
              tags={skillTags}
              removePrefix="skill"
              onRemove={(tag) => onFilterChange("skills", filters.skills.filter((s) => s !== tag.key))}
            />
          </div>
        </FilterSection>

        {/* Location */}
        <FilterSection title="Location">
          <div className="space-y-2.5">
            <AutocompleteFilterField
              type="locations"
              placeholder="Search city or province…"
              selected={filters.locations}
              onPick={(suggestion) => addLocation(suggestion.label)}
            />
            <TagChips
              tags={locationTags}
              removePrefix="location"
              onRemove={(tag) => onFilterChange("locations", filters.locations.filter((l) => l !== tag.key))}
            />
          </div>
        </FilterSection>

        {/* Experience Level */}
        <FilterSection title="Experience Level">
          <div className="space-y-1">
            {(Object.entries(EXPERIENCE_LEVEL_LABELS) as [ExperienceLevel, string][]).map(([level, label]) => {
              const selectedLevels = (filters.experience_levels && filters.experience_levels.length > 0)
                ? filters.experience_levels
                : filters.experience_level ? [filters.experience_level] : [];
              const active = selectedLevels.includes(level);
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? selectedLevels.filter((l) => l !== level)
                      : [...selectedLevels, level];
                    onFilterChange("experience_levels", next);
                    onFilterChange("experience_level", "");
                  }}
                  className={cn(
                    "flex items-center justify-between w-full rounded-lg px-3 py-1.5 text-left text-xs transition-colors",
                    active
                      ? "font-semibold text-primary bg-primary/10 border border-primary/20 shadow-2xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span>{label}</span>
                  {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {/* Work Setup */}
        <FilterSection title="Work Setup">
          <div className="space-y-1">
            {(Object.entries(WORK_SETUP_LABELS) as [WorkSetup, string][]).map(([setup, label]) => {
              const selectedSetups = filters.work_setups ?? [];
              const active = selectedSetups.includes(setup);
              return (
                <button
                  key={setup}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? selectedSetups.filter((s) => s !== setup)
                      : [...selectedSetups, setup];
                    onFilterChange("work_setups", next);
                  }}
                  className={cn(
                    "flex items-center justify-between w-full rounded-lg px-3 py-1.5 text-left text-xs transition-colors",
                    active
                      ? "font-semibold text-primary bg-primary/10 border border-primary/20 shadow-2xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span>{label}</span>
                  {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {/* School */}
        <FilterSection title="School">
          <div className="space-y-2.5">
            <AutocompleteFilterField
              type="schools"
              placeholder="Search school name or city…"
              selected={filters.schools.map((school) =>
                school.id !== null ? String(school.id) : school.name
              )}
              onPick={addSuggestedSchool}
              onCreate={(value) => addSchool({ id: null, name: value })}
            />
            <TagChips
              tags={schoolTags}
              removePrefix="school"
              onRemove={(tag) =>
                onFilterChange("schools", filters.schools.filter((s) => schoolTagKey(s) !== tag.key))
              }
            />
          </div>
        </FilterSection>
      </div>

      <motion.div whileTap={{ scale: 0.98 }}>
        <Button
          id="talent-filter-apply"
          onClick={onApply}
          className="w-full h-9 max-md:min-h-10 rounded-xl font-semibold text-sm shadow-2xs"
        >
          Apply Preferences
        </Button>
      </motion.div>
    </div>
  );
}

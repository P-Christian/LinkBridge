"use client";

import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CourseDegree } from "@/modules/school-admin/types/school-admin.types";
import {
  catalogCategoryNames,
  programByTitle,
  programOptions,
  type CourseSelection,
  type ExistingCourse,
} from "../catalog/course-catalog";

const DEGREE_LEVELS: readonly CourseDegree[] = ["Associate", "Bachelor", "Master", "Doctorate"];
const NO_CATEGORY = "__none__";

interface CourseCatalogPickerProps {
  readonly value: CourseSelection;
  readonly onChange: (next: CourseSelection) => void;
  readonly existingCourses: readonly ExistingCourse[];
  readonly disabled?: boolean;
}

export function CourseCatalogPicker({
  value,
  onChange,
  existingCourses,
  disabled = false,
}: CourseCatalogPickerProps) {
  const id = useId();
  const categories = catalogCategoryNames();
  const options = programOptions(value.degree, value.category, existingCourses);
  const selected = programByTitle(value.degree, value.category, value.programTitle);
  const readyForPrograms = value.degree !== "" && value.category !== null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${id}-degree`}>Degree Level *</Label>
        <Select
          value={value.degree}
          onValueChange={(next) =>
            onChange({ ...value, degree: next as CourseDegree, programTitle: "", courseCode: "" })
          }
          disabled={disabled}
        >
          <SelectTrigger id={`${id}-degree`} data-testid="catalog-degree">
            <SelectValue placeholder="Select degree level" />
          </SelectTrigger>
          <SelectContent>
            {DEGREE_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Field Category</Label>
        <SearchableSelect
          options={[
            { value: NO_CATEGORY, label: "No category" },
            ...categories.map((name) => ({ value: name, label: name })),
          ]}
          value={value.category ?? NO_CATEGORY}
          onValueChange={(next) =>
            onChange({
              ...value,
              category: next === NO_CATEGORY ? null : next,
              programTitle: "",
              courseCode: "",
            })
          }
          placeholder="Select field category"
          searchPlaceholder="Search field categories..."
          ariaLabel="Field category"
          disabled={disabled}
          triggerClassName="h-9"
        />
      </div>

      {value.isOther ? (
        <div className="space-y-2">
          <Label htmlFor={`${id}-other`}>Course Name *</Label>
          <Input
            id={`${id}-other`}
            data-testid="catalog-other-name"
            placeholder="e.g. Bachelor of Science in Applied Mathematics"
            value={value.programTitle}
            onChange={(event) => onChange({ ...value, programTitle: event.target.value })}
            disabled={disabled}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Program *</Label>
          <div data-testid="catalog-program">
            <SearchableSelect
              options={[...options]}
              value={value.programTitle}
              onValueChange={(title) => {
                const program = programByTitle(value.degree, value.category, title);
                onChange({
                  ...value,
                  isOther: false,
                  programTitle: title,
                  courseCode: program?.code ?? value.courseCode,
                });
              }}
              placeholder={
                readyForPrograms ? "Select a program" : "Select a degree level and category first"
              }
              searchPlaceholder="Search programs..."
              ariaLabel="Select a program"
              disabled={disabled || !readyForPrograms || options.length === 0}
            />
          </div>
          {readyForPrograms && options.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-testid="catalog-no-programs">
              Every program for this degree and category is already added.
            </p>
          ) : null}
          {selected !== undefined ? (
            <p className="text-xs text-muted-foreground" data-testid="catalog-selected">
              Selected: {selected.title} ({selected.code})
            </p>
          ) : null}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${id}-code`}>Course Code (Optional)</Label>
        <Input
          id={`${id}-code`}
          data-testid="catalog-course-code"
          placeholder="e.g. BSCS"
          value={value.courseCode}
          onChange={(event) => onChange({ ...value, courseCode: event.target.value })}
          disabled={disabled}
        />
      </div>

      <button
        type="button"
        onClick={() =>
          onChange({ ...value, isOther: !value.isOther, programTitle: "", courseCode: "" })
        }
        disabled={disabled}
        data-testid="catalog-toggle-other"
        className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
      >
        {value.isOther ? "Back to the program list" : "Can't find this program? Enter it manually"}
      </button>
    </div>
  );
}

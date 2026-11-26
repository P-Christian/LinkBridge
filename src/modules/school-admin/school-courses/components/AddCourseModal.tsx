"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { CreateCourseDTO } from "../types/school-courses.types";
import { createCourseSchema } from "../types/school-courses.schema";
import {
  EMPTY_COURSE_SELECTION,
  selectionToCourseInput,
  type CourseSelection,
  type ExistingCourse,
} from "../catalog/course-catalog";
import { CourseCatalogPicker } from "./CourseCatalogPicker";

interface AddCourseModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateCourseDTO) => Promise<boolean>;
  saving: boolean;
  existingCourses: readonly ExistingCourse[];
}

export function AddCourseModal({
  isOpen,
  onOpenChange,
  onSubmit,
  saving,
  existingCourses,
}: AddCourseModalProps) {
  const [selection, setSelection] = useState<CourseSelection>(EMPTY_COURSE_SELECTION);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelection(EMPTY_COURSE_SELECTION);
      setError(null);
    }
    onOpenChange(open);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const input = selectionToCourseInput(selection);
    if (input === null) {
      setError("Choose a degree level and a program, or enter a course name.");
      return;
    }

    const parsed = createCourseSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Validation failed");
      return;
    }

    const success = await onSubmit({
      course_name: input.course_name,
      course_code: input.course_code,
      course_category: input.course_category,
      degree: input.degree,
    });

    if (success) {
      setSelection(EMPTY_COURSE_SELECTION);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="add-course-dialog">
        <DialogHeader>
          <DialogTitle>Add New Course</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="text-sm font-medium text-destructive bg-destructive/10 p-2 rounded-md">
              {error}
            </div>
          )}

          <CourseCatalogPicker
            value={selection}
            onChange={setSelection}
            existingCourses={existingCourses}
            disabled={saving}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} data-testid="add-course-submit">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Course
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

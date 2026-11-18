"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { CourseStatus, VsSchoolCourse } from "@/modules/school-admin/types/school-admin.types";
import { UpdateCourseDTO } from "../types/school-courses.types";
import { updateCourseSchema } from "../types/school-courses.schema";
import {
  selectionFromExistingCourse,
  selectionToCourseInput,
  type CourseSelection,
  type ExistingCourse,
} from "../catalog/course-catalog";
import { CourseCatalogPicker } from "./CourseCatalogPicker";

interface EditCourseModalProps {
  course: VsSchoolCourse | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (courseId: number, data: UpdateCourseDTO) => Promise<boolean>;
  saving: boolean;
  existingCourses: readonly ExistingCourse[];
}

interface EditCourseFormProps {
  course: VsSchoolCourse;
  existingCourses: readonly ExistingCourse[];
  onCancel: () => void;
  onSubmit: (courseId: number, data: UpdateCourseDTO) => Promise<boolean>;
  saving: boolean;
}

function EditCourseForm({
  course,
  existingCourses,
  onCancel,
  onSubmit,
  saving,
}: EditCourseFormProps) {
  const [selection, setSelection] = useState<CourseSelection>(() =>
    selectionFromExistingCourse({
      course_name: course.course_name,
      degree: course.degree ?? null,
      course_code: course.course_code ?? null,
      course_category: course.course_category ?? null,
    })
  );
  const [status, setStatus] = useState<CourseStatus>(
    (course.course_status as CourseStatus) || "Active"
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const input = selectionToCourseInput(selection);
    if (input === null) {
      setError("Choose a degree level and a program, or enter a course name.");
      return;
    }

    const parsed = updateCourseSchema.safeParse({ ...input, course_status: status });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Validation failed");
      return;
    }

    const success = await onSubmit(course.school_course_id, {
      course_name: input.course_name,
      course_code: input.course_code,
      course_category: input.course_category,
      degree: input.degree,
      course_status: status,
    });

    if (success) {
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2" data-testid="edit-course-form">
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

      <div className="space-y-2">
        <Label htmlFor="edit_course_status">Status</Label>
        <Select value={status} onValueChange={(val: string) => setStatus(val as CourseStatus)}>
          <SelectTrigger id="edit_course_status" data-testid="edit-course-status">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} data-testid="edit-course-submit">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}

export function EditCourseModal({
  course,
  isOpen,
  onOpenChange,
  onSubmit,
  saving,
  existingCourses,
}: EditCourseModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Course</DialogTitle>
        </DialogHeader>
        {course && (
          <EditCourseForm
            key={course.school_course_id}
            course={course}
            existingCourses={existingCourses}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
            saving={saving}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

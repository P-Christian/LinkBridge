'use client';

import React, { useState } from 'react';
import { VsSchoolStudent } from '../types/student-roster.types';
import { UpdateRosterAcademicsInput, updateRosterAcademicsSchema } from '../types/student-roster.schema';
import { VsSchoolCourse } from '@/modules/school-admin/types/school-admin.types';
import { generateSchoolYearOptions } from '../utils/school-year.utils';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface EditStudentModalProps {
  isOpen: boolean;
  student: VsSchoolStudent | null;
  onClose: () => void;
  onSuccess: (studentId: number, data: UpdateRosterAcademicsInput) => Promise<void>;
  courses?: VsSchoolCourse[];
}

interface EditStudentFormProps {
  student: VsSchoolStudent;
  onClose: () => void;
  onSuccess: (studentId: number, data: UpdateRosterAcademicsInput) => Promise<void>;
  courses: VsSchoolCourse[];
  schoolYearOptions: string[];
}

type EditStudentFormData = {
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  school_course_id: number | null;
  student_number: string | null;
  school_year: string;
  gpa: number | null;
};

const EditStudentForm: React.FC<EditStudentFormProps> = ({
  student,
  onClose,
  onSuccess,
  courses,
  schoolYearOptions,
}) => {
  const isLinked =
    student.employee_education_id !== null && student.employee_education_id !== undefined;

  const [formData, setFormData] = useState<EditStudentFormData>({
    first_name: student.first_name || '',
    middle_name: student.middle_name || '',
    last_name: student.last_name || '',
    email: student.email || '',
    school_course_id: student.school_course_id ? Number(student.school_course_id) : null,
    student_number: student.student_number || null,
    school_year: student.school_year || '2025-2026',
    gpa: student.gpa !== null && student.gpa !== undefined ? Number(student.gpa) : null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const payload = {
      first_name: formData.first_name,
      middle_name: formData.middle_name || null,
      last_name: formData.last_name,
      email: formData.email,
      school_course_id: formData.school_course_id,
      student_number: formData.student_number,
      school_year: formData.school_year,
      gpa: formData.gpa,
      expected_updated_at: student.updated_at ?? undefined,
    };
    const result = updateRosterAcademicsSchema.safeParse(payload);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      await onSuccess(student.student_id, result.data);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update student';
      setErrors({ form: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {errors.form && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">
          {errors.form}
        </div>
      )}

      <div className="p-3 bg-muted/40 text-muted-foreground text-xs rounded-lg border border-border">
        Editing record for <span className="font-semibold text-foreground">{student.last_name}, {student.first_name}</span>
        {' '}({student.email}). {isLinked
          ? 'This record is linked to a verified freelancer profile. Update academic and identity details carefully.'
          : 'Update student identity and academic program details.'}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            First Name *
          </label>
          <input
            type="text"
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.first_name && <p className="text-xs text-destructive mt-1">{errors.first_name}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Middle Name (Optional)
          </label>
          <input
            type="text"
            value={formData.middle_name}
            onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Last Name *
          </label>
          <input
            type="text"
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.last_name && <p className="text-xs text-destructive mt-1">{errors.last_name}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Email Address *
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Student Number
          </label>
          <input
            type="text"
            value={formData.student_number || ''}
            onChange={(e) => setFormData({ ...formData, student_number: e.target.value === '' ? null : e.target.value })}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.student_number && <p className="text-xs text-destructive mt-1">{errors.student_number}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Course
          </label>
          <SearchableSelect
            options={[
              { value: 'none', label: 'No Course Assigned' },
              ...courses.map((course) => ({
                value: String(course.school_course_id),
                label: `${course.course_name} (${course.course_code || 'N/A'})`,
              })),
            ]}
            value={formData.school_course_id ? String(formData.school_course_id) : 'none'}
            onValueChange={(val) =>
              setFormData({
                ...formData,
                school_course_id: val && val !== 'none' ? Number(val) : null,
              })
            }
            placeholder="Select course..."
            searchPlaceholder="Search courses..."
            triggerClassName="h-[38px] text-sm rounded-lg"
          />
          {errors.school_course_id && <p className="text-xs text-destructive mt-1">{errors.school_course_id}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            School Year *
          </label>
          <select
            value={formData.school_year ?? ''}
            onChange={(e) => setFormData({ ...formData, school_year: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {formData.school_year && !schoolYearOptions.includes(formData.school_year) && (
              <option value={formData.school_year}>{formData.school_year}</option>
            )}
            {schoolYearOptions.map((sy) => (
              <option key={sy} value={sy}>
                {sy}
              </option>
            ))}
          </select>
          {errors.school_year && <p className="text-xs text-destructive mt-1">{errors.school_year}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            GPA (Optional)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="5.0"
            value={formData.gpa ?? ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                gpa: e.target.value !== '' ? parseFloat(e.target.value) : null,
              })
            }
            className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.gpa && <p className="text-xs text-destructive mt-1">{errors.gpa}</p>}
        </div>
      </div>

      <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
};

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  isOpen,
  student,
  onClose,
  onSuccess,
  courses = [],
}) => {
  const schoolYearOptions = generateSchoolYearOptions();

  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card text-card-foreground w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden border border-border animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <h2 className="text-lg font-bold text-foreground">Edit Student Record</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded-lg p-1 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <EditStudentForm
          key={student.student_id}
          student={student}
          onClose={onClose}
          onSuccess={onSuccess}
          courses={courses}
          schoolYearOptions={schoolYearOptions}
        />
      </div>
    </div>
  );
};

import { z } from 'zod';

export const createStudentSchema = z.object({
  student_number: z.string().trim().nullable().optional(),
  first_name: z.string().trim().min(1, 'First name is required'),
  middle_name: z.string().trim().nullable().optional(),
  last_name: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().min(1, 'Email is required').email('Invalid email address format'),
  school_course_id: z.number().nullable().optional(),
  course_code: z.string().trim().nullable().optional(),
  course_name: z.string().trim().nullable().optional(),
  school_year: z.string().trim().min(1, 'School year is required'),
  gpa: z.number().min(0).max(5.0).nullable().optional(),
});

export const bulkStudentSchema = z.array(createStudentSchema).min(1, 'At least one student record is required');

export const updateStudentSchema = createStudentSchema.partial();

// This is the ONLY roster mutation allowed outside dedicated reconciliation flows.
// Strict allowlist — lineage (employee_education_id), identity (names/email),
// classification (is_alumni), registration/invitation, school, and canonical
// course are immutable here; forged keys are rejected, never stripped.
// `expected_updated_at` is an optimistic-concurrency guard (never persisted);
// a mismatch yields 409 so stale edits cannot overwrite fresh saga writes.
export const updateRosterAcademicsSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100).optional(),
  middle_name: z.string().trim().max(100).nullish().transform((v) => (v === '' ? null : v)),
  last_name: z.string().trim().min(1, 'Last name is required').max(100).optional(),
  email: z.string().trim().min(1, 'Email is required').email('Invalid email address format').max(150).optional(),
  school_course_id: z.number().nullable().optional(),
  student_number: z.string().trim().max(50).nullish().transform((v) => (v === '' ? null : v)),
  gpa: z.number().min(0).max(5.0).nullable().optional(),
  school_year: z.string().trim().min(1, 'School year is required').max(50).optional(),
  expected_updated_at: z.string().trim().min(1).max(40).optional(),
}).strict();

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type BulkStudentInput = z.infer<typeof bulkStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type UpdateRosterAcademicsInput = z.infer<typeof updateRosterAcademicsSchema>;

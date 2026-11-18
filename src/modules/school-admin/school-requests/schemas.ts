import "server-only";

import { z } from "zod";

const nullableInteger = z.number().int().nullable();
const nullableText = z.string().nullable();

const requesterId = z
  .union([z.number().int(), z.object({ user_id: z.number().int() }).passthrough()])
  .transform((value) => (typeof value === "number" ? value : value.user_id));

const activeFlag = z.union([z.boolean(), z.number()]);

/** Persisted `vs_school_admin` assignment row (active subset). */
export const schoolAssignmentRowSchema = z.object({
  school_admin_id: z.number().int(),
  school_id: z.number().int(),
  user_id: z.number().int(),
  is_active: activeFlag,
});

/** Persisted `vs_school_request` row subset returned by the scoped queries. */
export const scopedSchoolRequestRowSchema = z.object({
  school_request_id: z.number().int(),
  requested_by: requesterId,
  requested_school_name: z.string(),
  request_status: z.enum(["Pending", "Approved", "Rejected", "RoutedToSchool"]),
  matched_school_id: nullableInteger,
  reviewed_by: nullableInteger,
  reviewed_at: nullableText,
  routed_by: nullableInteger,
  routed_at: nullableText,
  employee_education_id: nullableInteger,
  active_employee_education_id: nullableInteger,
  created_at: z.string(),
});

/** Persisted `vs_employee_education` row subset for inbox expansion. */
export const linkedEducationRowSchema = z.object({
  employee_education_id: z.number().int(),
  user_id: z.number().int(),
  school_id: nullableInteger,
  school_course_id: nullableInteger,
  course_name_raw: nullableText,
  school_name_raw: nullableText,
  education_status: z.enum(["Pending", "Verified", "Unverified"]),
  start_date: nullableText,
  end_date: nullableText,
});

/** Persisted `vs_school_course` row subset for inbox expansion. */
export const linkedCourseRowSchema = z.object({
  school_course_id: z.number().int(),
  school_id: z.number().int(),
  course_name: z.string(),
  course_code: nullableText,
});

/** Minimal `vs_course_request` linkage probe for Finalizing detection. */
export const courseRequestLinkSchema = z.object({
  course_request_id: z.number().int(),
});

export type SchoolAssignmentRow = z.infer<typeof schoolAssignmentRowSchema>;
export type ScopedSchoolRequestRow = z.infer<typeof scopedSchoolRequestRowSchema>;
export type LinkedEducationRow = z.infer<typeof linkedEducationRowSchema>;
export type LinkedCourseRow = z.infer<typeof linkedCourseRowSchema>;

const educationSummarySchema = z.object({
  employeeEducationId: z.number().int(),
  userId: z.number().int(),
  schoolId: nullableInteger,
  schoolCourseId: nullableInteger,
  courseNameRaw: nullableText,
  schoolNameRaw: nullableText,
  educationStatus: z.enum(["Pending", "Verified", "Unverified"]),
  startDate: nullableText,
  endDate: nullableText,
});

const courseSummarySchema = z.object({
  schoolCourseId: z.number().int(),
  schoolId: z.number().int(),
  courseName: z.string(),
  courseCode: nullableText,
});

/** Outbound proof-document metadata. The Directus file id never appears here. */
export const schoolRequestDocumentSchema = z.object({
  documentId: z.number().int(),
  type: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  url: z.string(),
});

/**
 * Outbound inbox-row shape. Closed world: unknown keys are stripped so
 * academics and user identity can never leak through this boundary even if a
 * wider row is passed in by mistake.
 */
export const schoolRequestInboxRowSchema = z.object({
  schoolRequestId: z.number().int(),
  requestStatus: z.enum(["RoutedToSchool", "Approved"]),
  matchedSchoolId: z.number().int(),
  requestedBy: z.number().int(),
  requestedSchoolName: z.string(),
  createdAt: z.string(),
  routedBy: nullableInteger,
  routedAt: nullableText,
  reviewedBy: nullableInteger,
  reviewedAt: nullableText,
  education: educationSummarySchema,
  course: courseSummarySchema.nullable(),
  documents: z.array(schoolRequestDocumentSchema),
});

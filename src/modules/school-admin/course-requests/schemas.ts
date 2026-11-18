import "server-only";

import { z } from "zod";

import { COURSE_REQUEST_SCHOOL_ADMIN_ERROR_CODES } from "./errors";

const positiveInteger = z.number().int().positive();
const nullableInteger = z.number().int().nullable();

const trimmedNonBlank = z.string().trim().min(1);
const nullableText = z.string().nullable();

const requesterId = z
  .union([z.number().int(), z.object({ user_id: z.number().int() }).strict()])
  .transform((value) => (typeof value === "number" ? value : value.user_id));

/**
 * Internal parsed `vs_course_request` row subset returned by the scoped
 * queries. Manual route audit (`routed_by`/`routed_at`) and the submission
 * timestamp (`created_at`) are REQUIRED: a nullable audit never crosses this
 * boundary and fails parsing.
 */
export const scopedCourseRequestRowSchema = z
  .object({
    course_request_id: positiveInteger,
    school_id: positiveInteger,
    employee_education_id: positiveInteger,
    requested_by: requesterId,
    requested_course_name: trimmedNonBlank,
    request_status: z.enum(["RoutedToSchool", "Approved", "Rejected"]),
    matched_school_course_id: nullableInteger,
    reviewed_by: nullableInteger,
    reviewed_at: nullableText,
    routed_by: positiveInteger,
    routed_at: trimmedNonBlank,
    created_at: trimmedNonBlank,
    admin_remarks: nullableText,
  })
  .strict();

export type ScopedCourseRequestRow = z.infer<typeof scopedCourseRequestRowSchema>;

const actionableRowBase = {
  courseRequestId: positiveInteger,
  requestStatus: z.literal("RoutedToSchool"),
  requestedCourseName: trimmedNonBlank,
  submitterName: trimmedNonBlank,
  submittedAt: trimmedNonBlank,
  routedBy: positiveInteger,
  routedAt: trimmedNonBlank,
  reviewedAt: z.null(),
};

/** Proof-document metadata. The Directus file id never appears here. */
export const courseRequestDocumentSchema = z
  .object({
    documentId: positiveInteger,
    type: z.string(),
    fileName: z.string(),
    mimeType: z.string(),
    url: z.string(),
  })
  .strict();

/**
 * Actionable inbox row: own-school `RoutedToSchool` with a complete manual
 * route audit and null claim fields. Closed world: unknown keys fail.
 */
export const courseRequestActionableRowSchema = z
  .object({
    ...actionableRowBase,
    matchedSchoolCourseId: z.null(),
    reviewedBy: z.null(),
    documents: z.array(courseRequestDocumentSchema),
  })
  .strict();

/**
 * Finalizing inbox row: own-school `RoutedToSchool` locking the persisted
 * `matched_school_course_id` + original `reviewed_by` claim while
 * `reviewed_at` stays null until finalization. Closed world.
 */
export const courseRequestFinalizingRowSchema = z
  .object({
    ...actionableRowBase,
    matchedSchoolCourseId: positiveInteger,
    reviewedBy: positiveInteger,
    documents: z.array(courseRequestDocumentSchema),
  })
  .strict();

export type CourseRequestActionableRow = z.infer<typeof courseRequestActionableRowSchema>;
export type CourseRequestFinalizingRow = z.infer<typeof courseRequestFinalizingRowSchema>;

/**
 * Allowlisted Active same-school course candidate. Exactly five fields;
 * inactive statuses and unknown keys fail.
 */
export const courseRequestCandidateSchema = z
  .object({
    schoolCourseId: positiveInteger,
    courseName: trimmedNonBlank,
    courseCode: z.string().nullable(),
    degree: z.string().nullable(),
    courseStatus: z.literal("Active"),
  })
  .strict();

export type CourseRequestCandidate = z.infer<typeof courseRequestCandidateSchema>;

/**
 * School-scoped inbox. `routed` holds actionable rows, `finalizing` holds
 * claim-locked rows; the two arrays are mutually exclusive by schema.
 */
export const courseRequestInboxSchema = z
  .object({
    schoolId: positiveInteger,
    routed: z.array(courseRequestActionableRowSchema),
    finalizing: z.array(courseRequestFinalizingRowSchema),
    courses: z.array(courseRequestCandidateSchema),
  })
  .strict();

/** GET inbox DTO: exactly `{ inbox: { schoolId, routed, finalizing, courses } }`. */
export const courseRequestInboxResponseSchema = z
  .object({
    inbox: courseRequestInboxSchema,
  })
  .strict();

export type CourseRequestInboxResponse = z.infer<typeof courseRequestInboxResponseSchema>;

/**
 * Strict PATCH decision input. Unknown and ownership/status/education/roster
 * fields fail; approve requires a positive course id, reject requires
 * trimmed non-blank remarks.
 */
export const courseRequestDecisionInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("approve"),
      matched_school_course_id: positiveInteger,
    })
    .strict(),
  z
    .object({
      action: z.literal("reject"),
      remarks: trimmedNonBlank,
    })
    .strict(),
]);

export type CourseRequestDecisionInput = z.infer<typeof courseRequestDecisionInputSchema>;

/**
 * PATCH success DTO: exactly
 * `{ result: { courseRequestId, requestStatus, matchedSchoolCourseId,
 * reviewedBy, reviewedAt, adminRemarks } }`.
 */
export const courseRequestDecisionResultSchema = z
  .object({
    courseRequestId: positiveInteger,
    requestStatus: z.enum(["Approved", "Rejected"]),
    matchedSchoolCourseId: nullableInteger,
    reviewedBy: positiveInteger,
    reviewedAt: trimmedNonBlank,
    adminRemarks: nullableText,
  })
  .strict();

export const courseRequestDecisionResponseSchema = z
  .object({
    result: courseRequestDecisionResultSchema,
  })
  .strict();

export type CourseRequestDecisionResponse = z.infer<typeof courseRequestDecisionResponseSchema>;

export const courseRequestErrorCodeSchema = z.enum(COURSE_REQUEST_SCHOOL_ADMIN_ERROR_CODES);

/**
 * Error envelope: exactly `{ error, code }`. Contact/profile/document/raw
 * Directus fields never appear here.
 */
export const courseRequestErrorEnvelopeSchema = z
  .object({
    error: trimmedNonBlank,
    code: courseRequestErrorCodeSchema,
  })
  .strict();

export type CourseRequestErrorEnvelope = z.infer<typeof courseRequestErrorEnvelopeSchema>;

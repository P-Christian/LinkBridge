// src/modules/vos-admin/request-management/types/request.schema.ts

import { z } from 'zod';

export const approveSchoolRequestSchema = z.object({
  action: z.literal('Approved'),
  matched_school_id: z.number({
    message: 'A matched school ID is required for approval.',
  }).min(1, 'A matched school ID is required for approval.'),
  admin_remarks: z.string().optional(),
});

export const rejectRequestSchema = z.object({
  action: z.literal('Rejected'),
  admin_remarks: z.string().trim().min(1, 'Admin remarks are required when rejecting a request.'),
});

// We can accept either approve or reject for the review endpoint
export const reviewSchoolRequestSchema = z.discriminatedUnion('action', [
  approveSchoolRequestSchema,
  rejectRequestSchema,
]);

export const approveCourseRequestSchema = z.object({
  action: z.literal('Approved'),
  matched_school_course_id: z.number({
    message: 'A matched course ID is required for approval.',
  }).min(1, 'A matched course ID is required for approval.'),
  admin_remarks: z.string().optional(),
});

export const routeCourseRequestSchema = z.object({
  action: z.literal('RoutedToSchool'),
  admin_remarks: z.string().optional(),
});

export const reviewCourseRequestSchema = z.discriminatedUnion('action', [
  approveCourseRequestSchema,
  rejectRequestSchema,
  routeCourseRequestSchema,
]);

export type ReviewCourseRequestDecision = z.infer<typeof reviewCourseRequestSchema>;

export const createSchoolRequestSchema = z.object({
  requested_school_name: z.string().min(1, 'Proposed school name is required.'),
  city_municipality: z.string().optional(),
  province: z.string().optional(),
});

// --- Plan 2 Todo 3 (append-only): attendance-mode routing decision union ---
// Route/Group/Reject are accepted ONLY in attendance mode (see request.service
// mode dispatch). The legacy approve/reject union above stays intact for legacy
// mode. Reject reuses the shared rejectRequestSchema.

export const routeSchoolRequestSchema = z.object({
  action: z.literal('Route'),
  matched_school_id: z.number({
    message: 'A matched school ID is required to route a school request.',
  }).min(1, 'A matched school ID is required to route a school request.'),
});

export const groupSchoolRequestSchema = z.object({
  action: z.literal('Group'),
  matched_school_id: z.number({
    message: 'A matched school ID is required to group a school request.',
  }).min(1, 'A matched school ID is required to group a school request.'),
});

export const matchSchoolRequestSchema = z.object({
  action: z.literal('Match'),
  matched_school_id: z.number({
    message: 'A matched school ID is required to match a school request.',
  }).min(1, 'A matched school ID is required to match a school request.'),
});

// Attendance-mode decision body union: Route (+review-ready school) /
// Group (+waiting school) / Match (+any existing school, claims only) /
// Reject (+admin_remarks).
export const reviewSchoolRoutingSchema = z.discriminatedUnion('action', [
  routeSchoolRequestSchema,
  groupSchoolRequestSchema,
  matchSchoolRequestSchema,
  rejectRequestSchema,
]);

export type SchoolRoutingDecision = z.infer<typeof reviewSchoolRoutingSchema>;
export type RouteSchoolRequestDecision = z.infer<typeof routeSchoolRequestSchema>;
export type GroupSchoolRequestDecision = z.infer<typeof groupSchoolRequestSchema>;
export type MatchSchoolRequestDecision = z.infer<typeof matchSchoolRequestSchema>;


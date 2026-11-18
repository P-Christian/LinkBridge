import "server-only";

import { z } from "zod";

const nullableInteger = z.number().int().nullable();
const requesterId = z
  .union([z.number().int(), z.object({ user_id: z.number().int() })])
  .transform((value) => (typeof value === "number" ? value : value.user_id));

export const schoolRequestSchema = z.object({
  school_request_id: z.number().int(),
  requested_by: requesterId,
  requested_school_name: z.string(),
  city_municipality: z.string().nullable(),
  province: z.string().nullable(),
  request_status: z.enum(["Pending", "Approved", "Rejected", "RoutedToSchool", "AwaitingOptIn"]),
  matched_school_id: nullableInteger,
  admin_remarks: z.string().nullable(),
  reviewed_by: nullableInteger,
  reviewed_at: z.string().nullable(),
  routed_by: nullableInteger,
  routed_at: z.string().nullable(),
  employee_education_id: nullableInteger,
  active_employee_education_id: nullableInteger,
  created_at: z.string(),
});

export const educationSchema = z.object({
  employee_education_id: z.number().int(),
  user_id: z.number().int(),
  school_id: nullableInteger,
  school_name_raw: z.string().nullable(),
  education_status: z.enum(["Pending", "Verified", "Unverified"]),
});

export const schoolSchema = z.object({
  school_id: z.number().int(),
  school_name: z.string(),
  school_status: z.string(),
  verification_status: z.string(),
  is_active: z.union([z.boolean(), z.number()]),
});

export const schoolAdminSchema = z.object({
  school_admin_id: z.number().int(),
  school_id: z.number().int(),
  user_id: z.number().int(),
  is_active: z.union([z.boolean(), z.number()]),
});

export type ParsedSchoolRequest = z.infer<typeof schoolRequestSchema>;

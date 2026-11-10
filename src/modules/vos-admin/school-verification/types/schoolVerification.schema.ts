// src/modules/vos-admin/school-verification/types/schoolVerification.schema.ts
import { z } from "zod";

export const VerificationActionSchema = z.enum([
  "approve",
  "request_correction",
  "suspend",
]);

export const VerificationDecisionSchema = z.object({
  schoolId: z.number().int().positive("Invalid school ID"),
  action: VerificationActionSchema,
  rejectionReason: z.string().optional(),
  internalNotes: z.string().optional(),
});

export const SchoolVerificationFilterSchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  schoolType: z.string().optional(),
});

export type VerificationDecisionInput = z.infer<typeof VerificationDecisionSchema>;
export type SchoolVerificationFilterInput = z.infer<typeof SchoolVerificationFilterSchema>;

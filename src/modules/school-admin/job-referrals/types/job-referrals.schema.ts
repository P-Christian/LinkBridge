// src/modules/school-admin/job-referrals/types/job-referrals.schema.ts
import { z } from 'zod';

export const createReferralsSchema = z.object({
  job_id: z.number().int().positive({ message: "Valid Job ID is required" }),
  // No array cap: the wizard's "select all" sends the caller's whole eligible roster,
  // and createBatchReferralsService rejects any id outside that school.
  student_ids: z.array(z.number().int().positive()).min(1, { message: "Select at least one student to refer" }),
  referral_letter: z.string().max(20000, { message: "Referral letter is too long" }).optional(),
  expires_in_days: z.number().int().min(1).max(90).default(30),
});

export const generateLetterSchema = z.object({
  job: z.object({
    job_id: z.number().int().positive(),
    job_title: z.string().min(1),
    company_name: z.string().optional(),
    job_description: z.string().min(1),
    job_qualifications: z.string().min(1),
    job_type: z.string().optional(),
    work_arrangement: z.string().optional(),
  }),
  students: z.array(
    z.object({
      student_id: z.number().int().positive(),
      registered_user_id: z.number().int().positive(),
      full_name: z.string().min(1),
      email: z.string().email(),
      course_name: z.string().optional(),
      gpa: z.number().nullable().optional(),
      headline: z.string().optional(),
      summary: z.string().optional(),
      skills: z.array(z.string()).default([]),
      work_experiences: z.array(
        z.object({
          job_title: z.string(),
          company_name: z.string(),
          description: z.string().optional(),
        })
      ).default([]),
    })
  ).min(1, { message: "At least one candidate is required for generation" })
   .max(50, { message: "Too many candidates in one generation request" }),
  tone: z.enum(['professional', 'academic', 'enthusiastic', 'concise']).default('professional'),
  // Ignored by the handler: the endorsing identity always comes from the session.
  schoolName: z.string().max(200).optional(),
  adminName: z.string().max(200).optional(),
});

export type CreateReferralsSchemaInput = z.infer<typeof createReferralsSchema>;
export type GenerateLetterSchemaInput = z.infer<typeof generateLetterSchema>;

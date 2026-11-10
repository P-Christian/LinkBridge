import { z } from "zod";

export const freelancerSkillSchema = z.object({
    id: z.string(),
    label: z.string(),
});

export const resumeFileSchema = z.object({
    name: z.string(),
    updatedAt: z.string(),
    parsingStatus: z.enum(["OPTIMIZED", "PENDING", "FAILED"]),
});

export const freelancerProfileSchema = z.object({
    id: z.string(),
    fullName: z.string(),
    primaryRole: z.string(),
    email: z.string().email(),
    location: z.string(),
    summary: z.string(),
    skills: z.array(freelancerSkillSchema),
    resumeFile: resumeFileSchema.nullable(),
});

export type FreelancerProfilePayload = z.infer<typeof freelancerProfileSchema>;

export const workExperienceMediaSchema = z.object({
    id: z.number().optional(), // optional because it might be new
    media_type: z.string().min(1),
    media_url: z.string().url(),
    media_title: z.string().nullable().optional(),
    media_description: z.string().nullable().optional(),
});

export const addWorkExperienceSchema = z.object({
    company_name: z.string().min(1, "Company name is required").max(255),
    location: z.string().nullable().optional(),
    location_type: z.string().nullable().optional(),
    job_title: z.string().min(1, "Job title is required").max(255),
    employment_type: z.string().nullable().optional(),
    start_date: z.string().min(1, "Start date is required"), // Expected format YYYY-MM-DD
    end_date: z.string().nullable().optional(),
    is_current_role: z.boolean().default(false),
    job_description: z.string().nullable().optional(),
    discovery_source: z.string().nullable().optional(),
    media: z.array(workExperienceMediaSchema).optional(),
    skills: z.array(z.object({
        skill_id: z.number()
    })).optional(),
});

export const updateWorkExperienceSchema = addWorkExperienceSchema.extend({
    id: z.number(),
});

export const deleteWorkExperienceSchema = z.object({
    id: z.number(),
});

export type AddWorkExperiencePayload = z.infer<typeof addWorkExperienceSchema>;
export type UpdateWorkExperiencePayload = z.infer<typeof updateWorkExperienceSchema>;
export type DeleteWorkExperiencePayload = z.infer<typeof deleteWorkExperienceSchema>;

export const addEducationSchema = z.object({
    school_id: z.number().int().positive().nullable().optional(),
    school_name_raw: z.string().trim().min(1).max(255).nullable().optional(),
    course_name_raw: z.string().trim().min(1).max(255).nullable().optional(),
    // Verification status is server-owned: the boundary strips any client
    // value and persistence always writes Pending, so it is not accepted here.
    school_course_id: z.number().int().positive().nullable().optional(),
    course_request_draft_key: z.uuid(),
    start_date: z.iso.date().nullable().optional(),
    end_date: z.iso.date().nullable().optional(),
});

export const updateEducationSchema = addEducationSchema.extend({
    id: z.number(),
    course_request_draft_key: z.uuid().nullable().optional(),
});

export const deleteEducationSchema = z.object({
    id: z.number(),
});

export type AddEducationPayload = z.infer<typeof addEducationSchema>;
export type UpdateEducationPayload = z.infer<typeof updateEducationSchema>;
export type DeleteEducationPayload = z.infer<typeof deleteEducationSchema>;

export const addCertificationSchema = z.object({
    certificate_name: z.string().min(1, "Certificate Name is required").max(255),
    issuing_organization: z.string().min(1, "Issuing Organization is required").max(255),
    issue_date: z.string().nullable().optional(),
    credential_url: z.string().max(500).nullable().optional(),
    image_uuid: z.string().max(255).nullable().optional(),
});

export const updateCertificationSchema = addCertificationSchema.extend({
    id: z.number(),
});

export const deleteCertificationSchema = z.object({
    id: z.number(),
});

export type AddCertificationPayload = z.infer<typeof addCertificationSchema>;
export type UpdateCertificationPayload = z.infer<typeof updateCertificationSchema>;
export type DeleteCertificationPayload = z.infer<typeof deleteCertificationSchema>;

export const updatePersonalInfoSchema = z.object({
    user_fname: z.string().min(1, "First name is required").max(255).optional(),
    user_mname: z.string().max(255).nullable().optional(),
    user_lname: z.string().min(1, "Last name is required").max(255).optional(),
    suffix_name: z.string().max(20).nullable().optional(),
    nickname: z.string().max(20).nullable().optional(),
    user_contact: z.string().max(255).optional(),
    user_bday: z.string().nullable().optional(),
    gender: z.string().max(20).nullable().optional(),
    civil_status: z.string().max(20).nullable().optional(),
    blood_type: z.string().max(5).nullable().optional(),
    religion: z.string().max(100).nullable().optional(),
    nationality: z.string().max(100).nullable().optional(),
    place_of_birth: z.string().max(150).nullable().optional(),
    user_province: z.string().max(255).nullable().optional(),
    user_city: z.string().max(255).nullable().optional(),
    user_brgy: z.string().max(255).nullable().optional(),
});

export type UpdatePersonalInfoPayload = z.infer<typeof updatePersonalInfoSchema>;

export const jobPreferencesSchema = z.object({
    job_type: z.string().nullable().optional(),
    work_setup: z.string().nullable().optional(),
    preferred_location: z.string().nullable().optional(),
    salary_range_min: z.number().nullable().optional(),
    salary_range_max: z.number().nullable().optional(),
    currency: z.string().nullable().optional(),
    availability: z.string().nullable().optional(),
    preferred_industry: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
});

export type JobPreferencesPayload = z.infer<typeof jobPreferencesSchema>;

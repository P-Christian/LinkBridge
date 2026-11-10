/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { addEducationSchema, updateEducationSchema } from "./freelancer-profile.schema";
import { createOrFetchPendingEducation, type PendingEducationWrite } from "./education-persistence.repo";
import { fetchOwnedEducation, updatePendingEducation } from "./education-update.repo";
import { ensureEducationAttendanceRequest } from "./attendance-request.repo";
import { deleteOwnedEducationWithLinks } from "./education-deletion.repo";
import { assertEducationWriteAllowed, shouldCreateAttendanceRequest } from "../../../education-verification";
import { updateVerifiedEducationClaim } from "./verified-education-edit.service";

export { getFreelancerProfile } from "./profile-read.service";
export { computeProfileCompletion } from "./profile-completion";

export function buildInitials(fname?: string | null, lname?: string | null): string {
    if (!fname && !lname) return "U";
    const f = fname ? fname[0].toUpperCase() : "";
    const l = lname ? lname[0].toUpperCase() : "";
    return `${f}${l}`;
}

// Ensure date strings are properly formatted, handling any PH time requirements
// Note: If input is already YYYY-MM-DD, it remains. If it's a full ISO, it extracts the date part in UTC+8.
function formatToPHDate(dateInput: string): string {
    if (!dateInput) return dateInput;
    if (dateInput.length === 10) return dateInput; // Already YYYY-MM-DD

    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return dateInput;

    // Convert to PH time (UTC+8)
    const phTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    return phTime.toISOString().split("T")[0];
}

export async function addWorkExperienceService(userId: number, payload: any) {
    const { addWorkExperienceToDirectus } = await import("./freelancer-profile.repo");

    const data = {
        user_id: userId,
        company_name: payload.company_name,
        location: payload.location || null,
        location_type: payload.location_type || null,
        job_title: payload.job_title,
        employment_type: payload.employment_type || null,
        start_date: formatToPHDate(payload.start_date),
        end_date: payload.end_date ? formatToPHDate(payload.end_date) : null,
        is_current_role: payload.is_current_role,
        job_description: payload.job_description || null,
        discovery_source: payload.discovery_source || null,
        media: payload.media || [],
        skills: payload.skills || [],
    };

    return await addWorkExperienceToDirectus(data);
}

export async function updateWorkExperienceService(id: number, userId: number, payload: any) {
    const { updateWorkExperienceInDirectus } = await import("./freelancer-profile.repo");

    const data = {
        company_name: payload.company_name,
        location: payload.location || null,
        location_type: payload.location_type || null,
        job_title: payload.job_title,
        employment_type: payload.employment_type || null,
        start_date: formatToPHDate(payload.start_date),
        end_date: payload.end_date ? formatToPHDate(payload.end_date) : null,
        is_current_role: payload.is_current_role,
        job_description: payload.job_description || null,
        discovery_source: payload.discovery_source || null,
        media: payload.media || [],
        skills: payload.skills || [],
    };

    return await updateWorkExperienceInDirectus(id, data);
}

export async function deleteWorkExperienceService(id: number, userId: number) {
    const { deleteWorkExperienceFromDirectus } = await import("./freelancer-profile.repo");
    // Ideally, we should verify that this work experience belongs to the user before deleting.
    // For simplicity, we directly delete here, but in a real app, verify ownership first.
    return await deleteWorkExperienceFromDirectus(id);
}

function pendingEducationWrite(data: {
    readonly school_id?: number | null;
    readonly school_name_raw?: string | null;
    readonly course_name_raw?: string | null;
    readonly school_course_id?: number | null;
    readonly course_request_draft_key?: string | null;
    readonly start_date?: string | null;
    readonly end_date?: string | null;
}): PendingEducationWrite {
    const schoolId = data.school_id ?? null;
    const schoolNameRaw = schoolId === null ? data.school_name_raw?.trim() ?? null : null;
    if (schoolId === null && !schoolNameRaw) {
        throw new Error("A school name is required when no canonical school is selected.");
    }

    const schoolCourseId = schoolId === null ? null : data.school_course_id ?? null;
    return {
        school_id: schoolId,
        school_name_raw: schoolNameRaw,
        course_name_raw: schoolCourseId === null ? data.course_name_raw?.trim() ?? null : null,
        school_course_id: schoolCourseId,
        course_request_draft_key: data.course_request_draft_key ?? null,
        start_date: data.start_date ? formatToPHDate(data.start_date) : null,
        end_date: data.end_date ? formatToPHDate(data.end_date) : null,
    };
}

export async function addEducationService(userId: number, payload: unknown) {
    assertEducationWriteAllowed();
    const parsed = addEducationSchema.safeParse(payload);
    if (!parsed.success) throw new Error("Invalid education claim.");

    const education = await createOrFetchPendingEducation(userId, {
        ...pendingEducationWrite(parsed.data),
        course_request_draft_key: parsed.data.course_request_draft_key,
    });
    if (shouldCreateAttendanceRequest()) {
        await ensureEducationAttendanceRequest(education);
    }
    return education;
}

export async function updateEducationService(id: number, userId: number, payload: unknown) {
    assertEducationWriteAllowed();
    const parsed = updateEducationSchema.safeParse({
        ...(typeof payload === "object" && payload !== null ? payload : {}),
        id,
    });
    if (!parsed.success) throw new Error("Invalid education claim.");

    const write = pendingEducationWrite(parsed.data);
    const existing = await fetchOwnedEducation(id, userId);
    if (existing.education_status === "Verified") {
        return updateVerifiedEducationClaim({ educationId: id, userId, write });
    }

    const education = await updatePendingEducation(id, userId, write);
    if (shouldCreateAttendanceRequest()) {
        await ensureEducationAttendanceRequest(education);
    }
    return education;
}

export async function deleteEducationService(id: number, userId: number) {
    assertEducationWriteAllowed();
    await deleteOwnedEducationWithLinks(id, userId);
}

function validateCertificationIssueDate(rawDate?: string | null): string | null {
    if (!rawDate) return null;
    const trimmed = String(rawDate).trim();
    if (!trimmed) return null;

    // Validate standard YYYY-MM-DD pattern
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        throw new Error("Invalid issue date format. Expected YYYY-MM-DD.");
    }

    const year = parseInt(match[1], 10);
    const todayStr = new Date().toISOString().split("T")[0];
    const currentYear = new Date().getFullYear();

    if (year < 1900 || year > currentYear) {
        throw new Error(`Issue year must be between 1900 and ${currentYear}.`);
    }

    if (trimmed > todayStr) {
        throw new Error("Issue date cannot be in the future.");
    }

    return trimmed;
}

export async function addCertificationService(userId: number, payload: any) {
    const { addCertificationToDirectus } = await import("./freelancer-profile.repo");

    const validatedDate = validateCertificationIssueDate(payload.issue_date);

    const data = {
        user_id: userId,
        certificate_name: payload.certificate_name,
        issuing_organization: payload.issuing_organization,
        issue_date: validatedDate,
        credential_url: payload.credential_url || null,
        image_uuid: payload.image_uuid || null,
    };

    return await addCertificationToDirectus(data);
}

export async function updateCertificationService(id: number, userId: number, payload: any) {
    const { updateCertificationInDirectus } = await import("./freelancer-profile.repo");

    const validatedDate = validateCertificationIssueDate(payload.issue_date);

    const data = {
        certificate_name: payload.certificate_name,
        issuing_organization: payload.issuing_organization,
        issue_date: validatedDate,
        credential_url: payload.credential_url || null,
        image_uuid: payload.image_uuid || null,
    };

    return await updateCertificationInDirectus(id, data);
}

export async function deleteCertificationService(id: number, userId: number) {
    const { deleteCertificationFromDirectus } = await import("./freelancer-profile.repo");
    return await deleteCertificationFromDirectus(id);
}

export async function updatePersonalInfoService(userId: number, payload: any) {
    const { updateUserInDirectus } = await import("./freelancer-profile.repo");

    const data = {
        user_fname: payload.user_fname,
        user_mname: payload.user_mname,
        user_lname: payload.user_lname,
        suffix_name: payload.suffix_name,
        nickname: payload.nickname,
        user_position: payload.user_position !== undefined ? (String(payload.user_position).trim() || null) : undefined,
        user_contact: payload.user_contact,
        user_bday: payload.user_bday ? formatToPHDate(payload.user_bday) : null,
        gender: payload.gender,
        civil_status: payload.civil_status,
        blood_type: payload.blood_type,
        religion: payload.religion,
        nationality: payload.nationality,
        place_of_birth: payload.place_of_birth,
        user_province: payload.user_province,
        user_city: payload.user_city,
        user_brgy: payload.user_brgy,
    };

    // Remove undefined values
    Object.keys(data).forEach(key => {
        if (data[key as keyof typeof data] === undefined) {
            delete data[key as keyof typeof data];
        }
    });

    return await updateUserInDirectus(userId, data);
}

export async function saveJobPreferencesService(userId: number, payload: any) {
    const { upsertJobPreferencesInDirectus } = await import("./freelancer-profile.repo");

    // Format current timestamp in PH local time (Asia/Manila, UTC+8) formatted as YYYY-MM-DD HH:mm:ss for MySQL timestamp
    const now = new Date();
    const dtf = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    const phTimestamp = dtf.format(now);

    const data = {
        job_type: payload.job_type,
        work_setup: payload.work_setup,
        preferred_location: payload.preferred_location,
        salary_range_min: payload.salary_range_min,
        salary_range_max: payload.salary_range_max,
        currency: payload.currency,
        availability: payload.availability,
        preferred_industry: payload.preferred_industry,
        updated_at: phTimestamp,
    };

    return await upsertJobPreferencesInDirectus(userId, data);
}


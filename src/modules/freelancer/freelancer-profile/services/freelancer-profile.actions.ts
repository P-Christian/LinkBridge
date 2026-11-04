/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { generateProfessionalSummaryWithGemini } from "@/lib/gemini/resumeParser";
import { checkRestriction } from "@/lib/status-validator";
import { DEV_BYPASS_USER_ID, isDevAuthBypassEnabled } from "@/lib/dev-auth-bypass";
import { getJwtVerificationSecret } from "@/modules/auth/registration/registration.session";
import {
    FREELANCER_AVATAR_UPLOAD_POLICY,
    FREELANCER_PROFILE_MEDIA_UPLOAD_POLICY,
    getUploadedFile,
    safeFileName,
    validateUploadedFile,
} from "@/lib/file-upload";
import { VsMasterSkill } from "../types/freelancer-profile.types";

const PROFILE_ASSETS_FOLDER_ID = '1cd008d3-4d24-4da5-bcd5-adf0b9e99d69';

async function getAuthenticatedUserId(): Promise<number> {
    if (isDevAuthBypassEnabled()) return DEV_BYPASS_USER_ID;
    const token = (await cookies()).get("vos_sync_access_token")?.value;
    if (!token) throw new Error("Unauthorized.");

    try {
        const { payload } = await jwtVerify(token, getJwtVerificationSecret());
        const userId = Number(payload.sub || payload.user_id || payload.id);
        if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Unauthorized.");
        return userId;
    } catch (error: unknown) {
        if (error instanceof Error && error.message === "Unauthorized.") throw error;
        throw new Error("Unauthorized.", { cause: error });
    }
}

/**
 * Row-scoped writes must prove the record belongs to the session user before
 * the primary key is interpolated into a Directus path.
 */
async function assertOwnedRow(collection: string, id: number, userId: number): Promise<void> {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    const rowId = Number(id);
    if (!Number.isSafeInteger(rowId) || rowId <= 0) throw new Error("Record not found.");

    const res = await fetch(`${NEXT_PUBLIC_API_BASE_URL}/items/${collection}/${rowId}?fields=user_id`, {
        headers: { "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}` },
        cache: "no-store"
    });

    if (!res.ok) throw new Error("Record not found.");

    const json = await res.json();
    if (!json.data || Number(json.data.user_id) !== userId) {
        throw new Error("You can only modify your own records.");
    }
}

export async function updateProfessionalSummaryAction(summary: string) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    const userId = await getAuthenticatedUserId();

    // The target row is resolved from the session, never from the call arguments
    let targetProfileId: number | undefined;
    let method = "POST";

    const checkUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_job_seeker_profile?filter[user_id][_eq]=${userId}`;
    const checkRes = await fetch(checkUrl, {
        headers: { "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}` },
        cache: "no-store"
    });
    if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.data && checkData.data.length > 0) {
            targetProfileId = checkData.data[0].profile_id;
            method = "PATCH";
        }
    }

    const url = targetProfileId
        ? `${NEXT_PUBLIC_API_BASE_URL}/items/vs_job_seeker_profile/${targetProfileId}`
        : `${NEXT_PUBLIC_API_BASE_URL}/items/vs_job_seeker_profile`;

    const body = targetProfileId
        ? { professional_summary: summary }
        : { professional_summary: summary, user_id: userId };

    const res = await fetch(url, {
        method,
        headers: {
            "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        let errDetails = "";
        try {
            errDetails = await res.text();
        } catch {
            errDetails = "Could not parse error details";
        }
        throw new Error(`Failed to update professional summary: HTTP ${res.status} - ${errDetails}`);
    }

    revalidatePath("/(vos-sync)/vos-sync/freelancer/profile");

    return { success: true };
}

export async function generateProfessionalSummaryAction(profileJson: string) {
    try {
        await getAuthenticatedUserId();
        const summary = await generateProfessionalSummaryWithGemini(profileJson);

        if (!summary) {
            return { success: false, error: "Failed to generate professional summary" };
        }

        return { success: true, summary };
    } catch (err: unknown) {
        console.error("generateProfessionalSummaryAction Error:", err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}

export async function searchMasterSkillsAction(query: string) {
    if (!query || query.length < 2) return [];

    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    const url = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_master_skills?filter[skill_name][_icontains]=${encodeURIComponent(query)}&limit=20`;

    const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}` },
        cache: "no-store"
    });

    if (!res.ok) {
        console.error("Failed to search master skills", await res.text());
        return [];
    }

    const data = await res.json();
    return data.data || [];
}

export async function addCustomMasterSkillAction(skillName: string): Promise<VsMasterSkill> {
    await getAuthenticatedUserId();
    const trimmed = skillName.trim();
    if (!trimmed) {
        throw new Error("Skill name cannot be empty.");
    }

    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    // 1. Check if the skill already exists (case-insensitive check)
    const checkUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_master_skills?filter[skill_name][_eq]=${encodeURIComponent(trimmed)}&limit=1`;
    const checkRes = await fetch(checkUrl, {
        headers: { "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}` },
        cache: "no-store",
    });

    if (checkRes.ok) {
        const checkJson = await checkRes.json();
        const existing = checkJson.data || [];
        if (existing.length > 0) {
            return {
                id: Number(existing[0].id),
                skill_name: existing[0].skill_name,
            };
        }
    }

    // 2. Insert new custom skill into vs_master_skills
    const insertUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_master_skills`;
    const insertRes = await fetch(insertUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ skill_name: trimmed }),
    });

    if (!insertRes.ok) {
        const errText = await insertRes.text();
        throw new Error(`Failed to create custom skill: ${errText}`);
    }

    const insertJson = await insertRes.json();
    return {
        id: Number(insertJson.data.id),
        skill_name: insertJson.data.skill_name,
    };
}

export async function resolveSkillsAction(skillNames: string[]) {
    if (!skillNames || skillNames.length === 0) return [];

    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    const namesParam = skillNames.map(n => encodeURIComponent(n)).join(',');
    const url = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_master_skills?filter[skill_name][_in]=${namesParam}`;

    const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}` },
        cache: "no-store"
    });

    if (!res.ok) {
        console.error("Failed to resolve skills", await res.text());
        return [];
    }

    const json = await res.json();
    return json.data || [];
}

export async function saveUserSkillsAction(_userId: number, initialSkillIds: number[], newSkillIds: number[]) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    const userId = await getAuthenticatedUserId();

    const toAdd = newSkillIds.filter(id => !initialSkillIds.includes(id));
    const toRemove = initialSkillIds.filter(id => !newSkillIds.includes(id));

    // 1. Add new skills directly to junction table
    if (toAdd.length > 0) {
        const addUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_user_skills_map`;
        const addPayload = toAdd.map(skillId => ({
            user_id: userId,
            skill_id: skillId
        }));

        const addRes = await fetch(addUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(addPayload)
        });

        if (!addRes.ok) {
            let errText = "Unknown error";
            try { errText = await addRes.text(); } catch { }
            throw new Error(`Failed to insert new skills: HTTP ${addRes.status} - ${errText}`);
        }
    }

    // 2. Remove deleted skills
    if (toRemove.length > 0) {
        // Query the actual IDs of the rows to delete
        const filterUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_user_skills_map?filter[user_id][_eq]=${userId}&filter[skill_id][_in]=${toRemove.join(',')}&fields=id`;
        const filterRes = await fetch(filterUrl, {
            method: "GET",
            headers: { "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}` }
        });

        if (filterRes.ok) {
            const filterData = await filterRes.json();
            const idsToDelete = filterData.data?.map((row: any) => row.id) || [];

            if (idsToDelete.length > 0) {
                // Bulk delete the mapped IDs
                const delRes = await fetch(`${NEXT_PUBLIC_API_BASE_URL}/items/vs_user_skills_map`, {
                    method: "DELETE",
                    headers: {
                        "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(idsToDelete)
                });

                if (!delRes.ok) {
                    let errText = "Unknown error";
                    try { errText = await delRes.text(); } catch { }
                    console.error(`Failed to bulk delete skills: HTTP ${delRes.status} - ${errText}`);
                }
            }
        }
    }

    revalidatePath("/(vos-sync)/vos-sync/freelancer/profile");
    return { success: true };
}

export async function addWorkExperienceAction(_userId: number, payload: any) {
    const { addWorkExperienceService } = await import("./freelancer-profile.service");

    try {
        await addWorkExperienceService(await getAuthenticatedUserId(), payload);
        revalidatePath("/(vos-sync)/vos-sync/freelancer/profile");
        return { success: true };
    } catch (err: any) {
        console.error("addWorkExperienceAction Error:", err);
        return { success: false, error: err.message };
    }
}

export async function updateWorkExperienceAction(id: number, _userId: number, payload: any) {
    const { updateWorkExperienceService } = await import("./freelancer-profile.service");

    try {
        const userId = await getAuthenticatedUserId();
        await assertOwnedRow("vs_work_experience", id, userId);
        await updateWorkExperienceService(id, userId, payload);
        revalidatePath("/(vos-sync)/vos-sync/freelancer/profile");
        return { success: true };
    } catch (err: any) {
        console.error("updateWorkExperienceAction Error:", err);
        return { success: false, error: err.message };
    }
}

export async function deleteWorkExperienceAction(id: number) {
    const { deleteWorkExperienceService } = await import("./freelancer-profile.service");

    try {
        const userId = await getAuthenticatedUserId();
        await assertOwnedRow("vs_work_experience", id, userId);
        await deleteWorkExperienceService(id, userId);
        revalidatePath("/(vos-sync)/vos-sync/freelancer/profile");
        return { success: true };
    } catch (err: any) {
        console.error("deleteWorkExperienceAction Error:", err);
        return { success: false, error: err.message };
    }
}

export async function uploadMediaAction(formData: FormData) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        return { success: false, error: "Directus API URL or Static Token is not configured." };
    }

    try {
        const userId = await getAuthenticatedUserId();
        const isRestricted = await checkRestriction(userId, "UPLOAD_PROFILE_FILES");
        if (isRestricted) {
            throw new Error("Your profile file upload privileges are temporarily suspended.");
        }

        const file = getUploadedFile(formData);
        await validateUploadedFile(file, FREELANCER_PROFILE_MEDIA_UPLOAD_POLICY);

        // The Directus payload is rebuilt server-side: caller metadata such as
        // folder or filename_download never reaches the files endpoint.
        const directusFormData = new FormData();
        directusFormData.append("file", file, safeFileName(file.name));
        directusFormData.append("folder", PROFILE_ASSETS_FOLDER_ID);

        const res = await fetch(`${NEXT_PUBLIC_API_BASE_URL}/files`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`
            },
            body: directusFormData,
            cache: "no-store",
        });

        if (!res.ok) {
            let errText = "Unknown error";
            try { errText = await res.text(); } catch { }
            throw new Error(`Failed to upload media: HTTP ${res.status} - ${errText}`);
        }

        const json = await res.json();
        return { success: true, url: json.data.id, id: json.data.id };
    } catch (err: any) {
        console.error("uploadMediaAction Error:", err);
        return { success: false, error: err.message };
    }
}

export async function addEducationAction(_userId: number, payload: any) {
    const { addEducationService } = await import("./freelancer-profile.service");

    try {
        const userId = await getAuthenticatedUserId();
        await addEducationService(userId, payload);
        revalidatePath("/(vos-sync)/vos-sync/freelancer/profile");
        return { success: true };
    } catch (err: any) {
        console.error("addEducationAction Error:", err);
        return { success: false, error: err.message };
    }
}

export async function updateEducationAction(id: number, _userId: number, payload: any) {
    const { updateEducationService } = await import("./freelancer-profile.service");

    try {
        const userId = await getAuthenticatedUserId();
        await updateEducationService(id, userId, payload);
        revalidatePath("/(vos-sync)/vos-sync/freelancer/profile");
        return { success: true };
    } catch (err: any) {
        console.error("updateEducationAction Error:", err);
        return { success: false, error: err.message };
    }
}

export async function deleteEducationAction(id: number) {
    const { deleteEducationService } = await import("./freelancer-profile.service");

    try {
        const userId = await getAuthenticatedUserId();
        await deleteEducationService(id, userId);
        revalidatePath("/(vos-sync)/vos-sync/freelancer/profile");
        return { success: true };
    } catch (err: any) {
        console.error("deleteEducationAction Error:", err);
        return { success: false, error: err.message };
    }
}

export async function addCertificationAction(_userId: number, payload: any) {
    const { addCertificationService } = await import("./freelancer-profile.service");

    try {
        await addCertificationService(await getAuthenticatedUserId(), payload);
        revalidatePath("/(vos-sync)/vos-sync/freelancer/profile");
        return { success: true };
    } catch (err: any) {
        console.error("addCertificationAction Error:", err);
        return { success: false, error: err.message };
    }
}

export async function updateCertificationAction(id: number, _userId: number, payload: any) {
    const { updateCertificationService } = await import("./freelancer-profile.service");

    try {
        const userId = await getAuthenticatedUserId();
        await assertOwnedRow("vs_certifications", id, userId);
        await updateCertificationService(id, userId, payload);
        revalidatePath("/(vos-sync)/vos-sync/freelancer/profile");
        return { success: true };
    } catch (err: any) {
        console.error("updateCertificationAction Error:", err);
        return { success: false, error: err.message };
    }
}

export async function deleteCertificationAction(id: number) {
    const { deleteCertificationService } = await import("./freelancer-profile.service");

    try {
        const userId = await getAuthenticatedUserId();
        await assertOwnedRow("vs_certifications", id, userId);
        await deleteCertificationService(id, userId);
        revalidatePath("/(vos-sync)/vos-sync/freelancer/profile");
        return { success: true };
    } catch (err: any) {
        console.error("deleteCertificationAction Error:", err);
        return { success: false, error: err.message };
    }
}

export async function updatePersonalInfoAction(_userId: number, payload: any) {
    const { updatePersonalInfoService } = await import("./freelancer-profile.service");

    try {
        await updatePersonalInfoService(await getAuthenticatedUserId(), payload);
        revalidatePath("/(vos-sync)/vos-sync/freelancer/profile");
        return { success: true };
    } catch (err: any) {
        console.error("updatePersonalInfoAction Error:", err);
        return { success: false, error: err.message };
    }
}

export async function updateProfileVisibilityAction(_userId: number, profileId: number | undefined, visibility: string) {
    const { upsertJobSeekerProfileInDirectus } = await import("./freelancer-profile.repo");

    try {
        const userId = await getAuthenticatedUserId();
        await upsertJobSeekerProfileInDirectus(userId, profileId, { profile_visibility: visibility });
        revalidatePath("/(vos-sync)/vos-sync/freelancer/profile");
        return { success: true };
    } catch (err: any) {
        console.error("updateProfileVisibilityAction Error:", err);
        return { success: false, error: err.message };
    }
}

export async function saveAllProfileChangesAction(payload: any) {
    const { profileId, personalInfo, visibility, professionalSummary, skills, initialSkillIds, education, workExperience, certifications, jobPreferences } = payload;

    // Import all services
    const {
        updatePersonalInfoService,
        addEducationService, updateEducationService, deleteEducationService,
        addWorkExperienceService, updateWorkExperienceService, deleteWorkExperienceService,
        addCertificationService, updateCertificationService, deleteCertificationService,
        saveJobPreferencesService, computeProfileCompletion
    } = await import("./freelancer-profile.service");

    const { upsertJobSeekerProfileInDirectus } = await import("./freelancer-profile.repo");

    try {
        const userId = await getAuthenticatedUserId();
        if (personalInfo) {
            await updatePersonalInfoService(userId, personalInfo);
        }

        if (visibility !== null || professionalSummary !== null) {
            const profileUpdates: any = {};
            if (visibility !== null) profileUpdates.profile_visibility = visibility;
            if (professionalSummary !== null) profileUpdates.professional_summary = professionalSummary;
            await upsertJobSeekerProfileInDirectus(userId, profileId, profileUpdates);
        }

        if (education && education.length > 0) {
            for (const action of education) {
                if (action.type === 'ADD') await addEducationService(userId, action.payload);
                else if (action.type === 'UPDATE') await updateEducationService(action.id, userId, action.payload);
                else if (action.type === 'DELETE') {
                    try {
                        await deleteEducationService(action.id, userId);
                    } catch (delErr: any) {
                        // If record was already deleted or not found, do not abort saving the rest of the profile
                        if (delErr?.name === "EducationDeletionError" || delErr?.message?.includes("not found")) {
                            console.warn(`Education deletion warning for id ${action.id}:`, delErr.message);
                        } else {
                            throw delErr;
                        }
                    }
                }
            }
        }

        if (workExperience && workExperience.length > 0) {
            for (const action of workExperience) {
                if (action.type === 'ADD') await addWorkExperienceService(userId, action.payload);
                else if (action.type === 'UPDATE') await updateWorkExperienceService(action.id, userId, action.payload);
                else if (action.type === 'DELETE') await deleteWorkExperienceService(action.id, userId);
            }
        }

        if (certifications && certifications.length > 0) {
            for (const action of certifications) {
                if (action.type === 'ADD') await addCertificationService(userId, action.payload);
                else if (action.type === 'UPDATE') await updateCertificationService(action.id, userId, action.payload);
                else if (action.type === 'DELETE') await deleteCertificationService(action.id, userId);
            }
        }

        if (skills !== null) {
            await saveUserSkillsAction(userId, initialSkillIds || [], skills);
        }

        if (jobPreferences !== null && jobPreferences !== undefined) {
            await saveJobPreferencesService(userId, jobPreferences);
        }

        // Recalculate Profile Completion
        const { getFreelancerProfile } = await import("./freelancer-profile.service");
        const { updateJobSeekerProfileCompletion } = await import("./freelancer-profile.repo");

        const token = (await cookies()).get("vos_sync_access_token")?.value;

        if (token) {
            const updatedProfile = await getFreelancerProfile(token);
            if (updatedProfile && updatedProfile.job_seeker_profile?.[0]) {
                const { fetchUserVerifications } = await import("./identity-verification.repo");
                const verifications = await fetchUserVerifications(updatedProfile.user_id);
                const { percent, status } = computeProfileCompletion(updatedProfile, verifications);
                await updateJobSeekerProfileCompletion(updatedProfile.job_seeker_profile[0].profile_id, percent, status);
            }
        }

        const { revalidatePath } = await import("next/cache");
        revalidatePath("/(vos-sync)/vos-sync/freelancer/profile");

        return { success: true };
    } catch (err: any) {
        console.error("saveAllProfileChangesAction Error:", err);
        return { success: false, error: err.message };
    }
}

export async function saveSocialLinksAction(_userId: number, links: any[]) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    try {
        const userId = await getAuthenticatedUserId();
        const getUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_user_social_links?filter[user_id][_eq]=${userId}`;
        const getRes = await fetch(getUrl, {
            headers: { "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}` },
            cache: "no-store"
        });
        if (getRes.ok) {
            const getData = await getRes.json();
            if (getData.data && getData.data.length > 0) {
                const ids = getData.data.map((l: any) => l.id);
                const deleteUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_user_social_links`;
                await fetch(deleteUrl, {
                    method: "DELETE",
                    headers: {
                        "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(ids)
                });
            }
        }

        const socialLinks = (links || []).slice(0, 20).filter(link => String(link?.profile_url || "").trim()).map(link => {
            const url = new URL(String(link.profile_url).trim());
            if (!["http:", "https:"].includes(url.protocol)) {
                throw new Error("Social profile links must be http or https URLs.");
            }
            return {
                user_id: userId,
                platform_name: String(link?.platform_name || "").trim().slice(0, 50),
                profile_url: url.toString().slice(0, 500)
            };
        });

        if (socialLinks.length > 0) {
            const insertUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_user_social_links`;
            const insertRes = await fetch(insertUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(socialLinks)
            });
            if (!insertRes.ok) throw new Error("Failed to insert social links");
        }

        return { success: true };
    } catch (err: unknown) {
        console.error("saveSocialLinksAction Error:", err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}

export async function uploadProfileImageAction(_userId: number, formData: FormData) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    let fileId: string | null = null;
    try {
        const userId = await getAuthenticatedUserId();
        const isRestricted = await checkRestriction(userId, "UPLOAD_PROFILE_FILES");
        if (isRestricted) {
            throw new Error("Your profile file upload privileges are temporarily suspended.");
        }

        const file = getUploadedFile(formData);
        await validateUploadedFile(file, FREELANCER_AVATAR_UPLOAD_POLICY);

        const uploadUrl = `${NEXT_PUBLIC_API_BASE_URL}/files`;
        const directusFormData = new FormData();
        directusFormData.append("file", file, safeFileName(file.name, "avatar"));
        directusFormData.append("folder", PROFILE_ASSETS_FOLDER_ID);

        const uploadRes = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}` },
            body: directusFormData,
            cache: "no-store",
        });

        if (!uploadRes.ok) throw new Error(`Failed to upload media: HTTP ${uploadRes.status}`);
        const json = await uploadRes.json();
        fileId = json.data?.id || null;
        if (!fileId) throw new Error("Directus returned no uploaded file ID.");

        const updateUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_user/${userId}`;
        const updateRes = await fetch(updateUrl, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ profile_image_url: fileId })
        });

        if (!updateRes.ok) throw new Error(`Failed to update user profile image: HTTP ${updateRes.status}`);

        const { revalidatePath } = await import("next/cache");
        revalidatePath("/(vos-sync)/vos-sync/freelancer/profile");
        return { success: true, fileId };
    } catch (err: unknown) {
        if (fileId) {
            try {
                await fetch(`${NEXT_PUBLIC_API_BASE_URL}/files/${encodeURIComponent(fileId)}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}` },
                    cache: "no-store",
                });
            } catch (cleanupError) {
                console.error("Failed to compensate profile image upload:", cleanupError);
            }
        }
        console.error("uploadProfileImageAction Error:", err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}

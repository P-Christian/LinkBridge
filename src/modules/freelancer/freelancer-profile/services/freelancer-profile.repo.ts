/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/modules/freelancer/freelancer-profile/services/freelancer-profile.repo.ts

export async function fetchFreelancerProfileFromDirectus(email: string) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    const url = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_user?filter[user_email][_eq]=${encodeURIComponent(email)}&fields=*,job_seeker_profile.*,vs_job_seeker_profile.*,work_experience.*,work_experience.media.*,work_experience.vs_work_experience_media.*,work_experience.skills.*,work_experience.vs_work_experience_skills.*,work_experience.skills.skill_id.*,work_experience.vs_work_experience_skills.skill_id.*,vs_work_experience.*,vs_work_experience.media.*,vs_work_experience.vs_work_experience_media.*,vs_work_experience.skills.*,vs_work_experience.vs_work_experience_skills.*,vs_work_experience.skills.skill_id.*,vs_work_experience.vs_work_experience_skills.skill_id.*,education.*,vs_employee_education.*,vs_employee_education.school_id.*,vs_employee_education.school_course_id.*,certifications.*,vs_certifications.*,skills.*,skills.skill_id.*,vs_user_skills_map.*,vs_user_skills_map.skill_id.*,resumes.*,vs_job_seeker_resumes.*,social_links.*,vs_user_social_links.*,vs_job_preferences.*`;
    
    const res = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
            "Content-Type": "application/json"
        },
        cache: "no-store"
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch full user from Directus: HTTP ${res.status}`);
    }

    const json = await res.json();
    const data = json.data;
    
    if (Array.isArray(data) && data.length > 0) {
        const user = data[0];
        
        // Handle Directus relation alias mapping if it uses the raw table name
        if (user.vs_job_seeker_profile && !user.job_seeker_profile) {
            user.job_seeker_profile = user.vs_job_seeker_profile;
        }

        if (user.vs_work_experience && !user.work_experience) {
            user.work_experience = user.vs_work_experience;
        }

        if (user.vs_employee_education && !user.education) {
            user.education = user.vs_employee_education.map((edu: any) => ({
                id: edu.employee_education_id || edu.id,
                user_id: edu.user_id,
                school_id: typeof edu.school_id === 'object' ? edu.school_id?.school_id : edu.school_id,
                school_name_raw: edu.school_name_raw,
                course_name_raw: edu.course_name_raw,
                education_status: edu.education_status,
                course_request_draft_key: edu.course_request_draft_key ?? null,
                school_name: typeof edu.school_id === 'object' ? edu.school_id?.school_name : undefined,
                school_course_id: typeof edu.school_course_id === 'object' ? edu.school_course_id?.school_course_id : edu.school_course_id,
                course_name: typeof edu.school_course_id === 'object' ? edu.school_course_id?.course_name : undefined,
                start_date: edu.start_date,
                end_date: edu.end_date
            }));
        }

        if (user.vs_certifications && !user.certifications) {
            user.certifications = user.vs_certifications;
        }

        if (user.vs_job_seeker_resumes && !user.resumes) {
            user.resumes = user.vs_job_seeker_resumes;
        }

        if (user.vs_user_social_links && !user.social_links) {
            user.social_links = user.vs_user_social_links;
        }

        if (user.vs_job_preferences && !user.job_preferences) {
            user.job_preferences = user.vs_job_preferences;
        }

        // Fallback: If social_links is still undefined or not returned via the relation, fetch it directly
        if (!user.social_links) {
            try {
                const linksUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_user_social_links?filter[user_id][_eq]=${user.user_id}`;
                const linksRes = await fetch(linksUrl, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    cache: "no-store"
                });
                if (linksRes.ok) {
                    const linksJson = await linksRes.json();
                    user.social_links = linksJson.data || [];
                } else {
                    user.social_links = [];
                }
            } catch (err) {
                console.error("Failed to fetch social links directly", err);
                user.social_links = [];
            }
        }

        // Fallback: If job_preferences is still undefined or not returned via the relation, fetch it directly
        if (!user.job_preferences) {
            try {
                const prefsUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_job_preferences?filter[user_id][_eq]=${user.user_id}`;
                const prefsRes = await fetch(prefsUrl, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    cache: "no-store"
                });
                if (prefsRes.ok) {
                    const prefsJson = await prefsRes.json();
                    user.job_preferences = prefsJson.data || [];
                } else {
                    user.job_preferences = [];
                }
            } catch (err) {
                console.error("Failed to fetch job preferences directly", err);
                user.job_preferences = [];
            }
        }

        if (user.work_experience && Array.isArray(user.work_experience)) {
            user.work_experience.forEach((exp: any) => {
                if (exp.vs_work_experience_media && (!exp.media || exp.media.length === 0)) {
                    exp.media = exp.vs_work_experience_media;
                }
                if (exp.vs_work_experience_skills && (!exp.skills || exp.skills.length === 0)) {
                    exp.skills = exp.vs_work_experience_skills;
                }
                if (exp.skills && Array.isArray(exp.skills)) {
                    exp.skills = exp.skills.map((s: any) => ({
                        ...s,
                        skill: s.skill || s.skill_id
                    }));
                }
            });
        }

        if (user.vs_user_skills_map && (!user.skills || user.skills.length === 0)) {
            user.skills = user.vs_user_skills_map;
        }

        // Fix skill mapping for Directus response format
        // Directus returns the expanded object under the foreign key field name (e.g. `skill_id: { skill_name: "..." }`)
        // The UI expects `skill: { skill_name: "..." }`
        if (user.skills && Array.isArray(user.skills)) {
            user.skills = user.skills.map((s: { skill?: unknown, skill_id?: unknown, [key: string]: unknown }) => ({
                ...s,
                skill: s.skill || s.skill_id
            }));

            // Strict deduplication by skill master ID
            const seenSkillIds = new Set();
            user.skills = user.skills.filter((s: any) => {
                const id = s.skill?.id;
                if (!id || seenSkillIds.has(id)) return false;
                seenSkillIds.add(id);
                return true;
            });
        }

        // Fallback: If Directus didn't return the relational data, fetch it explicitly
        if (!user.job_seeker_profile || user.job_seeker_profile.length === 0) {
            const profileUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_job_seeker_profile?filter[user_id][_eq]=${user.user_id}`;
            try {
                const profileRes = await fetch(profileUrl, {
                    headers: {
                        "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    cache: "no-store"
                });
                if (profileRes.ok) {
                    const profileData = await profileRes.json();
                    if (profileData.data && profileData.data.length > 0) {
                        user.job_seeker_profile = profileData.data;
                    }
                }
            } catch (err) {
                console.error("Failed to fallback fetch job seeker profile", err);
            }
        }

        // Fallback: If Directus didn't return work experience, fetch it explicitly
        if (!user.work_experience || user.work_experience.length === 0) {
            const expUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_work_experience?filter[user_id][_eq]=${user.user_id}&fields=*,media.*,vs_work_experience_media.*`;
            try {
                const expRes = await fetch(expUrl, {
                    headers: {
                        "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    cache: "no-store"
                });
                if (expRes.ok) {
                    const expData = await expRes.json();
                    if (expData.data && expData.data.length > 0) {
                        const exps = expData.data;
                        exps.forEach((exp: any) => {
                            if (exp.vs_work_experience_media && (!exp.media || exp.media.length === 0)) {
                                exp.media = exp.vs_work_experience_media;
                            }
                        });
                        user.work_experience = exps;
                    }
                }
            } catch (err) {
                console.error("Failed to fallback fetch work experience", err);
            }
        }

        // Fallback: If Directus didn't return education, fetch it explicitly
        if (!user.education || user.education.length === 0) {
            const eduUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_employee_education?filter[user_id][_eq]=${user.user_id}&fields=*,school_id.*,school_course_id.*`;
            try {
                const eduRes = await fetch(eduUrl, {
                    headers: {
                        "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    cache: "no-store"
                });
                if (eduRes.ok) {
                    const eduData = await eduRes.json();
                    if (eduData.data && eduData.data.length > 0) {
                        user.education = eduData.data.map((edu: any) => ({
                            id: edu.employee_education_id || edu.id,
                            user_id: edu.user_id,
                            school_id: typeof edu.school_id === 'object' ? edu.school_id?.school_id : edu.school_id,
                            school_name_raw: edu.school_name_raw,
                            course_name_raw: edu.course_name_raw,
                            education_status: edu.education_status,
                            course_request_draft_key: edu.course_request_draft_key ?? null,
                            school_name: typeof edu.school_id === 'object' ? edu.school_id?.school_name : undefined,
                            school_course_id: typeof edu.school_course_id === 'object' ? edu.school_course_id?.school_course_id : edu.school_course_id,
                            course_name: typeof edu.school_course_id === 'object' ? edu.school_course_id?.course_name : undefined,
                            start_date: edu.start_date,
                            end_date: edu.end_date
                        }));
                    }
                }
            } catch (err) {
                console.error("Failed to fallback fetch education", err);
            }
        }

        // Fallback: If Directus didn't return resumes, fetch it explicitly
        if (!user.resumes || user.resumes.length === 0) {
            const resumesUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_job_seeker_resumes?filter[user_id][_eq]=${user.user_id}`;
            try {
                const resumesRes = await fetch(resumesUrl, {
                    headers: {
                        "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    cache: "no-store"
                });
                if (resumesRes.ok) {
                    const resumesData = await resumesRes.json();
                    if (resumesData.data) {
                        user.resumes = resumesData.data;
                    }
                }
            } catch (err) {
                console.error("Failed to fallback fetch resumes", err);
            }
        }

        // Fallback: If Directus didn't return certifications, fetch it explicitly
        if (!user.certifications || user.certifications.length === 0) {
            const certUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_certifications?filter[user_id][_eq]=${user.user_id}`;
            try {
                const certRes = await fetch(certUrl, {
                    headers: {
                        "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    cache: "no-store"
                });
                if (certRes.ok) {
                    const certData = await certRes.json();
                    if (certData.data && certData.data.length > 0) {
                        user.certifications = certData.data;
                    }
                }
            } catch (err) {
                console.error("Failed to fallback fetch certifications", err);
            }
        }

        // Always fetch fresh media & skills for all work experiences directly from their junction tables.
        // This prevents Directus from silently ignoring relational fields and ensures we always have up-to-date data.
        if (user.work_experience && Array.isArray(user.work_experience) && user.work_experience.length > 0) {
            const expIds = user.work_experience.map((e: any) => e.id);

            // Always fetch media fresh from DB
            try {
                const mediaUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}/items/vs_work_experience_media?filter[experience_id][_in]=${expIds.join(',')}`;
                const mediaRes = await fetch(mediaUrl, {
                    headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` },
                    cache: "no-store"
                });
                if (mediaRes.ok) {
                    const mediaData = await mediaRes.json();
                    const mediaByExp: Record<number, any[]> = {};
                    (mediaData.data || []).forEach((m: any) => {
                        if (!mediaByExp[m.experience_id]) mediaByExp[m.experience_id] = [];
                        mediaByExp[m.experience_id].push(m);
                    });
                    // Override whatever Directus returned — always use direct DB result
                    user.work_experience.forEach((exp: any) => {
                        exp.media = mediaByExp[exp.id] || [];
                    });
                } else {
                    user.work_experience.forEach((exp: any) => { exp.media = []; });
                }
            } catch (err) {
                user.work_experience.forEach((exp: any) => { exp.media = []; });
            }
            // Always fetch skills fresh from DB
            try {
                const skillsUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}/items/vs_work_experience_skills?filter[experience_id][_in]=${expIds.join(',')}&fields=*,skill_id.*`;
                const skillsRes = await fetch(skillsUrl, {
                    headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` },
                    cache: "no-store"
                });
                if (skillsRes.ok) {
                    const skillsData = await skillsRes.json();
                    const skillsByExp: Record<number, any[]> = {};
                    (skillsData.data || []).forEach((s: any) => {
                        if (!skillsByExp[s.experience_id]) skillsByExp[s.experience_id] = [];
                        skillsByExp[s.experience_id].push({ ...s, skill: s.skill || s.skill_id });
                    });
                    // Override whatever Directus returned — always use direct DB result
                    user.work_experience.forEach((exp: any) => {
                        exp.skills = skillsByExp[exp.id] || [];
                    });
                } else {
                    user.work_experience.forEach((exp: any) => { exp.skills = []; });
                }
            } catch (err) {
                user.work_experience.forEach((exp: any) => { exp.skills = []; });
            }
        }

        // Fallback: If Directus didn't return the skills relational data, fetch it explicitly
        if (!user.skills || user.skills.length === 0) {
            const skillsUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_user_skills_map?filter[user_id][_eq]=${user.user_id}&fields=*,skill_id.*`;
            try {
                const skillsRes = await fetch(skillsUrl, {
                    headers: {
                        "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    cache: "no-store"
                });
                if (skillsRes.ok) {
                    const skillsData = await skillsRes.json();
                    if (skillsData.data && skillsData.data.length > 0) {
                        const mappedSkills = skillsData.data.map((s: { skill?: unknown, skill_id?: unknown, [key: string]: unknown }) => ({
                            ...s,
                            skill: s.skill || s.skill_id
                        }));

                        // Strict deduplication by skill master ID
                        const seenSkillIds = new Set();
                        user.skills = mappedSkills.filter((s: any) => {
                            const id = s.skill?.id;
                            if (!id || seenSkillIds.has(id)) return false;
                            seenSkillIds.add(id);
                            return true;
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to fallback fetch user skills", err);
            }
        }

        return user;
    }
    
    return null;
}

export async function addWorkExperienceToDirectus(payload: any) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    const { media, skills, ...mainPayload } = payload;
    const url = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_work_experience`;
    
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(mainPayload),
        cache: "no-store"
    });

    if (!res.ok) {
        throw new Error(`Failed to add work experience: HTTP ${res.status}`);
    }

    const json = await res.json();
    const newId = json.data.id;

    // Insert new media
    if (media && media.length > 0) {
        const newMedia = media.map((m: any) => ({ ...m, experience_id: newId }));
        const mediaRes = await fetch(`${NEXT_PUBLIC_API_BASE_URL}/items/vs_work_experience_media`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(newMedia)
        });
        if (!mediaRes.ok) {
            const err = await mediaRes.text();
            throw new Error(`Failed to add media: HTTP ${mediaRes.status} - ${err}`);
        }
    }

    // Insert new skills
    if (skills && skills.length > 0) {
        const newSkills = skills.map((s: any) => ({ skill_id: s.skill_id, experience_id: newId }));
        const skillsRes = await fetch(`${NEXT_PUBLIC_API_BASE_URL}/items/vs_work_experience_skills`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(newSkills)
        });
        if (!skillsRes.ok) {
            const err = await skillsRes.text();
            throw new Error(`Failed to add skills: HTTP ${skillsRes.status} - ${err}`);
        }
    }

    return json.data;
}

export async function updateWorkExperienceInDirectus(id: number, payload: any) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    const { media, skills, ...mainPayload } = payload;

    // 1. Update main record
    const url = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_work_experience/${id}`;
    const res = await fetch(url, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(mainPayload),
        cache: "no-store"
    });

    if (!res.ok) {
        throw new Error(`Failed to update work experience: HTTP ${res.status}`);
    }
    const json = await res.json();

    // 2. Handle Media update (Delete all existing, then insert new)
    if (media !== undefined) {
        // Fetch existing media IDs
        const mediaRes = await fetch(`${NEXT_PUBLIC_API_BASE_URL}/items/vs_work_experience_media?filter[experience_id][_eq]=${id}&fields=id`, {
            headers: { "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}` },
            cache: "no-store"
        });
        if (mediaRes.ok) {
            const mediaData = await mediaRes.json();
            const mediaIds = mediaData.data?.map((m: any) => m.id) || [];
            if (mediaIds.length > 0) {
                await fetch(`${NEXT_PUBLIC_API_BASE_URL}/items/vs_work_experience_media`, {
                    method: "DELETE",
                    headers: {
                        "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(mediaIds)
                });
            }
        }
        
        // Insert new media
        if (media.length > 0) {
            const newMedia = media.map((m: any) => ({ ...m, experience_id: id }));
            const mediaRes = await fetch(`${NEXT_PUBLIC_API_BASE_URL}/items/vs_work_experience_media`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(newMedia)
            });
            if (!mediaRes.ok) {
                const err = await mediaRes.text();
                throw new Error(`Failed to update media: HTTP ${mediaRes.status} - ${err}`);
            }
        }
    }

    // 3. Handle Skills update (Delete all existing, then insert new)
    if (skills !== undefined) {
        const skillsRes = await fetch(`${NEXT_PUBLIC_API_BASE_URL}/items/vs_work_experience_skills?filter[experience_id][_eq]=${id}`, {
            headers: { "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}` },
            cache: "no-store"
        });
        
        if (skillsRes.ok) {
            const skillsData = await skillsRes.json();
            // Delete skills individually by primary key
            for (const row of skillsData.data || []) {
                if (row.id) {
                    await fetch(`${NEXT_PUBLIC_API_BASE_URL}/items/vs_work_experience_skills/${row.id}`, {
                        method: "DELETE",
                        headers: { "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}` }
                    });
                }
            }
        }
        
        // Try query-based delete as well just in case
        await fetch(`${NEXT_PUBLIC_API_BASE_URL}/items/vs_work_experience_skills?filter[experience_id][_eq]=${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}` }
        });

        if (skills.length > 0) {
            const newSkills = skills.map((s: any) => ({ skill_id: s.skill_id, experience_id: id }));
            const skillsRes = await fetch(`${NEXT_PUBLIC_API_BASE_URL}/items/vs_work_experience_skills`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(newSkills)
            });
            if (!skillsRes.ok) {
                const err = await skillsRes.text();
                throw new Error(`Failed to update skills: HTTP ${skillsRes.status} - ${err}`);
            }
        }
    }

    return json.data;
}

export async function deleteWorkExperienceFromDirectus(id: number) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    const url = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_work_experience/${id}`;
    
    const res = await fetch(url, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`
        },
        cache: "no-store"
    });

    if (!res.ok && res.status !== 204) {
        throw new Error(`Failed to delete work experience: HTTP ${res.status}`);
    }

    return true;
}

export async function addCertificationToDirectus(payload: any) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    const url = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_certifications`;
    
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        cache: "no-store"
    });

    if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
            const errJson = await res.json();
            detail = errJson?.errors?.[0]?.message || detail;
        } catch {
            try { detail = await res.text(); } catch {}
        }
        throw new Error(`Failed to add certification: ${detail}`);
    }

    const json = await res.json();
    return json.data;
}

export async function updateCertificationInDirectus(id: number, payload: any) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    const url = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_certifications/${id}`;
    
    const res = await fetch(url, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        cache: "no-store"
    });

    if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
            const errJson = await res.json();
            detail = errJson?.errors?.[0]?.message || detail;
        } catch {
            try { detail = await res.text(); } catch {}
        }
        throw new Error(`Failed to update certification: ${detail}`);
    }

    const json = await res.json();
    return json.data;
}

export async function deleteCertificationFromDirectus(id: number) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    const url = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_certifications/${id}`;
    
    const res = await fetch(url, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`
        },
        cache: "no-store"
    });

    if (!res.ok && res.status !== 204) {
        throw new Error(`Failed to delete certification: HTTP ${res.status}`);
    }

    return true;
}

export async function updateUserInDirectus(userId: number, payload: any) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    const url = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_user/${userId}`;
    
    const res = await fetch(url, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        cache: "no-store"
    });

    if (!res.ok) {
        throw new Error(`Failed to update user personal info: HTTP ${res.status}`);
    }

    const json = await res.json();
    return json.data;
}

export async function upsertJobSeekerProfileInDirectus(userId: number, profileId: number | undefined, payload: any) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    let targetProfileId = profileId;
    let method = profileId ? "PATCH" : "POST";

    if (!targetProfileId && userId) {
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
    }

    const url = targetProfileId 
        ? `${NEXT_PUBLIC_API_BASE_URL}/items/vs_job_seeker_profile/${targetProfileId}`
        : `${NEXT_PUBLIC_API_BASE_URL}/items/vs_job_seeker_profile`;
    
    const body = targetProfileId 
        ? { ...payload }
        : { ...payload, user_id: userId };

    const res = await fetch(url, {
        method,
        headers: {
            "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        cache: "no-store"
    });

    if (!res.ok) {
        let errDetails = "";
        try {
            errDetails = await res.text();
        } catch {
            errDetails = "Could not parse error details";
        }
        throw new Error(`Failed to upsert job seeker profile: HTTP ${res.status} - ${errDetails}`);
    }

    const json = await res.json();
    return json.data;
}

export async function upsertJobPreferencesInDirectus(userId: number, data: any) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    // 1. Check if preferences exist
    const checkUrl = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_job_preferences?filter[user_id][_eq]=${userId}`;
    const checkRes = await fetch(checkUrl, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
            "Content-Type": "application/json"
        },
        cache: "no-store"
    });

    if (!checkRes.ok) {
        throw new Error(`Failed to check existing job preferences: HTTP ${checkRes.status}`);
    }

    const checkData = await checkRes.json();
    const existing = checkData.data?.[0];

    // 2. Insert or Update
    const method = existing ? "PATCH" : "POST";
    const url = existing
        ? `${NEXT_PUBLIC_API_BASE_URL}/items/vs_job_preferences/${existing.id}`
        : `${NEXT_PUBLIC_API_BASE_URL}/items/vs_job_preferences`;
        
    const payload = existing ? data : { user_id: userId, ...data };

    const res = await fetch(url, {
        method,
        headers: {
            "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to upsert job preferences: HTTP ${res.status} - ${errorText}`);
    }

    return await res.json();
}

export async function updateJobSeekerProfileCompletion(profileId: number, percent: number, status: string) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    const url = `${NEXT_PUBLIC_API_BASE_URL}/items/vs_job_seeker_profile/${profileId}`;

    const res = await fetch(url, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            profile_completion_percent: percent,
            profile_status: status
        })
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to update profile completion: HTTP ${res.status} - ${errorText}`);
    }
}

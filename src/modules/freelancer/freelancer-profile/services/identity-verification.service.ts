import { fetchUserVerifications } from "./identity-verification.repo";
import { getFreelancerProfile, computeProfileCompletion } from "./freelancer-profile.service";
import { updateJobSeekerProfileCompletion } from "./freelancer-profile.repo";
import { fetchFreelancerProfileFromDirectus } from "./freelancer-profile.repo";

export interface IdProofScoreBreakdown {
    gov_id: number;
    address: number;
    mobile_number: number;
    profile_sections: number;
}

export interface IdProofScoreResult {
    score: number;
    breakdown: IdProofScoreBreakdown;
    can_apply: boolean;
}

export async function recalculateAndPersistScoreForUser(userId: number, email?: string): Promise<number> {
    try {
        let profile = null;
        if (email) {
            profile = await fetchFreelancerProfileFromDirectus(email);
        } else {
            // Find user email from vs_user using database directly
            const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
            const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
            if (NEXT_PUBLIC_API_BASE_URL && DIRECTUS_STATIC_TOKEN) {
                const res = await fetch(`${NEXT_PUBLIC_API_BASE_URL}/items/vs_user/${userId}?fields=user_email`, {
                    headers: { "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}` }
                });
                if (res.ok) {
                    const json = await res.json();
                    if (json.data && json.data.user_email) {
                        profile = await fetchFreelancerProfileFromDirectus(json.data.user_email);
                    }
                }
            }
        }

        if (!profile) return 0;

        const verifications = await fetchUserVerifications(profile.user_id);
        const { percent, status } = computeProfileCompletion(profile, verifications);

        const profileObj = profile.job_seeker_profile || profile.vs_job_seeker_profile;
        const profileData = Array.isArray(profileObj) ? profileObj[0] : profileObj;

        if (profileData && profileData.profile_id) {
            await updateJobSeekerProfileCompletion(profileData.profile_id, percent, status);
        }

        return percent;
    } catch (err) {
        console.error("Failed to recalculate and persist score for user:", err);
        return 0;
    }
}

export async function calculateIdProofScore(token: string): Promise<IdProofScoreResult | null> {
    const profile = await getFreelancerProfile(token);
    if (!profile) return null;

    // Recalculate and persist the score first to ensure it's up-to-date
    const score = await recalculateAndPersistScoreForUser(profile.user_id, profile.user_email);

    const verifications = await fetchUserVerifications(profile.user_id);
    let gov_id = 0;
    let address = 0;
    let mobile_number = 0;

    for (const v of verifications) {
        if (v.status === 'approved') {
            if (v.type === 'gov_id') gov_id = 20;
            if (v.type === 'address') address = 20;
            if (v.type === 'mobile_number') mobile_number = 20;
        }
    }

    let completedProfileSections = 0;
    const totalProfileSections = 6;

    if (profile.user_fname && profile.user_lname && profile.user_bday && profile.gender) {
        completedProfileSections++;
    }
    if (profile.resumes && profile.resumes.length > 0) {
        completedProfileSections++;
    }
    if (profile.job_seeker_profile?.[0]?.professional_summary) {
        completedProfileSections++;
    }
    if (profile.skills && profile.skills.length > 0) {
        completedProfileSections++;
    }
    if (profile.work_experience && profile.work_experience.length > 0) {
        completedProfileSections++;
    }
    if (profile.education && profile.education.length > 0) {
        completedProfileSections++;
    }

    const profile_sections = Math.round((completedProfileSections / totalProfileSections) * 40);

    return {
        score: score,
        breakdown: {
            gov_id,
            address,
            mobile_number,
            profile_sections
        },
        can_apply: score >= 80
    };
}

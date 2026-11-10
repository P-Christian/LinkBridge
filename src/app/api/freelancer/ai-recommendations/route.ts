import { NextRequest, NextResponse } from "next/server";
import { generateJobRecommendations } from "@/lib/gemini/jobRecommender";
import { authenticateRequest } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

// 5-minute in-memory cache to prevent repeated 3-second Gemini calls on navigation
const CACHE_TTL_MS = 5 * 60 * 1000;
const recommendationCache = new Map<number, { data: unknown; timestamp: number }>();

function getHeaders(): Record<string, string> {
    const h: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
    };
    if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
    return h;
}

export async function GET(req: NextRequest) {
    try {
        const session = await authenticateRequest(req);
        const userId = session?.userId ? Number(session.userId) : null;

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const cached = recommendationCache.get(userId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            return NextResponse.json({ recommendations: cached.data });
        }

        // 1. Fetch User Profile Data
        const userQueryUrl = new URL(`${DIRECTUS_BASE}/items/vs_user/${userId}`);
        userQueryUrl.searchParams.append("fields", "vs_job_seeker_profile.professional_summary,vs_job_preferences.*,vs_user_skills_map.skill_id.skill_name,job_seeker_profile.professional_summary,job_preferences.*,skills.skill_id.skill_name");
        
        const userRes = await fetch(userQueryUrl.toString(), { headers: getHeaders(), cache: "no-store" });
        if (!userRes.ok) throw new Error("Failed to fetch user profile");
        const userData = (await userRes.json()).data;

        // Normalize User Data
        const preferences = userData.vs_job_preferences?.[0] || userData.job_preferences?.[0] || userData.vs_job_preferences || userData.job_preferences || {};
        const profile = userData.vs_job_seeker_profile?.[0] || userData.job_seeker_profile?.[0] || {};
        
        // Fetch explicit user skills
        let userSkills: string[] = [];
        const userSkillsUrl = `${DIRECTUS_BASE}/items/vs_user_skills_map?filter[user_id][_eq]=${userId}&fields=skill_id.skill_name`;
        const userSkillsRes = await fetch(userSkillsUrl, { headers: getHeaders(), cache: "no-store" });
        if (userSkillsRes.ok) {
            const userSkillsData = (await userSkillsRes.json()).data || [];
            userSkills = userSkillsData.map((s: { skill_id?: { skill_name?: string } }) => s.skill_id?.skill_name).filter(Boolean);
        }

        const normalizedUserProfile = {
            professional_summary: profile.professional_summary || "",
            skills: userSkills,
            preferences: {
                job_type: preferences.job_type,
                work_setup: preferences.work_setup,
                preferred_location: preferences.preferred_location,
                salary_range_min: preferences.salary_range_min,
                salary_range_max: preferences.salary_range_max,
                preferred_industry: preferences.preferred_industry
            }
        };

        // Guard: If freelancer profile is empty (no skills and no summary), do not generate recommendations
        const hasSkills = userSkills.length > 0;
        const hasSummary = Boolean(normalizedUserProfile.professional_summary?.trim());
        if (!hasSkills && !hasSummary) {
            return NextResponse.json({ recommendations: [] });
        }

        // Fetch Active Jobs
        const jobsUrl = new URL(`${DIRECTUS_BASE}/items/vs_job_posting`);
        jobsUrl.searchParams.append("filter[status][_eq]", "ACTIVE");
        jobsUrl.searchParams.append("limit", "50"); // Limit to recent 50 active jobs for context limit
        jobsUrl.searchParams.append("fields", "job_id,job_title,company_id.company_name,job_type,work_arrangement,job_location,job_description,salary_min,salary_max");

        const jobsRes = await fetch(jobsUrl.toString(), { headers: getHeaders(), cache: "no-store" });
        if (!jobsRes.ok) throw new Error("Failed to fetch jobs");
        const jobsData = (await jobsRes.json()).data || [];

        // Fetch explicit job skills for the retrieved jobs
        const jobIds = jobsData.map((j: { job_id: number }) => j.job_id);
        const jobSkillsMap: Record<number, string[]> = {};
        
        if (jobIds.length > 0) {
            const jobSkillsUrl = `${DIRECTUS_BASE}/items/vs_job_skills_map?filter[job_id][_in]=${jobIds.join(',')}&fields=job_id,skill_id.skill_name&limit=500`;
            const jobSkillsRes = await fetch(jobSkillsUrl, { headers: getHeaders(), cache: "no-store" });
            if (jobSkillsRes.ok) {
                const jobSkillsData = (await jobSkillsRes.json()).data || [];
                jobSkillsData.forEach((s: { job_id: number; skill_id?: { skill_name?: string } }) => {
                    if (!jobSkillsMap[s.job_id]) jobSkillsMap[s.job_id] = [];
                    const skillName = s.skill_id?.skill_name;
                    if (skillName) jobSkillsMap[s.job_id].push(skillName);
                });
            }
        }

        // Normalize Jobs Data
        const normalizedJobs = jobsData.map((job: { job_id: number; job_title: string; company_id?: { company_name?: string }; job_type: string; work_arrangement: string; job_location: string; job_description?: string; salary_min?: number; salary_max?: number }) => {
            const jobSkills = jobSkillsMap[job.job_id] || [];
            
            return {
                job_id: job.job_id,
                job_title: job.job_title,
                company_name: job.company_id?.company_name || "Unknown Company",
                job_type: job.job_type,
                work_arrangement: job.work_arrangement,
                job_location: job.job_location,
                description_snippet: job.job_description ? job.job_description.substring(0, 300) + "..." : "", // truncated to save tokens
                salary_min: job.salary_min,
                salary_max: job.salary_max,
                required_skills: jobSkills
            };
        });

        if (normalizedJobs.length === 0) {
            return NextResponse.json({ recommendations: [] });
        }

        // Generate AI Recommendations using the unified gemini service
        const recommendations = await generateJobRecommendations(normalizedUserProfile, normalizedJobs);

        // Cache for 5 minutes
        recommendationCache.set(userId, {
            data: recommendations,
            timestamp: Date.now(),
        });

        return NextResponse.json({ recommendations });

    } catch (err: unknown) {
        console.error("GET /api/freelancer/ai-recommendations error:", err);
        return NextResponse.json({ error: safeErrorMessage(err, "Internal server error") }, { status: 500 });
    }
}

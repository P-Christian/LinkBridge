import { callGeminiSafe } from "./geminiClient";

export interface NormalizedUserProfile {
    professional_summary: string;
    skills: string[];
    preferences: {
        job_type?: string;
        work_setup?: string;
        preferred_location?: string;
        salary_range_min?: number;
        salary_range_max?: number;
        preferred_industry?: string;
    };
}

export interface NormalizedJob {
    job_id: number;
    job_title: string;
    company_name: string;
    job_type: string;
    work_arrangement: string;
    job_location: string;
    description_snippet?: string;
    salary_min?: number;
    salary_max?: number;
    required_skills: string[];
}

export interface JobRecommendation {
    job_id: number;
    reasoning: string;
    match_percentage?: number;
    job_title?: string;
    company_name?: string;
    job_type?: string;
    work_arrangement?: string;
    salary_min?: number;
    salary_max?: number;
    job_location?: string;
}

/**
 * Generates AI job recommendations for a freelancer based on active job postings.
 * 
 * @param userProfile The normalized freelancer profile
 * @param jobs The list of active normalized job postings to match against
 * @returns Array of JobRecommendation objects, up to 3 best matches
 */
export async function generateJobRecommendations(
    userProfile: NormalizedUserProfile,
    jobs: NormalizedJob[]
): Promise<JobRecommendation[]> {
    if (!jobs || jobs.length === 0) {
        return [];
    }

    const hasSkills = Array.isArray(userProfile.skills) && userProfile.skills.length > 0;
    const hasSummary = Boolean(userProfile.professional_summary && userProfile.professional_summary.trim().length > 0);

    // If there is no user profile data to match against, strictly return empty array
    if (!hasSkills && !hasSummary) {
        return [];
    }

    const prompt = `
You are an expert AI recruiter matching freelancers with job postings.
I will provide you with a Freelancer Profile JSON and an array of Available Jobs JSON.

Your task:
1. Evaluate genuine overlap between the freelancer's specific skills/summary and each job's requirements.
2. Consider skills match, work setup match (e.g. remote), and salary alignment.
3. Calculate an honest match_percentage score (an integer between 0 and 100) based strictly on real evidence from the profile.
4. CRITICAL RULE: DO NOT hallucinate, guess, or assign high fit scores without evidence. Only recommend jobs that have a genuine match with the freelancer's actual skills or summary.
5. If no jobs match the freelancer's skills or if profile data is insufficient to establish a fit, return an empty array [].
6. Select at most 3 jobs that have a genuine match.
7. Output ONLY a valid JSON array of objects. Do not wrap it in markdown code blocks like \`\`\`json. Just output the raw JSON array.

Return format exactly like this:
[
  {
    "job_id": 123,
    "match_percentage": 92,
    "reasoning": "A concise 1-2 sentence explanation of why this job is a great fit based on their specific skills and preferences."
  }
]

---
Freelancer Profile:
${JSON.stringify(userProfile, null, 2)}

---
Available Jobs:
${JSON.stringify(jobs, null, 2)}
`;

    const raw = await callGeminiSafe(prompt);
    if (!raw) return [];

    let recommendations: { job_id: number; reasoning: string; match_percentage?: number }[] = [];
    try {
        // Clean markdown if Gemini wraps the response
        const cleanText = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
        recommendations = JSON.parse(cleanText);
        
        if (!Array.isArray(recommendations)) {
            return [];
        }
    } catch {
        console.error("[gemini] ❌ Failed to parse AI job recommendations:", raw);
        return [];
    }

    // Merge original job details back into recommendations for the frontend
    const detailedRecommendations = recommendations
        .filter(rec => typeof rec.job_id === 'number' && typeof rec.reasoning === 'string')
        .map((rec): JobRecommendation | null => {
            const fullJob = jobs.find(j => j.job_id === rec.job_id);
            if (!fullJob) return null;
            
            return {
                job_id: rec.job_id,
                reasoning: rec.reasoning,
                match_percentage: typeof rec.match_percentage === 'number' ? Math.min(100, Math.max(0, Math.round(rec.match_percentage))) : undefined,
                job_title: fullJob.job_title,
                company_name: fullJob.company_name,
                job_type: fullJob.job_type,
                work_arrangement: fullJob.work_arrangement,
                salary_min: fullJob.salary_min,
                salary_max: fullJob.salary_max,
                job_location: fullJob.job_location
            };
        })
        .filter((rec): rec is JobRecommendation => rec !== null);

    return detailedRecommendations;
}

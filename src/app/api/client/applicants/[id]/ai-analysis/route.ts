// src/app/api/client/applicants/[id]/ai-analysis/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { callGeminiMonitored } from "@/lib/gemini/geminiMonitoring";
import {
  DirectusError,
  directusItems,
  directusSettled,
} from "@/lib/server/directus";
import { toId } from "@/lib/server/route";

import {
  getActiveApplicationAiAnalysis,
  saveApplicationAiAnalysis,
} from "@/lib/gemini/applicationAiStorage";

import { safeErrorMessage } from "@/lib/api-error";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GEMINI_MODEL = process.env.GEMINI_MODEL || process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemini-2.0-flash";

interface ApplicationRow {
  application_id: number;
  job_id?: number | string | null;
  user_id?: number | string | null;
  expected_salary?: number | string | null;
  cover_letter?: string | null;
  portfolio_url?: string | null;
}

interface JobRow extends Record<string, unknown> {
  job_id: number;
  company_id?: number | string | null;
  job_title?: string | null;
  job_description?: string | null;
  job_requirements?: string | null;
  job_responsibilities?: string | null;
  job_qualifications?: string | null;
  experience_level?: string | null;
  salary_min?: number | string | null;
  salary_max?: number | string | null;
  salary_period?: string | null;
  work_setup?: string | null;
  status?: string | null;
}

const FIT_LEVELS = [
  "Strong Match",
  "Good Match",
  "Moderate Match",
  "Potential Fit",
  "Low Match",
] as const;

/**
 * Only Directus' own 404 may tell the employer a row is gone. Every other
 * failure status means the row could not be read, and answering 404 makes an
 * outage look like a deleted application.
 */
function missingOrOutage(status: number, entity: string): NextResponse {
  if (status === 404) {
    return NextResponse.json({ error: `${entity} not found.` }, { status: 404 });
  }
  return NextResponse.json(
    { error: `${entity} could not be read. Please try again.` },
    { status: 502 }
  );
}

/** A score that is not a number is not a score of 75. */
function clampScore(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}


// ─────────────────────────────────────────────────────────────────────────────
// GET: Retrieve the currently active AI Candidate Evaluation from DB
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const applicationId = toId(id);

    if (!applicationId) {
      return NextResponse.json({ error: "Invalid application ID" }, { status: 400 });
    }

    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    const requesterId = Number(session.userId);
    const { isVerified, companyId } = await checkCompanyVerificationStatus(requesterId);
    if (!isVerified || !companyId) {
      return NextResponse.json(
        { error: "Forbidden: Restricted to verified employer accounts." },
        { status: 403 }
      );
    }

    // Verify application belongs to caller's company
    const appRes = await directusSettled<ApplicationRow>(
      `/items/vs_job_application/${applicationId}`,
      { query: "fields=application_id,job_id" }
    );
    if (!appRes.ok) {
      return missingOrOutage(appRes.status, "Application");
    }
    const targetJobId = toId(appRes.data?.job_id ?? null);
    if (!targetJobId) {
      return NextResponse.json({ error: "Application is not associated with a valid job." }, { status: 400 });
    }

    const jobCheckRes = await directusSettled<JobRow>(`/items/vs_job_posting/${targetJobId}`, {
      query: "fields=job_id,company_id",
    });
    if (!jobCheckRes.ok) {
      return missingOrOutage(jobCheckRes.status, "Associated job posting");
    }
    if (Number(jobCheckRes.data?.company_id) !== companyId) {
      return NextResponse.json(
        { error: "Forbidden: Candidate application belongs to another organization." },
        { status: 403 }
      );
    }

    // Query active evaluation via shared persistence layer
    const record = await getActiveApplicationAiAnalysis(applicationId, "CANDIDATE_EVALUATION");

    if (record) {
      const rawRec =
        typeof record.recommendation === "string"
          ? record.recommendation
          : ((record.recommendation as Record<string, unknown>)?.action as string) ||
            ((record.recommendation as Record<string, unknown>)?.reasoning as string) ||
            "";

      const rawScr =
        typeof record.screening_assessment === "string"
          ? record.screening_assessment
          : ((record.screening_assessment as Record<string, unknown>)?.assessment as string) ||
            ((record.screening_assessment as Record<string, unknown>)?.summary as string) ||
            null;

      const analysis = {
        analysis_id: record.analysis_id,
        // `Number(x) || 75` rewrote a stored score of 0 — a total mismatch — into
        // 75, which the modal colours blue and calls a decent fit. A score that
        // is genuinely absent stays absent instead of becoming a median guess.
        match_score: clampScore(record.match_score),
        fit_level: record.fit_level ?? "",
        executive_summary: record.executive_summary || "",
        strengths: Array.isArray(record.strengths) ? record.strengths : [],
        gaps_or_considerations: Array.isArray(record.gaps_or_considerations) ? record.gaps_or_considerations : [],
        screening_assessment: rawScr,
        recommendation: rawRec,
        alternative_job_recommendations: Array.isArray(record.alternative_job_recommendations) ? record.alternative_job_recommendations : [],
        analyzed_at: record.created_at ?? "",
      };

      return NextResponse.json({
        success: true,
        analysis,
      });
    }

    return NextResponse.json({
      success: true,
      analysis: null,
    });
  } catch (error: unknown) {
    console.error("Error fetching AI candidate analysis:", error);
    // Answering 200 with no analysis told the modal this candidate had never
    // been scored, so it generated a fresh evaluation: a paid Gemini call that
    // then superseded the stored record the outage had hidden.
    if (error instanceof DirectusError) {
      return NextResponse.json(
        { error: "Saved evaluation could not be read. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Internal server error") },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST: Generate fresh AI Evaluation and append new record to DB
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const applicationId = toId(id);

    if (!applicationId) {
      return NextResponse.json({ error: "Invalid application ID" }, { status: 400 });
    }

    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    const requesterId = Number(session.userId);

    // Verify company authorization
    const { isVerified, companyId } = await checkCompanyVerificationStatus(requesterId);
    if (!isVerified || !companyId) {
      return NextResponse.json(
        { error: "Only verified employers can run AI candidate evaluations." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const candidateData = body.candidate || null;

    // Fetch Application & Job Posting details from Directus
    const appRes = await directusSettled<ApplicationRow>(
      `/items/vs_job_application/${applicationId}`,
      {
        query:
          "fields=application_id,job_id,user_id,expected_salary,cover_letter,portfolio_url",
      }
    );

    if (!appRes.ok) {
      return missingOrOutage(appRes.status, "Application");
    }

    const application = appRes.data;
    if (!application) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const targetJobId = toId(application.job_id ?? null);
    if (!targetJobId) {
      return NextResponse.json(
        { error: "Application is not associated with a valid job." },
        { status: 400 }
      );
    }

    // `vs_application_ai_analysis.user_id` is what the candidate's own deletion
    // request later purges on, so an evaluation stored against an unreadable
    // owner id would be retained forever and invisible to that purge.
    const candidateUserId = toId(application.user_id ?? null);
    if (!candidateUserId) {
      return NextResponse.json(
        { error: "Application is not associated with a valid candidate." },
        { status: 400 }
      );
    }

    const jobRes = await directusSettled<JobRow>(`/items/vs_job_posting/${targetJobId}`, {
      query:
        "fields=job_id,company_id,job_title,job_description,job_requirements,job_responsibilities,job_qualifications,experience_level,salary_min,salary_max",
    });

    if (!jobRes.ok) {
      return missingOrOutage(jobRes.status, "Associated job posting");
    }

    const jobPosting = jobRes.data;
    if (!jobPosting) {
      return NextResponse.json({ error: "Associated job posting not found." }, { status: 404 });
    }

    if (Number(jobPosting.company_id) !== companyId) {
      return NextResponse.json(
        { error: "Forbidden: Candidate application belongs to another organization." },
        { status: 403 }
      );
    }

    // Other openings for the cross-role scan. Both reads used to fall back to an
    // empty list, and the prompt then told the model "No other active openings in
    // this company" — so an unreachable Directus produced an evaluation that
    // confidently reported the candidate had nowhere else to go.
    const jobsFields =
      "limit=50&fields=job_id,job_title,job_description,job_qualifications,experience_level,status";
    let allCompanyJobs = await directusItems<JobRow>("vs_job_posting", {
      query: `filter[company_id][_eq]=${companyId}&${jobsFields}`,
    });

    if (allCompanyJobs.length === 0) {
      allCompanyJobs = await directusItems<JobRow>("vs_job_posting", {
        query: `filter[created_by_user_id][_eq]=${requesterId}&${jobsFields}`,
      });
    }

    // Filter active other jobs excluding current job
    const otherActiveJobs = allCompanyJobs
      .filter((j) => {
        const jid = Number(j.job_id);
        if (jid === targetJobId) return false;
        const s = String(j.status || j.job_status || "ACTIVE").toUpperCase();
        return s !== "CLOSED" && s !== "DRAFT" && s !== "ARCHIVED";
      })
      .map((j) => ({
        job_id: Number(j.job_id),
        job_title: String(j.job_title || ""),
        skills_required: String(j.skills_required || j.job_qualifications || ""),
        experience_level: String(j.experience_level || ""),
        job_description: j.job_description ? String(j.job_description).slice(0, 300) : "",
      }));

    const jobContext = {
      job_title: jobPosting?.job_title || candidateData?.job_title || "Target Role",
      job_description: jobPosting?.job_description || "N/A",
      requirements: jobPosting?.job_requirements || "N/A",
      responsibilities: jobPosting?.job_responsibilities || "N/A",
      skills_required: jobPosting?.skills_required || "N/A",
      experience_level: jobPosting?.experience_level || "N/A",
      salary_min: jobPosting?.salary_min || null,
      salary_max: jobPosting?.salary_max || null,
      salary_period: jobPosting?.salary_period || "Monthly",
      work_setup: jobPosting?.work_setup || "Remote",
    };

    const candidateProfile = {
      name: candidateData?.applicant_name || "Applicant",
      email: candidateData?.applicant_email || "N/A",
      phone: candidateData?.applicant_phone || "N/A",
      location: candidateData?.location || "N/A",
      profile_headline: candidateData?.profile_headline || "N/A",
      professional_summary: candidateData?.professional_summary || "N/A",
      expected_salary: candidateData?.expected_salary ?? application.expected_salary ?? "N/A",
      skills: candidateData?.skills || [],
      work_experience: candidateData?.work_experience || [],
      education: candidateData?.education || [],
      certifications: candidateData?.certifications || [],
      screening_answers: candidateData?.screening_answers || [],
      cover_letter: candidateData?.cover_letter ?? application.cover_letter ?? "N/A",
      portfolio_url: candidateData?.portfolio_url ?? application.portfolio_url ?? "N/A",
    };

    const prompt = `
You are a Principal Talent Acquisition AI Specialist.
Analyze the candidate profile thoroughly against the specific applied job posting, and evaluate if they might be an even better or strong viable fit for any other open roles in the same company.

=== APPLIED JOB POSTING ===
Title: ${jobContext.job_title}
Experience Level: ${jobContext.experience_level}
Work Setup: ${jobContext.work_setup}
Salary Budget: ${jobContext.salary_min && jobContext.salary_max ? `${jobContext.salary_min} - ${jobContext.salary_max} / ${jobContext.salary_period}` : "Not specified"}
Job Description: ${jobContext.job_description}
Requirements: ${jobContext.requirements}
Responsibilities: ${jobContext.responsibilities}
Target Skills: ${jobContext.skills_required}

=== OTHER ACTIVE COMPANY OPENINGS (CROSS-MATCHING) ===
${otherActiveJobs.length > 0 ? JSON.stringify(otherActiveJobs, null, 2) : "No other active openings in this company."}

=== CANDIDATE PROFILE ===
Name: ${candidateProfile.name}
Headline: ${candidateProfile.profile_headline}
Location: ${candidateProfile.location}
Expected Salary: ${candidateProfile.expected_salary}
Professional Summary: ${candidateProfile.professional_summary}
Skills: ${JSON.stringify(candidateProfile.skills)}
Work Experience: ${JSON.stringify(candidateProfile.work_experience)}
Education: ${JSON.stringify(candidateProfile.education)}
Certifications: ${JSON.stringify(candidateProfile.certifications)}
Screening Question Answers: ${JSON.stringify(candidateProfile.screening_answers)}
Cover Letter: ${candidateProfile.cover_letter}
Portfolio: ${candidateProfile.portfolio_url}

=== INSTRUCTIONS ===
1. Evaluate hard skills, experience depth, domain knowledge, and qualification fit for the APPLIED role.
2. Review candidate screening answers in depth for role alignment and technical understanding.
3. Calculate an objective match_score (0 to 100) and fit_level for the applied role.
4. CROSS-ROLE EVALUATION:
   - Carefully check the candidate against EVERY OTHER ACTIVE COMPANY OPENING listed in the section above.
   - For example, if the candidate has strong Full-Stack / Web Development / Backend background and there is a role like "Junior Full Stack Developer" or similar, calculate their match score for that position.
   - If ANY other role has a match score of 50% or higher, or where the candidate's core background is an even more natural fit, you MUST include it in "alternative_job_recommendations" with:
     - "job_id": <exact number from the list above>
     - "job_title": "<exact job title from the list above>"
     - "match_score": <integer 0-100>
     - "reasoning": "<1-2 sentence clear reasoning why the candidate fits or excels in this opening>"
   - Order "alternative_job_recommendations" from highest match_score to lowest (up to 4 jobs). If no other openings are listed or none meet 50% match, return [].
5. Provide specific, insightful strengths and gap considerations for the applied role.
6. Output ONLY a valid JSON object matching the exact schema below with NO markdown formatting around it.

Expected JSON schema:
{
  "match_score": 75,
  "fit_level": "Good Match",
  "executive_summary": "Concise 3-4 sentence overview explaining how well this candidate fits the role.",
  "strengths": [
    "Key strength 1 related to job requirements",
    "Key strength 2 with specific proof from profile",
    "Key strength 3"
  ],
  "gaps_or_considerations": [
    "Potential gap or area requiring interview validation 1",
    "Potential gap 2"
  ],
  "screening_assessment": "1-2 sentence review of candidate screening answers and technical depth shown.",
  "recommendation": "Clear recruiter recommendation on next steps and targeted questions to ask.",
  "alternative_job_recommendations": [
    {
      "job_id": 123,
      "job_title": "Junior Full Stack Developer",
      "match_score": 92,
      "reasoning": "Candidate's extensive practical experience in full-stack web development and modern frameworks makes them an exceptional match for this opening."
    }
  ]
}
`;

    const rawResponse = await callGeminiMonitored({
      prompt,
      feature: "BEST_MATCH",
      endpoint: `/api/client/applicants/${applicationId}/ai-analysis`,
      userId: requesterId,
      timeoutMs: 20000,
    });

    if (!rawResponse) {
      return NextResponse.json(
        { error: "AI analysis failed to generate a response. Please try again." },
        { status: 502 }
      );
    }

    let parsedResult;
    try {
      const cleanJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedResult = JSON.parse(cleanJson);
    } catch {
      console.error(
        "Failed to parse Gemini AI response",
        process.env.NODE_ENV === "production" ? "(response content redacted)" : rawResponse
      );
      return NextResponse.json(
        { error: "Unable to parse AI evaluation format. Please retry." },
        { status: 502 }
      );
    }

    // A reply that carries no usable rating used to be answered with a literal
    // 75 and "Good Match", so a truncated or off-schema Gemini response was
    // stored and shown as a decent candidate. Report it as a failed generation
    // instead of inventing the number the model did not give.
    const rawScore = Number(parsedResult.match_score);
    const fitLevel =
      typeof parsedResult.fit_level === "string" ? parsedResult.fit_level.trim() : "";
    if (
      !Number.isFinite(rawScore) ||
      !(FIT_LEVELS as readonly string[]).includes(fitLevel)
    ) {
      console.error(
        "Gemini AI response has no usable score or fit rating",
        process.env.NODE_ENV === "production" ? "(response content redacted)" : rawResponse
      );
      return NextResponse.json(
        { error: "Unable to parse AI evaluation format. Please retry." },
        { status: 502 }
      );
    }

    // Cross-role suggestions are only kept when they name a posting this
    // company actually has open. `Number(alt.job_id) || 0` used to accept a
    // hallucinated id as 0 and a missing score as a 75% match.
    const knownJobIds = new Set(otherActiveJobs.map((j) => Number(j.job_id)));
    const rawAlts: Record<string, unknown>[] = Array.isArray(
      parsedResult.alternative_job_recommendations
    )
      ? parsedResult.alternative_job_recommendations
      : [];
    const alternativeJobs = rawAlts
      .map((alt) => ({
        job_id: toId(alt.job_id ?? null),
        job_title: String(alt.job_title || ""),
        match_score: Number(alt.match_score),
        reasoning: String(alt.reasoning || ""),
      }))
      .filter(
        (alt) =>
          alt.job_id !== null &&
          knownJobIds.has(alt.job_id) &&
          Number.isFinite(alt.match_score)
      )
      .map((alt) => ({
        job_id: alt.job_id as number,
        job_title: alt.job_title,
        match_score: clampScore(alt.match_score),
        reasoning: alt.reasoning,
      }));

    const analysis = {
      match_score: clampScore(parsedResult.match_score),
      fit_level: fitLevel,
      executive_summary: parsedResult.executive_summary
        ? String(parsedResult.executive_summary)
        : "",
      strengths: Array.isArray(parsedResult.strengths) ? parsedResult.strengths : [],
      gaps_or_considerations: Array.isArray(parsedResult.gaps_or_considerations)
        ? parsedResult.gaps_or_considerations
        : [],
      screening_assessment: parsedResult.screening_assessment || null,
      recommendation: parsedResult.recommendation
        ? String(parsedResult.recommendation)
        : "",
      alternative_job_recommendations: alternativeJobs,
      analyzed_at: new Date().toISOString(),
    };

    // ─────────────────────────────────────────────────────────────────────────
    // DB PERSISTENCE: Append new record and supersede previous active record
    // ─────────────────────────────────────────────────────────────────────────
    // The evaluation is still returned when the write fails — the model call has
    // already been paid for — but it is reported, because otherwise the employer
    // assumes it is retained and the next page load runs the model again.
    const warnings: string[] = [];
    try {
      await saveApplicationAiAnalysis({
        evaluation_mode: "CANDIDATE_EVALUATION",
        application_id: applicationId,
        job_id: targetJobId,
        user_id: candidateUserId,
        company_id: companyId,
        match_score: analysis.match_score,
        fit_level: analysis.fit_level,
        executive_summary: analysis.executive_summary,
        strengths: analysis.strengths,
        gaps_or_considerations: analysis.gaps_or_considerations,
        screening_assessment: analysis.screening_assessment ? { assessment: analysis.screening_assessment } : null,
        recommendation: { action: analysis.recommendation },
        alternative_job_recommendations: analysis.alternative_job_recommendations,
        raw_ai_response: parsedResult,
        ai_model: GEMINI_MODEL,
        prompt_version: "1.0",
        evaluated_by_user_id: requesterId,
      });
    } catch (dbErr) {
      console.warn(
        "[ai-analysis] Could not persist evaluation to vs_application_ai_analysis table:",
        dbErr
      );
      warnings.push(
        "This evaluation could not be saved, so it will run again when this candidate is reopened."
      );
    }

    return NextResponse.json({
      success: true,
      analysis,
      warnings,
    });
  } catch (error: unknown) {
    console.error("Error in AI candidate analysis route:", error);
    if (error instanceof DirectusError) {
      return NextResponse.json(
        { error: "Candidate details could not be read. Please try again." },
        { status: 502 }
      );
    }
    const msg = safeErrorMessage(error, "Internal server error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// src/app/api/freelancer/applications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { createEmployerNotification } from "@/lib/notifications/services/employer-notifications";
import { sendApplicationSubmittedEmail, sendNewApplicationReceivedEmail, isEmailEnabledForUser } from "@/lib/mail";
import { createSystemMessage } from "@/lib/messaging/system-message";
import { handleApplicationSubmissionReferral } from "@/modules/freelancer/freelancer-referrals/services/referral.service";
import { getFreelancerProfile } from "@/modules/freelancer/freelancer-profile/services/freelancer-profile.service";
import { checkRestriction } from "@/lib/status-validator";
import { assignInitialStageToApplication, getJobPipeline } from "@/modules/client/pipeline/services/job-pipeline.service";
import type { JobPipelineVersion, JobPipelineStage } from "@/modules/client/pipeline/types";
import type { ApplicationItem } from "@/modules/freelancer/freelancer-applications/types";
import { getPHTimeString } from "@/lib/utils";
import { authenticateRequest, isFreelancerSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — Fetch logged-in freelancer's own applications
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isFreelancerSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Freelancer access required." : "Unauthorized." },
        { status: session ? 403 : 401 }
      );
    }

    const userId = Number(session.userId);

    // Fetch applications for this user (client_notes excluded for privacy)
    const appRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_application?filter[user_id][_eq]=${userId}&sort[]=-applied_at&fields=application_id,job_id,user_id,application_status,current_stage_id,cover_letter,expected_salary,portfolio_url,applied_at,status_updated_at,resume_id&limit=200`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!appRes.ok) {
      const err = await appRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.errors?.[0]?.message ?? "Failed to load applications." },
        { status: appRes.status }
      );
    }

    const appJson = await appRes.json();
    const applications: Record<string, unknown>[] = appJson.data ?? [];

    if (applications.length === 0) {
      return NextResponse.json({ applications: [] });
    }

    // Enrich with job details (title, type, location, work_arrangement)
    const jobIds = [...new Set(applications.map((a) => a.job_id as number))];
    const jobsRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_posting?filter[job_id][_in]=${jobIds.join(",")}&fields=job_id,job_title,job_description,job_type,job_location,work_arrangement,experience_level,company_id&limit=500`,
      { headers: getHeaders(), cache: "no-store" }
    );

    const jobsMap: Record<number, Record<string, unknown>> = {};
    if (jobsRes.ok) {
      const jobsJson = await jobsRes.json();
      const jobs: Record<string, unknown>[] = jobsJson.data ?? [];
      jobs.forEach((j) => {
        jobsMap[j.job_id as number] = j;
      });
    }

    // Enrich with company names
    const companyIds = [
      ...new Set(
        Object.values(jobsMap)
          .map((j) => j.company_id as number)
          .filter(Boolean)
      ),
    ];
    const companyMap: Record<number, Record<string, unknown>> = {};
    if (companyIds.length > 0) {
      const companyFields = [
        "company_id", "company_name", "company_legal_name", "company_email", "company_contact",
        "company_website", "company_description", "company_mission", "company_vision", "company_culture",
        "company_benefits", "industry_id", "company_size_id", "year_established", "company_province",
        "company_city", "company_brgy", "company_address", "company_zipCode", "registration_no",
        "company_tin", "company_logo", "company_cover", "company_facebook", "company_linkedin",
        "company_instagram", "company_x", "company_youtube", "company_tags", "verification_status",
        "is_public", "is_active"
      ].join(",");
      const compRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_company?filter[company_id][_in]=${companyIds.join(",")}&filter[is_public][_eq]=true&fields=${companyFields}&limit=200`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (compRes.ok) {
        const compJson = await compRes.json();
        const companies: Record<string, unknown>[] = compJson.data ?? [];
        companies.forEach((c) => {
          companyMap[c.company_id as number] = c;
        });
      }
    }

    // Enrich with screening answers from vs_job_application_answer & vs_job_screening_question
    const appIds = applications.map((a) => a.application_id as number);
    const screeningMap: Record<number, { question_id: number; question_text: string; answer_text: string }[]> = {};
    if (appIds.length > 0) {
      const ansRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_job_application_answer?filter[application_id][_in]=${appIds.join(",")}&fields=application_id,question_id,answer_text&limit=500`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (ansRes.ok) {
        const ansJson = await ansRes.json();
        const ansList: { application_id: number; question_id: number; answer_text: string }[] = ansJson.data ?? [];
        const qIds = [...new Set(ansList.map((a) => a.question_id).filter(Boolean))];

        const qTextMap: Record<number, string> = {};
        if (qIds.length > 0) {
          const qRes = await fetch(
            `${DIRECTUS_BASE}/items/vs_job_screening_question?filter[question_id][_in]=${qIds.join(",")}&fields=question_id,question_text&limit=500`,
            { headers: getHeaders(), cache: "no-store" }
          );
          if (qRes.ok) {
            const qJson = await qRes.json();
            const qList: { question_id: number; question_text: string }[] = qJson.data ?? [];
            qList.forEach((q) => {
              qTextMap[q.question_id] = q.question_text;
            });
          }
        }

        ansList.forEach((a) => {
          if (!screeningMap[a.application_id]) screeningMap[a.application_id] = [];
          screeningMap[a.application_id].push({
            question_id: a.question_id,
            question_text: qTextMap[a.question_id] || `Question #${a.question_id}`,
            answer_text: a.answer_text,
          });
        });
      }
    }

    // Enrich with resume details
    const resumeIds = [...new Set(applications.map((a) => a.resume_id as number).filter(Boolean))];
    const resumeMap: Record<number, { file_name: string; file_url: string }> = {};
    if (resumeIds.length > 0) {
      const resRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_job_seeker_resumes?filter[id][_in]=${resumeIds.join(",")}&fields=id,file_name,file_url&limit=500`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (resRes.ok) {
        const resJson = await resRes.json();
        const resumes: Record<string, unknown>[] = resJson.data ?? [];
        resumes.forEach((r) => {
          resumeMap[r.id as number] = {
            file_name: r.file_name as string,
            file_url: r.file_url as string,
          };
        });
      }
    }

    // Enrich with referral details
    const referralMap: Record<number, { is_referred: boolean; referral_letter: string | null; school_name: string | null; referrer_name: string | null }> = {};
    if (appIds.length > 0) {
      try {
        const refRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_job_application_referral?filter[application_id][_in]=${appIds.join(",")}&fields=application_id,referral_id.referral_letter,referrer_user_id.user_id,referrer_user_id.user_fname,referrer_user_id.user_lname&limit=500`,
          { headers: getHeaders(), cache: "no-store" }
        );
        if (refRes.ok) {
          const refJson = await refRes.json();
          const refRows: Array<{
            application_id?: number | string;
            referrer_user_id?: {
              user_id?: number;
              user_fname?: string;
              user_lname?: string;
            } | null;
            referral_id?: {
              referral_letter?: string;
            } | null;
          }> = refJson.data ?? [];
          
          const refUserIds = [...new Set(refRows.map(r => r.referrer_user_id?.user_id).filter(Boolean))];
          const schoolMap: Record<number, string> = {};
          if (refUserIds.length > 0) {
            const sRes = await fetch(
              `${DIRECTUS_BASE}/items/vs_school_admin?filter[user_id][_in]=${refUserIds.join(",")}&fields=user_id,school_id.school_name&limit=500`,
              { headers: getHeaders(), cache: "no-store" }
            );
            if (sRes.ok) {
              const sJson = await sRes.json();
              (sJson.data || []).forEach((row: { user_id?: number | string; school_id?: { school_name?: string } | null }) => {
                const uid = Number(row.user_id);
                const sName = typeof row.school_id === "object" ? row.school_id?.school_name : null;
                if (sName) schoolMap[uid] = sName;
              });
            }
          }

          refRows.forEach((r) => {
            const appId = Number(r.application_id);
            const refUser = r.referrer_user_id;
            const refUserId = refUser?.user_id || 0;
            const sName = schoolMap[refUserId] || null;
            const refLetter = typeof r.referral_id === "object" ? (r.referral_id?.referral_letter ?? null) : null;
            const rName = refUser ? `${refUser.user_fname || ""} ${refUser.user_lname || ""}`.trim() : null;

            referralMap[appId] = {
              is_referred: true,
              referral_letter: refLetter,
              school_name: sName,
              referrer_name: rName,
            };
          });
        }
      } catch (err) {
        console.warn("Could not load referral data for freelancer applications:", err);
      }
    }

    // Enrich with Job Pipelines (active version stages)
    const jobPipelineMap: Record<number, JobPipelineVersion | null> = {};
    await Promise.all(
      jobIds.map(async (jId) => {
        try {
          const pipe = await getJobPipeline(jId);
          jobPipelineMap[jId] = pipe;
        } catch {
          jobPipelineMap[jId] = null;
        }
      })
    );

    // Enrich with Stage History from vs_application_stage_history
    const stageHistoryMap: Record<number, Array<{ id: number; from_stage_id?: number | null; to_stage_id: number; created_at?: string }>> = {};
    if (appIds.length > 0) {
      try {
        const histRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_application_stage_history?filter[application_id][_in]=${appIds.join(",")}&sort[]=created_at&fields=id,application_id,from_stage_id,to_stage_id,created_at&limit=500`,
          { headers: getHeaders(), cache: "no-store" }
        );
        if (histRes.ok) {
          const histJson = await histRes.json();
          const histRows: Array<{ id: number; application_id: number; from_stage_id?: number | null; to_stage_id: number; created_at?: string }> = histJson.data ?? [];
          histRows.forEach((h) => {
            if (!stageHistoryMap[h.application_id]) stageHistoryMap[h.application_id] = [];
            stageHistoryMap[h.application_id].push({
              id: h.id,
              from_stage_id: h.from_stage_id,
              to_stage_id: h.to_stage_id,
              created_at: h.created_at,
            });
          });
        }
      } catch (err) {
        console.warn("Could not load stage history for freelancer applications:", err);
      }
    }

    // Enrich with Profile Snapshot from vs_job_application_profile_snapshot
    const profileSnapshotMap: Record<number, Record<string, unknown>> = {};
    if (appIds.length > 0) {
      try {
        const snapRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_job_application_profile_snapshot?filter[application_id][_in]=${appIds.join(",")}&fields=application_id,profile_data,captured_at&limit=500`,
          { headers: getHeaders(), cache: "no-store" }
        );
        if (snapRes.ok) {
          const snapJson = await snapRes.json();
          const snapRows: Array<{ application_id: number; profile_data: Record<string, unknown> }> = snapJson.data ?? [];
          snapRows.forEach((s) => {
            if (s.application_id && s.profile_data) {
              profileSnapshotMap[s.application_id] = s.profile_data;
            }
          });
        }
      } catch (err) {
        console.warn("Could not load profile snapshots for freelancer applications:", err);
      }
    }

    // Merge all data
    const enriched = applications.map((app) => {
      const job = jobsMap[app.job_id as number] ?? {};
      const companyId = job.company_id as number;
      const appId = app.application_id as number;
      const company = companyId ? companyMap[companyId] : null;
      const refData = referralMap[appId];
      const pipe = jobPipelineMap[app.job_id as number];

      let currentStage: ApplicationItem["current_stage"] = null;
      let pipelineStages: NonNullable<ApplicationItem["pipeline_stages"]> = [];

      if (pipe?.stages && Array.isArray(pipe.stages)) {
        pipelineStages = (pipe.stages as unknown as JobPipelineStage[]).map((s) => ({
          id: s.id,
          stage_name: s.stage_name,
          stage_type: s.stage_type,
          stage_order: s.stage_order,
          color: s.color,
          description: s.description ?? null,
          is_terminal: !!s.is_terminal,
        }));

        if (app.current_stage_id) {
          currentStage = pipelineStages.find((s) => s.id === Number(app.current_stage_id)) || null;
        }

        if (!currentStage) {
          currentStage =
            pipelineStages.find((s) => s.stage_type === app.application_status) ||
            pipelineStages.find((s) => s.stage_type === "APPLIED") ||
            pipelineStages[0] ||
            null;
        }
      }

      return {
        ...app,
        job_title: job.job_title ?? null,
        job_description: job.job_description ?? null,
        job_type: job.job_type ?? null,
        job_location: job.job_location ?? null,
        work_arrangement: job.work_arrangement ?? null,
        experience_level: job.experience_level ?? null,
        company_id: companyId ?? null,
        company_name: company?.company_name ?? null,
        company_details: company ?? null,
        screening_answers: screeningMap[appId] ?? null,
        profile_snapshot: (profileSnapshotMap[appId] as unknown as ApplicationItem["profile_snapshot"]) ?? null,
        resume: app.resume_id ? (resumeMap[app.resume_id as number] ?? null) : null,
        is_referred: !!refData?.is_referred,
        referral_letter: refData?.referral_letter || null,
        school_name: refData?.school_name || null,
        referrer_name: refData?.referrer_name || null,
        current_stage_id: currentStage?.id ?? (app.current_stage_id ? Number(app.current_stage_id) : null),
        current_stage: currentStage,
        pipeline_stages: pipelineStages,
        stage_history: stageHistoryMap[appId] ?? [],
      };
    });

    return NextResponse.json({ applications: enriched });
  } catch (err: unknown) {
    console.error("GET /api/freelancer/applications error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — Submit a new job application
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isFreelancerSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Freelancer access required." : "Unauthorized." },
        { status: session ? 403 : 401 }
      );
    }

    const userId = Number(session.userId);

    // Validate APPLY_JOBS Restriction
    const isRestricted = await checkRestriction(userId, "APPLY_JOBS");
    if (isRestricted) {
      return NextResponse.json(
        { error: "Your job application privileges are temporarily suspended." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body?.job_id) {
      return NextResponse.json({ error: "job_id is required." }, { status: 400 });
    }

    const isDraft = !!body?.is_draft;

    // Check for existing application (draft or submitted)
    const dupCheck = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_application?filter[job_id][_eq]=${body.job_id}&filter[user_id][_eq]=${userId}&fields=application_id,application_status,draft_version,draft_started_at&limit=1`,
      { headers: getHeaders(), cache: "no-store" }
    );
    
    let existingApplication: Record<string, unknown> | null = null;
    if (dupCheck.ok) {
      const dupJson = await dupCheck.json();
      existingApplication = dupJson.data?.[0] || null;
    }

    if (existingApplication) {
      const status = existingApplication.application_status as string;
      // If it is not a draft and not withdrawn/rejected, it's an active application
      if (status !== "DRAFT" && status !== "WITHDRAWN" && status !== "REJECTED") {
        return NextResponse.json(
          { error: "You already have an active application for this job." },
          { status: 409 }
        );
      }
    }

    const nowPH = new Date(Date.now() + 8 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    // Resolve resume_id
    let resumeId: number | null = null;

    if (body.custom_resume?.file_path) {
      // User uploaded a new resume
      // 1. Unset existing primary resumes
      const existingResumesRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_seeker_resumes?filter[user_id][_eq]=${userId}&filter[is_primary][_eq]=true&fields=id`, {
        headers: getHeaders(),
        cache: "no-store"
      });
      if (existingResumesRes.ok) {
        const existingData = await existingResumesRes.json();
        const existingIds = (existingData.data ?? []).map((r: Record<string, unknown>) => r.id);
        for (const rId of existingIds) {
          await fetch(`${DIRECTUS_BASE}/items/vs_job_seeker_resumes/${rId}`, {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify({ is_primary: false })
          });
        }
      }

      // 2. Create the new resume as primary
      const createRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_seeker_resumes`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          file_name: body.custom_resume.file_name || "Resume.pdf",
          file_path: body.custom_resume.file_path,
          file_url: body.custom_resume.file_path,
          is_primary: true,
        }),
      });
      if (createRes.ok) {
        const createdData = await createRes.json();
        resumeId = createdData.data?.id;
      }
    } else {
      // User didn't upload a new resume. Fetch existing primary resume.
      const primaryRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_seeker_resumes?filter[user_id][_eq]=${userId}&filter[is_primary][_eq]=true&fields=id&limit=1`, {
        headers: getHeaders(),
        cache: "no-store"
      });
      if (primaryRes.ok) {
        const primaryData = await primaryRes.json();
        resumeId = primaryData.data?.[0]?.id || null;
      }
    }

    if (body.expected_salary !== undefined && body.expected_salary !== null && body.expected_salary !== "") {
      const salaryNum = Number(body.expected_salary);
      if (isNaN(salaryNum) || salaryNum < 0 || salaryNum > 99999999.99) {
        return NextResponse.json(
          { error: "Expected salary must be between 0 and 99,999,999.99 PHP." },
          { status: 400 }
        );
      }
    }

    const nextVersion = (Number(existingApplication?.draft_version) || 0) + 1;
    const payload: Record<string, unknown> = {
      job_id: Number(body.job_id),
      user_id: userId,
      application_status: isDraft ? "DRAFT" : "APPLIED",
      cover_letter: body.cover_letter?.trim() || null,
      expected_salary: body.expected_salary ? Number(body.expected_salary) : null,
      portfolio_url: body.portfolio_url?.trim() || null,
      resume_id: resumeId,
      status_updated_at: nowPH,
      draft_version: nextVersion,
    };

    if (isDraft) {
      if (!existingApplication?.draft_started_at) {
        payload.draft_started_at = nowPH;
      }
    } else {
      payload.submitted_at = nowPH;
    }

    let res;
    const fieldsQuery = "fields=application_id,job_id,user_id,application_status,cover_letter,expected_salary,portfolio_url,client_notes,applied_at,status_updated_at,resume_id,draft_version";

    if (existingApplication) {
      res = await fetch(`${DIRECTUS_BASE}/items/vs_job_application/${existingApplication.application_id}?${fieldsQuery}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
    } else {
      if (isDraft) {
        payload.draft_started_at = nowPH;
      } else {
        payload.applied_at = nowPH;
      }
      res = await fetch(`${DIRECTUS_BASE}/items/vs_job_application?${fieldsQuery}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
    }

    const json = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: json.errors?.[0]?.message ?? "Failed to save application." },
        { status: res.status }
      );
    }

    const createdApp = json.data;
    const applicationId = createdApp?.application_id;

    // Handle screening answers (saved both for drafts and submitted applications)
    if (applicationId && Array.isArray(body.screening_answers) && body.screening_answers.length > 0) {
      let answersToInsert = body.screening_answers;
      const needsQuestionIds = answersToInsert.some((a: Record<string, unknown>) => !a.question_id);
      if (needsQuestionIds) {
        const qRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_job_screening_question?filter[job_id][_eq]=${body.job_id}&fields=question_id,question_text&sort[]=question_id`,
          { headers: getHeaders(), cache: "no-store" }
        );
        if (qRes.ok) {
          const qJson = await qRes.json();
          const qList: { question_id: number; question_text: string }[] = qJson.data ?? [];
          answersToInsert = answersToInsert.map((ans: Record<string, unknown>, idx: number) => ({
            question_id: ans.question_id || qList[idx]?.question_id,
            answer_text: typeof ans === "string" ? ans : (ans.answer_text as string),
          }));
        }
      }

      // Clear existing answers first to support updating drafts cleanly
      const oldAnswersRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_job_application_answer?filter[application_id][_eq]=${applicationId}&fields=id`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (oldAnswersRes.ok) {
        const oldAnswers = await oldAnswersRes.json();
        const oldIds = (oldAnswers.data ?? []).map((a: Record<string, unknown>) => a.id);
        for (const aId of oldIds) {
          await fetch(`${DIRECTUS_BASE}/items/vs_job_application_answer/${aId}`, {
            method: "DELETE",
            headers: getHeaders(),
          });
        }
      }

      for (const ans of answersToInsert) {
        const qId = (ans as Record<string, unknown>).question_id;
        const text = ((ans as Record<string, unknown>).answer_text as string)?.trim();
        if (qId && text) {
          await fetch(`${DIRECTUS_BASE}/items/vs_job_application_answer`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({
              application_id: applicationId,
              question_id: Number(qId),
              answer_text: text,
              created_at: nowPH,
            }),
          }).catch((e) => console.error("Error inserting screening answer:", e));
        }
      }
    }

    // Submission specific logic (Snapshots, Consent, History, Referrals, Notifications)
    if (!isDraft && applicationId) {
      // 1. Capture Profile Snapshot
      try {
        const profile = await getFreelancerProfile(session.token).catch(() => null);
        if (profile) {
          const snapshotPayload = {
            application_id: applicationId,
            snapshot_schema_version: "1.0",
            profile_data: {
              professional_summary: 
                (profile.job_seeker_profile as unknown as Record<string, unknown>[])?.[0]?.professional_summary || 
                (profile.job_seeker_profile as unknown as Record<string, unknown>)?.professional_summary || "",
              skills: profile.skills || [],
              work_experience: profile.work_experience || [],
              education: profile.education || [],
              user_fname: profile.user_fname,
              user_lname: profile.user_lname,
              user_email: profile.user_email,
              user_contact: profile.user_contact,
              user_city: profile.user_city,
              user_province: profile.user_province,
            },
            captured_at: nowPH,
          };
          await fetch(`${DIRECTUS_BASE}/items/vs_job_application_profile_snapshot`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(snapshotPayload),
          });
        }
      } catch (snapErr) {
        console.error("Failed to capture profile snapshot:", snapErr);
      }

      // 2. Capture Consent Signature
      try {
        if (body.consent_accepted) {
          const consentPayload = {
            application_id: applicationId,
            consent_type: "application_acknowledgement",
            consent_text: body.consent_text || "I confirm the information is accurate and accept the application consent.",
            consent_hash: body.consent_hash || "default_consent_hash",
            accepted_at: nowPH,
          };
          await fetch(`${DIRECTUS_BASE}/items/vs_job_application_consent`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(consentPayload),
          });
        }
      } catch (consentErr) {
        console.error("Failed to capture consent:", consentErr);
      }

      // 3. Write Status History Transition
      try {
        const historyPayload = {
          application_id: applicationId,
          from_status: existingApplication?.application_status || null,
          to_status: "APPLIED",
          actor: "Freelancer",
          actor_user_id: userId,
          occurred_at: nowPH,
        };
        await fetch(`${DIRECTUS_BASE}/items/vs_job_application_status_history`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(historyPayload),
        });
      } catch (histErr) {
        console.error("Failed to log status history:", histErr);
      }

      // 4. Assign Initial Pipeline Stage and Log vs_application_stage_history
      try {
        await assignInitialStageToApplication(Number(body.job_id), Number(applicationId), userId);
      } catch (stageErr) {
        console.error("Failed to assign initial pipeline stage:", stageErr);
      }


      // Referrals
      try {
        await handleApplicationSubmissionReferral(Number(applicationId), userId, Number(body.job_id));
      } catch (err) {
        console.error("Failed to run referral association on application submit:", err);
      }

      // Dispatch emails & employer notifications
      try {
        const userRes = await fetch(`${DIRECTUS_BASE}/items/vs_user/${userId}?fields=user_email,user_fname,user_lname`, {
          headers: getHeaders(),
          cache: "no-store",
        });
        if (userRes.ok) {
          const u = (await userRes.json()).data;
          const candidateName = `${u?.user_fname ?? ""} ${u?.user_lname ?? ""}`.trim() || "Candidate";
          const candidateEmail = u?.user_email ?? "";

          let jobTitle = "Unknown Position";
          let companyName = "Employer";
          let companyEmail = "";
          let companyId: number | null = null;

          const jobRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_posting/${body.job_id}?fields=job_title,company_id`, {
            headers: getHeaders(),
            cache: "no-store",
          });
          if (jobRes.ok) {
            const jData = (await jobRes.json()).data;
            if (jData?.job_title) jobTitle = jData.job_title;
            if (jData?.company_id) {
              companyId = Number(jData.company_id);
              const compRes = await fetch(`${DIRECTUS_BASE}/items/vs_company/${jData.company_id}?fields=company_name,company_email`, {
                headers: getHeaders(),
                cache: "no-store",
              });
              if (compRes.ok) {
                const compData = (await compRes.json()).data;
                companyName = compData?.company_name || companyName;
                companyEmail = compData?.company_email || "";
              }
            }
          }

          // Email confirmation to candidate
          if (candidateEmail) {
            const candidateEmailEnabled = await isEmailEnabledForUser(userId, "APPLICATION_STATUS_UPDATED");
            if (candidateEmailEnabled) {
              await sendApplicationSubmittedEmail(candidateEmail, {
                candidateName,
                companyName,
                jobTitle,
                appliedAt: nowPH,
              }).catch((err) => console.error("Candidate email error:", err));
            }
          }

          // New application notification email to employer
          if (companyEmail && companyId) {
            const compUserRes = await fetch(`${DIRECTUS_BASE}/items/vs_company_user?filter[company_id][_eq]=${companyId}&fields=user_id&limit=1`, { headers: getHeaders(), cache: "no-store" });
            let employerUserId: number | null = null;
            if (compUserRes.ok) {
              const cuData = (await compUserRes.json()).data;
              employerUserId = cuData?.[0]?.user_id ? Number(cuData[0].user_id) : null;
            }

            const employerEmailEnabled = await isEmailEnabledForUser(employerUserId, "APPLICATION_RECEIVED");
            if (employerEmailEnabled) {
              await sendNewApplicationReceivedEmail(companyEmail, {
                companyName,
                jobTitle,
                candidateName,
                candidateEmail,
                expectedSalary: body.expected_salary ?? null,
                appliedAt: nowPH,
                applicationId: Number(applicationId),
              }).catch((err) => console.error("Employer email error:", err));
            }
          }

          // Employer in-app notification (APPLICATION_RECEIVED)
          if (companyId) {
            const compUserRes2 = await fetch(`${DIRECTUS_BASE}/items/vs_company_user?filter[company_id][_eq]=${companyId}&fields=user_id&limit=1`, { headers: getHeaders(), cache: "no-store" });
            if (compUserRes2.ok) {
              const cu2Data = (await compUserRes2.json()).data;
              const employerUserId2: number | null = cu2Data?.[0]?.user_id ? Number(cu2Data[0].user_id) : null;
              if (employerUserId2) {
                await createEmployerNotification({
                  event_type: "APPLICATION_RECEIVED",
                  recipient_user_id: employerUserId2,
                  entity_type: "job_application",
                  entity_id: Number(applicationId),
                  category: "APPLICATION_RECEIVED",
                  title: "New Application Received",
                  message: `${candidateName} applied for "${jobTitle}".`,
                  action_url: `/vos-sync/client/applicants/${applicationId}`,
                }).catch((err: unknown) => console.error("[Employer in-app] APPLICATION_RECEIVED error:", err));
              }
            }
          }

          // Candidate in-app confirmation (APPLICATION_SUBMITTED)
          await createNotification({
            event_type: "APPLICATION_SUBMITTED",
            recipient_user_id: userId,
            entity_type: "job_application",
            entity_id: Number(applicationId),
            category: "APPLICATION_SUBMITTED",
            title: "Application Submitted",
            message: `Your application for "${jobTitle}" was submitted successfully.`,
            action_url: `/vos-sync/freelancer/applications`,
          }).catch((err: unknown) => console.error("[Candidate in-app] APPLICATION_SUBMITTED error:", err));

          // Chat System Message
          if (companyId) {
            const compUserRes = await fetch(`${DIRECTUS_BASE}/items/vs_company_user?filter[company_id][_eq]=${companyId}&fields=user_id&limit=1`, { headers: getHeaders(), cache: "no-store" });
            if (compUserRes.ok) {
              const cuData = (await compUserRes.json()).data;
              const clientId = cuData?.[0]?.user_id;
              if (clientId) {
                await createSystemMessage({
                  clientId: Number(clientId),
                  freelancerId: userId,
                  jobId: Number(body.job_id),
                  text: `${candidateName} applied for "${jobTitle}"`,
                  senderId: userId,
                  systemEventType: "APPLICATION_SUBMITTED",
                  applicationId: Number(applicationId),
                }).catch((err) => console.error("Error creating application system message:", err));
              }
            }
          }
        }
      } catch (mailErr) {
        console.error("Error sending application emails:", mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: isDraft ? "Draft saved successfully." : "Application submitted successfully.",
      application: createdApp,
    });
  } catch (err: unknown) {
    console.error("POST /api/freelancer/applications error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH — Handle withdrawal of application
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isFreelancerSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Freelancer access required." : "Unauthorized." },
        { status: session ? 403 : 401 }
      );
    }

    const userId = Number(session.userId);

    const body = await req.json().catch(() => null);
    if (!body?.application_id) {
      return NextResponse.json({ error: "application_id is required." }, { status: 400 });
    }

    // 1. Fetch application details
    const appRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_application/${body.application_id}?fields=application_id,user_id,application_status,job_id,current_stage_id`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (!appRes.ok) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }
    const appData = (await appRes.json()).data;
    if (appData.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden. You do not own this application." }, { status: 403 });
    }

    const nowPH = getPHTimeString();

    if (body.action === "withdraw") {
      const rawStatus = String(appData.application_status || "").toUpperCase();
      const terminalStatuses = ["HIRED", "REJECTED", "WITHDRAWN"];
      if (body.reason && typeof body.reason === "string" && body.reason.trim().length > 255) {
        return NextResponse.json(
          { error: "Reason for withdrawal cannot exceed 255 characters." },
          { status: 400 }
        );
      }

      if (terminalStatuses.includes(rawStatus)) {
        return NextResponse.json(
          { error: `Cannot withdraw application when status is already ${rawStatus}.` },
          { status: 409 }
        );
      }

      // Resolve WITHDRAWN stage from active job pipeline
      let withdrawnStageId: number | null = null;
      let fromStageName = "Application";
      if (appData.job_id) {
        try {
          const pipeline = await getJobPipeline(Number(appData.job_id));
          const wStage = pipeline?.stages?.find((s) => s.stage_type === "WITHDRAWN");
          if (wStage) withdrawnStageId = wStage.id;
          if (appData.current_stage_id && pipeline?.stages) {
            const currentStage = pipeline.stages.find((s) => s.id === Number(appData.current_stage_id));
            if (currentStage) fromStageName = currentStage.stage_name;
          }
        } catch (err) {
          console.error("Error resolving job pipeline for withdrawal:", err);
        }
      }

      // Update application
      const patchPayload: Record<string, unknown> = {
        application_status: "WITHDRAWN",
        withdrawn_at: nowPH,
        withdrawal_reason: body.reason || null,
        status_updated_at: nowPH,
      };
      if (withdrawnStageId) {
        patchPayload.current_stage_id = withdrawnStageId;
      }

      const updateRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_application/${body.application_id}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify(patchPayload),
      });

      if (!updateRes.ok) {
        return NextResponse.json({ error: "Failed to withdraw application." }, { status: 500 });
      }

      // Insert status history
      await fetch(`${DIRECTUS_BASE}/items/vs_job_application_status_history`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          application_id: body.application_id,
          from_status: appData.application_status,
          to_status: "WITHDRAWN",
          actor: "Freelancer",
          actor_user_id: userId,
          public_reason: body.reason || null,
          occurred_at: nowPH,
        }),
      }).catch((e) => console.error("Error creating withdrawal history:", e));

      // Insert authoritative stage history
      if (withdrawnStageId) {
        await fetch(`${DIRECTUS_BASE}/items/vs_application_stage_history`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            application_id: Number(body.application_id),
            from_stage_id: appData.current_stage_id || null,
            to_stage_id: withdrawnStageId,
            changed_by: userId,
            change_reason: body.reason || "Candidate voluntarily withdrew application",
            metadata: {
              from_stage_name: fromStageName,
              to_stage_name: "Withdrawn",
              from_status: appData.application_status,
              to_status: "WITHDRAWN",
            },
            created_at: nowPH,
          }),
        }).catch((e) => console.error("Error creating stage withdrawal history:", e));
      }

      // Trigger notifications for employer
      try {
        let jobTitle = "Position";
        let companyId: number | null = null;
        const jobRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_posting/${appData.job_id}?fields=job_title,company_id`, {
          headers: getHeaders(),
          cache: "no-store",
        });
        if (jobRes.ok) {
          const jData = (await jobRes.json()).data;
          jobTitle = jData?.job_title || jobTitle;
          companyId = jData?.company_id ? Number(jData.company_id) : null;
        }

        const userRes = await fetch(`${DIRECTUS_BASE}/items/vs_user/${userId}?fields=user_fname,user_lname`, {
          headers: getHeaders(),
          cache: "no-store",
        });
        let candidateName = "Candidate";
        if (userRes.ok) {
          const u = (await userRes.json()).data;
          candidateName = `${u?.user_fname ?? ""} ${u?.user_lname ?? ""}`.trim() || candidateName;
        }

        // 1. In-app notification for Freelancer
        await createNotification({
          event_type: "application_status_updated",
          recipient_user_id: userId,
          entity_type: "job_application",
          entity_id: Number(body.application_id),
          category: "Application Updates",
          title: "Application Withdrawn",
          message: `You have successfully withdrawn your application for "${jobTitle}".`,
          action_url: "/vos-sync/freelancer/applications",
        }).catch((e) => console.error("Error creating candidate withdrawal notification:", e));

        // 2. In-app notification for Employer/Company recruiter
        if (companyId) {
          const compUserRes = await fetch(`${DIRECTUS_BASE}/items/vs_company_user?filter[company_id][_eq]=${companyId}&fields=user_id&limit=1`, { headers: getHeaders(), cache: "no-store" });
          if (compUserRes.ok) {
            const cuData = (await compUserRes.json()).data;
            const employerUserId = cuData?.[0]?.user_id ? Number(cuData[0].user_id) : null;
            if (employerUserId) {
              await createEmployerNotification({
                event_type: "APPLICATION_STATUS_UPDATED",
                recipient_user_id: employerUserId,
                entity_type: "job_application",
                entity_id: body.application_id,
                category: "APPLICATION_STATUS_UPDATED",
                title: "Application Withdrawn",
                message: `${candidateName} has withdrawn their application for "${jobTitle}".`,
                action_url: `/vos-sync/client/applicants/${body.application_id}`,
              }).catch((e) => console.error("Error creating employer withdrawal notification:", e));
            }
          }
        }
      } catch (err) {
        console.error("Error notifying about withdrawal:", err);
      }

      return NextResponse.json({ success: true, message: "Application withdrawn successfully." });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err: unknown) {
    console.error("PATCH /api/freelancer/applications error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

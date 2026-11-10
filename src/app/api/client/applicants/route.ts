
import { NextRequest, NextResponse } from "next/server";
import { getJobPipelinesForJobs } from "@/modules/client/pipeline/services/job-pipeline.service";
import { JobPipelineStage } from "@/modules/client/pipeline/types";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";
import {
  groupApplicantEducation,
  type ApplicantEducationBulkRow,
} from "@/modules/client/applicants/utils/applicantListEducation";

import { safeErrorMessage } from "@/lib/api-error";
import {
  DirectusError,
  directusItems,
  directusItemsWhereIn,
} from "@/lib/server/directus";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `status` is interpolated into a Directus filter query string, so only these
 * enums are accepted — anything else is rejected rather than passed through.
 */
const ALLOWED_APPLICATION_STATUSES = new Set([
  "APPLIED",
  "DRAFT",
  "UNDER_REVIEW",
  "SCREENING",
  "ASSESSMENT",
  "SHORTLISTED",
  "INTERVIEW",
  "INTERVIEWING",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
]);

async function getCompanyId(
  userId: number
): Promise<number | null> {
  const rows = await directusItems<{ company_id: number }>("vs_company_user", {
    query: `filter[user_id][_eq]=${userId}&fields=company_id&limit=1`,
  });

  return rows[0]?.company_id ?? null;
}

interface RawApplication {
  application_id: number;
  job_id: number;
  user_id: number;
  application_status: string;
  current_stage_id?: number | null;
  client_notes?: string | null;
  applied_at?: string;
  status_updated_at?: string;
}

interface AssessmentAttemptRow {
  application_id: number;
  job_stage_id: number | null;
  attempt_number?: number | null;
  status?: string | null;
}

interface VsUser {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_email: string;
  user_position?: string | null;
  profile_image_url?: string | null;
  user_city?: string | null;
  user_province?: string | null;
}

interface SkillMap {
  user_id: number;
  skill_id?: {
    skill_name?: string;
  };
}

interface Resume {
  user_id: number;
  is_primary?: boolean | number | string | null;
  id?: number;
}

interface WorkExperience {
  user_id: number;
  start_date?: string;
  end_date?: string;
  is_current_role?: boolean;
}
interface Job {
  job_id: number;
  job_title: string;
  company_id: number;
}

interface Company {
  company_id: number;
  company_name: string;
  company_logo?: string | null;
  company_cover?: string | null;
}
async function getCompanyNames(
  companyIds: number[]
): Promise<Record<number, Company>> {

  const rows = await directusItemsWhereIn<Company>(
    "vs_company",
    "company_id",
    companyIds,
    "company_id,company_name,company_logo,company_cover"
  );

  const result: Record<number, Company> = {};
  rows.forEach((company) => {
    result[company.company_id] = company;
  });

  return result;
}
function calculateExperienceYears(
  workExperience: WorkExperience[]
): number {
  if (!workExperience.length) {
    return 0;
  }

  let totalMonths = 0;

  for (const exp of workExperience) {
    if (!exp.start_date) {
      continue;
    }

    const start = new Date(exp.start_date);

    const end = exp.is_current_role
      ? new Date()
      : exp.end_date
        ? new Date(exp.end_date)
        : new Date();

    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());

    totalMonths += Math.max(months, 0);
  }

  return Number((totalMonths / 12).toFixed(1));
}

function calculateProfileCompletion(
  user: VsUser | undefined,
  skills: string[],
  experienceCount: number,
  resumeCount: number
): number {
  let score = 0;

  if (user?.user_fname) score += 20;
  if (user?.user_email) score += 20;
  if (skills.length > 0) score += 20;
  if (experienceCount > 0) score += 20;
  if (resumeCount > 0) score += 20;

  return score;
}

// GET — List all applicants for company jobs

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    if (session && !isClientSession(session)) {
      return NextResponse.json(
        { error: "Forbidden: employer access required." },
        { status: 403 }
      );
    }

    const userId = Number(session.userId);

    // BUSINESS RULE: Only VERIFIED companies can browse candidate profiles
    const { isVerified, verification_status } = await checkCompanyVerificationStatus(userId);
    if (!isVerified) {
      return NextResponse.json(
        {
          error: `Restricted: Your company verification status is currently ${verification_status}. Browsing candidate profiles is restricted until your company is verified by an admin.`,
          verification_status,
          applicants: [],
        },
        { status: 403 }
      );
    }

    const companyId = await getCompanyId(userId);

    if (!companyId) {
      return NextResponse.json(
        { error: "Company not found." },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const jobId = searchParams.get("job_id");

    if (status && status !== "ALL" && !ALLOWED_APPLICATION_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status filter." }, { status: 400 });
    }

    // ------------------------------
    // Jobs
    // ------------------------------

    const jobs = await directusItems<Job>("vs_job_posting", {
      query: `filter[company_id][_eq]=${companyId}&fields=job_id,job_title,company_id&limit=-1`,
    });
    const jobIds = jobs.map((job) => job.job_id);

    const companyIds = [
      ...new Set(
        jobs
          .map((job) => job.company_id)
          .filter(Boolean)
      ),
    ];

    const companiesMap = await getCompanyNames(companyIds);

    if (jobIds.length === 0) {
      return NextResponse.json({
        applicants: [],
        jobs: [],
      });
    }
    
    const extraFilters: string[] = [];
    if (status && status !== "ALL") {
      extraFilters.push(`filter[application_status][_eq]=${encodeURIComponent(status)}`);
    }
    if (jobId) {
      extraFilters.push(`filter[job_id][_eq]=${encodeURIComponent(jobId)}`);
    }

    // ------------------------------
    // Applications
    // ------------------------------

    const rawApps = await directusItemsWhereIn<RawApplication>(
      "vs_job_application",
      "job_id",
      jobIds,
      "application_id,job_id,user_id,application_status,current_stage_id,cover_letter,expected_salary,portfolio_url,client_notes,applied_at,status_updated_at",
      { extra: `sort[]=-applied_at${extraFilters.length ? `&${extraFilters.join("&")}` : ""}` }
    );

    // Batches sort themselves, so the flattened list is grouped by job id rather
    // than by date. The response order is what the list renders.
    rawApps.sort((a, b) => String(b.applied_at ?? "").localeCompare(String(a.applied_at ?? "")));

    if (!rawApps.length) {
      return NextResponse.json({
        applicants: [],
      });
    }

    const userIds = [
      ...new Set(
        rawApps
          .map((app) => app.user_id)
          .filter(Boolean)
      ),
    ];

    const appIds = rawApps.map((a) => a.application_id);

    // ------------------------------
    // Bulk fetch
    // ------------------------------

    const [
      users,
      skillsRows,
      workRows,
      resumeRows,
      interviewAppRows,
      educationRows,
      screeningAnswerRows,
      referralAppRows,
    ] = await Promise.all([
      directusItemsWhereIn<VsUser>(
        "vs_user",
        "user_id",
        userIds,
        "user_id,user_fname,user_lname,user_email,user_position,profile_image_url,user_city,user_province"
      ),

      directusItemsWhereIn<SkillMap>(
        "vs_user_skills_map",
        "user_id",
        userIds,
        "user_id,skill_id.skill_name"
      ),

      directusItemsWhereIn<WorkExperience>(
        "vs_work_experience",
        "user_id",
        userIds,
        "user_id,start_date,end_date,is_current_role"
      ),

      directusItemsWhereIn<Resume>(
        "vs_job_seeker_resumes",
        "user_id",
        userIds,
        "user_id,is_primary,id"
      ),

      directusItemsWhereIn<{ interview_id: number; application_id: number }>(
        "vs_interview_application",
        "application_id",
        appIds,
        "interview_id,application_id"
      ),

      directusItemsWhereIn<ApplicantEducationBulkRow>(
        "vs_employee_education",
        "user_id",
        userIds,
        "user_id,employee_education_id,school_id.school_name,school_name_raw,school_course_id.course_name,course_name_raw,education_status,start_date,end_date"
      ),

      directusItemsWhereIn<{ application_id: number; question_id: number }>(
        "vs_job_application_answer",
        "application_id",
        appIds,
        "application_id,question_id"
      ),

      directusItemsWhereIn<{
        application_id: number;
        referral_id?: { referral_id?: number } | number;
        referrer_user_id?: { user_id?: number; user_fname?: string; user_lname?: string } | number;
      }>(
        "vs_job_application_referral",
        "application_id",
        appIds,
        "application_id,referral_id.referral_id,referrer_user_id.user_id,referrer_user_id.user_fname,referrer_user_id.user_lname"
      ),
    ]);

    const distinctInterviewIds = [
      ...new Set(interviewAppRows.map((r) => r.interview_id).filter(Boolean)),
    ];

    // A failed status read used to clear the set, which drops the scheduled
    // interview marker for every candidate at once.
    const activeInterviewRows = await directusItemsWhereIn<{ interview_id: number }>(
      "vs_interview",
      "interview_id",
      distinctInterviewIds,
      "interview_id,interview_status",
      { extra: "filter[interview_status][_in]=SCHEDULED,CONFIRMED,RESCHEDULED" }
    );
    const activeInterviewIdSet = new Set(activeInterviewRows.map((r) => r.interview_id));
    
    // ------------------------------
    // Maps
    // ------------------------------

    const usersMap: Record<number, VsUser> = {};
    const jobsMap: Record<
      number,
      {
        title: string;
        company: Company | null;
      }
    > = {};

    const skillsMap: Record<number, string[]> = {};

    const workMap: Record<number, WorkExperience[]> = {};

    const resumeMap: Record<number, number> = {};

    const activeInterviewsMap: Record<number, number> = {};

    const educationMap = groupApplicantEducation(educationRows);

    const screeningCountMap: Record<number, number> = {};

    interviewAppRows.forEach((row) => {
      if (activeInterviewIdSet.has(row.interview_id)) {
        activeInterviewsMap[row.application_id] = row.interview_id;
      }
    });

    screeningAnswerRows.forEach((row) => {
      screeningCountMap[row.application_id] = (screeningCountMap[row.application_id] || 0) + 1;
    });

    users.forEach((user) => {
      usersMap[user.user_id] = user;
    });

    jobs.forEach((job) => {
      jobsMap[job.job_id] = {
        title: job.job_title,
        company:
          companiesMap[job.company_id] ?? null,
      };
    });

    skillsRows.forEach((row) => {
      if (!skillsMap[row.user_id]) {
        skillsMap[row.user_id] = [];
      }

      const skill = row.skill_id?.skill_name;

      if (skill) {
        skillsMap[row.user_id].push(skill);
      }
    });

    workRows.forEach((row) => {
      if (!workMap[row.user_id]) {
        workMap[row.user_id] = [];
      }

      workMap[row.user_id].push(row);
    });

    // Count only primary resume per user (is_primary = 1 or true)
    resumeRows.forEach((row) => {
      if (row.is_primary === true || row.is_primary === 1 || row.is_primary === "1") {
        resumeMap[row.user_id] = 1;
      }
    });
    // Fallback: if user has resumes but none was flagged is_primary, default to 1
    resumeRows.forEach((row) => {
      if (!resumeMap[row.user_id]) {
        resumeMap[row.user_id] = 1;
      }
    });

    const referrerUserIds = [
      ...new Set(
        referralAppRows
          .map((r) =>
            typeof r.referrer_user_id === "object" ? r.referrer_user_id?.user_id : Number(r.referrer_user_id)
          )
          .filter((id): id is number => Boolean(id))
      ),
    ];

    // Whether a referrer is a school admin decides the referral TYPE shown to
    // the recruiter, so an unread lookup has to fail the list rather than
    // relabel every school-admin referral as a freelancer one.
    const schoolAdminRows = await directusItemsWhereIn<{
      user_id?: number | string;
      school_id?: { school_name?: string } | null;
    }>("vs_school_admin", "user_id", referrerUserIds, "user_id,school_id.school_name");

    const schoolAdminMap: Record<number, string> = {};
    schoolAdminRows.forEach((row) => {
      const uid = Number(row.user_id);
      const sName = typeof row.school_id === "object" ? row.school_id?.school_name : null;
      if (sName) schoolAdminMap[uid] = sName;
    });

    const appReferralMap: Record<
      number,
      {
        is_referred: boolean;
        referral_type: "SCHOOL_ADMIN" | "FREELANCER";
        referrer_name: string;
        referral_school_name: string | null;
      }
    > = {};

    referralAppRows.forEach((row) => {
      const appId = Number(row.application_id);
      const refUser = typeof row.referrer_user_id === "object" ? row.referrer_user_id : null;
      const refUserId = refUser?.user_id || Number(row.referrer_user_id) || 0;
      const schoolName = schoolAdminMap[refUserId] || null;
      const referrerName = refUser
        ? `${refUser.user_fname || ""} ${refUser.user_lname || ""}`.trim()
        : "Referrer";

      appReferralMap[appId] = {
        is_referred: true,
        referral_type: schoolName ? "SCHOOL_ADMIN" : "FREELANCER",
        referrer_name: referrerName,
        referral_school_name: schoolName,
      };
    });

    // ------------------------------
    // Job Pipelines resolution
    // ------------------------------
    const uniqueJobIds = [...new Set(rawApps.map((a) => a.job_id).filter(Boolean))];
    const jobPipelineMap = await getJobPipelinesForJobs(uniqueJobIds, companyId);

    // ------------------------------
    // Latest assessment attempt per application (batched, no N+1)
    // ------------------------------
    const attemptMap: Record<string, string | null> = {};
    const attemptRows = await directusItemsWhereIn<AssessmentAttemptRow>(
      "vs_application_assessment_attempts",
      "application_id",
      appIds,
      "application_id,job_stage_id,attempt_number,status",
      { extra: "sort[]=-attempt_number" }
    );
    // Batches split by application id, so each application's attempts all
    // arrive in one sorted batch: the first row per (application, stage) key is
    // its highest attempt number.
    for (const row of attemptRows) {
      const key = `${Number(row.application_id)}:${Number(row.job_stage_id)}`;
      if (!(key in attemptMap)) {
        attemptMap[key] = typeof row.status === "string" ? row.status : null;
      }
    }

    // ------------------------------
    // Response
    // ------------------------------

    const applicants = rawApps.map((application) => {
      const user = usersMap[application.user_id];
      
      const skills =
        skillsMap[application.user_id] ?? [];

      const workExperience =
        workMap[application.user_id] ?? [];

      const resumeCount =
        resumeMap[application.user_id] ?? 0;

      const userEdu = educationMap[application.user_id] ?? [];
      const primaryEdu = userEdu[0];
      const referralInfo = appReferralMap[application.application_id];

      const pipe = jobPipelineMap[application.job_id];
      let currentStage: JobPipelineStage | undefined;
      let allowedNextStages: Array<{
        id: number;
        stage_name: string;
        stage_type: string;
        color: string;
        is_terminal: boolean;
      }> = [];

      if (pipe?.stages) {
        if (application.current_stage_id) {
          currentStage = pipe.stages.find((s) => s.id === Number(application.current_stage_id));
        }
        if (!currentStage) {
          currentStage =
            pipe.stages.find((s) => s.stage_type === application.application_status) ||
            pipe.stages.find((s) => s.stage_type === "APPLIED") ||
            pipe.stages[0];
        }

        if (currentStage && !currentStage.is_terminal) {
          const transitions = pipe.transitions ?? [];
          const forwardStageIds = new Set(
            transitions.filter((t) => t.from_stage_id === currentStage!.id).map((t) => t.to_stage_id)
          );

          allowedNextStages = pipe.stages
            .filter(
              (s) =>
                s.id !== currentStage!.id &&
                (forwardStageIds.has(s.id) || s.stage_type === "REJECTED" || s.stage_type === "WITHDRAWN")
            )
            .map((s) => ({
              id: s.id,
              stage_name: s.stage_name,
              stage_type: s.stage_type,
              color: s.color,
              is_terminal: Boolean(s.is_terminal),
            }));
        }
      }

      return {
        ...application,

        applicant_name: user
          ? `${user.user_fname} ${user.user_lname}`.trim()
          : `Applicant #${application.user_id}`,

        applicant_email:
          user?.user_email ?? "",

        job_title:
          jobsMap[application.job_id]?.title ??
          "Unknown Role",

        current_stage_id: currentStage?.id ?? application.current_stage_id ?? null,
        stage_name: currentStage?.stage_name ?? application.application_status,
        stage_type: currentStage?.stage_type ?? application.application_status,
        stage_color: currentStage?.color ?? "sky",
        allowed_next_stages: allowedNextStages,

        assessment_status:
          currentStage?.stage_type === "ASSESSMENT" && currentStage
            ? attemptMap[`${application.application_id}:${currentStage.id}`] ?? null
            : null,
        assessment_needs_review:
          currentStage?.stage_type === "ASSESSMENT" && currentStage
            ? attemptMap[`${application.application_id}:${currentStage.id}`] === "SUBMITTED"
            : false,
        
        applicant_profile_image_url: 
          user?.profile_image_url ?? "",
        
        company:
          jobsMap[application.job_id]?.company ??
          null,

        skills,

        experience_years:
          calculateExperienceYears(
            workExperience
          ),

        work_experience_count:
          workExperience.length,

        resume_count: resumeCount,

        location: user
          ? [user.user_city, user.user_province].filter(Boolean).join(", ")
          : "",

        education: userEdu,
        education_count: userEdu.length,

        education_school: primaryEdu?.school_name ?? "",
        education_course: primaryEdu?.course_name ?? "",

        screening_answers_count: screeningCountMap[application.application_id] ?? 0,

        profile_completion:
          calculateProfileCompletion(
            user,
            skills,
            workExperience.length,
            resumeCount
          ),

        active_interview_id:
          activeInterviewsMap[application.application_id] ?? null,

        // Referral Data
        is_referred: !!referralInfo?.is_referred,
        referral_type: referralInfo?.referral_type,
        referrer_name: referralInfo?.referrer_name || null,
        referral_school_name: referralInfo?.referral_school_name || null,
      };
    });


    const jobOptions = jobs.map((j) => ({ job_id: j.job_id, job_title: j.job_title }));

    return NextResponse.json({
      applicants,
      jobs: jobOptions,
      pipeline: jobId ? jobPipelineMap[Number(jobId)] : null,
    });

    
  } catch (err: unknown) {
    console.error("GET /api/client/applicants:", err);

    // An unread list is not an empty one. Answering 200 with whatever rows did
    // come back renders candidates as "Applicant #123" with no skills, no
    // education and no referral, which the recruiter reads as the real roster.
    const upstream = err instanceof DirectusError;

    return NextResponse.json(
      {
        error: upstream
          ? "Applicants could not be read. Please try again."
          : safeErrorMessage(err, "Internal server error"),
      },
      {
        status: upstream ? 502 : 500,
      }
    );
  }
}
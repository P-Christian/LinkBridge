
import { NextRequest, NextResponse } from "next/server";
import { sendShortlistedEmail, sendHiringEmail, sendRejectionEmail, isEmailEnabledForUser } from "@/lib/mail";
import { createSystemMessage } from "@/lib/messaging/system-message";
import { createNotification } from "@/lib/notifications";
import { createEmployerNotification } from "@/lib/notifications/services/employer-notifications";
import { getPHTimeString } from "@/lib/utils";
import { transitionApplicationStage, getJobPipeline } from "@/modules/client/pipeline/services/job-pipeline.service";
import { JobPipelineStage, LEGACY_STATUS_TO_CANONICAL_MAP } from "@/modules/client/pipeline/types";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import {
  loadCompanyApplication,
  resolveReviewerCompany,
} from "@/modules/client/assessment-review/services/context";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";
import { orderEducation } from "@/modules/client/education/order-education";
import { safeErrorMessage } from "@/lib/api-error";
import {
  DirectusError,
  directusItems,
  directusItemsWhereIn,
  directusSettled,
} from "@/lib/server/directus";
import { toId } from "@/lib/server/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

interface ApplicationRow {
  application_id: number;
  job_id: number;
  user_id: number;
  application_status?: string;
  current_stage_id?: number | null;
  cover_letter?: string | null;
  expected_salary?: string | number | null;
  portfolio_url?: string | null;
  client_notes?: string | null;
  applied_at?: string | null;
  status_updated_at?: string | null;
}

interface JobPostingRow {
  job_id?: number;
  job_title?: string | null;
  company_id?: number | { company_id?: number } | null;
}

interface ApplicantUserRow {
  user_id?: number;
  user_fname?: string | null;
  user_lname?: string | null;
  user_email?: string | null;
  user_contact?: string | null;
  profile_image_url?: string | null;
  user_city?: string | null;
  user_province?: string | null;
}

interface SeekerProfileRow {
  user_id?: number;
  profile_headline?: string | null;
  professional_summary?: string | null;
  availability_status?: string | null;
  profile_visibility?: string | null;
  [key: string]: unknown;
}

interface CertificationRow {
  id?: number;
  certificate_name?: string | null;
  issuing_organization?: string | null;
  [key: string]: unknown;
}

interface CompanyRow {
  company_id?: number;
  company_name?: string | null;
  company_logo?: string | null;
  [key: string]: unknown;
}

interface ScreeningQuestionRow {
  question_id: number;
  question_text?: string | null;
}

interface ApplicationAnswerRow {
  question_id: number;
  answer_text?: string | null;
}

interface InterviewApplicationRow {
  interview_id: number;
}

interface InterviewRow {
  interview_id: number;
  interview_status?: string | null;
}

interface ApplicationReferralRow {
  application_id?: number;
  referral_id?: { referral_letter?: string | null } | number | null;
  referrer_user_id?:
    | { user_id?: number; user_fname?: string | null; user_lname?: string | null }
    | number
    | null;
}

interface SchoolAdminRow {
  school_id?: { school_name?: string | null } | number | null;
}

/**
 * Only Directus' own 404 may tell the employer a row is gone. Every other
 * failure status means the row could not be read, and answering "not found"
 * makes an outage look like a deleted candidate.
 *
 * The text sent to the browser deliberately drops the upstream reason, so a 400
 * or 500 on one row leaves nothing behind to inspect. The status and Directus'
 * own message are logged here.
 */
function missingOrOutage(
  res: { status: number; error: string },
  entity: string,
  context: string
): NextResponse {
  if (res.status === 404) {
    return NextResponse.json({ error: `${entity} not found.` }, { status: 404 });
  }
  console.error(
    `[${context}] ${entity} read failed (${res.status}): ${res.error || "Directus returned no message."}`
  );
  return NextResponse.json(
    { error: `${entity} could not be read. Please try again.` },
    { status: 502 }
  );
}

interface WorkExperience {
  id: number;
  company_name?: string | null;
  job_title?: string | null;
  location?: string | null;
  location_type?: string | null;
  employment_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current_role?: boolean | number | null;
  job_description?: string | null;
}

interface Resume {
  id: number;
  is_primary?: boolean | number | string | null;
  file_path?: string | null;
  file_url?: string | null;
  url?: string | null;
  file_id?: string | number | null;
  file?: string | number | null;
  file_name?: string | null;
  name?: string | null;
  [key: string]: unknown;
}

interface SocialLinkItem {
  id: number;
  platform_name?: string | null;
  platform?: string | null;
  profile_url?: string | null;
  url?: string | null;
  link?: string | null;
}

interface SkillMap {
  id: number;
  skill_id: number;
}

interface EducationRow {
  employee_education_id: number;
  school_id?: { school_name?: string | null } | number | null;
  school_name_raw?: string | null;
  school_course_id?: { course_name?: string | null } | number | null;
  course_name_raw?: string | null;
  education_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

type DetailEducationStatus = "Verified" | "Pending" | "Unverified";

function toDetailEducationStatus(value: string | null | undefined): DetailEducationStatus {
  if (value === "Verified" || value === "Pending" || value === "Unverified") {
    return value;
  }
  return "Unverified";
}

function resolveDetailSchoolName(row: EducationRow): string {
  const linked =
    typeof row.school_id === "object" && row.school_id !== null
      ? row.school_id.school_name
      : null;
  return linked ?? row.school_name_raw ?? "Unknown School";
}

function resolveDetailCourseName(row: EducationRow): string | null {
  const linked =
    typeof row.school_course_id === "object" && row.school_course_id !== null
      ? row.school_course_id.course_name
      : null;
  return linked ?? row.course_name_raw ?? null;
}

interface Skill {
  skill_name: string;
}
function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

const VALID_STATUSES = [
  "APPLIED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "INTERVIEWING",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
];

// GET — Retrieve details profile for a single job seeker application
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const applicationId = Number(id);
    if (!applicationId || isNaN(applicationId)) {
      return NextResponse.json(
        { error: "Invalid application ID." },
        { status: 400 }
      );
    }
    const logContext = `client/applicants/${applicationId} GET`;

    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    if (!isClientSession(session)) {
      return NextResponse.json(
        { error: "Client account required." },
        { status: 403 }
      );
    }

    const reviewer = await resolveReviewerCompany(session.userId);
    if (reviewer.unavailable) {
      return NextResponse.json(
        { error: "Your company association could not be read. Please try again." },
        { status: 502 }
      );
    }
    if (!reviewer.companyId) {
      return NextResponse.json(
        { error: "Company association not found." },
        { status: 403 }
      );
    }

    const ownedRead = await loadCompanyApplication(applicationId, reviewer.companyId);
    if (ownedRead.unavailable) {
      return NextResponse.json(
        { error: "The application could not be read. Please try again." },
        { status: 502 }
      );
    }
    if (!ownedRead.application) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    const requesterId = Number(session.userId);

    if (!requesterId || isNaN(requesterId)) {
      return NextResponse.json(
        { error: "Invalid token." },
        { status: 401 }
      );
    }

    // BUSINESS RULE: Only VERIFIED companies can view candidate details
    const { isVerified, verification_status, companyId } = await checkCompanyVerificationStatus(requesterId);
    if (!isVerified || !companyId) {
      return NextResponse.json(
        {
          error: `Restricted: Your company verification status is currently ${verification_status}. Viewing candidate details is restricted until your company is verified by an admin.`,
          verification_status,
        },
        { status: 403 }
      );
    }

    // ---------------------------------------------------
    // APPLICATION
    // ---------------------------------------------------

    const applicationRes = await directusSettled<{ data?: ApplicationRow | null }>(
      `/items/vs_job_application/${applicationId}`,
      {
        query:
          "fields=application_id,job_id,user_id,application_status,current_stage_id," +
          "cover_letter,expected_salary,portfolio_url,client_notes,applied_at,status_updated_at",
      }
    );
    // An unreadable row used to answer "Application not found.", so a Directus
    // outage deleted a real candidate from the employer's pipeline.
    if (!applicationRes.ok) {
      return missingOrOutage(applicationRes, "Application", logContext);
    }

    const application = applicationRes.data?.data ?? null;

    if (!application) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    // IDOR / BOLA Prevention: Verify application belongs to a job owned by requester's company
    // A pointer that is not a positive integer would become a 400/500 from Directus, not a 404.
    const targetJobId = toId(application.job_id);
    if (!targetJobId) {
      return NextResponse.json(
        { error: "Application is not associated with a valid job." },
        { status: 400 }
      );
    }

    const jobCheckRes = await directusSettled<{ data?: JobPostingRow | null }>(
      `/items/vs_job_posting/${targetJobId}`,
      { query: "fields=job_id,job_title,company_id" }
    );
    if (!jobCheckRes.ok) {
      return missingOrOutage(jobCheckRes, "Associated job posting", logContext);
    }
    const verifiedJob = jobCheckRes.data?.data ?? null;
    if (Number(verifiedJob?.company_id) !== companyId) {
      return NextResponse.json(
        { error: "Forbidden: Candidate application belongs to another organization." },
        { status: 403 }
      );
    }

    const applicantUserId = application.user_id;

    // ---------------------------------------------------
    // PARALLEL REQUESTS
    //
    // Every one of these used to answer `[]`/`null` when Directus was
    // unreachable, so an outage rendered a real candidate with no work history,
    // no education, no skills, no resume and no interview. Each read is fatal
    // now; the outer catch turns it into a 502 the drawer can retry.
    // ---------------------------------------------------

    const [userRes, profileRows, workRows, educationRows, certificationRows, resumeRows, socialRows, skillsMapRows] =
      await Promise.all([
        directusSettled<{ data?: ApplicantUserRow | null }>(
          `/items/vs_user/${applicantUserId}`
        ),
        directusItems<SeekerProfileRow>("vs_job_seeker_profile", {
          query: `filter[user_id][_eq]=${applicantUserId}&limit=1`,
        }),
        directusItems<WorkExperience>("vs_work_experience", {
          query: `filter[user_id][_eq]=${applicantUserId}&sort[]=-start_date&limit=-1`,
        }),
        directusItems<EducationRow>("vs_employee_education", {
          query:
            `filter[user_id][_eq]=${applicantUserId}` +
            `&fields=employee_education_id,school_id.school_name,school_name_raw,school_course_id.course_name,course_name_raw,education_status,start_date,end_date` +
            `&limit=-1`,
        }),
        directusItems<CertificationRow>("vs_certifications", {
          query: `filter[user_id][_eq]=${applicantUserId}&limit=-1`,
        }),
        directusItems<Resume>("vs_job_seeker_resumes", {
          query: `filter[user_id][_eq]=${applicantUserId}&limit=-1`,
        }),
        directusItems<SocialLinkItem>("vs_user_social_links", {
          query: `filter[user_id][_eq]=${applicantUserId}&limit=-1`,
        }),
        directusItems<SkillMap>("vs_user_skills_map", {
          query: `filter[user_id][_eq]=${applicantUserId}&fields=id,skill_id&limit=-1`,
        }),
      ]);

    // ---------------------------------------------------
    // USER
    // ---------------------------------------------------

    if (!userRes.ok) {
      return missingOrOutage(userRes, "Candidate profile", logContext);
    }

    const user = userRes.data?.data ?? null;
    if (!user) {
      return NextResponse.json(
        { error: "Candidate profile not found." },
        { status: 404 }
      );
    }

    // ---------------------------------------------------
    // PROFILE
    // ---------------------------------------------------

    const profile = profileRows[0] ?? null;

    // ---------------------------------------------------
    // JOB + COMPANY
    // ---------------------------------------------------

    // The ownership check above already read this posting's job_title and
    // company_id, so re-reading the same row only added another way to fail.
    const jobTitle = verifiedJob?.job_title ?? "Unknown Role";

    let company: CompanyRow | null = null;
    const jobCompanyId =
      typeof verifiedJob?.company_id === "object"
        ? verifiedJob?.company_id?.company_id
        : verifiedJob?.company_id;
    if (jobCompanyId) {
      const companyRes = await directusSettled<{ data?: CompanyRow | null }>(
        `/items/vs_company/${jobCompanyId}`
      );
      // A dangling FK is data; anything else is an outage and must not render
      // the employer's own company as "no company".
      if (!companyRes.ok && companyRes.status !== 404) {
        return missingOrOutage(companyRes, "Company", logContext);
      }
      company = companyRes.data?.data ?? null;
    }
    // ---------------------------------------------------
    // WORK EXPERIENCE
    // ---------------------------------------------------

    const workExperience = workRows.map((exp) => ({
      id: exp.id,
      company_name: exp.company_name,
      job_title: exp.job_title,
      location: exp.location,
      location_type: exp.location_type,
      employment_type: exp.employment_type,
      start_date: exp.start_date,
      end_date: exp.end_date,
      is_current_role: !!exp.is_current_role,
      job_description: exp.job_description,
    }));

    // ---------------------------------------------------
    // EDUCATION
    // ---------------------------------------------------

    const education = orderEducation(educationRows, {
      status: (row) => row.education_status ?? null,
      endDate: (row) => row.end_date ?? null,
      startDate: (row) => row.start_date ?? null,
      id: (row) => row.employee_education_id,
    }).map((row) => ({
      id: row.employee_education_id,
      status: toDetailEducationStatus(row.education_status),
      school_name: resolveDetailSchoolName(row),
      course_name: resolveDetailCourseName(row),
      start_date: row.start_date ?? null,
      end_date: row.end_date ?? null,
    }));

    // ---------------------------------------------------
    // CERTIFICATIONS
    // ---------------------------------------------------

    const certifications = certificationRows;

    // ---------------------------------------------------
    // RESUME
    // ---------------------------------------------------

    const resumes = resumeRows.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

    // Show only is_primary resume (fallback to latest if none marked primary)
    const primaryResumes = resumes.filter((r) => r.is_primary === true || r.is_primary === 1 || r.is_primary === "1");
    const chosenResumes = primaryResumes.length > 0 ? primaryResumes.slice(0, 1) : resumes.slice(0, 1);

    const formattedResumes = chosenResumes.map((r) => {
      const rawAsset = r.file_url || r.file_id || r.file || r.file_path || r.url || "";
      let file_url = "";

      if (typeof rawAsset === "string" && rawAsset.trim()) {
        const trimmed = rawAsset.trim();
        if (trimmed.includes("/assets/")) {
          const match = trimmed.match(/\/assets\/([a-zA-Z0-9-]+)/);
          file_url = match?.[1] ? `/api/assets/${match[1]}` : trimmed;
        } else if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/api/")) {
          file_url = trimmed;
        } else {
          file_url = `/api/assets/${trimmed}`;
        }
      }

      return {
        id: r.id,
        file_name: r.file_name || r.name || "Resume.pdf",
        file_url,
      };
    });

    const primaryResume = chosenResumes[0] || null;

    // ---------------------------------------------------
    // SOCIAL LINKS
    // ---------------------------------------------------

    const socialLinks = socialRows.map((s) => {
      const linkUrl = s.profile_url || s.url || s.link || "";
      const platformName = s.platform_name || s.platform || "Link";
      return {
        id: s.id,
        platform: platformName,
        platform_name: platformName,
        profile_url: linkUrl,
        url: linkUrl,
      };
    });

    // ---------------------------------------------------
    // SKILLS
    // ---------------------------------------------------

    const skillIds = skillsMapRows.map((s) => s.skill_id).filter(Boolean);

    // A failed name lookup used to leave `skills` empty, so the drawer reported
    // a skilled candidate as having none. Skill ids are read in batches because
    // a long `_in=` list fails at the transport layer.
    const skillRows = await directusItemsWhereIn<Skill>(
      "vs_master_skills",
      "id",
      skillIds,
      "skill_name"
    );
    const skills = skillRows.map((s) => s.skill_name);

    // ---------------------------------------------------
    // SCREENING ANSWERS
    // ---------------------------------------------------

    let screeningAnswers: { question_id: number; question_text: string; answer_text: string }[] | null = null;

    // 1. Configured screening questions for the job, and 2. the answers this
    // candidate submitted. Both used to degrade to `[]`, which is how an outage
    // turned a screened candidate into one who never answered — a reason to
    // reject them.
    const [jobQuestions, ansList] = await Promise.all([
      application.job_id
        ? directusItems<ScreeningQuestionRow>("vs_job_screening_question", {
            query: `filter[job_id][_eq]=${application.job_id}&fields=question_id,question_text&limit=-1`,
          })
        : Promise.resolve<ScreeningQuestionRow[]>([]),
      directusItems<ApplicationAnswerRow>("vs_job_application_answer", {
        query: `filter[application_id][_eq]=${application.application_id}&fields=question_id,answer_text&limit=-1`,
      }),
    ]);

    const ansMap = new Map<number, string>();
    ansList.forEach((a) => {
      if (a.question_id) ansMap.set(a.question_id, a.answer_text ?? "");
    });

    if (jobQuestions.length > 0) {
      // Map all job questions, including unanswered ones with empty string
      screeningAnswers = jobQuestions.map((q) => ({
        question_id: q.question_id,
        question_text: q.question_text || `Question #${q.question_id}`,
        answer_text: ansMap.get(q.question_id) ?? "",
      }));
    } else if (ansList.length > 0) {
      // Fallback if questions are recorded with answers
      const qIds = [...new Set(ansList.map((a) => a.question_id).filter(Boolean))];
      const qTextMap = new Map<number, string>();
      const qList = await directusItemsWhereIn<ScreeningQuestionRow>(
        "vs_job_screening_question",
        "question_id",
        qIds,
        "question_id,question_text"
      );
      qList.forEach((q) => {
        qTextMap.set(q.question_id, q.question_text ?? "");
      });

      screeningAnswers = ansList.map((a) => ({
        question_id: a.question_id,
        question_text: qTextMap.get(a.question_id) || `Question #${a.question_id}`,
        answer_text: a.answer_text ?? "",
      }));
    } else {
      screeningAnswers = [];
    }

    // ---------------------------------------------------
    // ACTIVE INTERVIEW
    // ---------------------------------------------------
    // Answering "no interview" when the lookup failed told the employer a
    // scheduled interview had been cancelled.
    let activeInterviewId: number | null = null;
    const interviewAppRows = await directusItems<InterviewApplicationRow>(
      "vs_interview_application",
      {
        query: `filter[application_id][_eq]=${application.application_id}&fields=interview_id&limit=-1`,
      }
    );
    const ivIds = interviewAppRows.map((r) => r.interview_id).filter(Boolean);
    if (ivIds.length > 0) {
      const activeIvRows = await directusItemsWhereIn<InterviewRow>(
        "vs_interview",
        "interview_id",
        ivIds,
        "interview_id,interview_status",
        {
          extra:
            "filter[interview_status][_in]=SCHEDULED,CONFIRMED,RESCHEDULED&sort[]=-interview_id&limit=1",
        }
      );
      if (activeIvRows.length > 0) {
        activeInterviewId = activeIvRows[0].interview_id;
      }
    }

    // ---------------------------------------------------
    // REFERRAL & INSTITUTIONAL ENDORSEMENT
    // ---------------------------------------------------
    let isReferred = false;
    let referralType: "SCHOOL_ADMIN" | "FREELANCER" | undefined = undefined;
    let referrerName: string | null = null;
    let referralSchoolName: string | null = null;
    let referralLetter: string | null = null;

    // An endorsement that could not be read used to be swallowed by a
    // console.warn, so an introduced candidate was presented as self-applied.
    const refRows = await directusItems<ApplicationReferralRow>(
      "vs_job_application_referral",
      {
        query:
          `filter[application_id][_eq]=${application.application_id}` +
          `&fields=*,referral_id.*,referrer_user_id.user_id,referrer_user_id.user_fname,referrer_user_id.user_lname&limit=1`,
      }
    );
    const refRow = refRows[0] ?? null;
    if (refRow) {
      isReferred = true;
      const rUser = refRow.referrer_user_id;
      const refUserId =
        typeof rUser === "object" && rUser !== null
          ? Number(rUser.user_id) || 0
          : Number(rUser) || 0;
      referrerName =
        typeof rUser === "object" && rUser !== null
          ? `${rUser.user_fname ?? ""} ${rUser.user_lname ?? ""}`.trim()
          : null;

      // Check if school admin
      if (refUserId > 0) {
        const sRec = (
          await directusItems<SchoolAdminRow>("vs_school_admin", {
            query: `filter[user_id][_eq]=${refUserId}&fields=school_id.school_name&limit=1`,
          })
        )[0];
        const sSchool = sRec?.school_id;
        if (sSchool) {
          referralSchoolName =
            typeof sSchool === "object" ? sSchool.school_name ?? null : null;
          referralType = "SCHOOL_ADMIN";
        }
      }

      if (!referralType) referralType = "FREELANCER";

      // Check for referral note/letter in vs_job_referral
      const linkedReferral = refRow.referral_id;
      if (linkedReferral && typeof linkedReferral === "object") {
        referralLetter = linkedReferral.referral_letter || null;
      }
    }

    const portfolioFromSocials = socialLinks.find(
      (s) => s.platform_name?.toLowerCase().includes("portfolio") || s.platform?.toLowerCase().includes("portfolio")
    )?.profile_url;

    const resolvedPortfolioUrl = application.portfolio_url?.trim() || portfolioFromSocials?.trim() || null;

    // Resolve active ATS Job Pipeline for this candidate
    let currentStage: JobPipelineStage | undefined;
    let allowedNextStages: Array<{
      id: number;
      stage_name: string;
      stage_type: string;
      color: string;
      is_terminal: boolean;
    }> = [];

    if (application.job_id) {
      // Not wrapped: a pipeline that could not be read has to fail the request.
      // Swallowing it left `allowed_next_stages` empty, which rendered as a
      // candidate who cannot be moved to any stage rather than as an outage.
      const pipeline = await getJobPipeline(Number(application.job_id));
      if (pipeline?.stages) {
        if (application.current_stage_id) {
          currentStage = pipeline.stages.find((s) => s.id === Number(application.current_stage_id));
        }
        if (!currentStage) {
          currentStage =
            pipeline.stages.find((s) => s.stage_type === application.application_status) ||
            pipeline.stages.find((s) => s.stage_type === "APPLIED") ||
            pipeline.stages[0];
        }

        if (currentStage && !currentStage.is_terminal) {
          const transitions = pipeline.transitions ?? [];
          const forwardStageIds = new Set(
            transitions.filter((t) => t.from_stage_id === currentStage!.id).map((t) => t.to_stage_id)
          );

          allowedNextStages = pipeline.stages
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
    }

    const applicant = {
      application_id: application.application_id,
      job_id: application.job_id,
      user_id: application.user_id,

      company,

      application_status: application.application_status,
      current_stage_id: currentStage?.id ?? application.current_stage_id ?? null,
      stage_name: currentStage?.stage_name ?? application.application_status,
      stage_type: currentStage?.stage_type ?? application.application_status,
      stage_color: currentStage?.color ?? "sky",
      allowed_next_stages: allowedNextStages,

      applicant_name:
        `${user.user_fname} ${user.user_lname}`.trim(),

      applicant_email: user.user_email,

      applicant_phone: user.user_contact,

      profile_image: user.profile_image_url,

      location:
        [user.user_city, user.user_province]
          .filter(Boolean)
          .join(", ") || null,

      job_title: jobTitle,

      profile_headline: profile?.profile_headline ?? null,

      professional_summary:
        profile?.professional_summary ?? null,

      cover_letter: application.cover_letter,

      portfolio_url: resolvedPortfolioUrl,

      expected_salary: application.expected_salary
        ? Number(application.expected_salary)
        : null,

      screening_answers: screeningAnswers,

      client_notes: application.client_notes,

      applied_at: application.applied_at,

      status_updated_at:
        application.status_updated_at,

      resume: primaryResume,
      resumes: formattedResumes,
      resume_count: formattedResumes.length,

      skills,

      social_links: socialLinks,

      education,

      certifications,

      work_experience: workExperience,

      active_interview_id: activeInterviewId,

      // Referral
      is_referred: isReferred,
      referral_type: referralType,
      referrer_name: referrerName,
      referral_school_name: referralSchoolName,
      referral_letter: referralLetter,
    };
 
    return NextResponse.json({
      success: true,
      applicant,
    });
  } catch (err: unknown) {
    console.error(
      "GET /api/client/applicants/[id] error:",
      err
    );

    // Every read in this handler is fatal now, so an unreachable Directus lands
    // here. The drawer must show something to retry, not a candidate whose
    // history, skills and interview silently vanished.
    if (err instanceof DirectusError) {
      return NextResponse.json(
        { error: "Candidate details could not be read. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error:
          safeErrorMessage(err, "Internal server error"),
      },
      {
        status: 500,
      }
    );
  }
}

// PATCH — Update application status / stage
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const applicationId = Number(id);
    if (!applicationId || isNaN(applicationId)) {
      return NextResponse.json(
        { error: "Invalid application ID." },
        { status: 400 }
      );
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
      return NextResponse.json({ error: "Company association not found." }, { status: 403 });
    }
    const ownedRead = await loadCompanyApplication(applicationId, Number(companyId));
    if (ownedRead.unavailable) {
      // A refused stage move that reads as "Application not found" tells the
      // recruiter the candidate was withdrawn when the row was never read.
      return NextResponse.json(
        { error: "The application could not be read. Please try again." },
        { status: 502 }
      );
    }
    if (!ownedRead.application) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }
    const owned = ownedRead.application;
    const targetJobId = Number(owned.job_id);
    const userId = requesterId;
    const body = await req.json().catch(() => null);

    let targetStageId: number | null = body?.to_stage_id ? Number(body.to_stage_id) : null;

    // If legacy application_status was sent without to_stage_id, resolve targetStageId from pipeline
    if (!targetStageId && body?.application_status) {
      try {
        const pipe = await getJobPipeline(targetJobId);
        const rawStatus = String(body.application_status).toUpperCase();
        const canonicalType = LEGACY_STATUS_TO_CANONICAL_MAP[rawStatus] || rawStatus;
        const matched = pipe?.stages?.find(
          (s) => s.stage_type === canonicalType || s.stage_type === rawStatus
        );
        if (matched) targetStageId = matched.id;
      } catch (err) {
        console.error("Error mapping legacy application_status to stage:", err);
      }
    }

    if (targetStageId) {
      const result = await transitionApplicationStage({
        applicationId,
        toStageId: targetStageId,
        changedByUserId: requesterId,
        notes: body?.client_notes ?? body?.notes,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Failed to update candidate stage." },
          { status: result.statusCode || 422 }
        );
      }

      return NextResponse.json({
        success: true,
        message: result.noop
          ? `Application already in stage "${result.toStage?.stage_name}".`
          : `Application moved to "${result.toStage?.stage_name}".`,
        application: result.application,
        from_stage: result.fromStage,
        to_stage: result.toStage,
      });
    }

    // If only updating notes without changing stage
    if (body?.client_notes !== undefined) {
      const nowPH = getPHTimeString();
      const res = await fetch(`${DIRECTUS_BASE}/items/vs_job_application/${id}?fields=application_id,client_notes,status_updated_at`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({
          client_notes: String(body.client_notes).trim().slice(0, 1000),
          status_updated_at: nowPH,
        }),
      });
      if (res.ok) {
        return NextResponse.json({ success: true, message: "Client notes updated." });
      }
    }

    if (!body?.application_status) {
      return NextResponse.json(
        { error: "to_stage_id or application_status is required." },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(body.application_status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Assessment-gate guard: never direct-write application_status while the
    // candidate sits at an ASSESSMENT stage. Stage moves (with the gate)
    // go through transitionApplicationStage above; the assessment decision
    // flow owns ASSESSMENT-stage moves.
    if (owned.current_stage_id !== null) {
      try {
        const pipe = await getJobPipeline(owned.job_id);
        const current = pipe?.stages?.find((s) => s.id === owned.current_stage_id);
        if (current?.stage_type === "ASSESSMENT") {
          return NextResponse.json(
            { error: "This candidate is at an assessment stage. Use the assessment decision flow to move them." },
            { status: 409 }
          );
        }
      } catch (err) {
        console.error("Error resolving current stage for assessment guard:", err);
      }
    }

    const nowPH = getPHTimeString();

    const payload: Record<string, unknown> = {
      application_status: body.application_status,
      status_updated_at: nowPH,
    };

    if (body.client_notes !== undefined) payload.client_notes = body.client_notes;

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_job_application/${id}?fields=application_id,application_status,status_updated_at,client_notes,user_id`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: json.errors?.[0]?.message ?? "Failed to update application status." },
        { status: res.status }
      );
    }

    // Fetch application details to resolve candidate, job, and company for notifications
    try {
      const appRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_application/${id}?fields=application_id,user_id,job_id`, {
        headers: getHeaders(),
        cache: "no-store",
      });

      if (appRes.ok) {
        const appData = (await appRes.json()).data;
        const jobseekerId = appData?.user_id || json.data?.user_id;

        let jobTitle = "the position";
        let companyName = "the company";
        let companyId: number | null = null;

        if (appData?.job_id) {
          const jobRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_posting/${appData.job_id}?fields=job_title,company_id`, {
            headers: getHeaders(),
            cache: "no-store",
          });
          if (jobRes.ok) {
            const jData = (await jobRes.json()).data;
            if (jData?.job_title) jobTitle = jData.job_title;
            if (jData?.company_id) {
              companyId = Number(jData.company_id);
              const compRes = await fetch(`${DIRECTUS_BASE}/items/vs_company/${jData.company_id}?fields=company_name`, {
                headers: getHeaders(),
                cache: "no-store",
              });
              if (compRes.ok) {
                companyName = (await compRes.json()).data?.company_name || companyName;
              }
            }
          }
        }

        // 1. Single dynamic notification for the candidate (Jobseeker)
        if (jobseekerId) {
          let candidateTitle = "Application Status Updated";
          let candidateMessage = `Your application status for "${jobTitle}" has been updated.`;

          if (body.application_status === "UNDER_REVIEW") {
            candidateTitle = "Application Under Review";
            candidateMessage = `Your application for "${jobTitle}" at ${companyName} is now under review.`;
          } else if (body.application_status === "SHORTLISTED") {
            candidateTitle = "Application Shortlisted";
            candidateMessage = `You have been shortlisted for "${jobTitle}" at ${companyName}!`;
          } else if (body.application_status === "HIRED") {
            candidateTitle = "Application Selected";
            candidateMessage = `Congratulations! You have been selected for "${jobTitle}" at ${companyName}.`;
          } else if (body.application_status === "REJECTED") {
            candidateTitle = "Application Status Update";
            candidateMessage = `Your application for "${jobTitle}" at ${companyName} was not selected.`;
          } else if (body.application_status === "INTERVIEWING") {
            candidateTitle = "Application in Interview Stage";
            candidateMessage = `Your application for "${jobTitle}" at ${companyName} has moved to the interview stage.`;
          }

          await createNotification({
            event_type: "application_status_changed",
            recipient_user_id: jobseekerId,
            entity_type: "job_application",
            entity_id: Number(id),
            category: "APPLICATION_STATUS_UPDATED",
            title: candidateTitle,
            message: candidateMessage,
            action_url: "/linkbridge/freelancer/applications",
          }).catch((err) => console.error("[Candidate Notification] Error:", err));
        }

        // 2. Team Activity: Notify OTHER team members in the company (suppress for the acting recruiter)
        const requestingEmployerId = userId;
        if (companyId && requestingEmployerId && ["SHORTLISTED", "HIRED", "REJECTED", "UNDER_REVIEW"].includes(body.application_status)) {
          const teamUsersRes = await fetch(
            `${DIRECTUS_BASE}/items/vs_company_user?filter[company_id][_eq]=${companyId}&filter[user_id][_neq]=${requestingEmployerId}&fields=user_id`,
            { headers: getHeaders(), cache: "no-store" }
          );

          if (teamUsersRes.ok) {
            const teamMembers: { user_id: number }[] = (await teamUsersRes.json()).data ?? [];
            const statusLabel =
              body.application_status === "SHORTLISTED" ? "shortlisted a candidate" :
              body.application_status === "HIRED" ? "hired a candidate" :
              body.application_status === "REJECTED" ? "rejected a candidate" :
              "moved a candidate to review";

            for (const member of teamMembers) {
              await createEmployerNotification({
                event_type: "TEAM_ACTIVITY",
                recipient_user_id: member.user_id,
                entity_type: "job_application",
                entity_id: Number(id),
                category: "TEAM_ACTIVITY",
                title: "Team Activity",
                message: `A team member ${statusLabel} for "${jobTitle}".`,
                action_url: `/linkbridge/client/applicants/${id}`,
              }).catch((err) => console.error("[Team Activity Notification] Error:", err));
            }
          }
        }
      }
    } catch (notifyErr) {
      console.error("[Applicant Status Notification] Error:", notifyErr);
    }

    // Fetch application details to resolve candidate & job for email notification
    const mailWarnings: string[] = [];
    try {
      const appRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_application/${id}?fields=application_id,user_id,job_id`, {
        headers: getHeaders(),
        cache: "no-store",
      });
      if (appRes.ok) {
        const appData = (await appRes.json()).data;
        if (appData?.user_id) {
          const userRes = await fetch(`${DIRECTUS_BASE}/items/vs_user/${appData.user_id}?fields=user_email,user_fname,user_lname`, {
            headers: getHeaders(),
            cache: "no-store",
          });
          if (userRes.ok) {
            const candidate = (await userRes.json()).data;
            if (candidate?.user_email) {
              let jobTitle = "Unknown Position";
              let companyName = "Employer";

              if (appData.job_id) {
                const jobRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_posting/${appData.job_id}?fields=job_title,company_id`, {
                  headers: getHeaders(),
                  cache: "no-store",
                });
                if (jobRes.ok) {
                  const jData = (await jobRes.json()).data;
                  if (jData?.job_title) jobTitle = jData.job_title;
                  if (jData?.company_id) {
                    const compRes = await fetch(`${DIRECTUS_BASE}/items/vs_company/${jData.company_id}?fields=company_name`, {
                      headers: getHeaders(),
                      cache: "no-store",
                    });
                    if (compRes.ok) {
                      companyName = (await compRes.json()).data?.company_name || companyName;
                    }
                  }
                }
              }

              const candidateName = `${candidate.user_fname} ${candidate.user_lname}`.trim();
              const notes = typeof body.client_notes === "string" ? body.client_notes : null;

              const statusEmailPreference = await isEmailEnabledForUser(appData.user_id, "APPLICATION_STATUS_UPDATED");
              if (statusEmailPreference === null) {
                mailWarnings.push(
                  "The candidate's email settings could not be read, so no status email was sent."
                );
              }
              if (statusEmailPreference === true) {
                if (body.application_status === "SHORTLISTED") {
                  await sendShortlistedEmail(candidate.user_email, {
                    candidateName,
                    companyName,
                    jobTitle,
                  }).catch((e) => console.error("Shortlisted mail error:", e));
                } else if (body.application_status === "HIRED") {
                  await sendHiringEmail(candidate.user_email, {
                    candidateName,
                    companyName,
                    jobTitle,
                    notes,
                  }).catch((e) => console.error("Hiring mail error:", e));
                } else if (body.application_status === "REJECTED") {
                  await sendRejectionEmail(candidate.user_email, {
                    candidateName,
                    companyName,
                    jobTitle,
                    notes,
                  }).catch((e) => console.error("Rejection mail error:", e));
                }
              }

              // Create System Message for Conversation
              if (requesterId && appData.user_id) {
                const systemText =
                  body.application_status === "HIRED"
                    ? "Client hired you."
                    : `Application status changed: ${body.application_status}`;

                const statusEventType =
                  body.application_status === "HIRED"
                    ? "HIRED"
                    : "APPLICATION_STATUS_CHANGED";

                await createSystemMessage({
                  clientId: requesterId,
                  freelancerId: appData.user_id,
                  jobId: appData.job_id ?? null,
                  text: systemText,
                  senderId: requesterId,
                  systemEventType: statusEventType,
                  applicationId: appData.application_id ?? null,
                }).catch((e) => console.error("Status change system message error:", e));
              }
            }
          }
        }
      }
    } catch (mailErr) {
      console.error("Error dispatching status update email:", mailErr);
    }

    return NextResponse.json({
      success: true,
      message: `Application status updated to ${body.application_status}.`,
      application: json.data,
      ...(mailWarnings.length > 0 ? { warnings: mailWarnings } : {}),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

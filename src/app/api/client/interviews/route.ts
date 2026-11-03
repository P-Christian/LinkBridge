import { NextRequest, NextResponse } from "next/server";
import { sendInterviewScheduledEmail, isEmailEnabledForUser } from "@/lib/mail";
import { createSystemMessage } from "@/lib/messaging/system-message";
import { createFreelancerNotification } from "@/lib/notifications/services/freelancer-notifications";
import { createEmployerNotification } from "@/lib/notifications/services/employer-notifications";
import { getPHTimeString, toPHWallClock } from "@/lib/utils";
import { getJobPipelinesForJobs } from "@/modules/client/pipeline/services/job-pipeline.service";
import { JobPipelineVersion, JobPipelineStage } from "@/modules/client/pipeline/types";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { resolveReviewerCompany } from "@/modules/client/assessment-review/services/context";
import { safeErrorMessage } from "@/lib/api-error";
import { mapPool } from "@/lib/server/pool";
import { directusItemsWhereIn } from "@/lib/server/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

/**
 * `status` is interpolated into a Directus filter query string, so only these
 * enums are accepted — anything else is rejected rather than passed through.
 */
const ALLOWED_INTERVIEW_STATUSES = new Set([
  "SCHEDULED",
  "CONFIRMED",
  "RESCHEDULED",
  "CANCELLED",
  "COMPLETED",
  "CONCLUDED",
  "ENDED",
  "NO_SHOW",
]);

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

function formatAvatarUrl(url?: string | null): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("/api/client/assets/")) {
    return trimmed;
  }
  if (trimmed.startsWith("data:")) {
    return trimmed;
  }
  const assetsMatch = trimmed.match(/\/assets\/([^/?#]+)/u);
  if (assetsMatch?.[1]) {
    return `/api/client/assets/${assetsMatch[1]}`;
  }
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return `/api/client/assets/${encodeURIComponent(trimmed)}`;
  }
  return trimmed;
}

export function formatInterviewDateTime(dateTimeStr: string): string {
  try {
    const dateObj = new Date(dateTimeStr.replace(" ", "T"));
    if (isNaN(dateObj.getTime())) return dateTimeStr;

    const formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const formattedTime = dateObj.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return `${formattedDate} at ${formattedTime}`;
  } catch {
    return dateTimeStr;
  }
}

interface DirectusInterview {
  interview_id: number;
  company_id: number;
  interviewer_user_id: number;
  scheduled_at: string;
  duration_minutes?: number;
  timezone?: string;
  interview_format: string;
  meeting_link?: string | null;
  meeting_location?: string | null;
  interview_notes?: string | null;
  interview_status: string;
  cancel_reason?: string | null;
  created_by_user_id?: number;
  updated_by_user_id?: number | null;
  created_at?: string;
}

interface DirectusInterviewApp {
  interview_application_id: number;
  interview_id: number;
  application_id: number;
  attendance_status: string;
  candidate_notes?: string | null;
  feedback?: string | null;
  created_at?: string;
}

interface ApplicationSummary {
  application_id: number;
  user_id: number;
  job_id: number;
  application_status: string;
  current_stage_id?: number | null;
}

interface VsUser {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_email: string;
  user_contact?: string | null;
  profile_image_url?: string | null;
}

interface DirectusJob {
  job_id: number;
  job_title: string;
}

// ─── GET — List interviews for company ─────────────────────────────────

/**
 * Reads a collection with an `_in=` id list, in bounded batches. A single
 * request cannot carry every id once a company's calendar is long, and an
 * over-long URL fails at the transport layer, which used to be answered with
 * whichever rows did come back — an interview then renders as though nobody
 * was scheduled for it.
 */
async function readBatched<T>(
  collection: string,
  field: string,
  ids: (number | string)[],
  fields: string,
  label: string,
  extra?: string
): Promise<{ data: T[] } | { error: string }> {
  try {
    return {
      data: await directusItemsWhereIn<T>(collection, field, ids, fields, extra ? { extra } : {}),
    };
  } catch (err) {
    console.error(`/api/client/interviews: ${collection} read failed`, err);
    return { error: `${label} could not be read. Please try again.` };
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    const userId = Number(session.userId);
    if (!userId || isNaN(userId)) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

    const reviewer = await resolveReviewerCompany(session.userId);
    if (reviewer.unavailable) {
      return NextResponse.json(
        { error: "Your company association could not be read. Please try again." },
        { status: 502 }
      );
    }
    const companyId = reviewer.companyId;
    if (!companyId) return NextResponse.json({ error: "Company not found." }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    if (status && status !== "ALL" && !ALLOWED_INTERVIEW_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status filter." }, { status: 400 });
    }

    let filterQuery = `filter[company_id][_eq]=${companyId}`;
    if (status && status !== "ALL") filterQuery += `&filter[interview_status][_eq]=${encodeURIComponent(status)}`;

    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_interview?${filterQuery}&sort[]=-created_at&sort[]=-interview_id&fields=*&limit=-1`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: "Interviews could not be read. Please try again." },
        { status: 502 }
      );
    }

    const rawInterviews: DirectusInterview[] = (await res.json()).data ?? [];
    if (rawInterviews.length === 0) return NextResponse.json({ interviews: [] });

    const interviewIds = rawInterviews.map((iv) => iv.interview_id);

    const junction = await readBatched<DirectusInterviewApp>(
      "vs_interview_application",
      "interview_id",
      interviewIds,
      "*",
      "Interview attendance"
    );
    // A failed attach read used to answer with an empty candidate list, which
    // looks exactly like an interview nobody was scheduled for.
    if ("error" in junction) {
      return NextResponse.json({ error: junction.error }, { status: 502 });
    }
    const junctionApps = junction.data;

    const appIds = [...new Set(junctionApps.map((ja) => ja.application_id).filter(Boolean))];

    const appsMap: Record<number, ApplicationSummary> = {};
    if (appIds.length > 0) {
      const apps = await readBatched<ApplicationSummary>(
        "vs_job_application",
        "application_id",
        appIds,
        "application_id,user_id,job_id,application_status,current_stage_id",
        "Candidate details"
      );
      // A missing application row is rendered as `Applicant #0` on an unknown
      // role, so a partial read has to fail the whole list instead.
      if ("error" in apps) {
        return NextResponse.json({ error: apps.error }, { status: 502 });
      }
      apps.data.forEach((a) => {
        appsMap[a.application_id] = a;
      });
    }

    const userIds = [...new Set(Object.values(appsMap).map((a) => a.user_id).filter(Boolean))];
    const jobIds = [...new Set(Object.values(appsMap).map((a) => a.job_id).filter(Boolean))];

    const usersMap: Record<number, VsUser> = {};
    if (userIds.length > 0) {
      const users = await readBatched<VsUser>(
        "vs_user",
        "user_id",
        userIds,
        "user_id,user_fname,user_lname,user_email,user_contact,profile_image_url",
        "Candidate profiles"
      );
      if ("error" in users) {
        return NextResponse.json({ error: users.error }, { status: 502 });
      }
      users.data.forEach((u) => {
        usersMap[u.user_id] = u;
      });
    }

    const jobsMap: Record<number, string> = {};
    let jobPipelineMap: Record<number, JobPipelineVersion | null> = {};
    if (jobIds.length > 0) {
      const jobs = await readBatched<DirectusJob>(
        "vs_job_posting",
        "job_id",
        jobIds,
        "job_id,job_title",
        "Job titles"
      );
      if ("error" in jobs) {
        return NextResponse.json({ error: jobs.error }, { status: 502 });
      }
      jobs.data.forEach((j) => {
        jobsMap[j.job_id] = j.job_title;
      });

      jobPipelineMap = await getJobPipelinesForJobs(jobIds, companyId);
    }

    // Map candidates to interviews
    const interviews = rawInterviews.map((iv) => {
      const matchedJunction = junctionApps.filter((ja) => ja.interview_id === iv.interview_id);

      const applications = matchedJunction.map((ja) => {
        const app = appsMap[ja.application_id] ?? {
          application_id: ja.application_id,
          user_id: 0,
          job_id: 0,
          application_status: "INTERVIEWING",
          current_stage_id: null,
        };
        const u = app.user_id ? usersMap[app.user_id] : null;
        const applicantName = u ? `${u.user_fname} ${u.user_lname}`.trim() : `Applicant #${app.user_id}`;
        const jobTitle = app.job_id ? (jobsMap[app.job_id] ?? "Unknown Role") : "Unknown Role";

        const pipe = app.job_id ? jobPipelineMap[app.job_id] : null;
        let currentStage: JobPipelineStage | undefined;
        let allowedNextStages: Array<{
          id: number;
          stage_name: string;
          stage_type: string;
          color: string;
          is_terminal: boolean;
        }> = [];

        if (pipe?.stages) {
          if (app.current_stage_id) {
            currentStage = pipe.stages.find((s) => s.id === Number(app.current_stage_id));
          }
          if (!currentStage) {
            currentStage =
              pipe.stages.find((s) => s.stage_type === app.application_status) ||
              pipe.stages.find((s) => s.stage_type === "INTERVIEW") ||
              pipe.stages.find((s) => s.stage_type === "APPLIED") ||
              pipe.stages[0];
          }

          if (currentStage && !currentStage.is_terminal) {
            const transitions = pipe.transitions ?? [];
            const forwardStageIds = new Set(
              transitions
                .filter((t) => t.from_stage_id === currentStage!.id)
                .map((t) => t.to_stage_id)
            );

            allowedNextStages = pipe.stages
              .filter(
                (s) =>
                  s.id !== currentStage!.id &&
                  (forwardStageIds.has(s.id) ||
                    s.stage_type === "REJECTED" ||
                    s.stage_type === "WITHDRAWN")
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
          ...ja,
          applicant_name: applicantName,
          applicant_email: u?.user_email ?? "",
          applicant_phone: u?.user_contact ?? null,
          applicant_avatar: formatAvatarUrl(u?.profile_image_url),
          job_id: app.job_id ?? undefined,
          job_title: jobTitle,
          application_status: app.application_status,
          current_stage_id: currentStage?.id ?? app.current_stage_id ?? null,
          stage_name: currentStage?.stage_name ?? app.application_status,
          stage_type: currentStage?.stage_type ?? app.application_status,
          stage_color: currentStage?.color ?? "sky",
          allowed_next_stages: allowedNextStages,
        };
      });

      return {
        ...iv,
        applications,
      };
    });

    return NextResponse.json({ interviews });
  } catch (err: unknown) {
    console.error("GET /api/client/interviews error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// ─── POST — Create new interview schedule ──────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    const userId = Number(session.userId);
    if (!userId || isNaN(userId)) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

    const reviewer = await resolveReviewerCompany(session.userId);
    if (reviewer.unavailable) {
      return NextResponse.json(
        { error: "Your company association could not be read. Please try again." },
        { status: 502 }
      );
    }
    const companyId = reviewer.companyId;
    if (!companyId) return NextResponse.json({ error: "Company not found." }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

    // Deduplicated here so one candidate cannot be written into the junction (and
    // emailed) twice from a repeated id in the payload.
    const rawAppIds: number[] = [
      ...new Set<number>(
        Array.isArray(body.application_ids)
          ? body.application_ids.map(Number).filter(Boolean)
          : body.application_id
          ? [Number(body.application_id)]
          : []
      ),
    ];

    const errors: string[] = [];
    if (rawAppIds.length === 0) errors.push("At least one candidate application is required.");
    if (!body.scheduled_at && (!body.interview_date || !body.interview_time))
      errors.push("Scheduled Date & Time is required.");
    if (!body.interview_format) errors.push("Interview format is required.");

    if (errors.length > 0)
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

    let scheduledAt = body.scheduled_at;
    if (!scheduledAt && body.interview_date && body.interview_time) {
      scheduledAt = `${body.interview_date} ${body.interview_time}:00`;
    }

    // Tenant ownership gate: every scheduled application must belong to the
    // caller's company (application -> job_id -> vs_job_posting.company_id).
    // Reject before any interview, junction, or notification side effect.
    // Two batched `_in=` reads instead of 2 fetches per candidate.
    {
      const uniqueAppIds = [...new Set(rawAppIds)];
      const apps = await readBatched<{ application_id: number; job_id: number | string | null }>(
        "vs_job_application",
        "application_id",
        uniqueAppIds,
        "application_id,job_id",
        "Applications"
      );
      if ("error" in apps) {
        return NextResponse.json(
          { error: `${apps.error} Nothing was scheduled.` },
          { status: 502 }
        );
      }

      const appToJob = new Map<number, number>();
      for (const row of apps.data) {
        const appId = Number(row.application_id);
        const jobId = Number(row.job_id);
        if (!Number.isSafeInteger(appId) || appId <= 0) continue;
        if (!Number.isSafeInteger(jobId) || jobId <= 0) continue;
        appToJob.set(appId, jobId);
      }

      const jobIds = [...new Set([...appToJob.values()])];
      const jobs = await readBatched<{ job_id: number; company_id: number | string }>(
        "vs_job_posting",
        "job_id",
        jobIds,
        "job_id,company_id",
        "Jobs"
      );
      if ("error" in jobs) {
        return NextResponse.json(
          { error: `${jobs.error} Nothing was scheduled.` },
          { status: 502 }
        );
      }

      const ownedJobIds = new Set<number>();
      for (const row of jobs.data) {
        if (Number(row.company_id) === companyId) ownedJobIds.add(Number(row.job_id));
      }

      // Missing rows, null/invalid job ids and foreign jobs all collapse to the
      // same 404 the per-application gate returned.
      const allOwned =
        appToJob.size === uniqueAppIds.length &&
        [...appToJob.values()].every((jobId) => ownedJobIds.has(jobId));
      if (!allOwned) {
        return NextResponse.json({ error: "Application not found." }, { status: 404 });
      }
    }

    // Check if any selected candidate already has an active, uncompleted scheduled interview session
    const candidateIvJunction = await readBatched<{ application_id: number; interview_id: number }>(
      "vs_interview_application",
      "application_id",
      rawAppIds,
      "application_id,interview_id",
      "Existing interviews"
    );
    if ("error" in candidateIvJunction) {
      return NextResponse.json(
        { error: "Existing interviews could not be checked. Nothing was scheduled." },
        { status: 502 }
      );
    }
    const ivIds = candidateIvJunction.data
      .map((r) => r.interview_id)
      .filter(Boolean);
    if (ivIds.length > 0) {
      const activeCheck = await readBatched<DirectusInterview>(
        "vs_interview",
        "interview_id",
        ivIds,
        "interview_id,scheduled_at",
        "Existing interviews",
        "filter[interview_status][_in]=SCHEDULED,CONFIRMED,RESCHEDULED"
      );
      if ("error" in activeCheck) {
        return NextResponse.json(
          { error: "Existing interviews could not be checked. Nothing was scheduled." },
          { status: 502 }
        );
      }
      if (activeCheck.data.length > 0) {
        return NextResponse.json(
          {
            error:
              "One or more selected candidates already have an active scheduled interview session. Please complete or evaluate their current interview before scheduling a new one.",
          },
          { status: 400 }
        );
      }
    }

    // Server-side schedule overlap check
    const newStart = new Date(scheduledAt.replace(" ", "T")).getTime();
    if (!isNaN(newStart)) {
      const durationMs = (Number(body.duration_minutes) || 60) * 60 * 1000;
      const includeBuffer = body.include_buffer !== false;
      const bufferMs = includeBuffer ? 15 * 60 * 1000 : 0;
      const newEnd = newStart + durationMs;

      // Read the day before/after the slot instead of the first 100 active
      // interviews: a company whose backlog is bigger than that used to have the
      // rest of its schedule ignored, so a genuine clash passed the check.
      const windowFrom = toPHWallClock(newStart - 24 * 60 * 60 * 1000);
      const windowTo = toPHWallClock(newEnd + 24 * 60 * 60 * 1000);
      const windowFilter =
        windowFrom && windowTo
          ? `&filter[scheduled_at][_between]=${encodeURIComponent(windowFrom)},${encodeURIComponent(windowTo)}`
          : "";

      const overlapRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_interview?filter[company_id][_eq]=${companyId}&filter[interview_status][_in]=SCHEDULED,CONFIRMED,RESCHEDULED${windowFilter}&fields=interview_id,scheduled_at,duration_minutes,interview_status&limit=-1`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (!overlapRes.ok) {
        // Skipping the check on a failed read would double-book the company.
        return NextResponse.json(
          { error: "The company schedule could not be checked. Nothing was scheduled." },
          { status: 502 }
        );
      }

      const existingActive: DirectusInterview[] = (await overlapRes.json()).data ?? [];

      for (const existing of existingActive) {
        const exStart = new Date(existing.scheduled_at.replace(" ", "T")).getTime();
        if (isNaN(exStart)) continue;
        const exEnd = exStart + (existing.duration_minutes || 60) * 60 * 1000;

        const isDirectOverlap = (newStart >= exStart && newStart < exEnd) || (newStart < exStart && newEnd > exStart);
        const isBufferOverlap = bufferMs > 0 && (newStart >= exEnd && newStart < (exEnd + bufferMs));

        if (isDirectOverlap || isBufferOverlap) {
          return NextResponse.json(
            {
              error: `Schedule Conflict: An active interview is already scheduled for this company at ${formatInterviewDateTime(existing.scheduled_at)}${includeBuffer ? " (including 15m buffer)" : ""}.`,
            },
            { status: 409 }
          );
        }
      }
    }

    const nowPH = getPHTimeString();
    const rawMeetingLink = body.meeting_link?.trim();
    const cleanMeetingLink = rawMeetingLink
      ? /^https?:\/\//i.test(rawMeetingLink)
        ? rawMeetingLink
        : `https://${rawMeetingLink}`
      : null;

    // 1. Insert schedule into vs_interview
    const interviewPayload = {
      company_id: companyId,
      interviewer_user_id: userId,
      scheduled_at: scheduledAt,
      duration_minutes: Number(body.duration_minutes) || 60,
      timezone: body.timezone || "Asia/Manila",
      interview_format: body.interview_format,
      meeting_link: cleanMeetingLink,
      meeting_location: body.meeting_location?.trim() || null,
      interview_notes: body.interview_notes?.trim() || null,
      interview_status: "SCHEDULED",
      created_by_user_id: userId,
      created_at: nowPH,
    };

    const createIvRes = await fetch(`${DIRECTUS_BASE}/items/vs_interview`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(interviewPayload),
    });

    if (!createIvRes.ok) {
      const text = await createIvRes.text();
      console.error("Directus create vs_interview error:", text);
      return NextResponse.json(
        { error: "Failed to schedule interview." },
        { status: createIvRes.status }
      );
    }

    const createdInterview: DirectusInterview = (await createIvRes.json()).data;
    const newInterviewId = createdInterview.interview_id;

    // 2. Insert records into vs_interview_application junction table
    const junctionPayloads = rawAppIds.map((appId) => ({
      interview_id: newInterviewId,
      application_id: appId,
      attendance_status: "PENDING",
      created_at: nowPH,
    }));

    const junctionRes = await fetch(`${DIRECTUS_BASE}/items/vs_interview_application`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(junctionPayloads),
    });

    if (!junctionRes.ok) {
      const text = await junctionRes.text().catch(() => "");
      console.error("Directus create vs_interview_application error:", text);
      // Left in place, the interview row is an empty slot on the calendar and
      // every candidate below gets emailed an interview they are not linked to.
      await fetch(`${DIRECTUS_BASE}/items/vs_interview/${newInterviewId}`, {
        method: "DELETE",
        headers: getHeaders(),
      }).catch(() => {});
      return NextResponse.json(
        { error: "Failed to attach the candidates to the interview. Nothing was scheduled." },
        { status: 502 }
      );
    }

    // 3. Update application status to INTERVIEWING & dispatch emails/notifications
    //
    // Every read is issued once for the whole panel instead of six serial
    // requests per candidate. A ten-candidate schedule used to hold this
    // request open long enough for the client to give up while the interview
    // row stayed created.
    const warnings: string[] = [];

    const appsRead = await readBatched<ApplicationSummary>(
      "vs_job_application",
      "application_id",
      rawAppIds,
      "application_id,user_id,job_id,application_status,current_stage_id",
      "Candidate applications"
    );
    const appRows = "data" in appsRead ? appsRead.data : [];
    if (!("data" in appsRead)) {
      warnings.push(
        "The interview is scheduled, but the candidate rows could not be re-read, so their stages and notifications were not touched."
      );
    }

    const panelJobIds = [...new Set(appRows.map((a) => Number(a.job_id)).filter(Boolean))];
    const panelUserIds = [...new Set(appRows.map((a) => Number(a.user_id)).filter(Boolean))];

    const pipelineMap =
      panelJobIds.length > 0
        ? await getJobPipelinesForJobs(panelJobIds, companyId)
        : {};

    const usersRead = await readBatched<VsUser>(
      "vs_user",
      "user_id",
      panelUserIds,
      "user_id,user_fname,user_lname,user_email",
      "Candidate profiles"
    );
    const usersById: Record<number, VsUser> = {};
    if ("data" in usersRead) {
      usersRead.data.forEach((u) => {
        usersById[Number(u.user_id)] = u;
      });
    } else {
      warnings.push(
        "The interview is scheduled, but candidate contact details could not be read, so nobody was notified."
      );
    }

    const jobsRead = await readBatched<DirectusJob>(
      "vs_job_posting",
      "job_id",
      panelJobIds,
      "job_id,job_title",
      "Job titles"
    );
    const jobsById: Record<number, string> = {};
    if ("data" in jobsRead) {
      jobsRead.data.forEach((j) => {
        jobsById[Number(j.job_id)] = j.job_title;
      });
    }

    // The ownership gate above already proved every job in the panel belongs to
    // this company, so the name is read once instead of once per candidate.
    let companyName = "Employer";
    const companyRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_company/${companyId}?fields=company_name`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (companyRes.ok) {
      companyName = (await companyRes.json()).data?.company_name || companyName;
    }

    const teamUsersRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_company_user?filter[company_id][_eq]=${companyId}&filter[user_id][_neq]=${userId}&fields=user_id&limit=-1`,
      { headers: getHeaders(), cache: "no-store" }
    );
    const teamMembers: { user_id: number }[] = teamUsersRes.ok
      ? (await teamUsersRes.json()).data ?? []
      : [];
    // An empty list from a failed read still has to be reported: the recruiters
    // on this panel would otherwise assume they had simply been left out.
    const teamReadFailed = !teamUsersRes.ok;

    const advanceFailures: number[] = [];
    const notNotified: number[] = [];
    const emailSkipped: number[] = [];

    await mapPool(appRows, async (app) => {
      const appId = Number(app.application_id);

      // Only system-advance candidates whose current pipeline stage is an
      // INTERVIEW stage. Candidates at ASSESSMENT (or other) stages keep
      // their stage; the interview record above is still created.
      const pipe = app.job_id ? pipelineMap[Number(app.job_id)] : null;
      const currentStage =
        app.current_stage_id === null || app.current_stage_id === undefined
          ? undefined
          : pipe?.stages?.find((s) => s.id === Number(app.current_stage_id));

      if (currentStage?.stage_type === "INTERVIEW") {
        const patchRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_application/${appId}`, {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({ application_status: "INTERVIEWING" }),
        }).catch(() => null);
        // Left unchecked, the candidate stayed on their old stage while the
        // calendar showed them booked.
        if (!patchRes?.ok) advanceFailures.push(appId);
      }

      const candidate = app.user_id ? usersById[Number(app.user_id)] : undefined;
      if (!candidate?.user_email) {
        notNotified.push(appId);
        return;
      }

      const candidateUserId = Number(candidate.user_id);
      const jobTitle = app.job_id
        ? jobsById[Number(app.job_id)] ?? "Unknown Position"
        : "Unknown Position";

      const emailPreference =
        "data" in usersRead
          ? await isEmailEnabledForUser(candidateUserId, "INTERVIEW_SCHEDULED")
          : null;

      // `null` is an unread preference, not an opt-out. The mail is skipped and
      // reported: an interview email the candidate switched off cannot be unsent,
      // while a missed one is still covered by the in-app message below.
      if (emailPreference === null) emailSkipped.push(appId);

      if (emailPreference === true) {
        await sendInterviewScheduledEmail(candidate.user_email, {
          candidateName: `${candidate.user_fname} ${candidate.user_lname}`.trim(),
          companyName,
          jobTitle,
          scheduledAt,
          timezone: body.timezone || "Asia/Manila",
          durationMinutes: Number(body.duration_minutes) || 60,
          interviewFormat: body.interview_format,
          meetingLink: cleanMeetingLink,
          meetingLocation: body.meeting_location?.trim() || null,
          candidateNotes: body.candidate_notes?.trim() || null,
        }).catch((e) => console.error("Error sending scheduled email:", e));
      }

      await createSystemMessage({
        clientId: userId,
        freelancerId: candidateUserId,
        jobId: app.job_id ?? null,
        text: `Interview scheduled for ${formatInterviewDateTime(scheduledAt)}.`,
        senderId: userId,
        systemEventType: "INTERVIEW_SCHEDULED",
        interviewId: newInterviewId,
      }).catch((e) => console.error("Error sending system msg:", e));

      await createFreelancerNotification({
        event_type: "interview_scheduled",
        recipient_user_id: candidateUserId,
        entity_type: "vs_interview",
        entity_id: newInterviewId,
        category: "INTERVIEW",
        title: "New Interview Scheduled",
        message: `You have an interview scheduled with ${companyName} for ${formatInterviewDateTime(scheduledAt)}.`,
        action_url: "/vos-sync/freelancer/applications",
      }).catch((e) => console.error("Error sending notification:", e));
    });

    // Dispatch TEAM_ACTIVITY to other recruiters (actor suppressed) — once per
    // job in the panel. It used to sit inside the candidate loop, so a ten-candidate
    // interview put ten copies of the same activity in every teammate's inbox.
    if (teamMembers.length > 0) {
      await mapPool(panelJobIds, async (jobId) => {
        const jobTitle = jobsById[jobId] ?? "Unknown Position";
        for (const member of teamMembers) {
          await createEmployerNotification({
            event_type: "TEAM_ACTIVITY",
            recipient_user_id: member.user_id,
            entity_type: "vs_interview",
            entity_id: newInterviewId,
            category: "TEAM_ACTIVITY",
            title: "Team Activity: Interview Scheduled",
            message: `A team member scheduled an interview for "${jobTitle}" on ${formatInterviewDateTime(scheduledAt)}.`,
            action_url: `/vos-sync/client/interviews`,
          }).catch((e) => console.error("Error sending team activity notification:", e));
        }
      });
    }

    if (advanceFailures.length > 0) {
      warnings.push(
        `The interview is scheduled, but ${advanceFailures.length} candidate(s) could not be moved to the Interviewing stage (${advanceFailures
          .map((id) => `#${id}`)
          .join(", ")}).`
      );
    }
    if (notNotified.length > 0) {
      warnings.push(
        `${notNotified.length} candidate(s) have no usable email on file and were not notified.`
      );
    }
    if (emailSkipped.length > 0) {
      warnings.push(
        `${emailSkipped.length} candidate(s) had notification settings that could not be read, so no email was sent to them.`
      );
    }
    if (teamReadFailed) {
      warnings.push("The hiring team could not be listed, so no teammate was notified of this interview.");
    }

    return NextResponse.json({
      interview: createdInterview,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (err: unknown) {
    console.error("POST /api/client/interviews error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

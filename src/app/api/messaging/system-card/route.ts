// src/app/api/messaging/system-card/route.ts

import { NextRequest } from "next/server";
import { HiringViewerRole } from "@/modules/client/messaging/types";
import { authenticateRequest } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";
import { json, toId } from "@/lib/server/route";

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

/**
 * A Directus outage is not "this row was deleted". Answering 404 made the cards
 * report a live application, interview or message as missing content.
 */
function upstreamFailure(res: Response, label: string): Response {
  return res.status === 404
    ? json({ error: `${label} not found.` }, 404)
    : json({ error: `The ${label.toLowerCase()} could not be read.` }, 502);
}

function formatAvatarUrl(url?: string | null): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();

  // Already proxied — use as-is
  if (trimmed.startsWith("/api/freelancer/assets/")) return trimmed;

  // data: URI — use as-is
  if (trimmed.startsWith("data:")) return trimmed;

  // Full Directus URL (https://directus.host/assets/UUID) — extract UUID and proxy it
  const assetsMatch = trimmed.match(/\/assets\/([^/?#]+)/);
  if (assetsMatch?.[1]) return `/api/freelancer/assets/${assetsMatch[1]}`;

  // Bare UUID or path segment — use last segment
  const parts = trimmed.split("/");
  const fileId = parts[parts.length - 1];
  return fileId ? `/api/freelancer/assets/${fileId}` : null;
}

export async function GET(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const session = await authenticateRequest(req);
    if (!session) {
      return json({ error: "Unauthorized." }, 401);
    }

    const userId = Number(session.userId);

    // ── Params ────────────────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const messageId = toId(searchParams.get("message_id"));

    if (messageId === null) {
      return json({ error: "message_id is required." }, 400);
    }

    // ── Fetch message to get conversation_id ──────────────────────────────
    const msgRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_message/${messageId}?fields=message_id,conversation_id,message_type,message_content,created_at`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!msgRes.ok) {
      return upstreamFailure(msgRes, "Message");
    }

    const msg = (await msgRes.json()).data;
    if (!msg?.conversation_id) {
      return json({ error: "Message not found." }, 404);
    }

    // ── Verify user belongs to this conversation ──────────────────────────
    const convRes = await fetch(
      // job_id is part of this read because the stage and interview cards below
      // resolve the position title from it; omitting it made them fall back to
      // "Position" for every card.
      `${DIRECTUS_BASE}/items/vs_conversation/${msg.conversation_id}?fields=conversation_id,job_id,client_id,freelancer_id`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!convRes.ok) {
      return upstreamFailure(convRes, "Conversation");
    }

    const conv = (await convRes.json()).data;
    // Compare numerically: Directus can answer these ids as strings, and a string
    // here would 403 a participant out of their own conversation card.
    const clientId = Number(conv?.client_id);
    const freelancerId = Number(conv?.freelancer_id);
    if (userId !== clientId && userId !== freelancerId) {
      return json({ error: "Forbidden." }, 403);
    }
    const viewerIsCandidate = userId === freelancerId;

    // ── Fetch vs_system_message row ───────────────────────────────────────
    const smRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_system_message?filter[message_id][_eq]=${messageId}&fields=system_message_id,event_type,application_id,interview_id,stage_history_id&limit=1`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!smRes.ok) {
      return upstreamFailure(smRes, "System message data");
    }

    const smData = ((await smRes.json()).data ?? [])[0];
    if (!smData) {
      return json({ error: "System message data not found." }, 404);
    }

    const { event_type, application_id, interview_id, stage_history_id } = smData;
    const viewerRole: HiringViewerRole = viewerIsCandidate ? "FREELANCER" : "CLIENT";

    // ── Resolve card data by event type ───────────────────────────────────

    // Stage transition events
    if (event_type === "APPLICATION_STATUS_CHANGED" || event_type === "HIRED") {
      let fromStageName: string | null = null;
      let toStageName: string | null = null;
      let fromStageType: string | null = null;
      let toStageType: string | null = event_type === "HIRED" ? "HIRED" : null;
      let stageCreatedAt: string | null = null;

      // 1. Try to fetch from vs_application_stage_history via stage_history_id
      if (stage_history_id) {
        try {
          const shRes = await fetch(
            `${DIRECTUS_BASE}/items/vs_application_stage_history/${stage_history_id}?fields=*`,
            { headers: getHeaders(), cache: "no-store" }
          );
          if (shRes.ok) {
            const sh = (await shRes.json()).data;
            const meta = typeof sh?.metadata === "string" ? JSON.parse(sh.metadata) : sh?.metadata;
            fromStageName = meta?.from_stage_name ?? null;
            toStageName = meta?.to_stage_name ?? null;
            fromStageType = meta?.from_stage_type ?? null;
            toStageType = meta?.to_stage_type ?? toStageType;
            stageCreatedAt = sh?.created_at ?? null;
          }
        } catch {}
      }

      // 2. If no stage_history_id, try to find matching history row for this application
      if (!toStageName && application_id) {
        try {
          const shListRes = await fetch(
            `${DIRECTUS_BASE}/items/vs_application_stage_history?filter[application_id][_eq]=${application_id}&sort[]=-created_at&limit=10`,
            { headers: getHeaders(), cache: "no-store" }
          );
          if (shListRes.ok) {
            const shList = (await shListRes.json()).data ?? [];
            const msgTime = msg.created_at ? new Date(msg.created_at).getTime() : 0;
            let closest = shList[0];
            let minDiff = Infinity;
            for (const sh of shList) {
              const diff = Math.abs((sh.created_at ? new Date(sh.created_at).getTime() : 0) - msgTime);
              if (diff < minDiff) {
                minDiff = diff;
                closest = sh;
              }
            }
            if (closest) {
              const meta = typeof closest.metadata === "string" ? JSON.parse(closest.metadata) : closest.metadata;
              fromStageName = meta?.from_stage_name ?? null;
              toStageName = meta?.to_stage_name ?? null;
              fromStageType = meta?.from_stage_type ?? null;
              toStageType = meta?.to_stage_type ?? toStageType;
              stageCreatedAt = closest.created_at ?? null;
            }
          }
        } catch {}
      }

      // 3. Fallback: Parse message_content
      if (!toStageName && msg.message_content) {
        const arrowMatch = msg.message_content.match(
          /(?:Stage updated:\s*)?(?:From\s+)?["']?([^"'\n➔\->]+)["']?\s*(?:➔|->)\s*["']?([^"'\n]+)["']?/i
        );
        if (arrowMatch) {
          fromStageName = arrowMatch[1]?.trim() ?? null;
          toStageName = arrowMatch[2]?.trim() ?? null;
        } else {
          const moveMatch = msg.message_content.match(/(?:Application moved to stage:\s*|Moved to\s+)(.+)/i);
          if (moveMatch) {
            toStageName = moveMatch[1]?.trim() ?? null;
          } else if (event_type === "HIRED") {
            toStageName = "Hired";
            toStageType = "HIRED";
          }
        }
      }

      // Fetch job title for context
      let jobTitle = "Position";
      if (conv.job_id) {
        try {
          const jRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_posting/${conv.job_id}?fields=job_title`, {
            headers: getHeaders(),
            cache: "no-store",
          });
          if (jRes.ok) {
            const jData = (await jRes.json()).data;
            jobTitle = jData?.job_title ?? jobTitle;
          }
        } catch {}
      }

      // Fetch applicant details for role-aware display
      let applicantName = "Candidate";
      let applicationRecord: Record<string, unknown> | null = null;
      if (application_id) {
        try {
          const aRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_application/${application_id}?fields=application_id,user_id,current_stage_id,job_id`, {
            headers: getHeaders(),
            cache: "no-store",
          });
          if (aRes.ok) {
            applicationRecord = (await aRes.json()).data ?? null;
          }
        } catch {}
      }

      const applicantUserId = applicationRecord?.user_id ?? conv.freelancer_id;
      if (applicantUserId) {
        try {
          const uRes = await fetch(`${DIRECTUS_BASE}/items/vs_user/${applicantUserId}?fields=user_fname,user_lname`, {
            headers: getHeaders(),
            cache: "no-store",
          });
          if (uRes.ok) {
            const uData = (await uRes.json()).data;
            if (uData) {
              applicantName = `${uData.user_fname ?? ""} ${uData.user_lname ?? ""}`.trim() || applicantName;
            }
          }
        } catch {}
      }

      // Check if assessment tasks exist for the target stage
      let hasAssessmentTasks = false;
      const isAssessment =
        toStageType === "ASSESSMENT" ||
        (toStageName && toStageName.toLowerCase().includes("assessment"));

      if (isAssessment) {
        const stageId = applicationRecord?.current_stage_id;
        if (stageId) {
          try {
            const taskRes = await fetch(
              `${DIRECTUS_BASE}/items/vs_job_pipeline_assessment_tasks?filter[job_stage_id][_eq]=${stageId}&fields=id&limit=1`,
              { headers: getHeaders(), cache: "no-store" }
            );
            if (taskRes.ok) {
              const taskList = (await taskRes.json()).data ?? [];
              hasAssessmentTasks = taskList.length > 0;
            }
          } catch {}
        }
      }

      // Check if an active, upcoming interview is actually scheduled for this application
      let hasScheduledInterview = false;
      let scheduledInterviewId: number | null = null;
      let scheduledAt: string | null = null;
      let durationMinutes = 60;
      let interviewStatus: string | null = null;

      if (application_id) {
        try {
          const junctionRes = await fetch(
            `${DIRECTUS_BASE}/items/vs_interview_application?filter[application_id][_eq]=${application_id}&fields=interview_id&limit=20`,
            { headers: getHeaders(), cache: "no-store" }
          );
          if (junctionRes.ok) {
            const junctionList = (await junctionRes.json()).data ?? [];
            const ivIds = junctionList.map((j: { interview_id: number }) => j.interview_id).filter(Boolean);
            if (ivIds.length > 0) {
              const ivRes = await fetch(
                `${DIRECTUS_BASE}/items/vs_interview?filter[interview_id][_in]=${ivIds.join(",")}&filter[interview_status][_in]=SCHEDULED,CONFIRMED,RESCHEDULED&fields=interview_id,scheduled_at,duration_minutes,interview_status&limit=10`,
                { headers: getHeaders(), cache: "no-store" }
              );
              if (ivRes.ok) {
                const ivList = (await ivRes.json()).data ?? [];
                const now = Date.now();
                // Find active upcoming interview that is not completed and not past the date
                const upcoming = ivList.find((iv: { scheduled_at?: string | null; duration_minutes?: number | null }) => {
                  if (!iv.scheduled_at) return false;
                  const end = new Date(String(iv.scheduled_at).replace(" ", "T")).getTime() + (Number(iv.duration_minutes) || 60) * 60_000;
                  return end >= now;
                });

                if (upcoming) {
                  hasScheduledInterview = true;
                  scheduledInterviewId = upcoming.interview_id;
                  scheduledAt = upcoming.scheduled_at ?? null;
                  durationMinutes = Number(upcoming.duration_minutes) || 60;
                  interviewStatus = upcoming.interview_status ?? null;
                }
              }
            }
          }
        } catch {}
      }

      return json({
        event_type,
        viewer_role: viewerRole,
        application_id,
        stage_history_id: stage_history_id ?? null,
        from_stage_name: fromStageName,
        to_stage_name: toStageName || (event_type === "HIRED" ? "Hired" : "Updated Stage"),
        from_stage_type: fromStageType,
        to_stage_type: toStageType,
        job_title: jobTitle,
        applicant_name: applicantName,
        candidate_name: applicantName,
        has_assessment_tasks: hasAssessmentTasks,
        has_scheduled_interview: hasScheduledInterview,
        interview_id: scheduledInterviewId,
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
        interview_status: interviewStatus,
        created_at: stageCreatedAt || msg.created_at,
      });
    }

    // Initial Application Submission (Rich Card)
    if (event_type === "APPLICATION_SUBMITTED") {
      if (!application_id) {
        return json({ error: "Application reference missing." }, 422);
      }

      const appRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_job_application/${application_id}?fields=*`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (!appRes.ok) {
        return upstreamFailure(appRes, "Application");
      }
      const app = (await appRes.json()).data;
      const applicantUserId = app?.user_id;

      // Parallel requests for user, job, resume, and social links
      const [userRes, jobRes, resumeRes, socialRes] = await Promise.all([
        applicantUserId
          ? fetch(
              `${DIRECTUS_BASE}/items/vs_user/${applicantUserId}?fields=user_fname,user_lname,user_email,user_contact,profile_image_url`,
              { headers: getHeaders(), cache: "no-store" }
            ).then((r) => (r.ok ? r.json() : { data: null }))
          : Promise.resolve({ data: null }),

        app?.job_id
          ? fetch(
              `${DIRECTUS_BASE}/items/vs_job_posting/${app.job_id}?fields=job_title,salary_min,salary_max`,
              { headers: getHeaders(), cache: "no-store" }
            ).then((r) => (r.ok ? r.json() : { data: null }))
          : Promise.resolve({ data: null }),

        applicantUserId
          ? fetch(
              `${DIRECTUS_BASE}/items/vs_job_seeker_resumes?filter[user_id][_eq]=${applicantUserId}`,
              { headers: getHeaders(), cache: "no-store" }
            ).then((r) => (r.ok ? r.json() : { data: [] }))
          : Promise.resolve({ data: [] }),

        applicantUserId
          ? fetch(
              `${DIRECTUS_BASE}/items/vs_user_social_links?filter[user_id][_eq]=${applicantUserId}&fields=id,platform_name,profile_url,url`,
              { headers: getHeaders(), cache: "no-store" }
            ).then((r) => (r.ok ? r.json() : { data: [] }))
          : Promise.resolve({ data: [] }),
      ]);

      const u = userRes.data;
      const j = jobRes.data;
      const resumes = ((resumeRes.data ?? []) as Array<{ id?: number | string; is_primary?: boolean; [key: string]: unknown }>).sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return Number(b.id || 0) - Number(a.id || 0);
      });
      const socialLinks = socialRes.data ?? [];

      const applicantName = `${u?.user_fname ?? ""} ${u?.user_lname ?? ""}`.trim() || "Unknown Applicant";
      const applicantAvatar = formatAvatarUrl(u?.profile_image_url);
      const applicantEmail = u?.user_email ?? null;
      const applicantPhone = u?.user_contact ?? null;

      const jobTitle = j?.job_title ?? "Unknown Position";
      const salaryMin = j?.salary_min ?? null;
      const salaryMax = j?.salary_max ?? null;

      let resumeObj: { file_name: string; file_path: string } | null = null;
      const r = resumes[0] || null;

      if (r) {
        const rawPath =
          (r.file_path as string) ||
          (r.file_url as string) ||
          (r.url as string) ||
          (r.file_id as string) ||
          (r.file as string) ||
          (r.id ? String(r.id) : "");

        const fileName = (r.file_name as string) || (r.name as string) || "Resume.pdf";
        const formatted = formatAvatarUrl(rawPath) || (rawPath ? `/api/assets/${rawPath}` : null);

        if (formatted) {
          resumeObj = {
            file_name: fileName,
            file_path: formatted,
          };
        }
      }

      // Check custom_resume on application record as fallback
      if (!resumeObj && app) {
        const appResume = app.custom_resume || app.resume_file || app.resume_url || app.resume_path || app.resume;
        if (appResume) {
          if (typeof appResume === "object") {
            const fName = appResume.file_name || appResume.name || "Resume.pdf";
            const fPath = appResume.file_path || appResume.file_url || appResume.url;
            if (fPath) {
              resumeObj = {
                file_name: fName,
                file_path: formatAvatarUrl(fPath) || fPath,
              };
            }
          } else if (typeof appResume === "string" && appResume.trim()) {
            resumeObj = {
              file_name: "Resume.pdf",
              file_path: formatAvatarUrl(appResume) || appResume,
            };
          }
        }
      }

      const socialLinksList = socialLinks.map((s: { platform_name?: string; profile_url?: string; url?: string }) => ({
        platform_name: s.platform_name || "Link",
        url: s.profile_url || s.url || "#",
      }));

      const isCandidate = (app?.user_id != null && Number(app.user_id) === userId) || viewerIsCandidate;
      const viewerRole: HiringViewerRole = isCandidate ? "FREELANCER" : "CLIENT";

      return json({
        event_type,
        viewer_role: viewerRole,
        application_id,

        // Domain Entity Projection
        applicant: {
          user_id: app?.user_id,
          name: applicantName,
          email: applicantEmail,
          phone: applicantPhone,
          avatar: applicantAvatar,
          resume: resumeObj,
          social_links: socialLinksList,
        },
        job: {
          job_id: app?.job_id ?? conv.job_id ?? null,
          title: jobTitle,
          salary_min: salaryMin,
          salary_max: salaryMax,
        },
        application: {
          status: app?.application_status ?? "APPLIED",
          expected_salary: app?.expected_salary ?? null,
          cover_letter: app?.cover_letter ?? null,
          portfolio_url: app?.portfolio_url ?? null,
          applied_at: app?.applied_at ?? null,
          updated_at: app?.status_updated_at ?? app?.updated_at ?? app?.date_updated ?? null,
        },

        // Flat fallbacks for backward compatibility
        application_status: app?.application_status ?? "APPLIED",
        applied_at: app?.applied_at ?? null,
        updated_at: app?.status_updated_at ?? app?.updated_at ?? app?.date_updated ?? null,
        status_updated_at: app?.status_updated_at ?? null,
        expected_salary: app?.expected_salary ?? null,
        cover_letter: app?.cover_letter ?? null,
        portfolio_url: app?.portfolio_url ?? null,
        applicant_name: applicantName,
        applicant_avatar: applicantAvatar,
        applicant_email: applicantEmail,
        applicant_phone: applicantPhone,
        job_title: jobTitle,
        salary_min: salaryMin,
        salary_max: salaryMax,
        resume: resumeObj,
        social_links: socialLinksList,
      });
    }

    // Interview-based events
    if (event_type === "INTERVIEW_SCHEDULED" || event_type === "INTERVIEW_UPDATED") {
      if (!interview_id) {
        return json({ error: "Interview reference missing." }, 422);
      }

      const ivRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_interview/${interview_id}?fields=interview_id,scheduled_at,duration_minutes,timezone,interview_format,meeting_link,meeting_location,interview_status,created_at,updated_at`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (!ivRes.ok) {
        return upstreamFailure(ivRes, "Interview");
      }
      const iv = (await ivRes.json()).data;
      const viewerRole: HiringViewerRole = viewerIsCandidate ? "FREELANCER" : "CLIENT";

      // Also resolve candidate name and job title from conversation if available
      const [candUserRes, jobRes] = await Promise.all([
        conv.freelancer_id
          ? fetch(
              `${DIRECTUS_BASE}/items/vs_user/${conv.freelancer_id}?fields=user_fname,user_lname`,
              { headers: getHeaders(), cache: "no-store" }
            ).then((r) => (r.ok ? r.json() : { data: null }))
          : Promise.resolve({ data: null }),
        conv.job_id
          ? fetch(
              `${DIRECTUS_BASE}/items/vs_job_posting/${conv.job_id}?fields=job_title`,
              { headers: getHeaders(), cache: "no-store" }
            ).then((r) => (r.ok ? r.json() : { data: null }))
          : Promise.resolve({ data: null }),
      ]);

      const candUser = candUserRes.data;
      let jobTitle = jobRes.data?.job_title ?? null;

      if (!jobTitle && (iv?.interview_id || interview_id)) {
        try {
          const ivId = iv?.interview_id ?? interview_id;
          const iaRes = await fetch(
            `${DIRECTUS_BASE}/items/vs_interview_application?filter[interview_id][_eq]=${ivId}&fields=application_id.job_id.job_title&limit=1`,
            { headers: getHeaders(), cache: "no-store" }
          );
          if (iaRes.ok) {
            const iaJson = await iaRes.json();
            jobTitle = iaJson.data?.[0]?.application_id?.job_id?.job_title ?? null;
          }
        } catch {}
      }

      const applicantName = `${candUser?.user_fname ?? ""} ${candUser?.user_lname ?? ""}`.trim() || "Candidate";
      if (!jobTitle) jobTitle = "Position";

      return json({
        event_type,
        viewer_role: viewerRole,

        // Domain Entity Projection
        interview: {
          interview_id: iv?.interview_id ?? interview_id,
          scheduled_at: iv?.scheduled_at ?? null,
          duration_minutes: iv?.duration_minutes ?? 60,
          timezone: iv?.timezone ?? "Asia/Manila",
          interview_format: iv?.interview_format ?? "ONLINE",
          meeting_link: iv?.meeting_link ?? null,
          meeting_location: iv?.meeting_location ?? null,
          interview_status: iv?.interview_status ?? null,
          created_at: iv?.created_at ?? null,
          updated_at: iv?.updated_at ?? null,
        },
        candidate: {
          user_id: conv.freelancer_id,
          name: applicantName,
          avatar: null,
        },
        job: {
          job_id: conv.job_id ?? null,
          title: jobTitle,
        },

        // Flat fallbacks
        interview_id: iv?.interview_id ?? interview_id,
        scheduled_at: iv?.scheduled_at ?? null,
        duration_minutes: iv?.duration_minutes ?? 60,
        timezone: iv?.timezone ?? "Asia/Manila",
        interview_format: iv?.interview_format ?? "ONLINE",
        meeting_link: iv?.meeting_link ?? null,
        meeting_location: iv?.meeting_location ?? null,
        interview_status: iv?.interview_status ?? null,
        created_at: iv?.created_at ?? null,
        updated_at: iv?.updated_at ?? null,
        applicant_name: applicantName,
        job_title: jobTitle,
      });
    }

    return json({ error: "Unknown event type." }, 400);
  } catch (err: unknown) {
    console.error("GET /api/messaging/system-card error:", err);
    return json(
      { error: safeErrorMessage(err, "Internal server error") }, 500);
  }
}

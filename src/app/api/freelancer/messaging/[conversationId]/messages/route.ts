import { NextRequest } from "next/server";
import { checkRestriction } from "@/lib/status-validator";
import { getPHTimeString } from "@/lib/utils";
import { encryptMessage, safeDecryptMessage } from "@/lib/message-encryption";

import { authenticateRequest, isFreelancerSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";
import { pageParams } from "@/lib/server/paging";
import { json, toId } from "@/lib/server/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/$/,
  ""
);
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

/** Attachment rows accepted for one outgoing message. */
const MAX_ATTACHMENTS_PER_MESSAGE = 10;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

// ─── GET — Fetch messages in a conversation (freelancer) ───────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    // The raw segment is interpolated into Directus filter URLs below, so only a
    // positive integer may reach them.
    const convId = toId(conversationId);
    if (convId === null) {
      return json({ error: "Invalid conversation ID." }, 400);
    }

    const session = await authenticateRequest(req);
    if (!session || !isFreelancerSession(session)) {
      return json(
        { error: session ? "Forbidden: Freelancer access required." : "Unauthorized." }, session ? 403 : 401);
    }

    const userId = Number(session.userId);

    const convRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_conversation?filter[conversation_id][_eq]=${convId}&fields=conversation_id,client_id,freelancer_id`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!convRes.ok) {
      const errText = await convRes.text();
      console.error("Directus conversation lookup error:", errText);
      return json(
        { error: "Failed to fetch conversation details." },
        convRes.status
      );
    }

    const convJson = await convRes.json();
    const conv = Array.isArray(convJson.data) ? convJson.data[0] : convJson.data;

    if (!conv) {
      return json(
        { error: `Conversation #${convId} not found.` }, 404);
    }

    if (conv.client_id !== userId && conv.freelancer_id !== userId) {
      return json({ error: "Forbidden." }, 403);
    }

    const { limit, offset } = pageParams(new URL(req.url).searchParams);

    // `created_at` is a MySQL TIMESTAMP with one-second resolution, so a burst
    // of messages shares a sort key; without the message_id tiebreaker an
    // offset page can repeat or skip a row.
    const msgsRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_message?filter[conversation_id][_eq]=${convId}&sort[]=-created_at&sort[]=-message_id&limit=${limit}&offset=${offset}&fields=message_id,conversation_id,sender_id,message_type,message_content,is_edited,edited_at,created_at,is_deleted,reply_to_message_id,is_pinned,pinned_at,pinned_by`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!msgsRes.ok) {
      return json(
        { error: "Failed to fetch messages." }, msgsRes.status);
    }

    const msgsJson = await msgsRes.json();
    const messages: Record<string, unknown>[] = msgsJson.data ?? [];

    const messageIds = messages.map((m) => m.message_id as number);
    const replyIds = Array.from(
      new Set(
        messages
          .map((m) => m.reply_to_message_id as number | undefined)
          .filter((id): id is number => typeof id === "number" && id > 0)
      )
    );
    const allAttachmentMessageIds = Array.from(new Set([...messageIds, ...replyIds]));
    const attachmentsMap = new Map<number, Record<string, unknown>[]>();
    let toMarkIds: number[] = [];

    if (allAttachmentMessageIds.length > 0) {
      const attachRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_message_attachment?filter[message_id][_in]=${allAttachmentMessageIds.join(",")}&fields=attachment_id,message_id,file_name,file_path,file_size,mime_type,created_at&limit=-1`,
        { headers: getHeaders(), cache: "no-store" }
      );

      if (attachRes.ok) {
        const attachJson = await attachRes.json();
        for (const att of (attachJson.data ?? []) as Record<
          string,
          unknown
        >[]) {
          const mid = att.message_id as number;
          if (!attachmentsMap.has(mid)) attachmentsMap.set(mid, []);
          attachmentsMap.get(mid)!.push(att);
        }
      }

      // Auto mark as read
      const unreadIds = messages
        .filter((m) => (m.sender_id as number) !== userId)
        .map((m) => m.message_id as number);

      if (unreadIds.length > 0) {
        // A failed lookup means "write nothing": answering from an empty set
        // would re-insert receipts that already exist (no unique key on
        // vs_message_read), and parsing a non-JSON error body used to throw and
        // fail the whole thread read.
        const readRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_message_read?filter[message_id][_in]=${unreadIds.join(",")}&filter[user_id][_eq]=${userId}&fields=message_id&limit=-1`,
          { headers: getHeaders(), cache: "no-store" }
        );

        if (readRes.ok) {
          const readJson = (await readRes.json().catch(() => null)) as {
            data?: Record<string, unknown>[];
          } | null;

          const alreadyReadIds = new Set(
            (readJson?.data ?? []).map((r) => r.message_id as number)
          );

          toMarkIds = unreadIds.filter((id) => !alreadyReadIds.has(id));

          if (toMarkIds.length > 0) {
            const nowPH = getPHTimeString();
            const readPayloads = toMarkIds.map((mid) => ({
              message_id: mid,
              user_id: userId,
              read_at: nowPH,
            }));

            const markRes = await fetch(`${DIRECTUS_BASE}/items/vs_message_read`, {
              method: "POST",
              headers: getHeaders(),
              body: JSON.stringify(readPayloads),
            }).catch((e) => {
              console.error("Mark read error:", e);
              return null;
            });
            if (markRes && !markRes.ok) {
              console.error(`Mark read failed: ${markRes.status}`);
            }
          }
        } else {
          console.error(
            `Mark-read lookup failed for conversation #${convId}: ${readRes.status}`
          );
        }
      }
    }

    // Batch-fetch vs_system_message for SYSTEM-type messages
    const systemMsgIds = messages
      .filter((m) => m.message_type === "SYSTEM")
      .map((m) => m.message_id as number);

    const systemMsgMap: Record<number, Record<string, unknown>> = {};
    const cardDataMap: Record<number, Record<string, unknown>> = {};

    if (systemMsgIds.length > 0) {
      const smRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_system_message?filter[message_id][_in]=${systemMsgIds.join(",")}&fields=system_message_id,message_id,event_type,application_id,interview_id,stage_history_id&limit=-1`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (smRes.ok) {
        const smJson = await smRes.json();
        const smList = (smJson.data ?? []) as Record<string, unknown>[];
        for (const sm of smList) {
          systemMsgMap[sm.message_id as number] = sm;
        }

        // Collect application_ids, interview_ids, and stage_history_ids
        const appIds = Array.from(new Set(smList.map((s) => s.application_id).filter(Boolean))) as number[];
        const ivIds = Array.from(new Set(smList.map((s) => s.interview_id).filter(Boolean))) as number[];
        const shIds = Array.from(new Set(smList.map((s) => s.stage_history_id).filter(Boolean))) as number[];

        const [appsRes, ivsRes, shRes, jaRes] = await Promise.all([
          appIds.length > 0
            ? fetch(`${DIRECTUS_BASE}/items/vs_job_application?filter[application_id][_in]=${appIds.join(",")}&fields=*`, { headers: getHeaders(), cache: "no-store" })
                .then((r) => r.json())
                .then((j) => j.data ?? [])
            : Promise.resolve([]),
          ivIds.length > 0
            ? fetch(`${DIRECTUS_BASE}/items/vs_interview?filter[interview_id][_in]=${ivIds.join(",")}&fields=*`, { headers: getHeaders(), cache: "no-store" })
                .then((r) => r.json())
                .then((j) => j.data ?? [])
            : Promise.resolve([]),
          shIds.length > 0
            ? fetch(`${DIRECTUS_BASE}/items/vs_application_stage_history?filter[id][_in]=${shIds.join(",")}&fields=*`, { headers: getHeaders(), cache: "no-store" })
                .then((r) => r.json())
                .then((j) => j.data ?? [])
            : Promise.resolve([]),
          appIds.length > 0
            ? fetch(`${DIRECTUS_BASE}/items/vs_interview_application?filter[application_id][_in]=${appIds.join(",")}&fields=application_id,interview_id&limit=-1`, { headers: getHeaders(), cache: "no-store" })
                .then((r) => r.json())
                .then((j) => j.data ?? [])
            : Promise.resolve([]),
        ]);

        const appMap = new Map<number, Record<string, unknown>>(appsRes.map((a: Record<string, unknown>) => [a.application_id as number, a]));
        const ivMap = new Map<number, Record<string, unknown>>(ivsRes.map((i: Record<string, unknown>) => [i.interview_id as number, i]));
        const shMap = new Map<number, Record<string, unknown>>(shRes.map((s: Record<string, unknown>) => [s.id as number, s]));

        const extraIvIds = Array.from(
          new Set(
            jaRes
              .map((j: { interview_id: number }) => j.interview_id)
              .filter((id: number) => Boolean(id) && !ivMap.has(id))
          )
        ) as number[];

        if (extraIvIds.length > 0) {
          try {
            const extraIvs = await fetch(
              `${DIRECTUS_BASE}/items/vs_interview?filter[interview_id][_in]=${extraIvIds.join(",")}&filter[interview_status][_in]=SCHEDULED,CONFIRMED,RESCHEDULED&fields=*`,
              { headers: getHeaders(), cache: "no-store" }
            )
              .then((r) => r.json())
              .then((j) => j.data ?? []);
            for (const ei of extraIvs) {
              ivMap.set(ei.interview_id as number, ei);
            }
          } catch {}
        }

        const appIvIdsMap = new Map<number, number[]>();
        for (const ja of jaRes) {
          const aId = ja.application_id as number;
          const iId = ja.interview_id as number;
          if (!appIvIdsMap.has(aId)) appIvIdsMap.set(aId, []);
          appIvIdsMap.get(aId)!.push(iId);
        }

        // Collect user_ids and job_ids for application and interview cards
        const userIds = Array.from(
          new Set([...appsRes.map((a: Record<string, unknown>) => a.user_id), conv.freelancer_id].filter(Boolean))
        ) as number[];
        const jobIds = Array.from(
          new Set([...appsRes.map((a: Record<string, unknown>) => a.job_id), conv.job_id].filter(Boolean))
        ) as number[];

        const [usersRes, jobsRes] = await Promise.all([
          userIds.length > 0
            ? fetch(`${DIRECTUS_BASE}/items/vs_user?filter[user_id][_in]=${userIds.join(",")}&fields=user_id,user_fname,user_lname,user_email,user_contact,profile_image_url`, { headers: getHeaders(), cache: "no-store" })
                .then((r) => r.json())
                .then((j) => j.data ?? [])
            : Promise.resolve([]),
          jobIds.length > 0
            ? fetch(`${DIRECTUS_BASE}/items/vs_job_posting?filter[job_id][_in]=${jobIds.join(",")}&fields=job_id,job_title,salary_min,salary_max`, { headers: getHeaders(), cache: "no-store" })
                .then((r) => r.json())
                .then((j) => j.data ?? [])
            : Promise.resolve([]),
        ]);

        const userMap = new Map<number, Record<string, unknown>>(usersRes.map((u: Record<string, unknown>) => [u.user_id as number, u]));
        const jobMap = new Map<number, Record<string, unknown>>(jobsRes.map((j: Record<string, unknown>) => [j.job_id as number, j]));
        const convJob = jobMap.get(conv.job_id as number);

        for (const sm of smList) {
          const mid = sm.message_id as number;
          const et = sm.event_type as string;

          if (et === "APPLICATION_STATUS_CHANGED" || et === "HIRED") {
            const sh = sm.stage_history_id ? shMap.get(sm.stage_history_id as number) : null;
            const meta = typeof sh?.metadata === "string" ? JSON.parse(sh.metadata as string) : (sh?.metadata as Record<string, unknown> | null);
            const msgObj = messages.find((m) => (m.message_id as number) === mid);
            let fromStageName = (meta?.from_stage_name as string) ?? null;
            let toStageName = (meta?.to_stage_name as string) ?? null;
            const fromStageType = (meta?.from_stage_type as string) ?? null;
            let toStageType = (meta?.to_stage_type as string) ?? (et === "HIRED" ? "HIRED" : null);

            // Fallback parse from message_content if stage history metadata not available
            if (!toStageName && msgObj?.message_content) {
              const contentStr = msgObj.message_content as string;
              const arrowMatch = contentStr.match(
                /(?:Stage updated:\s*)?(?:From\s+)?["']?([^"'\n➔\->]+)["']?\s*(?:➔|->)\s*["']?([^"'\n]+)["']?/i
              );
              if (arrowMatch) {
                fromStageName = arrowMatch[1]?.trim() ?? null;
                toStageName = arrowMatch[2]?.trim() ?? null;
              } else {
                const moveMatch = contentStr.match(/(?:Application moved to stage:\s*|Moved to\s+)(.+)/i);
                if (moveMatch) {
                  toStageName = moveMatch[1]?.trim() ?? null;
                } else if (et === "HIRED") {
                  toStageName = "Hired";
                  toStageType = "HIRED";
                }
              }
            }

            const app = appMap.get(sm.application_id as number);
            const j = app ? jobMap.get(app.job_id as number) : null;
            const u = app ? userMap.get(app.user_id as number) : null;

            const targetAppId = (sm.application_id as number) ?? (app?.application_id as number) ?? 0;
            const linkedIvIds = appIvIdsMap.get(targetAppId) ?? [];
            const nowTime = Date.now();
            const activeIv = linkedIvIds
              .map((id) => ivMap.get(id))
              .find((iv) => {
                if (!iv) return false;
                const status = String(iv.interview_status ?? "").toUpperCase();
                if (!["SCHEDULED", "CONFIRMED", "RESCHEDULED"].includes(status)) return false;
                if (!iv.scheduled_at) return false;
                const end = new Date(String(iv.scheduled_at).replace(" ", "T")).getTime() + (Number(iv.duration_minutes) || 60) * 60_000;
                return end >= nowTime;
              });

            cardDataMap[mid] = {
              event_type: et,
              viewer_role: "FREELANCER",
              application_id: targetAppId,
              stage_history_id: (sm.stage_history_id as number) ?? null,
              from_stage_name: fromStageName,
              to_stage_name: toStageName || (et === "HIRED" ? "Hired" : "Updated Stage"),
              from_stage_type: fromStageType,
              to_stage_type: toStageType,
              job_title: (j?.job_title as string) ?? (convJob?.job_title as string) ?? "Position",
              applicant_name: u ? `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim() : "Candidate",
              candidate_name: u ? `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim() : "Candidate",
              has_assessment_tasks: toStageType === "ASSESSMENT" || (toStageName?.toLowerCase().includes("assessment") ?? false),
              has_scheduled_interview: Boolean(activeIv),
              interview_id: (activeIv?.interview_id as number) ?? null,
              scheduled_at: (activeIv?.scheduled_at as string) ?? null,
              duration_minutes: (activeIv?.duration_minutes as number) ?? 60,
              interview_status: (activeIv?.interview_status as string) ?? null,
              created_at: (sh?.created_at as string) ?? (msgObj?.created_at as string) ?? null,
            };
          } else if (et === "APPLICATION_SUBMITTED") {
            const app = appMap.get(sm.application_id as number);
            if (app) {
              const u = userMap.get(app.user_id as number);
              const j = jobMap.get(app.job_id as number);
              cardDataMap[mid] = {
                event_type: et,
                viewer_role: "FREELANCER",
                application_id: app.application_id,

                // Structured Domain Entities
                applicant: {
                  user_id: app.user_id as number,
                  name: u ? `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim() : "Unknown",
                  email: (u?.user_email as string) ?? null,
                  phone: (u?.user_contact as string) ?? null,
                  avatar: u?.profile_image_url ? `/api/freelancer/assets/${(u.profile_image_url as string).split("/").pop()}` : null,
                },
                job: {
                  job_id: (app.job_id ?? conv.job_id) as number | null,
                  title: (j?.job_title as string) ?? "Position",
                  salary_min: (j?.salary_min as number) ?? null,
                  salary_max: (j?.salary_max as number) ?? null,
                },
                application: {
                  status: (app.application_status as string) ?? "APPLIED",
                  expected_salary: (app.expected_salary as number) ?? null,
                  cover_letter: (app.cover_letter as string) ?? null,
                  portfolio_url: (app.portfolio_url as string) ?? null,
                  applied_at: (app.applied_at as string) ?? null,
                  updated_at: (app.status_updated_at ?? app.updated_at ?? app.date_updated ?? null) as string | null,
                },

                // Flat fallbacks for backward compatibility
                application_status: app.application_status ?? "APPLIED",
                applied_at: app.applied_at ?? null,
                updated_at: (app.status_updated_at ?? app.updated_at ?? app.date_updated ?? null) as string | null,
                status_updated_at: (app.status_updated_at ?? null) as string | null,
                expected_salary: app.expected_salary ?? null,
                cover_letter: app.cover_letter ?? null,
                portfolio_url: app.portfolio_url ?? null,
                applicant_name: u ? `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim() : "Unknown",
                applicant_avatar: u?.profile_image_url ? `/api/freelancer/assets/${(u.profile_image_url as string).split("/").pop()}` : null,
                applicant_email: (u?.user_email as string) ?? null,
                applicant_phone: (u?.user_contact as string) ?? null,
                job_title: (j?.job_title as string) ?? "Position",
                salary_min: (j?.salary_min as number) ?? null,
                salary_max: (j?.salary_max as number) ?? null,
              };
            }
          } else if (et === "INTERVIEW_SCHEDULED" || et === "INTERVIEW_UPDATED") {
            const iv = ivMap.get(sm.interview_id as number);
            if (iv) {
              cardDataMap[mid] = {
                event_type: et,
                viewer_role: "FREELANCER",

                // Structured Domain Entities
                interview: {
                  interview_id: iv.interview_id as number,
                  scheduled_at: (iv.scheduled_at as string) ?? null,
                  duration_minutes: (iv.duration_minutes as number) ?? 60,
                  timezone: (iv.timezone as string) ?? "Asia/Manila",
                  interview_format: (iv.interview_format as string) ?? "ONLINE",
                  meeting_link: (iv.meeting_link as string) ?? null,
                  meeting_location: (iv.meeting_location as string) ?? null,
                  interview_status: (iv.interview_status as string) ?? null,
                  created_at: (iv.created_at as string) ?? null,
                  updated_at: (iv.updated_at as string) ?? null,
                },
                candidate: {
                  user_id: conv.freelancer_id as number,
                  name: "You",
                  avatar: null,
                },
                job: {
                  job_id: (conv.job_id as number) ?? (Array.from(jobMap.keys())[0] ?? null),
                  title: (convJob?.job_title as string) ?? (Array.from(jobMap.values())[0]?.job_title as string) ?? "Position",
                },

                // Flat fallbacks
                interview_id: iv.interview_id,
                scheduled_at: iv.scheduled_at ?? null,
                duration_minutes: iv.duration_minutes ?? 60,
                timezone: iv.timezone ?? "Asia/Manila",
                interview_format: iv.interview_format ?? "ONLINE",
                meeting_link: iv.meeting_link ?? null,
                meeting_location: iv.meeting_location ?? null,
                interview_status: iv.interview_status ?? null,
                created_at: (iv.created_at ?? null) as string | null,
                updated_at: (iv.updated_at ?? null) as string | null,
                job_title: (convJob?.job_title as string) ?? (Array.from(jobMap.values())[0]?.job_title as string) ?? "Position",
              };
            }
          }
        }
      }
    }

    // Batch-fetch vs_message_reaction for messages
    const reactionsMap = new Map<
      number,
      { reaction: string; count: number; users: { user_id: number; user_name: string }[]; reacted_by_me: boolean }[]
    >();

    if (messageIds.length > 0) {
      try {
        const reactionsRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_message_reaction?filter[message_id][_in]=${messageIds.join(
            ","
          )}&fields=reaction_id,message_id,user_id,reaction,created_at&sort[]=created_at&limit=-1`,
          { headers: getHeaders(), cache: "no-store" }
        );

        if (reactionsRes.ok) {
          const reactionsJson = await reactionsRes.json();
          const rawReactions = (reactionsJson.data ?? []) as {
            reaction_id: number;
            message_id: number;
            user_id: number;
            reaction: string;
          }[];

          const parseUid = (val: unknown): number => {
            if (val && typeof val === "object") {
              const obj = val as Record<string, unknown>;
              return Number(obj.user_id ?? obj.id ?? 0);
            }
            return Number(val ?? 0);
          };

          const rUserIds = Array.from(
            new Set(
              rawReactions
                .map((r) => parseUid(r.user_id))
                .filter((id) => !isNaN(id) && id > 0)
            )
          );
          const rUsersMap = new Map<number, string>();
          if (rUserIds.length > 0) {
            const ruRes = await fetch(
              `${DIRECTUS_BASE}/items/vs_user?filter[user_id][_in]=${rUserIds.join(
                ","
              )}&fields=user_id,user_fname,user_lname&limit=-1`,
              { headers: getHeaders(), cache: "no-store" }
            );
            if (ruRes.ok) {
              const ruJson = await ruRes.json();
              for (const u of (ruJson.data ?? []) as {
                user_id: number;
                user_fname?: string;
                user_lname?: string;
              }[]) {
                const name =
                  `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim() || "User";
                rUsersMap.set(Number(u.user_id), name);
              }
            }
          }

          const msgGroupMap = new Map<
            number,
            Map<
              string,
              {
                reaction: string;
                count: number;
                users: { user_id: number; user_name: string }[];
                reacted_by_me: boolean;
              }
            >
          >();

          for (const r of rawReactions) {
            if (!msgGroupMap.has(r.message_id)) {
              msgGroupMap.set(r.message_id, new Map());
            }
            const emojiMap = msgGroupMap.get(r.message_id)!;
            if (!emojiMap.has(r.reaction)) {
              emojiMap.set(r.reaction, {
                reaction: r.reaction,
                count: 0,
                users: [],
                reacted_by_me: false,
              });
            }
            const g = emojiMap.get(r.reaction)!;
            const rUid = parseUid(r.user_id);
            g.count += 1;
            g.users.push({
              user_id: rUid,
              user_name: rUsersMap.get(rUid) || "User",
            });
            if (rUid === userId) {
              g.reacted_by_me = true;
            }
          }

          for (const [mid, emojiMap] of msgGroupMap.entries()) {
            reactionsMap.set(mid, Array.from(emojiMap.values()));
          }
        }
      } catch (err) {
        console.error("Error fetching message reactions:", err);
      }
    }

    let celebration: {
      type: "HIRED";
      message_id: number;
      job_title?: string | null;
      applicant_name?: string | null;
    } | null = null;

    // Only trigger celebration on initial conversation load (offset === 0) if a HIRED message was unread before this request
    if (offset === 0 && toMarkIds.length > 0) {
      const unreadHiredMsg = messages.find((m) => {
        const mid = m.message_id as number;
        return toMarkIds.includes(mid) && systemMsgMap[mid]?.event_type === "HIRED";
      });

      if (unreadHiredMsg) {
        const mid = unreadHiredMsg.message_id as number;
        const cardData = cardDataMap[mid];
        celebration = {
          type: "HIRED",
          message_id: mid,
          job_title: (cardData?.job_title as string) ?? "Position",
          applicant_name: (cardData?.applicant_name as string) ?? null,
        };
      }
    }

    // Batch-fetch reply-to quoted messages
    const replyMap = new Map<
      number,
      {
        message_id: number;
        sender_id: number;
        sender_name: string;
        message_content: string;
        message_type: string;
        attachments?: Record<string, unknown>[];
        is_deleted?: boolean;
      }
    >();

    if (replyIds.length > 0) {
      try {
        const replyRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_message?filter[message_id][_in]=${replyIds.join(
            ","
          )}&fields=message_id,sender_id,message_type,message_content,is_deleted`,
          { headers: getHeaders(), cache: "no-store" }
        );
        if (replyRes.ok) {
          const replyJson = await replyRes.json();
          const replyItems = (replyJson.data ?? []) as Record<string, unknown>[];
          const senderIds = Array.from(new Set(replyItems.map((r) => r.sender_id as number).filter(Boolean)));
          const userNamesMap = new Map<number, string>();
          if (senderIds.length > 0) {
            try {
              const uRes = await fetch(
                `${DIRECTUS_BASE}/items/vs_user?filter[user_id][_in]=${senderIds.join(",")}&fields=user_id,user_fname,user_lname`,
                { headers: getHeaders(), cache: "no-store" }
              );
              if (uRes.ok) {
                const uData = (await uRes.json()).data ?? [];
                for (const u of uData) {
                  const name = `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim();
                  if (name) userNamesMap.set(u.user_id, name);
                }
              }
            } catch {}
          }

          for (const rm of replyItems) {
            const isRemoved = Boolean(rm.is_deleted);
            const dec = isRemoved ? null : safeDecryptMessage(rm.message_content as string | null);
            const sId = rm.sender_id as number;
            const resolvedName = userNamesMap.get(sId);
            const sName =
              sId === userId
                ? "You"
                : (resolvedName || conv.company_name || conv.client_name || "Client");
            const replyAtts = isRemoved ? [] : (attachmentsMap.get(rm.message_id as number) ?? []);
            const firstAtt = replyAtts[0] as { file_name?: string } | undefined;
            const fallbackFileName = firstAtt?.file_name ?? "";
            const displayContent = isRemoved
              ? "This message was removed"
              : dec
              ? (dec.length > 120 ? dec.slice(0, 120) + "..." : dec)
              : fallbackFileName;

            replyMap.set(rm.message_id as number, {
              message_id: rm.message_id as number,
              sender_id: sId,
              sender_name: sName,
              message_content: displayContent,
              message_type: (rm.message_type as string) || "TEXT",
              attachments: replyAtts,
              is_deleted: isRemoved,
            });
          }
        }
      } catch (err) {
        console.error("Error fetching reply quoted messages in freelancer route:", err);
      }
    }

    // Fetch pinned message IDs for this user
    const userPinnedSet = new Set<number>();
    try {
      const pinRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_message_pin?filter[user_id][_eq]=${userId}&filter[conversation_id][_eq]=${convId}&fields=message_id&limit=-1`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (pinRes.ok) {
        const pinData = (await pinRes.json()).data ?? [];
        for (const p of pinData) {
          userPinnedSet.add(Number(p.message_id));
        }
      }
    } catch {
      /* fallback */
    }

    const enriched = messages.map((msg) => {
      let content = safeDecryptMessage(msg.message_content as string | null | undefined);
      if (msg.is_deleted) {
        content = null;
      }
      const cardData = cardDataMap[msg.message_id as number];
      const sm = systemMsgMap[msg.message_id as number];

      if (msg.message_type === "SYSTEM" && (cardData || sm)) {
        const eventType = (sm?.event_type ?? cardData?.event_type) as string;
        const jobTitle = (cardData?.job_title as string) || "Position";

        if (eventType === "HIRED") {
          content = `You were hired for ${jobTitle}!`;
        } else if (eventType === "APPLICATION_SUBMITTED") {
          content = `You applied for ${jobTitle}`;
        } else if (eventType === "APPLICATION_STATUS_CHANGED") {
          const stageName = (cardData?.to_stage_name as string) || (cardData?.application_status as string) || "";
          content = stageName
            ? `Your application for ${jobTitle} was moved to ${stageName}`
            : `Your application for ${jobTitle} was updated`;
        } else if (eventType === "INTERVIEW_SCHEDULED") {
          content = `Interview scheduled for ${jobTitle}`;
        } else if (eventType === "INTERVIEW_UPDATED") {
          content = `Your interview for ${jobTitle} was rescheduled`;
        }
      }

      const isPinnedForUser = userPinnedSet.size > 0
        ? userPinnedSet.has(msg.message_id as number)
        : Boolean(msg.is_pinned && Number(msg.pinned_by) === userId);

      return {
        ...msg,
        message_content: content,
        attachments: attachmentsMap.get(msg.message_id as number) ?? [],
        system_message: sm ?? null,
        system_card_data: cardData ?? null,
        reactions: reactionsMap.get(msg.message_id as number) ?? [],
        reply_to: msg.reply_to_message_id ? replyMap.get(msg.reply_to_message_id as number) ?? null : null,
        is_pinned: isPinnedForUser,
        pinned_at: isPinnedForUser ? ((msg.pinned_at as string) ?? null) : null,
        pinned_by: isPinnedForUser ? ((msg.pinned_by as number) ?? userId) : null,
      };
    }).reverse();

    return json({ messages: enriched, celebration });
  } catch (err: unknown) {
    console.error("GET /api/freelancer/messaging/[id]/messages error:", err);
    return json(
      { error: safeErrorMessage(err, "Internal server error") }, 500);
  }
}

// ─── POST — Send a message (freelancer) ────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    const convId = toId(conversationId);
    if (convId === null) {
      return json({ error: "Invalid conversation ID." }, 400);
    }

    const session = await authenticateRequest(req);
    if (!session || !isFreelancerSession(session)) {
      return json(
        { error: session ? "Forbidden: Freelancer access required." : "Unauthorized." }, session ? 403 : 401);
    }

    const userId = Number(session.userId);

    // Validate SEND_MESSAGES Restriction
    const isRestricted = await checkRestriction(userId, "SEND_MESSAGES");
    if (isRestricted) {
      return json(
        { error: "Your messaging privileges are temporarily suspended." }, 403);
    }

    const body = await req.json().catch(() => null);

    const incomingAttachments = Array.isArray(body?.attachments)
      ? body.attachments.slice(0, MAX_ATTACHMENTS_PER_MESSAGE)
      : [];

    if (!body?.message_content && incomingAttachments.length === 0) {
      return json(
        { error: "message_content or attachments required." }, 400);
    }

    const convRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_conversation?filter[conversation_id][_eq]=${convId}&fields=conversation_id,client_id,freelancer_id,status`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!convRes.ok) {
      const errText = await convRes.text();
      console.error("Directus conversation lookup error (POST):", errText);
      return json(
        { error: "Failed to fetch conversation details." },
        convRes.status
      );
    }

    const convJson = await convRes.json();
    const conv = Array.isArray(convJson.data) ? convJson.data[0] : convJson.data;

    if (!conv) {
      return json(
        { error: `Conversation #${convId} not found.` }, 404);
    }

    if (conv.client_id !== userId && conv.freelancer_id !== userId) {
      return json({ error: "Forbidden." }, 403);
    }

    if (conv.status === "BLOCKED") {
      return json(
        { error: "Conversation is blocked." }, 403);
    }

    const nowPH = getPHTimeString();

    const shouldEncrypt =
      typeof body.message_content === "string" &&
      body.message_content.length > 0 &&
      (body.message_type ?? "TEXT") === "TEXT";

    const contentToStore = shouldEncrypt
      ? encryptMessage(body.message_content)
      : body.message_content ?? null;

    const messageInsertBody: Record<string, unknown> = {
      conversation_id: convId,
      sender_id: userId,
      message_type: body.message_type ?? "TEXT",
      message_content: contentToStore,
      created_at: nowPH,
      is_edited: false,
      is_deleted: false,
    };
    if (body.reply_to_message_id) {
      messageInsertBody.reply_to_message_id = Number(body.reply_to_message_id);
    }

    const msgRes = await fetch(`${DIRECTUS_BASE}/items/vs_message`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(messageInsertBody),
    });

    const msgJson = await msgRes.json();

    if (!msgRes.ok) {
      return json(
        { error: msgJson.errors?.[0]?.message ?? "Failed to send message." }, msgRes.status);
    }

    const newMessage = msgJson.data;
    if (newMessage && !newMessage.created_at) {
      newMessage.created_at = nowPH;
    }

    let attachments: unknown[] = [];
    if (incomingAttachments.length && newMessage?.message_id) {
      const attPayloads = incomingAttachments.map(
        (a: Record<string, unknown>) => ({
          message_id: newMessage.message_id,
          file_name: a.file_name,
          file_path: a.file_path,
          file_size: a.file_size ?? null,
          mime_type: a.mime_type ?? null,
        })
      );

      const attRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_message_attachment`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(attPayloads),
        }
      );

      if (attRes.ok) {
        const attJson = await attRes.json();
        attachments = attJson.data ?? [];
      }
    }

    fetch(`${DIRECTUS_BASE}/items/vs_conversation/${convId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ last_message_at: nowPH }),
    }).catch((e) => console.error("Update last_message_at error:", e));

    // Resolve reply_to quoted message if replying
    let replyToObj: {
      message_id: number;
      sender_id: number;
      sender_name: string;
      message_content: string;
      message_type: string;
      attachments?: Record<string, unknown>[];
    } | null = null;

    if (body.reply_to_message_id) {
      const parentMid = Number(body.reply_to_message_id);
      try {
        const [pMsgRes, pAttRes] = await Promise.all([
          fetch(
            `${DIRECTUS_BASE}/items/vs_message?filter[message_id][_eq]=${parentMid}&fields=message_id,sender_id,message_type,message_content`,
            { headers: getHeaders(), cache: "no-store" }
          ),
          fetch(
            `${DIRECTUS_BASE}/items/vs_message_attachment?filter[message_id][_eq]=${parentMid}&fields=attachment_id,message_id,file_name,file_path,file_size,mime_type,created_at&limit=5`,
            { headers: getHeaders(), cache: "no-store" }
          ),
        ]);
        if (pMsgRes.ok) {
          const pMsgJson = await pMsgRes.json();
          const pMsg = Array.isArray(pMsgJson.data) ? pMsgJson.data[0] : pMsgJson.data;
          if (pMsg) {
            const dec = safeDecryptMessage(pMsg.message_content as string | null);
            const pAttJson = pAttRes.ok ? await pAttRes.json().catch(() => null) : null;
            const pAtts = Array.isArray(pAttJson?.data) ? pAttJson.data : [];
            const firstAtt = pAtts[0] as { file_name?: string } | undefined;
            const content = dec
              ? (dec.length > 120 ? dec.slice(0, 120) + "..." : dec)
              : (firstAtt?.file_name ?? "");
            replyToObj = {
              message_id: parentMid,
              sender_id: Number(pMsg.sender_id),
              sender_name: Number(pMsg.sender_id) === userId ? "You" : (conv.company_name || conv.client_name || "Client"),
              message_content: content,
              message_type: (pMsg.message_type as string) || "TEXT",
              attachments: pAtts,
            };
          }
        }
      } catch (e) {
        console.error("Failed to resolve reply_to in freelancer POST:", e);
      }
    }

    return json(
      {
        message: {
          ...newMessage,
          message_content: safeDecryptMessage(newMessage?.message_content),
          attachments,
          reply_to_message_id: body.reply_to_message_id ? Number(body.reply_to_message_id) : null,
          reply_to: replyToObj,
          is_pinned: false,
          pinned_at: null,
          pinned_by: null,
        },
      }, 201);
  } catch (err: unknown) {
    console.error("POST /api/freelancer/messaging/[id]/messages error:", err);
    return json(
      { error: safeErrorMessage(err, "Internal server error") }, 500);
  }
}

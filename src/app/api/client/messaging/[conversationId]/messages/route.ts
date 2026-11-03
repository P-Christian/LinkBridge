import { NextRequest, NextResponse } from "next/server";
import { checkRestrictionState, checkCompanyVerificationStatus } from "@/lib/status-validator";
import { getPHTimeString } from "@/lib/utils";
import { encryptMessage, safeDecryptMessage } from "@/lib/message-encryption";

import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";
import { pageParams } from "@/lib/server/paging";
import { toId } from "@/lib/server/route";

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

// ─── GET — Fetch messages in a conversation ────────────────────────────────

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
      return NextResponse.json({ error: "Invalid conversation ID." }, { status: 400 });
    }

    const session = await authenticateRequest(req);
    if (!session || !isClientSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Client access required." : "Unauthorized." },
        { status: session ? 403 : 401 }
      );
    }

    const userId = Number(session.userId);

    // Verify client belongs to this conversation
    const convRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_conversation?filter[conversation_id][_eq]=${convId}&fields=conversation_id,client_id,freelancer_id`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!convRes.ok) {
      const errText = await convRes.text();
      console.error("Directus client conversation lookup error:", errText);
      return NextResponse.json(
        { error: "Failed to fetch conversation details." },
        { status: convRes.status }
      );
    }

    const convJson = await convRes.json();
    const conv = Array.isArray(convJson.data) ? convJson.data[0] : convJson.data;

    if (!conv) {
      return NextResponse.json(
        { error: `Conversation #${convId} not found.` },
        { status: 404 }
      );
    }

    if (conv.client_id !== userId && conv.freelancer_id !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { limit, offset } = pageParams(new URL(req.url).searchParams);

    // Fetch messages. `created_at` is a MySQL TIMESTAMP with one-second
    // resolution, so a burst of messages shares a sort key; without the
    // message_id tiebreaker an offset page can repeat or skip a row.
    const msgsRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_message?filter[conversation_id][_eq]=${convId}&sort[]=-created_at&sort[]=-message_id&limit=${limit}&offset=${offset}&fields=message_id,conversation_id,sender_id,message_type,message_content,is_edited,edited_at,created_at,is_deleted,reply_to_message_id,is_pinned,pinned_at,pinned_by`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!msgsRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch messages." },
        { status: msgsRes.status }
      );
    }

    const msgsJson = await msgsRes.json();
    const messages: Record<string, unknown>[] = msgsJson.data ?? [];

    // Parts of a thread are read from side collections. When one of those reads
    // fails the bubbles still render, so the response has to say which parts
    // are unreliable instead of letting "we could not read it" appear as "there
    // was nothing there".
    const warnings: string[] = [];
    // Set once when any card lookup fails: the builders below substitute
    // "Position", "Candidate" and "Updated Stage", so one honest notice beats
    // four identical toasts.
    let cardDataIncomplete = false;

    // Fetch attachments for these messages and any quoted reply messages
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

    if (allAttachmentMessageIds.length > 0) {
      // No cap: a 100-message page at 10 files each is 1000 rows, and a short
      // read made whole bubbles look like they had never carried a file.
      const attachRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_message_attachment?filter[message_id][_in]=${allAttachmentMessageIds.join(",")}&fields=attachment_id,message_id,file_name,file_path,file_size,mime_type,created_at&limit=-1`,
        { headers: getHeaders(), cache: "no-store" }
      );
      const attachJson = attachRes.ok ? await attachRes.json().catch(() => null) : null;
      const attachRows = Array.isArray(attachJson?.data)
        ? (attachJson.data as Record<string, unknown>[])
        : null;

      if (attachRows === null) {
        console.error(
          `Attachment lookup failed for conversation #${convId}: ${attachRes.status}`
        );
        warnings.push(
          "Some attachments could not be loaded, so files in this conversation may appear missing. Refresh the thread to try again."
        );
      } else {
        for (const att of attachRows) {
          const mid = att.message_id as number;
          if (!attachmentsMap.has(mid)) attachmentsMap.set(mid, []);
          attachmentsMap.get(mid)!.push(att);
        }
      }

      // Mark messages as read (fire-and-forget) for messages not sent by this user
      const unreadIds = messages
        .filter((m) => (m.sender_id as number) !== userId)
        .map((m) => m.message_id as number);

      if (unreadIds.length > 0) {
        // Check which are already read. A failed lookup is treated as "do not
        // write": answering from an empty set would re-insert receipts that
        // already exist (the collection has no unique key), and parsing a
        // non-JSON error body used to throw and fail the whole thread read.
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

          const toMarkIds = unreadIds.filter((id) => !alreadyReadIds.has(id));

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
            if (markRes === null || !markRes.ok) {
              // The UI clears the badge as soon as the thread opens, so a failed
              // receipt has to be said out loud rather than left to reappear on
              // the next list refresh.
              warnings.push(
                "This thread could not be marked as read, so its unread count may return."
              );
            }
          }
        } else {
          console.error(
            `Mark-read lookup failed for conversation #${convId}: ${readRes.status}`
          );
          warnings.push(
            "Read receipts could not be checked, so this thread may still show as unread."
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
      const smJson = smRes.ok ? await smRes.json().catch(() => null) : null;
      const smList = Array.isArray(smJson?.data)
        ? (smJson.data as Record<string, unknown>[])
        : null;

      if (smList === null) {
        console.error(
          `System event lookup failed for conversation #${convId}: ${smRes.status}`
        );
        warnings.push(
          "The cards on some system notices could not be loaded, so those messages show as plain text."
        );
      } else {
        for (const sm of smList) {
          systemMsgMap[sm.message_id as number] = sm;
        }

        // Collect application_ids, interview_ids, and stage_history_ids
        const appIds = Array.from(new Set(smList.map((s) => s.application_id).filter(Boolean))) as number[];
        const ivIds = Array.from(new Set(smList.map((s) => s.interview_id).filter(Boolean))) as number[];
        const shIds = Array.from(new Set(smList.map((s) => s.stage_history_id).filter(Boolean))) as number[];

        // Card lookups resolve to an empty list when they fail, and the builders
        // below then substitute "Position", "Candidate" or "Updated Stage" for a
        // value that was never read. Checking the response lets one warning cover
        // the card instead of rendering an invented label.
        const readCardRows = async (
          path: string
        ): Promise<Record<string, unknown>[]> => {
          // &limit=-1: every card path is an id list, and Directus' implicit 100
          // would return a short list that the builders below render as "no such
          // application/interview" instead of a read failure.
          const res = await fetch(`${DIRECTUS_BASE}${path}&limit=-1`, {
            headers: getHeaders(),
            cache: "no-store",
          }).catch(() => null);
          if (res === null || !res.ok) {
            console.error(
              `[messaging] Card lookup failed (${res?.status ?? "no response"}): ${path}`
            );
            cardDataIncomplete = true;
            return [];
          }
          const json = (await res.json().catch(() => null)) as {
            data?: Record<string, unknown>[];
          } | null;
          if (!Array.isArray(json?.data)) {
            console.error(`[messaging] Card lookup was unreadable: ${path}`);
            cardDataIncomplete = true;
            return [];
          }
          return json.data;
        };

        const emptyRows = Promise.resolve<Record<string, unknown>[]>([]);

        const [appsRes, ivsRes, shRes, jaRes] = await Promise.all([
          appIds.length > 0
            ? readCardRows(`/items/vs_job_application?filter[application_id][_in]=${appIds.join(",")}&fields=*`)
            : emptyRows,
          ivIds.length > 0
            ? readCardRows(`/items/vs_interview?filter[interview_id][_in]=${ivIds.join(",")}&fields=*`)
            : emptyRows,
          shIds.length > 0
            ? readCardRows(`/items/vs_application_stage_history?filter[id][_in]=${shIds.join(",")}&fields=*`)
            : emptyRows,
          appIds.length > 0
            ? readCardRows(`/items/vs_interview_application?filter[application_id][_in]=${appIds.join(",")}&fields=application_id,interview_id`)
            : emptyRows,
        ]);

        const appMap = new Map<number, Record<string, unknown>>(appsRes.map((a: Record<string, unknown>) => [a.application_id as number, a]));
        const ivMap = new Map<number, Record<string, unknown>>(ivsRes.map((i: Record<string, unknown>) => [i.interview_id as number, i]));
        const shMap = new Map<number, Record<string, unknown>>(shRes.map((s: Record<string, unknown>) => [s.id as number, s]));

        const extraIvIds = Array.from(
          new Set(
            jaRes
              .map((j) => Number(j.interview_id))
              .filter((id) => id > 0 && !ivMap.has(id))
          )
        );

        if (extraIvIds.length > 0) {
          const extraIvs = await readCardRows(
            `/items/vs_interview?filter[interview_id][_in]=${extraIvIds.join(",")}&filter[interview_status][_in]=SCHEDULED,CONFIRMED,RESCHEDULED&fields=*`
          );
          for (const ei of extraIvs) {
            ivMap.set(ei.interview_id as number, ei);
          }
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
            ? readCardRows(`/items/vs_user?filter[user_id][_in]=${userIds.join(",")}&fields=user_id,user_fname,user_lname,user_email,user_contact,profile_image_url`)
            : emptyRows,
          jobIds.length > 0
            ? readCardRows(`/items/vs_job_posting?filter[job_id][_in]=${jobIds.join(",")}&fields=job_id,job_title,salary_min,salary_max`)
            : emptyRows,
        ]);

        const userMap = new Map<number, Record<string, unknown>>(usersRes.map((u: Record<string, unknown>) => [u.user_id as number, u]));
        const jobMap = new Map<number, Record<string, unknown>>(jobsRes.map((j: Record<string, unknown>) => [j.job_id as number, j]));
        const freelancerUser = userMap.get(conv.freelancer_id as number);
        const convJob = jobMap.get(conv.job_id as number);

        for (const sm of smList) {
          const mid = sm.message_id as number;
          const et = sm.event_type as string;

          if (et === "APPLICATION_STATUS_CHANGED" || et === "HIRED") {
            const sh = sm.stage_history_id ? shMap.get(sm.stage_history_id as number) : null;
            // One malformed metadata blob used to throw out of this loop and take
            // the whole thread read with it: a single corrupted stage row made the
            // conversation unreadable rather than just losing that card.
            let meta: Record<string, unknown> | null = null;
            if (typeof sh?.metadata === "string") {
              try {
                meta = JSON.parse(sh.metadata) as Record<string, unknown>;
              } catch {
                console.error(
                  `[messaging] Stage history metadata is not valid JSON for message #${mid}`
                );
              }
            } else if (sh?.metadata && typeof sh.metadata === "object") {
              meta = sh.metadata as Record<string, unknown>;
            }
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

            const candName = u ? `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim() : (freelancerUser ? `${freelancerUser.user_fname ?? ""} ${freelancerUser.user_lname ?? ""}`.trim() : "Candidate");

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
              viewer_role: "CLIENT",
              application_id: targetAppId,
              stage_history_id: (sm.stage_history_id as number) ?? null,
              from_stage_name: fromStageName,
              to_stage_name: toStageName || (et === "HIRED" ? "Hired" : "Updated Stage"),
              from_stage_type: fromStageType,
              to_stage_type: toStageType,
              job_title: (j?.job_title as string) ?? (convJob?.job_title as string) ?? "Position",
              candidate_name: candName,
              applicant_name: candName,
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
                viewer_role: "CLIENT",
                application_id: app.application_id,

                // Structured Domain Entities
                applicant: {
                  user_id: app.user_id as number,
                  name: u ? `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim() : "Unknown",
                  email: (u?.user_email as string) ?? null,
                  phone: (u?.user_contact as string) ?? null,
                  avatar: u?.profile_image_url ? `/api/client/assets/${(u.profile_image_url as string).split("/").pop()}` : null,
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
                applicant_avatar: u?.profile_image_url ? `/api/client/assets/${(u.profile_image_url as string).split("/").pop()}` : null,
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
                viewer_role: "CLIENT",

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
                  name: freelancerUser ? `${freelancerUser.user_fname ?? ""} ${freelancerUser.user_lname ?? ""}`.trim() : "Candidate",
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
                applicant_name: freelancerUser ? `${freelancerUser.user_fname ?? ""} ${freelancerUser.user_lname ?? ""}`.trim() : "Candidate",
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

        const reactionsJson = reactionsRes.ok
          ? await reactionsRes.json().catch(() => null)
          : null;
        const rawReactions = Array.isArray(reactionsJson?.data)
          ? (reactionsJson.data as {
              reaction_id: number;
              message_id: number;
              user_id: number;
              reaction: string;
            }[])
          : null;

        // A failed reaction read used to leave every bubble looking like nobody
        // had reacted to it.
        if (rawReactions === null) {
          console.error(
            `Reaction lookup failed for conversation #${convId}: ${reactionsRes.status}`
          );
          warnings.push(
            "Reactions could not be loaded, so they may be missing from this thread."
          );
        } else {

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
      }
    >();

    if (replyIds.length > 0) {
      try {
        const replyRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_message?filter[message_id][_in]=${replyIds.join(
            ","
          )}&fields=message_id,sender_id,message_type,message_content`,
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
            const dec = safeDecryptMessage(rm.message_content as string | null);
            const sId = rm.sender_id as number;
            const resolvedName = userNamesMap.get(sId);
            const sName =
              sId === userId
                ? "You"
                : (resolvedName || conv.freelancer_name || "Freelancer");
            const replyAtts = attachmentsMap.get(rm.message_id as number) ?? [];
            const firstAtt = replyAtts[0] as { file_name?: string } | undefined;
            const fallbackFileName = firstAtt?.file_name ?? "";
            const displayContent = dec
              ? (dec.length > 120 ? dec.slice(0, 120) + "..." : dec)
              : fallbackFileName;

            replyMap.set(rm.message_id as number, {
              message_id: rm.message_id as number,
              sender_id: sId,
              sender_name: sName,
              message_content: displayContent,
              message_type: (rm.message_type as string) || "TEXT",
              attachments: replyAtts,
            });
          }
        }
      } catch (err) {
        console.error("Error fetching reply quoted messages:", err);
      }
    }

    // Fetch pinned message IDs for this user. Which mechanism answers depends on
    // why the read landed: the per-user list when it was read, the legacy shared
    // flag only when vs_message_pin does not exist at all, and "nothing is
    // pinned" when the read failed — borrowing the shared flag after an outage
    // would show a pin the other participant set.
    const userPinnedSet = new Set<number>();
    let pinSource: "per-user" | "legacy" | "unknown" = "unknown";
    const pinRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_message_pin?filter[user_id][_eq]=${userId}&filter[conversation_id][_eq]=${convId}&fields=message_id&limit=-1`,
      { headers: getHeaders(), cache: "no-store" }
    ).catch((err: unknown) => {
      console.error("Pin lookup threw for conversation:", err);
      return null;
    });
    if (pinRes !== null && pinRes.ok) {
      const pinJson = (await pinRes.json().catch(() => null)) as {
        data?: { message_id: number }[];
      } | null;
      if (Array.isArray(pinJson?.data)) {
        pinSource = "per-user";
        for (const p of pinJson.data) {
          userPinnedSet.add(Number(p.message_id));
        }
      }
    } else if (pinRes !== null && (pinRes.status === 404 || pinRes.status === 403)) {
      pinSource = "legacy";
    }
    if (pinSource === "unknown") {
      console.error(`Pin lookup unavailable for conversation #${convId}`);
      warnings.push("Pinned markers could not be loaded, so they may be missing here.");
    }

    // Enrich messages with attachments, system_message, system_card_data, reactions, and reply_to
    // Reverse array so messages returned are in chronological order (oldest -> newest)
    const enriched = messages.map((msg) => {
      let content = safeDecryptMessage(msg.message_content as string | null | undefined);
      if (msg.is_deleted) {
        content = null;
      }
      const cardData = cardDataMap[msg.message_id as number];
      const sm = systemMsgMap[msg.message_id as number];

      if (msg.message_type === "SYSTEM" && (cardData || sm) && !cardDataIncomplete) {
        const eventType = (sm?.event_type ?? cardData?.event_type) as string;
        const applicantName = (cardData?.applicant_name as string) || "Candidate";
        const jobTitle = (cardData?.job_title as string) || "Position";

        if (eventType === "HIRED") {
          content = `You hired ${applicantName} for ${jobTitle}`;
        } else if (eventType === "APPLICATION_SUBMITTED") {
          content = `${applicantName} applied for ${jobTitle}`;
        } else if (eventType === "APPLICATION_STATUS_CHANGED") {
          const stageName = (cardData?.to_stage_name as string) || (cardData?.application_status as string) || "";
          content = stageName
            ? `Application status for ${applicantName} was moved to ${stageName}`
            : `Application status for ${applicantName} was updated`;
        } else if (eventType === "INTERVIEW_SCHEDULED") {
          content = `Interview scheduled with ${applicantName}`;
        } else if (eventType === "INTERVIEW_UPDATED") {
          content = `Interview with ${applicantName} was rescheduled`;
        }
      }

      const isPinnedForUser =
        pinSource === "per-user"
          ? userPinnedSet.has(msg.message_id as number)
          : pinSource === "legacy"
            ? Boolean(msg.is_pinned && Number(msg.pinned_by) === userId)
            : false;

      return {
        ...msg,
        message_content: content,
        attachments: attachmentsMap.get(msg.message_id as number) ?? [],
        system_message: sm ?? null,
        system_card_data: cardData ?? null,
        reactions: reactionsMap.get(msg.message_id as number) ?? [],
        reply_to: msg.reply_to_message_id ? replyMap.get(msg.reply_to_message_id as number) ?? null : null,
        is_pinned: isPinnedForUser,
        pinned_at: (msg.pinned_at as string) ?? null,
        pinned_by: (msg.pinned_by as number) ?? null,
      };
    }).reverse();

    if (cardDataIncomplete) {
      warnings.push(
        "Some application, interview and stage details could not be loaded, so system notices in this thread may look incomplete."
      );
    }

    return NextResponse.json({ messages: enriched, warnings });
  } catch (err: unknown) {
    console.error("GET /api/client/messaging/[id]/messages error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// ─── POST — Send a message ─────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    const convId = toId(conversationId);
    if (convId === null) {
      return NextResponse.json({ error: "Invalid conversation ID." }, { status: 400 });
    }

    const session = await authenticateRequest(req);
    if (!session || !isClientSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Client access required." : "Unauthorized." },
        { status: session ? 403 : 401 }
      );
    }

    const userId = Number(session.userId);

    // Validate SEND_MESSAGES Restriction
    const restriction = await checkRestrictionState(userId, "SEND_MESSAGES");
    if (restriction.restricted) {
      if (restriction.reason === "unavailable") {
        return NextResponse.json(
          {
            error:
              "Your account status could not be verified, so this message was not sent. Please try again.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "Your messaging privileges are temporarily suspended." },
        { status: 403 }
      );
    }

    // BUSINESS RULE: Only VERIFIED companies can send candidate messages
    const { isVerified, verification_status, readFailed } =
      await checkCompanyVerificationStatus(userId);
    if (!isVerified) {
      if (readFailed) {
        return NextResponse.json(
          {
            error:
              "Your company verification status could not be read, so this message was not sent. Please try again.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        {
          error: `Restricted: Your company verification status is currently ${verification_status}. Sending candidate messages is restricted until your company is verified by an admin.`,
          verification_status,
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);

    const incomingAttachments = Array.isArray(body?.attachments)
      ? body.attachments.slice(0, MAX_ATTACHMENTS_PER_MESSAGE)
      : [];

    if (!body?.message_content && incomingAttachments.length === 0) {
      return NextResponse.json(
        { error: "message_content or attachments required." },
        { status: 400 }
      );
    }

    // Verify access
    const convRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_conversation?filter[conversation_id][_eq]=${convId}&fields=conversation_id,client_id,freelancer_id,status`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!convRes.ok) {
      const errText = await convRes.text();
      console.error("Directus client conversation lookup error (POST):", errText);
      return NextResponse.json(
        { error: "Failed to fetch conversation details." },
        { status: convRes.status }
      );
    }

    const convJson = await convRes.json();
    const conv = Array.isArray(convJson.data) ? convJson.data[0] : convJson.data;

    if (!conv) {
      return NextResponse.json(
        { error: `Conversation #${convId} not found.` },
        { status: 404 }
      );
    }

    if (conv.client_id !== userId && conv.freelancer_id !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    if (conv.status === "BLOCKED") {
      return NextResponse.json(
        { error: "Conversation is blocked." },
        { status: 403 }
      );
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

    // Insert message
    const msgRes = await fetch(`${DIRECTUS_BASE}/items/vs_message`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(messageInsertBody),
    });

    const msgJson = await msgRes.json();

    if (!msgRes.ok) {
      return NextResponse.json(
        {
          error:
            msgJson.errors?.[0]?.message ?? "Failed to send message.",
        },
        { status: msgRes.status }
      );
    }

    const newMessage = msgJson.data;
    if (newMessage && !newMessage.created_at) {
      newMessage.created_at = nowPH;
    }

    // Insert attachments if any
    let attachments: unknown[] = [];
    // The message row is already committed by now, so a failed follow-up write
    // must not come back as an error: an error invites a resend, and a resend
    // is a second copy of the same message. These are reported alongside the
    // 201 instead.
    const sendWarnings: string[] = [];
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

      const attJson = attRes.ok ? await attRes.json().catch(() => null) : null;
      const inserted = Array.isArray(attJson?.data) ? attJson.data : [];
      attachments = inserted;
      if (!attRes.ok) {
        const errText = await attRes.text().catch(() => "");
        console.error("[client messaging] attachment insert failed:", attRes.status, errText);
      }
      if (inserted.length !== attPayloads.length) {
        sendWarnings.push(
          `The message was sent, but ${attPayloads.length - inserted.length} of ${attPayloads.length} attachment${attPayloads.length === 1 ? " was" : "s were"} not recorded, so the other side cannot open the file.`
        );
      }
    }

    // Update conversation last_message_at
    const previewRes = await fetch(`${DIRECTUS_BASE}/items/vs_conversation/${convId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ last_message_at: nowPH }),
    }).catch((e) => {
      console.error("Update last_message_at error:", e);
      return null;
    });
    if (previewRes !== null && !previewRes.ok) {
      console.error("Update last_message_at failed:", previewRes.status);
      sendWarnings.push(
        "The message was sent, but the conversation list could not be updated, so its position and last-activity time may be out of date."
      );
    }

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
              sender_name: Number(pMsg.sender_id) === userId ? "You" : (conv.freelancer_name || "Freelancer"),
              message_content: content,
              message_type: (pMsg.message_type as string) || "TEXT",
              attachments: pAtts,
            };
          }
        }
      } catch (e) {
        console.error("Failed to resolve reply_to in POST:", e);
      }
    }

    return NextResponse.json(
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
        warnings: sendWarnings,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("POST /api/client/messaging/[id]/messages error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

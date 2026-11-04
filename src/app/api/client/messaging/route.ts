// src/app/api/client/messaging/route.ts

import { checkRestrictionState, checkCompanyVerificationStatus } from "@/lib/status-validator";
import { safeDecryptMessage } from "@/lib/message-encryption";
import { getPHTimeString } from "@/lib/utils";
import {
  DirectusError,
  directusItem,
  directusItems,
  directusItemsWhereIn,
  directusRequest,
  directusSettled,
} from "@/lib/server/directus";
import { HttpError, badRequest, forbidden, json, readBody, toId, withRoute } from "@/lib/server/route";
import {
  lastMessageByConversation,
  unreadCountByConversation,
} from "@/lib/messaging/conversation-reads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONVERSATION_FIELDS =
  "conversation_id,job_id,client_id,freelancer_id,conversation_type,status,last_message_at,created_at,updated_at,archived_by_client,archived_by_freelancer,archived_at";

/** `vs_conversation.conversation_type` is a MySQL enum; anything else is a 400. */
type ConversationTypeValue = "JOB_APPLICATION" | "DIRECT_MESSAGE" | "SUPPORT";
const CONVERSATION_TYPES: readonly ConversationTypeValue[] = [
  "JOB_APPLICATION",
  "DIRECT_MESSAGE",
  "SUPPORT",
];

type Row = Record<string, unknown>;

function formatAvatarUrl(url?: string | null): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();

  // Already proxied — use as-is
  if (trimmed.startsWith("/api/client/assets/")) return trimmed;

  // data: URI — use as-is
  if (trimmed.startsWith("data:")) return trimmed;

  // Full Directus URL (https://directus.host/assets/UUID) — extract UUID and proxy it
  const assetsMatch = trimmed.match(/\/assets\/([^/?#]+)/);
  if (assetsMatch?.[1]) return `/api/client/assets/${assetsMatch[1]}`;

  // Bare UUID or path segment — use last segment
  const parts = trimmed.split("/");
  const fileId = parts[parts.length - 1];
  return fileId ? `/api/client/assets/${fileId}` : null;
}

function uniqueIds(rows: Row[], key: string): number[] {
  return Array.from(
    new Set(rows.map((row) => row[key]).filter((value): value is number => typeof value === "number"))
  );
}

function previewFrom(lastMsg: Row, otherPartyFirstName: string, otherPartyName: string): string {
  const rawContent = (lastMsg.message_content as string) ?? "";

  if (lastMsg.message_type === "SYSTEM") {
    const lower = rawContent.toLowerCase();
    if (lower.includes("hired you") || lower.includes("client hired")) {
      return `You hired ${otherPartyName}`;
    }
    if (lower.includes("application submitted")) {
      return `${otherPartyName} applied`;
    }
    if (lower.includes("status changed") || lower.includes("application updated")) {
      return `Application updated for ${otherPartyName}`;
    }
    if (lower.includes("interview scheduled")) {
      return `Interview scheduled with ${otherPartyName}`;
    }
    if (lower.includes("interview rescheduled") || lower.includes("interview updated")) {
      return `Interview rescheduled with ${otherPartyName}`;
    }
    return rawContent;
  }

  if (lastMsg.message_type === "TEXT") {
    const content = safeDecryptMessage(rawContent) ?? "";
    const fullText = `${otherPartyFirstName}: ${content}`;
    return fullText.length > 60 ? `${fullText.slice(0, 60)}…` : fullText;
  }
  if (lastMsg.message_type === "IMAGE") return `${otherPartyFirstName}: 📷 Image`;
  if (lastMsg.message_type === "FILE") return `${otherPartyFirstName}: 📎 File`;
  return "";
}

// ─── GET — List conversations for the authenticated client ─────────────────

export const GET = withRoute(async ({ req, session }) => {
  const userId = Number(session.userId);

  const includeArchived = new URL(req.url).searchParams.get("archived") === "true";

  // Mutually exclusive archive mode: archived-only vs active-only
  let filter = `filter[client_id][_eq]=${userId}&filter[status][_neq]=BLOCKED`;
  filter += includeArchived
    ? `&filter[archived_by_client][_eq]=true`
    : `&filter[archived_by_client][_eq]=false`;

  let conversations: Row[];
  try {
    conversations = await directusItems<Row>("vs_conversation", {
      // `limit=-1`: this is filtered to one account, and capping it at 100 made
      // every older thread unreachable — the list simply had no bottom.
      query: `${filter}&sort[]=-last_message_at&limit=-1&fields=${CONVERSATION_FIELDS}`,
    });
  } catch (err: unknown) {
    if (err instanceof DirectusError) {
      throw new HttpError(err.status, "Failed to fetch conversations.");
    }
    throw err;
  }

  // Collect freelancer user IDs and job IDs for enrichment
  const freelancerIds = uniqueIds(conversations, "freelancer_id");
  const jobIds = uniqueIds(conversations, "job_id");

  // Fetch freelancer user info and job titles in parallel
  const [usersData, jobsData] = await Promise.all([
    directusItemsWhereIn<Row>(
      "vs_user",
      "user_id",
      freelancerIds,
      "user_id,user_fname,user_lname,user_email,profile_image_url"
    ),
    directusItemsWhereIn<Row>(
      "vs_job_posting",
      "job_id",
      jobIds,
      "job_id,job_title"
    ),
  ]);

  // Build lookup maps
  const userMap = new Map<number, Row>(usersData.map((u) => [u.user_id as number, u]));
  const jobMap = new Map<number, Row>(jobsData.map((j) => [j.job_id as number, j]));

  const conversationIds = conversations.map((c) => c.conversation_id as number);

  // Preview and unread badges come from the shared conversation reads, so the
  // two portals report the same figures for the same account. A failed unread
  // read fails the whole list rather than answering 0 for every thread, which
  // is how a waiting message used to go unseen.
  const [lastMessagesMap, unreadMap] = await Promise.all([
    lastMessageByConversation(conversationIds),
    unreadCountByConversation(userId, conversationIds),
  ]);

  // Enrich conversations
  const enriched = conversations.map((conv) => {
    const cid = conv.conversation_id as number;
    const freelancer = userMap.get(conv.freelancer_id as number);
    const job = jobMap.get(conv.job_id as number);
    const lastMsg = lastMessagesMap.get(cid);

    const otherPartyName = freelancer
      ? `${freelancer.user_fname ?? ""} ${freelancer.user_lname ?? ""}`.trim()
      : "Unknown";
    const otherPartyFirstName =
      (typeof freelancer?.user_fname === "string" ? freelancer.user_fname.trim() : "") ||
      otherPartyName.split(" ")[0] ||
      "Freelancer";

    let lastMessagePreview = "";
    if (lastMsg) {
      const isOwn = (lastMsg.sender_id as number) === userId;
      const senderPrefix = isOwn ? "You" : otherPartyFirstName;
      lastMessagePreview = previewFrom(lastMsg, senderPrefix, otherPartyName);
    }

    return {
      ...conv,
      other_party_name: otherPartyName,
      other_party_avatar: formatAvatarUrl(freelancer?.profile_image_url as string),
      other_party_email: (freelancer?.user_email as string) ?? null,
      job_title: (job?.job_title as string) ?? null,
      unread_count: unreadMap.get(cid) ?? 0,
      last_message_preview: lastMessagePreview,
      last_message_at: lastMsg?.created_at ?? conv.last_message_at ?? conv.created_at,
    };
  });

  return { conversations: enriched };
}, { auth: "client" });

async function enrichOneConversation(conv: Row, viewerId: number) {
  const fid = Number(conv.freelancer_id);
  const jid = conv.job_id ? Number(conv.job_id) : null;

  const [userRes, jobRes, unreadMap] = await Promise.all([
    fid ? directusItem<Row>("vs_user", fid) : Promise.resolve<Row | null>(null),
    jid ? directusItem<Row>("vs_job_posting", jid) : Promise.resolve<Row | null>(null),
    // `unread_count` is not a column on vs_conversation, and this used to answer
    // a literal 0. The hook replaces the list row with this payload, so opening
    // a thread with unread messages cleared its badge before anything was read.
    unreadCountByConversation(viewerId, [Number(conv.conversation_id)]),
  ]);

  const otherPartyName = userRes
    ? `${userRes.user_fname ?? ""} ${userRes.user_lname ?? ""}`.trim() || "Freelancer"
    : "Freelancer";

  return {
    ...conv,
    other_party_name: otherPartyName,
    other_party_avatar: formatAvatarUrl(userRes?.profile_image_url as string),
    other_party_email: (userRes?.user_email as string) ?? null,
    job_title: (jobRes?.job_title as string) ?? null,
    unread_count: unreadMap.get(Number(conv.conversation_id)) ?? 0,
  };
}

// ─── POST — Create a new conversation ─────────────────────────────────────

export const POST = withRoute(async ({ req, session }) => {
  const userId = Number(session.userId);

  // Validate SEND_MESSAGES Restriction
  const restriction = await checkRestrictionState(userId, "SEND_MESSAGES");
  if (restriction.restricted) {
    if (restriction.reason === "unavailable") {
      throw new HttpError(
        503,
        "Your account status could not be verified, so the conversation was not created. Please try again."
      );
    }
    throw new HttpError(403, "Your messaging privileges are temporarily suspended.");
  }

  // BUSINESS RULE: Only VERIFIED companies can send candidate messages
  const { isVerified, verification_status, companyId, readFailed } =
    await checkCompanyVerificationStatus(userId);
  if (!isVerified) {
    if (readFailed) {
      throw new HttpError(
        503,
        "Your company verification status could not be read, so the conversation was not created. Please try again."
      );
    }
    throw new HttpError(
      403,
      `Restricted: Your company verification status is currently ${verification_status}. Sending candidate messages is restricted until your company is verified by an admin.`,
      { verification_status }
    );
  }

  const body = await readBody(req);

  // Both ids are interpolated into Directus filter URLs below and written into
  // the new row, so they must be positive integers rather than whatever string
  // the caller sent.
  const freelancer_id = toId(body.freelancer_id);
  if (freelancer_id === null) {
    throw badRequest("freelancer_id must be a positive integer.");
  }

  const rawJobId = body.job_id;
  const job_id = toId(rawJobId);
  if (job_id === null && rawJobId !== undefined && rawJobId !== null && rawJobId !== "") {
    throw badRequest("job_id must be a positive integer.");
  }

  const rawType = body.conversation_type;
  if (
    rawType !== undefined &&
    rawType !== null &&
    !CONVERSATION_TYPES.includes(rawType as ConversationTypeValue)
  ) {
    throw badRequest("conversation_type must be JOB_APPLICATION, DIRECT_MESSAGE or SUPPORT.");
  }

  // Check if a conversation already exists between client and freelancer (for same job).
  let existingFilter = `filter[client_id][_eq]=${userId}&filter[freelancer_id][_eq]=${freelancer_id}&filter[status][_neq]=BLOCKED`;
  if (job_id) existingFilter += `&filter[job_id][_eq]=${job_id}`;

  const existingRes = await directusSettled<{ data?: Row[] }>(
    `/items/vs_conversation?${existingFilter}&limit=1&fields=${CONVERSATION_FIELDS}`
  );
  // An unreadable lookup used to fall through and create a second thread for
  // the same application. Both would then collect messages, and whichever the
  // list happened to show decided which half of the conversation either party
  // could see — so the read has to fail the request instead.
  if (!existingRes.ok) {
    throw new HttpError(502, "Existing conversation could not be checked. Please try again.");
  }
  const existing = existingRes.data?.data?.[0] ?? null;

  if (existing) {
    // If archived by client, un-archive it
    if (existing.archived_by_client) {
      const unarchive = await directusSettled(
        `/items/vs_conversation/${existing.conversation_id}`,
        { method: "PATCH", body: { archived_by_client: false } }
      );
      // Reporting the thread as reopened while the row is still archived sends
      // both sides' messages into a thread neither list shows.
      if (!unarchive.ok) {
        throw new HttpError(502, "Conversation could not be reopened. Please try again.");
      }
      existing.archived_by_client = false;
    }
    return { conversation: await enrichOneConversation(existing, userId), created: false };
  }

  // A job-scoped thread has to be about one of this company's own postings and
  // about a real application. Without this, any verified client could open a
  // thread pinned to another company's job_id, and the ApplicationCard in the
  // chat would render that job's details to both parties.
  if (job_id !== null) {
    if (companyId === null) {
      throw forbidden("No company is linked to this account.");
    }

    const jobRes = await directusSettled<{
      data?: { company_id?: number | { company_id?: number } };
    }>(`/items/vs_job_posting/${job_id}`, { query: "fields=job_id,company_id" });
    if (!jobRes.ok) {
      throw new HttpError(
        jobRes.status === 404 ? 404 : 502,
        jobRes.status === 404 ? "Job not found." : "Failed to verify the job."
      );
    }
    const rawJobCompany = jobRes.data?.data?.company_id;
    const jobCompanyId =
      typeof rawJobCompany === "object" && rawJobCompany !== null
        ? rawJobCompany.company_id
        : rawJobCompany;
    if (Number(jobCompanyId) !== companyId) {
      throw forbidden("This job does not belong to your company.");
    }

    const applications = await directusItems<Row>("vs_job_application", {
      query: `filter[job_id][_eq]=${job_id}&filter[user_id][_eq]=${freelancer_id}&limit=1`,
    });
    if (applications.length === 0) {
      throw forbidden("This freelancer has not applied to this job.");
    }
  }

  // Create new conversation
  const nowPH = getPHTimeString();
  const created = await directusRequest<{ data?: Row }>("/items/vs_conversation", {
    method: "POST",
    body: {
      client_id: userId,
      freelancer_id,
      job_id: job_id ?? null,
      conversation_type: (rawType as ConversationTypeValue) ?? "JOB_APPLICATION",
      status: "ACTIVE",
      archived_by_client: false,
      archived_by_freelancer: false,
      last_message_at: nowPH,
    },
  });

  return json(
    { conversation: await enrichOneConversation(created.data ?? {}, userId), created: true },
    201
  );
}, { auth: "client" });

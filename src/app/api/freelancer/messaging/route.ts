// src/app/api/freelancer/messaging/route.ts

import { NextRequest, NextResponse } from "next/server";
import { safeDecryptMessage } from "@/lib/message-encryption";
import { authenticateRequest, isFreelancerSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";
import {
  DirectusError,
  directusItems,
  directusItemsWhereIn,
} from "@/lib/server/directus";
import {
  lastMessageByConversation,
  unreadCountByConversation,
} from "@/lib/messaging/conversation-reads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONVERSATION_FIELDS =
  "conversation_id,job_id,client_id,freelancer_id,conversation_type,status,last_message_at,created_at,updated_at,archived_by_client,archived_by_freelancer,archived_at";

type Row = Record<string, unknown>;

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

// ─── GET — List conversations for the authenticated freelancer ─────────────

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

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("archived") === "true";

    // Mutually exclusive archive mode: archived-only vs active-only
    let filter = `filter[freelancer_id][_eq]=${userId}&filter[status][_neq]=BLOCKED`;
    if (includeArchived) {
      filter += `&filter[archived_by_freelancer][_eq]=true`;
    } else {
      filter += `&filter[archived_by_freelancer][_eq]=false`;
    }

    const conversations = await directusItems<Row>("vs_conversation", {
      // `limit=-1`: this is filtered to one account, and capping it at 100 made
      // every older thread unreachable — the list simply had no bottom.
      query: `${filter}&sort[]=-last_message_at&limit=-1&fields=${CONVERSATION_FIELDS}`,
    });

    // Collect client user IDs and job IDs
    const clientIds: number[] = Array.from(
      new Set(
        conversations
          .map((c: Record<string, unknown>) => c.client_id)
          .filter((id: unknown): id is number => typeof id === "number")
      )
    );
    const jobIds: number[] = Array.from(
      new Set(
        conversations
          .map((c: Record<string, unknown>) => c.job_id)
          .filter((id: unknown): id is number => typeof id === "number")
      )
    );

    const [usersData, jobsData, companyUsersData] = await Promise.all([
      directusItemsWhereIn<Row>(
        "vs_user",
        "user_id",
        clientIds,
        "user_id,user_fname,user_lname,user_email,profile_image_url"
      ),
      directusItemsWhereIn<Row>(
        "vs_job_posting",
        "job_id",
        jobIds,
        "job_id,job_title,company_id"
      ),
      directusItemsWhereIn<Row>(
        "vs_company_user",
        "user_id",
        clientIds,
        "user_id,company_id"
      ),
    ]);

    const userMap = new Map<number, Record<string, unknown>>(
      usersData.map((u: Record<string, unknown>) => [u.user_id as number, u])
    );
    const jobMap = new Map<number, Record<string, unknown>>(
      jobsData.map((j: Record<string, unknown>) => [j.job_id as number, j])
    );

    const clientCompanyMap = new Map<number, number>(
      (companyUsersData as Record<string, unknown>[]).map((cu) => [
        cu.user_id as number,
        cu.company_id as number,
      ])
    );

    const rawCompanyIds: number[] = [];
    for (const j of jobsData as Record<string, unknown>[]) {
      const cId =
        typeof j.company_id === "object"
          ? (j.company_id as { company_id?: number })?.company_id
          : j.company_id;
      if (typeof cId === "number") rawCompanyIds.push(cId);
    }
    for (const cu of companyUsersData as Record<string, unknown>[]) {
      if (typeof cu.company_id === "number") rawCompanyIds.push(cu.company_id);
    }
    const uniqueCompanyIds = Array.from(new Set(rawCompanyIds));

    const conversationIds = conversations.map(
      (c: Record<string, unknown>) => c.conversation_id as number
    );

    // Previews and unread badges come from the shared conversation reads, so a
    // freelancer sees the same figures here that the employer side reports for
    // the same thread — and so an unread message is never counted from a window
    // of the oldest rows.
    const [companiesData, lastMessagesMap, unreadMap] = await Promise.all([
      directusItemsWhereIn<Row>(
        "vs_company",
        "company_id",
        uniqueCompanyIds,
        "company_id,company_name,company_logo"
      ),
      lastMessageByConversation(conversationIds),
      unreadCountByConversation(userId, conversationIds),
    ]);

    const companyMap = new Map<
      number,
      { company_name: string; company_logo: string | null }
    >(
      (companiesData as Record<string, unknown>[]).map((c) => [
        c.company_id as number,
        {
          company_name: (c.company_name as string) || "Unknown Company",
          company_logo: (c.company_logo as string) || null,
        },
      ])
    );

    const enriched = conversations.map((conv: Record<string, unknown>) => {
      const cid = conv.conversation_id as number;
      const client = userMap.get(conv.client_id as number);
      const job = jobMap.get(conv.job_id as number);
      const lastMsg = lastMessagesMap.get(cid);

      // Resolve company via job.company_id first, then fallback to vs_company_user
      const jobCompanyId =
        typeof job?.company_id === "object"
          ? (job.company_id as { company_id?: number })?.company_id
          : typeof job?.company_id === "number"
          ? job.company_id
          : undefined;
      const clientCompanyId = clientCompanyMap.get(conv.client_id as number);
      const resolvedCompanyId = jobCompanyId ?? clientCompanyId;
      const company = resolvedCompanyId ? companyMap.get(resolvedCompanyId) : undefined;

      const clientFullName = client
        ? `${client.user_fname ?? ""} ${client.user_lname ?? ""}`.trim()
        : "";
      const otherPartyName = clientFullName || company?.company_name || "Unknown Employer";
      const otherPartyPrefix = client?.user_fname || company?.company_name || otherPartyName.split(" ")[0] || "Employer";

      let lastMessagePreview = "";
      if (lastMsg) {
        const isOwn = (lastMsg.sender_id as number) === userId;
        const senderPrefix = isOwn ? "You" : otherPartyPrefix;

        if (lastMsg.message_type === "SYSTEM") {
          const rawContent = (lastMsg.message_content as string) ?? "";
          const lower = rawContent.toLowerCase();
          if (lower.includes("hired") || lower.includes("client hired")) {
            lastMessagePreview = "You were hired!";
          } else if (lower.includes("application submitted")) {
            lastMessagePreview = "Application submitted";
          } else if (lower.includes("status changed") || lower.includes("application updated")) {
            lastMessagePreview = "Application status updated";
          } else if (lower.includes("interview scheduled")) {
            lastMessagePreview = "Interview scheduled";
          } else if (lower.includes("interview rescheduled") || lower.includes("interview updated")) {
            lastMessagePreview = "Interview rescheduled";
          } else {
            lastMessagePreview = rawContent;
          }
        } else if (lastMsg.message_type === "TEXT") {
          const rawContent = (lastMsg.message_content as string) ?? "";
          const content = safeDecryptMessage(rawContent) ?? "";
          const fullText = `${senderPrefix}: ${content}`;
          lastMessagePreview =
            fullText.length > 60 ? fullText.slice(0, 60) + "…" : fullText;
        } else if (lastMsg.message_type === "IMAGE") {
          lastMessagePreview = `${senderPrefix}: 📷 Image`;
        } else if (lastMsg.message_type === "FILE") {
          lastMessagePreview = `${senderPrefix}: 📎 File`;
        }
      }

      const avatarRaw =
        (client?.profile_image_url as string) ||
        (company?.company_logo as string) ||
        null;

      return {
        ...conv,
        other_party_name: otherPartyName,
        company_name: company?.company_name ?? null,
        other_party_avatar: formatAvatarUrl(avatarRaw),
        other_party_email: (client?.user_email as string) ?? null,
        job_title: (job?.job_title as string) ?? null,
        unread_count: unreadMap.get(cid) ?? 0,
        last_message_preview: lastMessagePreview,
        last_message_at:
          lastMsg?.created_at ?? conv.last_message_at ?? conv.created_at,
      };
    });

    return NextResponse.json({ conversations: enriched });
  } catch (err: unknown) {
    console.error("GET /api/freelancer/messaging error:", err);
    // A thread list whose unread counts could not be read is not a list with
    // nothing unread in it. 502 keeps the module on its error state instead of
    // rendering every conversation as fully read.
    const upstream = err instanceof DirectusError;
    return NextResponse.json(
      {
        error: upstream
          ? "Conversations could not be read. Please try again."
          : safeErrorMessage(err, "Internal server error"),
      },
      { status: upstream ? 502 : 500 }
    );
  }
}

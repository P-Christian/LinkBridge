import { NextRequest } from "next/server";
import { getPHTimeString } from "@/lib/utils";
import { mapPool } from "@/lib/server/pool";

import { authenticateRequest } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";
import { json, toId } from "@/lib/server/route";
import { directusItems, directusItemsWhereIn } from "@/lib/server/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/$/,
  ""
);
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "🎉", "🔥", "👀", "🙏", "❓"] as const;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

interface DirectusReaction {
  reaction_id: number;
  message_id: number;
  user_id: number;
  reaction: string;
  created_at: string;
}

interface DirectusUser {
  user_id: number;
  user_fname?: string | null;
  user_lname?: string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const numMessageId = toId(messageId);
    if (numMessageId === null) {
      return json({ error: "Invalid message ID." }, 400);
    }

    const session = await authenticateRequest(req);
    if (!session) {
      return json({ error: "Unauthorized." }, 401);
    }

    const userId = Number(session.userId);

    const body = await req.json().catch(() => null);
    const reaction = body?.reaction;

    if (!reaction || typeof reaction !== "string" || !ALLOWED_REACTIONS.includes(reaction as (typeof ALLOWED_REACTIONS)[number])) {
      return json(
        { error: `Invalid reaction. Allowed: ${ALLOWED_REACTIONS.join(", ")}` }, 400);
    }

    // 1. Fetch message and verify conversation ownership
    const msgRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_message/${numMessageId}?fields=message_id,conversation_id,is_deleted`,
      { headers: getHeaders(), cache: "no-store" }
    );

    // A read that failed is not a read that found nothing. Reporting either of
    // these as 404/403 told a real participant, during a Directus blip, that
    // their message or their seat in the conversation did not exist.
    if (!msgRes.ok) {
      if (msgRes.status === 404) {
        return json({ error: "Message not found." }, 404);
      }
      console.error(`Message lookup failed for #${numMessageId}: ${msgRes.status}`);
      return json(
        { error: "The message could not be read. Please try again." }, 502);
    }

    const msgJson = await msgRes.json();
    const message = msgJson.data;

    if (!message || message.is_deleted) {
      return json({ error: "Message not found or deleted." }, 404);
    }

    const convRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_conversation/${message.conversation_id}?fields=conversation_id,client_id,freelancer_id,status`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!convRes.ok) {
      if (convRes.status === 404) {
        return json({ error: "Conversation not found." }, 404);
      }
      console.error(`Conversation lookup failed for #${message.conversation_id}: ${convRes.status}`);
      return json(
        { error: "The conversation could not be read. Please try again." }, 502);
    }

    const convJson = await convRes.json();
    const conv = convJson.data;

    if (!conv) {
      return json({ error: "Conversation not found." }, 404);
    }

    if (conv.client_id !== userId && conv.freelancer_id !== userId) {
      return json({ error: "Forbidden." }, 403);
    }

    if (conv.status === "BLOCKED") {
      return json({ error: "Conversation is blocked." }, 403);
    }

    // 2. Check all reactions by this user on this message
    const userReactionsRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_message_reaction?filter[message_id][_eq]=${numMessageId}&filter[user_id][_eq]=${userId}&fields=reaction_id,reaction`,
      { headers: getHeaders(), cache: "no-store" }
    );

    // Reading the current state is what makes this a toggle. Guessing from an
    // empty list would insert a second row for an emoji already given, and the
    // grouped read-back below would then count the user twice.
    if (!userReactionsRes.ok) {
      console.error(`Reaction lookup failed for message #${numMessageId}: ${userReactionsRes.status}`);
      return json(
        { error: "Failed to read existing reactions." }, 502);
    }

    const userReactionsJson = (await userReactionsRes.json().catch(() => null)) as {
      data?: { reaction_id: number; reaction: string }[];
    } | null;
    const userReactions = Array.isArray(userReactionsJson?.data)
      ? userReactionsJson.data
      : [];

    const sameReaction = userReactions.find((r) => r.reaction === reaction);

    if (sameReaction) {
      // Toggled off same emoji: delete user's reaction(s) on this message
      const deleteOutcomes = await mapPool(
        userReactions,
        async (item) => {
          const res = await fetch(
            `${DIRECTUS_BASE}/items/vs_message_reaction/${item.reaction_id}`,
            { method: "DELETE", headers: getHeaders() }
          ).catch(() => null);
          return res?.ok ?? false;
        }
      );

      if (deleteOutcomes.some((ok) => !ok)) {
        console.error("Reaction delete failed for message:", numMessageId);
        return json(
          { error: "Failed to remove reaction." }, 502);
      }
    } else if (userReactions.length > 0) {
      // User switched reaction: update first reaction in-place via PATCH to eliminate zero-reaction gaps
      const primary = userReactions[0];
      const nowPH = getPHTimeString();
      const patchRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_message_reaction/${primary.reaction_id}`,
        {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({ reaction, created_at: nowPH }),
        }
      ).catch(() => null);

      if (!patchRes?.ok) {
        console.error("Reaction patch failed for message:", numMessageId);
        return json(
          { error: "Failed to update reaction." }, 502);
      }

      // Clean up any extraneous duplicate rows if present
      if (userReactions.length > 1) {
        await mapPool(userReactions.slice(1), async (item) => {
          await fetch(
            `${DIRECTUS_BASE}/items/vs_message_reaction/${item.reaction_id}`,
            { method: "DELETE", headers: getHeaders() }
          ).catch(() => null);
        });
      }
    } else {
      // User had no reaction on this message: insert new row
      const nowPH = getPHTimeString();
      const insertRes = await fetch(`${DIRECTUS_BASE}/items/vs_message_reaction`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          message_id: numMessageId,
          user_id: userId,
          reaction,
          created_at: nowPH,
        }),
      }).catch(() => null);

      if (!insertRes?.ok) {
        console.error(
          `Reaction insert failed (${insertRes?.status ?? "no response"}):`,
          insertRes ? await insertRes.text().catch(() => "") : ""
        );
        return json(
          { error: "Failed to add reaction." }, 502);
      }
    }

    // 3-4. Re-read and group the reactions so the client can replace its copy of
    // this message. The write above already committed, so a failed re-read must
    // not be answered with an empty list: the hook would wipe every emoji from
    // the bubble and the user would read their own saved reaction as reverted.
    // `reactions: null` means "unchanged, we could not tell you".
    let reactionGroups: Array<{
      reaction: string;
      count: number;
      users: { user_id: number; user_name: string }[];
      reacted_by_me: boolean;
    }> | null = null;
    let readBackWarning: string | null = null;

    try {
      const allReactions = await directusItems<DirectusReaction>(
        "vs_message_reaction",
        {
          query: `filter[message_id][_eq]=${numMessageId}&fields=reaction_id,message_id,user_id,reaction,created_at&sort[]=created_at&limit=-1`,
        }
      );

      const parseUid = (val: unknown): number => {
        if (val && typeof val === "object") {
          const obj = val as Record<string, unknown>;
          return Number(obj.user_id ?? obj.id ?? 0);
        }
        return Number(val ?? 0);
      };

      const userIds = Array.from(
        new Set(
          allReactions
            .map((r) => parseUid(r.user_id))
            .filter((id) => !isNaN(id) && id > 0)
        )
      );
      const usersMap = new Map<number, string>();

      if (userIds.length > 0) {
        // Batched: one `_in` list for every reactor overflows the URL, and a
        // short page would leave names unresolved. A failed name read only
        // costs labels, so fall back to the generic name rather than losing the
        // counts we just read.
        const users = await directusItemsWhereIn<DirectusUser>(
          "vs_user",
          "user_id",
          userIds,
          "user_id,user_fname,user_lname"
        ).catch((err: unknown) => {
          console.error("[reactions] Reactor names could not be read:", err);
          return [] as DirectusUser[];
        });
        for (const u of users) {
          const name = `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim() || "User";
          usersMap.set(Number(u.user_id), name);
        }
      }

      const groupedMap = new Map<
        string,
        { reaction: string; count: number; users: { user_id: number; user_name: string }[]; reacted_by_me: boolean }
      >();

      for (const r of allReactions) {
        if (!groupedMap.has(r.reaction)) {
          groupedMap.set(r.reaction, {
            reaction: r.reaction,
            count: 0,
            users: [],
            reacted_by_me: false,
          });
        }
        const g = groupedMap.get(r.reaction)!;
        const rUid = parseUid(r.user_id);
        g.count += 1;
        g.users.push({
          user_id: rUid,
          user_name: usersMap.get(rUid) || "User",
        });
        if (rUid === userId) {
          g.reacted_by_me = true;
        }
      }

      reactionGroups = Array.from(groupedMap.values());
    } catch (err: unknown) {
      console.error(`[reactions] Read-back failed for message #${numMessageId}:`, err);
      readBackWarning =
        "Your reaction was saved, but the reaction list could not be re-read, so it may look out of date until the thread is refreshed.";
    }

    return json({
      message_id: numMessageId,
      reactions: reactionGroups,
      ...(readBackWarning ? { warning: readBackWarning } : {}),
    });
  } catch (err: unknown) {
    console.error("POST /api/shared/messaging/messages/[messageId]/reactions error:", err);
    return json(
      { error: safeErrorMessage(err, "Internal server error") }, 500);
  }
}

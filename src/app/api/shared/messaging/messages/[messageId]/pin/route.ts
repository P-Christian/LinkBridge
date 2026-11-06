import { NextRequest } from "next/server";
import { json } from "@/lib/server/route";
import { authenticateRequest } from "@/lib/authenticated-session";
import { getPHTimeString } from "@/lib/utils";
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

// POST: Toggle pin/unpin on a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const msgIdNum = Number(messageId);
    if (!msgIdNum || isNaN(msgIdNum)) {
      return json({ error: "Invalid message ID." }, 400);
    }

    const session = await authenticateRequest(req);
    if (!session?.userId) {
      return json({ error: "Unauthorized." }, 401);
    }

    const userId = Number(session.userId);

    // Fetch the message to get its current pinned state and conversation_id
    const msgRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_message/${msgIdNum}?fields=message_id,conversation_id,is_pinned,pinned_by,pinned_at,is_deleted`,
      { headers: getHeaders(), cache: "no-store" }
    );

    // A read that failed is not a read that found nothing: answering 404 here
    // told a real participant, during a Directus blip, that their message or
    // their seat in the conversation did not exist.
    if (!msgRes.ok) {
      if (msgRes.status === 404) {
        return json({ error: "Message not found." }, 404);
      }
      console.error(`Message lookup failed for #${msgIdNum}: ${msgRes.status}`);
      return json(
        { error: "The message could not be read. Please try again." }, 502);
    }

    const msgJson = await msgRes.json().catch(() => null);
    const msgData = msgJson?.data;
    if (!msgData) {
      return json({ error: "Message not found." }, 404);
    }

    // Verify user is a member of the conversation
    const convId = msgData.conversation_id;
    const convRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_conversation/${convId}?fields=conversation_id,client_id,freelancer_id`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!convRes.ok) {
      if (convRes.status === 404) {
        return json({ error: "Conversation not found." }, 404);
      }
      console.error(`Conversation lookup failed for #${convId}: ${convRes.status}`);
      return json(
        { error: "The conversation could not be read. Please try again." }, 502);
    }

    const convJson = await convRes.json().catch(() => null);
    const convData = convJson?.data;
    if (!convData) {
      return json({ error: "Conversation not found." }, 404);
    }
    if (
      Number(convData.client_id) !== userId && Number(convData.freelancer_id) !== userId
    ) {
      return json(
        { error: "Forbidden: You are not a participant in this conversation." }, 403);
    }

    const now = getPHTimeString();
    let nextIsPinned = false;

    const existingPinRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_message_pin?filter[user_id][_eq]=${userId}&filter[message_id][_eq]=${msgIdNum}&fields=pin_id`,
      { headers: getHeaders(), cache: "no-store" }
    );

    // The legacy shared flag on vs_message is only for deployments where
    // vs_message_pin does not exist. Falling onto it after a *failed* read would
    // turn one participant's pin into a pin both participants see, and do it
    // without any signal that the two mechanisms had been swapped.
    const pinTableMissing = existingPinRes.status === 404 || existingPinRes.status === 403;
    if (!existingPinRes.ok && !pinTableMissing) {
      console.error(`Pin lookup failed for message #${msgIdNum}: ${existingPinRes.status}`);
      return json(
        { error: "The pin list could not be read, so the pin was not changed. Please try again." }, 502);
    }

    const existingPinJson = pinTableMissing
      ? null
      : await existingPinRes.json().catch(() => null);
    const existingPins = pinTableMissing
      ? null
      : Array.isArray(existingPinJson?.data)
        ? (existingPinJson.data as Array<{ pin_id: number }>)
        : null;

    if (!pinTableMissing && existingPins === null) {
      console.error(`Pin lookup returned an unreadable response for message #${msgIdNum}`);
      return json(
        { error: "The pin list could not be read, so the pin was not changed. Please try again." }, 502);
    }

    if (existingPins !== null) {
      if (existingPins.length > 0) {
        // Unpin (always allowed, even if the message was deleted)
        const deleteRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_message_pin/${existingPins[0].pin_id}`,
          { method: "DELETE", headers: getHeaders() }
        ).catch(() => null);
        if (deleteRes !== null && !deleteRes.ok && deleteRes.status !== 404) {
          console.error(
            `Pin delete failed (${deleteRes.status}):`,
            await deleteRes.text().catch(() => "")
          );
        }
        if (deleteRes === null || (!deleteRes.ok && deleteRes.status !== 404)) {
          return json(
            { error: "The pin could not be removed. Please try again." }, 502);
        }
        nextIsPinned = false;
      } else {
        // Creating a new pin is forbidden if the message is deleted
        if (msgData.is_deleted) {
          return json({ error: "Cannot pin a deleted message." }, 400);
        }

        // Pin: check the 25-pins-per-conversation limit from the real count. A
        // capped page of pin rows used to answer this, so a short read looked
        // like "under the limit" and a failed one looked like "no pins at all".
        const countRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_message_pin?filter[user_id][_eq]=${userId}&filter[conversation_id][_eq]=${convId}&aggregate[count]=pin_id`,
          { headers: getHeaders(), cache: "no-store" }
        );
        const countJson = await countRes.json().catch(() => null);
        const pinnedCount = Number(countJson?.data?.[0]?.count?.pin_id);
        if (!countRes.ok || !Number.isSafeInteger(pinnedCount)) {
          console.error(`Pin count failed for conversation #${convId}: ${countRes.status}`);
          return json(
            { error: "The current pin count could not be read, so the pin was not added. Please try again." }, 502);
        }
        if (pinnedCount >= 25) {
          return json(
            { error: "You can pin up to 25 messages per conversation." }, 400);
        }

        const createRes = await fetch(`${DIRECTUS_BASE}/items/vs_message_pin`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            message_id: msgIdNum,
            conversation_id: convId,
            user_id: userId,
            pinned_at: now,
          }),
        }).catch(() => null);
        if (createRes === null || !createRes.ok) {
          console.error(
            `Pin insert failed (${createRes?.status ?? "no response"}):`,
            createRes ? await createRes.text().catch(() => "") : ""
          );
          return json(
            { error: "The pin could not be saved. Please try again." }, 502);
        }
        nextIsPinned = true;
      }
    } else {
      // Legacy path: vs_message_pin is not installed in this deployment.
      const isCurrentlyPinned = Boolean(
        msgData.is_pinned && (Number(msgData.pinned_by) === userId || !msgData.pinned_by)
      );

      if (!isCurrentlyPinned && msgData.is_deleted) {
        return json({ error: "Cannot pin a deleted message." }, 400);
      }

      nextIsPinned = !isCurrentlyPinned;

      const patchRes = await fetch(`${DIRECTUS_BASE}/items/vs_message/${msgIdNum}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({
          is_pinned: nextIsPinned,
          pinned_at: nextIsPinned ? now : null,
          pinned_by: nextIsPinned ? userId : null,
        }),
      });

      if (!patchRes.ok) {
        const err = await patchRes.text().catch(() => "");
        console.error("Directus pin message error:", err);
        return json({ error: "Failed to update pin status." }, 500);
      }
    }

    return json({
      success: true,
      message_id: msgIdNum,
      is_pinned: nextIsPinned,
      pinned_at: nextIsPinned ? now : null,
      pinned_by: nextIsPinned ? userId : null,
    });
  } catch (err: unknown) {
    const message = safeErrorMessage(err, "Internal server error");
    console.error("Error in POST /api/shared/messaging/messages/[messageId]/pin:", message);
    return json({ error: message }, 500);
  }
}

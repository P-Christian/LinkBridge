import { NextRequest } from "next/server";
import { json } from "@/lib/server/route";
import { authenticateRequest } from "@/lib/authenticated-session";
import { getPHTimeString } from "@/lib/utils";
import { safeErrorMessage } from "@/lib/api-error";
import { mapPool } from "@/lib/server/pool";

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

// DELETE: Soft delete a message (Remove message)
export async function DELETE(
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

    // Look up the message to verify ownership
    const getRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_message/${msgIdNum}?fields=message_id,sender_id,conversation_id,is_deleted`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!getRes.ok) {
      return json({ error: "Message not found." }, 404);
    }

    const msgData = (await getRes.json()).data;
    if (!msgData) {
      return json({ error: "Message not found." }, 404);
    }

    // Only the sender can remove/delete their message
    if (Number(msgData.sender_id) !== userId) {
      return json(
        { error: "Forbidden: You can only remove your own messages." }, 403);
    }

    if (msgData.is_deleted) {
      return json({ success: true, message: "Message already deleted." });
    }

    // Clean up any pins for this message across all users
    try {
      const pinRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_message_pin?filter[message_id][_eq]=${msgIdNum}&fields=pin_id`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (pinRes.ok) {
        const pinData: Array<{ pin_id: number }> = (await pinRes.json()).data ?? [];
        await mapPool(
          pinData,
          (p) =>
            fetch(`${DIRECTUS_BASE}/items/vs_message_pin/${p.pin_id}`, {
              method: "DELETE",
              headers: getHeaders(),
            })
        );
      }
    } catch {
      // Ignore if vs_message_pin table does not exist
    }

    // Soft-delete in vs_message and clear pinned state
    const now = getPHTimeString();
    const patchRes = await fetch(`${DIRECTUS_BASE}/items/vs_message/${msgIdNum}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({
        is_deleted: true,
        deleted_at: now,
        deleted_by: userId,
        is_pinned: false,
        pinned_at: null,
        pinned_by: null,
      }),
    });

    if (!patchRes.ok) {
      const err = await patchRes.text();
      console.error("Directus soft-delete message error:", err);
      return json({ error: "Failed to delete message." }, 500);
    }

    return json({
      success: true,
      message_id: msgIdNum,
      deleted_at: now,
      deleted_by: userId,
      unpinned: true,
    });
  } catch (err: unknown) {
    const message = safeErrorMessage(err, "Internal server error");
    console.error("Error in DELETE /api/shared/messaging/messages/[messageId]:", message);
    return json({ error: message }, 500);
  }
}

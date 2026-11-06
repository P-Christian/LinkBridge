import { NextRequest } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { getPHTimeString } from "@/lib/utils";
import { json, toId } from "@/lib/server/route";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/$/,
  ""
);
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

// ─── PATCH — Archive / Unarchive conversation (client-side only) ───────────

export async function PATCH(
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
    if (!session) {
      return json({ error: "Unauthorized." }, 401);
    }

    if (session && !isClientSession(session)) {
      return json({ error: "Forbidden: employer access required." }, 403);
    }

    const userId = Number(session.userId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(
        { error: 'Invalid JSON body. Expected { "archive": boolean }.' }, 400);
    }

    const archiveValue: unknown =
      typeof body === "object" && body !== null && "archive" in body
        ? (body as { archive?: unknown }).archive
        : undefined;

    if (typeof archiveValue !== "boolean") {
      return json(
        { error: 'Invalid request body. Expected { "archive": boolean }.' },
        400
      );
    }

    const archive: boolean = archiveValue;

    // Verify ownership
    const convRes = await fetch(
      // archived_by_freelancer is read here because the single archived_at column
      // is shared by both participants.
      `${DIRECTUS_BASE}/items/vs_conversation/${convId}?fields=conversation_id,client_id,archived_by_freelancer`,
      { headers: getHeaders(), cache: "no-store" }
    );

    if (!convRes.ok) {
      // This read decides who may write, so an outage must not be reported as a
      // conversation that does not exist.
      return json(
        {
          error:
            convRes.status === 404
              ? "Conversation not found."
              : "The conversation could not be verified.",
        }, convRes.status === 404 ? 404 : 502);
    }

    const convJson = await convRes.json();
    const conv = convJson.data;

    if (Number(conv?.client_id) !== userId) {
      return json({ error: "Forbidden." }, 403);
    }

    const nowPH = getPHTimeString();
    // Clearing the shared stamp when only the freelancer has unarchived would
    // wipe the date the thread was archived for, which the other side still sees.
    const clearStamp = !archive && !conv?.archived_by_freelancer;

    const patchRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_conversation/${convId}`,
      {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({
          archived_by_client: archive,
          ...(clearStamp ? { archived_at: null } : archive ? { archived_at: nowPH } : {}),
        }),
      }
    );

    if (!patchRes.ok) {
      const text = await patchRes.text();
      console.error("Archive patch error:", text);
      return json(
        { error: "Failed to update conversation." }, patchRes.status);
    }

    return json({
      success: true,
      archived: archive,
    });
  } catch (err: unknown) {
    console.error("PATCH /api/client/messaging/[id]/archive error:", err);
    return json(
      { error: safeErrorMessage(err, "Internal server error") }, 500);
  }
}

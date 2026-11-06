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

// POST: Report an abusive/scam message or conversation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const msgIdNum = Number(messageId);

    const session = await authenticateRequest(req);
    if (!session?.userId) {
      return json({ error: "Unauthorized." }, 401);
    }

    const reporterUserId = Number(session.userId);

    const body = await req.json().catch(() => ({}));
    const { reason_code, report_details, conversation_id, reported_user_id } = body;

    // Validate reason_code against allowed enum
    const ALLOWED_REASONS = [
      "SPAM",
      "HARASSMENT",
      "INAPPROPRIATE_CONTENT",
      "FRAUD_OR_SCAM",
      "OFF_PLATFORM_PAYMENT",
      "HATE_SPEECH",
      "OTHER",
    ];
    if (!reason_code || !ALLOWED_REASONS.includes(reason_code)) {
      return json({ error: "A valid report reason is required." }, 400);
    }

    let targetMessageId = msgIdNum > 0 ? msgIdNum : 0;
    // Body ids are only a hint; the conversation is always resolved from stored
    // data so a caller cannot point a report at a thread it isn't part of.
    let targetConversationId = Number(conversation_id) > 0 ? Number(conversation_id) : 0;
    let targetReportedUserId =
      Number(reported_user_id) > 0 ? Number(reported_user_id) : 0;

    // If messageId is provided, its own conversation wins over the body value.
    if (targetMessageId > 0) {
      const msgRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_message/${targetMessageId}?fields=message_id,conversation_id,sender_id`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (!msgRes.ok) {
        return json({ error: "Message not found." }, 404);
      }
      const msgData = (await msgRes.json())?.data;
      if (!msgData) {
        return json({ error: "Message not found." }, 404);
      }
      targetConversationId = Number(msgData.conversation_id);
      if (!targetReportedUserId && Number(msgData.sender_id) !== reporterUserId) {
        targetReportedUserId = Number(msgData.sender_id);
      }
    }

    if (!targetConversationId || targetConversationId <= 0) {
      return json(
        { error: "Cannot submit report: invalid conversation ID." }, 400);
    }

    // Membership gate: only the two parties of the thread may report in it.
    const convRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_conversation/${targetConversationId}?fields=conversation_id,client_id,freelancer_id`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (!convRes.ok) {
      return json({ error: "Conversation not found." }, 404);
    }
    const convData = (await convRes.json())?.data;
    if (
      !convData ||
      (Number(convData.client_id) !== reporterUserId &&
        Number(convData.freelancer_id) !== reporterUserId)
    ) {
      return json(
        { error: "Forbidden: You are not a participant in this conversation." }, 403);
    }
    const counterpartId =
      reporterUserId === Number(convData.client_id)
        ? Number(convData.freelancer_id)
        : Number(convData.client_id);

    // If reporting a conversation (messageId = 0 or missing), resolve the latest message_id
    if (!targetMessageId) {
      const msgRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_message?filter[conversation_id][_eq]=${targetConversationId}&sort=-message_id&limit=1&fields=message_id,sender_id`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (!msgRes.ok) {
        return json(
          { error: "Cannot submit report: no valid message found in this conversation." }, 400);
      }
      const list = (await msgRes.json())?.data ?? [];
      if (list.length > 0) {
        targetMessageId = Number(list[0].message_id);
        if (!targetReportedUserId && Number(list[0].sender_id) !== reporterUserId) {
          targetReportedUserId = Number(list[0].sender_id);
        }
      }
    }

    if (!targetMessageId || targetMessageId <= 0) {
      return json(
        { error: "Cannot submit report: no valid message found in this conversation." }, 400);
    }

    // A two-party thread has exactly one reportable user: the other participant.
    if (targetReportedUserId !== counterpartId) targetReportedUserId = counterpartId;

    if (!targetReportedUserId || targetReportedUserId <= 0) {
      return json(
        { error: "Cannot submit report: could not resolve reported user." }, 400);
    }

    const now = getPHTimeString();

    // Prepare report payload matching vs_message_report schema
    const reportPayload: Record<string, unknown> = {
      message_id: targetMessageId,
      conversation_id: targetConversationId,
      reporter_user_id: reporterUserId,
      reported_user_id: targetReportedUserId,
      reason_code,
      report_details: report_details?.trim() || null,
      status: "PENDING",
      created_at: now,
    };

    // Post to Directus vs_message_report
    const postRes = await fetch(`${DIRECTUS_BASE}/items/vs_message_report`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(reportPayload),
    });

    if (!postRes.ok) {
      const errText = await postRes.text();
      // Handle unique constraint (user already reported this message)
      if (
        errText.includes("RECORD_NOT_UNIQUE") ||
        errText.includes("Duplicate entry") ||
        errText.includes("uq_msg_report_user")
      ) {
        return json({
          success: true,
          message: "You have already submitted a report for this conversation or message.",
        });
      }
      console.error("Directus vs_message_report insert failed:", errText);
      return json(
        { error: "Failed to submit report. Please try again later." }, postRes.status >= 400 && postRes.status < 600 ? postRes.status : 500);
    }

    return json({
      success: true,
      message: "Thank you. Your report has been submitted and will be reviewed by our moderation team.",
    });
  } catch (err: unknown) {
    const message = safeErrorMessage(err, "Internal server error");
    console.error("Error in POST /api/shared/messaging/messages/[messageId]/report:", message);
    return json({ error: message }, 500);
  }
}

import { getPHTimeString } from "@/lib/utils";

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

export interface CreateSystemMessageParams {
  clientId: number;
  freelancerId: number;
  jobId?: number | null;
  text: string;
  senderId?: number;
  /** When provided, also inserts a row into vs_system_message */
  systemEventType?: string;
  applicationId?: number | null;
  interviewId?: number | null;
  stageHistoryId?: number | null;
}

/**
 * Creates or retrieves a conversation between clientId and freelancerId,
 * posts a SYSTEM message into vs_message, optionally writes structured
 * event metadata into vs_system_message, and updates last_message_at.
 */
export async function createSystemMessage({
  clientId,
  freelancerId,
  jobId,
  text,
  senderId,
  systemEventType,
  applicationId,
  interviewId,
  stageHistoryId,
}: CreateSystemMessageParams): Promise<void> {
  
  if (!DIRECTUS_BASE) return;

  try {
    const nowPH = getPHTimeString();

    // 1. Check existing conversation
    let filter = `filter[client_id][_eq]=${clientId}&filter[freelancer_id][_eq]=${freelancerId}&filter[status][_neq]=BLOCKED`;
    if (jobId) {
      filter += `&filter[job_id][_eq]=${jobId}`;
    }

    const checkRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_conversation?${filter}&limit=1&fields=conversation_id`,
      { headers: getHeaders(), cache: "no-store" }
    );

    let conversationId: number | null = null;

    // "Could not read" is not "no thread exists". Answering the second
    // interpretation here opened a duplicate conversation for the same
    // client/freelancer/job pair, splitting the chat history in two. The thread
    // is retried by the next event once the read works again.
    if (!checkRes.ok) {
      console.error(
        `[system-message] Existing conversation lookup failed (${checkRes.status}); not creating a thread.`
      );
      return;
    }

    const checkJson = await checkRes.json();
    conversationId = checkJson.data?.[0]?.conversation_id ?? null;

    // 2. Create conversation if it doesn't exist
    if (!conversationId) {
      const createRes = await fetch(`${DIRECTUS_BASE}/items/vs_conversation`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          client_id: clientId,
          freelancer_id: freelancerId,
          job_id: jobId ?? null,
          conversation_type: jobId ? "JOB_APPLICATION" : "DIRECT_MESSAGE",
          status: "ACTIVE",
          archived_by_client: false,
          archived_by_freelancer: false,
          last_message_at: nowPH,
        }),
      });

      if (createRes.ok) {
        const createJson = await createRes.json().catch(() => null);
        conversationId = createJson?.data?.conversation_id ?? null;
        if (conversationId === null) {
          console.error(
            "[system-message] The conversation insert returned no id, so this event was not delivered."
          );
        }
      } else {
        const errText = await createRes.text().catch(() => "");
        console.error(
          `[system-message] Conversation insert failed (${createRes.status}): ${errText}`
        );
      }
    }

    if (!conversationId) return;

    // 3. Insert SYSTEM message into vs_message
    const effectiveSenderId = senderId ?? clientId;

    const msgRes = await fetch(`${DIRECTUS_BASE}/items/vs_message`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        conversation_id: conversationId,
        sender_id: effectiveSenderId,
        message_type: "SYSTEM",
        message_content: text,
        created_at: nowPH,
        is_edited: false,
        is_deleted: false,
      }),
    });

    // 3b. Insert structured event into vs_system_message (if event type provided)
    if (!msgRes.ok) {
      const errText = await msgRes.text().catch(() => "");
      console.error(
        `[system-message] SYSTEM message insert failed (${msgRes.status}): ${errText}`
      );
      // Bumping last_message_at for a message that does not exist would move the
      // thread to the top of the list on the strength of nothing.
      return;
    }

    if (systemEventType) {
      const msgJson = await msgRes.json().catch(() => null);
      const messageId = msgJson?.data?.message_id ?? null;
      if (!messageId) {
        console.error(
          "[system-message] The SYSTEM insert returned no message id, so the event card was not written."
        );
      } else {
        const smRes = await fetch(`${DIRECTUS_BASE}/items/vs_system_message`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            message_id: messageId,
            event_type: systemEventType,
            application_id: applicationId ?? null,
            interview_id: interviewId ?? null,
            stage_history_id: stageHistoryId ?? null,
          }),
        }).catch((e) => {
          console.error("Error inserting vs_system_message:", e);
          return null;
        });
        if (smRes !== null && !smRes.ok) {
          // The plain text still landed; only the application/interview card is
          // missing, so the chat reads as a message without its context.
          console.error(
            `[system-message] Event card insert failed (${smRes.status}) for message #${messageId}.`
          );
        }
      }
    }

    // 4. Update vs_conversation last_message_at
    await fetch(`${DIRECTUS_BASE}/items/vs_conversation/${conversationId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ last_message_at: nowPH }),
    });
  } catch (err) {
    console.error("Error creating system message:", err);
  }
}

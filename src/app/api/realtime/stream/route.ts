// src/app/api/realtime/stream/route.ts

import { NextRequest } from "next/server";
import { json } from "@/lib/server/route";
import { authenticateRequest } from "@/lib/authenticated-session";
import { safeDecryptMessage } from "@/lib/message-encryption";
import {
  directusWsRelay,
  ensureDirectusRelayStarted,
  pickFields,
  RelayEventPayload,
  RelayState,
  resolveSenderName,
  resolveUserCompanyIds,
  SSE_MESSAGE_FIELDS,
  SSE_REACTION_FIELDS,
} from "@/lib/realtime/directus-ws-relay";

import { safeErrorMessage } from "@/lib/api-error";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sameId(value: unknown, userId: string | number): boolean {
  return value !== null && value !== undefined && String(value) === String(userId);
}

// The relay flattens conversation participants onto both messages and reactions
function isConversationMember(
  rec: Record<string, unknown>,
  userId: string | number
): boolean {
  return sameId(rec.client_id, userId) || sameId(rec.freelancer_id, userId);
}

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return json({ error: "Unauthorized session" }, 401);
    }

    // Ensure backend WebSocket connection to Directus is active
    ensureDirectusRelayStarted();

    const encoder = new TextEncoder();
    let cleanupListener: (() => void) | null = null;
    let relayListener: (() => void) | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    const stream = new ReadableStream({
      start(controller) {
        // The browser's stream opening says nothing about the relay that has to
        // feed it: a relay that never authenticated with Directus still let every
        // portal report a live connection while no event could arrive. State is
        // sent with the handshake and re-sent whenever it changes.
        const sendRelayState = (state: RelayState) => {
          try {
            controller.enqueue(
              encoder.encode(`event: relay\ndata: ${JSON.stringify({ relay: state })}\n\n`)
            );
          } catch {
            // Client already gone; the abort handler cleans up.
          }
        };

        // 1. Initial connection acknowledgment frame
        controller.enqueue(
          encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "connected", userId: session.userId, relay: directusWsRelay.status })}\n\n`)
        );
        relayListener = directusWsRelay.onStateChange(sendRelayState);

        // 2. 20-second heartbeat to prevent proxy/tunnel idle drops (Tailscale, Nginx)
        heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": ping\nevent: ping\ndata: {}\n\n"));
          } catch {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
          }
        }, 20000);

        // 3. Listen to real-time events from the Directus relay.
        // Every collection is membership-scoped before enqueue; anything the
        // subscriber is not a participant of is dropped, including unknown collections.
        let companyIds: number[] | null = null;
        cleanupListener = directusWsRelay.onEvent(async (payload: RelayEventPayload) => {
          try {
            let records = payload.data;

            switch (payload.collection) {
              case "vs_message":
              case "vs_message_reaction":
                records = records.filter((rec) =>
                  isConversationMember(rec, session.userId)
                );
                break;
              case "vs_freelancer_notification":
              case "vs_employer_notification":
              case "vs_job_application":
                records = records.filter((rec) =>
                  sameId(rec.user_id, session.userId)
                );
                break;
              case "vs_interview": {
                if (companyIds === null) {
                  companyIds = await resolveUserCompanyIds(session.userId);
                }
                const owned = companyIds;
                records = records.filter(
                  (rec) =>
                    sameId(rec.interviewer_user_id, session.userId) ||
                    owned.includes(Number(rec.company_id))
                );
                break;
              }
              default:
                return;
            }

            if (records.length === 0) return;

            // Decrypt and name-resolve only the rows this subscriber may read
            if (payload.collection === "vs_message") {
              records = await Promise.all(
                records.map(async (rec) => {
                  const row = { ...rec };
                  if (!row.sender_name && row.sender_id != null) {
                    const name = await resolveSenderName(Number(row.sender_id));
                    if (name) row.sender_name = name;
                  }
                  if (typeof row.message_content === "string") {
                    row.message_content =
                      safeDecryptMessage(row.message_content) ?? row.message_content;
                  }
                  return row;
                })
              );
              // Membership scoping above read the raw row; the browser only
              // ever gets the REST message DTO's fields — not the participant
              // IDs used for scoping, nor columns like deleted_at/deleted_by.
              records = records.map((rec) => pickFields(rec, SSE_MESSAGE_FIELDS));
            } else if (payload.collection === "vs_message_reaction") {
              // Same rule for reactions: scoping columns never leave the server.
              records = records.map((rec) => pickFields(rec, SSE_REACTION_FIELDS));
            }

            const ssePayload = {
              collection: payload.collection,
              event: payload.event,
              data: records,
            };

            const frame = `data: ${JSON.stringify(ssePayload)}\n\n`;

            // Enqueue gets its own guard: a closed client is expected on every
            // navigation, but the checks above can fail for real reasons
            // (Directus unreachable during name resolution) and dropping the
            // batch then has to leave a trace.
            try {
              controller.enqueue(encoder.encode(frame));
            } catch {
              // Client closed stream
            }
          } catch (err) {
            console.error(
              `[realtime] Could not prepare ${payload.collection}/${payload.event} frame:`,
              err
            );
          }
        });

        // Clean up on client abort
        req.signal.addEventListener("abort", () => {
          if (cleanupListener) cleanupListener();
          if (relayListener) relayListener();
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          try {
            controller.close();
          } catch {}
        });
      },
      cancel() {
        if (cleanupListener) cleanupListener();
        if (relayListener) relayListener();
        if (heartbeatInterval) clearInterval(heartbeatInterval);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    const message = safeErrorMessage(error, "Internal Error");
    return json({ error: message }, 500);
  }
}

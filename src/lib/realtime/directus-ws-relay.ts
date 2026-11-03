// src/lib/realtime/directus-ws-relay.ts

import { EventEmitter } from "events";

export type RelayState = "connecting" | "connected" | "down";

export interface RelayEventPayload {
  collection: string;
  event: string;
  data: Record<string, unknown>[];
}

const COLLECTION_QUERY_FIELDS: Record<string, string[]> = {
  vs_message: [
    "message_id",
    "conversation_id",
    "sender_id",
    "message_type",
    "message_content",
    "is_edited",
    "edited_at",
    "created_at",
    "is_deleted",
    "deleted_at",
    "deleted_by",
    "reply_to_message_id",
    "is_pinned",
    "pinned_at",
    "pinned_by",
    // Participant IDs for server-side SSE scoping — resolved via relational query
    "conversation_id.client_id",
    "conversation_id.freelancer_id",
    // Sender user information for notifications — resolved via relational query
    "sender_id.user_id",
    "sender_id.user_fname",
    "sender_id.user_lname",
  ],
  vs_message_reaction: [
    "reaction_id",
    "message_id",
    "user_id",
    "reaction",
    "created_at",
    // Owning conversation participants for server-side SSE scoping
    "message_id.conversation_id.client_id",
    "message_id.conversation_id.freelancer_id",
  ],
  vs_freelancer_notification: [
    "notification_id",
    "user_id",
    "event_id",
    "category",
    "title",
    "message",
    "action_url",
    "is_read",
    "is_starred",
    "created_at",
  ],
  vs_employer_notification: [
    "notification_id",
    "user_id",
    "event_id",
    "category",
    "title",
    "message",
    "action_url",
    "is_read",
    "is_starred",
    "created_at",
  ],
  vs_interview: [
    "interview_id",
    "company_id",
    "interviewer_user_id",
    "scheduled_at",
    "interview_status",
    "created_at",
    "updated_at",
  ],
  vs_job_application: [
    "application_id",
    "job_id",
    "user_id",
    "application_status",
    "applied_at",
    "status_updated_at",
  ],
};

const SUBSCRIBED_COLLECTIONS = [
  "vs_message",
  "vs_message_reaction",
  "vs_freelancer_notification",
  "vs_employer_notification",
  "vs_interview",
  "vs_job_application",
];

const userSenderNameCache = new Map<number, string>();

export async function resolveSenderName(userId: number): Promise<string | null> {
  if (userSenderNameCache.has(userId)) return userSenderNameCache.get(userId)!;
  try {
    const raw =
      process.env.DIRECTUS_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:8055";
    const base = raw.replace(/\/$/, "");
    const token =
      process.env.DIRECTUS_STATIC_TOKEN?.trim() ||
      process.env.WEBSOCKET_ACCESS_TOKEN?.trim() ||
      "";
    const res = await fetch(
      `${base}/items/vs_user/${userId}?fields=user_fname,user_lname`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      }
    );
    if (res.ok) {
      const json = await res.json();
      const u = json.data;
      if (u) {
        const fname = typeof u.user_fname === "string" ? u.user_fname.trim() : "";
        const lname = typeof u.user_lname === "string" ? u.user_lname.trim() : "";
        const fullName = `${fname} ${lname}`.trim();
        if (fullName) {
          userSenderNameCache.set(userId, fullName);
          return fullName;
        }
      }
    }
  } catch (err) {
    console.error("[DirectusRelay] Failed to resolve sender name for userId", userId, err);
  }
  return null;
}

/**
 * Company IDs the user belongs to. Used to scope vs_interview events to the
 * employer side of the conversation; returns [] for non-company users.
 */
export async function resolveUserCompanyIds(
  rawUserId: string | number
): Promise<number[]> {
  const userId = Number(rawUserId);
  if (!Number.isSafeInteger(userId) || userId <= 0) return [];
  try {
    const raw =
      process.env.DIRECTUS_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:8055";
    const base = raw.replace(/\/$/, "");
    const token =
      process.env.DIRECTUS_STATIC_TOKEN?.trim() ||
      process.env.WEBSOCKET_ACCESS_TOKEN?.trim() ||
      "";
    const res = await fetch(
      // Every membership, not the first 50: an employer on more companies than
      // this would silently never see interview events for the rest.
      `${base}/items/vs_company_user?filter[user_id][_eq]=${userId}&filter[status][_eq]=ACTIVE&fields=company_id&limit=-1`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      }
    );
    if (res.ok) {
      const json = await res.json();
      const rows = Array.isArray(json.data) ? (json.data as Record<string, unknown>[]) : [];
      return rows
        .map((row) => Number(row.company_id))
        .filter((id) => Number.isSafeInteger(id) && id > 0);
    }
  } catch (err) {
    console.error("[DirectusRelay] Failed to resolve company ids for userId", userId, err);
  }
  return [];
}

class DirectusWsRelay {
  private ws: WebSocket | null = null;
  private emitter = new EventEmitter();
  private isConnecting = false;
  private isConnected = false;
  private state: RelayState = "down";
  private retryCount = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  /**
   * The data plane's real health. Every SSE subscriber used to be told
   * `status: "connected"` as soon as the browser's own stream opened, so a relay
   * that never authenticated with Directus looked live to every portal while no
   * event could ever arrive.
   */
  public get status(): RelayState {
    return this.state;
  }

  public onStateChange(listener: (state: RelayState) => void): () => void {
    this.emitter.on("state", listener);
    return () => {
      this.emitter.off("state", listener);
    };
  }

  private setState(next: RelayState, detail: string) {
    if (this.state === next) return;
    this.state = next;
    console.log(`[DirectusRelay] State → ${next} (${detail})`);
    this.emitter.emit("state", next);
  }

  public onEvent(listener: (payload: RelayEventPayload) => void): () => void {
    this.emitter.on("event", listener);
    return () => {
      this.emitter.off("event", listener);
    };
  }

  public start() {
    // `ws`/`reconnectTimeout` as well as the flags: a rejected handshake leaves
    // both booleans false, so every new SSE request used to open yet another
    // socket while the pending reconnect was already scheduled.
    if (this.ws || this.reconnectTimeout) return;
    if (this.isConnected || this.isConnecting) return;
    this.connect();
  }

  private getWebSocketUrl(): string {
    const raw =
      process.env.DIRECTUS_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:8055";

    const clean = raw.replace(/\/$/, "");
    const isSsl = clean.startsWith("https://") || clean.startsWith("wss://");
    const proto = isSsl ? "wss://" : "ws://";
    const host = clean.replace(/^(?:https?|wss?):\/\//, "");
    return `${proto}${host}/websocket`;
  }

  private connect() {
    this.isConnecting = true;
    this.setState("connecting", "opening WebSocket");
    const url = this.getWebSocketUrl();
    const token =
      process.env.WEBSOCKET_ACCESS_TOKEN?.trim() ||
      process.env.DIRECTUS_STATIC_TOKEN?.trim() ||
      "";

    try {
      console.log("[DirectusRelay] Connecting server WebSocket to:", url);
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.isConnecting = false;
        console.log("[DirectusRelay] WebSocket OPENED. Sending Directus auth handshake...");
        ws.send(JSON.stringify({ type: "auth", access_token: token }));
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(String(event.data));

          // Directus closes any socket that stops answering its ping frames (~30s
          // after the first one), which used to drop this relay once a minute.
          if (msg.type === "ping") {
            this.ws?.send(JSON.stringify({ type: "pong" }));
            return;
          }

          if (msg.type === "auth") {
            if (msg.status === "ok") {
              this.isConnected = true;
              // Reset the backoff only once authentication is confirmed: an
              // open-but-rejected socket used to restart it at the 2s floor and
              // hammer Directus forever.
              this.retryCount = 0;
              this.setState("connected", "authenticated");
              console.log("[DirectusRelay] ✅ Authenticated with Directus WebSocket.");
              this.subscribeAll();
            } else {
              // Directus answers the failed handshake and leaves the socket up.
              // Without closing it here the relay wedged: no events, no reconnect
              // timer, and every portal still looked live.
              this.isConnected = false;
              this.setState("down", `auth rejected: ${String(msg.error ?? "unknown")}`);
              console.error("[DirectusRelay] ❌ Authentication failed:", msg.error);
              try {
                ws.close();
              } catch {}
            }
            return;
          }

          if (msg.type === "subscription" && msg.data) {
            let collection = msg.collection || "";
            if (!collection && msg.uid) {
              collection = msg.uid
                .replace(/^sub_/, "")
                .replace(/_(?:create|update|delete|init)$/, "");
            }

            const records = Array.isArray(msg.data)
              ? (msg.data as Record<string, unknown>[])
              : [];
            const eventType = msg.event || "update";

            // Flatten conversation participant IDs and resolve sender_name for vs_message records.
            // message_content stays encrypted here — the SSE route decrypts only the rows a
            // membership filter has already allowed through to that subscriber.
            if (collection === "vs_message") {
              for (const rec of records) {
                // Flatten nested relation: conversation_id: { client_id, freelancer_id }
                if (rec.conversation_id && typeof rec.conversation_id === "object") {
                  const conv = rec.conversation_id as Record<string, unknown>;
                  rec.client_id = conv.client_id ?? null;
                  rec.freelancer_id = conv.freelancer_id ?? null;
                  // Replace the nested object with just the numeric ID if present
                  if (typeof conv.conversation_id === "number") {
                    rec.conversation_id = conv.conversation_id;
                  }
                }
                // Resolve sender name and normalize sender_id
                if (rec.sender_id && typeof rec.sender_id === "object") {
                  const sender = rec.sender_id as Record<string, unknown>;
                  const fname = typeof sender.user_fname === "string" ? sender.user_fname.trim() : "";
                  const lname = typeof sender.user_lname === "string" ? sender.user_lname.trim() : "";
                  const fullName = `${fname} ${lname}`.trim();
                  if (fullName) {
                    rec.sender_name = fullName;
                    if (typeof sender.user_id === "number") {
                      userSenderNameCache.set(sender.user_id, fullName);
                    }
                  }
                  if (sender.user_id !== undefined) {
                    rec.sender_id = sender.user_id;
                  }
                } else if (typeof rec.sender_id === "number") {
                  if (userSenderNameCache.has(rec.sender_id)) {
                    rec.sender_name = userSenderNameCache.get(rec.sender_id);
                  } else {
                    const resolved = await resolveSenderName(rec.sender_id);
                    if (resolved) {
                      rec.sender_name = resolved;
                    }
                  }
                }
              }
            }

            // Flatten the owning conversation's participants for vs_message_reaction records
            if (collection === "vs_message_reaction") {
              for (const rec of records) {
                if (rec.message_id && typeof rec.message_id === "object") {
                  const msg = rec.message_id as Record<string, unknown>;
                  const conv =
                    msg.conversation_id && typeof msg.conversation_id === "object"
                      ? (msg.conversation_id as Record<string, unknown>)
                      : {};
                  rec.client_id = conv.client_id ?? null;
                  rec.freelancer_id = conv.freelancer_id ?? null;
                  if (typeof msg.message_id === "number") {
                    rec.message_id = msg.message_id;
                  }
                }
              }
            }

            if (collection && records.length > 0) {
              this.emitter.emit("event", {
                collection,
                event: eventType,
                data: records,
              });
            }
          }
        } catch (e) {
          console.error("[DirectusRelay] Error parsing WebSocket frame:", e);
        }
      };

      ws.onerror = (err) => {
        console.error("[DirectusRelay] WebSocket error:", err);
      };

      ws.onclose = (evt) => {
        this.isConnecting = false;
        this.isConnected = false;
        this.ws = null;
        this.setState("down", `closed (code: ${evt.code}, reason: ${evt.reason || "none"})`);
        console.warn(`[DirectusRelay] WebSocket CLOSED (code: ${evt.code}, reason: ${evt.reason || "none"})`);

        const delay = Math.min(30000, 2000 * Math.pow(1.5, this.retryCount));
        this.retryCount++;
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          this.reconnectTimeout = null;
          this.connect();
        }, delay);
      };
    } catch (e) {
      this.isConnecting = false;
      this.isConnected = false;
      this.setState("down", `constructor threw: ${String(e)}`);
      console.error("[DirectusRelay] Exception starting WebSocket:", e);
    }
  }

  public destroy() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
    if (this.ws) {
      // Detach first: the close event used to schedule a fresh reconnect from a
      // relay that hot-reload had already thrown away, so the dev server kept a
      // socket churning against a singleton nothing listened to.
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.setState("down", "destroyed");
    this.emitter.removeAllListeners();
  }

  public subscribeAll() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    SUBSCRIBED_COLLECTIONS.forEach((collection) => {
      const fields = COLLECTION_QUERY_FIELDS[collection] || ["id"];
      const events = ["create", "update"];

      events.forEach((event) => {
        this.ws?.send(
          JSON.stringify({
            type: "subscribe",
            collection,
            event,
            query: { fields },
            uid: `sub_${collection}_${event}`,
          })
        );
      });
    });
    console.log("[DirectusRelay] 📡 Subscriptions registered for all target collections.");
  }
}

// Preserve singleton across Next.js hot module reloads
const globalForRelay = globalThis as unknown as {
  __directusWsRelay?: DirectusWsRelay;
};

// In development, reset stale singleton on hot-reload so updated subscriptions take effect
if (process.env.NODE_ENV !== "production" && globalForRelay.__directusWsRelay) {
  try {
    globalForRelay.__directusWsRelay.destroy();
  } catch {}
  delete globalForRelay.__directusWsRelay;
}

export const directusWsRelay =
  globalForRelay.__directusWsRelay ?? new DirectusWsRelay();

if (process.env.NODE_ENV !== "production") {
  globalForRelay.__directusWsRelay = directusWsRelay;
}

export function ensureDirectusRelayStarted() {
  directusWsRelay.start();
  directusWsRelay.subscribeAll();
}

"use client";

// src/modules/shared/providers/RealtimeProvider.tsx

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { usePushNotifications } from "../hooks/usePushNotifications";

function isAuthRoute(path: string | null): boolean {
  if (!path) return false;
  return (
    path === "/login" ||
    path.startsWith("/login/") ||
    path === "/signup" ||
    path.startsWith("/signup/") ||
    path === "/forgot-password" ||
    path.startsWith("/forgot-password/") ||
    path === "/student-register" ||
    path.startsWith("/student-register/") ||
    path === "/school-register" ||
    path.startsWith("/school-register/") ||
    path.startsWith("/auth/")
  );
}

export type RealtimeEventType = "create" | "update" | "delete" | "init";

export interface RealtimeMessage {
  collection: string;
  event: RealtimeEventType;
  data: Record<string, unknown>[];
}

export type RealtimeCallback = (data: {
  collection: string;
  event: RealtimeEventType;
  data: Record<string, unknown>[];
}) => void;

interface RealtimeContextType {
  isConnected: boolean;
  subscribe: (collection: string, callback: RealtimeCallback) => () => void;
  sendCustom: (payload: Record<string, unknown>) => void;
  reconnect: () => void;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
  subscribe: () => () => {},
  sendCustom: () => {},
  reconnect: () => {},
});

/**
 * Normalizes frontend subscription collection aliases to canonical Directus collection names.
 */
export function normalizeDirectusCollection(col: string): string {
  if (col === "vs_messages") return "vs_message";
  if (col === "vs_interview_schedule") return "vs_interview";
  return col;
}

// ─── Connection tuning ──────────────────────────────────────────────────────
const TOAST_ID = "realtime-status";
const HEARTBEAT_TIMEOUT_MS = 30000; // server pings every 20s + 10s grace
const RECONNECT_BASE_MS = 2000;
const RECONNECT_CAP_MS = 30000;
const STREAM_REJECTED_AFTER_FAILURES = 3;
const PROBE_TIMEOUT_MS = 4000;
const PROBE_CACHE_MS = 5000;
const CONNECT_PROBE_AFTER_MS = 5000; // a stream still connecting after this gets a probe
const CONNECT_HARD_TIMEOUT_MS = 20000;
const RESYNC_MIN_GAP_MS = 15000;
const USER_RESYNC_MIN_GAP_MS = 5000;

type ConnStatus = "connected" | "no-internet" | "server-unreachable" | "updates-off";
type ProbeResult = "ok" | "server-unreachable";

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Ensure Service Worker is registered automatically across the entire app
  usePushNotifications();

  // Derived, not the raw pathname: the stream must survive in-app navigation, so
  // only crossing into/out of an auth page may tear the EventSource down.
  const onAuthRoute = isAuthRoute(usePathname());

  const [isConnected, setIsConnected] = useState(false);

  const subscribersRef = useRef<Map<string, Set<RealtimeCallback>>>(new Map());
  // Tracks the authenticated user's ID received from the SSE connected frame
  const sessionUserIdRef = useRef<string | null>(null);
  // Set by the connection effect so `reconnect` always reaches the live engine
  const reconnectRef = useRef<() => void>(() => {});

  const notifySubscribers = useCallback(
    (collection: string, event: RealtimeEventType, data: Record<string, unknown>[]) => {
      // Notify the target collection as well as any known aliases
      const targetCollections = new Set<string>([collection]);
      if (collection === "vs_message") targetCollections.add("vs_messages");
      if (collection === "vs_messages") targetCollections.add("vs_message");
      if (collection === "vs_interview") targetCollections.add("vs_interview_schedule");
      if (collection === "vs_interview_schedule") targetCollections.add("vs_interview");

      targetCollections.forEach((col) => {
        const subs = subscribersRef.current.get(col);
        if (subs) {
          subs.forEach((cb) => {
            try {
              cb({ collection: col, event, data });
            } catch (err) {
              console.error(`Error in realtime subscriber for ${col}:`, err);
            }
          });
        }
      });
    },
    []
  );

  const handleIncomingStreamPayload = useCallback(
    (payload: RealtimeMessage) => {
      const { collection, event: eventType, data: records } = payload;
      if (!collection || !records) return;

      console.log(`📡 [Realtime Stream] Event on '${collection}' [${eventType}]:`, records);

      // If a reaction was updated, notify vs_message subscribers to refresh reaction counts
      if (collection === "vs_message_reaction") {
        notifySubscribers("vs_message", eventType, records);
        notifySubscribers("vs_messages", eventType, records);
      } else {
        notifySubscribers(collection, eventType, records);
      }

      if (eventType === "create" && records.length > 0) {
        records.forEach((rec) => {
          if (
            collection === "vs_freelancer_notification" ||
            collection === "vs_employer_notification"
          ) {
            const title = String(rec.title || "New Notification");
            const message = String(rec.message || "");
            toast.info(title, { description: message });

            if (
              typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              if (document.hidden) {
                new Notification(title, {
                  body: message,
                  icon: "/favicon.ico",
                });
              }
            }
          }

          if (collection === "vs_message" || collection === "vs_messages") {
            // Don't notify the sender about their own message
            const senderId = rec.sender_id;
            if (
              sessionUserIdRef.current !== null &&
              String(senderId) === sessionUserIdRef.current
            ) {
              return;
            }

            // Don't trigger user message notification for SYSTEM events
            if (rec.message_type === "SYSTEM") {
              return;
            }

            const senderName = rec.sender_name
              ? String(rec.sender_name).trim()
              : "";

            if (
              typeof window !== "undefined" &&
              !window.location.pathname.includes("/messaging")
            ) {
              if (senderName) {
                toast(`${senderName} sent a message`);
              } else if (senderId != null) {
                // Fallback check who sent the message if sender_name wasn't in event payload
                fetch(`/api/shared/users/lookup?id=${senderId}`)
                  .then((res) => res.json())
                  .then((data) => {
                    const resolvedName = data?.name ? String(data.name).trim() : "";
                    toast(
                      resolvedName
                        ? `${resolvedName} sent a message`
                        : "You received a new message"
                    );
                  })
                  .catch(() => {
                    toast("You received a new message");
                  });
              } else {
                toast("You received a new message");
              }
            }
          }


          if (collection === "vs_interview" || collection === "vs_interview_schedule") {
            const title = String(
              rec.title || rec.interview_title || "Interview Schedule Update"
            );
            toast.success(title, {
              description: "An interview schedule has been updated or created.",
            });
          }

          if (collection === "vs_job_application") {
            const status = String(rec.status || "");
            if (status) {
              toast.info(`Application Status: ${status}`, {
                description: "Your job application status was updated.",
              });
            }
          }
        });
      }
    },
    [notifySubscribers]
  );

  // ─── Connection engine ────────────────────────────────────────────────────
  // Everything below lives in one effect so its timers, flags and listeners share
  // one lifetime and are all torn down together (auth routes, unmount, StrictMode).
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (onAuthRoute) {
      toast.dismiss(TOAST_ID);
      reconnectRef.current = () => {};
      window.requestAnimationFrame(() => setIsConnected(false));
      return;
    }

    let disposed = false;
    let es: EventSource | null = null;
    let streamUp = false;

    // Conditions the visible status is derived from
    let serverDown = false;
    let relayDown = false;
    let streamRejected = false;

    let failCount = 0;
    let attempt = 0;
    let hasConnectedOnce = false;
    let sawFailure = false;
    let outageStart: number | null = null;

    let lastStatus: ConnStatus | null = null;
    let loadingToast = false;

    let lastResync = 0;
    let pendingResync = false;

    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let resyncTimer: ReturnType<typeof setTimeout> | null = null;
    let connectProbeTimer: ReturnType<typeof setTimeout> | null = null;
    let connectHardTimer: ReturnType<typeof setTimeout> | null = null;

    let probeCache: { at: number; result: ProbeResult } | null = null;
    let probeInflight: Promise<ProbeResult> | null = null;

    const isOnline = () => typeof navigator === "undefined" || navigator.onLine;

    const clearTimer = (t: ReturnType<typeof setTimeout> | null) => {
      if (t) clearTimeout(t);
      return null;
    };

    // ── Status and toasts ──
    // Only `navigator.onLine === false` ever means "no internet".
    const computeStatus = (): ConnStatus | "reconnecting" => {
      if (!isOnline()) return "no-internet";
      if (serverDown) return "server-unreachable";
      if (relayDown || streamRejected) return "updates-off";
      return streamUp ? "connected" : "reconnecting";
    };

    const showStatusToast = (status: ConnStatus) => {
      loadingToast = false;
      switch (status) {
        case "no-internet":
          toast.error("No internet connection. Check your network. We'll reconnect automatically.", {
            id: TOAST_ID,
            duration: Infinity,
          });
          break;
        case "server-unreachable":
          toast.warning("Can't reach LinkBridge right now. We'll keep trying, or you can retry now.", {
            id: TOAST_ID,
            duration: Infinity,
            action: {
              label: "Retry",
              onClick: (event) => {
                event.preventDefault(); // keep the toast so it can swap to the loading state
                retryNow();
              },
            },
          });
          break;
        case "updates-off":
          toast.warning(
            "Live updates are paused, so what you see may be out of date. We'll catch up automatically when they're back.",
            {
              id: TOAST_ID,
              duration: Infinity,
              action: {
                label: "Refresh data",
                onClick: (event) => {
                  event.preventDefault();
                  refreshData();
                },
              },
            }
          );
          break;
        case "connected":
          toast.success("Back online. Catching up on any changes…", {
            id: TOAST_ID,
            duration: 3000,
          });
          break;
      }
    };

    // A loading toast has no expiry, so every attempt must end by settling it.
    const settleLoadingToast = () => {
      if (!loadingToast) return;
      const status = computeStatus();
      if (status === "reconnecting") return; // still trying; the toast text is accurate
      if (status === "connected") {
        loadingToast = false;
        toast.dismiss(TOAST_ID);
        return;
      }
      showStatusToast(status);
    };

    const reportStatus = () => {
      const next = computeStatus();
      if (next === "reconnecting") return; // brief drop: stay quiet
      const prev = lastStatus;
      if (next === prev) {
        settleLoadingToast();
        return;
      }
      lastStatus = next;
      // A first, clean connect is silent
      if (next === "connected" && prev === null) return;
      showStatusToast(next);
    };

    // ── Probe: our own server only, never Directus ──
    const probe = (): Promise<ProbeResult> => {
      if (probeCache && Date.now() - probeCache.at < PROBE_CACHE_MS) {
        return Promise.resolve(probeCache.result);
      }
      if (probeInflight) return probeInflight;

      const run = (async (): Promise<ProbeResult> => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
        try {
          const res = await fetch("/api/health?probe=1", {
            cache: "no-store",
            redirect: "manual", // an auth redirect must not count as OK
            signal: ctrl.signal,
          });
          const body = res.ok ? ((await res.json()) as { server?: boolean }) : null;
          return body?.server === true ? "ok" : "server-unreachable";
        } catch {
          // Same-origin failure while the device is online means our server is the problem
          return "server-unreachable";
        } finally {
          clearTimeout(timer);
        }
      })();

      probeInflight = run;
      void run
        .then((result) => {
          probeCache = { at: Date.now(), result };
        })
        .finally(() => {
          probeInflight = null;
        });
      return run;
    };

    // ── Resync: at most one queued, spread out, wider after long outages ──
    const takeOutageMs = () => {
      const ms = outageStart ? Date.now() - outageStart : 0;
      outageStart = null;
      return ms;
    };

    const broadcastInit = () => {
      Array.from(subscribersRef.current.keys()).forEach((collection) => {
        notifySubscribers(collection, "init", []);
      });
    };

    const scheduleResync = (opts?: { user?: boolean; outageMs?: number }) => {
      if (disposed || resyncTimer) return; // at most one queued
      const gap = opts?.user ? USER_RESYNC_MIN_GAP_MS : RESYNC_MIN_GAP_MS;
      const jitterWindow = opts?.user
        ? 1000
        : Math.min(30000, Math.max(5000, (opts?.outageMs ?? 0) / 2));
      const cooldown = Math.max(0, lastResync + gap - Date.now());
      resyncTimer = setTimeout(() => {
        resyncTimer = null;
        if (document.hidden) {
          pendingResync = true;
          return;
        }
        lastResync = Date.now();
        broadcastInit();
        settleLoadingToast();
      }, cooldown + Math.random() * jitterWindow);
    };

    // ── Stream lifecycle ──
    const clearStreamTimers = () => {
      watchdogTimer = clearTimer(watchdogTimer);
      connectProbeTimer = clearTimer(connectProbeTimer);
      connectHardTimer = clearTimer(connectHardTimer);
    };

    const closeStream = () => {
      clearStreamTimers();
      if (es) {
        es.close();
        es = null;
      }
      streamUp = false;
    };

    const nextDelay = () => {
      const base = Math.min(RECONNECT_CAP_MS, RECONNECT_BASE_MS * 2 ** attempt++);
      return base + Math.random() * base * 0.5;
    };

    const scheduleReconnect = (delay?: number) => {
      if (disposed || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        openStream();
      }, delay ?? nextDelay());
    };

    const handleStreamFailure = async (source: EventSource) => {
      if (disposed || es !== source) return;
      // Close it ourselves so the browser's own retry never runs next to our backoff
      closeStream();
      setIsConnected(false);
      sawFailure = true;
      outageStart ??= Date.now();
      failCount += 1;

      if (!isOnline()) {
        reportStatus(); // the `online` event restarts the connection
        return;
      }

      const result = await probe();
      if (disposed) return;
      serverDown = result !== "ok";
      // Server reachable but the stream keeps being refused (401/500): a retry
      // loop cannot fix it, so say updates are off instead of "server unreachable".
      if (!serverDown) streamRejected = failCount >= STREAM_REJECTED_AFTER_FAILURES;
      reportStatus();

      if (!es) scheduleReconnect();
    };

    const resetWatchdog = (source: EventSource) => {
      watchdogTimer = clearTimer(watchdogTimer);
      if (!isOnline()) return;
      watchdogTimer = setTimeout(() => {
        console.warn("⚠️ [Realtime Stream] Heartbeat missed. Reconnecting quietly…");
        void handleStreamFailure(source);
      }, HEARTBEAT_TIMEOUT_MS);
    };

    // Returns whether the relay just changed state: "down", "up", or "same"
    const setRelay = (raw: unknown): "down" | "up" | "same" => {
      if (raw === "down") {
        if (relayDown) return "same";
        relayDown = true;
        sawFailure = true;
        outageStart ??= Date.now();
        return "down";
      }
      if (raw === "connected") {
        if (!relayDown) return "same";
        relayDown = false;
        return "up";
      }
      return "same";
    };

    function openStream() {
      if (disposed || es) return;

      if (!isOnline()) {
        sawFailure = true;
        outageStart ??= Date.now();
        reportStatus(); // the `online` event restarts the connection
        return;
      }

      console.log("🔌 [Realtime Stream] Connecting to SSE relay at /api/realtime/stream...");
      const source = new EventSource("/api/realtime/stream", { withCredentials: true });
      es = source;

      // A stream stuck connecting gets one probe, so a dead server is named early
      connectProbeTimer = setTimeout(async () => {
        if (es !== source || source.readyState === EventSource.OPEN || !isOnline()) return;
        const result = await probe();
        if (disposed || es !== source || result === "ok") return;
        serverDown = true;
        reportStatus();
      }, CONNECT_PROBE_AFTER_MS);
      connectHardTimer = setTimeout(() => {
        if (es === source && source.readyState !== EventSource.OPEN) {
          void handleStreamFailure(source);
        }
      }, CONNECT_HARD_TIMEOUT_MS);

      source.onopen = () => {
        if (es !== source) return;
        connectProbeTimer = clearTimer(connectProbeTimer);
        connectHardTimer = clearTimer(connectHardTimer);
        resetWatchdog(source);
      };

      // The connected frame carries the userId and the relay's health
      source.addEventListener("connected", (event: MessageEvent) => {
        if (es !== source) return;
        clearStreamTimers();
        resetWatchdog(source);

        streamUp = true;
        serverDown = false;
        streamRejected = false;
        failCount = 0;
        attempt = 0;
        setIsConnected(true);

        let relayChange: "down" | "up" | "same" = "same";
        try {
          const data = JSON.parse(event.data) as { userId?: string | number; relay?: unknown };
          if (data.userId != null) sessionUserIdRef.current = String(data.userId);
          relayChange = setRelay(data.relay);
        } catch (e) {
          console.warn("⚠️ [Realtime Stream] Could not parse the connected frame:", e);
        }

        // A first clean connect needs no resync (pages just fetched); a reconnect
        // or a load during an outage does. A down relay resyncs when it comes back.
        const needsResync = hasConnectedOnce || sawFailure || relayChange === "up";
        hasConnectedOnce = true;

        reportStatus();
        if (!relayDown) {
          const outageMs = takeOutageMs();
          if (needsResync) scheduleResync({ outageMs });
        }
        console.log("🟢 [Realtime Stream] Connected successfully over HTTPS.");
      });

      source.addEventListener("ping", () => {
        if (es === source) resetWatchdog(source);
      });

      // The relay can die or recover while this stream stays open
      source.addEventListener("relay", (event: MessageEvent) => {
        if (es !== source) return;
        try {
          const change = setRelay((JSON.parse(event.data) as { relay?: unknown }).relay);
          if (change === "same") return;
          reportStatus();
          if (change === "up") scheduleResync({ outageMs: takeOutageMs() });
        } catch (e) {
          console.warn("⚠️ [Realtime Stream] Could not parse relay state frame:", e);
        }
      });

      source.onmessage = (event) => {
        if (es !== source) return;
        resetWatchdog(source);
        try {
          handleIncomingStreamPayload(JSON.parse(event.data) as RealtimeMessage);
        } catch (e) {
          console.error("❌ [Realtime Stream] Failed to parse message:", e);
        }
      };

      source.onerror = () => {
        void handleStreamFailure(source);
      };
    }

    // ── User actions ──
    const reconnectNow = () => {
      reconnectTimer = clearTimer(reconnectTimer);
      closeStream();
      attempt = 0;
      probeCache = null;
      openStream();
    };

    function retryNow() {
      toast.loading("Reconnecting…", { id: TOAST_ID });
      loadingToast = true;
      failCount = 0;
      reconnectNow();
    }

    function refreshData() {
      toast.loading("Refreshing…", { id: TOAST_ID });
      loadingToast = true;
      scheduleResync({ user: true });
    }

    reconnectRef.current = reconnectNow;

    // ── Browser events ──
    const handleOffline = () => {
      console.warn("🔌 [Realtime] Device went offline.");
      sawFailure = true;
      outageStart ??= Date.now();
      reconnectTimer = clearTimer(reconnectTimer);
      closeStream();
      setIsConnected(false);
      reportStatus();
    };

    // Do not clear the no-internet toast here: the success toast replaces it
    // only once the stream is actually back.
    const handleOnline = () => {
      console.log("🌐 [Realtime] Device came back online. Reconnecting…");
      attempt = 0;
      failCount = 0;
      probeCache = null;
      if (!es) {
        reconnectTimer = clearTimer(reconnectTimer);
        scheduleReconnect(Math.random() * 1000);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (pendingResync) {
        pendingResync = false;
        scheduleResync(); // fresh jitter, so returning tabs do not fire together
      }
      if (!es && !reconnectTimer && isOnline()) {
        attempt = 0;
        scheduleReconnect(Math.random() * 1000);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    openStream();

    return () => {
      disposed = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reconnectTimer = clearTimer(reconnectTimer);
      resyncTimer = clearTimer(resyncTimer);
      closeStream();
      toast.dismiss(TOAST_ID);
      reconnectRef.current = () => {};
    };
  }, [onAuthRoute, handleIncomingStreamPayload, notifySubscribers]);

  const reconnect = useCallback(() => {
    reconnectRef.current();
  }, []);

  const subscribe = useCallback(
    (collection: string, callback: RealtimeCallback) => {
      if (!subscribersRef.current.has(collection)) {
        subscribersRef.current.set(collection, new Set());
      }
      const set = subscribersRef.current.get(collection)!;
      set.add(callback);

      return () => {
        set.delete(callback);
        if (set.size === 0) {
          subscribersRef.current.delete(collection);
        }
      };
    },
    []
  );

  const sendCustom = useCallback((payload: Record<string, unknown>) => {
    console.log("[Realtime Stream] sendCustom called:", payload);
  }, []);

  return (
    <RealtimeContext.Provider
      value={{ isConnected, subscribe, sendCustom, reconnect }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export function useRealtime() {
  return useContext(RealtimeContext);
}

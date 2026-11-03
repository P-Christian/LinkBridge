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

export type RealtimeMode = "stream" | "polling";

interface RealtimeContextType {
  isConnected: boolean;
  mode: RealtimeMode;
  setMode: (mode: RealtimeMode) => void;
  subscribe: (collection: string, callback: RealtimeCallback) => () => void;
  sendCustom: (payload: Record<string, unknown>) => void;
  reconnect: () => void;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
  mode: "stream",
  setMode: () => {},
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

/**
 * 🎛️ CODE-LEVEL REALTIME MODE TOGGLE
 * Defaults to HTTPS Server-Sent Events (SSE) stream relay with seamless fallback to polling.
 */
export const DEFAULT_REALTIME_MODE: RealtimeMode = "stream";

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Ensure Service Worker is registered automatically across the entire app
  usePushNotifications();

  // Derived, not the raw pathname: the stream must survive in-app navigation, so
  // only crossing into/out of an auth page may tear the EventSource down.
  const onAuthRoute = isAuthRoute(usePathname());

  const [mode, setModeState] = useState<RealtimeMode>(DEFAULT_REALTIME_MODE);
  const [isConnected, setIsConnected] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const subscribersRef = useRef<Map<string, Set<RealtimeCallback>>>(new Map());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const offlineDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const offlineProbeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wasOfflineRef = useRef(false);
  // Tracks the authenticated user's ID received from the SSE connected frame
  const sessionUserIdRef = useRef<string | null>(null);

  const setMode = useCallback((newMode: RealtimeMode) => {
    setModeState(newMode);
    console.log(`🔄 [Realtime] Switched mode to '${newMode.toUpperCase()}'`);
  }, []);

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

  const connectStreamRef = useRef<() => void>(() => {});

  const resetHeartbeatWatchdog = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
    // If the browser knows it's offline, mark disconnected immediately
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsConnected(false);
      return;
    }
    // 30-second watchdog (backend pings every 20s + 10s grace period)
    heartbeatTimeoutRef.current = setTimeout(() => {
      console.warn("⚠️ [Realtime Stream] Heartbeat missed (30s). Connection stalled. Reconnecting...");
      setIsConnected(false);
      wasOfflineRef.current = true;
      toast.warning("Connection stalled. Reconnecting…", {
        duration: 4000,
      });
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      connectStreamRef.current();
    }, 30000);
  }, []);

  const stopOfflineProbe = useCallback(() => {
    if (offlineProbeIntervalRef.current) {
      clearInterval(offlineProbeIntervalRef.current);
      offlineProbeIntervalRef.current = null;
    }
  }, []);

  // ─── Degraded refresh while the server-side relay is down ────────────────
  // Kept separate from `mode`: the EventSource stays open so the relay can
  // report its recovery, while subscribers refresh on a slower timer.
  const degradedTickRef = useRef<NodeJS.Timeout | null>(null);

  const stopDegradedRefresh = useCallback(() => {
    if (degradedTickRef.current) {
      clearInterval(degradedTickRef.current);
      degradedTickRef.current = null;
    }
  }, []);

  const applyRelayState = useCallback(
    (raw: unknown) => {
      if (raw !== "connected" && raw !== "connecting" && raw !== "down") return;
      if (raw === "down") {
        if (!degradedTickRef.current) {
          degradedTickRef.current = setInterval(() => {
            Array.from(subscribersRef.current.keys()).forEach((collection) => {
              notifySubscribers(collection, "update", []);
            });
          }, 5000);
        }
        toast.warning("Live updates are unavailable. Content will refresh periodically.", {
          id: "realtime-relay",
          duration: 6000,
        });
      } else if (raw === "connected") {
        const wasDegraded = degradedTickRef.current !== null;
        stopDegradedRefresh();
        if (wasDegraded) {
          toast.success("Live updates restored.", { id: "realtime-relay", duration: 3000 });
        }
      }
    },
    [notifySubscribers, stopDegradedRefresh]
  );

  const startOfflineProbe = useCallback(() => {
    if (offlineProbeIntervalRef.current) return;
    offlineProbeIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/health", {
          cache: "no-store",
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          console.log("🟢 [Realtime] Active probe confirmed connection restored!");
          stopOfflineProbe();
          if (wasOfflineRef.current) {
            toast.success("Back online. Connection restored.", {
              duration: 3000,
            });
            wasOfflineRef.current = false;
          }
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          connectStreamRef.current();
        }
      } catch {
        // Still offline, probe continues
      }
    }, 2000);
  }, [stopOfflineProbe]);

  const connectStream = useCallback(() => {
    if (typeof window === "undefined") return;
    if (onAuthRoute) {
      return;
    }
    if (eventSourceRef.current) return;

    try {
      console.log("🔌 [Realtime Stream] Connecting to SSE relay at /api/realtime/stream...");
      const es = new EventSource("/api/realtime/stream", { withCredentials: true });
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        resetHeartbeatWatchdog();
        stopOfflineProbe();
        if (offlineDebounceRef.current) {
          clearTimeout(offlineDebounceRef.current);
          offlineDebounceRef.current = null;
        }
        if (wasOfflineRef.current) {
          toast.success("Back online. Connection restored.", {
            duration: 3000,
          });
          wasOfflineRef.current = false;
        }
        console.log("🟢 [Realtime Stream] Connected successfully over HTTPS.");
      };

      es.addEventListener("connected", (event: MessageEvent) => {
        setIsConnected(true);
        resetHeartbeatWatchdog();
        stopOfflineProbe();
        if (offlineDebounceRef.current) {
          clearTimeout(offlineDebounceRef.current);
          offlineDebounceRef.current = null;
        }
        // Capture the authenticated userId so we can suppress self-notifications,
        // and the relay's health so a dead data plane is not shown as a live one.
        try {
          const data = JSON.parse(event.data) as {
            userId?: string | number;
            relay?: unknown;
          };
          if (data.userId != null) {
            sessionUserIdRef.current = String(data.userId);
          }
          applyRelayState(data.relay);
        } catch (e) {
          console.warn("⚠️ [Realtime Stream] Could not parse the connected frame:", e);
        }

        // If the user was offline, display a success toast and dismiss any offline alert
        if (wasOfflineRef.current) {
          toast.success("Back online. Connection restored.", {
            duration: 3000,
          });
          wasOfflineRef.current = false;
        }

        // Notify active subscribers to re-sync missing messages/events after blackout
        const activeCollections = Array.from(subscribersRef.current.keys());
        activeCollections.forEach((col) => {
          notifySubscribers(col, "init", []);
        });
      });

      // Listen for explicit server ping events to reset heartbeat watchdog
      es.addEventListener("ping", () => {
        resetHeartbeatWatchdog();
      });

      // The relay can die or recover while this stream stays open.
      es.addEventListener("relay", (event: MessageEvent) => {
        try {
          applyRelayState((JSON.parse(event.data) as { relay?: unknown }).relay);
        } catch (e) {
          console.warn("⚠️ [Realtime Stream] Could not parse relay state frame:", e);
        }
      });

      es.onmessage = (event) => {
        resetHeartbeatWatchdog();
        try {
          const payload = JSON.parse(event.data) as RealtimeMessage;
          handleIncomingStreamPayload(payload);
        } catch (e) {
          console.error("❌ [Realtime Stream] Failed to parse message:", e);
        }
      };

      es.onerror = (err) => {
        console.warn("🟡 [Realtime Stream] SSE stream connection notice (auto-reconnecting):", err);
        setIsConnected(false);
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
          heartbeatTimeoutRef.current = null;
        }

        // If disconnected for >1.5s and not yet flagged, verify network before triggering offline toast
        if (!offlineDebounceRef.current && !wasOfflineRef.current) {
          offlineDebounceRef.current = setTimeout(async () => {
            offlineDebounceRef.current = null;
            if (eventSourceRef.current?.readyState !== EventSource.OPEN) {
              // Quick probe to verify if device is truly offline vs unauthenticated / stream restart
              try {
                const res = await fetch("/api/health", {
                  cache: "no-store",
                  signal: AbortSignal.timeout(2000),
                });
                if (res.ok) {
                  // Device IS online! Failure was 401 unauthenticated or temporary reconnect.
                  // Do NOT show "You are offline"!
                  return;
                }
              } catch {
                // Fetch failed (network error / offline) -> genuinely offline!
              }

              wasOfflineRef.current = true;
              toast.error("You are offline. Please check your internet connection.", {
                duration: 5000,
              });
              startOfflineProbe();
            }
          }, 1500);
        }
      };
    } catch (err) {
      console.error("💥 [Realtime Stream] Exception initializing EventSource:", err);
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => setIsConnected(false));
      }
    }
  }, [onAuthRoute, handleIncomingStreamPayload, notifySubscribers, resetHeartbeatWatchdog, startOfflineProbe, stopOfflineProbe, applyRelayState]);

  useEffect(() => {
    connectStreamRef.current = connectStream;
  }, [connectStream]);

  // Handle Mode Switching (Stream vs Polling) & Route Transitions
  useEffect(() => {
    if (onAuthRoute) {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      stopDegradedRefresh();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => setIsConnected(false));
      }
      return;
    }

    if (mode === "stream") {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      connectStream();
    } else {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => setIsConnected(true));
      }

      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = setInterval(() => {
        const activeCollections = Array.from(subscribersRef.current.keys());
        activeCollections.forEach((collection) => {
          notifySubscribers(collection, "update", []);
        });
      }, 3000);
    }

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      stopDegradedRefresh();
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }
      if (offlineDebounceRef.current) {
        clearTimeout(offlineDebounceRef.current);
        offlineDebounceRef.current = null;
      }
      stopOfflineProbe();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [mode, onAuthRoute, connectStream, notifySubscribers, stopOfflineProbe, stopDegradedRefresh]);

  const reconnect = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
    if (mode === "stream") {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      connectStream();
    }
  }, [mode, connectStream]);

  // Network online/offline & tab visibility immediate reconnection listeners
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      console.log("🌐 [Realtime] Device came back online! Reconnecting stream immediately...");
      setIsConnected(false);
      stopOfflineProbe();
      if (offlineDebounceRef.current) {
        clearTimeout(offlineDebounceRef.current);
        offlineDebounceRef.current = null;
      }
      if (wasOfflineRef.current) {
        toast.success("Back online. Connection restored.", {
          duration: 3000,
        });
        wasOfflineRef.current = false;
      }
      reconnect();
    };

    const handleOffline = () => {
      console.warn("🔌 [Realtime] Device went offline.");
      setIsConnected(false);
      wasOfflineRef.current = true;
      if (offlineDebounceRef.current) {
        clearTimeout(offlineDebounceRef.current);
        offlineDebounceRef.current = null;
      }
      toast.error("You are offline. Please check your internet connection.", {
        duration: 5000,
      });
      startOfflineProbe();
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("👁️ [Realtime] Tab visible. Checking stream health...");
        if (
          !eventSourceRef.current ||
          eventSourceRef.current.readyState === EventSource.CLOSED
        ) {
          handleOnline();
        }
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }
      if (offlineDebounceRef.current) {
        clearTimeout(offlineDebounceRef.current);
        offlineDebounceRef.current = null;
      }
      stopOfflineProbe();
    };
  }, [reconnect, startOfflineProbe, stopOfflineProbe]);

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
      value={{ isConnected, mode, setMode, subscribe, sendCustom, reconnect }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export function useRealtime() {
  return useContext(RealtimeContext);
}

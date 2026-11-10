"use client";

import { useState, useEffect } from "react";

export type AuthRole = "employee" | "freelancer" | "employer" | "admin" | "school" | "guest";

export interface AuthSessionState {
  authenticated: boolean;
  role: AuthRole;
  dashboard: string | null;
  userId: number | string | null;
  companyId: number | null;
  companyCode: string | null;
  loading: boolean;
  isJobSeeker: boolean;
  isEmployer: boolean;
  isAdmin: boolean;
  isSchool: boolean;
  isGuest: boolean;
}

const DEFAULT_GUEST_STATE: AuthSessionState = {
  authenticated: false,
  role: "guest",
  dashboard: null,
  userId: null,
  companyId: null,
  companyCode: null,
  loading: false,
  isJobSeeker: false,
  isEmployer: false,
  isAdmin: false,
  isSchool: false,
  isGuest: true,
};

// In-memory module cache, in-flight deduplication and a TTL.
//
// `lastKnownSession` is the most recent answer the server actually gave;
// `fetchedAt` marks it stale so the next mount revalidates instead of serving
// a snapshot for the life of the tab. A network error or a 5xx never becomes
// `lastKnownSession`: pinning the UI to guest on a transient outage used to
// require a hard reload to undo.
let lastKnownSession: AuthSessionState | null = null;
let fetchedAt = 0;
let cachedPromise: Promise<AuthSessionState> | null = null;

const SESSION_TTL_MS = 60_000;

function remember(session: AuthSessionState): AuthSessionState {
  lastKnownSession = session;
  fetchedAt = Date.now();
  return session;
}

function isFresh(): boolean {
  return lastKnownSession !== null && Date.now() - fetchedAt < SESSION_TTL_MS;
}

function fetchAuthSession(): Promise<AuthSessionState> {
  if (cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) return lastKnownSession ?? DEFAULT_GUEST_STATE;

      const data = await res.json();
      if (!data.authenticated) return remember(DEFAULT_GUEST_STATE);

      const rawRole = (data.role || "").toLowerCase();
      const role: AuthRole =
        rawRole === "employee" || rawRole === "freelancer"
          ? "freelancer"
          : rawRole === "employer" || rawRole === "client"
          ? "employer"
          : rawRole === "admin"
          ? "admin"
          : rawRole === "school"
          ? "school"
          : "guest";

      return remember({
        authenticated: true,
        role,
        dashboard: data.dashboard || null,
        userId: data.userId || null,
        companyId: data.companyId ? Number(data.companyId) : null,
        companyCode: data.companyCode || null,
        loading: false,
        isJobSeeker: role === "freelancer",
        isEmployer: role === "employer",
        isAdmin: role === "admin",
        isSchool: role === "school",
        isGuest: false,
      });
    } catch {
      return lastKnownSession ?? DEFAULT_GUEST_STATE;
    }
  })().finally(() => {
    cachedPromise = null;
  });

  return cachedPromise;
}

export function useAuthSession(): AuthSessionState {
  const [state, setState] = useState<AuthSessionState>(() => {
    return lastKnownSession
      ? lastKnownSession
      : { ...DEFAULT_GUEST_STATE, loading: true };
  });

  useEffect(() => {
    let isMounted = true;

    if (!isFresh()) {
      fetchAuthSession().then((session) => {
        if (isMounted) {
          setState(session);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}

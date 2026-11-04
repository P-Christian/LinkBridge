"use client";

// src/modules/client/talent-search/hooks/useTalentProfile.ts

import { useCallback, useRef, useState } from "react";
import { TalentProfile } from "../types";

export function useTalentProfile() {
  const [profile, setProfile] = useState<TalentProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Opening A then B fires two requests and either can land last. The drawer
  // takes its match score from B but its identity from this profile, and Invite
  // and Save act on `profile.user_id` — so a late response for A would target
  // the wrong talent.
  const requestedUserIdRef = useRef<number | null>(null);

  const fetchProfile = useCallback(async (userId: number) => {
    requestedUserIdRef.current = userId;
    setLoading(true);
    setError("");
    setProfile(null);

    try {
      const res = await fetch(`/api/client/talent-profile/${userId}`);
      const json = await res.json();

      if (requestedUserIdRef.current !== userId) return;
      if (!res.ok) {
        throw new Error(json.error || "Failed to load profile.");
      }

      setProfile(json.profile ?? null);
    } catch (err: unknown) {
      if (requestedUserIdRef.current !== userId) return;
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      if (requestedUserIdRef.current === userId) setLoading(false);
    }
  }, []);

  const clearProfile = useCallback(() => {
    requestedUserIdRef.current = null;
    setProfile(null);
    setError("");
  }, []);

  return { profile, loading, error, fetchProfile, clearProfile };
}

"use client";

// src/modules/client/settings/hooks/useSettings.ts

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import { UserProfile, SecurityPayload, TeamMember } from "../types";
import {
  fetchUserProfile,
  updateUserProfile,
  updateUserPassword,
  fetchTeamMembers,
  updateTeamMemberRole,
} from "../providers/SettingsProvider";

export function useSettings() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);

  const [loading, setLoading] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Two independent reads, so two independent tokens: one shared controller
  // would cancel the profile read whenever the team read starts.
  const abortProfile = useRequestAbort();
  const abortTeam = useRequestAbort();

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const signal = abortProfile();
    try {
      const data = await fetchUserProfile(signal);
      if (signal.aborted) return;
      setUser(data);
    } catch (err: unknown) {
      if (signal.aborted) return;
      toast.error(
        err instanceof Error ? err.message : "An error occurred."
      );
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [abortProfile]);

  const saveProfile = useCallback(async (data: Partial<UserProfile>) => {
    setSaving(true);
    try {
      const updated = await updateUserProfile(data);
      setUser(updated);
      toast.success("Profile updated successfully.");
      return true;
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save profile."
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const changePassword = useCallback(async (payload: SecurityPayload) => {
    setSaving(true);
    try {
      await updateUserPassword(payload);
      toast.success(
        payload.revoke_other_sessions
          ? "Password changed. All other device sessions were signed out."
          : "Password changed successfully."
      );
      return true;
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to change password."
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    // Role changes patch this list locally, so a read that started before one
    // of them lands must not restore the pre-change roster.
    const signal = abortTeam();
    try {
      const members = await fetchTeamMembers(signal);
      if (signal.aborted) return;
      setTeam(members);
    } catch (err: unknown) {
      if (signal.aborted) return;
      toast.error(
        err instanceof Error ? err.message : "Failed to load team members."
      );
    } finally {
      if (!signal.aborted) setTeamLoading(false);
    }
  }, [abortTeam]);

  const modifyTeamRole = useCallback(
    async (
      companyUserId: number,
      role: "OWNER" | "ADMIN" | "MEMBER",
      status?: "ACTIVE" | "INACTIVE"
    ) => {
      setSaving(true);
      try {
        await updateTeamMemberRole(companyUserId, role, status);
        setTeam((prev) =>
          prev.map((m) =>
            m.company_user_id === companyUserId
              ? { ...m, company_user_role: role, status: status ?? m.status }
              : m
          )
        );
        toast.success("Team member role updated successfully.");
        return true;
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update team role."
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return {
    user,
    team,

    loading,
    teamLoading,
    saving,

    loadProfile,
    saveProfile,
    changePassword,
    loadTeam,
    modifyTeamRole,
  };
}

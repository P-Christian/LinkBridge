// src/modules/client/settings/providers/SettingsProvider.ts

import { UserProfile, SecurityPayload, TeamMember } from "../types";

const SETTINGS_API_BASE = "/api/client/settings";

export async function fetchUserProfile(signal?: AbortSignal): Promise<UserProfile> {
  const res = await fetch(SETTINGS_API_BASE, { cache: "no-store", signal });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to fetch user profile.");
  }
  return json.user;
}

export async function updateUserProfile(data: Partial<UserProfile>): Promise<UserProfile> {
  const res = await fetch(SETTINGS_API_BASE, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "PROFILE", payload: data }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to update profile.");
  }
  return json.user;
}

export async function updateUserPassword(payload: SecurityPayload): Promise<void> {
  const res = await fetch(SETTINGS_API_BASE, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "PASSWORD", payload }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to update password.");
  }
}

export async function fetchTeamMembers(signal?: AbortSignal): Promise<TeamMember[]> {
  const res = await fetch(`${SETTINGS_API_BASE}/team`, { cache: "no-store", signal });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to fetch team members.");
  }
  return json.members ?? [];
}

export async function updateTeamMemberRole(
  companyUserId: number,
  role: "OWNER" | "ADMIN" | "MEMBER",
  status?: "ACTIVE" | "INACTIVE"
): Promise<void> {
  const res = await fetch(`${SETTINGS_API_BASE}/team`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company_user_id: companyUserId, role, status }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to update team member.");
  }
}

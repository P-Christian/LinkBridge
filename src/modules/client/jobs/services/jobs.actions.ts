"use server";

import { authenticateCookieSession, isClientSession } from "@/lib/authenticated-session";

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

/**
 * Searches for skills in vs_master_skills table
 */
export async function searchMasterSkillsAction(query: string) {
  if (!query || query.trim().length < 2) return [];

  try {
    const url = `${DIRECTUS_BASE}/items/vs_master_skills?filter[skill_name][_icontains]=${encodeURIComponent(query.trim())}&limit=20`;
    const res = await fetch(url, {
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Failed to search master skills", await res.text());
      return [];
    }

    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("Error searching master skills:", err);
    return [];
  }
}

/**
 * Adds a new skill to vs_master_skills table.
 * If a skill with the same name already exists (case-insensitive), returns the existing one.
 */
export async function addMasterSkillAction(skillName: string) {
  const session = await authenticateCookieSession();
  if (!session || !isClientSession(session)) {
    throw new Error("Client account required.");
  }

  if (!skillName || !skillName.trim()) {
    throw new Error("Skill name cannot be empty");
  }

  const name = skillName.trim();

  try {
    // 1. Check if the skill already exists (case-insensitive)
    const checkUrl = `${DIRECTUS_BASE}/items/vs_master_skills?filter[skill_name][_eq]=${encodeURIComponent(name)}&fields=id,skill_name&limit=1`;
    const checkRes = await fetch(checkUrl, {
      headers: getHeaders(),
      cache: "no-store",
    });

    if (checkRes.ok) {
      const checkJson = await checkRes.json();
      const existing = checkJson.data || [];
      if (existing.length > 0) {
        return {
          id: Number(existing[0].id),
          skill_name: existing[0].skill_name,
        };
      }
    }

    // 2. If it does not exist, create it
    const res = await fetch(`${DIRECTUS_BASE}/items/vs_master_skills`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ skill_name: name }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to create master skill: ${errText}`);
    }

    const data = await res.json();
    return {
      id: Number(data.data.id),
      skill_name: data.data.skill_name,
    };
  } catch (err) {
    console.error("Error adding master skill:", err);
    throw err;
  }
}

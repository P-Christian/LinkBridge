// src/app/(vos-sync)/vos-sync/freelancer/settings/page.tsx

import * as React from "react";
import { FreelancerPageHeader } from "@/components/shared/layout/FreelancerPageHeader";
import SettingsModule from "@/modules/freelancer/settings";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Freelancer Settings | LinkBridge",
  description:
    "Manage account preferences, password security, appearance settings, and notification choices on LinkBridge.",
};

const COOKIE_NAME = "vos_sync_access_token";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function pickString(
  obj: Record<string, unknown> | null | undefined,
  keys: string[]
): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function buildHeaderUser(token: string | null | undefined) {
  const p = token ? decodeJwtPayload(token) : null;
  const first = pickString(p, ["Firstname", "FirstName", "firstName", "first_name"]);
  const last = pickString(p, ["LastName", "Lastname", "lastName", "last_name"]);
  const email = pickString(p, ["email", "Email"]);
  return {
    name: [first, last].filter(Boolean).join(" ") || email || "Freelancer",
    email: email || "freelancer@vossync.com",
    avatar: "",
  };
}

export default async function FreelancerSettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const headerUser = buildHeaderUser(token);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <FreelancerPageHeader label="Settings" user={headerUser} />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 bg-secondary/10">
        <SettingsModule />
      </main>
    </div>
  );
}

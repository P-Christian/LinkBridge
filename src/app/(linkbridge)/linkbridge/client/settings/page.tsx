// src/app/(vos-sync)/linkbridge/client/settings/page.tsx

import * as React from "react";
import { PortalPageHeader } from "@/components/shared/layout/PortalPageHeader";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import SettingsModule, { type SettingsTab } from "@/modules/client/settings/SettingsModule";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Employer Settings | LinkBridge Employer Portal",
  description:
    "Manage account preferences, password security, company team roles, and authorized integrations on LinkBridge.",
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
    name: [first, last].filter(Boolean).join(" ") || email || "Employer",
    email: email || "owner@company.com",
    avatar: "",
  };
}

export default async function ClientSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const headerUser = buildHeaderUser(token);

  const requestedTab = (await searchParams).tab;
  const tabValue = Array.isArray(requestedTab) ? requestedTab[0] : requestedTab;
  const initialTab: SettingsTab =
    tabValue === "security" || tabValue === "notifications" ? tabValue : "account";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PortalPageHeader user={headerUser} />
      <PageContainer>
        <SettingsModule initialTab={initialTab} />
      </PageContainer>
    </div>
  );
}

// src/app/(vos-sync)/vos-sync/client/interviews/page.tsx
import * as React from "react";
import { PortalPageHeader } from "@/components/shared/layout/PortalPageHeader";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import InterviewsModule from "@/modules/client/interviews";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Interview Schedule | LinkBridge client Portal",
  description: "Schedule and manage interviews for your job applicants on LinkBridge.",
};

const COOKIE_NAME = "vos_sync_access_token";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch { return null; }
}

function pickString(obj: Record<string, unknown> | null | undefined, keys: string[]): string {
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
  return { name: [first, last].filter(Boolean).join(" ") || email || "client", email: email || "owner@company.com", avatar: "" };
}

export default async function InterviewsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const headerUser = buildHeaderUser(token);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PortalPageHeader user={headerUser} />
      <PageContainer>
        <React.Suspense fallback={<div className="p-8 text-center text-xs text-zinc-400">Loading interview workspace...</div>}>
          <InterviewsModule />
        </React.Suspense>
      </PageContainer>
    </div>
  );
}


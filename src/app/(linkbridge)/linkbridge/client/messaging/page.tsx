// src/app/(vos-sync)/linkbridge/client/messaging/page.tsx

import * as React from "react";
import { PortalPageHeader } from "@/components/shared/layout/PortalPageHeader";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import MessagingModule from "@/modules/client/messaging";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Messages | LinkBridge Employer Portal",
  description:
    "Communicate with applicants and freelancers directly on LinkBridge.",
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

function getUserId(token: string | null | undefined): number {
  if (!token) return 0;
  const p = decodeJwtPayload(token);
  const id = p?.user_id ?? p?.sub ?? p?.id ?? 0;
  return Number(id) || 0;
}

export default async function ClientMessagingPage({
  searchParams,
}: {
  searchParams?: Promise<{ freelancer_id?: string; job_id?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const headerUser = buildHeaderUser(token);
  const currentUserId = getUserId(token);

  const resolvedParams = searchParams ? await searchParams : {};
  const initialFreelancerId = resolvedParams.freelancer_id
    ? parseInt(resolvedParams.freelancer_id, 10)
    : undefined;
  const initialJobId = resolvedParams.job_id
    ? parseInt(resolvedParams.job_id, 10)
    : undefined;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PortalPageHeader user={headerUser} />
      <PageContainer width="full" className="[&>div]:!p-3 sm:[&>div]:!p-4">
        <MessagingModule
          currentUserId={currentUserId}
          initialFreelancerId={initialFreelancerId}
          initialJobId={initialJobId}
        />
      </PageContainer>
    </div>
  );
}

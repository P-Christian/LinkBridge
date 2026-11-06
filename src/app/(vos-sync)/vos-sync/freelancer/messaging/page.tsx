// src/app/(vos-sync)/vos-sync/freelancer/messaging/page.tsx

import * as React from "react";
import { FreelancerPageHeader } from "@/components/shared/layout/FreelancerPageHeader";
import { cookies } from "next/headers";
import { getFreelancerProfile } from "@/modules/freelancer/freelancer-profile/services/freelancer-profile.service";
import FreelancerMessagingModule from "@/modules/freelancer/freelancer-messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Messages | LinkBridge Freelancer Portal",
  description:
    "Chat with clients and employers regarding your job applications on LinkBridge.",
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

function getUserId(token: string | null | undefined): number {
  if (!token) return 0;
  const p = decodeJwtPayload(token);
  const id = p?.user_id ?? p?.sub ?? p?.id ?? 0;
  return Number(id) || 0;
}

export default async function FreelancerMessagingRoute() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const profile = token ? await getFreelancerProfile(token) : null;
  const currentUserId = profile?.user_id ?? getUserId(token);

  const user = {
    name: profile ? `${profile.user_fname} ${profile.user_lname}` : "Freelancer",
    email: profile?.user_email || "freelancer@example.com",
    avatar: "",
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <FreelancerPageHeader label="Messages" user={user} />

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 bg-secondary/10">
        <FreelancerMessagingModule currentUserId={currentUserId} />
      </main>
    </div>
  );
}

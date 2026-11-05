// src/app/(public)/referral/[token]/page.tsx
import * as React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { getReferralByToken } from "@/modules/freelancer/freelancer-referrals/services/referral.service";
import ReferralLandingClient from "./ReferralLandingClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ReferralLandingPage(props: Props) {
  const { token } = await props.params;

  // Resolve referral details on server side
  const referral = await getReferralByToken(token);

  if (!referral) {
    return (
      <div className="flex flex-col items-center justify-center max-md:justify-start min-h-[60vh] px-4 text-center">
        <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-4 rounded-full mb-4 text-4xl">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold mb-2">Invalid or Expired Link</h1>
        <p className="text-muted-foreground max-w-md mb-6">
          The referral link you followed is invalid, has expired, or was revoked by the sender.
        </p>
        <Link
          href="/"
          className="inline-flex h-10 max-md:min-h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          Browse Open Vacancies
        </Link>
      </div>
    );
  }

  // Check if expired
  const isExpired = new Date(referral.expires_at) < new Date();
  if (isExpired || referral.status === "REVOKED" || referral.status === "EXPIRED" || referral.status === "INVALIDATED") {
    return (
      <div className="flex flex-col items-center justify-center max-md:justify-start min-h-[60vh] px-4 text-center">
        <div className="bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-400 p-4 rounded-full mb-4 text-4xl">
          ⏳
        </div>
        <h1 className="text-2xl font-bold mb-2">Referral Invitation Closed</h1>
        <p className="text-muted-foreground max-w-md mb-6">
          This referral invitation is no longer active. You can still view and apply for other opportunities.
        </p>
        <Link
          href="/"
          className="inline-flex h-10 max-md:min-h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          Browse Open Vacancies
        </Link>
      </div>
    );
  }

  const cookieStore = await cookies();
  const tokenVal = cookieStore.get("vos_sync_access_token")?.value;
  const isLoggedIn = !!tokenVal;

  return (
    <div className="max-w-4xl mx-auto px-4 pt-2 pb-6 md:py-20">
      <ReferralLandingClient referral={referral} token={token} isLoggedIn={isLoggedIn} />
    </div>
  );
}

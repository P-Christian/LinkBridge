import React, { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import StudentRegisterClient from "./StudentRegisterClient";

export const metadata: Metadata = {
  title: "Student Registration | LinkBridge",
  description:
    "Accept your school invitation and link your student record to your LinkBridge account.",
  // Invitation tokens travel in the URL query string; never leak them to
  // third parties through the Referer header.
  referrer: "no-referrer",
};

export default async function StudentRegisterPage() {
  const cookieStore = await cookies();
  const initialHasSession = cookieStore.has("vos_sync_access_token");
  return (
    <div className="max-md:items-start flex min-h-[calc(100dvh-6rem)] items-center justify-center py-4 sm:py-12">
      <Suspense
        fallback={
          <div className="flex items-center justify-center" role="status" aria-label="Loading invitation">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        }
      >
        <StudentRegisterClient initialHasSession={initialHasSession} />
      </Suspense>
    </div>
  );
}

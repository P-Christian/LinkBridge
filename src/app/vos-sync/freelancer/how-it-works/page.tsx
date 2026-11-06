// src/app/vos-sync/freelancer/how-it-works/page.tsx
import { Suspense } from "react";
import HowItWorksModule from "@/modules/public/how-it-works";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "How LinkBridge Works — Candidate Guide",
  description: "Learn how to optimize your profile, get verified, apply for jobs, and track applications on LinkBridge.",
};

export default function FreelancerHowItWorksPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center p-12 text-center text-xs text-muted-foreground">
          Loading Candidate Guide...
        </div>
      }
    >
      <HowItWorksModule defaultRole="employee" singleRoleMode={true} />
    </Suspense>
  );
}

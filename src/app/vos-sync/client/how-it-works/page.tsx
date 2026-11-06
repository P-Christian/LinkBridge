// src/app/vos-sync/client/how-it-works/page.tsx
import { Suspense } from "react";
import HowItWorksModule from "@/modules/public/how-it-works";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "How LinkBridge Works — Employer Guide",
  description: "Learn how to verify your company, post vacancies, screen candidates, and hire top talent on LinkBridge.",
};

export default function ClientHowItWorksPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center p-12 text-center text-xs text-muted-foreground">
          Loading Employer Guide...
        </div>
      }
    >
      <HowItWorksModule defaultRole="employer" singleRoleMode={true} />
    </Suspense>
  );
}

// src/app/vos-sync/school-admin/how-it-works/page.tsx
import { Suspense } from "react";
import HowItWorksModule from "@/modules/public/how-it-works";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "How LinkBridge Works — Academic Institution Guide",
  description: "Learn how to manage course catalogs, verify student degrees, and issue education credentials on LinkBridge.",
};

export default function SchoolAdminHowItWorksPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center p-12 text-center text-xs text-muted-foreground">
          Loading School Guide...
        </div>
      }
    >
      <HowItWorksModule defaultRole="school" singleRoleMode={true} />
    </Suspense>
  );
}

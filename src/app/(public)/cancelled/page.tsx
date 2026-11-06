import type { Metadata } from "next";
import { Suspense } from "react";
import { CancelledClientContent } from "./CancelledClientContent";

export const metadata: Metadata = {
  title: "Authorization Cancelled | LinkBridge",
  description:
    "The authentication or account connection process was cancelled. No changes were made to your account.",
};

export default function CancelledPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[75vh] flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-8 rounded-xl border border-border bg-card animate-pulse space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto" />
            <div className="h-6 w-3/4 bg-muted mx-auto rounded" />
            <div className="h-4 w-5/6 bg-muted mx-auto rounded" />
            <div className="h-10 w-full bg-muted rounded mt-6" />
          </div>
        </div>
      }
    >
      <CancelledClientContent />
    </Suspense>
  );
}

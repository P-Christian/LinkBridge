import type { Metadata } from "next";
import { Suspense } from "react";
import { PopupCallbackContent } from "./PopupCallbackContent";

export const metadata: Metadata = {
  title: "Authentication Complete | LinkBridge",
  description: "OAuth completion handler for popup authentication.",
};

export default function PopupCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground font-medium">Finalizing authentication...</p>
          </div>
        </div>
      }
    >
      <PopupCallbackContent />
    </Suspense>
  );
}

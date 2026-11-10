"use client";

import React, { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function PopupCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const status = searchParams.get("status") || "success";
    const provider = searchParams.get("provider") || "";
    const flow = searchParams.get("flow") || "";
    const redirectUrl = searchParams.get("redirectUrl") || "";
    const error = searchParams.get("error") || "";
    const notice = searchParams.get("notice") || "";
    const email = searchParams.get("email") || "";

    // If opened inside a popup with an active opener
    if (window.opener && window.opener !== window) {
      window.opener.postMessage(
        {
          type: "OAUTH_RESPONSE",
          status,
          provider,
          flow,
          redirectUrl,
          error,
          notice,
          email,
        },
        window.location.origin
      );

      // Give postMessage a tick to be delivered before closing
      const timer = setTimeout(() => {
        try {
          window.close();
        } catch {
          // Ignore close errors if browser prevents it
        }
      }, 100);

      return () => clearTimeout(timer);
    } else {
      // Fallback if accessed as a direct tab
      if (status === "cancelled") {
        window.location.href = `/cancelled?provider=${encodeURIComponent(provider)}&flow=${encodeURIComponent(flow)}`;
      } else if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        window.location.href = "/";
      }
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" />
        <p className="text-sm text-muted-foreground font-medium">Finalizing authentication...</p>
      </div>
    </div>
  );
}

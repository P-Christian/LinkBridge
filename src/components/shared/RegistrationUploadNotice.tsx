"use client";

import { Suspense, useEffect, useState } from "react";
import type { ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";

export const REGISTRATION_UPLOAD_NOTICE_MESSAGE =
  "Your file upload was unsuccessful. You can upload your documents later from your profile.";

function stripUploadParam(searchParams: ReadonlyURLSearchParams, pathname: string): string {
  const params = new URLSearchParams(searchParams.toString());
  params.delete("upload");
  const remaining = params.toString();
  return remaining ? `${pathname}?${remaining}` : pathname;
}

function RegistrationUploadNoticeInner(): ReactElement | null {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  // Latch the flag on first render so cleaning the URL does not hide the
  // banner before the user dismisses it; a reload re-reads the (clean) URL.
  const [wasFailed] = useState(() => searchParams.get("upload") === "failed");

  useEffect(() => {
    if (wasFailed) {
      router.replace(stripUploadParam(searchParams, pathname));
    }
  }, [wasFailed, searchParams, pathname, router]);

  if (!wasFailed || dismissed) {
    return null;
  }

  const handleDismiss = (): void => {
    setDismissed(true);
    router.replace(stripUploadParam(searchParams, pathname));
  };

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="flex-1">{REGISTRATION_UPLOAD_NOTICE_MESSAGE}</p>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 hover:bg-destructive/10"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// useSearchParams requires a Suspense boundary in the App Router.
export default function RegistrationUploadNotice(): ReactElement {
  return (
    <Suspense fallback={null}>
      <RegistrationUploadNoticeInner />
    </Suspense>
  );
}

"use client";

import { Lock, RefreshCw, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { InboxLoadFailureKind } from "../services/school-request-inbox.helpers";

/**
 * Non-data states for the attendance inbox: loading skeleton, recoverable
 * dependency/unknown error, and the access-denied panels. Kept presentational
 * so the page owns data fetching and the states stay visually consistent with
 * the rest of the School Admin module.
 */

export function SchoolRequestInboxSkeleton() {
  return (
    <div
      data-testid="school-request-loading"
      className="w-[90%] max-w-[2000px] mx-auto space-y-6 p-6"
    >
      <div className="h-24 w-full rounded-2xl bg-slate-900/90 p-6 flex items-center justify-between border border-white/10 shadow-xl animate-pulse">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-xl bg-white/20 shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-56 bg-white/20" />
            <Skeleton className="h-4 w-96 bg-white/10" />
          </div>
        </div>
      </div>
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-muted/40 flex justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="divide-y">
          {[1, 2, 3].map((row) => (
            <div key={row} className="p-4 flex items-center justify-between gap-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ErrorBannerProps {
  readonly message: string;
  readonly loading: boolean;
  readonly onRetry: () => void;
}

export function SchoolRequestInboxErrorBanner({ message, loading, onRetry }: ErrorBannerProps) {
  return (
    <div
      data-testid="school-request-error"
      className="w-[90%] max-w-[2000px] mx-auto"
      role="alert"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">The attendance inbox could not be loaded.</p>
            <p className="text-xs mt-1">{message}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={loading}
          data-testid="school-request-error-retry"
          className="border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800 shrink-0"
        >
          <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
          Retry
        </Button>
      </div>
    </div>
  );
}

interface AccessPanelProps {
  readonly kind: Extract<InboxLoadFailureKind, "forbidden" | "unauthenticated">;
  readonly message: string;
}

export function SchoolRequestInboxAccessPanel({ kind, message }: AccessPanelProps) {
  const forbidden = kind === "forbidden";
  return (
    <div className="w-[90%] max-w-[2000px] mx-auto" data-testid={`school-request-${kind}`}>
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/15 bg-muted/5 p-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background border">
          {forbidden ? (
            <Lock className="h-7 w-7 text-muted-foreground/40" />
          ) : (
            <ShieldAlert className="h-7 w-7 text-muted-foreground/40" />
          )}
        </div>
        <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground/80">
          {forbidden ? "School request access unavailable" : "Sign-in required"}
        </h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
          {forbidden
            ? "Attendance requests are limited to a School Admin with exactly one active school assignment. " +
              "Ask the Admin Portal to confirm your assignment, then reload this page."
            : "Your session is no longer valid. Sign in again as a School Admin to view this inbox."}
        </p>
        <p className="mt-4 text-xs text-muted-foreground/80">{message}</p>
      </div>
    </div>
  );
}

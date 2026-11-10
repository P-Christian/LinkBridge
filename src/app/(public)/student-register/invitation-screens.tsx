import Link from "next/link";
import { CheckCircle2, GraduationCap, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ValidStudentInvitationPreviewDto } from "@/modules/auth/student-invitation/types";

import { StepIndicator } from "./otp-panel";

function formatExpiryDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function LoadingScreen({ error, onRetry }: { readonly error: string | null; readonly onRetry: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      {error ? (
        <div className="text-center max-w-sm px-4">
          <h1 className="text-2xl font-medium text-primary mb-3">We couldn&apos;t load your invitation</h1>
          <p role="alert" className="text-sm text-muted-foreground mb-6">{error}</p>
          <Button type="button" onClick={onRetry} className="min-h-11 rounded-full px-8 py-3">Try again</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center" role="status" aria-label="Loading invitation">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="mt-4 text-muted-foreground">Loading your invitation...</p>
        </div>
      )}
    </div>
  );
}

export function PreviewScreen({ preview, hasSession, loginHref, busy, onCreateAccount, onAccept }: {
  readonly preview: ValidStudentInvitationPreviewDto;
  readonly hasSession: boolean;
  readonly loginHref: string;
  readonly busy: boolean;
  readonly onCreateAccount: () => void;
  readonly onAccept: () => void;
}) {
  const details = [
    ["School", preview.schoolName],
    ["Course", preview.courseName],
    ["School year", preview.schoolYear],
    ["School email", preview.emailMasked],
    ["Invitation expires", formatExpiryDate(preview.expiresAt)],
  ].filter((detail) => detail[1]);

  return (
    <div className="w-full max-w-lg mx-auto px-4 sm:px-6 pt-2 pb-6 md:py-12">
      <div className="text-center mb-8 max-md:mb-5">
        <div className="mx-auto mb-4 max-md:mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <GraduationCap className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-medium text-primary">You&apos;re invited, {preview.studentFirstName}!</h1>
        <p className="mt-2 text-sm text-muted-foreground">{preview.schoolName} has invited you to link your student record to a LinkBridge account.</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 max-md:p-5 shadow-sm">
        <dl className="space-y-4 max-md:space-y-3 text-sm">
          {details.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4">
              <dt className="text-muted-foreground shrink-0">{label}</dt>
              <dd className="font-medium text-foreground text-right break-words min-w-0">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground leading-relaxed">Invitation verification uses the school email shown above.</p>
      </div>
      <div className="mt-6 max-md:mt-4 flex flex-col gap-3">
        {hasSession ? (
          <>
            <Button type="button" onClick={onAccept} disabled={busy} className="min-h-11 w-full py-6 rounded-full text-base">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Checking your invitation...</> : "Accept invitation"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Accepting links this invitation to the account you&apos;re signed in with. Wrong account?{" "}
              <Link href={loginHref} className="inline-flex min-h-11 items-center text-primary font-medium hover:underline">
                Sign in with a different account
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="text-center text-sm text-muted-foreground">
              Already have a LinkBridge account? Sign in and we&apos;ll link this invitation to it.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" onClick={onCreateAccount} className="min-h-11 rounded-full">Create a new account</Button>
              <Button asChild variant="outline" className="min-h-11 rounded-full border-2">
                <Link href={loginHref}>Sign in to my existing account</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type AcceptNoticeStep =
  | { readonly index: 1; readonly total: 1 }
  | { readonly index: 2; readonly total: 2 };

export function AcceptNoticeScreen({ notice, error, busy, onConfirm, onBack, step = { index: 1, total: 1 } }: {
  readonly notice: string | null;
  readonly error: string | null;
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onBack: () => void;
  readonly step?: AcceptNoticeStep;
}) {
  return (
    <div className="w-full max-w-md mx-auto px-4 sm:px-6 pt-2 pb-6 md:py-12 text-center">
      <StepIndicator
        index={step.index}
        total={step.total}
        label="Already verified"
        variant="success"
      />
      <h1 className="text-3xl font-medium text-primary mb-3">
        No extra code needed
      </h1>
      <div className="mb-6 space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          Your already-verified LinkBridge account email matches the school email
          on this invitation. We&apos;ll reuse that verification to link your
          student record.
        </p>
        <p>{notice ?? "No additional verification code will be sent."}</p>
      </div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive font-medium">
          {error}
        </p>
      )}
      <div className="space-y-3">
        <Button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="min-h-11 w-full py-6 rounded-full text-base"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Linking...
            </>
          ) : error ? (
            "Try again"
          ) : (
            "Link my account"
          )}
        </Button>
        <Button type="button" variant="ghost" onClick={onBack} disabled={busy} className="min-h-11">
          Back to invitation
        </Button>
      </div>
    </div>
  );
}

export function SuccessScreen({ preview }: { readonly preview: ValidStudentInvitationPreviewDto | null }) {
  return (
    <div className="w-full max-w-md mx-auto px-4 sm:px-6 pt-2 pb-6 md:py-12 text-center">
      <div className="mx-auto mb-5 max-md:mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success">
        <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="text-3xl font-medium text-primary mb-3">
        You&apos;re all set{preview ? `, ${preview.studentFirstName}` : ""}!
      </h1>
      <p className="text-sm text-muted-foreground leading-relaxed mb-8">
        Your LinkBridge account is now linked to{" "}
        <strong className="text-foreground">
          {preview?.schoolName ?? "your school"}
        </strong>
        . You can explore jobs and build your profile from your dashboard.
      </p>
      <div className="flex flex-col items-center gap-3">
        <Button asChild className="min-h-11 w-full py-6 rounded-full text-base">
          <Link href="/linkbridge/freelancer/dashboard">
            Go to your Job Seeker dashboard
          </Link>
        </Button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center px-4 py-2 text-sm font-medium text-muted-foreground hover:text-primary"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

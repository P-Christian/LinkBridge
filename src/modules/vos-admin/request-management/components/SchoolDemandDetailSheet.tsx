// src/modules/vos-admin/request-management/components/SchoolDemandDetailSheet.tsx
//
// Detail surface for one exact matched-school demand group. The group arrives
// from the grouped demand table; the sheet renders its summary and then the
// underlying requests (see `SchoolDemandDetailRequests`) in the selector's
// oldest-first order, using only the requester name fields already present in
// the DTO. Every decision control delegates to the shared per-request action
// controller, so one interaction can only ever act on one concrete
// `school_request_id`.
//
// Account-state refinement is lazy: the server-classified school search runs
// only while the sheet is open, debounced from a representative request id and
// the requested name, and only a candidate whose `school_id` exactly equals
// the group's matched id may refine the label. No exact candidate, a capped or
// blank search, a 4xx/5xx, or a stale response keeps the conservative
// `Waiting for account` state with a retry affordance; the group itself never
// disappears on failure. Focus returns to the element that opened the sheet.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ReviewAction, SchoolDraftOutcome } from "../types/request.types";
import type {
  SchoolDecisionFeedback,
  SchoolDecisionOutcome,
  SchoolInviteLink,
  SchoolRequestDecision,
  SchoolRoutingCandidate,
} from "../hooks/useRequests";
import type { AwaitingSchoolGroup } from "../dashboard/school-demand.selectors";
import { SchoolDemandDetailRequests } from "./SchoolDemandDetailRequests";
import { InviteSchoolLinkModal } from "../../components/InviteSchoolLinkModal";
import { useSchoolRequestActionController } from "./school-requests/SchoolRequestActionController";
import type { SchoolRequestsMode } from "./school-requests/school-request-mode";

// Debounce before the single on-open school search leaves the browser.
const REFINE_DEBOUNCE_MS = 300;
const STAT_LABEL = "text-xs font-medium tracking-wide text-muted-foreground uppercase";

type RefinementLabel = "Awaiting registration" | "Awaiting activation";
type AccountRefinement = { readonly kind: "checking" } | { readonly kind: "refined"; readonly label: RefinementLabel } | { readonly kind: "waiting" };

const PH_DATE_TIME = new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });

function formatTimestamp(value: string | null): string {
  if (value === null) return "Unknown";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unknown" : PH_DATE_TIME.format(parsed);
}

// Only the two awaiting-account routes refine; anything else stays conservative.
function awaitingLabelFor(route: string): RefinementLabel | null {
  if (route === "AWAITING_REGISTRATION") return "Awaiting registration";
  if (route === "AWAITING_ACTIVATION") return "Awaiting activation";
  return null;
}

const INVITE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidInviteEmail(value: string): boolean {
  return INVITE_EMAIL_PATTERN.test(value.trim());
}

interface GeneratedSchoolInvite {
  readonly schoolName: string;
  readonly invitedEmail: string;
  readonly invitationUrl: string;
}

function AccountStateBadge({ refinement }: { refinement: AccountRefinement }) {
  if (refinement.kind === "refined") return <StatusBadge tone="info">{refinement.label}</StatusBadge>;
  if (refinement.kind === "checking") {
    return (
      <StatusBadge tone="neutral">
        <RefreshCw className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
        Checking account state
      </StatusBadge>
    );
  }
  return <StatusBadge tone="info">Waiting for account</StatusBadge>;
}

export interface SchoolDemandDetailSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  // The exact-id group handed over by the grouped demand table; null renders nothing.
  readonly group: AwaitingSchoolGroup | null;
  readonly mode: SchoolRequestsMode;
  // Shared lazy school search; invoked only while the sheet is open.
  readonly onSearchSchools: (requestId: number, query: string) => Promise<SchoolRoutingCandidate[] | null>;
  // Sanitized search failure for one request id; shown as the retry reason.
  readonly searchErrorFor: (requestId: number) => string | null;
  readonly feedbackFor: (requestId: number) => SchoolDecisionFeedback | undefined;
  readonly decisionBusyFor: (requestId: number) => boolean;
  readonly candidatesFor: (requestId: number) => readonly SchoolRoutingCandidate[];
  readonly candidatesLoadingFor: (requestId: number) => boolean;
  readonly candidatesErrorFor: (requestId: number) => string | null;
  readonly onReview: (id: number, data: ReviewAction) => Promise<boolean>;
  readonly onDecide: (id: number, decision: SchoolRequestDecision) => Promise<SchoolDecisionOutcome>;
  readonly onCreatePlaceholder: (data: unknown) => Promise<SchoolDraftOutcome | null>;
  readonly onGenerateInvite: (schoolId: number, email: string) => Promise<SchoolInviteLink | null>;
  readonly onDecided: () => void;
}

export function SchoolDemandDetailSheet(props: SchoolDemandDetailSheetProps) {
  const {
    open, onOpenChange, group, mode, onSearchSchools, searchErrorFor, feedbackFor,
    decisionBusyFor, candidatesFor, candidatesLoadingFor, candidatesErrorFor, onReview,
    onDecide, onCreatePlaceholder, onGenerateInvite, onDecided,
  } = props;
  const controller = useSchoolRequestActionController({
    mode, onReview, onDecide, onSearchSchools, candidatesFor, candidatesLoadingFor,
    candidatesErrorFor, decisionBusyFor, onCreatePlaceholder, onDecided, allowReject: false,
  });

  const matchedSchoolId = group?.matchedSchoolId ?? null;
  const representativeId = group?.requests[0]?.school_request_id ?? null;
  const requestedName = group?.displayName ?? "";
  const sessionKey =
    open && matchedSchoolId !== null && representativeId !== null
      ? `${matchedSchoolId}:${representativeId}`
      : null;
  const [result, setResult] = useState<{ key: string; label: RefinementLabel | null } | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<GeneratedSchoolInvite | null>(null);
  const epochRef = useRef(0);
  const originRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef(onSearchSchools);

  useEffect(() => {
    searchRef.current = onSearchSchools;
  });

  const runRefinement = useCallback(
    async (epoch: number, key: string) => {
      let candidates: readonly SchoolRoutingCandidate[] | null = null;
      try {
        candidates = await searchRef.current(representativeId ?? 0, requestedName);
      } catch {
        candidates = null;
      }
      if (epochRef.current !== epoch) return;
      const exact = candidates?.find((candidate) => candidate.school_id === matchedSchoolId) ?? null;
      const label = exact === null ? null : awaitingLabelFor(exact.verification_route);
      setResult({ key, label });
    },
    [matchedSchoolId, representativeId, requestedName],
  );

  // The only school-search trigger: the sheet is open for this exact group.
  useEffect(() => {
    if (sessionKey === null) return;
    const epoch = epochRef.current + 1;
    epochRef.current = epoch;
    const timer = window.setTimeout(() => void runRefinement(epoch, sessionKey), REFINE_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      if (epochRef.current === epoch) epochRef.current = epoch + 1;
    };
  }, [sessionKey, runRefinement]);

  const retryRefinement = useCallback(() => {
    if (sessionKey === null) return;
    const epoch = epochRef.current + 1;
    epochRef.current = epoch;
    setResult(null);
    void runRefinement(epoch, sessionKey);
  }, [sessionKey, runRefinement]);

  // Track the last trigger focus while closed: Radix may move focus into the
  // content before `onOpenAutoFocus` observers run.
  useEffect(() => {
    if (open) return;
    const track = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[data-slot="sheet-content"]') === null) {
        originRef.current = target;
      }
    };
    document.addEventListener("focusin", track);
    return () => document.removeEventListener("focusin", track);
  }, [open]);

  const captureOrigin = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && active.closest('[data-slot="sheet-content"]') === null) originRef.current = active;
  }, []);

  // The trigger node can be recycled while open (table cell subtrees remount
  // when columns rebuild), so fall back to focusing this exact school's row.
  const restoreOrigin = useCallback((event: Event) => {
    const captured = originRef.current;
    originRef.current = null;
    const row = matchedSchoolId === null ? null : document.querySelector(`[data-row-school-id="${matchedSchoolId}"]`)?.closest("tr");
    const target = captured !== null && captured.isConnected ? captured : row?.querySelector("button, [href], [tabindex]");
    if (!(target instanceof HTMLElement)) return;
    event.preventDefault();
    target.focus();
  }, [matchedSchoolId]);

  if (group === null) return null;

  const readOnly = mode === "frozen";
  const refinement: AccountRefinement =
    sessionKey === null
      ? { kind: "waiting" }
      : result !== null && result.key === sessionKey
        ? result.label === null
          ? { kind: "waiting" }
          : { kind: "refined", label: result.label }
        : { kind: "checking" };
  const waitingReason =
    refinement.kind === "waiting" && representativeId !== null ? searchErrorFor(representativeId) : null;
  const stats: readonly (readonly [string, string | number, string, string | null])[] = [
    ["Requests", group.requestCount, "demand-detail-count", null],
    ["Requesters", group.distinctRequesterCount, "demand-detail-requesters", null],
    ["Oldest request", formatTimestamp(group.oldestCreatedAt), "demand-detail-oldest", group.oldestCreatedAt],
    ["Latest request", formatTimestamp(group.latestCreatedAt), "demand-detail-latest", group.latestCreatedAt],
  ];

  const adminAlreadyConnected = refinement.kind === "refined" && refinement.label === "Awaiting activation";
  const inviteDisabled = inviteBusy || adminAlreadyConnected || !isValidInviteEmail(inviteEmail);

  const generateInvite = async (): Promise<void> => {
    if (inviteDisabled) return;
    setInviteBusy(true);
    try {
      const email = inviteEmail.trim();
      const link = await onGenerateInvite(group.matchedSchoolId, email);
      if (link === null) {
        toast.error("Could not generate the invite link. Please try again.");
        return;
      }
      setGeneratedInvite({ schoolName: group.displayName, invitedEmail: email, invitationUrl: link.invitationUrl });
    } finally {
      setInviteBusy(false);
    }
  };

  const inviteButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={inviteDisabled}
      onClick={() => void generateInvite()}
      data-testid="demand-detail-generate-invite"
    >
      <Link2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
      Generate invite link
    </Button>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl motion-reduce:[&_.animate-spin]:animate-none"
          data-testid="school-demand-detail-sheet"
          onOpenAutoFocus={captureOrigin}
          onCloseAutoFocus={restoreOrigin}
        >
          <SheetHeader className="border-b">
            <SheetTitle className="flex min-w-0 flex-wrap items-center gap-2 text-lg">
              <span className="min-w-0 break-words">{group.displayName === "" ? "Unnamed school" : group.displayName}</span>
              <span className="font-mono text-xs font-normal text-muted-foreground" data-testid="demand-detail-matched-id">
                School #{group.matchedSchoolId}
              </span>
            </SheetTitle>
            <SheetDescription>
              Requests waiting for this school to get an account. Open one to work on it.
            </SheetDescription>
          </SheetHeader>

          <div role="region" aria-label="Demand group details" aria-busy={refinement.kind === "checking"} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <section
              aria-label="Demand group summary"
              data-testid="demand-detail-summary"
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.map(([label, value, testId, title]) => (
                  <div key={testId}>
                    <dt className={STAT_LABEL}>{label}</dt>
                    <dd className="mt-1 text-sm font-medium tabular-nums" data-testid={testId} title={title ?? undefined}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                <span data-testid="demand-detail-account-state">
                  <AccountStateBadge refinement={refinement} />
                </span>
                {refinement.kind === "waiting" ? (
                  <Button variant="outline" size="sm" onClick={retryRefinement} data-testid="demand-detail-retry">
                    <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                    Check again
                  </Button>
                ) : null}
                {waitingReason !== null ? (
                  <span className="text-xs text-muted-foreground" data-testid="demand-detail-refine-reason">
                    {waitingReason}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 space-y-2 border-t pt-3" data-testid="demand-detail-invite">
                <p className="text-sm font-medium">Invite school admin</p>
                <p className="text-xs text-muted-foreground">
                  Generate a link-only registration invite. No email is sent.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="admin@school.edu"
                    aria-label="Invitee email"
                    disabled={inviteBusy}
                    data-testid="demand-detail-invite-email"
                    className="h-9 max-w-xs text-sm"
                  />
                  {adminAlreadyConnected ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">{inviteButton}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top">An admin account is already connected.</TooltipContent>
                    </Tooltip>
                  ) : (
                    inviteButton
                  )}
                </div>
              </div>
            </section>

            <section aria-labelledby="demand-detail-requests-heading" className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 id="demand-detail-requests-heading" className="text-sm font-semibold">
                  Requests in this group
                </h3>
                <span className="text-xs tabular-nums text-muted-foreground">{group.requestCount}</span>
              </div>
              {readOnly ? (
                <p className="text-sm text-muted-foreground" data-testid="demand-detail-readonly">
                  Read-only mode — decision actions are unavailable.
                </p>
              ) : null}
              <SchoolDemandDetailRequests
                requests={group.requests}
                mode={mode}
                readOnly={readOnly}
                feedbackFor={feedbackFor}
                decisionBusyFor={decisionBusyFor}
                onEdit={(request) => controller.openDecision(request, "correct")}
              />
            </section>
          </div>
        </SheetContent>
      </Sheet>
      {controller.modals}
      {generatedInvite !== null ? (
        <InviteSchoolLinkModal
          isOpen
          onClose={() => setGeneratedInvite(null)}
          schoolName={generatedInvite.schoolName}
          invitedEmail={generatedInvite.invitedEmail}
          invitationUrl={generatedInvite.invitationUrl}
        />
      ) : null}
    </>
  );
}

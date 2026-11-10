// Concrete-request decision/review controller for school requests. Holds the
// per-request dialog state (legacy review, attendance Route/Group/Reject, and
// guarded draft-school creation) and renders the matching modal tree.
// Every mutation targets one exact `school_request_id`; candidate lookup,
// last-search-query memory, busy/feedback state, and the stale-response
// refetch/close behavior stay keyed by that id. Frozen mode renders no modal
// because the composing surface offers no mutation control.
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ReviewAction, SchoolDraftOutcome, VsSchoolRequest } from "../../types/request.types";
import type {
  SchoolDecisionOutcome,
  SchoolRequestDecision,
  SchoolRoutingCandidate,
} from "../../hooks/useRequests";
import { SchoolRequestDecisionModal } from "../SchoolRequestDecisionModal";
import type {
  SchoolDecisionTab,
  SchoolPlaceholderInput,
  SchoolVerificationRoute,
} from "../SchoolRequestDecisionModal";
import { ReviewModal } from "../ReviewModal";
import type { SchoolRequestsMode } from "./school-request-mode";

export interface SchoolRequestActionControllerOptions {
  readonly mode: SchoolRequestsMode;
  /** Legacy Approve/Reject (legacy mode only). */
  readonly onReview: (id: number, data: ReviewAction) => Promise<boolean>;
  /** Attendance Route/Group/Reject decision (attendance mode only). */
  readonly onDecide: (id: number, decision: SchoolRequestDecision) => Promise<SchoolDecisionOutcome>;
  /** Server-classified school search, kept per request id by the hook. */
  readonly onSearchSchools: (requestId: number, query: string) => Promise<SchoolRoutingCandidate[] | null>;
  readonly candidatesFor: (requestId: number) => readonly SchoolRoutingCandidate[];
  readonly candidatesLoadingFor: (requestId: number) => boolean;
  readonly candidatesErrorFor: (requestId: number) => string | null;
  readonly decisionBusyFor: (requestId: number) => boolean;
  /** When false, the decision dialog offers Route/Group only. */
  readonly allowReject?: boolean;
  /** Guarded draft-school creation from the decision dialog. */
  readonly onCreatePlaceholder: (data: unknown) => Promise<SchoolDraftOutcome | null>;
  /** Refetch the current filter after a committed decision (rows leave the filter). */
  readonly onDecided: () => void;
}

export interface SchoolRequestActionController {
  /** Opens the attendance decision dialog for one concrete request. */
  readonly openDecision: (request: VsSchoolRequest, tab: SchoolDecisionTab) => void;
  /** Opens the legacy review dialog for one concrete request id. */
  readonly openLegacyReview: (id: number, action: "Approve" | "Reject") => void;
  /** The modal tree wired to the controller state; render it once per surface. */
  readonly modals: React.ReactNode;
}

function isDecisionRoute(value: string): value is SchoolVerificationRoute {
  return value === "DIRECT_REVIEW" || value === "AWAITING_ACTIVATION" || value === "AWAITING_REGISTRATION";
}

/** Narrow hook candidates to the dialog's server-derived route union. */
function toDecisionCandidates(
  candidates: readonly SchoolRoutingCandidate[],
): { school_id: number; school_name: string; city_municipality: string | null; province: string | null; verification_route: SchoolVerificationRoute }[] {
  const narrowed: { school_id: number; school_name: string; city_municipality: string | null; province: string | null; verification_route: SchoolVerificationRoute }[] = [];
  for (const candidate of candidates) {
    if (!isDecisionRoute(candidate.verification_route)) continue;
    narrowed.push({
      school_id: candidate.school_id,
      school_name: candidate.school_name,
      city_municipality: candidate.city_municipality,
      province: candidate.province,
      verification_route: candidate.verification_route,
    });
  }
  return narrowed;
}

export function useSchoolRequestActionController({
  mode,
  onReview,
  onDecide,
  onSearchSchools,
  candidatesFor,
  candidatesLoadingFor,
  candidatesErrorFor,
  decisionBusyFor,
  onCreatePlaceholder,
  onDecided,
  allowReject = true,
}: SchoolRequestActionControllerOptions): SchoolRequestActionController {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [reviewAction, setReviewAction] = useState<"Approve" | "Reject" | null>(null);
  const [decisionRequest, setDecisionRequest] = useState<VsSchoolRequest | null>(null);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionTab, setDecisionTab] = useState<SchoolDecisionTab>("correct");
  const [decisionEpoch, setDecisionEpoch] = useState(0);
  const lastSearchQuery = useRef<Record<number, string>>({});
  const triggerRef = useRef<HTMLElement | null>(null);

  const rememberTrigger = useCallback(() => {
    const active = document.activeElement;
    triggerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }, []);

  const openLegacyReview = useCallback((id: number, action: "Approve" | "Reject") => {
    rememberTrigger();
    setSelectedRequest(id);
    setReviewAction(action);
    setReviewOpen(true);
  }, [rememberTrigger]);

  const submitReview = async (data: ReviewAction) => {
    if (!selectedRequest) return false;
    return await onReview(selectedRequest, data);
  };

  const openDecision = useCallback((request: VsSchoolRequest, tab: SchoolDecisionTab) => {
    rememberTrigger();
    setDecisionRequest(request);
    setDecisionTab(tab);
    setDecisionEpoch((epoch) => epoch + 1);
    setDecisionOpen(true);
  }, [rememberTrigger]);

  const dialogOpen = reviewOpen || decisionOpen;

  // Controlled dialogs have no DialogTrigger, so Radix cannot restore focus on close.
  useEffect(() => {
    if (dialogOpen) return;
    const trigger = triggerRef.current;
    triggerRef.current = null;
    if (trigger !== null && trigger.isConnected) trigger.focus();
  }, [dialogOpen]);

  const handleSearch = (requestId: number, query: string) => {
    lastSearchQuery.current[requestId] = query;
    void onSearchSchools(requestId, query);
  };

  const handleRetrySearch = (requestId: number) => {
    void onSearchSchools(requestId, lastSearchQuery.current[requestId] ?? "");
  };

  /** Returns true when the dialog should close (decided OR stale-refetched). */
  const settleDecision = async (
    requestId: number,
    decision: SchoolRequestDecision,
  ): Promise<boolean> => {
    const outcome = await onDecide(requestId, decision);
    if (outcome.kind === "decided" || outcome.kind === "stale") {
      onDecided();
      return true;
    }
    toast.error(outcome.message);
    return false;
  };

  const handleRoute = async (schoolId: number): Promise<boolean> => {
    if (!decisionRequest) return false;
    return settleDecision(decisionRequest.school_request_id, {
      action: "Route",
      matched_school_id: schoolId,
    });
  };

  const handleGroup = async (schoolId: number): Promise<boolean> => {
    if (!decisionRequest) return false;
    return settleDecision(decisionRequest.school_request_id, {
      action: "Group",
      matched_school_id: schoolId,
    });
  };

  const handleDecisionReject = async (adminRemarks: string): Promise<boolean> => {
    if (!decisionRequest) return false;
    return settleDecision(decisionRequest.school_request_id, {
      action: "Rejected",
      admin_remarks: adminRemarks,
    });
  };

  const handleCreatePlaceholder = async (input: SchoolPlaceholderInput): Promise<SchoolDraftOutcome | null> => {
    return onCreatePlaceholder({
      school_name: input.school_name,
      ...(input.city_municipality !== undefined ? { city_municipality: input.city_municipality } : {}),
      ...(input.province !== undefined ? { province: input.province } : {}),
    });
  };

  const decisionRequestId = decisionRequest?.school_request_id ?? null;

  const modals = (
    <>
      {mode === "legacy" ? (
        <ReviewModal
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          action={reviewAction}
          requestType="School"
          onSubmit={submitReview}
        />
      ) : null}

      {mode === "attendance" ? (
        <SchoolRequestDecisionModal
          key={`${decisionRequestId ?? "none"}:${decisionEpoch}`}
          open={decisionOpen}
          onOpenChange={setDecisionOpen}
          request={decisionRequest}
          initialTab={decisionTab}
          candidates={decisionRequestId === null ? [] : toDecisionCandidates(candidatesFor(decisionRequestId))}
          candidatesLoading={decisionRequestId === null ? false : candidatesLoadingFor(decisionRequestId)}
          candidatesError={decisionRequestId === null ? null : candidatesErrorFor(decisionRequestId)}
          onRetryCandidates={decisionRequestId === null ? undefined : () => handleRetrySearch(decisionRequestId)}
          onSearch={decisionRequestId === null ? () => undefined : (query) => handleSearch(decisionRequestId, query)}
          mutating={decisionRequestId === null ? false : decisionBusyFor(decisionRequestId)}
          onRoute={handleRoute}
          onGroup={handleGroup}
          onReject={handleDecisionReject}
          onCreatePlaceholder={handleCreatePlaceholder}
          allowReject={allowReject}
        />
      ) : null}
    </>
  );

  return { openDecision, openLegacyReview, modals };
}

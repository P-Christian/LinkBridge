// src/modules/vos-admin/request-management/components/SchoolRequestDecisionModal.tsx
//
// School-request-only correction dialog (attendance lane). The dialog never
// fetches and never mutates server state itself: the hook supplies
// server-classified candidates and the composing controller performs every
// Route/Group/Reject mutation. Local state is limited to dialog controls (tab,
// selection, armed confirm) plus the sibling draft dialog, which returns a
// created draft as an already-selected option. The legacy ReviewModal stays
// intact behind `legacy` mode.
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CreateSchoolDraftModal } from "./CreateSchoolDraftModal";
import type { SchoolDraftOutcome, VsSchoolRequest } from "../types/request.types";

export type SchoolDecisionTab = "correct" | "reject";

/**
 * Server-derived route state per selectable school. Mirrors
 * `classifySchoolRoute` (school-request-routing/records.ts) and
 * `classifySearchRow` (schoolRouteSearch.repo.ts). Null is excluded: only
 * classified schools ever reach this dialog.
 */
export type SchoolVerificationRoute =
  | "DIRECT_REVIEW"
  | "AWAITING_ACTIVATION"
  | "AWAITING_REGISTRATION";

/**
 * Client-safe selectable school candidate as returned by the role-guarded
 * `GET /api/vos-admin/schools?search=` endpoint. Option values are these
 * typed IDs; free-form numeric school-ID input is never accepted.
 */
export interface SchoolRoutingCandidate {
  readonly school_id: number;
  readonly school_name: string;
  readonly city_municipality: string | null;
  readonly province: string | null;
  readonly verification_route: SchoolVerificationRoute;
}

/** Guarded draft-school input: name required, location optional. */
export interface SchoolPlaceholderInput {
  readonly school_name: string;
  readonly city_municipality?: string;
  readonly province?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The school request under review. Null renders nothing (dialog stays closed-safe). */
  request: VsSchoolRequest | null;
  initialTab?: SchoolDecisionTab;
  /** Server-classified selectable schools from the VOS correction search. */
  candidates: readonly SchoolRoutingCandidate[];
  candidatesLoading: boolean;
  candidatesError: string | null;
  onRetryCandidates?: () => void;
  /** Forward a debounced, non-blank search term to the server-classified search. */
  onSearch: (query: string) => void;
  /** True while a decision mutation is in flight; all controls lock. */
  mutating: boolean;
  onRoute: (schoolId: number) => Promise<boolean>;
  onGroup: (schoolId: number) => Promise<boolean>;
  onReject: (adminRemarks: string) => Promise<boolean>;
  onCreatePlaceholder: (input: SchoolPlaceholderInput) => Promise<SchoolDraftOutcome | null>;
  allowReject?: boolean;
}

/** Debounce before a typed term reaches the server-classified search. */
const SEARCH_DEBOUNCE_MS = 300;

function submitterLabel(request: VsSchoolRequest): string {
  const by = request.requested_by;
  if (typeof by === "object" && by !== null) {
    const name = `${by.user_fname} ${by.user_lname}`.trim();
    return name === "" ? "An applicant" : name;
  }
  return "Unknown applicant";
}

function requestedIdentity(request: VsSchoolRequest): string {
  const location = [request.city_municipality, request.province]
    .filter((part) => typeof part === "string" && part.trim() !== "")
    .join(", ");
  return location === "" ? request.requested_school_name : `${request.requested_school_name} — ${location}`;
}

function candidateLabel(c: SchoolRoutingCandidate): string {
  const location = [c.city_municipality, c.province]
    .filter((part) => typeof part === "string" && part.trim() !== "")
    .join(", ");
  const route =
    c.verification_route === "DIRECT_REVIEW"
      ? "Direct review"
      : c.verification_route === "AWAITING_ACTIVATION"
        ? "Awaiting activation"
        : "Awaiting registration";
  const place = location === "" ? "" : ` — ${location}`;
  return `${c.school_name}${place} (${route})`;
}

export function SchoolRequestDecisionModal({
  open,
  onOpenChange,
  request,
  initialTab = "correct",
  candidates,
  candidatesLoading,
  candidatesError,
  onRetryCandidates,
  onSearch,
  mutating,
  onRoute,
  onGroup,
  onReject,
  onCreatePlaceholder,
  allowReject = true,
}: Props) {
  const effectiveInitialTab: SchoolDecisionTab = allowReject ? initialTab : "correct";
  const decisionTabs: readonly SchoolDecisionTab[] = allowReject ? ["correct", "reject"] : ["correct"];
  const [tab, setTab] = useState<SchoolDecisionTab>(effectiveInitialTab);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | undefined>(undefined);
  const [remarks, setRemarks] = useState("");
  const [confirmArmed, setConfirmArmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [createdCandidate, setCreatedCandidate] = useState<SchoolRoutingCandidate | null>(null);

  const requestKey = request?.school_request_id ?? null;
  const [lastSessionKey, setLastSessionKey] = useState<string | null>(null);
  const sessionKey = open && requestKey !== null ? `${requestKey}:${effectiveInitialTab}` : null;
  if (sessionKey !== lastSessionKey) {
    setLastSessionKey(sessionKey);
    if (sessionKey !== null) {
      setTab(effectiveInitialTab);
      setSelectedSchoolId(undefined);
      setRemarks("");
      setConfirmArmed(false);
      setSubmitting(false);
      setDraftOpen(false);
      setCreatedCandidate(null);
    }
  }

  const searchTimerRef = useRef<number | null>(null);
  const clearSearchTimer = useCallback(() => {
    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  }, []);
  useEffect(() => clearSearchTimer, [clearSearchTimer]);
  useEffect(() => {
    if (!open) clearSearchTimer();
  }, [open, clearSearchTimer]);

  // The just-created draft stays selectable even before the refreshed server
  // search returns it; a server copy of the same school id wins the merge.
  const mergedCandidates = useMemo(() => {
    if (createdCandidate === null) return candidates;
    if (candidates.some((c) => c.school_id === createdCandidate.school_id)) return candidates;
    return [createdCandidate, ...candidates];
  }, [candidates, createdCandidate]);

  const selected = useMemo(
    () => mergedCandidates.find((c) => String(c.school_id) === selectedSchoolId) ?? null,
    [mergedCandidates, selectedSchoolId],
  );

  const options = useMemo(
    () =>
      mergedCandidates.map((c) => ({
        value: String(c.school_id),
        label: candidateLabel(c),
      })),
    [mergedCandidates],
  );

  const busy = mutating || submitting;
  // The selected route state alone determines Route vs Group — never a toggle.
  const selectedAction = selected === null ? null : selected.verification_route === "DIRECT_REVIEW" ? "Route" : "Group";
  const correctDisabled = busy || candidatesLoading || candidatesError !== null || selected === null;
  const rejectDisabled = busy || remarks.trim() === "";

  const resetArmed = () => setConfirmArmed(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) setDraftOpen(false);
    onOpenChange(next);
  };

  const handleSearchChange = (term: string) => {
    clearSearchTimer();
    resetArmed();
    const trimmed = term.trim();
    if (trimmed === "") return;
    searchTimerRef.current = window.setTimeout(() => {
      searchTimerRef.current = null;
      onSearch(trimmed);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleCorrectConfirm = async () => {
    if (selected === null) return;
    setSubmitting(true);
    try {
      const ok =
        selected.verification_route === "DIRECT_REVIEW"
          ? await onRoute(selected.school_id)
          : await onGroup(selected.school_id);
      if (ok) {
        resetArmed();
        handleOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (remarks.trim() === "") return;
    setSubmitting(true);
    try {
      const ok = await onReject(remarks);
      if (ok) {
        resetArmed();
        handleOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDraftSubmit = async (input: SchoolPlaceholderInput): Promise<SchoolDraftOutcome | null> => {
    const outcome = await onCreatePlaceholder(input);
    if (outcome === null) return null;
    setCreatedCandidate({
      school_id: outcome.school_id,
      school_name: outcome.school_name,
      city_municipality: outcome.city_municipality,
      province: outcome.province,
      verification_route: outcome.verification_route,
    });
    setSelectedSchoolId(String(outcome.school_id));
    resetArmed();
    setDraftOpen(false);
    // Refresh the server search for the created name so the persisted state agrees.
    onSearch(outcome.school_name);
    return outcome;
  };

  if (!request) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={busy ? () => undefined : handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review school request</DialogTitle>
          </DialogHeader>

          <div className="min-w-0 space-y-4 py-4">
            <div className="min-w-0 rounded-md border p-3 text-sm" data-testid="school-decision-identity">
              <div className="break-words font-medium">Requested school: {requestedIdentity(request)}</div>
              <div className="mt-1 break-words text-muted-foreground">Submitted by {submitterLabel(request)}</div>
            </div>

            {decisionTabs.length > 1 ? (
              <div className="flex gap-2" role="tablist" aria-label="Decision type">
                {decisionTabs.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={tab === t ? "default" : "outline"}
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setTab(t);
                      resetArmed();
                    }}
                    data-testid={`school-decision-tab-${t}`}
                  >
                    {t === "correct" ? "Route / Group" : "Reject"}
                  </Button>
                ))}
              </div>
            ) : null}

            {tab === "correct" && (
              <div className="space-y-2" data-testid="school-decision-correct">
                <Label>Select a school</Label>
                <SearchableSelect
                  options={options}
                  value={selectedSchoolId}
                  onValueChange={(value) => {
                    setSelectedSchoolId(value);
                    resetArmed();
                  }}
                  onSearchChange={handleSearchChange}
                  serverFiltered
                  placeholder="Select a school"
                  searchPlaceholder="Search by school name"
                  ariaLabel="Select a school"
                  disabled={busy}
                />

                {candidatesLoading ? (
                  <p className="text-sm text-muted-foreground" data-testid="school-decision-loading">
                    Loading schools...
                  </p>
                ) : candidatesError !== null ? (
                  <div className="space-y-2" data-testid="school-decision-error">
                    <p className="text-sm text-red-600">{candidatesError}</p>
                    {onRetryCandidates && (
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRetryCandidates} data-testid="school-decision-retry">
                        Retry
                      </Button>
                    )}
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="space-y-2" data-testid="school-decision-empty">
                    <p className="text-sm text-muted-foreground">
                      No matching school found. If the school is not in the system yet, add it as a draft.
                    </p>
                  </div>
                ) : null}

                {!candidatesLoading && candidatesError === null && candidates.length > 1 ? (
                  <p className="text-sm text-amber-700" data-testid="school-decision-ambiguous">
                    Multiple schools match — select the exact school. Nothing is applied until
                    you confirm.
                  </p>
                ) : null}

                {selected !== null && (
                  <p className="break-words text-sm text-muted-foreground" data-testid="school-decision-selected-route">
                    {selected.verification_route === "DIRECT_REVIEW"
                      ? "This school has an account and can review requests now. Confirming will send this request to them."
                      : "This school does not have an account yet. Confirming will keep this request waiting for them."}
                  </p>
                )}

                {!confirmArmed ? (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={correctDisabled}
                    onClick={() => setConfirmArmed(true)}
                    data-testid="school-decision-correct-start"
                  >
                    {busy
                      ? "Processing..."
                      : selectedAction === null
                        ? "Select a school"
                        : selectedAction === "Route"
                          ? "Send to school"
                          : "Keep waiting for school"}
                  </Button>
                ) : (
                  selected !== null &&
                  selectedAction !== null && (
                    <div className="space-y-2" data-testid="school-decision-correct-confirm">
                      <p className="break-words text-sm font-medium">
                        {selectedAction === "Route"
                          ? `Send this request to ${selected.school_name}?`
                          : `Keep this request waiting for ${selected.school_name}?`}
                      </p>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={resetArmed}>
                          Back
                        </Button>
                        <Button
                          type="button"
                          className="flex-1"
                          disabled={correctDisabled}
                          onClick={handleCorrectConfirm}
                          data-testid="school-decision-correct-confirm-submit"
                        >
                          {busy ? "Processing..." : "Confirm"}
                        </Button>
                      </div>
                    </div>
                  )
                )}

                <Button
                  type="button"
                  variant="link"
                  className="h-auto w-full justify-start whitespace-normal p-0 text-left text-sm"
                  disabled={busy}
                  onClick={() => setDraftOpen(true)}
                  data-testid="school-decision-placeholder-start"
                >
                  Requested school not in the list? Create a draft.
                </Button>
              </div>
            )}

            {allowReject && tab === "reject" && (
              <div className="space-y-2" data-testid="school-decision-reject">
                <Label>Reason for rejection (required)</Label>
                <p className="text-sm text-muted-foreground">Provide a reason for rejecting this request.</p>
                <Textarea
                  placeholder="Reason for rejection..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={busy}
                  data-testid="school-decision-remarks"
                />
                {remarks.trim() === "" && (
                  <p className="text-sm text-red-600" data-testid="school-decision-reject-validation">
                    A reason for rejection is required.
                  </p>
                )}
                {!confirmArmed ? (
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full"
                    disabled={rejectDisabled}
                    onClick={() => setConfirmArmed(true)}
                    data-testid="school-decision-reject-start"
                  >
                    {busy ? "Processing..." : "Reject request"}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Confirm rejecting this request?</p>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={resetArmed}>
                        Back
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="flex-1"
                        disabled={rejectDisabled}
                        onClick={handleReject}
                        data-testid="school-decision-reject-confirm"
                      >
                        {busy ? "Processing..." : "Confirm rejection"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateSchoolDraftModal
        open={draftOpen}
        onOpenChange={setDraftOpen}
        initialName={request.requested_school_name}
        initialCity={request.city_municipality ?? ""}
        initialProvince={request.province ?? ""}
        onSubmit={handleDraftSubmit}
      />
    </>
  );
}

// src/modules/vos-admin/request-management/components/CourseRequestDecisionModal.tsx
"use client";

import React, { useMemo, useState } from "react";
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
import type { VsCourseRequest } from "../types/request.types";

export type CourseDecisionTab = "approve" | "route" | "reject";

/**
 * Typed Active course candidate as returned by the request-scoped
 * `GET /api/vos-admin/course-requests/[id]/candidates` endpoint.
 * Option values are these typed IDs; free-form IDs are never accepted.
 */
export interface CourseDecisionCandidate {
  readonly school_course_id: number;
  readonly school_id: number;
  readonly course_name: string;
  readonly course_code: string | null;
  readonly degree: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The course request under review. Null renders nothing (dialog stays closed-safe). */
  request: VsCourseRequest | null;
  initialTab?: CourseDecisionTab;
  /** Active same-school candidates from the request-scoped endpoint. */
  candidates: readonly CourseDecisionCandidate[];
  candidatesLoading: boolean;
  candidatesError: string | null;
  onRetryCandidates?: () => void;
  /** True while a decision mutation is in flight; all controls lock. */
  mutating: boolean;
  onApprove: (matchedSchoolCourseId: number) => Promise<boolean>;
  onRoute: () => Promise<boolean>;
  onReject: (adminRemarks: string) => Promise<boolean>;
}

function targetSchoolLabel(request: VsCourseRequest): string {
  const school = request.school_id;
  if (typeof school === "object" && school !== null) {
    return (school as { school_name: string }).school_name;
  }
  return `School ID: ${String(school)}`;
}

function candidateLabel(c: CourseDecisionCandidate): string {
  const code = c.course_code ? ` (${c.course_code})` : "";
  const degree = c.degree ? ` — ${c.degree}` : "";
  return `${c.course_name}${code}${degree}`;
}

export function CourseRequestDecisionModal({
  open,
  onOpenChange,
  request,
  initialTab = "approve",
  candidates,
  candidatesLoading,
  candidatesError,
  onRetryCandidates,
  mutating,
  onApprove,
  onRoute,
  onReject,
}: Props) {
  const [tab, setTab] = useState<CourseDecisionTab>(initialTab);
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(undefined);
  const [remarks, setRemarks] = useState("");
  const [routeArmed, setRouteArmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const requestKey = request?.course_request_id ?? null;
  const [lastSessionKey, setLastSessionKey] = useState<string | null>(null);
  const sessionKey =
    open && requestKey !== null ? `${requestKey}:${initialTab}` : null;
  if (sessionKey !== lastSessionKey) {
    setLastSessionKey(sessionKey);
    if (sessionKey !== null) {
      setTab(initialTab);
      setSelectedCourseId(undefined);
      setRemarks("");
      setRouteArmed(false);
      setSubmitting(false);
    }
  }

  // A persisted claim locks the course: matched id present while still Pending.
  const claimedCourseId = request?.matched_school_course_id ?? null;
  const isClaimed = request !== null && claimedCourseId !== null;
  const claimInitiator = request?.reviewed_by ?? null;

  const lockedCandidate = useMemo(
    () => candidates.find((c) => c.school_course_id === claimedCourseId) ?? null,
    [candidates, claimedCourseId],
  );

  const options = useMemo(
    () =>
      candidates.map((c) => ({
        value: String(c.school_course_id),
        label: candidateLabel(c),
      })),
    [candidates],
  );

  const busy = mutating || submitting;
  const approveDisabled =
    busy || candidatesLoading || candidatesError !== null || selectedCourseId === undefined;
  const rejectDisabled = busy || remarks.trim() === "";
  const routeDisabled = busy;

  const handleApprove = async () => {
    if (selectedCourseId === undefined) return;
    const courseId = Number(selectedCourseId);
    if (!Number.isInteger(courseId) || courseId <= 0) return;
    setSubmitting(true);
    try {
      const ok = await onApprove(courseId);
      if (ok) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResume = async () => {
    if (claimedCourseId === null) return;
    setSubmitting(true);
    try {
      const ok = await onApprove(claimedCourseId);
      if (ok) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRouteConfirm = async () => {
    setSubmitting(true);
    try {
      const ok = await onRoute();
      if (ok) {
        setRouteArmed(false);
        onOpenChange(false);
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
      if (ok) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={busy ? () => undefined : onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Review Course Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">Target school: {targetSchoolLabel(request)}</div>
            <div className="mt-1 text-muted-foreground">
              Requested course: {request.requested_course_name}
              {request.requested_course_code ? ` (${request.requested_course_code})` : ""}
            </div>
          </div>

          {isClaimed ? (
            <div className="space-y-3" data-testid="course-decision-finalizing">
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                <div className="font-medium">Finalizing — claim persisted</div>
                <p className="mt-1 text-muted-foreground">
                  The matched course is locked to this claim. Claim initiated by{" "}
                  {claimInitiator !== null ? `Admin Portal #${claimInitiator}` : "a Admin Portal"}.
                  Any currently authorized Admin Portal may resume approval for the same claim.
                </p>
                <div className="mt-2 font-medium">
                  Locked course:{" "}
                  {lockedCandidate ? candidateLabel(lockedCandidate) : `Course ID ${claimedCourseId}`}
                </div>
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={busy}
                onClick={handleResume}
                data-testid="course-decision-resume"
              >
                {busy ? "Processing..." : "Resume approval"}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2" role="tablist" aria-label="Decision type">
                {(["approve", "route", "reject"] as const).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={tab === t ? "default" : "outline"}
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setTab(t);
                      setRouteArmed(false);
                    }}
                    data-testid={`course-decision-tab-${t}`}
                  >
                    {t === "approve" ? "Match & Approve" : t === "route" ? "Route to School" : "Reject"}
                  </Button>
                ))}
              </div>

              {tab === "approve" && (
                <div className="space-y-2" data-testid="course-decision-approve">
                  <Label>Matched course (Required)</Label>
                  <p className="text-sm text-muted-foreground">
                    Select the Active course at the target school this request maps to.
                  </p>
                  {candidatesLoading ? (
                    <p className="text-sm text-muted-foreground" data-testid="course-decision-loading">
                      Loading candidates...
                    </p>
                  ) : candidatesError !== null ? (
                    <div className="space-y-2" data-testid="course-decision-error">
                      <p className="text-sm text-red-600">{candidatesError}</p>
                      {onRetryCandidates && (
                        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRetryCandidates}>
                          Retry
                        </Button>
                      )}
                    </div>
                  ) : candidates.length === 0 ? (
                    <div className="space-y-2" data-testid="course-decision-empty">
                      <p className="text-sm text-muted-foreground">
                        No Active courses found at the target school. Route this request to the
                        school instead.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          setTab("route");
                          setRouteArmed(false);
                        }}
                      >
                        Go to Route to School
                      </Button>
                    </div>
                  ) : (
                    <SearchableSelect
                      options={options}
                      value={selectedCourseId}
                      onValueChange={setSelectedCourseId}
                      placeholder="Select a course..."
                      disabled={busy}
                    />
                  )}
                  <Button
                    type="button"
                    className="w-full"
                    disabled={approveDisabled}
                    onClick={handleApprove}
                    data-testid="course-decision-approve-submit"
                  >
                    {busy ? "Processing..." : "Confirm approval"}
                  </Button>
                </div>
              )}

              {tab === "route" && (
                <div className="space-y-2" data-testid="course-decision-route">
                  <Label>Route to school</Label>
                  {!routeArmed ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Hand this request to the target school for course resolution.
                      </p>
                      <Button
                        type="button"
                        className="w-full"
                        variant="outline"
                        disabled={routeDisabled}
                        onClick={() => setRouteArmed(true)}
                        data-testid="course-decision-route-start"
                      >
                        Route to school
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium">
                        Confirm routing this request to {targetSchoolLabel(request)}?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          disabled={busy}
                          onClick={() => setRouteArmed(false)}
                        >
                          Back
                        </Button>
                        <Button
                          type="button"
                          className="flex-1"
                          disabled={routeDisabled}
                          onClick={handleRouteConfirm}
                          data-testid="course-decision-route-confirm"
                        >
                          {busy ? "Processing..." : "Confirm route"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {tab === "reject" && (
                <div className="space-y-2" data-testid="course-decision-reject">
                  <Label>Admin Remarks (Required)</Label>
                  <p className="text-sm text-muted-foreground">
                    Provide a reason for rejecting this request.
                  </p>
                  <Textarea
                    placeholder="Reason for rejection..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    disabled={busy}
                    data-testid="course-decision-remarks"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full"
                    disabled={rejectDisabled}
                    onClick={handleReject}
                    data-testid="course-decision-reject-submit"
                  >
                    {busy ? "Processing..." : "Confirm rejection"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

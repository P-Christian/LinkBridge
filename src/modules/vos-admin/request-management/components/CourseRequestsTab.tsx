// src/modules/vos-admin/request-management/components/CourseRequestsTab.tsx
"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Check, X } from "lucide-react";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import type {
  CourseDecisionFeedback,
  CourseDecisionOutcome,
  CourseRequestDecision,
  PersistedCourseClaim,
  VsCourseRequest,
} from "../types/request.types";
import { availableCourseActions } from "../hooks/useRequests";
import { RequestStatusBadge } from "./RequestStatusBadge";
import {
  CourseRequestDecisionModal,
  type CourseDecisionCandidate,
  type CourseDecisionTab,
} from "./CourseRequestDecisionModal";
import { Button } from "@/components/ui/button";
import { DataTable } from "./new-data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Card } from "@/components/ui/card";

interface Props {
  requests: VsCourseRequest[];
  claims: Record<number, PersistedCourseClaim>;
  feedback: Record<number, CourseDecisionFeedback>;
  busy: Record<number, boolean>;
  onDecide: (requestId: number, decision: CourseRequestDecision) => Promise<CourseDecisionOutcome>;
  onResume: (requestId: number) => Promise<CourseDecisionOutcome>;
}

/**
 * A persisted claim-first partial write (Pending + matched course + reviewer)
 * is a claimed row even without a client claim object, so it exposes
 * Resume-only instead of conflicting approve/reject actions.
 */
export function effectiveCourseClaim(
  req: VsCourseRequest,
  claims: Record<number, PersistedCourseClaim>,
): PersistedCourseClaim | undefined {
  const client = claims[req.course_request_id];
  if (client !== undefined) return client;
  if (
    req.request_status === "Pending" &&
    req.matched_school_course_id != null &&
    typeof req.reviewed_by === "number"
  ) {
    return {
      requestId: req.course_request_id,
      courseId: req.matched_school_course_id,
      claimInitiator: req.reviewed_by,
      phase: "finalizing",
    };
  }
  return undefined;
}

export function CourseRequestsTab({ requests, claims, feedback, busy, onDecide, onResume }: Props) {
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VsCourseRequest | null>(null);
  const [initialTab, setInitialTab] = useState<CourseDecisionTab>("approve");
  const [candidates, setCandidates] = useState<CourseDecisionCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);

  const abortCandidates = useRequestAbort();

  const loadCandidates = useCallback(async (id: number) => {
    setCandidatesLoading(true);
    setCandidatesError(null);
    // The course list is what the approve button submits against, so only the
    // read for the request currently open may write it. Otherwise request A's
    // slow response lands under request B's modal and B gets approved with one
    // of A's courses.
    const signal = abortCandidates();
    try {
      const res = await fetch(`/api/vos-admin/course-requests/${id}/candidates`, { signal });
      const json: { candidates?: CourseDecisionCandidate[]; error?: string } = await res.json();
      if (signal.aborted) return;
      if (!res.ok) throw new Error(json.error || "Failed to load candidates");
      setCandidates(json.candidates ?? []);
    } catch (err: unknown) {
      if (signal.aborted) return;
      setCandidates([]);
      setCandidatesError((err as Error).message);
    } finally {
      if (!signal.aborted) setCandidatesLoading(false);
    }
  }, [abortCandidates]);

  const handleReview = useCallback((req: VsCourseRequest, tab: CourseDecisionTab) => {
    setSelectedRequest(req);
    setInitialTab(tab);
    // Rows from the previous request must not sit behind this one while its own
    // candidates are still loading.
    setCandidates([]);
    setDecisionOpen(true);
    void loadCandidates(req.course_request_id);
  }, [loadCandidates]);

  const closeDecision = useCallback((open: boolean) => {
    if (!open) {
      // Claim the token so a read still running cannot write into a closed modal.
      abortCandidates();
      setCandidates([]);
    }
    setDecisionOpen(open);
  }, [abortCandidates]);

  const submitDecision = async (decision: CourseRequestDecision): Promise<boolean> => {
    if (!selectedRequest) return false;
    const outcome = await onDecide(selectedRequest.course_request_id, decision);
    return outcome.kind === "decided";
  };

  const handleApprove = async (matchedSchoolCourseId: number): Promise<boolean> =>
    submitDecision({ action: "Approved", matched_school_course_id: matchedSchoolCourseId });

  const handleRoute = async (): Promise<boolean> =>
    submitDecision({ action: "RoutedToSchool" });

  const handleReject = async (adminRemarks: string): Promise<boolean> =>
    submitDecision({ action: "Rejected", admin_remarks: adminRemarks });

  const handleResumeRow = useCallback(async (req: VsCourseRequest): Promise<void> => {
    await onResume(req.course_request_id);
  }, [onResume]);

  const selectedBusy = selectedRequest ? (busy[selectedRequest.course_request_id] ?? false) : false;

  const columns = useMemo<ColumnDef<VsCourseRequest>[]>(() => [
    {
      id: "target_school",
      header: "Target School",
      cell: ({ row }) => {
        const school = row.original.school_id;
        return typeof school === 'object' && school !== null
          ? (school as {school_name: string}).school_name
          : `School ID: ${school}`;
      }
    },
    {
      accessorKey: "requested_course_name",
      header: "Requested Course Name",
    },
    {
      accessorKey: "requested_course_code",
      header: "Code",
      cell: ({ row }) => row.original.requested_course_code || "-"
    },
    {
      id: "submitted_by",
      header: "Submitted By",
      cell: ({ row }) => {
        const by = row.original.requested_by;
        return typeof by === 'object' && by !== null
          ? `${by.user_fname} ${by.user_lname}`
          : `User #${by}`;
      }
    },
    {
      accessorKey: "request_status",
      header: "Status",
      cell: ({ row }) => <RequestStatusBadge status={row.original.request_status} />
    },
    {
      id: "route_audit",
      header: "Route Audit",
      cell: ({ row }) => {
        const req = row.original;
        if (req.request_status !== "RoutedToSchool") {
          return <span className="text-muted-foreground">-</span>;
        }
        const when = req.routed_at ? new Date(req.routed_at).toLocaleDateString() : "Unknown date";
        const actor = req.routed_by == null ? "System auto-route" : `Admin Portal #${req.routed_by}`;
        return (
          <span data-testid={`course-route-audit-${req.course_request_id}`}>
            {when} &middot; {actor}
          </span>
        );
      }
    },
    {
      accessorKey: "created_at",
      header: "Submitted At",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString()
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const req = row.original;
        const actions = availableCourseActions(req.request_status, effectiveCourseClaim(req, claims));
        const rowBusy = busy[req.course_request_id] ?? false;
        const rowFeedback = feedback[req.course_request_id];
        if (actions.includes("resume")) {
          return (
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={rowBusy}
                onClick={() => void handleResumeRow(req)}
                data-testid={`course-resume-${req.course_request_id}`}
              >
                {rowBusy ? "Processing..." : "Resume"}
              </Button>
              {rowFeedback && (
                <span
                  className="text-xs text-muted-foreground"
                  data-testid={`course-feedback-${req.course_request_id}`}
                >
                  {rowFeedback.message}
                </span>
              )}
            </div>
          );
        }
        if (actions.length === 0) {
          return (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-muted-foreground">-</span>
              {rowFeedback && (
                <span
                  className="text-xs text-muted-foreground"
                  data-testid={`course-feedback-${req.course_request_id}`}
                >
                  {rowFeedback.message}
                </span>
              )}
            </div>
          );
        }
        return (
          <div className="flex flex-col items-end gap-1">
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={rowBusy}
                onClick={() => handleReview(req, 'reject')}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={rowBusy}
                onClick={() => handleReview(req, 'approve')}
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
            {rowFeedback && (
              <span
                className="text-xs text-muted-foreground"
                data-testid={`course-feedback-${req.course_request_id}`}
              >
                {rowFeedback.message}
              </span>
            )}
          </div>
        );
      }
    }
  ], [claims, feedback, busy, handleReview, handleResumeRow]);

  return (
    <div className="space-y-4 pt-4">
      <Card className="p-6 border-0 shadow-sm bg-white dark:bg-zinc-900 rounded-xl">
        <DataTable
          columns={columns}
          data={requests}
          searchKey="requested_course_name"
          emptyTitle="No course requests"
          emptyDescription="There are currently no missing course requests to review."
        />
      </Card>
      <CourseRequestDecisionModal
        open={decisionOpen}
        onOpenChange={closeDecision}
        request={selectedRequest}
        initialTab={initialTab}
        candidates={candidates}
        candidatesLoading={candidatesLoading}
        candidatesError={candidatesError}
        onRetryCandidates={
          selectedRequest ? () => void loadCandidates(selectedRequest.course_request_id) : undefined
        }
        mutating={selectedBusy}
        onApprove={handleApprove}
        onRoute={handleRoute}
        onReject={handleReject}
      />
    </div>
  );
}

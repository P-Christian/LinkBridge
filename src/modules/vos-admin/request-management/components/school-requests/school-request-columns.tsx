// School-request table columns: the exact per-row presentation shared by the
// unrouted queue and grouped-demand detail surfaces (requested school,
// location, submitter, target, route audit, status, submitted date, and the
// per-request action cell). The action cell offers attendance Route/Group
// entry points, a Match entry point for an unmatched claim, the legacy review
// entry points, or a read-only indicator with any per-request feedback; frozen
// mode never renders a mutation control.
"use client";

import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Link2, X } from "lucide-react";
import { VsSchoolRequest } from "../../types/request.types";
import {
  describeSchoolRouteAudit,
  renderSchoolRouteAudit,
} from "../../hooks/useRequests";
import type { SchoolDecisionFeedback } from "../../hooks/useRequests";
import { RequestStatusBadge, isWaitingSchoolRequest } from "../RequestStatusBadge";
import type { SchoolDecisionTab } from "../SchoolRequestDecisionModal";
import { Button } from "@/components/ui/button";
import type { SchoolRequestsMode } from "./school-request-mode";

export interface SchoolRequestColumnOptions {
  /** Current rollout mode; `attendance` and `legacy` select the action cell. */
  readonly mode: SchoolRequestsMode;
  /** True in `frozen`: every row renders the read-only indicator. */
  readonly readOnly: boolean;
  /** Per-request decision feedback, keyed by `school_request_id`. */
  readonly feedbackFor: (requestId: number) => SchoolDecisionFeedback | undefined;
  /** True while a decision mutation for that request is in flight. */
  readonly decisionBusyFor: (requestId: number) => boolean;
  /** Opens the attendance decision dialog on the given tab. */
  readonly onOpenDecision: (request: VsSchoolRequest, tab: SchoolDecisionTab) => void;
  /** Opens the legacy review dialog for the exact request id. */
  readonly onOpenLegacyReview: (requestId: number, action: "Approve" | "Reject") => void;
}

function SchoolRequestFeedbackNote({
  feedback,
}: {
  feedback: SchoolDecisionFeedback | undefined;
}) {
  if (feedback === undefined) return null;
  return (
    <span
      data-testid="school-request-feedback"
      className={
        feedback.tone === "success"
          ? "text-xs text-emerald-700"
          : feedback.tone === "stale"
            ? "text-xs text-amber-700"
            : "text-xs text-red-600"
      }
    >
      {feedback.message}
    </span>
  );
}

function ReadOnlyActionCell({ feedback }: { feedback: SchoolDecisionFeedback | undefined }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-xs text-muted-foreground">Read-only</span>
      <SchoolRequestFeedbackNote feedback={feedback} />
    </div>
  );
}

function ClaimActionCell({
  request,
  feedback,
  busy,
  onOpenDecision,
}: {
  request: VsSchoolRequest;
  feedback: SchoolDecisionFeedback | undefined;
  busy: boolean;
  onOpenDecision: (request: VsSchoolRequest, tab: SchoolDecisionTab) => void;
}) {
  const requestId = request.school_request_id;
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onOpenDecision(request, "correct")}
        disabled={busy}
        aria-label={`Match claim #${requestId} to a school`}
        data-testid="school-request-match"
      >
        <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
        Match school
      </Button>
      <SchoolRequestFeedbackNote feedback={feedback} />
    </div>
  );
}

function AttendanceActionCell({
  feedback,
  busy,
  onOpenDecision,
  request,
}: {
  feedback: SchoolDecisionFeedback | undefined;
  busy: boolean;
  onOpenDecision: (request: VsSchoolRequest, tab: SchoolDecisionTab) => void;
  request: VsSchoolRequest;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenDecision(request, "reject")}
          disabled={busy}
          aria-label={`Reject request #${request.school_request_id}`}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          data-testid="school-request-reject"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenDecision(request, "correct")}
          disabled={busy}
          aria-label={`Route or group request #${request.school_request_id}`}
          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
          data-testid="school-request-review"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <SchoolRequestFeedbackNote feedback={feedback} />
    </div>
  );
}

function LegacyActionCell({
  requestId,
  disabled,
  onOpenLegacyReview,
}: {
  requestId: number;
  disabled: boolean;
  onOpenLegacyReview: (requestId: number, action: "Approve" | "Reject") => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onOpenLegacyReview(requestId, "Reject")}
        aria-label={`Reject request #${requestId}`}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onOpenLegacyReview(requestId, "Approve")}
        aria-label={`Approve request #${requestId}`}
        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
      >
        <Check className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function buildSchoolRequestColumns({
  mode,
  readOnly,
  feedbackFor,
  decisionBusyFor,
  onOpenDecision,
  onOpenLegacyReview,
}: SchoolRequestColumnOptions): ColumnDef<VsSchoolRequest>[] {
  return [
    {
      accessorKey: "requested_school_name",
      header: "Requested School",
      // Long unbroken names stay inside the cell; full text stays in the title.
      cell: ({ row }) => {
        const isClaim = row.original.request_status === "AwaitingOptIn";
        return (
          <div className="flex max-w-[18rem] flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate" title={row.original.requested_school_name}>
                {row.original.requested_school_name}
              </span>
              {isClaim ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning ring-1 ring-inset ring-warning/30">
                  Claim
                </span>
              ) : null}
            </div>
            {isClaim ? (
              <span className="text-xs text-muted-foreground">Verification not submitted yet</span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "location",
      header: "Location",
      cell: ({ row }) => {
        const { city_municipality, province } = row.original;
        return [city_municipality, province].filter(Boolean).join(", ") || "-";
      },
    },
    {
      id: "submitted_by",
      header: "Submitted By",
      cell: ({ row }) => {
        const by = row.original.requested_by;
        const label =
          typeof by === "object" && by !== null
            ? `${by.user_fname} ${by.user_lname}`.trim() || "Unknown requester"
            : "Unknown requester";
        return (
          <span className="block max-w-[14rem] truncate" title={label}>
            {label}
          </span>
        );
      },
    },
    {
      id: "target",
      header: "Target School",
      cell: ({ row }) => {
        const target = row.original.matched_school_id;
        return (
          <span data-testid="school-request-target">
            {typeof target === "number" ? `School #${target}` : "-"}
          </span>
        );
      },
    },
    {
      id: "route_audit",
      header: "Route Audit",
      cell: ({ row }) => {
        const label = renderSchoolRouteAudit(describeSchoolRouteAudit(row.original));
        return (
          <span data-testid="school-request-audit" className="text-xs text-muted-foreground">
            {label ?? "-"}
          </span>
        );
      },
    },
    {
      accessorKey: "request_status",
      header: "Status",
      cell: ({ row }) => (
        <RequestStatusBadge
          status={row.original.request_status}
          isWaiting={isWaitingSchoolRequest(row.original)}
        />
      ),
    },
    {
      accessorKey: "created_at",
      header: "Submitted At",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const request = row.original;
        const requestId = request.school_request_id;
        const isClaim = request.request_status === "AwaitingOptIn";
        const claimActionable =
          isClaim &&
          request.matched_school_id === null &&
          (mode === "attendance" || mode === "opt-in");
        const actionable = request.request_status === "Pending";
        const feedback = feedbackFor(requestId);
        if (readOnly || (!actionable && !claimActionable)) {
          return <ReadOnlyActionCell feedback={feedback} />;
        }
        if (claimActionable) {
          return (
            <ClaimActionCell
              request={request}
              feedback={feedback}
              busy={decisionBusyFor(requestId)}
              onOpenDecision={onOpenDecision}
            />
          );
        }
        if (mode === "attendance" || mode === "opt-in") {
          return (
            <AttendanceActionCell
              request={request}
              feedback={feedback}
              busy={decisionBusyFor(requestId)}
              onOpenDecision={onOpenDecision}
            />
          );
        }
        return (
          <LegacyActionCell
            requestId={requestId}
            disabled={request.request_status !== "Pending"}
            onOpenLegacyReview={onOpenLegacyReview}
          />
        );
      },
    },
  ];
}

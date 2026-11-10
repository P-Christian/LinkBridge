// src/modules/vos-admin/request-management/components/SchoolDemandDetailRequests.tsx
//
// Per-request list for one exact matched-school demand group. Rows keep the
// selector's deterministic oldest-first order and show only the requester name
// fields already present in the DTO. Edit delegates to the shared per-request
// action controller owned by the composing sheet, so a click can only ever act
// on one concrete `school_request_id`; frozen and legacy modes and non-Pending
// rows render read-only.
"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VsSchoolRequest } from "../types/request.types";
import type { SchoolDecisionFeedback } from "../hooks/useRequests";
import { extractRequesterIdentity } from "../dashboard/school-demand.selectors";
import { RequestStatusBadge, isWaitingSchoolRequest } from "./RequestStatusBadge";
import type { SchoolRequestsMode } from "./school-requests/school-request-mode";

const PH_DATE_TIME = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

function formatTimestamp(value: string | null): string {
  if (value === null) return "Unknown";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unknown" : PH_DATE_TIME.format(parsed);
}

function requesterName(request: VsSchoolRequest): string {
  const identity = extractRequesterIdentity(request.requested_by);
  return identity.displayName ?? "Unknown requester";
}

const feedbackClass = (feedback: SchoolDecisionFeedback): string =>
  feedback.tone === "success"
    ? "mt-2 text-xs text-emerald-700"
    : feedback.tone === "stale"
      ? "mt-2 text-xs text-amber-700"
      : "mt-2 text-xs text-red-600";

export interface SchoolDemandDetailRequestsProps {
  // The group's requests, already ordered oldest-first by the selector.
  readonly requests: readonly VsSchoolRequest[];
  readonly mode: SchoolRequestsMode;
  // True in frozen mode: every row renders without mutation controls.
  readonly readOnly: boolean;
  readonly feedbackFor: (requestId: number) => SchoolDecisionFeedback | undefined;
  readonly decisionBusyFor: (requestId: number) => boolean;
  // Edit opens the review dialog restricted to Route / Group for one request.
  readonly onEdit: (request: VsSchoolRequest) => void;
}

export function SchoolDemandDetailRequests({
  requests,
  mode,
  readOnly,
  feedbackFor,
  decisionBusyFor,
  onEdit,
}: SchoolDemandDetailRequestsProps) {
  return (
    <ul className="space-y-2" data-testid="demand-detail-requests">
      {requests.map((request) => {
        const requestId = request.school_request_id;
        const feedback = feedbackFor(requestId);
        const busy = decisionBusyFor(requestId);
        const actionable = !readOnly && mode === "attendance" && request.request_status === "Pending";
        const requested = request.requested_school_name.trim();
        return (
          <li
            key={requestId}
            data-testid={`demand-detail-request-${requestId}`}
            data-request-id={requestId}
            className="rounded-lg border bg-card p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={requesterName(request)}>{requesterName(request)}</p>
                <p className="text-xs text-muted-foreground">{formatTimestamp(request.created_at)}</p>
              </div>
              <div className="shrink-0">
                <RequestStatusBadge
                  status={request.request_status}
                  isWaiting={isWaitingSchoolRequest(request)}
                />
              </div>
            </div>
            <p className="mt-2 truncate text-xs text-muted-foreground" title={requested === "" ? "Unnamed school" : requested}>
              Requested:{" "}
              <span className="text-foreground">
                {requested === "" ? "Unnamed school" : requested}
              </span>
            </p>
            <div className="mt-2 flex items-center justify-end gap-2">
              {!actionable ? (
                <span className="text-xs text-muted-foreground">Read-only</span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => onEdit(request)}
                  aria-label={`Edit request #${requestId}`}
                  data-testid={`demand-detail-edit-${requestId}`}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit
                </Button>
              )}
            </div>
            {feedback !== undefined ? (
              <p
                className={feedbackClass(feedback)}
                data-testid={`demand-detail-feedback-${requestId}`}
              >
                {feedback.message}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

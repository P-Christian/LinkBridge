// Unrouted school-request work queue.
//
// The only data source is `selectUnroutedRequests(rows)`: Pending requests with
// no matched school. Every row keeps its individual requester, requested
// location, created date, status, route audit, and per-row feedback; the action
// cell opens the shared per-request decision/review controller, so each
// mutation targets exactly one `school_request_id`. Matched-Pending and
// terminal rows never render here, and nothing is selected or decided in bulk.
// Frozen mode shows the same rows with zero mutation controls. The optional
// error banner exposes a retry affordance instead of claiming an empty queue.
"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReviewAction, SchoolDraftOutcome, VsSchoolRequest } from "../types/request.types";
import type {
  SchoolDecisionFeedback,
  SchoolDecisionOutcome,
  SchoolRequestDecision,
  SchoolRoutingCandidate,
} from "../hooks/useRequests";
import { selectUnroutedRequests } from "../dashboard/school-demand.selectors";
import { CreateSchoolRequestModal } from "./CreateSchoolRequestModal";
import { DataTable } from "./new-data-table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildSchoolRequestColumns } from "./school-requests/school-request-columns";
import { useSchoolRequestActionController } from "./school-requests/SchoolRequestActionController";
import type { SchoolRequestsMode } from "./school-requests/school-request-mode";

interface Props {
  /** Raw school-request rows for the current filter; the queue derives from these. */
  rows: readonly VsSchoolRequest[];
  mode: SchoolRequestsMode;
  /** True while the first fetch is in flight; the table body renders skeletons. */
  loading?: boolean;
  /** Fetch failure for the current rows; renders the retry banner. */
  error?: string | null;
  /** Refetch the current filter (retry and post-decision recovery). */
  onRetry?: () => void;
  /** Guarded normalized draft-school creation (toolbar Add action). */
  onCreate: (data: unknown) => Promise<SchoolDraftOutcome | null>;
  /** Guarded draft-school creation from the decision dialog. */
  onCreatePlaceholder: (data: unknown) => Promise<SchoolDraftOutcome | null>;
  /** Legacy Approve/Reject (legacy mode only). */
  onReview: (id: number, data: ReviewAction) => Promise<boolean>;
  /** Attendance Route/Group/Reject decision (attendance mode only). */
  onDecide: (id: number, decision: SchoolRequestDecision) => Promise<SchoolDecisionOutcome>;
  onSearchSchools: (requestId: number, query: string) => Promise<SchoolRoutingCandidate[] | null>;
  candidatesFor: (requestId: number) => readonly SchoolRoutingCandidate[];
  candidatesLoadingFor: (requestId: number) => boolean;
  candidatesErrorFor: (requestId: number) => string | null;
  decisionBusyFor: (requestId: number) => boolean;
  feedbackFor: (requestId: number) => SchoolDecisionFeedback | undefined;
  /** Refetch the current filter after a committed decision (rows leave the filter). */
  onDecided: () => void;
}

export function UnroutedSchoolRequestsSection({
  rows,
  mode,
  loading = false,
  error = null,
  onRetry,
  onCreate,
  onCreatePlaceholder,
  onReview,
  onDecide,
  onSearchSchools,
  candidatesFor,
  candidatesLoadingFor,
  candidatesErrorFor,
  decisionBusyFor,
  feedbackFor,
  onDecided,
}: Props) {
  const readOnly = mode === "frozen";
  const [createOpen, setCreateOpen] = useState(false);
  const unroutedRows = useMemo(() => [...selectUnroutedRequests(rows)], [rows]);

  const controller = useSchoolRequestActionController({
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
  });

  const columns = useMemo<ColumnDef<VsSchoolRequest>[]>(
    () =>
      buildSchoolRequestColumns({
        mode,
        readOnly,
        feedbackFor,
        decisionBusyFor,
        onOpenDecision: controller.openDecision,
        onOpenLegacyReview: controller.openLegacyReview,
      }),
    [mode, readOnly, feedbackFor, decisionBusyFor, controller.openDecision, controller.openLegacyReview],
  );

  const actionComponent = readOnly ? undefined : (
    <Button
      onClick={() => setCreateOpen(true)}
      className="bg-blue-700 hover:bg-blue-800 text-white"
      data-testid="unrouted-request-add"
    >
      <Plus className="mr-2 h-4 w-4" /> Add a school as a draft
    </Button>
  );

  return (
    <section
      aria-labelledby="unrouted-requests-heading"
      aria-busy={loading}
      className="space-y-4 motion-reduce:[&_.animate-pulse]:animate-none motion-reduce:[&_.animate-spin]:animate-none motion-reduce:[&_.animate-in]:animate-none"
      data-testid="unrouted-school-requests"
    >
      <div className="space-y-1">
        <h2 id="unrouted-requests-heading" className="sr-only">
          Unrouted requests
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          These requests are for schools that are not in the system yet, so they could not be
          matched automatically. Match a request to an existing school, set the school up as a draft
          if it is not a VOS partner yet, or reject it. A claim only needs a matching school; its
          freelancer has not submitted verification yet.
        </p>
      </div>

      {readOnly ? (
        <p className="text-sm text-muted-foreground" data-testid="unrouted-requests-readonly">
          Read-only mode — decision actions are unavailable.
        </p>
      ) : null}

      {error !== null ? (
        <div role="alert" data-testid="unrouted-requests-error">
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">The unrouted request queue could not be loaded.</p>
                <p className="mt-1 text-xs">{error}</p>
              </div>
            </div>
            {onRetry !== undefined ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="shrink-0 border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800"
                data-testid="unrouted-requests-error-retry"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Retry
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <Card className="p-6 border-0 shadow-sm bg-white dark:bg-zinc-900 rounded-xl">
          <DataTable
            columns={columns}
            data={unroutedRows}
            searchKey="requested_school_name"
            actionComponent={actionComponent}
            isLoading={loading}
            emptyTitle="No requests waiting to be matched"
            emptyDescription="Nothing is waiting to be matched right now."
          />
        </Card>
      )}

      <CreateSchoolRequestModal open={createOpen} onOpenChange={setCreateOpen} onSubmit={onCreate} />

      {controller.modals}
    </section>
  );
}

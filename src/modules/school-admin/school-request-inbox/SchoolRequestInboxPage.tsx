"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { ClipboardCheck, Inbox, RefreshCw, RotateCcw, Search, SearchX, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyPlaceholder } from "@/components/shared/EmptyPlaceholder";
import { SchoolAdminModuleHeader } from "@/modules/school-admin/components/SchoolAdminModuleHeader";
import {
  assertNeverSchoolAdminVariant,
  feedbackForSchoolAttendanceOutcome,
  feedbackForSchoolReconcileOutcome,
  useSchoolRequests,
  type SchoolAttendanceAcademics,
  type SchoolAttendanceFeedback,
  type SchoolAttendanceOutcome,
  type SchoolInboxRow,
} from "@/modules/school-admin/hooks/useSchoolRequests";
import { SchoolRequestReviewDialog } from "./components/SchoolRequestDecisionDialogs";
import { SchoolRequestInboxPagination } from "./components/SchoolRequestInboxPagination";
import { SchoolRequestInboxTable } from "./components/SchoolRequestInboxTable";
import {
  SchoolRequestInboxAccessPanel,
  SchoolRequestInboxErrorBanner,
  SchoolRequestInboxSkeleton,
} from "./components/SchoolRequestInboxStates";
import {
  classifyInboxLoadError,
  describeCourse,
  visibleInboxRows,
} from "./services/school-request-inbox.helpers";

/**
 * Privacy-limited School Admin attendance inbox.
 *
 * Consumes the school-request API and state hook without widening their contract:
 *  - renders ONLY the allowed DTO fields (student display name, requested
 *    school name, course, education dates, submitted date, and the saved
 *    decision time);
 *  - approving saves the decision and marks the education as verified right
 *    away, with no extra course request created;
 *  - rejects with a trimmed nonblank reason;
 *  - renders loading/empty/error/forbidden/stale/unfinished-approval states;
 *  - never renders or submits identity, alumni, school, education, course, or
 *    classification overrides.
 */

function showFeedbackToast(feedback: SchoolAttendanceFeedback): void {
  switch (feedback.tone) {
    case "success":
      toast.success(feedback.message);
      return;
    case "stale":
    case "finalizing":
      toast.warning(feedback.message);
      return;
    case "removed":
      toast.info(feedback.message);
      return;
    case "error":
      toast.error(feedback.message);
      return;
    default:
      assertNeverSchoolAdminVariant(feedback.tone);
  }
}

interface SchoolRequestInboxPageProps {
  /** Rendered directly below the header card, above the scope paragraph. */
  readonly belowHeader?: ReactNode;
  /** Refreshes the tab/sidebar pending counts after the inbox shrinks. */
  readonly onCountsChanged?: () => void;
}

const PAGE_SIZE = 10;

export function SchoolRequestInboxPage({ belowHeader, onCountsChanged }: SchoolRequestInboxPageProps) {
  const {
    inbox,
    routed,
    finalizing,
    loading,
    error,
    feedbackByRow,
    claims,
    busyByRow,
    reconcileBusy,
    reconcileFeedback,
    loadInbox,
    approveSchoolAttendance,
    rejectSchoolAttendance,
    resumeSchoolAttendance,
    reconcileSchoolAttendance,
  } = useSchoolRequests();

  const [reviewRow, setReviewRow] = useState<SchoolInboxRow | null>(null);
  const [search, setSearch] = useState("");
  const [routedPage, setRoutedPage] = useState(1);
  const [finalizingPage, setFinalizingPage] = useState(1);
  // The dialog unmounts synchronously on close, so remember the Review button
  // and restore focus to it (when still connected) for keyboard users.
  const triggerRef = useRef<HTMLElement | null>(null);

  const rememberTrigger = useCallback(() => {
    const active = document.activeElement;
    triggerRef.current = active instanceof HTMLElement ? active : null;
  }, []);

  const restoreTriggerFocus = useCallback(() => {
    const target = triggerRef.current;
    triggerRef.current = null;
    window.setTimeout(() => {
      if (target !== null && target.isConnected) target.focus();
    }, 0);
  }, []);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  /** True when the calling dialog may close; false keeps it open on failure. */
  const settleOutcome = useCallback(
    (outcome: SchoolAttendanceOutcome): boolean => {
      showFeedbackToast(feedbackForSchoolAttendanceOutcome(outcome));
      switch (outcome.kind) {
        case "approved":
        case "rejected":
        case "stale":
        case "removed":
        case "finalizing":
          onCountsChanged?.();
          return true;
        case "failed":
          return false;
        default:
          return assertNeverSchoolAdminVariant(outcome);
      }
    },
    [onCountsChanged],
  );

  const handleApprove = useCallback(
    async (row: SchoolInboxRow, academics: SchoolAttendanceAcademics): Promise<boolean> => {
      const outcome = await approveSchoolAttendance(row.schoolRequestId, academics);
      return settleOutcome(outcome);
    },
    [approveSchoolAttendance, settleOutcome],
  );

  const handleReject = useCallback(
    async (row: SchoolInboxRow, remarks: string): Promise<boolean> => {
      const outcome = await rejectSchoolAttendance(row.schoolRequestId, remarks);
      return settleOutcome(outcome);
    },
    [rejectSchoolAttendance, settleOutcome],
  );

  const handleResume = useCallback(
    async (row: SchoolInboxRow): Promise<boolean> => {
      const outcome = await resumeSchoolAttendance(row.schoolRequestId);
      return settleOutcome(outcome);
    },
    [resumeSchoolAttendance, settleOutcome],
  );

  const handleReconcile = useCallback(async (): Promise<void> => {
    const outcome = await reconcileSchoolAttendance();
    showFeedbackToast(feedbackForSchoolReconcileOutcome(outcome));
    if (outcome.kind === "reconciled") onCountsChanged?.();
  }, [reconcileSchoolAttendance, onCountsChanged]);

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    setSearch(event.target.value);
    setRoutedPage(1);
    setFinalizingPage(1);
  }, []);

  const handleClearSearch = useCallback((): void => {
    setSearch("");
    setRoutedPage(1);
    setFinalizingPage(1);
  }, []);

  const schoolId = inbox?.schoolId ?? null;
  // Defense in depth: a row may render only when its PERSISTED matched school
  // equals the inbox's own school. Foreign rows never reach a cell.
  const routedRows = schoolId === null ? [] : visibleInboxRows(routed, schoolId);
  const finalizingRows = schoolId === null ? [] : visibleInboxRows(finalizing, schoolId);

  const query = search.trim().toLowerCase();
  const isSearching = query.length > 0;
  const matchesSearch = (row: SchoolInboxRow): boolean =>
    !isSearching ||
    row.submitterName.toLowerCase().includes(query) ||
    row.requestedSchoolName.toLowerCase().includes(query) ||
    describeCourse(row).label.toLowerCase().includes(query);

  const filteredRoutedRows = routedRows.filter(matchesSearch);
  const filteredFinalizingRows = finalizingRows.filter(matchesSearch);

  const isEmpty = inbox !== null && routedRows.length === 0 && finalizingRows.length === 0;
  const hasNoSearchMatches =
    isSearching && filteredRoutedRows.length === 0 && filteredFinalizingRows.length === 0;

  const routedPageCount = Math.max(1, Math.ceil(filteredRoutedRows.length / PAGE_SIZE));
  const safeRoutedPage = Math.min(routedPage, routedPageCount);
  const pagedRoutedRows = filteredRoutedRows.slice(
    (safeRoutedPage - 1) * PAGE_SIZE,
    safeRoutedPage * PAGE_SIZE,
  );

  const finalizingPageCount = Math.max(1, Math.ceil(filteredFinalizingRows.length / PAGE_SIZE));
  const safeFinalizingPage = Math.min(finalizingPage, finalizingPageCount);
  const pagedFinalizingRows = filteredFinalizingRows.slice(
    (safeFinalizingPage - 1) * PAGE_SIZE,
    safeFinalizingPage * PAGE_SIZE,
  );

  const headerActions = (
    <div className="flex items-center gap-2">
      {finalizingRows.length > 0 ? (
        <Button
          variant="outline"
          onClick={() => void handleReconcile()}
          disabled={reconcileBusy}
          className="bg-white/10 hover:bg-white/20 text-white border-white/20 hover:text-white shadow-sm"
          data-testid="school-request-reconcile"
        >
          <RotateCcw className={reconcileBusy ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
          Finish saved approvals
        </Button>
      ) : null}
      <Button
        variant="outline"
        onClick={() => void loadInbox()}
        disabled={loading}
        className="bg-white/10 hover:bg-white/20 text-white border-white/20 hover:text-white shadow-sm"
        data-testid="school-request-refresh"
      >
        <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
        Refresh
      </Button>
    </div>
  );

  // Every render state shares one root: the header card and the injected tab
  // strip stay mounted, and only this content changes with the state.
  let content: ReactNode;
  if (loading && inbox === null) {
    content = <SchoolRequestInboxSkeleton />;
  } else if (error !== null) {
    const failure = classifyInboxLoadError(error);
    content =
      failure === "forbidden" || failure === "unauthenticated" ? (
        <SchoolRequestInboxAccessPanel kind={failure} message={error} />
      ) : (
        <SchoolRequestInboxErrorBanner message={error} loading={loading} onRetry={() => void loadInbox()} />
      );
  } else {
    content = (
      <>
        {schoolId !== null ? (
          <p className="text-xs text-muted-foreground" data-testid="school-request-scope">
            {filteredRoutedRows.length === 1
              ? "1 request waiting for your decision."
              : `${String(filteredRoutedRows.length)} requests waiting for your decision.`}
          </p>
        ) : null}

        {reconcileFeedback !== null ? (
          <p
            data-testid="school-request-reconcile-feedback"
            data-tone={reconcileFeedback.tone}
            className="text-sm text-muted-foreground"
          >
            {reconcileFeedback.message}
          </p>
        ) : null}

        {isEmpty ? (
          <div data-testid="school-request-empty">
            <EmptyPlaceholder
              icon={Inbox}
              title="No attendance requests yet"
              description="Requests from people who listed your school will show up here for review."
            />
          </div>
        ) : (
          <>
            <div className="relative max-w-md" data-testid="school-request-search">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search by student name, school, or course..."
                aria-label="Search requests"
                className="pl-9 pr-9"
              />
              {search.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                  data-testid="school-request-search-clear"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>

            {hasNoSearchMatches ? (
              <div data-testid="school-request-search-empty">
                <EmptyPlaceholder
                  icon={SearchX}
                  title="No requests match your search."
                  description="Try a different name, school, or course."
                />
              </div>
            ) : (
              <>
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Inbox className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold">Waiting for your decision</h2>
                    <Badge variant="secondary">{filteredRoutedRows.length}</Badge>
                  </div>
                  {filteredRoutedRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground" data-testid="school-request-routed-empty">
                      {isSearching
                        ? "No requests match your search."
                        : "No requests need your decision right now."}
                    </p>
                  ) : (
                    <>
                      <SchoolRequestInboxTable
                        rows={pagedRoutedRows}
                        variant="routed"
                        feedbackByRow={feedbackByRow}
                        busyByRow={busyByRow}
                        claims={claims}
                        onReview={(row) => {
                          rememberTrigger();
                          setReviewRow(row);
                        }}
                      />
                      <SchoolRequestInboxPagination
                        page={safeRoutedPage}
                        pageSize={PAGE_SIZE}
                        total={filteredRoutedRows.length}
                        onPageChange={setRoutedPage}
                      />
                    </>
                  )}
                </section>

                {filteredFinalizingRows.length > 0 ? (
                  <section className="space-y-3" data-testid="school-request-finalizing">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-amber-600" />
                      <h2 className="text-sm font-semibold">Unfinished approvals</h2>
                      <Badge variant="secondary">{filteredFinalizingRows.length}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      These approvals were saved but did not finish. Use Finish saved approvals to
                      complete them. Saved student details can no longer be edited.
                    </p>
                    <SchoolRequestInboxTable
                      rows={pagedFinalizingRows}
                      variant="finalizing"
                      feedbackByRow={feedbackByRow}
                      busyByRow={busyByRow}
                      claims={claims}
                      onReview={(row) => {
                        rememberTrigger();
                        setReviewRow(row);
                      }}
                    />
                    <SchoolRequestInboxPagination
                      page={safeFinalizingPage}
                      pageSize={PAGE_SIZE}
                      total={filteredFinalizingRows.length}
                      onPageChange={setFinalizingPage}
                    />
                  </section>
                ) : null}
              </>
            )}
          </>
        )}
      </>
    );
  }

  return (
    <div className="w-[90%] max-w-[2000px] mx-auto space-y-6" data-testid="school-request-inbox">
      <SchoolAdminModuleHeader
        title="Alumni Verification Requests"
        description="Review requests from students who listed your school. Approve to verify their education, or reject with a reason."
        icon={ClipboardCheck}
        actions={headerActions}
      />

      {belowHeader}

      {content}

      {reviewRow !== null ? (
        <SchoolRequestReviewDialog
          key={reviewRow.schoolRequestId}
          row={reviewRow}
          busy={busyByRow[reviewRow.schoolRequestId] === true}
          onOpenChange={(open) => {
            if (!open) {
              setReviewRow(null);
              restoreTriggerFocus();
            }
          }}
          onApprove={handleApprove}
          onReject={handleReject}
          onResume={handleResume}
        />
      ) : null}
    </div>
  );
}

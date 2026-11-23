"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BookOpenCheck, Inbox, Plus, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SchoolAdminModuleHeader } from "@/modules/school-admin/components/SchoolAdminModuleHeader";
import {
  assertNeverCourseRequestVariant,
  feedbackForCourseRequestOutcome,
  useCourseRequests,
  type CourseRequestFeedback,
  type CourseRequestInboxRow,
  type CourseRequestOutcome,
} from "@/modules/school-admin/hooks/useCourseRequests";
import { CourseRequestReviewDialog } from "./components/CourseRequestDecisionDialogs";
import { CourseRequestInboxTable } from "./components/CourseRequestInboxTable";
import {
  CourseRequestInboxAccessPanel,
  CourseRequestInboxEmpty,
  CourseRequestInboxErrorBanner,
  CourseRequestInboxSkeleton,
} from "./components/CourseRequestInboxStates";
import { AddCourseModal } from "@/modules/school-admin/school-courses/components/AddCourseModal";
import { classifyInboxLoadFailure } from "./services/course-request-inbox.helpers";

/**
 * Privacy-limited School Admin course-request inbox.
 *
 * Consumes the course-request API through the typed `useCourseRequests` hook
 * without widening its contract:
 *  - renders ONLY the allowlisted inbox DTO fields (name-only submitter
 *    label, requested course text, submission and arrival dates, persisted
 *    finalizing lock, Active candidate fields) for the caller's own school;
 *  - every row opens one review dialog with the submitted documents;
 *    actionable rows approve with a searchable Active course or reject with a
 *    trimmed nonblank reason, and finalizing rows resume the persisted locked
 *    course and original reviewer;
 *  - renders initial/loading/empty/forbidden/error states plus per-row
 *    stale/removed/finalizing/busy feedback; stale, removed, and finalizing
 *    outcomes never present as success;
 *  - never renders or submits identity, school, education, roster, reviewer,
 *    or status overrides. Server-side validation stays authoritative.
 */

function showFeedbackToast(feedback: CourseRequestFeedback): void {
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
      assertNeverCourseRequestVariant(feedback.tone);
  }
}

interface CourseRequestInboxPageProps {
  /** Rendered directly below the header card, above the scope line. */
  readonly belowHeader?: ReactNode;
  readonly onCountsChanged?: () => void;
}

export function CourseRequestInboxPage({ belowHeader, onCountsChanged }: CourseRequestInboxPageProps) {
  const {
    inbox,
    routed,
    finalizing,
    courses,
    loading,
    error,
    feedbackByRow,
    busyByRow,
    loadInbox,
    approveCourseRequest,
    rejectCourseRequest,
    resumeCourseRequest,
    createCourse,
    createBusy,
  } = useCourseRequests();

  const [reviewRow, setReviewRow] = useState<CourseRequestInboxRow | null>(null);
  // Course creation refreshes candidates only: no preselection, no chained approval.
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  // The dialogs unmount synchronously on close, so Radix never gets to run its
  // own close-auto-focus. Remember the triggering button and restore focus to
  // it (when it is still connected) so keyboard users never lose their place.
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
    (outcome: CourseRequestOutcome): boolean => {
      showFeedbackToast(feedbackForCourseRequestOutcome(outcome));
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
          return assertNeverCourseRequestVariant(outcome);
      }
    },
    [onCountsChanged],
  );

  const handleApprove = useCallback(
    async (row: CourseRequestInboxRow, courseId: number): Promise<boolean> => {
      const outcome = await approveCourseRequest(row.courseRequestId, courseId);
      return settleOutcome(outcome);
    },
    [approveCourseRequest, settleOutcome],
  );

  const handleReject = useCallback(
    async (row: CourseRequestInboxRow, remarks: string): Promise<boolean> => {
      const outcome = await rejectCourseRequest(row.courseRequestId, remarks);
      return settleOutcome(outcome);
    },
    [rejectCourseRequest, settleOutcome],
  );

  const handleResume = useCallback(
    async (row: CourseRequestInboxRow): Promise<boolean> => {
      const outcome = await resumeCourseRequest(row.courseRequestId);
      return settleOutcome(outcome);
    },
    [resumeCourseRequest, settleOutcome],
  );

  const isEmpty = routed.length === 0 && finalizing.length === 0;

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={() => setCourseModalOpen(true)}
        className="bg-white/10 hover:bg-white/20 text-white border-white/20 hover:text-white shadow-sm"
        aria-label="Add a school course"
        data-testid="course-request-add-course"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add course
      </Button>
      <Button
        variant="outline"
        onClick={() => void loadInbox()}
        disabled={loading}
        className="bg-white/10 hover:bg-white/20 text-white border-white/20 hover:text-white shadow-sm"
        aria-label="Refresh course requests"
        data-testid="course-request-refresh"
      >
        <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
        Refresh
      </Button>
    </div>
  );

  // Every render state shares one root: the header card and the injected tab
  // strip stay mounted, and only this content changes with the state.
  let content: ReactNode;
  if (error !== null) {
    const failure = classifyInboxLoadFailure(error);
    content =
      failure === "forbidden" || failure === "unauthenticated" ? (
        <CourseRequestInboxAccessPanel kind={failure} message={error} />
      ) : (
        <CourseRequestInboxErrorBanner message={error} loading={loading} onRetry={() => void loadInbox()} />
      );
  } else if (inbox === null) {
    // Initial and first-load state: no data and no failure yet.
    content = <CourseRequestInboxSkeleton />;
  } else {
    content = (
      <>
        <p className="text-xs text-muted-foreground" data-testid="course-request-scope">
          {routed.length} request(s) to review - {finalizing.length} still being completed
          {loading ? " - updating" : ""}
        </p>

        {isEmpty ? (
          <CourseRequestInboxEmpty />
        ) : (
          <>
            <section className="space-y-3" data-testid="course-request-routed">
              <div className="flex items-center gap-2">
                <Inbox className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Routed to your school</h2>
                <Badge variant="secondary">{routed.length}</Badge>
              </div>
              {routed.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="course-request-routed-empty">
                  No requests need your review right now.
                </p>
              ) : (
                <CourseRequestInboxTable
                  rows={routed}
                  variant="routed"
                  courses={courses}
                  feedbackByRow={feedbackByRow}
                  busyByRow={busyByRow}
                  onReview={(row) => {
                    rememberTrigger();
                    setReviewRow(row);
                  }}
                />
              )}
            </section>

            {finalizing.length > 0 ? (
              <section className="space-y-3" data-testid="course-request-finalizing">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-amber-600" />
                  <h2 className="text-sm font-semibold">Approvals to finish</h2>
                  <Badge variant="secondary">{finalizing.length}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  For these requests, a course was saved but the approval did not finish. Press
                  Resume to finish them. You cannot change the saved course or reject these requests.
                </p>
                <CourseRequestInboxTable
                  rows={finalizing}
                  variant="finalizing"
                  courses={courses}
                  feedbackByRow={feedbackByRow}
                  busyByRow={busyByRow}
                  onReview={(row) => {
                    rememberTrigger();
                    setReviewRow(row);
                  }}
                />
              </section>
            ) : null}
          </>
        )}
      </>
    );
  }

  return (
    <div className="w-[90%] max-w-[2000px] mx-auto space-y-6" data-testid="course-request-inbox">
      <SchoolAdminModuleHeader
        title="Course Requests"
        description="Review course requests sent to your school. Approve a request with one of your courses, or reject it with a reason."
        icon={BookOpenCheck}
        actions={headerActions}
      />

      {belowHeader}

      {content}

      {reviewRow !== null ? (
        <CourseRequestReviewDialog
          key={reviewRow.courseRequestId}
          row={reviewRow}
          courses={courses}
          busy={busyByRow[reviewRow.courseRequestId] === true}
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

      <AddCourseModal
        isOpen={courseModalOpen}
        onOpenChange={setCourseModalOpen}
        onSubmit={createCourse}
        saving={createBusy}
        existingCourses={courses.map((course) => ({
          course_name: course.courseName,
          degree: course.degree ?? null,
        }))}
      />
    </div>
  );
}

"use client";

import { ClipboardCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  courseInboxRowState,
  type CourseRequestCandidate,
  type CourseRequestFeedback,
  type CourseRequestInboxRow,
} from "@/modules/school-admin/hooks/useCourseRequests";
import {
  describeLockedCourse,
  formatInboxDateTime,
  requestReference,
} from "../services/course-request-inbox.helpers";

type InboxTableVariant = "routed" | "finalizing";

interface CourseRequestInboxTableProps {
  readonly rows: readonly CourseRequestInboxRow[];
  readonly variant: InboxTableVariant;
  /** Active same-school candidates, used only to label the persisted finalizing lock. */
  readonly courses: readonly CourseRequestCandidate[];
  readonly feedbackByRow: Readonly<Record<number, CourseRequestFeedback>>;
  readonly busyByRow: Readonly<Record<number, boolean>>;
  readonly onReview: (row: CourseRequestInboxRow) => void;
}

function feedbackTone(tone: CourseRequestFeedback["tone"]): string {
  switch (tone) {
    case "success":
      return "text-emerald-700";
    case "stale":
    case "finalizing":
      return "text-amber-700";
    case "removed":
      return "text-slate-600";
    case "error":
      return "text-red-600";
    default:
      return "text-muted-foreground";
  }
}

/**
 * Privacy-limited inbox table. Renders ONLY the allowlisted inbox row and
 * candidate fields. The Actions column is pinned sticky-right inside the
 * horizontal scroll container, so the actions stay fully visible at 1440x900,
 * 1024x768, 390x844 and 1680-wide viewports without page-level horizontal
 * overflow. Every row exposes ONLY Review; decisions and finalizing recovery
 * live inside the review dialog. The request status is carried on the row as a
 * data attribute only; it is not rendered as a column.
 */
export function CourseRequestInboxTable({
  rows,
  variant,
  courses,
  feedbackByRow,
  busyByRow,
  onReview,
}: CourseRequestInboxTableProps) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Submitter</TableHead>
              <TableHead>Requested Course</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Sent to your school</TableHead>
              <TableHead className="sticky right-0 z-10 border-l border-border/60 bg-card text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const state = courseInboxRowState(row);
              const feedback = feedbackByRow[row.courseRequestId];
              const busy = busyByRow[row.courseRequestId] === true;
              const locked =
                state.kind === "finalizing" && row.matchedSchoolCourseId !== null
                  ? describeLockedCourse(row, courses)
                  : null;
              return (
                <TableRow
                  key={row.courseRequestId}
                  data-testid={`course-request-row-${String(row.courseRequestId)}`}
                  data-request-status={row.requestStatus}
                  data-row-state={state.kind}
                  data-variant={variant}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span
                        className="font-medium"
                        data-testid={`course-request-submitter-${String(row.courseRequestId)}`}
                      >
                        {row.submitterName.trim().length > 0 ? row.submitterName : "Unknown submitter"}
                      </span>
                      <span
                        className="font-mono text-xs text-muted-foreground"
                        data-testid={`course-request-ref-${String(row.courseRequestId)}`}
                      >
                        {requestReference(row)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-normal">
                    <span data-testid={`course-request-requested-course-${String(row.courseRequestId)}`}>
                      {row.requestedCourseName}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm whitespace-normal">
                    <span data-testid={`course-request-submitted-${String(row.courseRequestId)}`}>
                      {formatInboxDateTime(row.submittedAt)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-normal">
                    <div data-testid={`course-request-route-audit-${String(row.courseRequestId)}`}>
                      {formatInboxDateTime(row.routedAt)}
                    </div>
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 border-l border-border/60 bg-card">
                    <div className="flex flex-col items-end gap-1.5">
                      {locked !== null ? (
                        <span
                          className="whitespace-nowrap text-right text-xs text-muted-foreground"
                          data-testid={`course-request-locked-summary-${String(row.courseRequestId)}`}
                        >
                          {locked.label}
                          {locked.code !== null ? ` (${locked.code})` : ""}
                        </span>
                      ) : null}
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onReview(row)}
                          disabled={busy}
                          aria-label={`Review course request ${String(row.courseRequestId)}`}
                          data-testid={`course-request-review-${String(row.courseRequestId)}`}
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          <span className="ml-1">Review</span>
                        </Button>
                      </div>
                      {feedback !== undefined ? (
                        <span
                          data-testid={`course-request-feedback-${String(row.courseRequestId)}`}
                          data-tone={feedback.tone}
                          className={cn("max-w-[24rem] text-right text-xs", feedbackTone(feedback.tone))}
                        >
                          {feedback.message}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

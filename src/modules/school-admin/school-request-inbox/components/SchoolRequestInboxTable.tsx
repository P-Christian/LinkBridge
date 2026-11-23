"use client";

import { CalendarRange, ClipboardCheck, Lock } from "lucide-react";

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
  deriveFinalizingClaim,
  type SchoolAttendanceFeedback,
  type SchoolFinalizingClaim,
  type SchoolInboxRow,
} from "@/modules/school-admin/hooks/useSchoolRequests";
import {
  describeCourse,
  describeSavedDecision,
  formatEducationRange,
  formatInboxDateTime,
} from "../services/school-request-inbox.helpers";

type InboxTableVariant = "routed" | "finalizing";

interface SchoolRequestInboxTableProps {
  readonly rows: readonly SchoolInboxRow[];
  readonly variant: InboxTableVariant;
  readonly feedbackByRow: Readonly<Record<number, SchoolAttendanceFeedback>>;
  readonly busyByRow: Readonly<Record<number, boolean>>;
  readonly claims: Readonly<Record<number, SchoolFinalizingClaim>>;
  readonly onReview: (row: SchoolInboxRow) => void;
}

function feedbackTone(tone: SchoolAttendanceFeedback["tone"]): string {
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

export function SchoolRequestInboxTable({
  rows,
  variant,
  feedbackByRow,
  busyByRow,
  claims,
  onReview,
}: SchoolRequestInboxTableProps) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Student</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Education Dates</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="sticky right-0 z-10 border-l border-border/60 bg-card text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const course = describeCourse(row);
              const persistedClaim = claims[row.schoolRequestId] ?? deriveFinalizingClaim(row) ?? null;
              const claimLabel = describeSavedDecision(row);
              const feedback = feedbackByRow[row.schoolRequestId];
              const busy = busyByRow[row.schoolRequestId] === true;
              const educationDates = formatEducationRange(
                row.education.startDate,
                row.education.endDate,
              );
              return (
                <TableRow
                  key={row.schoolRequestId}
                  data-testid={`school-request-row-${String(row.schoolRequestId)}`}
                  data-request-status={row.requestStatus}
                >
                  <TableCell>
                    <span
                      className="font-medium"
                      data-testid={`school-request-submitter-${String(row.schoolRequestId)}`}
                    >
                      {row.submitterName.trim().length > 0 ? row.submitterName : "Name not available"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span
                      data-testid={`school-request-requested-school-${String(row.schoolRequestId)}`}
                    >
                      {row.requestedSchoolName}
                    </span>
                  </TableCell>
                  <TableCell
                    className="text-sm whitespace-normal"
                    data-testid={`school-request-course-${String(row.schoolRequestId)}`}
                    data-course-resolved={course.resolved ? "true" : "false"}
                  >
                    {course.resolved ? (
                      <span className="font-medium">
                        {course.label}
                        {course.code !== null ? (
                          <span className="ml-2 font-mono text-xs text-muted-foreground">{course.code}</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{course.label}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm whitespace-normal">
                    <span className="inline-flex items-center gap-1.5">
                      {educationDates.length > 0 ? (
                        <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : null}
                      <span data-testid={`school-request-education-dates-${String(row.schoolRequestId)}`}>
                        {educationDates}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-normal">
                    <div data-testid={`school-request-submitted-${String(row.schoolRequestId)}`}>
                      {formatInboxDateTime(row.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 border-l border-border/60 bg-card">
                    <div className="flex flex-col items-end gap-1.5">
                      {variant === "finalizing" ? (
                        <div
                          className="whitespace-normal text-right text-xs text-muted-foreground"
                          data-testid={`school-request-claim-${String(row.schoolRequestId)}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            {claimLabel ?? "Decision saved"}
                          </span>
                          <div className="mt-0.5">Saved student details can no longer be edited.</div>
                        </div>
                      ) : null}
                      {persistedClaim !== null && variant === "routed" ? (
                        <div
                          className="whitespace-normal text-right text-xs text-amber-700"
                          data-testid={`school-request-claim-${String(row.schoolRequestId)}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            {claimLabel ?? "Decision saved"}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onReview(row)}
                          disabled={busy}
                          aria-label={`Review request for ${row.submitterName.trim().length > 0 ? row.submitterName : "this student"}`}
                          data-testid={`school-request-review-${String(row.schoolRequestId)}`}
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          <span className="ml-1">Review</span>
                        </Button>
                      </div>
                      {feedback !== undefined ? (
                        <span
                          data-testid={`school-request-feedback-${String(row.schoolRequestId)}`}
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

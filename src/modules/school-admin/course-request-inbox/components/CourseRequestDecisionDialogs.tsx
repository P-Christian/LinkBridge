"use client";

import { useState } from "react";
import { AlertTriangle, Check, Loader2, Lock, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { EducationRequestDocuments } from "@/modules/school-admin/components/EducationRequestDocuments";
import type {
  CourseRequestCandidate,
  CourseRequestInboxRow,
} from "@/modules/school-admin/hooks/useCourseRequests";
import {
  candidateOptions,
  describeLockedCourse,
  findCandidateById,
  formatInboxDateTime,
  isFinalizingRow,
  requestReference,
  validateRejectRemarks,
} from "../services/course-request-inbox.helpers";

type ReviewMode = "view" | "approve" | "reject";

interface SubmissionSummaryProps {
  readonly row: CourseRequestInboxRow;
}

function SubmissionSummary({ row }: SubmissionSummaryProps) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 rounded-lg border bg-muted/20 p-4 text-sm">
      <div>
        <dt className="text-xs text-muted-foreground">Submitted by</dt>
        <dd className="font-medium" data-testid="dialog-submitter">
          {row.submitterName.trim().length > 0 ? row.submitterName : "Unknown submitter"}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Reference</dt>
        <dd className="font-mono text-xs" data-testid="dialog-request-ref">
          {requestReference(row)}
        </dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-xs text-muted-foreground">Course requested</dt>
        <dd data-testid="dialog-requested-course">{row.requestedCourseName}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Submitted</dt>
        <dd data-testid="dialog-submitted">{formatInboxDateTime(row.submittedAt)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Sent to your school</dt>
        <dd data-testid="dialog-route-audit">{formatInboxDateTime(row.routedAt)}</dd>
      </div>
    </dl>
  );
}

interface CourseRequestReviewDialogProps {
  readonly row: CourseRequestInboxRow;
  /** Active same-school candidates from the own-school inbox DTO. */
  readonly courses: readonly CourseRequestCandidate[];
  readonly busy: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Resolves true when the dialog may close (settled: approved/stale/removed/finalizing). */
  readonly onApprove: (row: CourseRequestInboxRow, courseId: number) => Promise<boolean>;
  readonly onReject: (row: CourseRequestInboxRow, remarks: string) => Promise<boolean>;
  readonly onResume: (row: CourseRequestInboxRow) => Promise<boolean>;
}

/** Mounted only while a row is selected (keyed by request id); unmount resets the mode. */
export function CourseRequestReviewDialog({
  row,
  courses,
  busy,
  onOpenChange,
  onApprove,
  onReject,
  onResume,
}: CourseRequestReviewDialogProps) {
  const [mode, setMode] = useState<ReviewMode>("view");
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const finalizing = isFinalizingRow(row);
  const locked = finalizing ? describeLockedCourse(row, courses) : null;
  const selectedCandidate =
    selectedCourseId === null ? undefined : findCandidateById(courses, selectedCourseId);
  const options = candidateOptions(courses);
  const noCandidates = courses.length === 0;
  const missingSelection = selectedCandidate === undefined && !noCandidates;

  const handleApprove = async (): Promise<void> => {
    setError(null);
    if (selectedCandidate === undefined) {
      setError("Select a course before approving.");
      return;
    }
    const shouldClose = await onApprove(row, selectedCandidate.schoolCourseId);
    if (shouldClose) {
      onOpenChange(false);
    } else {
      setError("The approval did not finish. Check the message on this request, then try again.");
    }
  };

  const handleReject = async (): Promise<void> => {
    setError(null);
    const validationError = validateRejectRemarks(remarks);
    if (validationError !== null) {
      setError(validationError);
      return;
    }
    const shouldClose = await onReject(row, remarks.trim());
    if (shouldClose) {
      onOpenChange(false);
    } else {
      setError("The rejection did not finish. Check the message on this request, then try again.");
    }
  };

  const handleResume = async (): Promise<void> => {
    setError(null);
    const shouldClose = await onResume(row);
    if (shouldClose) {
      onOpenChange(false);
    } else {
      setError("The approval did not finish. Check the message on this request, then try again.");
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        data-testid="course-request-review-dialog"
      >
        <DialogHeader>
          <DialogTitle>Review course request</DialogTitle>
          <DialogDescription>
            Check the student&apos;s details and submitted documents before you decide.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <SubmissionSummary row={row} />

          <EducationRequestDocuments documents={row.documents} />

          {finalizing ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <Lock className="h-4 w-4" aria-hidden="true" />
                Approval saved
              </p>
              <p className="mt-1 text-muted-foreground">
                A course was saved but the approval did not finish. Resume to complete it. The saved
                course cannot be changed.
              </p>
              {locked !== null ? (
                <p className="mt-1 text-xs text-muted-foreground" data-testid="dialog-locked-course">
                  {locked.label}
                  {locked.code !== null ? ` (${locked.code})` : ""}
                </p>
              ) : null}
            </div>
          ) : null}

          {mode === "view" && !finalizing ? (
            noCandidates ? (
              <div
                data-testid="approve-no-candidates"
                className="rounded-lg border bg-muted/30 p-3 text-sm"
              >
                <p className="font-semibold">No courses available</p>
                <p className="mt-1 text-muted-foreground">
                  Your school has no available courses right now. Add a course first, then come
                  back to approve this request.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <p className="font-semibold">What happens when you approve</p>
                <p className="mt-1 text-muted-foreground">
                  The course you select is saved on the student&apos;s record, and their education is
                  marked as verified.
                </p>
              </div>
            )
          ) : null}

          {mode === "approve" ? (
            <div className="space-y-2">
              <Label htmlFor="course_request_candidate">
                Course {missingSelection ? <span className="text-destructive">*</span> : "*"}
              </Label>
              <div data-testid="approve-course-select">
                <SearchableSelect
                  options={options}
                  value={selectedCourseId === null ? "" : String(selectedCourseId)}
                  onValueChange={(value) => {
                    setError(null);
                    setSelectedCourseId(value.length > 0 ? Number(value) : null);
                  }}
                  placeholder="Select a course"
                  disabled={busy || noCandidates}
                  className={
                    missingSelection
                      ? "border-destructive focus-visible:ring-destructive/40"
                      : undefined
                  }
                />
              </div>
              {selectedCandidate !== undefined ? (
                <p className="text-xs text-muted-foreground" data-testid="approve-selected-course">
                  Selected: {selectedCandidate.courseName}
                  {selectedCandidate.courseCode !== null ? ` (${selectedCandidate.courseCode})` : ""}
                </p>
              ) : missingSelection ? (
                <p
                  className="text-xs font-medium text-destructive"
                  role="alert"
                  data-testid="approve-missing-course"
                >
                  Select a course to enable Approve.
                </p>
              ) : null}
            </div>
          ) : null}

          {mode === "reject" ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>
                  Only reject if your school cannot complete this request with a course. Your
                  reason is saved with the request.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="course_request_reject_reason">Reason *</Label>
                <Textarea
                  id="course_request_reject_reason"
                  data-testid="reject-remarks"
                  placeholder="Explain why you are rejecting this request."
                  value={remarks}
                  onChange={(event) => {
                    setError(null);
                    setRemarks(event.target.value);
                  }}
                  aria-invalid={error !== null}
                  rows={4}
                />
                {validateRejectRemarks(remarks) !== null ? (
                  <p className="text-xs text-muted-foreground" data-testid="reject-blocked-hint">
                    A reason is required to enable Reject.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {error !== null ? (
            <div
              data-testid="review-error"
              className="text-sm font-medium text-destructive bg-destructive/10 p-2 rounded-md"
            >
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {mode === "view" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
                data-testid="review-close"
              >
                Close
              </Button>
              {finalizing ? (
                <Button
                  type="button"
                  onClick={() => void handleResume()}
                  disabled={busy}
                  data-testid="review-resume"
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-2 h-4 w-4" />
                  )}
                  Resume approval
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setError(null);
                      setMode("reject");
                    }}
                    disabled={busy}
                    data-testid="review-reject"
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode("approve");
                    }}
                    disabled={busy || noCandidates}
                    data-testid="review-approve"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </>
              )}
            </>
          ) : mode === "approve" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError(null);
                  setMode("view");
                }}
                disabled={busy}
                data-testid="review-back"
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={() => void handleApprove()}
                disabled={busy || selectedCandidate === undefined}
                title={missingSelection ? "Select a course first" : undefined}
                data-testid="approve-confirm"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Approve request
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError(null);
                  setMode("view");
                }}
                disabled={busy}
                data-testid="review-back"
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleReject()}
                disabled={busy || validateRejectRemarks(remarks) !== null}
                data-testid="reject-confirm"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                Reject request
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EducationRequestDocuments } from "@/modules/school-admin/components/EducationRequestDocuments";
import {
  availableSchoolAttendanceActions,
  type SchoolAttendanceAcademics,
  type SchoolInboxRow,
} from "@/modules/school-admin/hooks/useSchoolRequests";
import {
  describeApprovalOutcome,
  describeCourse,
  describeSavedDecision,
  formatEducationRange,
  formatInboxDateTime,
  validateAcademicsInput,
} from "../services/school-request-inbox.helpers";

type ReviewMode = "view" | "approve" | "reject";

function SubmissionSummary({ row }: { readonly row: SchoolInboxRow }) {
  const course = describeCourse(row);
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 rounded-lg border bg-muted/20 p-4 text-sm">
      <div>
        <dt className="text-xs text-muted-foreground">Student</dt>
        <dd className="font-medium" data-testid="dialog-submitter">
          {row.submitterName.trim().length > 0 ? row.submitterName : "Name not available"}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">School</dt>
        <dd data-testid="dialog-requested-school">{row.requestedSchoolName}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Course</dt>
        <dd data-testid="dialog-course">{course.label}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Submitted</dt>
        <dd data-testid="dialog-submitted">{formatInboxDateTime(row.createdAt)}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-xs text-muted-foreground">Education dates</dt>
        <dd data-testid="dialog-education-dates">
          {formatEducationRange(row.education.startDate, row.education.endDate)}
        </dd>
      </div>
    </dl>
  );
}

interface SchoolRequestReviewDialogProps {
  readonly row: SchoolInboxRow;
  readonly busy: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Resolves true when the dialog may close (committed/stale/removed/finalizing). */
  readonly onApprove: (row: SchoolInboxRow, academics: SchoolAttendanceAcademics) => Promise<boolean>;
  readonly onReject: (row: SchoolInboxRow, remarks: string) => Promise<boolean>;
  readonly onResume: (row: SchoolInboxRow) => Promise<boolean>;
}

/** Mounted only while a row is selected (keyed by request id); unmount resets the mode. */
export function SchoolRequestReviewDialog({
  row,
  busy,
  onOpenChange,
  onApprove,
  onReject,
  onResume,
}: SchoolRequestReviewDialogProps) {
  const [mode, setMode] = useState<ReviewMode>("view");
  const [studentNumber, setStudentNumber] = useState("");
  const [gpa, setGpa] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const actions = availableSchoolAttendanceActions(row);
  const canDecide = actions.includes("approve") && actions.includes("reject");
  const canResume = actions.includes("resume");
  const outcome = describeApprovalOutcome(row);
  const savedDecision = describeSavedDecision(row);

  const handleApprove = async (): Promise<void> => {
    setError(null);
    const validation = validateAcademicsInput({ studentNumber, gpa, schoolYear });
    if (validation.error !== null) {
      setError(validation.error);
      return;
    }
    const shouldClose = await onApprove(row, validation.academics);
    if (shouldClose) {
      onOpenChange(false);
    } else {
      setError("The approval was not saved. Check the message on this request and try again.");
    }
  };

  const handleReject = async (): Promise<void> => {
    setError(null);
    if (remarks.trim().length === 0) {
      setError("A rejection reason is required.");
      return;
    }
    const shouldClose = await onReject(row, remarks.trim());
    if (shouldClose) {
      onOpenChange(false);
    } else {
      setError("The rejection was not saved. Check the message on this request and try again.");
    }
  };

  const handleResume = async (): Promise<void> => {
    setError(null);
    const shouldClose = await onResume(row);
    if (shouldClose) {
      onOpenChange(false);
    } else {
      setError("The approval did not finish. Check the message on this request and try again.");
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        data-testid="school-request-review-dialog"
      >
        <DialogHeader>
          <DialogTitle>Review attendance request</DialogTitle>
          <DialogDescription>
            Check the student&apos;s details and submitted documents before you decide.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <SubmissionSummary row={row} />

          <EducationRequestDocuments documents={row.documents} />

          {canResume ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <Lock className="h-4 w-4" aria-hidden="true" />
                Approval saved
              </p>
              <p className="mt-1 text-muted-foreground">
                This approval was saved but did not finish. Resume to complete it. Saved student
                details cannot be edited.
              </p>
              {savedDecision !== null ? (
                <p className="mt-1 text-xs text-muted-foreground">{savedDecision}</p>
              ) : null}
            </div>
          ) : null}

          {mode === "view" && canDecide ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="font-semibold">{outcome.title}</p>
              <p className="mt-1 text-muted-foreground">{outcome.body}</p>
            </div>
          ) : null}

          {mode === "approve" ? (
            <div className="rounded-lg border p-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Optional. These details are saved once when you approve and cannot be changed later.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="attendance_student_number">Student Number</Label>
                  <Input
                    id="attendance_student_number"
                    data-testid="approve-student-number"
                    placeholder="e.g. 2026-00123"
                    value={studentNumber}
                    onChange={(event) => setStudentNumber(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attendance_gpa">GPA (0-5)</Label>
                  <Input
                    id="attendance_gpa"
                    data-testid="approve-gpa"
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g. 1.75"
                    value={gpa}
                    onChange={(event) => setGpa(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attendance_school_year">School / Completion Year</Label>
                  <Input
                    id="attendance_school_year"
                    data-testid="approve-school-year"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="e.g. 2026"
                    value={schoolYear}
                    onChange={(event) => setSchoolYear(event.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {mode === "reject" ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>Only reject if you cannot confirm that this student attended your school.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendance_reject_reason">Reason *</Label>
                <Textarea
                  id="attendance_reject_reason"
                  data-testid="reject-remarks"
                  placeholder="Explain why you are rejecting this request."
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  aria-invalid={error !== null}
                  rows={4}
                />
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
              {canResume ? (
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
              ) : null}
              {canDecide ? (
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
                    disabled={busy}
                    data-testid="review-approve"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </>
              ) : null}
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
                disabled={busy}
                data-testid="approve-confirm"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Approve attendance
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
                disabled={busy}
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

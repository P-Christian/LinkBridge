"use client";

// src/modules/client/interviews/components/InterviewEvaluationModal.tsx

import React, { useState, useEffect, useMemo } from "react";
import { Interview, EvaluationFormData, AttendanceStatus } from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Award, Loader2, CheckCircle, XCircle, User, Lock, ArrowRightCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_COLOR_CLASSES } from "@/modules/client/pipeline/types";

interface InterviewEvaluationModalProps {
  interview: Interview | null;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmitEvaluation: (payload: EvaluationFormData) => Promise<boolean>;
}

export default function InterviewEvaluationModal({
  interview,
  open,
  saving,
  onClose,
  onSubmitEvaluation,
}: InterviewEvaluationModalProps) {
  const applications = useMemo(() => interview?.applications ?? [], [interview?.applications]);
  const [selectedAppId, setSelectedAppId] = useState<number>(0);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>("ATTENDED");
  const [feedbackText, setFeedbackText] = useState<string>("");
  const [decisionAction, setDecisionAction] = useState<"KEEP" | "ADVANCE" | "REJECT">("KEEP");
  const [selectedToStageId, setSelectedToStageId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    if (applications.length > 0) {
      const first = applications[0];
      queueMicrotask(() => {
        setSelectedAppId(first.interview_application_id);
        setAttendanceStatus(first.attendance_status === "NO_SHOW" ? "NO_SHOW" : "ATTENDED");
        setFeedbackText(first.feedback || "");
        setDecisionAction("KEEP");
      });
    }
  }, [open, interview?.interview_id, applications]);

  const activeApp = applications.find((a) => a.interview_application_id === selectedAppId) || applications[0];

  const readinessBlocking = Boolean(activeApp?.stage_readiness?.blocking);
  const readinessReason = activeApp?.stage_readiness?.missing?.length
    ? `Cannot advance candidate: ${activeApp.stage_readiness.missing.join(", ")} required.`
    : "Cannot advance candidate: required items for the current stage have not been completed.";

  const forwardStages = useMemo(() => {
    return (
      activeApp?.allowed_next_stages?.filter(
        (s) => s.stage_type !== "REJECTED" && s.stage_type !== "WITHDRAWN"
      ) ?? []
    );
  }, [activeApp?.allowed_next_stages]);

  const rejectStage = useMemo(() => {
    return activeApp?.allowed_next_stages?.find((s) => s.stage_type === "REJECTED") ?? null;
  }, [activeApp?.allowed_next_stages]);

  const effectiveSelectedToStageId =
    selectedToStageId && forwardStages.some((s) => s.id === selectedToStageId)
      ? selectedToStageId
      : (forwardStages[0]?.id ?? null);

  const isCompleted = Boolean(
    interview?.interview_status === "COMPLETED" ||
      interview?.interview_status === "CANCELLED" ||
      (activeApp && activeApp.attendance_status !== "PENDING")
  );

  const handleCandidateChange = (valStr: string) => {
    const targetId = Number(valStr);
    setSelectedAppId(targetId);
    const targetApp = applications.find((a) => a.interview_application_id === targetId);
    if (targetApp) {
      setAttendanceStatus(targetApp.attendance_status === "NO_SHOW" ? "NO_SHOW" : "ATTENDED");
      setFeedbackText(targetApp.feedback || "");
      setDecisionAction("KEEP");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCompleted || !selectedAppId) return;

    let targetStageId: number | null = null;
    let decision: "HIRED" | "REJECTED" | "NO_ACTION" = "NO_ACTION";

    if (decisionAction === "ADVANCE" && !readinessBlocking) {
      targetStageId = effectiveSelectedToStageId;
      const targetStage = activeApp?.allowed_next_stages?.find((s) => s.id === effectiveSelectedToStageId);
      if (targetStage?.stage_type === "HIRED") {
        decision = "HIRED";
      }
    } else if (decisionAction === "REJECT") {
      targetStageId = rejectStage?.id ?? null;
      decision = "REJECTED";
    } else {
      decision = "NO_ACTION";
    }

    const ok = await onSubmitEvaluation({
      interview_application_id: selectedAppId,
      attendance_status: attendanceStatus,
      feedback: feedbackText,
      decision,
      to_stage_id: targetStageId,
    });
    if (ok) {
      onClose();
    }
  };

  if (!interview) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto max-md:max-w-[calc(100vw-2rem)] max-md:max-h-[90dvh] max-md:overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <Award className="h-4 w-4 text-emerald-500" />
            Candidate Interview Evaluation & Attendance
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Read-Only Notice Banner */}
          {isCompleted && (
            <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 rounded-xl text-indigo-700 dark:text-indigo-300 text-sm md:text-xs font-semibold">
              <Lock className="h-4 w-4 shrink-0 text-indigo-500" />
              <span>
                <strong>Evaluation Recorded (Read-Only View):</strong> This candidate evaluation has already been submitted and cannot be edited.
              </span>
            </div>
          )}

          {/* Candidate Selection if Multiple */}
          {applications.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Select Candidate to View / Evaluate
              </Label>
              <SearchableSelect
                options={applications.map((app) => ({
                  value: String(app.interview_application_id),
                  label: `${app.applicant_name} (${app.job_title}) — Status: ${app.attendance_status}`,
                }))}
                value={String(selectedAppId)}
                onValueChange={handleCandidateChange}
                placeholder="Select candidate..."
                className="h-9 max-md:min-h-10 md:text-xs font-semibold rounded-lg"
              />
            </div>
          )}

          {/* Active Candidate Info Header */}
          {activeApp && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-indigo-500" />
                  {activeApp.applicant_name}
                </p>
                <p className="text-sm md:text-xs text-zinc-500 mt-0.5">
                  Role: <span className="font-medium text-zinc-700 dark:text-zinc-300">{activeApp.job_title}</span>
                </p>
              </div>

              {activeApp.stage_name && (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Current Stage</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
                      STAGE_COLOR_CLASSES[activeApp.stage_color || "sky"]?.badge || "bg-muted text-muted-foreground"
                    )}
                  >
                    {activeApp.stage_name}
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Attendance Status Selector */}
          <div className="space-y-2">
            <Label className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Candidate Attendance Status <span className="text-rose-500">*</span>
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isCompleted}
                onClick={() => setAttendanceStatus("ATTENDED")}
                className={cn(
                  "py-2 px-3 max-md:min-h-10 text-sm md:text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-1.5",
                  attendanceStatus === "ATTENDED"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-500",
                  isCompleted && "cursor-not-allowed opacity-80"
                )}
              >
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                Attended Interview
              </button>

              <button
                type="button"
                disabled={isCompleted}
                onClick={() => setAttendanceStatus("NO_SHOW")}
                className={cn(
                  "py-2 px-3 max-md:min-h-10 text-sm md:text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-1.5",
                  attendanceStatus === "NO_SHOW"
                    ? "border-rose-600 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-500",
                  isCompleted && "cursor-not-allowed opacity-80"
                )}
              >
                <XCircle className="h-3.5 w-3.5 text-rose-500" />
                No Show (Did Not Attend)
              </button>
            </div>
          </div>

          {/* Feedback Text */}
          <div className="space-y-2">
            <Label htmlFor="eval-feedback" className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Candidate Evaluation Feedback <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="eval-feedback"
              readOnly={isCompleted}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
              placeholder={isCompleted ? "No feedback notes entered." : "Record technical competence, communication skills, culture fit, and feedback notes..."}
              className={cn("md:text-xs max-md:text-base rounded-lg resize-none", isCompleted && "bg-zinc-50/80 dark:bg-zinc-900/80 cursor-default")}
              required={!isCompleted}
            />
          </div>

          {/* Candidate Pipeline Action (ATS Pipeline Driven) */}
          {!isCompleted && (
            <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <Label className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Candidate Pipeline Action (Optional)
                </Label>

              </div>

              {/* 3 Main Action Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDecisionAction("KEEP")}
                  className={cn(
                    "py-2 px-3 max-md:min-h-10 text-sm md:text-xs font-medium rounded-lg border transition-all text-center flex items-center justify-center gap-1.5",
                    decisionAction === "KEEP"
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold shadow-xs"
                      : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  )}
                >
                  Keep in Current Stage
                </button>

                <button
                  type="button"
                  disabled={readinessBlocking}
                  title={readinessBlocking ? readinessReason : undefined}
                  onClick={() => setDecisionAction("ADVANCE")}
                  className={cn(
                    "py-2 px-3 max-md:min-h-10 text-sm md:text-xs font-medium rounded-lg border transition-all flex items-center justify-center gap-1.5",
                    decisionAction === "ADVANCE"
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold shadow-xs"
                      : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900",
                    readinessBlocking && "cursor-not-allowed opacity-60"
                  )}
                >
                  <ArrowRightCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Advance to Next Stage
                </button>

                <button
                  type="button"
                  onClick={() => setDecisionAction("REJECT")}
                  className={cn(
                    "py-2 px-3 max-md:min-h-10 text-sm md:text-xs font-medium rounded-lg border transition-all flex items-center justify-center gap-1.5",
                    decisionAction === "REJECT"
                      ? "border-rose-600 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold shadow-xs"
                      : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  )}
                >
                  <XCircle className="h-3.5 w-3.5 text-rose-500" />
                  Reject Candidate
                </button>
              </div>

              {/* Conditional sub-selection when ADVANCE is active */}
              {decisionAction === "ADVANCE" && (
                <div className="p-3 bg-zinc-50/80 dark:bg-zinc-900/60 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl space-y-2 animate-in fade-in-50 duration-150">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    <span>Select Target Pipeline Stage:</span>
                    <span className="text-[11px] text-zinc-400">
                      {forwardStages.length} stage{forwardStages.length !== 1 ? "s" : ""} available
                    </span>
                  </div>

                  {forwardStages.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {forwardStages.map((stage) => {
                        const isSelected = effectiveSelectedToStageId === stage.id;
                        const palette = STAGE_COLOR_CLASSES[stage.color] || STAGE_COLOR_CLASSES.sky;
                        return (
                          <button
                            key={stage.id}
                            type="button"
                            disabled={readinessBlocking}
                            title={readinessBlocking ? readinessReason : undefined}
                            onClick={() => setSelectedToStageId(stage.id)}
                            className={cn(
                              "flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium text-left transition-all",
                              isSelected
                                ? "border-emerald-600 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700",
                              readinessBlocking && "cursor-not-allowed opacity-60"
                            )}
                          >
                            <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", palette.dot)} />
                            <span className="truncate flex-1 font-semibold">{stage.stage_name}</span>
                            {stage.is_terminal && (
                              <span className="text-[10px] text-zinc-400 font-normal shrink-0">Terminal</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 py-1">
                      No subsequent forward stages configured. You can keep the candidate in the current stage or reject.
                    </p>
                  )}
                </div>
              )}

              {decisionAction === "KEEP" && (
                <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800 rounded-xl text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span>
                    Candidate will remain in <strong>{activeApp?.stage_name || "the current stage"}</strong>. Evaluation and attendance will be recorded.
                  </span>
                </div>
              )}

              {decisionAction === "REJECT" && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
                  <span>
                    Candidate application will be moved to the <strong>Rejected</strong> stage.
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            {isCompleted ? (
              <Button type="button" onClick={onClose} className="h-9 max-md:min-h-10 text-sm md:text-xs rounded-lg font-semibold ml-auto">
                Close View
              </Button>
            ) : (
              <>
                <Button variant="outline" type="button" onClick={onClose} disabled={saving} className="h-9 max-md:min-h-10 text-sm md:text-xs rounded-lg">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-9 max-md:min-h-10 text-sm md:text-xs rounded-lg bg-[#14a800] hover:bg-[#118f00] text-white border-0 font-medium"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                      Saving Evaluation...
                    </>
                  ) : (
                    "Save Candidate Evaluation"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

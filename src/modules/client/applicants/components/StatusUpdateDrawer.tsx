/* eslint-disable react-hooks/set-state-in-effect */
// src/modules/client/applicants/components/StatusUpdateDrawer.tsx
"use client";

import React, { useState } from "react";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import {
  Applicant,
  ApplicationStatus,
  STATUS_LABELS,
  ALLOWED_STATUS_TRANSITIONS,
} from "../types";
import { STAGE_COLOR_CLASSES } from "@/modules/client/pipeline/types";
import { AlertCircle, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusUpdateDrawerProps {
  applicant: Applicant | null;
  open: boolean;
  onClose: () => void;
  onSave?: (
    applicationId: number,
    status: ApplicationStatus,
    notes: string
  ) => Promise<void>;
  onSaveStage?: (
    applicationId: number,
    toStageId: number,
    notes: string
  ) => Promise<void>;
  saving: boolean;
  error: string;
  onOverride?: (applicant: Applicant) => void;
}

export default function StatusUpdateDrawer({
  applicant,
  open,
  onClose,
  onSave,
  onSaveStage,
  saving,
  error,
  onOverride,
}: StatusUpdateDrawerProps) {
  const currentStatus = applicant?.application_status ?? "APPLIED";
  const currentStageName = applicant?.stage_name || STATUS_LABELS[currentStatus] || currentStatus;
  const currentStageColor = applicant?.stage_color || "sky";
  const readinessBlocking = Boolean(applicant?.stage_readiness?.blocking);
  const readinessMissing = applicant?.stage_readiness?.missing ?? [];

  const hasDynamicStages = Boolean(
    applicant?.allowed_next_stages !== undefined && applicant?.allowed_next_stages !== null
  );
  const dynamicAllowed = applicant?.allowed_next_stages ?? [];
  const legacyAllowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] ?? [];

  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [selectedLegacyStatus, setSelectedLegacyStatus] = useState<ApplicationStatus>(
    legacyAllowed[0] ?? currentStatus
  );
  const [notes, setNotes] = useState(applicant?.client_notes ?? "");

  React.useEffect(() => {
    if (applicant) {
      if (applicant.allowed_next_stages && applicant.allowed_next_stages.length > 0) {
        setSelectedStageId(String(applicant.allowed_next_stages[0].id));
      } else {
        setSelectedStageId("");
      }

      const legacy = ALLOWED_STATUS_TRANSITIONS[applicant.application_status] ?? [];
      setSelectedLegacyStatus(legacy[0] ?? applicant.application_status);
      setNotes(applicant.client_notes ?? "");
    }
  }, [applicant]);

  const canSave = hasDynamicStages ? dynamicAllowed.length > 0 : legacyAllowed.length > 0;

  const handleSave = async () => {
    if (!applicant || !canSave) return;

    if (hasDynamicStages && selectedStageId) {
      const stageIdNum = parseInt(selectedStageId, 10);
      if (onSaveStage) {
        await onSaveStage(applicant.application_id, stageIdNum, notes);
        return;
      }

      const matchedStage = dynamicAllowed.find((s) => s.id === stageIdNum);
      if (matchedStage && onSave) {
        await onSave(
          applicant.application_id,
          matchedStage.stage_type as ApplicationStatus,
          notes
        );
        return;
      }
    }

    if (onSave) {
      await onSave(applicant.application_id, selectedLegacyStatus, notes);
    }
  };

  const isTerminal =
    applicant?.stage_type === "HIRED" ||
    applicant?.stage_type === "REJECTED" ||
    applicant?.stage_type === "WITHDRAWN" ||
    applicant?.application_status === "HIRED" ||
    applicant?.application_status === "REJECTED" ||
    applicant?.application_status === "WITHDRAWN";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-md:max-w-[calc(100vw-2rem)] max-md:max-h-[90dvh] max-md:overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-sm font-bold">
              Update Candidate Stage
            </DialogTitle>
            {applicant && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                  STAGE_COLOR_CLASSES[currentStageColor]?.badge ||
                    "bg-muted text-muted-foreground"
                )}
              >
                {currentStageName}
              </Badge>
            )}
          </div>
          {applicant && (
            <p className="text-sm text-zinc-500 mt-1 md:text-xs">
              {applicant.applicant_name ?? `Applicant #${applicant.application_id}`} &bull;{" "}
              {applicant.job_title ?? "—"}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 rounded-lg text-rose-700 dark:text-rose-300 text-sm md:text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {hasDynamicStages ? (
            dynamicAllowed.length > 0 ? (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 md:text-xs">
                  Destination Stage <span className="text-rose-500">*</span>
                </Label>
                <SearchableSelect
                  options={dynamicAllowed.map((stage) => ({
                    value: String(stage.id),
                    label: `${stage.stage_name}${stage.is_terminal ? " (Terminal)" : ""}`,
                  }))}
                  value={selectedStageId}
                  onValueChange={(v) => setSelectedStageId(v)}
                  placeholder="Select target stage..."
                  className="h-9 max-md:min-h-10 md:text-sm"
                />
              </div>
            ) : (
              <div className="flex items-start gap-2.5 p-3.5 bg-muted/40 border border-border/70 rounded-xl text-sm text-muted-foreground md:text-xs">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">
                    Current Stage: {currentStageName}
                  </p>
                  <p className="mt-1 leading-relaxed">
                    {isTerminal
                      ? "This candidate has reached a terminal stage and cannot be transitioned further."
                      : "No valid forward transitions are configured from this stage in the active job pipeline."}
                  </p>
                </div>
              </div>
            )
          ) : legacyAllowed.length > 0 ? (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 md:text-xs">
                New Status <span className="text-rose-500">*</span>
              </Label>
              <SearchableSelect
                options={legacyAllowed.map((s) => ({
                  value: s,
                  label: STATUS_LABELS[s],
                }))}
                value={selectedLegacyStatus}
                onValueChange={(v) =>
                  setSelectedLegacyStatus(v as ApplicationStatus)
                }
                placeholder="Select status..."
                className="h-9 max-md:min-h-10 md:text-sm"
              />
            </div>
          ) : (
            <div className="flex items-start gap-2.5 p-3.5 bg-muted/40 border border-border/70 rounded-xl text-sm text-muted-foreground md:text-xs">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">
                  Current Status: {STATUS_LABELS[currentStatus]}
                </p>
                <p className="mt-1 leading-relaxed">
                  {currentStatus === "INTERVIEWING"
                    ? "Active interviews are managed directly from the Interview Workspace. You can reschedule or cancel the session from there."
                    : isTerminal
                    ? "This candidate is in a terminal status and cannot be transitioned manually."
                    : "No manual status transitions are available for this candidate."}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label
              htmlFor="status-notes"
              className="text-sm font-medium text-zinc-600 dark:text-zinc-400 md:text-xs"
            >
              Internal Notes (optional)
            </Label>
            <Textarea
              id="status-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes about this applicant..."
              className="resize-none md:text-sm max-md:text-base"
            />
          </div>

          {readinessBlocking && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive md:text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Cannot advance: {readinessMissing.join(", ")} required.
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row flex-wrap items-center justify-end gap-2 max-md:flex-col-reverse max-md:items-stretch">
          {readinessBlocking && onOverride && applicant && (
            <Button
              variant="outline"
              onClick={() => onOverride(applicant)}
              className="h-9 max-md:min-h-10 text-sm rounded-lg gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30 max-md:w-full"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Advance without requirements…
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="h-9 max-md:min-h-10 text-sm rounded-lg"
          >
            Cancel
          </Button>
          {canSave && (
            <Button
              onClick={handleSave}
              disabled={saving || readinessBlocking}
              className="h-9 max-md:min-h-10 text-sm rounded-lg"
            >
              {saving ? "Saving..." : "Save Stage"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


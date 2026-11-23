// Audited escape hatch for a readiness-blocked stage move: pick a forward
// destination and record why the missing requirements are being waived.
"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Applicant } from "../types";

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;

interface ReadinessOverrideDialogProps {
  open: boolean;
  applicant: Applicant | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (toStageId: number, reason: string) => Promise<void>;
}

export default function ReadinessOverrideDialog({
  open,
  applicant,
  busy,
  error,
  onClose,
  onConfirm,
}: ReadinessOverrideDialogProps) {
  const [selectedStageId, setSelectedStageId] = useState("");
  const [reason, setReason] = useState("");

  const forwardStages = (applicant?.allowed_next_stages ?? []).filter(
    (stage) => stage.stage_type !== "REJECTED" && stage.stage_type !== "WITHDRAWN"
  );
  const missing = applicant?.stage_readiness?.missing ?? [];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new target or reopen starts a fresh form
    setSelectedStageId("");
    setReason("");
  }, [open, applicant?.application_id]);

  const trimmedReason = reason.trim();
  const reasonInvalid = reason.length > 0 && trimmedReason.length < MIN_REASON_LENGTH;
  const canConfirm = selectedStageId !== "" && trimmedReason.length >= MIN_REASON_LENGTH;

  const handleConfirm = async () => {
    if (!canConfirm || busy) return;
    const toStageId = Number(selectedStageId);
    if (!Number.isInteger(toStageId)) return;
    await onConfirm(toStageId, trimmedReason);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        if (!state && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-md max-md:max-w-[calc(100vw-2rem)] max-md:max-h-[90dvh] max-md:overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Advance without requirements
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground md:text-xs">
            This moves the candidate forward without completing the required items. The reason is recorded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {applicant && (
            <p className="text-sm font-medium text-foreground md:text-xs">
              {applicant.applicant_name || `Applicant #${applicant.application_id}`}
              {applicant.stage_name ? ` · ${applicant.stage_name}` : ""}
            </p>
          )}

          {missing.length > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-100 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 md:text-xs">
              Missing: {missing.join(", ")}
            </p>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 rounded-lg text-rose-700 dark:text-rose-300 text-sm md:text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {forwardStages.length > 0 ? (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 md:text-xs">
                Destination Stage <span className="text-rose-500">*</span>
              </Label>
              <SearchableSelect
                options={forwardStages.map((stage) => ({
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
            <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground md:text-xs">
              No forward stage is configured for this pipeline.
            </p>
          )}

          <div className="space-y-1.5">
            <Label
              htmlFor="readiness-override-reason"
              className="text-sm font-medium text-zinc-600 dark:text-zinc-400 md:text-xs"
            >
              Reason for override <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="readiness-override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={MAX_REASON_LENGTH}
              disabled={busy}
              placeholder="Why is this candidate advancing without the required items?"
              className="resize-none md:text-sm max-md:text-base"
            />
            {reasonInvalid && (
              <p className="text-xs text-destructive">At least {MIN_REASON_LENGTH} characters.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={busy}
            className="h-9 max-md:min-h-10 text-sm rounded-lg"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy || !canConfirm}
            className="h-9 max-md:min-h-10 text-sm rounded-lg"
          >
            {busy ? "Advancing..." : "Advance candidate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

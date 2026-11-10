// src/modules/vos-admin/school-verification/components/SchoolRejectionReasonModal.tsx
"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SchoolVerificationRecord } from "../types";
import { AlertCircle } from "lucide-react";

interface SchoolRejectionReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  school: SchoolVerificationRecord | null;
  onConfirm: (action: "request_correction", reason: string, internalNotes: string) => Promise<void>;
  isSubmitting: boolean;
}

const SCHOOL_REASON_PRESETS = [
  "Incomplete or unreadable CHED / DepEd / TESDA Recognition or Accreditation document",
  "Expired or unverified Mayor's / Business Permit",
  "School TIN / BIR Certificate of Registration mismatch",
  "School Administrator official appointment letter or ID missing",
  "Institution profile or campus location mismatch",
  "Custom reason (see detailed notes below)",
];

const SCHOOL_REASON_PRESET_OPTIONS = SCHOOL_REASON_PRESETS.map((preset) => ({
  value: preset,
  label: preset,
}));

export const SchoolRejectionReasonModal: React.FC<SchoolRejectionReasonModalProps> = ({
  isOpen,
  onClose,
  school,
  onConfirm,
  isSubmitting,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");
  const [internalNotes, setInternalNotes] = useState<string>("");

  if (!school) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalPublicReason =
      selectedPreset && selectedPreset !== "Custom reason (see detailed notes below)"
        ? `${selectedPreset}. ${customReason}`.trim()
        : customReason.trim();

    if (!finalPublicReason) return;

    await onConfirm("request_correction", finalPublicReason, internalNotes);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Request Document Correction
          </DialogTitle>
          <DialogDescription>
            {`Request missing or corrected accreditation documents from ${school.school_name}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Preset Reason Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="school-preset-reason" className="text-xs font-semibold text-foreground">
              Standard Reason Preset
            </Label>
            <SearchableSelect
              value={selectedPreset}
              onValueChange={setSelectedPreset}
              options={SCHOOL_REASON_PRESET_OPTIONS}
              placeholder="Select a standard preset reason..."
              triggerClassName="w-full text-xs h-9 rounded-lg border-border bg-background text-foreground dark:bg-zinc-900 dark:border-zinc-800"
            />
          </div>

          {/* Public Reason Textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="school-public-reason" className="text-xs font-semibold text-foreground">
              Public Reason / Action Items <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="school-public-reason"
              placeholder="Provide clear details visible to the school administrator..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              rows={3}
              className="text-xs rounded-lg border-border resize-none"
              required
            />
          </div>

          {/* Internal Admin Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="school-internal-notes" className="text-xs font-semibold text-foreground">
              Internal Admin Notes <span className="text-muted-foreground font-normal">(Private)</span>
            </Label>
            <Textarea
              id="school-internal-notes"
              placeholder="Notes visible only to internal VOS admin team..."
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={2}
              className="text-xs rounded-lg border-border resize-none"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={isSubmitting || (!selectedPreset && !customReason.trim())}
              className="rounded-lg text-xs shadow-2xs font-semibold"
            >
              {isSubmitting ? "Submitting..." : "Send Correction Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

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
import { NativeSelect } from "@/components/ui/native-select";
import { CompanyVerificationRecord } from "../types";
import { AlertCircle } from "lucide-react";

interface RevisionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: CompanyVerificationRecord | null;
  onConfirm: (reason: string, internalNotes: string) => Promise<void>;
  isSubmitting: boolean;
}

const REASON_PRESETS = [
  "Select a standard preset reason...",
  "Incomplete or unreadable BIR Form 2303 registration document",
  "Expired SEC / DTI Certificate of Registration",
  "Business Permit address mismatch with submitted company profile",
  "Invalid or unverified Company TIN registration number",
  "Authorized representative identification missing or mismatch",
  "Custom reason (see detailed notes below)",
];

export const RevisionRequestModal: React.FC<RevisionRequestModalProps> = ({
  isOpen,
  onClose,
  company,
  onConfirm,
  isSubmitting,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");
  const [internalNotes, setInternalNotes] = useState<string>("");

  if (!company) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasPreset =
      selectedPreset &&
      !selectedPreset.startsWith("Select") &&
      selectedPreset !== "Custom reason (see detailed notes below)";

    const finalPublicReason = hasPreset
      ? (customReason.trim() ? `${selectedPreset}\n\n${customReason.trim()}` : selectedPreset)
      : customReason.trim();

    if (!finalPublicReason) return;

    await onConfirm(finalPublicReason, internalNotes);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Request Revision
          </DialogTitle>
          <DialogDescription>
            {`Request missing or corrected documents from ${company.company_name}. The company can edit its profile and resubmit as many times as needed.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Preset Reason Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="preset-reason" className="text-xs font-semibold text-foreground">
              Standard Reason Preset
            </Label>
            <NativeSelect
              id="preset-reason"
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              className="w-full text-xs h-9 rounded-lg border-border bg-background"
            >
              {REASON_PRESETS.map((preset, i) => (
                <option key={i} value={preset}>
                  {preset}
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* Public Reason Textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="public-reason" className="text-xs font-semibold text-foreground">
              Public Reason / Action Items <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="public-reason"
              placeholder="Provide clear details visible to the company owner..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              rows={3}
              className="text-xs rounded-lg border-border resize-none"
              required
            />
          </div>

          {/* Internal Admin Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="internal-notes" className="text-xs font-semibold text-foreground">
              Internal Admin Notes <span className="text-muted-foreground font-normal">(Private)</span>
            </Label>
            <Textarea
              id="internal-notes"
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
              size="sm"
              disabled={isSubmitting || (!selectedPreset && !customReason.trim())}
              className="rounded-lg text-xs shadow-2xs font-semibold"
            >
              {isSubmitting ? "Submitting..." : "Send Revision Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

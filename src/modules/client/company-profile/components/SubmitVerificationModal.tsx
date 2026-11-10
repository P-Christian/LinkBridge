"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Send, RefreshCw, FileText, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

interface SubmitVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  isResubmission: boolean;
  companyName?: string | null;
  completionPercent: number;
  uploadedDocsCount: number;
}

export const SubmitVerificationModal: React.FC<SubmitVerificationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  isResubmission,
  companyName,
  completionPercent,
  uploadedDocsCount,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md w-[92vw] rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-xl p-6">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2.5 text-base font-bold text-foreground">
            <span className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              {isResubmission ? (
                <RefreshCw className="h-5 w-5" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </span>
            {isResubmission
              ? "Confirm Profile Resubmission"
              : "Submit Profile for Verification"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
            {isResubmission ? (
              <>
                You are about to resubmit{" "}
                <strong className="font-semibold text-foreground">
                  {companyName || "your company profile"}
                </strong>{" "}
                for administrative verification. Please ensure that all reviewer
                feedback items and requested documents have been addressed.
              </>
            ) : (
              <>
                You are about to submit{" "}
                <strong className="font-semibold text-foreground">
                  {companyName || "your company profile"}
                </strong>{" "}
                for formal verification. Once submitted, profile and document
                modifications will be locked while under review.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Status / Readiness Summary */}
        <div className="my-3 p-3.5 rounded-xl border border-primary/15 bg-muted/40 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              Profile Completion
            </span>
            <span className="font-semibold text-foreground">
              {Math.round(completionPercent)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Uploaded Documents
            </span>
            <span className="font-semibold text-foreground">
              {uploadedDocsCount} {uploadedDocsCount === 1 ? "document" : "documents"}
            </span>
          </div>
        </div>

        {isResubmission && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20 text-[11px] text-warning leading-relaxed">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Resubmission will clear the current revision status and place your
              profile back in the active verification queue.
            </span>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2 sm:gap-2">
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
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="rounded-lg text-xs font-semibold gap-1.5 bg-gradient-to-r from-primary to-info hover:brightness-110 text-primary-foreground border-0 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {isResubmission ? "Resubmitting..." : "Submitting..."}
              </>
            ) : isResubmission ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Confirm & Resubmit
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Confirm & Submit
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

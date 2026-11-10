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
import { ShieldCheck } from "lucide-react";

interface ApproveConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName?: string | null;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export const ApproveConfirmationModal: React.FC<ApproveConfirmationModalProps> = ({
  isOpen,
  onClose,
  companyName,
  onConfirm,
  isSubmitting,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-foreground">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </span>
            Approve Company Verification
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-1">
            Are you sure you want to approve verification for{" "}
            <strong className="font-semibold text-foreground">{companyName}</strong>? This will
            grant them the verified badge and activate full hiring privileges.
          </DialogDescription>
        </DialogHeader>

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
            className="rounded-lg text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {isSubmitting ? "Approving..." : "Approve Verification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

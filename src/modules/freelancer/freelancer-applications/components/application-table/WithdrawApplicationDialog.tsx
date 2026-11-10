// src/modules/freelancer/freelancer-applications/components/application-table/WithdrawApplicationDialog.tsx
"use client";

import React, { useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationItem } from "../../types";

interface Props {
  application: ApplicationItem | null;
  onClose: () => void;
  onWithdrawn: () => void;
}

export function WithdrawApplicationDialog({ application, onClose, onWithdrawn }: Props) {
  const [reason, setReason] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setReason("");
    }
  };

  const executeWithdrawal = async () => {
    if (!application) return;
    setIsWithdrawing(true);
    try {
      const res = await fetch("/api/freelancer/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: application.application_id,
          action: "withdraw",
          reason: reason.trim() || "Withdrawn by candidate",
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to withdraw application.");
      } else {
        toast.success("Application withdrawn successfully!");
        handleOpenChange(false);
        onWithdrawn();
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while withdrawing the application.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <Dialog open={!!application} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl max-md:[&>[data-slot=dialog-close]]:p-3.5 max-md:[&>[data-slot=dialog-close]]:-m-3.5">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            Withdraw Application
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-2">
            Are you sure you want to withdraw your application for{" "}
            <strong className="text-foreground">{application?.job_title}</strong> at{" "}
            <strong className="text-foreground">{application?.company_name}</strong>?
            <br />
            <br />
            <span className="text-rose-600 dark:text-rose-400 font-medium">
              ⚠️ Warning: This action cannot be undone and will retract your candidacy from the
              employer.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5 py-4">
          <div className="flex items-center justify-between">
          <Label htmlFor="withdraw-reason-input"
            className="text-sm md:text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            Reason for withdrawal (optional)
            </Label>
            <span className="text-xs text-muted-foreground">
              {reason.length}/255
            </span>
          </div>
          <Textarea
            id="withdraw-reason-input"
            placeholder="e.g. I have accepted another offer, salary misalignment, etc."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="resize-none text-base md:text-sm rounded-xl bg-background w-full min-w-0 max-w-full break-words break-all [overflow-wrap:anywhere]"
            maxLength={255}
            rows={3}
            disabled={isWithdrawing}
          />
        </div>
        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isWithdrawing}
            className="rounded-xl h-9 text-sm max-md:min-h-11"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={executeWithdrawal}
            disabled={isWithdrawing}
            className="rounded-xl h-9 text-sm bg-rose-600 hover:bg-rose-700 text-white font-medium border-0 max-md:min-h-11"
          >
            {isWithdrawing ? "Withdrawing..." : "Confirm Withdrawal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

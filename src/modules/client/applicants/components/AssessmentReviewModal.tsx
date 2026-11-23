// Read-only assessment review entry point: opens the self-contained
// AssessmentReviewSection (submitted attempts, answers, proof, and existing
// reviewer actions) for a single application. Thin wrapper — all fetching and
// review logic stays in the assessment-review module.
"use client";

import { ClipboardCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AssessmentReviewSection from "@/modules/client/assessment-review/components/AssessmentReviewSection";

interface AssessmentReviewModalProps {
  open: boolean;
  applicationId: number | null;
  applicantName?: string;
  onClose: () => void;
  onReviewed?: () => void;
  allowedNextStages?: Array<{ id: number; stage_name: string; stage_type: string; color?: string }>;
  onRequestMove?: (toStageId: number, stageName: string) => void;
  readiness?: { blocking: boolean; missing: string[]; code: string | null } | null;
}

export default function AssessmentReviewModal({
  open,
  applicationId,
  applicantName,
  onClose,
  onReviewed,
  allowedNextStages,
  onRequestMove,
  readiness,
}: AssessmentReviewModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        if (!state) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-md:max-w-[calc(100vw-2rem)] max-md:max-h-[90dvh] max-md:overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Assessment Review
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground md:text-xs">
            {applicantName
              ? `Review the assessment submission from ${applicantName}.`
              : "Review the applicant's assessment submission."}
          </DialogDescription>
        </DialogHeader>

        {open && applicationId !== null && (
          <AssessmentReviewSection
            applicationId={applicationId}
            onChanged={onReviewed}
            allowedNextStages={allowedNextStages}
            onRequestMove={onRequestMove}
            readiness={readiness}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

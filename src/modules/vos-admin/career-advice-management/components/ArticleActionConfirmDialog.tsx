// src/modules/vos-admin/career-advice-management/components/ArticleActionConfirmDialog.tsx
"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Send, Save } from "lucide-react";

export type ConfirmActionType = "DRAFT" | "PUBLISH" | "DISCARD";

interface ArticleActionConfirmDialogProps {
  isOpen: boolean;
  actionType: ConfirmActionType | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ArticleActionConfirmDialog({
  isOpen,
  actionType,
  isSubmitting = false,
  onClose,
  onConfirm,
}: ArticleActionConfirmDialogProps) {
  if (!actionType) return null;

  const config = {
    DRAFT: {
      title: "Save as Draft?",
      desc: "This will save your progress. The article will remain unpublished and will NOT be visible on the public landing page.",
      confirmText: "Save Draft",
      icon: <Save className="h-5 w-5 text-primary" />,
      buttonClass: "bg-primary text-primary-foreground",
    },
    PUBLISH: {
      title: "Publish Article to LinkBridge?",
      desc: "This article will immediately go live on the public Career Advice landing page with the published date set to now (UTC).",
      confirmText: "Publish Now",
      icon: <Send className="h-5 w-5 text-emerald-600" />,
      buttonClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
    },
    DISCARD: {
      title: "Discard Unsaved Changes?",
      desc: "You have unsaved changes in this article. If you leave now, all your new edits will be lost.",
      confirmText: "Discard & Exit",
      icon: <AlertCircle className="h-5 w-5 text-destructive" />,
      buttonClass: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    },
  }[actionType];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            {config.icon}
            <DialogTitle className="text-base font-semibold text-foreground">
              {config.title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-2 leading-relaxed">
            {config.desc}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs"
          >
            {actionType === "DISCARD" ? "Keep Editing" : "Cancel"}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`text-xs shadow-xs ${config.buttonClass}`}
          >
            {isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {config.confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

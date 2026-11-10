// src/modules/vos-admin/career-advice-management/components/ArticleDeleteDialog.tsx
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
import { CareerArticle } from "../types/article.types";
import { Loader2, AlertTriangle } from "lucide-react";

interface ArticleDeleteDialogProps {
  article: CareerArticle | null;
  isOpen: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ArticleDeleteDialog({
  article,
  isOpen,
  isDeleting,
  onClose,
  onConfirm,
}: ArticleDeleteDialogProps) {
  if (!article) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle className="text-base font-semibold">Delete Career Article</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-2">
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold text-foreground">&quot;{article.title}&quot;</span>?
            This will also delete associated asset tracking records. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="text-xs"
          >
            {isDeleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Yes, Delete Article
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

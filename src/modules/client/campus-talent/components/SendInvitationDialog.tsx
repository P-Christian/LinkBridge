
"use client";
// src/modules/client/campus-talent/components/SendInvitationDialog.tsx

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CampusMatchResult } from "@/modules/matching-engine/campus/types";

interface SendInvitationDialogProps {
  target: CampusMatchResult | null;
  jobId?: number | null;
  jobTitle?: string | null;
  schoolId?: number;
  schoolName: string;
  onClose: () => void;
  onSent: () => void;
}

type DialogState = "IDLE" | "SENDING" | "SUCCESS" | "FAILED";

export default function SendInvitationDialog({
  target,
  jobId,
  jobTitle,
  schoolName,
  schoolId,
  onClose,
  onSent,
}: SendInvitationDialogProps) {
  const [state, setState] = useState<DialogState>("IDLE");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    if (!target) return;

    setState("SENDING");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/client/campus-talent/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studentId: target.candidateId,
          schoolId: schoolId || undefined,
          jobId: jobId || null,
          recipientEmail: target.email,
          recipientName: target.studentName,
          schoolName,
          courseName: target.courseName,
          jobTitle: jobTitle || null,
        }),
      });

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        warnings?: string[];
      };

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to send invitation.");
      }

      // The invite went out; part of recording it may still have failed, and
      // the dialog closes on a green check, so the gap has to be said elsewhere.
      (Array.isArray(json.warnings) ? json.warnings : []).forEach((warning) =>
        toast.warning(warning)
      );

      setState("SUCCESS");

      setTimeout(() => {
        onSent();
        setState("IDLE");
      }, 1800);
    } catch (e: unknown) {
      setErrorMessage(
        e instanceof Error ? e.message : "Failed to send invitation."
      );
      setState("FAILED");
    }
  }, [target, jobId, jobTitle, schoolId, schoolName, onSent]);

  return (
    <AnimatePresence>
      {target && (
        <motion.div
          key="invitation-dialog-overlay"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={state === "IDLE" ? onClose : undefined}
        >
            {/* Dialog */}
            <motion.div
              className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5"
              initial={{
                opacity: 0,
                scale: 0.95,
                y: 12,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.97,
                y: 8,
              }}
              transition={{
                duration: 0.2,
                ease: [0.22, 1, 0.36, 1],
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Send campus invitation"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground text-lg">
                    Send Invitation
                  </h3>

                  <p className="text-sm text-muted-foreground mt-0.5">
                    {jobTitle
                      ? "An email will be sent inviting this student to apply"
                      : "An email will be sent inviting this student to register on VOS Sync"}
                  </p>
                </div>

                <AnimatePresence>
                  {state === "IDLE" && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                      onClick={onClose}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Close"
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                    >
                      <X className="h-5 w-5" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Confirmation details */}
              <motion.div
                className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.05,
                  duration: 0.2,
                }}
              >
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">To</span>
                  <span className="font-medium text-foreground text-right">
                    {target.studentName}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Email</span>
                  <span className="text-foreground text-right break-all">
                    {target.email}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{jobTitle ? "Job" : "Invitation Type"}</span>
                  <span className="font-medium text-foreground text-right">
                    {jobTitle || "General Campus Registration"}
                  </span>
                </div>

                {target.courseName && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Course</span>
                    <span className="text-foreground text-right">
                      {target.courseName}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Status feedback */}
              <div className="min-h-[20px]">
                <AnimatePresence mode="wait">
                  {state === "SUCCESS" && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 20,
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </motion.div>

                      Invitation sent successfully!
                    </motion.div>
                  )}

                  {state === "FAILED" && errorMessage && (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-start gap-2 text-destructive text-sm"
                    >
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{errorMessage}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={state === "SENDING" || state === "SUCCESS"}
                >
                  Cancel
                </Button>

                <Button
                  onClick={handleSend}
                  disabled={state === "SENDING" || state === "SUCCESS"}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {state === "SENDING" ? (
                      <motion.span
                        key="sending"
                        className="flex items-center"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                      >
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Sending...
                      </motion.span>
                    ) : state === "SUCCESS" ? (
                      <motion.span
                        key="sent"
                        className="flex items-center"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Sent!
                      </motion.span>
                    ) : (
                      <motion.span
                        key="send"
                        className="flex items-center"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Send Invitation
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </div>
            </motion.div>
          </motion.div>
      )}
    </AnimatePresence>
  );
}

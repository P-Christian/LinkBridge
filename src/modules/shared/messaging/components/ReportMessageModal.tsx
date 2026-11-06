"use client";

// src/modules/shared/messaging/components/ReportMessageModal.tsx

import React, { useState } from "react";
import { Loader2, X, Flag } from "lucide-react";
import { toast } from "sonner";
import { MessageReportReasonCode } from "@/modules/client/messaging/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  messageId?: number | null;
  conversationId: number;
  reportedUserId?: number | null;
  reportedUserName?: string;
}

const REPORT_REASONS: { code: MessageReportReasonCode; label: string; description: string }[] = [
  {
    code: "SPAM",
    label: "Spam or unwanted messages",
    description: "Unsolicited promotional content, phishing, or deceptive links.",
  },
  {
    code: "HARASSMENT",
    label: "Harassment or bullying",
    description: "Abusive language, intimidation, or persistent unwanted contact.",
  },
  {
    code: "INAPPROPRIATE_CONTENT",
    label: "Inappropriate content",
    description: "Offensive or sexually explicit content.",
  },
  {
    code: "FRAUD_OR_SCAM",
    label: "Fraud or scam",
    description: "Suspicious activity, impersonation, or fake identity.",
  },
  {
    code: "OFF_PLATFORM_PAYMENT",
    label: "Off-platform payment or communication",
    description: "Soliciting payments or sensitive communications outside LinkBridge.",
  },
  {
    code: "OTHER",
    label: "Other issue",
    description: "Any other behavior violating LinkBridge community guidelines.",
  },
];

export default function ReportMessageModal({
  isOpen,
  onClose,
  messageId,
  conversationId,
  reportedUserId,
  reportedUserName,
}: Props) {
  const [selectedReason, setSelectedReason] = useState<MessageReportReasonCode>("SPAM");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) {
      toast.error("Please select a reason for reporting.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/shared/messaging/messages/${messageId ?? 0}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason_code: selectedReason,
          report_details: details.trim() || undefined,
          conversation_id: conversationId,
          reported_user_id: reportedUserId ?? undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit report.");
      }

      toast.success("Report submitted. Our moderation team will review this promptly.", {
        id: "report-success",
        duration: 4000,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast.error(msg, { id: "report-error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-primary/15 bg-card/95 p-6 shadow-2xl backdrop-blur-xl dark:border-primary/20 dark:bg-card/90"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-4 top-4 rounded-xl p-1.5 text-muted-foreground hover:bg-muted/80 hover:text-foreground transition"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Flag className="h-5 w-5" />
          </div>
          <div>
            <h2 id="report-modal-title" className="text-base font-semibold text-foreground">
              {messageId ? "Report message" : "Report conversation"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {reportedUserName ? `Reporting ${reportedUserName}` : "Help us keep LinkBridge safe"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Reason for report</label>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {REPORT_REASONS.map((r) => {
                const checked = selectedReason === r.code;
                return (
                  <label
                    key={r.code}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${checked
                        ? "border-destructive/40 bg-destructive/[0.06] text-foreground"
                        : "border-border/60 bg-card/60 text-muted-foreground hover:border-primary/20 hover:text-foreground"
                      }`}
                  >
                    <input
                      type="radio"
                      name="report_reason"
                      value={r.code}
                      checked={checked}
                      onChange={() => setSelectedReason(r.code)}
                      className="mt-0.5 text-destructive focus:ring-destructive"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold">{r.label}</div>
                      <div className="text-[11px] leading-relaxed text-muted-foreground">
                        {r.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="report-details" className="text-xs font-medium text-foreground">
              Additional details <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              id="report-details"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe what occurred or paste relevant context..."
              className="w-full resize-none rounded-xl border border-primary/15 bg-card/80 p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-full px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-5 py-2 text-xs font-semibold text-destructive-foreground shadow-md hover:bg-destructive/90 transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit report"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

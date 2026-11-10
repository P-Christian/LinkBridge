// src/modules/client/company-profile/components/CompanyStatus.tsx
"use client";

import React from "react";
import { CheckCircle2, AlertCircle, ShieldAlert, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VerificationStatus } from "../types";
import { motion, AnimatePresence } from "framer-motion";

interface CompanyStatusProps {
  status: VerificationStatus;
  remarks?: string | null;
  publicRejectionReason?: string | null;
}

const STATUS_CONFIG: Record<
  VerificationStatus,
  {
    icon: React.ElementType;
    label: string;
    badge: string;
    container: string;
    iconWrapper: string;
    title: string;
    titleClass: string;
    bodyClass: string;
    defaultMessage: string;
  }
> = {
  DRAFT: {
    icon: Clock,
    label: "Draft",
    badge: "bg-muted text-muted-foreground border-border",
    container: "border-border/70 bg-card/70 backdrop-blur-md",
    iconWrapper: "bg-muted text-muted-foreground border-border",
    title: "Registration Status: DRAFT",
    titleClass: "text-foreground",
    bodyClass: "text-muted-foreground",
    defaultMessage: "Your company profile is in draft mode. Click edit to complete your profile details and submit for verification.",
  },
  PENDING_VERIFICATION: {
    icon: Clock,
    label: "In Review",
    badge: "bg-warning/15 text-warning border-warning/30",
    container: "border-warning/25 bg-warning/[0.06] backdrop-blur-md",
    iconWrapper: "bg-warning/15 text-warning border-warning/30",
    title: "Registration Status: PENDING VERIFICATION",
    titleClass: "text-foreground",
    bodyClass: "text-muted-foreground",
    defaultMessage: "Your business account was submitted successfully. Verification officers are reviewing your organization. Job posting and hiring will unlock once verified.",
  },
  CORRECTION_REQUIRED: {
    icon: AlertCircle,
    label: "Needs Revision",
    badge: "bg-warning/15 text-warning border-warning/30",
    container: "border-warning/25 bg-warning/[0.06] backdrop-blur-md",
    iconWrapper: "bg-warning/15 text-warning border-warning/30",
    title: "Registration Status: NEEDS REVISION",
    titleClass: "text-foreground",
    bodyClass: "text-muted-foreground",
    defaultMessage:
      "Our review team returned your submission for revision. Update the highlighted documents and profile details, then resubmit — you can resubmit as many times as needed.",
  },
  VERIFIED: {
    icon: CheckCircle2,
    label: "Verified",
    badge: "bg-success/15 text-success border-success/30",
    container: "border-success/25 bg-success/[0.06] backdrop-blur-md",
    iconWrapper: "bg-success/15 text-success border-success/30",
    title: "Verified Business Profile",
    titleClass: "text-foreground",
    bodyClass: "text-muted-foreground",
    defaultMessage: "Your company registration is active. You can now post open roles, review matching job seekers, schedule interviews, and issue job offers.",
  },
  REJECTED: {
    icon: AlertCircle,
    label: "Rejected",
    badge: "bg-destructive/15 text-destructive border-destructive/30",
    container: "border-destructive/25 bg-destructive/[0.06] backdrop-blur-md",
    iconWrapper: "bg-destructive/15 text-destructive border-destructive/30",
    title: "Business Registration Rejected",
    titleClass: "text-foreground",
    bodyClass: "text-muted-foreground",
    defaultMessage: "Your company verification could not be completed. Please review the reviewer feedback below and resubmit with updated documents.",
  },
  INACTIVE: {
    icon: AlertCircle,
    label: "Inactive",
    badge: "bg-muted text-muted-foreground border-border",
    container: "border-border/70 bg-card/70 backdrop-blur-md",
    iconWrapper: "bg-muted text-muted-foreground border-border",
    title: "Registration Status: INACTIVE",
    titleClass: "text-foreground",
    bodyClass: "text-muted-foreground",
    defaultMessage: "Your company profile is currently inactive. Public visibility and job postings are disabled.",
  },
  SUSPENDED: {
    icon: ShieldAlert,
    label: "Suspended",
    badge: "bg-destructive/15 text-destructive border-destructive/30",
    container: "border-destructive/25 bg-destructive/[0.06] backdrop-blur-md",
    iconWrapper: "bg-destructive/15 text-destructive border-destructive/30",
    title: "Account Temporarily Suspended",
    titleClass: "text-foreground",
    bodyClass: "text-muted-foreground",
    defaultMessage: "Access to job posting has been restricted due to policy guidelines. Please coordinate with the governance team.",
  },
};

interface ParsedFeedback {
  subject: string | null;
  note: string | null;
}

function parseReviewerFeedback(rawText?: string | null): ParsedFeedback {
  if (!rawText?.trim()) return { subject: null, note: null };
  const text = rawText.trim();

  // 1. Double or single newline separation (e.g. "Subject\n\nNote" or "Subject\nNote")
  if (text.includes("\n")) {
    const parts = text.split(/\n+/);
    const subject = parts[0]?.trim() || null;
    const note = parts.slice(1).join("\n").trim() || null;
    return { subject, note };
  }

  // 2. Known standard preset prefix match
  const KNOWN_PRESETS = [
    "Incomplete or unreadable BIR Form 2303 registration document",
    "Expired SEC / DTI Certificate of Registration",
    "Business Permit address mismatch with submitted company profile",
    "Invalid or unverified Company TIN registration number",
    "Authorized representative identification missing or mismatch",
  ];

  for (const preset of KNOWN_PRESETS) {
    if (text.toLowerCase().startsWith(preset.toLowerCase())) {
      const remainder = text.slice(preset.length).trim().replace(/^[\.:\-–—\s]+/, "");
      return {
        subject: preset,
        note: remainder || null,
      };
    }
  }

  // 3. Colon separation: "Subject: Note"
  const colonMatch = text.match(/^([^:\n]{4,80}):\s*(.+)$/s);
  if (colonMatch) {
    return {
      subject: colonMatch[1].trim(),
      note: colonMatch[2].trim(),
    };
  }

  // 4. Period sentence separation if first sentence looks like a subject/title: "Subject. Note"
  const periodMatch = text.match(/^([^\.\n]{5,90}\.)\s+(.+)$/s);
  if (periodMatch) {
    return {
      subject: periodMatch[1].replace(/\.$/, "").trim(),
      note: periodMatch[2].trim(),
    };
  }

  // 5. Default fallback
  return { subject: null, note: text };
}

export default function CompanyStatus({ status, remarks, publicRejectionReason }: CompanyStatusProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING_VERIFICATION;
  const Icon = cfg.icon;
  const feedback = publicRejectionReason || remarks;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`relative overflow-hidden rounded-2xl border p-5 space-y-3 ${cfg.container}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border shrink-0 ${cfg.iconWrapper}`}>
            <Icon className="h-5 w-5" />
          </div>
          <h3 className={`font-bold text-sm ${cfg.titleClass}`}>{cfg.title}</h3>
        </div>
        <Badge className={`w-fit shrink-0 py-1 px-3 text-xs font-semibold rounded-full shadow-2xs border ${cfg.badge}`}>
          {cfg.label}
        </Badge>
      </div>

      <p className={`text-xs leading-relaxed ${cfg.bodyClass}`}>
        {cfg.defaultMessage}
      </p>

      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-2 p-4 rounded-xl border border-destructive/20 bg-background/80 dark:bg-background/40 backdrop-blur-xs space-y-3 shadow-2xs overflow-hidden"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              Verification Reviewer Feedback / Action Items
            </div>

            {(() => {
              const { subject, note } = parseReviewerFeedback(feedback);
              if (subject && note) {
                return (
                  <div className="space-y-2 pt-0.5">
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        Subject / Reason
                      </span>
                      <p className="text-xs font-semibold text-foreground">
                        {subject}
                      </p>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-border/60">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        Reviewer Note & Instructions
                      </span>
                      <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap font-medium">
                        {note}
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap font-medium">
                  {note || subject || feedback}
                </p>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


/* eslint-disable react-hooks/set-state-in-effect */
// src/modules/freelancer/freelancer-referrals/components/ReferModal.tsx
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Check, Users, UserCheck, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReferModalProps {
  jobId: number;
  jobTitle?: string;
  open: boolean;
  onClose: () => void;
}

export default function ReferModal({ jobId, jobTitle, open, onClose }: ReferModalProps) {
  const [referralMode, setReferralMode] = React.useState<"CLOSED" | "OPEN">("CLOSED");
  const [expiryDays, setExpiryDays] = React.useState<number>(30);
  const [customDate, setCustomDate] = React.useState<string>("");
  const [minCustomDate] = React.useState(() => new Date(Date.now() + 86400000).toISOString().split("T")[0]);
  const [isCustomDate, setIsCustomDate] = React.useState<boolean>(false);
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [referralLink, setReferralLink] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  // Reset state on close or open
  React.useEffect(() => {
    if (open) {
      setReferralMode("CLOSED");
      setExpiryDays(30);
      setIsCustomDate(false);
      setCustomDate("");
      setEmail((prev) => prev !== "" ? "" : prev);
      setReferralLink((prev) => prev !== "" ? "" : prev);
      setCopied((prev) => prev !== false ? false : prev);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (referralMode === "CLOSED" && !email.trim()) {
      toast.error("Candidate email required", {
        description: "Please enter the candidate's email address for a closed referral, or select Open Referral for a public link.",
      });
      return;
    }

    if (isCustomDate && !customDate) {
      toast.error("Custom expiry date required", {
        description: "Please pick an expiration date for this invite.",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/freelancer/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          recipient_email: referralMode === "CLOSED" ? email.trim() : undefined,
          referral_type: referralMode,
          expiry_days: !isCustomDate ? expiryDays : undefined,
          expires_at: isCustomDate && customDate ? new Date(customDate).toISOString() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create referral");
      }

      const generatedUrl = `${window.location.origin}/referral/${data.token}`;
      setReferralLink(generatedUrl);

      if (referralMode === "CLOSED" && email.trim()) {
        toast.success("Referral sent!", { description: `Invitation email sent to ${email}.` });
      } else {
        toast.success("Public link generated!", { description: "You can copy and share the link with multiple candidates." });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      toast.error("Referral creation failed", { description: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md max-md:max-h-[90dvh] max-md:overflow-y-auto max-md:[&>[data-slot=dialog-close]]:p-3.5 max-md:[&>[data-slot=dialog-close]]:-m-3.5">
        <DialogHeader>
          <DialogTitle>Refer {jobTitle || "Job Opportunity"}</DialogTitle>
          <DialogDescription>
            Invite a friend or candidate to apply. Choose between a direct single-candidate invite or a multi-use public link.
          </DialogDescription>
        </DialogHeader>

        {referralLink ? (
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              <span>
                {referralMode === "OPEN" ? "Public multi-use link created!" : "Referral token successfully created."}
              </span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="link">Share URL</Label>
              <div className="flex gap-2">
                <Input
                  id="link"
                  value={referralLink}
                  readOnly
                  className="bg-muted/50 text-sm md:text-xs truncate max-md:h-11"
                />
                <Button onClick={handleCopy} size="icon" className="shrink-0 max-md:size-11">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Referral Mode Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Referral Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReferralMode("CLOSED")}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-xl border text-left transition-all",
                    referralMode === "CLOSED"
                      ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                      : "border-border/80 hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-sm">
                    <UserCheck className="h-4 w-4 text-primary" />
                    <span>Closed (1:1)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    Direct invite for a specific candidate. Single-use only.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setReferralMode("OPEN")}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-xl border text-left transition-all",
                    referralMode === "OPEN"
                      ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                      : "border-border/80 hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-sm">
                    <Users className="h-4 w-4 text-primary" />
                    <span>Open (1:N)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    Public share link. Multiple candidates can apply using this URL.
                  </p>
                </button>
              </div>
            </div>

            {/* Email Field with behavior conditioned on mode */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-semibold">
                {referralMode === "CLOSED" ? "Recipient Email (Required)" : "Recipient Email (Disabled)"}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={referralMode === "CLOSED" ? "friend@example.com" : "Not required for public links"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={referralMode === "OPEN" || loading}
                className={cn("col-span-3 max-md:h-11", referralMode === "OPEN" && "bg-muted/50 cursor-not-allowed opacity-70")}
              />
              <p className="text-[11px] text-muted-foreground">
                {referralMode === "CLOSED"
                  ? "An email invitation with a single-use link will be sent to the candidate."
                  : "Not required for public links. Anyone with the URL can accept the referral."}
              </p>
            </div>

            {/* Expiration Settings */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Invite Expiration
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {isCustomDate ? "Specific date" : `${expiryDays} days validity`}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[7, 14, 30, 60].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => {
                      setExpiryDays(days);
                      setIsCustomDate(false);
                    }}
                    className={cn(
                      "px-3 py-1 text-xs rounded-lg border font-medium transition-colors",
                      !isCustomDate && expiryDays === days
                        ? "border-primary bg-primary text-primary-foreground font-semibold"
                        : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {days} Days
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsCustomDate(true)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-lg border font-medium transition-colors flex items-center gap-1",
                    isCustomDate
                      ? "border-primary bg-primary text-primary-foreground font-semibold"
                      : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  Custom
                </button>
              </div>

              {isCustomDate && (
                <div className="pt-1.5">
                  <Input
                    type="date"
                    value={customDate}
                    min={minCustomDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="max-md:h-11 text-xs"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="max-md:min-h-11">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="max-md:min-h-11">
                {loading ? "Processing..." : referralMode === "CLOSED" ? "Send Invitation" : "Generate Public Link"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

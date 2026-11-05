// src/app/(vos-sync)/vos-sync/suspended/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, LogOut, Clock, Send, CheckCircle2, MessageSquare, FileText, Loader2, Check, ExternalLink, Calendar, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { NetworkBackground } from "@/components/public/NetworkBackground";
import ThemeToggleButton from "@/components/theme/ThemeToggleButton";

interface ExistingCase {
  case_id: number;
  user_id: number;
  type?: string | null;
  state: "OPEN" | "ASSIGNED" | "RESOLVED";
  statement?: string | null;
  evidence_refs?: string | null;
  public_decision?: string | null;
  created_at: string;
  resolved_at?: string | null;
}

export default function SuspendedPage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [appealStatement, setAppealStatement] = useState("");
  const [appealEvidence, setAppealEvidence] = useState("");
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [appealSubmitted, setAppealSubmitted] = useState(false);

  const [existingCase, setExistingCase] = useState<ExistingCase | null>(null);
  const [accountStatus, setAccountStatus] = useState<string>("SUSPENDED");
  const [loadingCaseStatus, setLoadingCaseStatus] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchCaseStatus() {
      try {
        const res = await fetch("/api/account/appeal");
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.case && isMounted) {
            setExistingCase(data.case);
          }
          if (data.userStatus && isMounted) {
            setAccountStatus(data.userStatus);
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (isMounted) {
          setLoadingCaseStatus(false);
        }
      }
    }

    fetchCaseStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const hasPendingAppeal = existingCase?.state === "OPEN";

  // Dynamic configuration based on the user's containment state
  const isDeactivated = accountStatus === "DEACTIVATED";
  const isPendingDeletion = accountStatus === "PENDING_DELETION";
  const isBlocked = accountStatus === "BLOCKED";

  const statusConfig = {
    title: isDeactivated
      ? "Account Deactivated"
      : isPendingDeletion
      ? "Account Pending Deletion"
      : isBlocked
      ? "Account Blocked"
      : "Account Suspended",
    description: isDeactivated
      ? "Your VOS Sync account has been deactivated. You may submit a reactivation request."
      : isPendingDeletion
      ? "Your VOS Sync account is scheduled for deletion. You may submit a request to restore your account."
      : "Your VOS Sync account has been placed under administrative containment.",
    actionType: isDeactivated
      ? "REACTIVATION_REQUEST"
      : isPendingDeletion
      ? "RESTORE_ACCOUNT"
      : "SUSPENSION_APPEAL",
    actionButtonText: isDeactivated
      ? "Request Reactivation"
      : isPendingDeletion
      ? "Restore Account"
      : isBlocked
      ? "Appeal Block"
      : "Appeal Suspension",
    modalTitle: isDeactivated
      ? "Request Account Reactivation"
      : isPendingDeletion
      ? "Request Account Restoration"
      : "Appeal Account Containment",
    statementPlaceholder: isDeactivated
      ? "Explain why you would like your account reactivated..."
      : isPendingDeletion
      ? "Explain why you would like to cancel deletion and restore your account..."
      : "Explain why your account suspension/block should be reviewed...",
    colorClass: isDeactivated
      ? "text-muted-foreground"
      : isPendingDeletion
      ? "text-rose-500"
      : "text-red-500",
    btnColorClass: isDeactivated
      ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
      : isPendingDeletion
      ? "bg-rose-600 hover:bg-rose-700 text-white"
      : "bg-red-600 hover:bg-red-700 text-white",
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      } else {
        alert("Logout failed. Please clear your cookies manually.");
      }
    } catch (error) {
      console.error("Failed to sign out:", error);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealStatement.trim()) {
      toast.error("Please provide a statement explaining your appeal.");
      return;
    }

    setSubmittingAppeal(true);
    try {
      const res = await fetch("/api/account/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statement: appealStatement.trim(),
          evidence_refs: appealEvidence.trim() || undefined,
          type: statusConfig.actionType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit request");
      }

      setAppealSubmitted(true);
      if (data.case) {
        setExistingCase(data.case);
      }
      toast.success("Request submitted successfully. Our team will review your case.");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to submit request. Please try again.");
    } finally {
      setSubmittingAppeal(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 relative overflow-hidden bg-background text-foreground">
      {/* VOS Sync Landing Page Interactive Network Background */}
      <NetworkBackground interactive={true} />

      {/* Floating Theme Toggle in upper corner */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggleButton variant="outline" size="sm" className="bg-background/80 backdrop-blur-sm border-border" />
      </div>

      <Card className="w-full max-w-lg bg-card/90 backdrop-blur-xl border border-border shadow-2xl relative z-10 text-card-foreground overflow-hidden">
        <CardHeader className="text-center pt-8">
          <div className={`mx-auto h-16 w-16 bg-red-500/10 ${statusConfig.colorClass} border border-red-500/30 flex items-center justify-center rounded-full mb-4 shadow-[0_0_20px_rgba(239,68,68,0.15)]`}>
            <ShieldAlert className="h-8 w-8" />
          </div>
          <CardTitle className={`text-2xl font-bold tracking-tight ${statusConfig.colorClass}`}>
            {statusConfig.title}
          </CardTitle>
          <CardDescription className="text-muted-foreground mt-2 text-sm">
            {statusConfig.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-6 py-4">
          {/* Active Appeal Banner or Loading Skeleton */}
          {loadingCaseStatus ? (
            <div className="p-3.5 bg-muted/40 border border-border/60 rounded-xl flex items-center gap-3 animate-pulse">
              <div className="h-5 w-5 rounded-full bg-muted-foreground/20 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3 w-28 bg-muted-foreground/20 rounded" />
                <div className="h-2.5 w-48 bg-muted-foreground/15 rounded" />
              </div>
            </div>
          ) : hasPendingAppeal && existingCase ? (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                    {existingCase.type === "REACTIVATION_REQUEST"
                      ? "Reactivation Request Pending"
                      : existingCase.type === "RESTORE_ACCOUNT"
                      ? "Restoration Request Pending"
                      : "Appeal Pending Review"}
                  </span>
                  <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30">
                    Case #{existingCase.case_id}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your request submitted on {new Date(existingCase.created_at).toLocaleDateString()} is currently in the administrative queue.
                </p>
              </div>
            </div>
          ) : null}

          <div className="p-4 bg-muted/30 border border-border rounded-lg text-sm space-y-3">
            <div>
              <span className="font-semibold text-muted-foreground block text-xs uppercase tracking-wider">Access Level</span>
              <p className="text-red-500 font-medium mt-0.5">CONTAINMENT / RESTRICTED</p>
            </div>
            <div>
              <span className="font-semibold text-muted-foreground block text-xs uppercase tracking-wider">Current Status</span>
              <p className="mt-0.5 font-semibold text-xs tracking-wide uppercase text-amber-600 dark:text-amber-400">
                {accountStatus.replace("_", " ")}
              </p>
            </div>
            <div>
              <span className="font-semibold text-muted-foreground block text-xs uppercase tracking-wider">Duration</span>
              <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5" />
                Temporary or Indefinite containment pending investigation or review.
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed text-center">
            {hasPendingAppeal
              ? "Your case is actively being evaluated. You will receive an update once a decision is finalized."
              : "If you believe this is a mistake, please reach out to your system administrator or submit a request through the standard channels."}
          </p>
        </CardContent>

        <CardFooter className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-6 border-t border-border w-full bg-card/40">
          <Button
            type="button"
            variant="outline"
            disabled={loggingOut}
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 h-10 border-border hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? "Signing out..." : "Sign Out"}
          </Button>

          {loadingCaseStatus ? (
            <Button disabled className="w-full h-10 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              Checking Status...
            </Button>
          ) : hasPendingAppeal ? (
            <Button
              type="button"
              onClick={() => setStatusModalOpen(true)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-2 h-10 shadow-lg shadow-amber-950/20"
            >
              View Case Status <FileText className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setAppealModalOpen(true)}
              className={`w-full ${statusConfig.btnColorClass} flex items-center justify-center gap-2 h-10 shadow-lg`}
            >
              {statusConfig.actionButtonText} <MessageSquare className="h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Spacious, Rich Case Details Dialog (max-w-2xl) */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border text-card-foreground shadow-2xl p-6 sm:p-8 rounded-2xl">
          <DialogHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight">
                    Case #{existingCase?.case_id} — Appeal & Review Status
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Official record and status timeline for your submitted containment case.
                  </DialogDescription>
                </div>
              </div>
              {existingCase && (
                <Badge
                  variant="outline"
                  className={
                    existingCase.state === "OPEN"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 px-3 py-1 font-semibold text-xs"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 px-3 py-1 font-semibold text-xs"
                  }
                >
                  {existingCase.state === "OPEN" ? "Under Administrative Review" : existingCase.state}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {existingCase && (
            <div className="space-y-6 pt-4">
              {/* Review Process Stepper */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-3">
                  Review Progress Timeline
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Step 1: Submitted */}
                  <div className="flex items-start gap-2.5">
                    <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">1. Appeal Submitted</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(existingCase.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Step 2: In Review */}
                  <div className="flex items-start gap-2.5">
                    <div className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                      <Clock className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">2. Staff Review</p>
                      <p className="text-[11px] text-muted-foreground">Assigned to compliance queue</p>
                    </div>
                  </div>

                  {/* Step 3: Decision */}
                  <div className="flex items-start gap-2.5">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                      existingCase.state === "RESOLVED"
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      {existingCase.state === "RESOLVED" ? <Check className="h-3.5 w-3.5" /> : <span className="text-[10px]">3</span>}
                    </div>
                    <div>
                      <p className="text-xs font-semibold">3. Determination</p>
                      <p className="text-[11px] text-muted-foreground">
                        {existingCase.state === "RESOLVED" ? "Decision recorded" : "Pending determination"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Case Attributes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-muted/20 border border-border rounded-lg space-y-1">
                  <span className="font-semibold text-muted-foreground block">Case Type</span>
                  <span className="font-medium text-foreground">
                    {existingCase.type ? existingCase.type.replace("_", " ") : "SUSPENSION APPEAL"}
                  </span>
                </div>
                <div className="p-3 bg-muted/20 border border-border rounded-lg space-y-1">
                  <span className="font-semibold text-muted-foreground block flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Date & Time Submitted
                  </span>
                  <span className="font-medium text-foreground">
                    {new Date(existingCase.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Submitted Statement Box */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">
                  Your Explanation / Statement
                </span>
                <div className="p-4 rounded-xl bg-muted/40 border border-border text-sm leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {existingCase.statement || "No written statement was recorded."}
                </div>
              </div>

              {/* Supporting Evidence Reference */}
              {existingCase.evidence_refs && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block flex items-center gap-1">
                    <ExternalLink className="h-3.5 w-3.5" /> Supporting Evidence Reference
                  </span>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs break-all text-primary font-mono">
                    {existingCase.evidence_refs}
                  </div>
                </div>
              )}

              {/* Administrative Determination Note */}
              {existingCase.public_decision ? (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide block flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Administrator Decision Note
                  </span>
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm leading-relaxed text-foreground">
                    {existingCase.public_decision}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic text-center pt-2">
                  No public determination note has been posted yet. You will be notified once our compliance team resolves your case.
                </p>
              )}

              <DialogFooter className="pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStatusModalOpen(false)}
                  className="w-full sm:w-auto ml-auto border-border hover:bg-muted"
                >
                  Close Case View
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Appeal Submission Modal */}
      <Dialog open={appealModalOpen} onOpenChange={setAppealModalOpen}>
        <DialogContent className="max-w-lg bg-card border border-border text-card-foreground shadow-2xl p-6 sm:p-8 rounded-2xl">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert className={`h-5 w-5 ${statusConfig.colorClass}`} />
              {statusConfig.modalTitle}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Provide an explanation statement and any supporting evidence. An administrator will review your case.
            </DialogDescription>
          </DialogHeader>

          {appealSubmitted ? (
            <div className="py-6 text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h4 className="text-base font-semibold">Request Submitted</h4>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Your request has been recorded and is currently in the administrative decision queue. You will be notified once a determination is made.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAppealModalOpen(false);
                  setAppealSubmitted(false);
                  setAppealStatement("");
                  setAppealEvidence("");
                }}
                className="mt-4 border-border hover:bg-muted"
              >
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={handleAppealSubmit} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="statement" className="text-xs font-semibold">
                  Statement / Explanation <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="statement"
                  placeholder={statusConfig.statementPlaceholder}
                  value={appealStatement}
                  onChange={(e) => setAppealStatement(e.target.value)}
                  rows={4}
                  required
                  className="bg-muted/40 border-border text-xs focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="evidence" className="text-xs font-semibold">
                  Supporting Links / Evidence Reference (Optional)
                </Label>
                <Input
                  id="evidence"
                  placeholder="e.g. https://link-to-proof.com or document notes"
                  value={appealEvidence}
                  onChange={(e) => setAppealEvidence(e.target.value)}
                  className="bg-muted/40 border-border text-xs focus-visible:ring-primary"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAppealModalOpen(false)}
                  disabled={submittingAppeal}
                  className="border-border hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingAppeal || !appealStatement.trim()}
                  className={`${statusConfig.btnColorClass} flex items-center gap-1.5`}
                >
                  {submittingAppeal ? "Submitting..." : "Submit Request"}
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

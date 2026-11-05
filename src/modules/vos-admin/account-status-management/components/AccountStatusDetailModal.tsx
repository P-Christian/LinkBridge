// src/modules/vos-admin/account-status-management/components/AccountStatusDetailModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AccountStatusUser, AccountStatus, AccountStatusOrUnknown, StatusTransitionPayload, AppealDecisionPayload, UNKNOWN_ACCOUNT_STATUS } from "../types/account-status.types";
import { ShieldAlert, History, MessageSquare, Shield, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onFetchDetail: (userId: number) => Promise<AccountStatusUser | null>;
  onChangeStatus: (payload: StatusTransitionPayload) => Promise<boolean>;
  onResolveAppeal: (payload: AppealDecisionPayload & { userId: number }) => Promise<boolean>;
}

export function AccountStatusDetailModal({
  userId,
  isOpen,
  onClose,
  onFetchDetail,
  onChangeStatus,
  onResolveAppeal,
}: Props) {
  const [user, setUser] = useState<AccountStatusUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"control" | "history" | "appeals">("control");

  // Form State
  const [targetStatus, setTargetStatus] = useState<AccountStatus | "">("");
  const [reasonCode, setReasonCode] = useState("");
  const [publicReason, setPublicReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [duration, setDuration] = useState("indefinite");
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Appeal Action State
  const [appealInternalNote, setAppealInternalNote] = useState("");
  const [appealPublicNote, setAppealPublicNote] = useState("");

  const loadUserDetail = React.useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const details = await onFetchDetail(userId);
    if (details) {
      setUser(details);
      // An unreadable status leaves the picker empty on purpose: defaulting it
      // to ACTIVE would let a save turn an unknown account into a good-standing
      // one without anyone choosing that.
      setTargetStatus(details.status === UNKNOWN_ACCOUNT_STATUS ? "" : details.status);
      // Pre-populate active restrictions if limited
      if (details.status === "LIMITED" && details.restrictions) {
        setSelectedRestrictions(details.restrictions.map(r => r.code));
      } else {
        setSelectedRestrictions([]);
      }
    }
    setLoading(false);
  }, [userId, onFetchDetail]);

  useEffect(() => {
    if (isOpen && userId) {
      const timer = setTimeout(() => {
        loadUserDetail();
        setActiveTab("control");
        // Reset form
        setReasonCode("");
        setPublicReason("");
        setInternalNote("");
        setDuration("indefinite");
        setAppealInternalNote("");
        setAppealPublicNote("");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, userId, loadUserDetail]);

  if (!userId) return null;

  const handleToggleRestriction = (code: string) => {
    setSelectedRestrictions(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!targetStatus) {
      toast.error("Choose the status to apply.");
      return;
    }
    if (!reasonCode || !publicReason) {
      toast.error("Please provide a reason code and a user-facing explanation.");
      return;
    }

    setSubmitting(true);
    let expiresAt: string | null = null;
    if (duration !== "indefinite") {
      const days = parseInt(duration, 10);
      const date = new Date();
      date.setDate(date.getDate() + days);
      expiresAt = date.toISOString();
    }

    const success = await onChangeStatus({
      userId: user.user_id,
      targetStatus,
      reasonCode,
      publicReason,
      internalNote,
      duration,
      expiresAt,
      restrictions: targetStatus === "LIMITED" ? selectedRestrictions : undefined
    });

    if (success) {
      await loadUserDetail();
      toast.success("Account status updated successfully!");
    } else {
      toast.error("Failed to update account status.");
    }
    setSubmitting(false);
  };

  const handleAppealAction = async (caseId: number, decision: 'uphold' | 'modify' | 'restore') => {
    if (!user) return;
    setSubmitting(true);
    const success = await onResolveAppeal({
      caseId,
      userId: user.user_id,
      decision,
      internalNote: appealInternalNote,
      publicNote: appealPublicNote
    });

    if (success) {
      await loadUserDetail();
      toast.success(`Appeal successfully ${decision}ed.`);
      setAppealInternalNote("");
      setAppealPublicNote("");
    } else {
      toast.error("Failed to resolve appeal.");
    }
    setSubmitting(false);
  };

  const getStatusColor = (status: AccountStatusOrUnknown) => {
    switch (status) {
      case "ACTIVE": return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
      case "LIMITED": return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
      case "SUSPENDED": return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
      case "BLOCKED": return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
      case "DEACTIVATED": return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
      case "PENDING_DELETION": return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
      case "DELETED": return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  const restrictionOptions = [
    { code: "PUBLISH_JOBS", label: "Publish Jobs (Employer)" },
    { code: "SEND_MESSAGES", label: "Send Direct Messages" },
    { code: "APPLY_JOBS", label: "Apply to Job Openings" },
    { code: "UPLOAD_PROFILE_FILES", label: "Upload Files to Profile" },
    { code: "MANAGE_COURSES", label: "Manage School Courses (School Admin)" },
    { code: "UPDATE_SCHOOL", label: "Update School Settings (School Admin)" },
  ];

  const targetStatusOptions = [
    { value: "ACTIVE", label: "Active (No restrictions)" },
    { value: "LIMITED", label: "Limited (Expirable capability blocks)" },
    { value: "SUSPENDED", label: "Suspended (Temporary ban)" },
    { value: "BLOCKED", label: "Blocked (Indefinite containment)" },
    { value: "DEACTIVATED", label: "Deactivated (User request)" },
    { value: "PENDING_DELETION", label: "Pending Deletion (Grace period)" },
  ];

  const durationOptions = [
    { value: "1", label: "1 Day" },
    { value: "3", label: "3 Days" },
    { value: "7", label: "7 Days (1 Week)" },
    { value: "30", label: "30 Days (1 Month)" },
    { value: "indefinite", label: "Indefinite / Permanent" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border shadow-lg rounded-xl flex flex-col p-0">
        <DialogHeader className="p-6 border-b pb-4 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Account Status Details
            </DialogTitle>
            <DialogDescription>
              Monitor account state, apply restrictions, and process appeals.
            </DialogDescription>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Clock className="animate-spin h-6 w-6 mr-2" />
            Loading account lifecycle profile...
          </div>
        ) : !user ? (
          <div className="p-8 text-center text-red-500">Failed to load user details.</div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            {/* Left Sidebar: User Details */}
            <div className="w-full md:w-1/3 border-r p-6 bg-zinc-50 dark:bg-zinc-800/30 space-y-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</h3>
                <p className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mt-1">
                  {user.user_fname} {user.user_lname}
                </p>
                <p className="text-sm text-zinc-500">{user.user_email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">ID: #{user.user_id}</p>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</h3>
                <p className="text-sm font-medium text-primary mt-1 capitalize">{user.role}</p>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Status</h3>
                <div className="mt-1">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(user.status)}`}>
                    {user.status.replace("_", " ")}
                  </span>
                </div>
                {user.status_version && (
                  <p className="text-xs text-muted-foreground mt-1">Status Version: v{user.status_version}</p>
                )}
                {user.session_epoch && (
                  <p className="text-xs text-red-500 mt-1">Session Invalidated: {new Date(user.session_epoch).toLocaleDateString()}</p>
                )}
              </div>

              {user.status !== 'ACTIVE' && user.restrictions && user.restrictions.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Restrictions</h3>
                  <div className="mt-2 space-y-1">
                    {user.restrictions.map((r, i) => (
                      <div key={i} className="text-xs p-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded text-amber-800 dark:text-amber-300">
                        <strong>{r.code}</strong>
                        {r.expires_at && <p className="text-[10px] text-muted-foreground">Expires: {new Date(r.expires_at).toLocaleDateString()}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right side: Operations & Logs */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Tab Nav */}
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab("control")}
                  className={`flex-1 py-3 px-4 font-semibold text-sm border-b-2 flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === "control"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-zinc-900"
                  }`}
                >
                  <ShieldAlert className="h-4 w-4" /> Change Status
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`flex-1 py-3 px-4 font-semibold text-sm border-b-2 flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === "history"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-zinc-900"
                  }`}
                >
                  <History className="h-4 w-4" /> Audit History
                </button>
                <button
                  onClick={() => setActiveTab("appeals")}
                  className={`flex-1 py-3 px-4 font-semibold text-sm border-b-2 flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === "appeals"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-zinc-900"
                  }`}
                >
                  <MessageSquare className="h-4 w-4" /> Appeals ({user.cases ? user.cases.filter(c => c.state === 'OPEN').length : 0})
                </button>
              </div>

              {/* Tab Contents */}
              <div className="flex-1 p-6 overflow-y-auto min-h-0">
                {activeTab === "control" && (
                  <form onSubmit={handleStatusSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="target-status">Select New Status</Label>
                      <SearchableSelect
                        value={targetStatus}
                        onValueChange={(val) => setTargetStatus(val as AccountStatus)}
                        options={targetStatusOptions}
                        placeholder="Select status"
                        triggerClassName="w-full"
                      />
                    </div>

                    {targetStatus === "LIMITED" && (
                      <div className="space-y-2 border p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/30">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Prohibited Capabilities</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {restrictionOptions.map((opt) => (
                            <label key={opt.code} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedRestrictions.includes(opt.code)}
                                onChange={() => handleToggleRestriction(opt.code)}
                                className="rounded text-primary border-zinc-300 focus:ring-primary"
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {(targetStatus === "LIMITED" || targetStatus === "SUSPENDED") && (
                      <div className="space-y-1.5">
                        <Label htmlFor="duration">Restriction Duration</Label>
                        <SearchableSelect
                          value={duration}
                          onValueChange={setDuration}
                          options={durationOptions}
                          placeholder="Select duration"
                          triggerClassName="w-full"
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="reason-code">Policy Reason Code <span className="text-red-500">*</span></Label>
                      <Input
                        id="reason-code"
                        placeholder="e.g. SPAM_MESSAGING, SECURITY_LOCKUP, USER_REQUEST"
                        value={reasonCode}
                        onChange={(e) => setReasonCode(e.target.value.toUpperCase())}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="public-reason">User Facing Message / Explanation <span className="text-red-500">*</span></Label>
                      <Input
                        id="public-reason"
                        placeholder="Explain the safety decision to the user..."
                        value={publicReason}
                        onChange={(e) => setPublicReason(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="internal-note">Internal Administrative Notes</Label>
                      <textarea
                        id="internal-note"
                        placeholder="Notes for other reviewers and audit trail..."
                        value={internalNote}
                        onChange={(e) => setInternalNote(e.target.value)}
                        className="w-full min-h-[80px] text-sm p-2 border rounded-md bg-transparent border-zinc-300 dark:border-zinc-700 focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    <Button type="submit" disabled={submitting} className="w-full mt-2">
                      {submitting ? "Applying Changes..." : "Submit Status Decision"}
                    </Button>
                  </form>
                )}

                {activeTab === "history" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Status Transitions Log</h3>
                    {!user.history || user.history.length === 0 ? (
                      <p className="text-sm text-zinc-500 text-center py-6">No status changes recorded.</p>
                    ) : (
                      <div className="border rounded-lg overflow-hidden divide-y">
                        {user.history.map((h) => {
                          const parts = h.reason ? h.reason.split(" | Restrictions: ") : [h.reason || ""];
                          const displayReason = parts[0] || "No justification provided";
                          const restrictionsString = parts[1];
                          const restrictionsList = restrictionsString ? restrictionsString.split(",").map(r => r.trim()) : [];

                          return (
                            <div key={h.history_id} className="p-3 text-sm flex justify-between items-start gap-4">
                              <div>
                                <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                                  Transited to <span className="text-primary">{h.new_status.replace("_", " ")}</span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">Reason: {displayReason}</p>
                                {restrictionsList.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {restrictionsList.map((code, idx) => (
                                      <span key={idx} className="inline-flex items-center rounded bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/50">
                                        {code}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <p className="text-xs text-zinc-400 mt-1">Version: v{h.new_version}</p>
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-zinc-500 font-medium block">By: {h.actor || 'System'}</span>
                                <span className="text-[10px] text-zinc-400 block mt-0.5">{new Date(h.occurred_at).toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "appeals" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">User Appeal Cases</h3>
                    {!user.cases || user.cases.length === 0 ? (
                      <p className="text-sm text-zinc-500 text-center py-6">No appeal cases logged for this user.</p>
                    ) : (
                      <div className="space-y-6">
                        {user.cases.map((c) => (
                          <div key={c.case_id} className="border dark:border-zinc-700 rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-800/50 space-y-3">
                            <div className="flex justify-between items-center border-b pb-2">
                              <div>
                                <span className="font-semibold text-sm">Appeal Case #{c.case_id}</span>
                                <span className={`ml-2 text-[10px] uppercase font-bold rounded-full px-2 py-0.5 ${
                                  c.state === 'OPEN' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  {c.state}
                                </span>
                              </div>
                              <span className="text-xs text-zinc-400">{new Date(c.created_at).toLocaleDateString()}</span>
                            </div>

                            <div className="text-sm text-zinc-700 dark:text-zinc-300">
                              <p className="font-semibold text-xs text-muted-foreground uppercase">User Statement</p>
                              <p className="mt-1 italic">&ldquo;{c.statement || 'No statement provided'}&rdquo;</p>
                            </div>

                            {c.evidence_refs && (
                              <div className="text-xs">
                                <span className="font-semibold text-muted-foreground block uppercase">Evidence Reference</span>
                                <span className="text-zinc-600 mt-0.5 block">{c.evidence_refs}</span>
                              </div>
                            )}

                            {c.state === 'OPEN' ? (
                              <div className="border-t pt-3 space-y-3">
                                <p className="text-xs font-semibold text-zinc-500 uppercase">Appeal Resolution Action</p>
                                <div className="space-y-2">
                                  <Input
                                    placeholder="Internal notes (visible to administration)"
                                    value={appealInternalNote}
                                    onChange={(e) => setAppealInternalNote(e.target.value)}
                                    className="bg-white dark:bg-zinc-900 border dark:border-zinc-700 text-sm"
                                  />
                                  <Input
                                    placeholder="Public message to user (email notification)"
                                    value={appealPublicNote}
                                    onChange={(e) => setAppealPublicNote(e.target.value)}
                                    className="bg-white dark:bg-zinc-900 border dark:border-zinc-700 text-sm"
                                  />
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={submitting}
                                    onClick={() => handleAppealAction(c.case_id, 'uphold')}
                                    className="flex items-center gap-1"
                                  >
                                    <X className="h-3.5 w-3.5" /> Uphold Restriction
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    disabled={submitting}
                                    onClick={() => handleAppealAction(c.case_id, 'restore')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                                  >
                                    <Check className="h-3.5 w-3.5" /> Accept & Restore
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="border-t pt-2 text-xs text-zinc-500">
                                <p><span className="font-semibold">Internal Decision:</span> {c.internal_decision || 'N/A'}</p>
                                <p className="mt-0.5"><span className="font-semibold">Public Decision:</span> {c.public_decision || 'N/A'}</p>
                                {c.resolved_at && <p className="mt-0.5 text-zinc-400">Resolved at: {new Date(c.resolved_at).toLocaleString()}</p>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="p-4 border-t flex gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

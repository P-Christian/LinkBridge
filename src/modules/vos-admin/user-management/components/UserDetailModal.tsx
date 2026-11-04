// src/modules/vos-admin/user-management/components/UserDetailModal.tsx
"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { VsUser } from "../types/user.types";
import { UserStatusBadge } from "./UserStatusBadge";
import { formatAssetUrl } from "@/lib/utils";
import {
  Shield,
  Mail,
  Phone,
  MapPin,
  User,
  FileText,
  Check,
  X,
  AlertTriangle,
  Download,
  Award,
  ExternalLink,
  Info
} from "lucide-react";

interface Props {
  user: VsUser | null;
  isOpen: boolean;
  onClose: () => void;
  onReview: (verificationId: number, status: 'approved' | 'rejected', rejectionNote?: string) => Promise<boolean>;
}

export function UserDetailModal({ user, isOpen, onClose, onReview }: Props) {
  const [rejectionNotes, setRejectionNotes] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState<Record<number, boolean>>({});
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  if (!user) return null;

  const getImageUrl = (uuid: string) => {
    return formatAssetUrl(uuid) || "";
  };

  const getRoleName = (roleId: number | null) => {
    switch (roleId) {
      case 1: return "Freelancer";
      case 2: return "Client / Employer";
      case 3: return "Admin";
      case 4: return "School Admin";
      default: return user.role || "Unknown Role";
    }
  };

  const getJobSeekerProfile = (user: VsUser) => {
    const profile = user.job_seeker_profile || user.vs_job_seeker_profile;
    return (Array.isArray(profile) ? profile[0] : profile) as Record<string, string | number | null | undefined>;
  };

  const getJobPreferences = (user: VsUser) => {
    const prefs = user.job_preferences || user.vs_job_preferences;
    return (Array.isArray(prefs) ? prefs[0] : prefs) as Record<string, string | number | null | undefined>;
  };

  const getUserAvatarUrl = (user: VsUser) => {
    const img = user.profile_image_url || user.user_image;
    if (!img) return null;
    if (img.startsWith("http") || img.startsWith("/")) return img;
    return getImageUrl(img);
  };

  const handleAction = async (verificationId: number, status: 'approved' | 'rejected') => {
    const note = rejectionNotes[verificationId] || "";
    if (status === 'rejected' && !note.trim()) {
      alert("Please provide a rejection note.");
      return;
    }

    setSubmitting(prev => ({ ...prev, [verificationId]: true }));
    const success = await onReview(verificationId, status, note);
    setSubmitting(prev => ({ ...prev, [verificationId]: false }));

    if (success) {
      setRejectionNotes(prev => {
        const copy = { ...prev };
        delete copy[verificationId];
        return copy;
      });
      onClose();
    }
  };

  const getVerificationStatus = (user: VsUser): 'pending' | 'approved' | 'rejected' | 'not_submitted' => {
    const verifs = user.verifications || [];
    if (verifs.length === 0) return 'not_submitted';
    if (verifs.some(v => v.status === 'pending')) return 'pending';
    if (verifs.some(v => v.status === 'rejected')) return 'rejected';
    
    const typesPresent = new Set(verifs.filter(v => v.status === 'approved').map(v => v.type));
    if (typesPresent.has('gov_id') && typesPresent.has('address') && typesPresent.has('mobile_number')) {
      return 'approved';
    }
    
    if (typesPresent.size > 0) {
      return 'pending';
    }
    
    return 'not_submitted';
  };

  const verifications = user.verifications || [];
  const overallStatus = getVerificationStatus(user);
  const initials = `${user.user_fname?.[0] || ""}${user.user_lname?.[0] || ""}`.toUpperCase() || "US";

  // Seeker Profile details
  const profileObj = getJobSeekerProfile(user);
  const prefsObj = getJobPreferences(user);

  // Freelancer profile completion details; ensure pending submissions reflect in completion meter
  const rawCompletion = user.role_id === 1 && profileObj
    ? Number(profileObj.profile_completion_percent || 0)
    : null;
  const pendingDocsCount = verifications.filter(v => v.status === 'pending').length;
  const completionPercent = rawCompletion !== null && rawCompletion === 0 && pendingDocsCount > 0
    ? Math.min(30, pendingDocsCount * 10)
    : rawCompletion;

  const completionColor =
    completionPercent !== null && completionPercent >= 90
      ? "bg-emerald-500"
      : completionPercent !== null && completionPercent >= 50
      ? "bg-amber-500"
      : "bg-rose-500";

  const formatSalaryRange = (min: string | number | null | undefined, max: string | number | null | undefined, curr: string | null | undefined) => {
    if (!min && !max) return "Not Specified";
    const currency = curr || "PHP";
    const formatter = new Intl.NumberFormat("en-PH", { style: "currency", currency, maximumFractionDigits: 0 });
    if (min && max) {
      return `${formatter.format(Number(min))} - ${formatter.format(Number(max))}`;
    }
    if (min) {
      return `Min: ${formatter.format(Number(min))}`;
    }
    return `Max: ${formatter.format(Number(max))}`;
  };

  const avatarUrl = getUserAvatarUrl(user);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="!max-w-5xl w-[92vw] h-[85vh] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-zinc-900 border shadow-lg rounded-xl">
          {/* Visual Header */}
          <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 text-primary border border-primary/20 flex items-center justify-center font-bold text-base shrink-0 overflow-hidden">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt={`${user.user_fname} ${user.user_lname}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                    <span>{user.user_fname} {user.user_lname}</span>
                    <UserStatusBadge status={overallStatus} />
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                    <span>Role: <strong className="text-primary">{getRoleName(user.role_id)}</strong></span>
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>
 
          {/* Tabbed Content Container */}
          <div className="flex-1 overflow-y-auto p-6">
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="profile" className="gap-2 text-xs font-semibold">
                  <User className="h-3.5 w-3.5" />
                  User Profile
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-2 text-xs font-semibold">
                  <FileText className="h-3.5 w-3.5" />
                  Identity Documents ({verifications.length})
                </TabsTrigger>
              </TabsList>
 
              {/* Tab 1: Profile Details */}
              <TabsContent value="profile" className="space-y-6 text-sm outline-none">
                {/* Completion Banner (if Freelancer) */}
                {completionPercent !== null && (
                  <div className="p-5 rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                        <Award className="h-4 w-4 text-primary" />
                        Profile Completion Status
                      </h4>
                      <p className="text-xs text-muted-foreground">This progress meter reflects completeness of job seeker registration documents & preferences.</p>
                    </div>
                    <div className="space-y-1.5 w-full sm:w-48 shrink-0">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">Completion</span>
                        <span className="font-mono font-bold text-foreground">{completionPercent}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${completionColor}`}
                          style={{ width: `${Math.min(100, completionPercent)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
 
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Personal Info card */}
                  <div className="p-5 border rounded-2xl bg-card space-y-4 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Personal Details</h3>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-lg overflow-hidden">
                        {avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatarUrl}
                            alt={`${user.user_fname} ${user.user_lname}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initials
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-base text-foreground">
                          {user.user_fname} {user.user_mname ? `${user.user_mname} ` : ""}{user.user_lname}
                        </p>
                        <p className="text-xs text-muted-foreground">System Account Member</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2.5 pt-2 border-t text-xs text-zinc-600 dark:text-zinc-300">
                      <p className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{user.user_email}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{user.user_contact || "No Contact Number"}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>Role: <strong className="font-semibold text-primary">{getRoleName(user.role_id)}</strong></span>
                      </p>
                    </div>
                  </div>

                  {/* Address & Status card */}
                  <div className="p-5 border rounded-2xl bg-card space-y-4 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Address & Governance</h3>
                    
                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Registered Address</span>
                        <p className="flex items-start gap-2 text-zinc-600 dark:text-zinc-300 mt-1">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <span>
                            {[user.user_brgy, user.user_city, user.user_province].filter(Boolean).join(", ") || "No Address Information"}
                          </span>
                        </p>
                      </div>

                      <div className="pt-2 border-t">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Account Status</span>
                        <div className="flex gap-2 items-center mt-1.5">
                          {user.is_blocked ? (
                            <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:text-red-400">
                              Blocked
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Freelancer specific information details */}
                {user.role_id === 1 && (profileObj || prefsObj) && (
                  <div className="grid grid-cols-1 gap-6">
                    {/* Freelancer job preferences */}
                    {prefsObj && (
                      <div className="p-5 border rounded-2xl bg-card space-y-4 shadow-sm">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Freelancer Job Preferences</h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs border-b pb-4">
                          <div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Preferred Job Type</span>
                            <span className="font-semibold text-foreground text-sm">{prefsObj.job_type || "Not Specified"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Work Setup</span>
                            <span className="font-semibold text-foreground text-sm">{prefsObj.work_setup || "Not Specified"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Preferred Location</span>
                            <span className="font-semibold text-foreground text-sm">{prefsObj.preferred_location || "Not Specified"}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs border-b pb-4">
                          <div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Salary Range</span>
                            <span className="font-semibold text-foreground text-sm">
                              {formatSalaryRange(prefsObj.salary_range_min, prefsObj.salary_range_max, prefsObj.currency as string | null | undefined)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Availability</span>
                            <span className="font-semibold text-foreground text-sm">{prefsObj.availability || "Not Specified"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Preferred Industry</span>
                            <span className="font-semibold text-foreground text-sm">{prefsObj.preferred_industry || "Not Specified"}</span>
                          </div>
                        </div>

                        {/* Professional summary text */}
                        {profileObj?.professional_summary && (
                          <div className="space-y-2 pt-2">
                            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <Info className="h-4 w-4 text-primary" />
                              Professional Summary
                            </h4>
                            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-xs">
                              {profileObj.professional_summary}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {!prefsObj && profileObj?.professional_summary && (
                      <div className="p-5 border rounded-2xl bg-card space-y-4 shadow-sm">
                        <div className="space-y-2">
                          <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Info className="h-4 w-4 text-primary" />
                            Professional Summary
                          </h4>
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-xs">
                            {profileObj.professional_summary}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Tab 2: Identity Documents */}
              <TabsContent value="documents" className="space-y-6 text-sm outline-none">
                {verifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-400 border border-dashed dark:border-zinc-700 rounded-2xl bg-zinc-50/50 dark:bg-zinc-800/50">
                    <FileText className="h-10 w-10 mb-2 text-muted-foreground" />
                    <p className="text-sm font-semibold">No identity verification documents submitted yet.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {verifications.map((v) => {
                      // Collect all image properties associated with this verification
                      const attachments = [
                        v.gov_id_front_image_uuid && { uuid: v.gov_id_front_image_uuid, name: "Government ID (Front)", type: "GOVERNMENT ID" },
                        v.gov_id_selfie_image_uuid && { uuid: v.gov_id_selfie_image_uuid, name: "Government ID (Selfie)", type: "SELFIE VERIFICATION" },
                        v.address_doc_image_uuid && { uuid: v.address_doc_image_uuid, name: "Address Verification Document", type: "ADDRESS PROOF" }
                      ].filter(Boolean) as { uuid: string; name: string; type: string }[];

                      return (
                        <div key={v.id} className="border dark:border-zinc-700 rounded-xl p-5 bg-card hover:bg-muted/10 transition-colors space-y-4">
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b dark:border-zinc-700 pb-3">
                            <div>
                              <span className="font-bold text-zinc-800 dark:text-zinc-100 uppercase text-xs tracking-wider">
                                {v.type === "gov_id" ? `GOVERNMENT ID (${v.gov_id_type || "Unknown"})` : v.type.replace("_", " ")}
                              </span>
                              <p className="text-[10px] text-muted-foreground mt-0.5">Submitted: {new Date(v.submitted_at).toLocaleString()}</p>
                            </div>
                            <div>
                              <UserStatusBadge status={v.status} />
                            </div>
                          </div>

                          {/* List of files or mobile number verification */}
                          {v.type === "mobile_number" ? (
                            <div className="flex items-center justify-between border rounded-xl p-3 bg-card hover:bg-muted/30 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                  <Phone className="h-4 w-4" />
                                </div>
                                <div>
                                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Verified Mobile Number</div>
                                  <div className="font-mono font-bold text-foreground text-sm mt-0.5">
                                    {v.mobile_number || user.user_contact || "No phone number recorded"}
                                  </div>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-2 py-0.5">
                                SMS Verified
                              </Badge>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {attachments.length === 0 ? (
                                <div className="text-xs text-muted-foreground italic">No image file attachments.</div>
                              ) : (
                                attachments.map((attach, idx) => (
                                  <div key={idx} className="flex items-center justify-between border rounded-xl p-3 bg-card hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                        <FileText className="h-4 w-4" />
                                      </div>
                                      <div>
                                        <div className="font-bold text-foreground text-xs">{attach.name}</div>
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                          <Badge variant="outline" className="text-[9px] px-1 py-0">{attach.type}</Badge>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPreviewImage({ url: getImageUrl(attach.uuid), title: attach.name })}
                                        className="h-7 gap-1 text-[11px]"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        Preview
                                      </Button>
                                      <a
                                        href={`${getImageUrl(attach.uuid)}?download`}
                                        download
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors h-7"
                                      >
                                        <Download className="h-3 w-3" />
                                        Download
                                      </a>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}

                          {v.rejection_note && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg text-red-800 dark:text-red-400 text-xs flex gap-2 items-start">
                              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="font-semibold">Rejection Note:</span> {v.rejection_note}
                              </div>
                            </div>
                          )}

                          {/* Actions for Admin Review */}
                          {v.status === 'pending' && (
                            <div className="border-t pt-4 space-y-3">
                              <p className="text-[10px] font-bold text-zinc-500 uppercase">Review Action</p>
                              <div className="flex flex-col gap-2">
                                <Input
                                  placeholder="Rejection note (required for rejection)"
                                  value={rejectionNotes[v.id] || ""}
                                  onChange={(e) => setRejectionNotes(prev => ({ ...prev, [v.id]: e.target.value }))}
                                  className="bg-white dark:bg-zinc-900 border dark:border-zinc-700 text-xs"
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={submitting[v.id]}
                                    onClick={() => handleAction(v.id, 'rejected')}
                                    className="flex items-center gap-1.5 text-xs h-8"
                                  >
                                    <X className="h-3.5 w-3.5" /> Reject Document
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    disabled={submitting[v.id]}
                                    onClick={() => handleAction(v.id, 'approved')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs h-8"
                                  >
                                    <Check className="h-3.5 w-3.5" /> Approve Document
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer Bar */}
          <DialogFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-end gap-3 shrink-0">
            <Button variant="outline" size="sm" onClick={onClose}>Close Detail</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expanded Lightbox Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="p-0 flex flex-col overflow-hidden bg-card border rounded-2xl shadow-2xl [&>button]:hidden sm:max-w-4xl w-[92vw]">
          <div className="px-5 py-3 flex items-center justify-between border-b bg-muted/40 shrink-0">
            <span className="text-xs font-bold tracking-tight text-foreground truncate">{previewImage?.title}</span>
            <div className="flex items-center gap-2">
              {previewImage?.url && (
                <a
                  href={previewImage.url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-background text-[11px] font-semibold text-foreground hover:bg-muted transition-colors"
                  title="Download full image"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              )}
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="p-4 flex items-center justify-center bg-muted/10 overflow-hidden">
            {previewImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="object-contain rounded-xl shadow-md border bg-background max-h-[60vh] max-w-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// src/modules/vos-admin/school-verification/components/SchoolVerificationDetailModal.tsx
"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  GraduationCap,
  FileCheck2,
  UserCheck,
  UserPlus,
  School,
  Link2,
  ExternalLink,
  Download,
  ShieldCheck,
  Globe,
  Mail,
  Phone,
  MapPin,
  FileText,
  Facebook,
  Linkedin,
  Maximize2,
  X,
  AlertTriangle,
  Building,
  BookOpen,
} from "lucide-react";
import { SchoolVerificationRecord, SchoolDocument } from "../types";
import { SchoolVerificationStatusBadge } from "./SchoolVerificationStatusBadge";
import { SchoolVerificationCoursesTab } from "./SchoolVerificationCoursesTab";
import { InviteSchoolLinkModal } from "@/modules/vos-admin/components/InviteSchoolLinkModal";
import type { SchoolInviteResult } from "@/lib/school-invite";
import { toast } from "sonner";
import { formatSchoolAddress, formatPHDate } from "../services/schoolVerification.helpers";

interface SchoolVerificationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  school: SchoolVerificationRecord | null;
  onApprove: (school: SchoolVerificationRecord) => void;
  onRequestCorrection: (school: SchoolVerificationRecord) => void;
  onGenerateInvite: (schoolId: number, email: string) => Promise<SchoolInviteResult | null>;
  isSubmitting: boolean;
}

function formatUrl(url: string | null | undefined): string {
  if (!url) return "#";
  const t = url.trim();
  return t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`;
}

const INVITE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function DraftInvitePanel({
  school,
  onGenerateInvite,
}: {
  school: SchoolVerificationRecord;
  onGenerateInvite: (schoolId: number, email: string) => Promise<SchoolInviteResult | null>;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<{ invitedEmail: string; invitationUrl: string } | null>(null);

  if ((school.admins || []).length > 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center py-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
          <UserCheck className="h-16 w-16" strokeWidth={1.5} />
        </div>
        <h3 className="mt-6 text-lg font-bold text-foreground">Administrator connected</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          This school already has an administrator account.
        </p>
      </div>
    );
  }

  const trimmed = email.trim();
  const isValid = INVITE_EMAIL_PATTERN.test(trimmed);
  const disabled = busy || !isValid;

  const handleGenerate = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      const result = await onGenerateInvite(school.school_id, trimmed);
      if (!result) {
        toast.error("Could not generate the invite link. Please try again.");
        return;
      }
      setInvite({ invitedEmail: trimmed, invitationUrl: result.invitationUrl });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex min-h-full flex-col items-center justify-center py-8 text-center">
        <div className="relative">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
            <School className="h-16 w-16" strokeWidth={1.5} />
          </div>
          <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-primary shadow-sm">
            <UserPlus className="h-4 w-4" />
          </div>
        </div>
        <h3 className="mt-6 text-lg font-bold text-foreground">No administrator yet</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          This school has no account connected. Invite the person who will manage it.
        </p>
        <div className="mt-8 w-full max-w-sm space-y-4 text-left">
          <div className="space-y-1.5">
            <label htmlFor="draft-admin-email" className="text-xs font-semibold text-foreground">
              Administrator email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="draft-admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@school.edu"
                disabled={busy}
                className="h-10 pl-9 text-sm"
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={disabled}
            className="h-10 w-full text-sm font-semibold"
          >
            <Link2 className="h-4 w-4" />
            {busy ? "Generating..." : "Generate invitation link"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Tied to this email; expires in 72 hours.
          </p>
        </div>
      </div>
      {invite && (
        <InviteSchoolLinkModal
          isOpen
          onClose={() => setInvite(null)}
          schoolName={school.school_name}
          invitedEmail={invite.invitedEmail}
          invitationUrl={invite.invitationUrl}
        />
      )}
    </>
  );
}

export const SchoolVerificationDetailModal: React.FC<SchoolVerificationDetailModalProps> = ({
  isOpen,
  onClose,
  school,
  onApprove,
  onRequestCorrection,
  onGenerateInvite,
  isSubmitting,
}) => {
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  if (!school) return null;

  const documents = school.documents || [];

  const address = formatSchoolAddress(school);

  const initials = school.school_name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "SC";

  const getDocTypeLabel = (type: string) => {
    switch (type) {
      case "CHED_DEPED_TESDA_RECOGNITION":
        return "CHED / DepEd / TESDA Recognition";
      case "BUSINESS_PERMIT":
        return "Mayor's / Business Permit";
      case "TIN_DOCUMENT":
        return "BIR TIN Registration";
      case "OTHER_DOCUMENT":
        return "Supporting Document";
      default:
        return type.replace(/_/g, " ");
    }
  };

  const isDraft = school.verification_status === "DRAFT";
  const canDecide =
    school.verification_status === "PENDING_VERIFICATION" ||
    school.verification_status === "CORRECTION_REQUIRED";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent showCloseButton={false} className="!max-w-6xl w-[92vw] h-[88vh] max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl border-border bg-card">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden relative shadow-2xs">
                  {school.school_logo_url ? (
                    <Image
                      src={school.school_logo_url}
                      alt={school.school_name}
                      width={48}
                      height={48}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-xl font-bold text-foreground">
                      {school.school_name}
                    </DialogTitle>
                    {Boolean(school.is_public) && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-1.5 py-0">
                        Public
                      </Badge>
                    )}
                  </div>
                  <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span className="font-semibold text-foreground/80">{school.school_type}</span>
                    <span>•</span>
                    <span>Status: {school.school_status}</span>
                  </DialogDescription>
                </div>
              </div>

              <div>
                <SchoolVerificationStatusBadge
                  status={school.verification_status}
                  workflowStatus={school.latest_verification?.status}
                />
              </div>
            </div>
          </DialogHeader>

          {/* Body Content with Tabs */}
          <div className="flex-1 overflow-y-auto p-6">
            {isDraft ? (
              <DraftInvitePanel key={school.school_id} school={school} onGenerateInvite={onGenerateInvite} />
            ) : (
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid grid-cols-5 mb-6 w-full sm:w-[680px] bg-muted/60 p-1 rounded-xl">
                <TabsTrigger value="profile" className="text-xs rounded-lg flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="courses" className="text-xs rounded-lg flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  Courses ({(school.courses || []).length})
                </TabsTrigger>
                <TabsTrigger value="documents" className="text-xs rounded-lg flex items-center gap-1.5">
                  <FileCheck2 className="h-3.5 w-3.5" />
                  Accreditation ({documents.length})
                </TabsTrigger>
                <TabsTrigger value="admins" className="text-xs rounded-lg flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5" />
                  Administrators
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs rounded-lg flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Audit Notes
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Profile */}
              <TabsContent value="profile" className="space-y-6 focus-visible:outline-none">
                {/* Visual Banner Preview */}
                {school.school_cover && (
                  <div className="relative h-32 w-full rounded-xl overflow-hidden border border-border/80 group">
                    <Image
                      src={school.school_cover}
                      alt={`${school.school_name} cover`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPreviewImage({ url: school.school_cover!, title: `${school.school_name} Cover Photo` })}
                      className="absolute right-2 top-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Grid info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4 text-primary" />
                      Institutional Information
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">School Name:</span>
                        <span className="font-semibold text-foreground">{school.school_name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Institution Type:</span>
                        <span className="font-semibold text-foreground">{school.school_type}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Campus Location:</span>
                        <span className="font-medium text-foreground flex items-start gap-1 mt-0.5">
                          <MapPin className="h-3.5 w-3.5 text-primary/70 shrink-0 mt-0.5" />
                          <span>{address}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-primary" />
                      Contact & Web Presence
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Official Email:</span>
                        <span className="font-medium text-foreground flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-primary/70" />
                          {school.school_email || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Contact Number:</span>
                        <span className="font-medium text-foreground flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-primary/70" />
                          {school.school_contact_no || "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        {school.school_website && (
                          <a
                            href={formatUrl(school.school_website)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Globe className="h-3.5 w-3.5" /> Website <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {school.school_facebook && (
                          <a
                            href={formatUrl(school.school_facebook)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <Facebook className="h-3.5 w-3.5" /> Facebook <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {school.school_linkedin && (
                          <a
                            href={formatUrl(school.school_linkedin)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
                          >
                            <Linkedin className="h-3.5 w-3.5" /> LinkedIn <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description, Mission & Values */}
                {(school.school_description || school.school_mission || school.school_values) && (
                  <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      About the Institution
                    </h4>
                    {school.school_description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {school.school_description}
                      </p>
                    )}
                    {school.school_mission && (
                      <div>
                        <span className="text-xs font-semibold text-foreground block">Mission:</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{school.school_mission}</p>
                      </div>
                    )}
                    {school.school_values && (
                      <div>
                        <span className="text-xs font-semibold text-foreground block">Core Values:</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{school.school_values}</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Tab 2: Academic Courses */}
              <TabsContent value="courses" className="space-y-6 focus-visible:outline-none">
                <SchoolVerificationCoursesTab
                  courses={school.courses}
                  schoolName={school.school_name}
                />
              </TabsContent>

              {/* Tab 3: Accreditation & Legal Documents */}
              <TabsContent value="documents" className="space-y-3 text-xs focus-visible:outline-none">
                {documents.length === 0 ? (
                  <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-medium">No accreditation or legal documents uploaded yet.</p>
                  </div>
                ) : (
                  documents.map((doc: SchoolDocument) => {
                    const label = getDocTypeLabel(doc.document_type);
                    const isImage = Boolean(doc.file_url) && /\.(png|jpe?g|webp|gif)$/i.test(doc.document_name ?? "");
                    return (
                    <div
                      key={doc.school_document_id}
                      className="flex items-center justify-between border rounded-xl p-4 bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isImage && doc.file_url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImage({ url: doc.file_url!, title: label })}
                            className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30"
                          >
                            <Image
                              src={doc.file_url}
                              alt={label}
                              width={48}
                              height={48}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ) : (
                          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                            <FileText className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-foreground text-sm">{label}</div>
                          <div className="text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span>Uploaded: {formatPHDate(doc.uploaded_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.file_url && (
                          <>
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-muted transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Preview
                            </a>
                            <a
                              href={doc.file_url}
                              download={doc.document_name}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                    );
                  })
                )}
              </TabsContent>

              {/* Tab 3: School Administrators */}
              <TabsContent value="admins" className="space-y-4 focus-visible:outline-none">
                {!school.admins || school.admins.length === 0 ? (
                  <div className="p-12 text-center border border-dashed rounded-xl text-muted-foreground">
                    <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-medium">No school administrators assigned yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {school.admins.map((adm) => {
                      const idVer = adm.identity_verification;
                      const adminName = `${adm.user_fname || ""} ${adm.user_lname || ""}`.trim() || `User #${adm.user_id}`;

                      return (
                        <div
                          key={adm.school_admin_id}
                          className="p-5 rounded-xl border border-border bg-card/60 space-y-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-foreground">{adminName}</h4>
                                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                                  School Admin
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{adm.user_email || "No email"}</p>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {adm.user_contact && <span>Contact: {adm.user_contact}</span>}
                            </div>
                          </div>

                          {/* Government ID Section */}
                          <div className="space-y-2">
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <ShieldCheck className="h-4 w-4 text-primary" />
                              Administrator Government ID Verification
                            </span>

                            {idVer ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                {idVer.gov_id_front_url && (
                                  <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                                    <span className="text-[11px] font-medium text-muted-foreground block">
                                      {idVer.gov_id_type || "Gov ID"} (Front)
                                    </span>
                                    <div className="relative h-32 w-full rounded-md overflow-hidden bg-black/10 border border-border">
                                      <Image
                                        src={idVer.gov_id_front_url}
                                        alt="Gov ID Front"
                                        fill
                                        unoptimized
                                        className="object-cover"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setPreviewImage({ url: idVer.gov_id_front_url!, title: `${adminName} - Gov ID Front` })}
                                        className="absolute right-1.5 top-1.5 p-1 rounded bg-black/60 text-white"
                                      >
                                        <Maximize2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {idVer.gov_id_back_url && (
                                  <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                                    <span className="text-[11px] font-medium text-muted-foreground block">
                                      {idVer.gov_id_type || "Gov ID"} (Back)
                                    </span>
                                    <div className="relative h-32 w-full rounded-md overflow-hidden bg-black/10 border border-border">
                                      <Image
                                        src={idVer.gov_id_back_url}
                                        alt="Gov ID Back"
                                        fill
                                        unoptimized
                                        className="object-cover"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setPreviewImage({ url: idVer.gov_id_back_url!, title: `${adminName} - Gov ID Back` })}
                                        className="absolute right-1.5 top-1.5 p-1 rounded bg-black/60 text-white"
                                      >
                                        <Maximize2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No government ID uploaded yet.</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Tab 4: Audit & History */}
              <TabsContent value="history" className="space-y-4 focus-visible:outline-none">
                {school.rejection_reason && (
                  <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs space-y-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      Active Feedback / Correction Note:
                    </span>
                    <p className="pl-5 text-destructive/90">{school.rejection_reason}</p>
                  </div>
                )}

                {school.internal_notes && (
                  <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs space-y-1">
                    <span className="font-bold">Internal Admin Notes:</span>
                    <p>{school.internal_notes}</p>
                  </div>
                )}

                <div className="p-4 rounded-xl border border-border bg-card/60 text-xs space-y-2">
                  <span className="font-bold text-foreground block">Verification Details</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-muted-foreground">
                    <div>
                      <span>Created At:</span>{" "}
                      <strong className="text-foreground block mt-0.5">{formatPHDate(school.created_at || school.submitted_at)}</strong>
                    </div>
                    <div>
                      <span>Verified By:</span>{" "}
                      <strong className="text-foreground block mt-0.5">{school.verified_by_user_name || (school.verified_by_user_id ? `User #${school.verified_by_user_id}` : "N/A")}</strong>
                    </div>
                    <div>
                      <span>Verified At:</span>{" "}
                      <strong className="text-foreground block mt-0.5">{school.verified_at ? formatPHDate(school.verified_at) : "Pending"}</strong>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            )}
          </div>

          {/* Footer Decision Buttons */}
          <DialogFooter className="p-4 px-6 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto rounded-lg text-xs"
            >
              Close
            </Button>

            {canDecide && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onRequestCorrection(school)}
                disabled={isSubmitting}
                className="w-full sm:w-auto rounded-lg text-xs bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold"
              >
                Request Correction
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => onApprove(school)}
                disabled={isSubmitting}
                className="w-full sm:w-auto rounded-lg text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs"
              >
                {isSubmitting ? "Approving..." : "Approve Verification"}
              </Button>
            </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Image Preview Dialog */}
      {previewImage && (
        <Dialog open={Boolean(previewImage)} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-none text-white flex flex-col items-center justify-center">
            <div className="p-3 w-full flex items-center justify-between bg-black/40">
              <span className="text-xs font-semibold">{previewImage.title}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-md hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative h-[70vh] w-full p-4 flex items-center justify-center">
              <Image
                src={previewImage.url}
                alt={previewImage.title}
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

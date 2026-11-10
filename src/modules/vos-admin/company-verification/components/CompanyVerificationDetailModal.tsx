"use client";

import React, { useState } from "react";
import Image from "next/image";
import { formatAssetUrl, cn } from "@/lib/utils";
import { motion } from "framer-motion";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Building2,
  FileCheck2,
  UserCheck,
  AlertTriangle,
  ExternalLink,
  Download,
  ShieldCheck,
  Globe,
  Mail,
  Phone,
  MapPin,
  FileText,
  Briefcase,
  Users,
  CalendarDays,
  Facebook,
  Linkedin,
  Instagram,
  Youtube,
  Info,
  Maximize2,
  X,
} from "lucide-react";
import { CompanyVerificationRecord } from "../types";
import { VerificationStatusBadge } from "./VerificationStatusBadge";
import { DocumentViewerModal, AdminDocumentPreview } from "./DocumentViewerModal";
import {
  formatDate,
  formatDocumentTypeLabel,
  getDocumentCategoryBadgeStyle,
  getDocumentCategoryPriority,
  getCompanyStatusBucket,
} from "../utils/companyVerification.utils";

const THUMBNAIL_EXT = /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i;

const DocumentThumbnail: React.FC<{ fileId: string; fileName?: string }> = ({
  fileId,
  fileName = "",
}) => {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const safeName = fileName || "";
  const ext = safeName.split(".").pop()?.toUpperCase() || "FILE";
  const showThumbnail = THUMBNAIL_EXT.test(safeName) && !thumbnailFailed;

  if (!showThumbnail) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-muted to-muted/40 text-muted-foreground">
        <FileText className="h-6 w-6" />
        <span className="text-[9px] font-bold uppercase tracking-wider">{ext}</span>
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`/api/assets/${fileId}?width=240`}
      alt={fileName}
      loading="lazy"
      onError={() => setThumbnailFailed(true)}
      className="h-full w-full object-cover"
    />
  );
};

interface CompanyVerificationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: CompanyVerificationRecord | null;
  onApprove: (company: CompanyVerificationRecord) => void;
  onRequestRevision: (company: CompanyVerificationRecord) => void;
  isSubmitting: boolean;
}

function formatUrl(url: string | null | undefined): string {
  if (!url) return "#";
  const t = url.trim();
  return t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`;
}

export const CompanyVerificationDetailModal: React.FC<CompanyVerificationDetailModalProps> = ({
  isOpen,
  onClose,
  company,
  onApprove,
  onRequestRevision,
  isSubmitting,
}) => {
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; type: "logo" | "cover" } | null>(null);
  const [lastImage, setLastImage] = useState<{ url: string; title: string; type: "logo" | "cover" } | null>(null);
  const [viewerDoc, setViewerDoc] = useState<AdminDocumentPreview | null>(null);

  const openPreview = (img: { url: string; title: string; type: "logo" | "cover" }) => {
    setLastImage(img);
    setPreviewImage(img);
  };

  const currentImg = previewImage || lastImage;

  if (!company) return null;

  const sortedDocuments = (company.documents || []).slice().sort((a, b) => {
    const priorityA = getDocumentCategoryPriority(a.document_type);
    const priorityB = getDocumentCategoryPriority(b.document_type);
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    const dateA = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
    const dateB = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
    return dateB - dateA;
  });

  const primaryOwner = company.users?.find((u) => u.is_primary_contact || u.company_user_role === "OWNER");
  const verifications = company.verifications || [];

  const statusBucket = getCompanyStatusBucket(company);
  const canApprove = statusBucket !== "VERIFIED" && statusBucket !== "DRAFT";
  const canRequestRevision = statusBucket !== "DRAFT";
  const reviewNote =
    statusBucket === "VERIFIED"
      ? `Already verified${company.verified_at ? ` on ${formatDate(company.verified_at)}` : ""} — no further approval needed.`
      : statusBucket === "DRAFT"
        ? "This profile has not been submitted for verification yet."
        : null;

  const addressParts = [
    company.company_address,
    company.company_brgy,
    company.company_city,
    company.company_province,
    company.company_zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  const hasSocials =
    company.company_facebook ||
    company.company_linkedin ||
    company.company_instagram ||
    company.company_x ||
    company.company_youtube;

  const initials = company.company_name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "CO";

  // Resolve cover photo URL
  const rawCompany = company as unknown as Record<string, string | null | undefined>;
  const coverPhoto =
    company.company_cover ||
    rawCompany.company_cover_photo ||
    rawCompany.company_cover_image;

  const coverUrl = formatAssetUrl(coverPhoto);
  const logoUrl = formatAssetUrl(company.company_logo);

  const getGovIdUrl = (uuidOrUrl: string | null | undefined): string | null => {
    return formatAssetUrl(uuidOrUrl);
  };

  const primaryFrontUrl = getGovIdUrl(
    primaryOwner?.identity_verification?.gov_id_front_url ||
    primaryOwner?.identity_verification?.gov_id_front_image_uuid
  );
  const primaryBackUrl = getGovIdUrl(
    primaryOwner?.identity_verification?.gov_id_back_url ||
    primaryOwner?.identity_verification?.gov_id_back_image_uuid
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="!max-w-6xl w-[92vw] h-[88vh] max-h-[92vh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                  <Building2 className="h-5 w-5 text-primary" />
                  {company.company_name}
                  <VerificationStatusBadge

                    status={company.verification_status}
                    workflowStatus={company.latest_verification?.status}
                  />

                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                  <span>Code: <strong className="font-mono">{company.company_code}</strong></span>
                  <span>•</span>
                  <span>Submitted: {formatDate(company.submitted_at || company.created_at)}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Tabbed Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="profile" className="gap-2 text-xs font-semibold">
                  <Building2 className="h-3.5 w-3.5" />
                  Company Profile
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-2 text-xs font-semibold">
                  <FileCheck2 className="h-3.5 w-3.5" />
                  Documents ({company.documents?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="contact" className="gap-2 text-xs font-semibold">
                  <UserCheck className="h-3.5 w-3.5" />
                  Owner &amp; Contact
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2 text-xs font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verification Logs ({verifications.length})
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: PROFILE */}
              <TabsContent value="profile" className="space-y-6 text-xs outline-none">
                {/* Cover Banner + Overlaid Logo */}
                <div className="relative rounded-2xl overflow-hidden border bg-card shadow-sm">
                  {/* Cover Photo */}
                  <div
                    onClick={() => {
                      if (coverUrl) openPreview({ url: coverUrl, title: `${company.company_name} - Cover Banner`, type: "cover" });
                    }}
                    className={`h-44 w-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 overflow-hidden relative group ${coverUrl ? "cursor-pointer" : ""
                      }`}
                  >
                    {coverUrl ? (
                      <>
                        <Image
                          src={coverUrl}
                          alt="Company Cover"
                          fill
                          unoptimized
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5 z-10">
                          <Maximize2 className="h-4 w-4" /> Click to Expand Cover
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium text-slate-400">No cover banner uploaded</span>
                      </div>
                    )}
                  </div>

                  {/* Overlaid Avatar Logo */}
                  <div className="px-6 pb-5 pt-0 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="flex items-end gap-4 -mt-10 relative z-10">
                      <div
                        onClick={() => {
                          if (logoUrl) openPreview({ url: logoUrl, title: `${company.company_name} - Profile Logo`, type: "logo" });
                        }}
                        className={`h-20 w-20 rounded-2xl border-4 border-background bg-card shadow-md overflow-hidden flex items-center justify-center shrink-0 group relative ${logoUrl ? "cursor-pointer" : ""
                          }`}
                      >
                        {logoUrl ? (
                          <>
                            <Image
                              src={logoUrl}
                              alt={company.company_name}
                              width={80}
                              height={80}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px]">
                              <Maximize2 className="h-3.5 w-3.5" />
                            </div>
                          </>
                        ) : (
                          <div className="h-full w-full bg-primary/10 text-primary font-bold text-lg flex items-center justify-center">
                            {initials}
                          </div>
                        )}
                      </div>

                      <div className="space-y-0.5 mb-1">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                          {company.company_name}
                          {company.is_public === 1 && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-1.5 py-0">
                              Public Profile Active
                            </Badge>
                          )}
                        </h2>
                        {company.company_legal_name && (
                          <p className="text-xs text-muted-foreground">Legal: {company.company_legal_name}</p>
                        )}
                      </div>
                    </div>

                    {/* Profile Completion Badge */}
                    <div className="flex items-center gap-3 mb-1">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Profile Completion</span>
                        <span className="text-sm font-bold text-foreground font-mono">{company.profile_completion_percent}%</span>
                      </div>
                      <div className="w-20 bg-secondary rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, company.profile_completion_percent)}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className="bg-primary h-full rounded-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Company Tags */}
                  {company.company_tags && (
                    <div className="px-6 pb-4 flex flex-wrap gap-1.5 border-t pt-3 bg-muted/20">
                      {company.company_tags.split(",").map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[11px] font-medium px-2 py-0.5">
                          {tag.trim()}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Primary Grid Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Legal & Identification Box */}
                  <div className="bg-card border rounded-xl p-5 space-y-3.5 shadow-2xs">
                    <h4 className="font-bold text-foreground flex items-center gap-2 border-b pb-2 text-xs uppercase tracking-wider text-muted-foreground">
                      <Building2 className="h-4 w-4 text-primary" />
                      Corporate & Registration Details
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
                          Company Display Name
                        </span>
                        <span className="font-semibold text-foreground">{company.company_name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
                          Legal Business Name
                        </span>
                        <span className="font-semibold text-foreground">{company.company_legal_name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
                          TIN (Tax Identification)
                        </span>
                        <span className="font-mono text-foreground font-medium">{company.company_tin || "Not Provided"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
                          Registration No (SEC / DTI)
                        </span>
                        <span className="font-mono text-foreground font-medium">{company.registration_no || "Not Provided"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1">
                          <Briefcase className="h-3 w-3 text-muted-foreground" /> Industry
                        </span>
                        <span className="font-medium text-foreground">
                          {company.industry_name || "Not Specified"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" /> Company Size
                        </span>
                        <span className="font-medium text-foreground">
                          {company.company_size_name || "Not Specified"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 text-muted-foreground" /> Year Established
                        </span>
                        <span className="font-medium text-foreground font-mono">
                          {company.year_established || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
                          Organization Type
                        </span>
                        <span className="font-medium text-foreground">
                          {company.organization_type_name || "Not Specified"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact & Address Box */}
                  <div className="bg-card border rounded-xl p-5 space-y-3.5 shadow-2xs">
                    <h4 className="font-bold text-foreground flex items-center gap-2 border-b pb-2 text-xs uppercase tracking-wider text-muted-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      Contact & Online Presence
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5 text-foreground">
                        <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Mail className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-muted-foreground block font-semibold">Company Email</span>
                          <a href={`mailto:${company.company_email}`} className="font-medium text-primary hover:underline">
                            {company.company_email}
                          </a>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 text-foreground">
                        <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Phone className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-muted-foreground block font-semibold">Phone Contact</span>
                          <span className="font-medium">{company.company_contact}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 text-foreground">
                        <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-muted-foreground block font-semibold">Registered Business Address</span>
                          <span className="font-medium leading-relaxed">{addressParts || "No address specified."}</span>
                        </div>
                      </div>

                      {company.company_website && (
                        <div className="flex items-center gap-2.5 text-foreground">
                          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Globe className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-muted-foreground block font-semibold">Official Website</span>
                            <a
                              href={formatUrl(company.company_website)}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                            >
                              {company.company_website}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Social Media Links */}
                {hasSocials && (
                  <div className="bg-card border rounded-xl p-4 space-y-3">
                    <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
                      Social Media & External Profiles
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {company.company_facebook && (
                        <a
                          href={formatUrl(company.company_facebook)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors"
                        >
                          <Facebook className="h-3.5 w-3.5 text-blue-600" />
                          Facebook
                        </a>
                      )}
                      {company.company_linkedin && (
                        <a
                          href={formatUrl(company.company_linkedin)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors"
                        >
                          <Linkedin className="h-3.5 w-3.5 text-blue-700" />
                          LinkedIn
                        </a>
                      )}
                      {company.company_instagram && (
                        <a
                          href={formatUrl(company.company_instagram)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors"
                        >
                          <Instagram className="h-3.5 w-3.5 text-pink-600" />
                          Instagram
                        </a>
                      )}
                      {company.company_youtube && (
                        <a
                          href={formatUrl(company.company_youtube)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors"
                        >
                          <Youtube className="h-3.5 w-3.5 text-red-600" />
                          YouTube
                        </a>
                      )}
                      {company.company_x && (
                        <a
                          href={formatUrl(company.company_x)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors"
                        >
                          <span className="font-bold text-xs">𝕏</span>
                          X (Twitter)
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Company Description / About Us */}
                {company.company_description && (
                  <div className="bg-card border rounded-xl p-5 space-y-2">
                    <h4 className="font-bold text-foreground flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                      <Info className="h-4 w-4 text-primary" />
                      Company Overview & Description
                    </h4>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {company.company_description}
                    </p>
                  </div>
                )}

                {/* Internal Notes & Rejection Guidance */}
                {company.internal_notes && (
                  <div className="bg-muted/40 border rounded-xl p-4 space-y-1">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-primary" />
                      Internal Admin Reviewer Notes
                    </span>
                    <p className="text-muted-foreground">{company.internal_notes}</p>
                  </div>
                )}

                {company.rejection_reason && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 space-y-1">
                    <span className="font-semibold text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      Public Applicant Guidance / Rejection Reason
                    </span>
                    <p className="text-muted-foreground">{company.rejection_reason}</p>
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: DOCUMENTS */}
              <TabsContent value="documents" className="space-y-3 text-xs outline-none">
                {sortedDocuments.length === 0 ? (
                  <div className="border border-dashed rounded-xl p-8 text-center text-muted-foreground">
                    No company verification documents attached to this submission.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {sortedDocuments.map((doc) => {
                      const documentTypeLabel = formatDocumentTypeLabel(doc.document_type);
                      return (
                        <div
                          key={doc.company_document_id}
                          className="flex items-stretch gap-3 border rounded-xl p-3 bg-card hover:bg-muted/30 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setViewerDoc({
                                fileId: doc.directus_file_id,
                                fileName: doc.document_name,
                                documentTypeLabel,
                              })
                            }
                            title="Open full-size preview"
                            className="relative shrink-0 h-24 w-24 rounded-lg overflow-hidden border bg-muted group/thumb cursor-zoom-in"
                          >
                            <DocumentThumbnail fileId={doc.directus_file_id} fileName={doc.document_name} />
                            <span className="absolute inset-0 bg-black/45 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Maximize2 className="h-4 w-4" />
                            </span>
                          </button>

                          <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                            <div className="min-w-0 space-y-1.5">
                              {/* Primary text: File Name */}
                              <p
                                className="font-semibold text-foreground text-xs sm:text-sm truncate leading-snug"
                                title={doc.document_name || "Verification Document"}
                              >
                                {doc.document_name || "Verification Document"}
                              </p>

                              {/* Subtext badge: Document Category & Upload Date */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                                    getDocumentCategoryBadgeStyle(documentTypeLabel)
                                  )}
                                >
                                  {documentTypeLabel}
                                </Badge>
                              </div>
                              <div>                                
                                <span className="text-[11px] text-muted-foreground">
                                Uploaded {formatDate(doc.uploaded_at)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setViewerDoc({
                                    fileId: doc.directus_file_id,
                                    fileName: doc.document_name,
                                    documentTypeLabel,
                                  })
                                }
                                className="h-7 text-[11px] gap-1.5"
                              >
                                <Maximize2 className="h-3.5 w-3.5" />
                                Preview
                              </Button>
                              <Button variant="default" size="sm" asChild className="h-7 text-[11px] gap-1.5">
                                <a
                                  href={`/api/assets/${doc.directus_file_id}?download`}
                                  download={doc.document_name}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Download
                                </a>
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* TAB 3: OWNER & CONTACT */}
              <TabsContent value="contact" className="space-y-6 text-xs outline-none">
                {/* Primary Account Holder / Submitter */}
                <div className="bg-card border rounded-xl p-5 space-y-4 shadow-2xs">
                  <h4 className="font-bold text-foreground flex items-center justify-between border-b pb-2 text-xs uppercase tracking-wider text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-primary" />
                      Primary Account Owner & Representative
                    </span>
                    {primaryOwner && (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                        Primary Contact
                      </Badge>
                    )}
                  </h4>

                  {primaryOwner ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-xl border">
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Full Name</span>
                          <span className="font-semibold text-foreground text-sm">
                            {`${primaryOwner.user_fname || ""} ${primaryOwner.user_lname || ""}`.trim() || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Email Address</span>
                          {primaryOwner.user_email ? (
                            <a href={`mailto:${primaryOwner.user_email}`} className="font-semibold text-primary hover:underline text-sm">
                              {primaryOwner.user_email}
                            </a>
                          ) : (
                            <span className="font-semibold text-muted-foreground text-sm">N/A</span>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Contact Phone</span>
                          <span className="font-medium text-foreground">{primaryOwner.user_contact || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Role / Title</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" className="text-[10px]">{primaryOwner.company_user_role}</Badge>
                            {primaryOwner.user_position && (
                              <span className="text-muted-foreground font-medium">({primaryOwner.user_position})</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Government ID Verification Section for Primary Owner */}
                      <div className="border rounded-xl p-4 bg-card space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h5 className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            Submitted Government Identification
                          </h5>
                          {primaryOwner.identity_verification?.gov_id_type ? (
                            <Badge variant="secondary" className="text-[10px] font-semibold">
                              ID Type: {primaryOwner.identity_verification.gov_id_type}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              No ID Uploaded
                            </Badge>
                          )}
                        </div>

                        {primaryFrontUrl || primaryBackUrl ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                            {/* Front ID Card */}
                            <div className="border rounded-xl p-3 bg-muted/20 space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
                                <span>Government ID (Front)</span>
                                {primaryFrontUrl && (
                                  <a
                                    href={`${primaryFrontUrl}?download`}
                                    download
                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                  >
                                    <Download className="h-3 w-3" /> Download
                                  </a>
                                )}
                              </div>
                              {primaryFrontUrl ? (
                                <div
                                  onClick={() =>
                                    openPreview({
                                      url: primaryFrontUrl,
                                      title: `${primaryOwner.user_fname} ${primaryOwner.user_lname} - Government ID (Front)`,
                                      type: "cover",
                                    })
                                  }
                                  className="h-40 w-full rounded-lg border bg-background overflow-hidden relative group cursor-pointer flex items-center justify-center"
                                >
                                  <Image
                                    src={primaryFrontUrl}
                                    alt="Government ID Front"
                                    width={320}
                                    height={160}
                                    unoptimized
                                    className="h-full w-full object-contain group-hover:scale-102 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                                    <Maximize2 className="h-4 w-4" /> Click to Expand
                                  </div>
                                </div>
                              ) : (
                                <div className="h-40 w-full rounded-lg border border-dashed flex items-center justify-center text-muted-foreground text-xs">
                                  Front ID Image Not Provided
                                </div>
                              )}
                            </div>

                            {/* Back ID Card */}
                            <div className="border rounded-xl p-3 bg-muted/20 space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
                                <span>Government ID (Back)</span>
                                {primaryBackUrl && (
                                  <a
                                    href={`${primaryBackUrl}?download`}
                                    download
                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                  >
                                    <Download className="h-3 w-3" /> Download
                                  </a>
                                )}
                              </div>
                              {primaryBackUrl ? (
                                <div
                                  onClick={() =>
                                    openPreview({
                                      url: primaryBackUrl,
                                      title: `${primaryOwner.user_fname} ${primaryOwner.user_lname} - Government ID (Back)`,
                                      type: "cover",
                                    })
                                  }
                                  className="h-40 w-full rounded-lg border bg-background overflow-hidden relative group cursor-pointer flex items-center justify-center"
                                >
                                  <Image
                                    src={primaryBackUrl}
                                    alt="Government ID Back"
                                    width={320}
                                    height={160}
                                    unoptimized
                                    className="h-full w-full object-contain group-hover:scale-102 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                                    <Maximize2 className="h-4 w-4" /> Click to Expand
                                  </div>
                                </div>
                              ) : (
                                <div className="h-40 w-full rounded-lg border border-dashed flex items-center justify-center text-muted-foreground text-xs">
                                  Back ID Image Not Provided
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground text-xs">
                            No government identification card uploaded for this account owner.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">No primary owner account linked.</div>
                  )}
                </div>

              </TabsContent>

              {/* TAB 4: VERIFICATION LOGS */}
              <TabsContent value="history" className="space-y-3 text-xs outline-none">
                {verifications.length === 0 ? (
                  <div className="border border-dashed rounded-xl p-8 text-center text-muted-foreground">
                    No historical review decisions logged yet.
                  </div>
                ) : (
                  verifications.map((v) => (
                    <div key={v.id} className="border rounded-xl p-4 bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">
                            {v.verification_type.replace(/_/g, " ")}
                          </span>
                          <VerificationStatusBadge status={v.status} />
                        </div>
                        <span className="text-muted-foreground text-[11px]">{formatDate(v.created_at)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1 border-t">
                        <div>Reviewer: <strong className="text-foreground">{v.reviewer_name || (v.reviewed_by ? `Admin #${v.reviewed_by}` : "—")}</strong></div>
                        <div>Submitted By: <strong className="text-foreground">{v.submitter_name || (v.submitted_by_user_id ? `User #${v.submitted_by_user_id}` : "—")}</strong></div>
                      </div>

                      {v.public_rejection_reason && (
                        <div className="bg-destructive/10 p-2.5 rounded border border-destructive/20 text-destructive mt-1">
                          <strong>Public Guidance:</strong> {v.public_rejection_reason}
                        </div>
                      )}
                      {v.internal_notes && (
                        <div className="bg-muted p-2.5 rounded border text-muted-foreground mt-1">
                          <strong>Internal Notes:</strong> {v.internal_notes}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer Actions */}
          <DialogFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-between gap-3 shrink-0">
            {reviewNote && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-auto">
                <Info className="h-3.5 w-3.5 shrink-0" />
                {reviewNote}
              </div>
            )}
            <div className="flex items-center gap-2">
              {canRequestRevision && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRequestRevision(company)}
                  disabled={isSubmitting}
                  className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 gap-1 text-xs font-semibold"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Request Revision
                </Button>
              )}
              {canApprove && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onApprove(company)}
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs font-semibold"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Approve Verification
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expanded Lightbox Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent
          className={`p-0 flex flex-col overflow-hidden bg-card border rounded-2xl shadow-2xl [&>button]:hidden ${currentImg?.type === "logo" ? "sm:max-w-md w-[90vw]" : "sm:max-w-4xl w-[92vw]"
            }`}
        >
          <div className="px-5 py-3 flex items-center justify-between border-b bg-muted/40 shrink-0">
            <span className="text-xs font-bold tracking-tight text-foreground truncate">{currentImg?.title}</span>
            <div className="flex items-center gap-2">
              {currentImg?.url && (
                <a
                  href={currentImg.url}
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
            {currentImg && (
              <Image
                src={currentImg.url}
                alt={currentImg.title}
                width={800}
                height={600}
                unoptimized
                className={`object-contain rounded-xl shadow-md border bg-background ${currentImg.type === "logo" ? "max-h-[320px] max-w-[320px]" : "max-h-[60vh] max-w-full"
                  }`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Lightbox Viewer (pan / zoom / rotate / download) */}
      {isOpen && viewerDoc && (
        <DocumentViewerModal
          key={viewerDoc.fileId}
          doc={viewerDoc}
          onClose={() => setViewerDoc(null)}
        />
      )}
    </>
  );
};

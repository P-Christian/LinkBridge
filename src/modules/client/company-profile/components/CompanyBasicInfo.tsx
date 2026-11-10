/* eslint-disable @next/next/no-img-element */
// src/modules/client/company-profile/components/CompanyBasicInfo.tsx
"use client";

import React, { useRef, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EditableCompanyFields } from "../types";
import {
  Facebook,
  Linkedin,
  Instagram,
  Youtube,
  Upload,
  Image as ImageIcon,
  Loader2,
  Building2,
  AlertCircle,
} from "lucide-react";

import ImageCropModal from "./ImageCropModal";
import InlineAITrigger from "./InlineAITrigger";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CompanyBasicInfoProps {
  data: Partial<EditableCompanyFields>;
  onChange: (field: keyof EditableCompanyFields, value: string) => void;
  fieldErrors?: Record<string, string>;
  readOnly?: boolean;
}

function getImageUrl(value: string | null | undefined): string {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }
  return `/api/client/assets/${value}`;
}

function formatWebsiteUrl(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function extractSocialHandle(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim().replace(/\/$/, "");
  const lastSlashIndex = trimmed.lastIndexOf("/");
  if (lastSlashIndex !== -1) {
    return trimmed.substring(lastSlashIndex + 1);
  }
  return trimmed.replace(/^\//, "");
}

function CharCounter({
  current,
  max,
  min,
}: {
  current: number;
  max: number;
  min?: number;
}) {
  const isOver = current > max;
  const isUnder = min !== undefined && current > 0 && current < min;

  return (
    <span
      className={cn(
        "text-[10px] font-mono transition-colors",
        isOver
          ? "text-destructive font-bold"
          : isUnder
          ? "text-amber-500 dark:text-amber-400 font-medium"
          : "text-muted-foreground"
      )}
    >
      {min !== undefined && isUnder ? `min ${min} · ` : ""}
      {current}/{max}
    </span>
  );
}

export default function CompanyBasicInfo({
  data,
  onChange,
  fieldErrors = {},
  readOnly = false,
}: CompanyBasicInfoProps) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [cropModalState, setCropModalState] = useState<{
    isOpen: boolean;
    imageSrc: string | null;
    type: "company_logo" | "company_cover";
  }>({
    isOpen: false,
    imageSrc: null,
    type: "company_logo",
  });

  // ── Live validation and length check while typing ────────────────────
  const liveErrors = useMemo(() => {
    const errs: Record<string, string> = {};

    // Display Name: min 2, max 100
    const name = data.company_name ?? "";
    if (name.length > 0) {
      if (name.trim().length < 2) errs.company_name = "At least 2 characters required";
      else if (name.length > 100) errs.company_name = "Maximum 100 characters allowed";
    }

    // Legal Name: min 2, max 150
    const legal = data.company_legal_name ?? "";
    if (legal.length > 0) {
      if (legal.trim().length < 2) errs.company_legal_name = "At least 2 characters required";
      else if (legal.length > 150) errs.company_legal_name = "Maximum 150 characters allowed";
    }

    // Company Email
    const email = (data.company_email ?? "").trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.length > 0) {
      if (!emailRegex.test(email)) errs.company_email = "Invalid email format (e.g. hr@company.com)";
      else if (email.length > 100) errs.company_email = "Maximum 100 characters allowed";
    }

    // Company Contact
    const contact = (data.company_contact ?? "").trim();
    const phoneRegex = /^(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,9}$/;
    if (contact.length > 0) {
      if (!phoneRegex.test(contact)) errs.company_contact = "Invalid phone number (e.g. 0912-345-6789 or +63 912 345 6789)";
      else if (contact.length > 50) errs.company_contact = "Maximum 50 characters allowed";
    }

    // Registration Number: min 3, max 50 (optional)
    const regNo = (data.registration_no ?? "").trim();
    if (regNo.length > 0) {
      if (regNo.length < 3) errs.registration_no = "At least 3 characters required if entered";
      else if (regNo.length > 50) errs.registration_no = "Maximum 50 characters allowed";
    }

    // TIN: 9-12 digits continuous or hyphenated
    const tin = (data.company_tin ?? "").trim();
    const tinRegex = /^\d{3}-?\d{3}-?\d{3}(-?\d{3})?$/;
    if (tin.length > 0) {
      if (!tinRegex.test(tin) || tin.length > 20) {
        errs.company_tin = "TIN must be 9–12 digits (e.g. 000-000-000-000 or 000000000)";
      }
    }

    // Company Website
    const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
    const website = (data.company_website ?? "").trim();
    if (website.length > 0) {
      if (!urlRegex.test(website) || website.length > 255) {
        errs.company_website = "Please enter a valid website URL (e.g. https://company.com)";
      }
    }

    // Company Description: min 20, max 2000
    const desc = data.company_description ?? "";
    if (desc.length > 0) {
      if (desc.trim().length < 20) {
        errs.company_description = `At least 20 characters required (${desc.trim().length}/20)`;
      } else if (desc.length > 2000) {
        errs.company_description = "Maximum 2,000 characters allowed";
      }
    }

    // Mission Statement: max 1000
    const mission = data.company_mission ?? "";
    if (mission.length > 1000) errs.company_mission = "Maximum 1,000 characters allowed";

    // Vision Statement: max 1000
    const vision = data.company_vision ?? "";
    if (vision.length > 1000) errs.company_vision = "Maximum 1,000 characters allowed";

    // Culture: max 1500
    const culture = data.company_culture ?? "";
    if (culture.length > 1500) errs.company_culture = "Maximum 1,500 characters allowed";

    // Benefits: max 1500
    const benefits = data.company_benefits ?? "";
    if (benefits.length > 1500) errs.company_benefits = "Maximum 1,500 characters allowed";

    // Social Media Links
    const socials: Array<{ key: keyof EditableCompanyFields; label: string }> = [
      { key: "company_facebook", label: "Facebook" },
      { key: "company_linkedin", label: "LinkedIn" },
      { key: "company_instagram", label: "Instagram" },
      { key: "company_youtube", label: "YouTube" },
      { key: "company_x", label: "𝕏 (Twitter)" },
    ];
    for (const s of socials) {
      const val = (data[s.key] as string ?? "").trim();
      if (val.length > 0) {
        if (!urlRegex.test(val) || val.length > 500) {
          errs[s.key] = `Please enter a valid URL for ${s.label}`;
        }
      }
    }

    return errs;
  }, [data]);

  const getError = (field: string) => liveErrors[field] || fieldErrors[field];
  const hasError = (field: string) => Boolean(getError(field));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, field: "company_logo" | "company_cover") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropModalState({
        isOpen: true,
        imageSrc: reader.result as string,
        type: field,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCroppedUpload = async (croppedFile: File) => {
    const field = cropModalState.type;
    if (field === "company_logo") setUploadingLogo(true);
    else setUploadingCover(true);

    try {
      const formData = new FormData();
      formData.append("file", croppedFile);

      const res = await fetch("/api/client/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to upload image");
      }

      const uploadedFile = await res.json();
      onChange(field, uploadedFile.id);
      setCropModalState((prev) => ({ ...prev, isOpen: false, imageSrc: null }));
      toast.success(field === "company_logo" ? "Company logo updated." : "Cover photo updated.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't upload the image. Please try again.");
    } finally {
      if (field === "company_logo") setUploadingLogo(false);
      else setUploadingCover(false);
    }
  };

  if (readOnly) {
    return (
      <div className="space-y-6">
        <div>
          {/* Banner & Logo Visualizer (Read Only) */}
          <div className="relative mb-14">
            {/* Cover image container */}
            <div className="group w-full aspect-[3/1] bg-gradient-to-r from-primary/10 via-sky-500/10 to-primary/5 relative rounded-xl overflow-hidden border border-border/80">
              {data.company_cover ? (
                <img
                  src={getImageUrl(data.company_cover)}
                  alt="Company Cover"
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs font-medium">
                  No cover photo uploaded
                </div>
              )}
            </div>
            {/* Logo overlay - positioned absolutely, half-overlapping the bottom border */}
            <div className="absolute -bottom-4 left-6 h-24 w-24 rounded-2xl border-2 border-background bg-card shadow-md overflow-hidden flex items-center justify-center z-10 transition-transform duration-300 ease-out hover:scale-105 hover:shadow-lg">
              {data.company_logo ? (
                <img
                  src={getImageUrl(data.company_logo)}
                  alt="Company Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 className="h-9 w-9 text-muted-foreground" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Company Display Name</span>
              <p className="text-sm font-medium text-foreground">{data.company_name || "—"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Legal Company Name</span>
              <p className="text-sm font-medium text-foreground">{data.company_legal_name || "—"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Company Email</span>
              <p className="text-sm font-medium text-foreground">{data.company_email || "—"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Company Contact</span>
              <p className="text-sm font-medium text-foreground">{data.company_contact || "—"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Registration Number</span>
              <p className="text-sm font-medium text-foreground">{data.registration_no || "—"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">TIN</span>
              <p className="text-sm font-medium text-foreground">{data.company_tin || "—"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Company Website</span>
              {data.company_website ? (
                <a href={formatWebsiteUrl(data.company_website)} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline hover:text-primary/80 block truncate max-w-xs">
                  {data.company_website}
                </a>
              ) : (
                <p className="text-sm font-medium text-foreground">—</p>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Social Media Links</span>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {data.company_facebook && (
                  <a
                    href={formatWebsiteUrl(data.company_facebook)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Facebook: ${extractSocialHandle(data.company_facebook)}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-card/60 hover:bg-primary/10 hover:border-primary/30 text-xs font-medium text-foreground transition-all"
                  >
                    <Facebook className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{extractSocialHandle(data.company_facebook)}</span>
                  </a>
                )}
                {data.company_linkedin && (
                  <a
                    href={formatWebsiteUrl(data.company_linkedin)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`LinkedIn: ${extractSocialHandle(data.company_linkedin)}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-card/60 hover:bg-primary/10 hover:border-primary/30 text-xs font-medium text-foreground transition-all"
                  >
                    <Linkedin className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{extractSocialHandle(data.company_linkedin)}</span>
                  </a>
                )}
                {data.company_instagram && (
                  <a
                    href={formatWebsiteUrl(data.company_instagram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Instagram: ${extractSocialHandle(data.company_instagram)}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-card/60 hover:bg-primary/10 hover:border-primary/30 text-xs font-medium text-foreground transition-all"
                  >
                    <Instagram className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{extractSocialHandle(data.company_instagram)}</span>
                  </a>
                )}
                {data.company_x && (
                  <a
                    href={formatWebsiteUrl(data.company_x)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`𝕏: ${extractSocialHandle(data.company_x)}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-card/60 hover:bg-primary/10 hover:border-primary/30 text-xs font-medium text-foreground transition-all"
                  >
                    <span className="text-xs font-bold text-primary shrink-0">𝕏</span>
                    <span>{extractSocialHandle(data.company_x)}</span>
                  </a>
                )}
                {data.company_youtube && (
                  <a
                    href={formatWebsiteUrl(data.company_youtube)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`YouTube: ${extractSocialHandle(data.company_youtube)}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-card/60 hover:bg-primary/10 hover:border-primary/30 text-xs font-medium text-foreground transition-all"
                  >
                    <Youtube className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    <span>{extractSocialHandle(data.company_youtube)}</span>
                  </a>
                )}
                {!data.company_facebook &&
                  !data.company_linkedin &&
                  !data.company_instagram &&
                  !data.company_x &&
                  !data.company_youtube && (
                    <p className="text-sm font-medium text-foreground">—</p>
                  )}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border/60 space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Company Description</span>
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{data.company_description || "No description provided."}</p>
        </div>

        {(data.company_mission || data.company_vision) && (
          <div className="pt-4 border-t border-border/60 grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.company_mission && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Mission</span>
                <p className="text-sm text-foreground/90 leading-relaxed">{data.company_mission}</p>
              </div>
            )}
            {data.company_vision && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Vision</span>
                <p className="text-sm text-foreground/90 leading-relaxed">{data.company_vision}</p>
              </div>
            )}
          </div>
        )}

        {data.company_culture && (
          <div className="pt-4 border-t border-border/60 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Company Culture</span>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{data.company_culture}</p>
          </div>
        )}

        {data.company_benefits && (
          <div className="pt-4 border-t border-border/60 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Perks & Benefits</span>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{data.company_benefits}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4 flex items-center gap-2">
          <span className="inline-block w-1 h-4 bg-primary rounded-full" />
          Basic Information
        </h3>

        {/* Banner & Logo Visualizer (Edit Mode with Hovers) */}
        <div className="relative mb-14">
          {/* Cover image editor */}
          <div 
            onClick={() => coverInputRef.current?.click()}
            className="group w-full aspect-[3/1] bg-linear-to-r from-emerald-500/10 to-teal-500/10 relative rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 cursor-pointer transition-all hover:brightness-95"
          >
            {data.company_cover ? (
              <img
                src={getImageUrl(data.company_cover)}
                alt="Company Cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 text-xs">
                <ImageIcon className="h-6 w-6 mb-1 text-zinc-400 group-hover:scale-105 transition-transform" />
                Upload Cover Photo
              </div>
            )}
            
            {/* Hover overlay for cover */}
            <div className="absolute inset-0 bg-white/40 dark:bg-black/40 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity flex items-center justify-center">
              <div className="bg-white/95 dark:bg-zinc-900/95 text-zinc-800 dark:text-zinc-200 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5">
                {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Change Cover Photo
              </div>
            </div>
            
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e, "company_cover")}
            />
          </div>

          {/* Logo overlay editor */}
          <div 
            onClick={() => logoInputRef.current?.click()}
            className="group absolute -bottom-4 left-6 h-24 w-24 rounded-xl border-2 border-white dark:border-zinc-950 bg-white dark:bg-zinc-900 shadow-md overflow-hidden flex items-center justify-center cursor-pointer z-10 transition-transform hover:scale-102"
          >
            {data.company_logo ? (
              <img
                src={getImageUrl(data.company_logo)}
                alt="Company Logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 className="h-9 w-9 text-zinc-400 group-hover:scale-105 transition-transform" />
            )}

            {/* Hover overlay for logo */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity flex items-center justify-center">
              {uploadingLogo ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <Upload className="h-5 w-5 text-zinc-800 dark:text-white" />
              )}
            </div>

            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e, "company_logo")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Company Display Name */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-company-name" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Company Display Name <span className="text-destructive">*</span>
              </Label>
              <CharCounter current={(data.company_name ?? "").length} max={100} min={2} />
            </div>
            <Input
              id="cp-company-name"
              value={data.company_name ?? ""}
              onChange={(e) => onChange("company_name", e.target.value)}
              placeholder="e.g. Vertex Technologies"
              aria-invalid={hasError("company_name")}
              className={cn(
                "h-9 md:text-sm max-md:h-10 max-md:text-base",
                hasError("company_name") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
              )}
            />
            {hasError("company_name") && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {getError("company_name")}
              </p>
            )}
          </div>

          {/* Legal Company Name */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-company-legal-name" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Legal Company Name <span className="text-destructive">*</span>
              </Label>
              <CharCounter current={(data.company_legal_name ?? "").length} max={150} min={2} />
            </div>
            <Input
              id="cp-company-legal-name"
              value={data.company_legal_name ?? ""}
              onChange={(e) => onChange("company_legal_name", e.target.value)}
              placeholder="e.g. Vertex Technologies Corporation"
              aria-invalid={hasError("company_legal_name")}
              className={cn(
                "h-9 md:text-sm max-md:h-10 max-md:text-base",
                hasError("company_legal_name") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
              )}
            />
            {hasError("company_legal_name") && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {getError("company_legal_name")}
              </p>
            )}
          </div>

          {/* Company Email */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-company-email" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Company Email <span className="text-destructive">*</span>
              </Label>
              <CharCounter current={(data.company_email ?? "").length} max={100} />
            </div>
            <Input
              id="cp-company-email"
              type="email"
              value={data.company_email ?? ""}
              onChange={(e) => onChange("company_email", e.target.value)}
              placeholder="hr@company.com"
              aria-invalid={hasError("company_email")}
              className={cn(
                "h-9 md:text-sm max-md:h-10 max-md:text-base",
                hasError("company_email") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
              )}
            />
            {hasError("company_email") && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {getError("company_email")}
              </p>
            )}
          </div>

          {/* Company Contact */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-company-contact" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Company Contact <span className="text-destructive">*</span>
              </Label>
              <CharCounter current={(data.company_contact ?? "").length} max={50} />
            </div>
            <Input
              id="cp-company-contact"
              value={data.company_contact ?? ""}
              onChange={(e) => onChange("company_contact", e.target.value)}
              placeholder="0912-345-6789 or +63 912 345 6789"
              aria-invalid={hasError("company_contact")}
              className={cn(
                "h-9 md:text-sm max-md:h-10 max-md:text-base",
                hasError("company_contact") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
              )}
            />
            {hasError("company_contact") && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {getError("company_contact")}
              </p>
            )}
          </div>

          {/* Registration Number */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-registration-number" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Registration Number
              </Label>
              <CharCounter current={(data.registration_no ?? "").length} max={50} min={3} />
            </div>
            <Input
              id="cp-registration-number"
              value={data.registration_no ?? ""}
              onChange={(e) => onChange("registration_no", e.target.value)}
              placeholder="e.g. SEC-CS202012345 or DTI-1234567"
              aria-invalid={hasError("registration_no")}
              className={cn(
                "h-9 md:text-sm max-md:h-10 max-md:text-base",
                hasError("registration_no") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
              )}
            />
            {hasError("registration_no") && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {getError("registration_no")}
              </p>
            )}
          </div>

          {/* Tax Identification Number (TIN) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-tin" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">
                TIN
              </Label>
              <CharCounter current={(data.company_tin ?? "").length} max={15} />
            </div>
            <Input
              id="cp-tin"
              value={data.company_tin ?? ""}
              onChange={(e) => onChange("company_tin", e.target.value)}
              placeholder="e.g. 000-123-456-000 or 000123456000"
              aria-invalid={hasError("company_tin")}
              className={cn(
                "h-9 md:text-sm max-md:h-10 max-md:text-base",
                hasError("company_tin") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
              )}
            />
            {hasError("company_tin") && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {getError("company_tin")}
              </p>
            )}
          </div>

          {/* Company Website */}
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-company-website" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Company Website
              </Label>
              <CharCounter current={(data.company_website ?? "").length} max={255} />
            </div>
            <Input
              id="cp-company-website"
              value={data.company_website ?? ""}
              onChange={(e) => onChange("company_website", e.target.value)}
              placeholder="https://company.com"
              aria-invalid={hasError("company_website")}
              className={cn(
                "h-9 md:text-sm max-md:h-10 max-md:text-base",
                hasError("company_website") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
              )}
            />
            {hasError("company_website") && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {getError("company_website")}
              </p>
            )}
          </div>

          {/* Hidden inputs to keep state updated */}
          <input type="hidden" value={data.company_logo ?? ""} />
          <input type="hidden" value={data.company_cover ?? ""} />
        </div>
      </div>

      {/* Company Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between h-7">
          <Label htmlFor="cp-company-description" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Company Description <span className="text-destructive">*</span>
          </Label>
          <div className="flex items-center gap-2">
            <CharCounter current={(data.company_description ?? "").length} max={2000} min={20} />
            <InlineAITrigger
              currentText={data.company_description ?? ""}
              fieldType="company_description"
              companyName={data.company_name ?? "Company"}
              onRefined={(val) => onChange("company_description", val)}
            />
          </div>
        </div>
        <Textarea
          id="cp-company-description"
          value={data.company_description ?? ""}
          onChange={(e) => onChange("company_description", e.target.value)}
          rows={4}
          placeholder="Tell job seekers about your company, core focus, and value proposition (min 20 characters)..."
          aria-invalid={hasError("company_description")}
          className={cn(
            "md:text-xs md:text-sm max-md:text-base leading-relaxed rounded-xl resize-none",
            hasError("company_description") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
          )}
        />
        {hasError("company_description") && (
          <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {getError("company_description")}
          </p>
        )}
      </div>

      {/* Mission & Vision (AI Trigger explicitly removed per requirements) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-7">
            <Label htmlFor="cp-company-mission" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Mission Statement
            </Label>
            <CharCounter current={(data.company_mission ?? "").length} max={1000} />
          </div>
          <Textarea
            id="cp-company-mission"
            value={data.company_mission ?? ""}
            onChange={(e) => onChange("company_mission", e.target.value)}
            rows={4}
            placeholder="e.g. To empower businesses worldwide through transformative intelligent software..."
            aria-invalid={hasError("company_mission")}
            className={cn(
              "md:text-xs md:text-sm max-md:text-base leading-relaxed rounded-xl resize-none",
              hasError("company_mission") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
            )}
          />
          {hasError("company_mission") && (
            <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {getError("company_mission")}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-7">
            <Label htmlFor="cp-company-vision" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Vision Statement
            </Label>
            <CharCounter current={(data.company_vision ?? "").length} max={1000} />
          </div>
          <Textarea
            id="cp-company-vision"
            value={data.company_vision ?? ""}
            onChange={(e) => onChange("company_vision", e.target.value)}
            rows={4}
            placeholder="e.g. To be the premier talent and technology innovation partner in Southeast Asia..."
            aria-invalid={hasError("company_vision")}
            className={cn(
              "md:text-xs md:text-sm max-md:text-base leading-relaxed rounded-xl resize-none",
              hasError("company_vision") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
            )}
          />
          {hasError("company_vision") && (
            <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {getError("company_vision")}
            </p>
          )}
        </div>
      </div>

      {/* Culture & Values */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between h-7">
          <Label htmlFor="cp-company-culture" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Company Culture & Environment
          </Label>
          <div className="flex items-center gap-2">
            <CharCounter current={(data.company_culture ?? "").length} max={1500} />
            <InlineAITrigger
              currentText={data.company_culture ?? ""}
              fieldType="company_culture"
              companyName={data.company_name ?? "Company"}
              onRefined={(val) => onChange("company_culture", val)}
            />
          </div>
        </div>
        <Textarea
          id="cp-company-culture"
          value={data.company_culture ?? ""}
          onChange={(e) => onChange("company_culture", e.target.value)}
          rows={4}
          placeholder="Describe your work atmosphere, collaboration values, and professional growth environment..."
          aria-invalid={hasError("company_culture")}
          className={cn(
            "md:text-xs md:text-sm max-md:text-base leading-relaxed rounded-xl resize-none",
            hasError("company_culture") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
          )}
        />
        {hasError("company_culture") && (
          <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {getError("company_culture")}
          </p>
        )}
      </div>

      {/* Perks & Benefits */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between h-7">
          <Label htmlFor="cp-company-benefits" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Perks & Benefits
          </Label>
          <div className="flex items-center gap-2">
            <CharCounter current={(data.company_benefits ?? "").length} max={1500} />
            <InlineAITrigger
              currentText={data.company_benefits ?? ""}
              fieldType="company_benefits"
              companyName={data.company_name ?? "Company"}
              onRefined={(val) => onChange("company_benefits", val)}
            />
          </div>
        </div>
        <Textarea
          id="cp-company-benefits"
          value={data.company_benefits ?? ""}
          onChange={(e) => onChange("company_benefits", e.target.value)}
          rows={4}
          placeholder="List verified company benefits (HMO, remote allowances, learning budgets, performance bonuses)..."
          aria-invalid={hasError("company_benefits")}
          className={cn(
            "md:text-xs md:text-sm max-md:text-base leading-relaxed rounded-xl resize-none",
            hasError("company_benefits") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
          )}
        />
        {hasError("company_benefits") && (
          <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {getError("company_benefits")}
          </p>
        )}
      </div>

      {/* Social Media Links Section */}
      <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <Label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Social Media Links</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Facebook */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-facebook" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">Facebook URL</Label>
              <CharCounter current={(data.company_facebook ?? "").length} max={500} />
            </div>
            <Input
              id="cp-facebook"
              value={data.company_facebook ?? ""}
              onChange={(e) => onChange("company_facebook", e.target.value)}
              placeholder="https://facebook.com/username"
              aria-invalid={hasError("company_facebook")}
              className={cn(
                "h-9 md:text-sm max-md:h-10 max-md:text-base",
                hasError("company_facebook") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
              )}
            />
            {hasError("company_facebook") && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {getError("company_facebook")}
              </p>
            )}
          </div>

          {/* LinkedIn */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-linkedin" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">LinkedIn URL</Label>
              <CharCounter current={(data.company_linkedin ?? "").length} max={500} />
            </div>
            <Input
              id="cp-linkedin"
              value={data.company_linkedin ?? ""}
              onChange={(e) => onChange("company_linkedin", e.target.value)}
              placeholder="https://linkedin.com/company/username"
              aria-invalid={hasError("company_linkedin")}
              className={cn(
                "h-9 md:text-sm max-md:h-10 max-md:text-base",
                hasError("company_linkedin") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
              )}
            />
            {hasError("company_linkedin") && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {getError("company_linkedin")}
              </p>
            )}
          </div>

          {/* Instagram */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-instagram" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">Instagram URL</Label>
              <CharCounter current={(data.company_instagram ?? "").length} max={500} />
            </div>
            <Input
              id="cp-instagram"
              value={data.company_instagram ?? ""}
              onChange={(e) => onChange("company_instagram", e.target.value)}
              placeholder="https://instagram.com/username"
              aria-invalid={hasError("company_instagram")}
              className={cn(
                "h-9 md:text-sm max-md:h-10 max-md:text-base",
                hasError("company_instagram") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
              )}
            />
            {hasError("company_instagram") && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {getError("company_instagram")}
              </p>
            )}
          </div>

          {/* YouTube */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-youtube" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">YouTube URL</Label>
              <CharCounter current={(data.company_youtube ?? "").length} max={500} />
            </div>
            <Input
              id="cp-youtube"
              value={data.company_youtube ?? ""}
              onChange={(e) => onChange("company_youtube", e.target.value)}
              placeholder="https://youtube.com/channel/username"
              aria-invalid={hasError("company_youtube")}
              className={cn(
                "h-9 md:text-sm max-md:h-10 max-md:text-base",
                hasError("company_youtube") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
              )}
            />
            {hasError("company_youtube") && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {getError("company_youtube")}
              </p>
            )}
          </div>

          {/* 𝕏 (Twitter) */}
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="cp-x" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">𝕏 (Twitter) URL</Label>
              <CharCounter current={(data.company_x ?? "").length} max={500} />
            </div>
            <Input
              id="cp-x"
              value={data.company_x ?? ""}
              onChange={(e) => onChange("company_x", e.target.value)}
              placeholder="https://x.com/username"
              aria-invalid={hasError("company_x")}
              className={cn(
                "h-9 md:text-sm max-md:h-10 max-md:text-base",
                hasError("company_x") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
              )}
            />
            {hasError("company_x") && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {getError("company_x")}
              </p>
            )}
          </div>
        </div>
      </div>

      <ImageCropModal
        isOpen={cropModalState.isOpen}
        imageSrc={cropModalState.imageSrc}
        type={cropModalState.type}
        onCancel={() => setCropModalState((prev) => ({ ...prev, isOpen: false, imageSrc: null }))}
        onConfirm={handleCroppedUpload}
        uploading={cropModalState.type === "company_logo" ? uploadingLogo : uploadingCover}
      />
    </div>
  );
}

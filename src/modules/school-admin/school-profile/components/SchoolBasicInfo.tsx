/* eslint-disable @next/next/no-img-element */
// src/modules/school-admin/school-profile/components/SchoolBasicInfo.tsx
"use client";

import React, { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EditableSchoolFields } from "../types/school-profile.types";
import { 
  Facebook, 
  Linkedin, 
  Globe, 
  Mail, 
  Phone, 
  Building2, 
  GraduationCap, 
  Camera, 
  Loader2,
  ExternalLink
} from "lucide-react";
import SchoolImageCropModal from "./SchoolImageCropModal";
import {
  SCHOOL_CONTACT_ERROR,
  SCHOOL_CONTACT_MAX_LENGTH,
  extractSocialHandle,
  getImageUrl,
  isValidSchoolContactNo,
  sanitizeSchoolContactInput,
  sanitizeWebsiteUrl,
} from "../services/school-profile.helpers";
import { executeUploadSchoolCover, executeUploadSchoolLogo } from "../services/school-profile.service";
import { toast } from "sonner";

interface SchoolBasicInfoProps {
  data: Partial<EditableSchoolFields>;
  onChange: (field: keyof EditableSchoolFields, value: string | boolean | number) => void;
  readOnly?: boolean;
}

export default function SchoolBasicInfo({
  data,
  onChange,
  readOnly = false,
}: SchoolBasicInfoProps) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const [cropModalState, setCropModalState] = useState<{
    isOpen: boolean;
    imageSrc: string | null;
    type: "school_logo" | "school_cover";
  }>({
    isOpen: false,
    imageSrc: null,
    type: "school_logo",
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, field: "school_logo" | "school_cover") => {
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
    if (field === "school_logo") setUploadingLogo(true);
    else setUploadingCover(true);

    try {
      if (field === "school_logo") {
        const url = await executeUploadSchoolLogo(croppedFile);
        onChange("school_logo_url", url);
        toast.success("School logo uploaded. Save changes to keep.");
      } else {
        const url = await executeUploadSchoolCover(croppedFile);
        onChange("school_cover", url);
        toast.success("Campus cover photo uploaded. Save changes to keep.");
      }
      setCropModalState(prev => ({ ...prev, isOpen: false }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload image";
      toast.error(msg);
    } finally {
      setUploadingLogo(false);
      setUploadingCover(false);
    }
  };

  const cleanWebsite = sanitizeWebsiteUrl(data.school_website);
  const fbHandle = extractSocialHandle(data.school_facebook);
  const liHandle = extractSocialHandle(data.school_linkedin);
  const contactValue = data.school_contact_no || "";
  const visibleContactError =
    contactError !== null && contactValue.trim() !== "" && !isValidSchoolContactNo(contactValue)
      ? contactError
      : null;

  const handleContactChange = (rawValue: string) => {
    onChange("school_contact_no", sanitizeSchoolContactInput(rawValue));
    setContactError(null);
  };

  const handleContactBlur = () => {
    if (!isValidSchoolContactNo(contactValue)) {
      setContactError(SCHOOL_CONTACT_ERROR);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Banner & Logo Header ── */}
      <div className="relative mb-14">
        {/* Cover Image Container */}
        <div className="group w-full aspect-[3/1] max-h-[260px] bg-muted relative rounded-2xl overflow-hidden border border-border">
          {data.school_cover ? (
            <img
              src={getImageUrl(data.school_cover)}
              alt={data.school_name || "School Cover"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-r from-primary/15 via-primary/5 to-muted text-muted-foreground">
              <Building2 className="w-12 h-12 opacity-30 mb-2" />
              <span className="text-xs font-medium opacity-50">No Campus Cover Banner</span>
            </div>
          )}

          {!readOnly && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={uploadingCover}
                onClick={() => coverInputRef.current?.click()}
                className="bg-card/90 hover:bg-card text-foreground font-semibold text-xs shadow-lg backdrop-blur-sm gap-2"
              >
                {uploadingCover ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-primary" />
                )}
                Change Cover Photo
              </Button>
            </div>
          )}

          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e, "school_cover")}
          />
        </div>

        {/* Logo Badge (Overlapping bottom-left of cover) */}
        <div className="absolute -bottom-6 left-6 w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-card bg-card shadow-md flex items-center justify-center overflow-hidden z-10 group">
          {data.school_logo_url ? (
            <img
              src={getImageUrl(data.school_logo_url)}
              alt={data.school_name || "School Seal"}
              className="w-full h-full object-contain p-1"
            />
          ) : (
            <GraduationCap className="w-10 h-10 text-muted-foreground" />
          )}

          {!readOnly && (
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="absolute inset-0 bg-black/50 rounded-2xl flex flex-col items-center justify-center text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity border-0 outline-none"
            >
              {uploadingLogo ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Camera className="w-5 h-5 mb-1" />
                  <span className="text-[10px] font-semibold">Upload Seal</span>
                </>
              )}
            </button>
          )}

          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e, "school_logo")}
          />
        </div>
      </div>

      {/* ── Basic Information Details ── */}
      {readOnly ? (
        <div className="space-y-6">
          {/* Header title in read mode */}
          <div className="space-y-1 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/30 text-primary font-semibold text-xs px-2.5 py-0.5">
                {data.school_type || "University"}
              </Badge>
            </div>
            <h2 className="break-words text-xl font-black tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-2xl">
              {data.school_name || "Institution Name"}
            </h2>
          </div>
          {/* Contact & Links Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Official Email
              </span>
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">{data.school_email || "—"}</span>
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Contact Number
              </span>
              <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                <Phone className="w-4 h-4 text-primary shrink-0" />
                <span className="break-words [overflow-wrap:anywhere]">
                  {data.school_contact_no || "—"}
                </span>
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Official Website
              </span>
              {cleanWebsite ? (
                <a
                  href={cleanWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-primary hover:underline flex items-center gap-1.5 truncate"
                >
                  <Globe className="w-4 h-4 shrink-0" />
                  <span className="truncate">{data.school_website}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              ) : (
                <p className="text-sm font-medium text-muted-foreground">—</p>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Social Media
              </span>
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                {data.school_facebook ? (
                  <a
                    href={sanitizeWebsiteUrl(data.school_facebook)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
                  >
                    <Facebook className="w-4 h-4 text-[#1877F2]" />
                    <span>{fbHandle || "Facebook"}</span>
                  </a>
                ) : null}

                {data.school_linkedin ? (
                  <a
                    href={sanitizeWebsiteUrl(data.school_linkedin)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
                  >
                    <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                    <span>{liHandle || "LinkedIn"}</span>
                  </a>
                ) : null}

                {!data.school_facebook && !data.school_linkedin && (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="pt-4 border-t border-border space-y-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              About the Institution
            </span>
            <p className="break-words text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
              {data.school_description || "No institutional description provided yet."}
            </p>
          </div>

          {/* Mission & Values Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
            <div className="min-w-0 space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Institutional Mission
              </span>
              <p className="break-words text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                {data.school_mission || "No institutional mission specified."}
              </p>
            </div>

            <div className="min-w-0 space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Core Values & Philosophy
              </span>
              <p className="break-words text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                {data.school_values || "No core values specified."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Edit Mode Form */
        <div className="space-y-6 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="school_name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                School Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="school_name"
                value={data.school_name || ""}
                onChange={(e) => onChange("school_name", e.target.value)}
                placeholder="e.g. University of the Philippines"
                className="h-10 text-sm rounded-xl"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="school_type" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Institution Type <span className="text-rose-500">*</span>
              </Label>
              <select
                id="school_type"
                value={data.school_type || "University"}
                onChange={(e) => onChange("school_type", e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-xl border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs transition-colors"
              >
                <option value="University">University</option>
                <option value="College">College</option>
                <option value="Technical/Vocational">Technical/Vocational</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="school_email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Official Email
              </Label>
              <Input
                id="school_email"
                type="email"
                value={data.school_email || ""}
                onChange={(e) => onChange("school_email", e.target.value)}
                placeholder="registrar@school.edu.ph"
                className="h-10 text-sm rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="school_contact_no" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Contact Number
              </Label>
              <Input
                id="school_contact_no"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={SCHOOL_CONTACT_MAX_LENGTH}
                value={data.school_contact_no || ""}
                onChange={(e) => handleContactChange(e.target.value)}
                onBlur={handleContactBlur}
                placeholder="+63 2 8123 4567"
                aria-invalid={visibleContactError !== null}
                className="h-10 text-sm rounded-xl"
              />
              {visibleContactError !== null ? (
                <p className="text-xs font-medium text-rose-500">{visibleContactError}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="school_website" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Official Website
              </Label>
              <Input
                id="school_website"
                value={data.school_website || ""}
                onChange={(e) => onChange("school_website", e.target.value)}
                placeholder="https://www.school.edu.ph"
                className="h-10 text-sm rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="school_facebook" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Facebook Page URL
              </Label>
              <div className="relative">
                <Facebook className="w-4 h-4 text-[#1877F2] absolute left-3 top-3 pointer-events-none" />
                <Input
                  id="school_facebook"
                  value={data.school_facebook || ""}
                  onChange={(e) => onChange("school_facebook", e.target.value)}
                  placeholder="https://facebook.com/schoolpage"
                  className="h-10 text-sm pl-9 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="school_linkedin" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                LinkedIn URL
              </Label>
              <div className="relative">
                <Linkedin className="w-4 h-4 text-[#0A66C2] absolute left-3 top-3 pointer-events-none" />
                <Input
                  id="school_linkedin"
                  value={data.school_linkedin || ""}
                  onChange={(e) => onChange("school_linkedin", e.target.value)}
                  placeholder="https://linkedin.com/school/schoolpage"
                  className="h-10 text-sm pl-9 rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label htmlFor="school_description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              About the Institution
            </Label>
            <Textarea
              id="school_description"
              rows={4}
              value={data.school_description || ""}
              onChange={(e) => onChange("school_description", e.target.value)}
              placeholder="Provide a comprehensive summary of your institution's background, programs, and academic excellence..."
              className="text-sm rounded-xl resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="school_mission" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Institutional Mission
              </Label>
              <Textarea
                id="school_mission"
                rows={3}
                value={data.school_mission || ""}
                onChange={(e) => onChange("school_mission", e.target.value)}
                placeholder="Our mission is to foster transformative education..."
                className="text-sm rounded-xl resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="school_values" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Core Values & Philosophy
              </Label>
              <Textarea
                id="school_values"
                rows={3}
                value={data.school_values || ""}
                onChange={(e) => onChange("school_values", e.target.value)}
                placeholder="Integrity, Academic Excellence, Innovation, Community Service..."
                className="text-sm rounded-xl resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Crop Modal */}
      {cropModalState.isOpen && (
        <SchoolImageCropModal
          isOpen={cropModalState.isOpen}
          imageSrc={cropModalState.imageSrc}
          type={cropModalState.type}
          uploading={uploadingLogo || uploadingCover}
          onCancel={() => setCropModalState(prev => ({ ...prev, isOpen: false }))}
          onConfirm={handleCroppedUpload}
        />
      )}
    </div>
  );
}

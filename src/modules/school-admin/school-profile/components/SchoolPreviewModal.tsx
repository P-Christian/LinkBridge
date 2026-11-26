/* eslint-disable @next/next/no-img-element */
// src/modules/school-admin/school-profile/components/SchoolPreviewModal.tsx
"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  MapPin,
  Mail,
  Phone,
  Globe,
  Facebook,
  Linkedin,
  BookOpen,
  Users,
  Building2,
  ExternalLink,
  Target,
  Sparkles,
} from "lucide-react";
import { SchoolWithStats, VsSchool } from "@/modules/school-admin/types/school-admin.types";
import { formatSchoolAddress, sanitizeWebsiteUrl, getImageUrl } from "../services/school-profile.helpers";

interface SchoolPreviewModalProps {
  open: boolean;
  onClose: () => void;
  school: SchoolWithStats | Partial<VsSchool>;
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
  href?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
          {label}
        </p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-primary hover:underline flex items-center gap-1 truncate"
          >
            <span className="truncate">{value}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        ) : (
          <p className="text-sm font-medium text-foreground break-words">
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

export default function SchoolPreviewModal({
  open,
  onClose,
  school,
}: SchoolPreviewModalProps) {
  const address = formatSchoolAddress(school);
  const website = sanitizeWebsiteUrl(school.school_website);
  const facebook = sanitizeWebsiteUrl(school.school_facebook);
  const linkedin = sanitizeWebsiteUrl(school.school_linkedin);

  return (
    <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto p-0 border-l border-border bg-background"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Public School Profile Preview</SheetTitle>
        </SheetHeader>

        {/* Hero Cover Banner */}
        <div className="relative w-full h-48 sm:h-56 bg-muted overflow-hidden">
          {school.school_cover ? (
            <img
              src={getImageUrl(school.school_cover)}
              alt={school.school_name || "Campus Cover"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-r from-primary/20 via-primary/10 to-muted">
              <Building2 className="w-12 h-12 text-primary/40 mb-2" />
              <span className="text-xs font-semibold text-muted-foreground">Public Campus View</span>
            </div>
          )}

          <div className="absolute top-4 right-4 z-20">
            <Badge className="bg-background/80 text-foreground backdrop-blur-md border border-border shadow-xs text-xs font-bold">
              Public Preview
            </Badge>
          </div>
        </div>

        {/* Profile Card Header */}
        <div className="px-6 pb-6 relative -mt-12 sm:-mt-14 z-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-background bg-card shadow-lg flex items-center justify-center overflow-hidden shrink-0">
                {school.school_logo_url ? (
                  <img
                    src={getImageUrl(school.school_logo_url)}
                    alt={school.school_name || "Logo"}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <GraduationCap className="w-12 h-12 text-muted-foreground" />
                )}
              </div>

              <div className="space-y-1 mb-1 min-w-0">
                <h3 className="break-words text-xl font-black leading-tight tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-2xl">
                  {school.school_name || "Institution Name"}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="border-primary/40 text-primary font-bold text-[10px] px-2 py-0">
                    {school.school_type || "University"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{address}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Courses</p>
                <p className="text-base font-extrabold text-foreground">
                  {(school as SchoolWithStats).course_count ?? "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Students</p>
                <p className="text-base font-extrabold text-foreground">
                  {(school as SchoolWithStats).student_count ?? "—"}
                </p>
              </div>
            </div>
          </div>

          {/* About */}
          {school.school_description && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                About the Institution
              </h4>
              <p className="break-words text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                {school.school_description}
              </p>
            </div>
          )}

          {/* Mission & Values */}
          {(school.school_mission || school.school_values) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
              {school.school_mission && (
                <div className="min-w-0 space-y-1.5 p-4 rounded-xl bg-muted/40 border border-border">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <Target className="w-3.5 h-3.5" />
                    <span>Mission</span>
                  </div>
                  <p className="break-words text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {school.school_mission}
                  </p>
                </div>
              )}

              {school.school_values && (
                <div className="min-w-0 space-y-1.5 p-4 rounded-xl bg-muted/40 border border-border">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Core Values</span>
                  </div>
                  <p className="break-words text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {school.school_values}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Contact and Social Links */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Contact & Official Channels
            </h4>
            <div className="space-y-3">
              <InfoRow icon={Mail} label="Official Email" value={school.school_email} />
              <InfoRow icon={Phone} label="Contact Phone" value={school.school_contact_no} />
              <InfoRow icon={Globe} label="Official Website" value={school.school_website} href={website} />
              <InfoRow icon={Facebook} label="Facebook" value={school.school_facebook} href={facebook} />
              <InfoRow icon={Linkedin} label="LinkedIn" value={school.school_linkedin} href={linkedin} />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

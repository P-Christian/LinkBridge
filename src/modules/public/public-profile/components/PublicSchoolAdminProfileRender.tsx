"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  MapPin,
  Mail,
  Phone,
  Globe,
  Facebook,
  Linkedin,
  BookOpen,
  Building2,
  ExternalLink,
  Target,
  Sparkles,
  Info,
  Users,
  CheckCircle2,
  GraduationCap as CourseIcon,
} from "lucide-react";
import { PublicSchoolAdminProfile } from "../services/public-profile.service";

interface Props {
  profile: PublicSchoolAdminProfile;
  studentRosterContent?: React.ReactNode;
  studentCount?: number;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  headerAction?: React.ReactNode;
  containerClassName?: string;
  badgeText?: string;
}

function sanitizeWebsiteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
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
            className="text-sm font-semibold text-primary hover:underline inline-flex items-baseline gap-1 wrap-anywhere"
          >
            <span>{value}</span>
            <ExternalLink className="w-3 h-3 shrink-0 self-center" />
          </a>
        ) : (
          <p className="text-sm font-medium text-foreground wrap-anywhere">
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

export function PublicSchoolAdminProfileRender({
  profile,
  studentRosterContent,
  studentCount,
  activeTab,
  onTabChange,
  headerAction,
  containerClassName,
  badgeText,
}: Props) {
  const [internalTab, setInternalTab] = useState("about");
  const currentTab = activeTab ?? internalTab;
  const tabsNavRef = useRef<HTMLDivElement>(null);
  const handleTabChange = (tab: string) => {
    if (tabsNavRef.current) {
      const rect = tabsNavRef.current.getBoundingClientRect();
      if (rect.top <= 1) {
        tabsNavRef.current.scrollIntoView({ behavior: "instant", block: "start" });
      }
    }
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  const schoolName = profile.school_name || `${profile.user_fname} ${profile.user_lname}`;
  const schoolType = profile.school_type || "University";
  const coverUrl = profile.school_cover;
  const logoUrl = profile.school_logo_url || profile.avatar_url;
  const address = profile.school_address;

  const website = sanitizeWebsiteUrl(profile.school_website);
  const facebook = sanitizeWebsiteUrl(profile.social_links?.facebook);
  const linkedin = sanitizeWebsiteUrl(profile.social_links?.linkedin);

  const courses = profile.courses || [];

  return (
    <div className={cn("w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 font-sans", containerClassName)}>
      {/* ── Tier 1: School Header (Full-bleed Cover + Stats Bar) ── */}
      <div className="w-full bg-card border-b border-border">
        {/* Hero Cover Banner (100% full-width bleed) */}
        <div className="relative h-48 sm:h-64 md:h-80 w-full bg-muted overflow-hidden">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={schoolName}
              fill
              unoptimized
              priority
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-r from-primary/20 via-primary/10 to-muted">
              <Building2 className="w-12 h-12 text-primary/40 mb-2" />
              <span className="text-xs font-semibold text-muted-foreground">Campus Profile</span>
            </div>
          )}

          {badgeText && (
            <div className="absolute top-4 right-4 z-20">
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-0 text-xs font-semibold shadow-xs">
                {badgeText}
              </Badge>
            </div>
          )}
        </div>

        {/* School Summary Overlay Container */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Left: Avatar + Details */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              <div className="-mt-14 sm:-mt-18 relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-4 border-card bg-card shadow-md flex items-center justify-center overflow-hidden shrink-0 z-10">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={schoolName}
                    fill
                    unoptimized
                    className="w-full h-full object-contain p-1.5"
                  />
                ) : (
                  <GraduationCap className="w-12 h-12 text-muted-foreground" />
                )}
              </div>

              <div className="space-y-1.5 pt-2 sm:pt-3.5 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
                    {schoolName}
                  </h1>
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground font-medium flex items-center gap-1.5 flex-wrap">
                  <span>{schoolType}</span>
                  <span>·</span>
                  <span>{courses.length} {courses.length === 1 ? "Program" : "Programs"}</span>
                  {studentCount != null && (
                    <>
                      <span>·</span>
                      <span>{studentCount} Students</span>
                    </>
                  )}
                </p>

                {address && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 pt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>{address}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2.5 self-start md:self-center pt-2 sm:pt-3.5">
              {website && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-9 gap-1.5 rounded-xl border-border text-xs font-medium"
                >
                  <a href={website} target="_blank" rel="noopener noreferrer">
                    <Globe className="w-3.5 h-3.5" />
                    Website
                  </a>
                </Button>
              )}
              {headerAction}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tier 2: Sticky Full-width Underline Tab Navigation (CompanyTabNav style) ── */}
      <div
        ref={tabsNavRef}
        className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border shadow-2xs font-sans w-full"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-6 sm:space-x-8 overflow-x-auto scrollbar-none" aria-label="School sections">
            <button
              type="button"
              onClick={() => handleTabChange("about")}
              className={cn(
                "py-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer focus:outline-none",
                currentTab === "about"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Info className="h-4 w-4" />
              About
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("courses")}
              className={cn(
                "py-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer focus:outline-none",
                currentTab === "courses"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <BookOpen className="h-4 w-4" />
              Courses
              {courses.length > 0 && (
                <span
                  className={cn(
                    "px-1.5 py-0.2 text-[10px] font-bold rounded-full transition-colors",
                    currentTab === "courses"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {courses.length}
                </span>
              )}
            </button>

            {studentRosterContent && (
              <button
                type="button"
                onClick={() => handleTabChange("roster")}
                className={cn(
                  "py-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer focus:outline-none",
                  currentTab === "roster"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Users className="h-4 w-4" />
                Student Roster &amp; AI Match
                {studentCount != null && (
                  <span
                    className={cn(
                      "px-1.5 py-0.2 text-[10px] font-bold rounded-full transition-colors",
                      currentTab === "roster"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {studentCount}
                  </span>
                )}
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* ── Tier 3: Centered Tab Content Panels with Motion ── */}
      <motion.div
        layout
        transition={{
          layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
        }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full min-h-[calc(100vh-14rem)] min-h-[580px]"
      >

      {/* ── Tab Content Panels with Motion ── */}
      <AnimatePresence mode="wait">
        {currentTab === "about" && (
          <motion.div
            key="about"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left 2 Columns: Description + Mission/Values */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-border bg-card shadow-xs p-6 sm:p-7 space-y-3">
                <h2 className="text-base font-bold text-foreground">
                  About the Institution
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap wrap-anywhere">
                  {profile.school_description ||
                    "This educational institution has not provided an overview description yet."}
                </p>
              </div>

              {(profile.school_mission || profile.school_values) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {profile.school_mission && (
                    <div className="space-y-2 p-5 rounded-2xl bg-card border border-border shadow-xs">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                        <Target className="w-4 h-4" />
                        <span>Mission</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {profile.school_mission}
                      </p>
                    </div>
                  )}

                  {profile.school_values && (
                    <div className="space-y-2 p-5 rounded-2xl bg-card border border-border shadow-xs">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                        <Sparkles className="w-4 h-4" />
                        <span>Core Values</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {profile.school_values}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Institution Information (matching Company Information in Image 1) */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-card shadow-xs p-6 space-y-5">
                <h3 className="text-base font-bold text-foreground">
                  Institution Information
                </h3>
                <div className="space-y-4">
                  <InfoRow
                    icon={Building2}
                    label="INSTITUTION TYPE"
                    value={schoolType}
                  />
                  <InfoRow
                    icon={Mail}
                    label="OFFICIAL EMAIL"
                    value={profile.school_email || profile.user_email}
                    href={`mailto:${profile.school_email || profile.user_email}`}
                  />
                  {profile.school_contact_no && (
                    <InfoRow
                      icon={Phone}
                      label="CONTACT PHONE"
                      value={profile.school_contact_no}
                      href={`tel:${profile.school_contact_no}`}
                    />
                  )}
                  {website && (
                    <InfoRow
                      icon={Globe}
                      label="OFFICIAL WEBSITE"
                      value={profile.school_website?.replace(/^https?:\/\/(www\.)?/, "")}
                      href={website}
                    />
                  )}
                  {address && (
                    <InfoRow
                      icon={MapPin}
                      label="CAMPUS ADDRESS"
                      value={address}
                    />
                  )}
                  {facebook && (
                    <InfoRow
                      icon={Facebook}
                      label="FACEBOOK"
                      value="Facebook Page"
                      href={facebook}
                    />
                  )}
                  {linkedin && (
                    <InfoRow
                      icon={Linkedin}
                      label="LINKEDIN"
                      value="LinkedIn Profile"
                      href={linkedin}
                    />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {currentTab === "courses" && (
          <motion.div
            key="courses"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-border bg-card shadow-xs p-6 sm:p-7 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Available Courses</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Academic degree and certificate programs offered</p>
              </div>
              <Badge variant="outline" className="text-xs font-semibold">
                {courses.length} {courses.length === 1 ? "Program" : "Programs"}
              </Badge>
            </div>

            {courses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {courses.map((course, index) => (
                  <motion.div
                    key={course.school_course_id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: Math.min(index * 0.03, 0.25),
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    whileHover={{ y: -2 }}
                    className="p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 hover:border-primary/20 transition-all flex items-start gap-3.5 shadow-xs"
                  >
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <CourseIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-bold text-foreground leading-snug break-words">
                        {course.course_name}
                      </p>
                      {course.course_code && (
                        <Badge variant="secondary" className="text-[10px] font-mono px-2 py-0">
                          {course.course_code}
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center space-y-2">
                <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-medium text-muted-foreground">No active courses listed for this institution yet.</p>
              </div>
            )}
          </motion.div>
        )}

        {currentTab === "roster" && studentRosterContent && (
          <motion.div
            key="roster"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            {studentRosterContent}
          </motion.div>
        )}
      </AnimatePresence>
      </motion.div>
    </div>
  );
}

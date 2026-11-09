// src/modules/client/applicants/components/ApplicantDetailsModal.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Clock,
  ExternalLink,
  GraduationCap,
  Wallet,
  CalendarPlus,
  CalendarDays,
  AlertCircle,
  Download,
  NotebookText,
  BadgeQuestionMark,
  AwardIcon,
  Star,
  LetterText,
  User2,
  Contact,
  Eye,
  DownloadIcon,
  Globe,
  Sparkles,
  MessageSquare,
  FileText,
  Copy,
  Check,
  Gauge,
} from "lucide-react";
import dynamic from "next/dynamic";
import AssessmentReviewSection from "@/modules/client/assessment-review/components/AssessmentReviewSection";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ApplicantAiAnalysisModal } from "./ApplicantAiAnalysisModal";
import {
  getCachedApplicantAnalysis,
  setCachedApplicantAnalysis,
  CandidateAiAnalysis,
} from "../utils/applicantAiCache";
import {
  faFacebook,
  faLinkedin,
  faInstagram,
  faYoutube,
  faXTwitter,
  faGithub,
} from "@fortawesome/free-brands-svg-icons";
import { faGlobe } from "@fortawesome/free-solid-svg-icons";
import { cn, copyToClipboard } from "@/lib/utils";
import { Applicant, ApplicationStatus, CandidateDetail, STATUS_LABELS } from "../types";
import { STAGE_COLOR_CLASSES } from "@/modules/client/pipeline/types";
import {
  getApplicantAvatarUrl,
  getInitials,
  formatDate,
  formatDateRange,
  formatCurrency,
  timeAgo,
} from "../utils/applicantUtils";

const DocumentViewer = dynamic(
  () => import("@/components/DocumentViewer").then((mod) => mod.DocumentViewer),
  { ssr: false }
);

/* ────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────── */

interface ParsedCoverLetter {
  text: string;
  document?: {
    fileName: string;
    fileUrl: string;
  } | null;
}

function parseCoverLetter(raw?: string | null): ParsedCoverLetter {
  if (!raw) return { text: "" };
  const linkRegex = /\[(?:Cover Letter Document:\s*)?([^\]]+)\]\(([^)]+)\)/i;
  const match = raw.match(linkRegex);
  if (match) {
    const fileName = match[1].trim();
    let fileUrl = match[2].trim();
    const assetsMatch = fileUrl.match(/\/assets\/([a-zA-Z0-9-]+)/);
    if (assetsMatch?.[1]) {
      fileUrl = `/api/client/assets/${assetsMatch[1]}`;
    }
    const text = raw.replace(match[0], "").trim();
    return { text, document: { fileName, fileUrl } };
  }
  return { text: raw.trim() };
}

function formatSocialHandle(url?: string | null): string {
  if (!url) return "";
  const clean = url.trim().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const parts = clean.split("/").filter(Boolean);
  if (parts.length > 1) {
    return parts[parts.length - 1];
  }
  return clean.replace(/^\//, "");
}

function getSocialIcon(platformStr?: string | null, urlStr?: string | null) {
  const p = (platformStr || "").toLowerCase();
  const u = (urlStr || "").toLowerCase();

  if (p.includes("facebook") || u.includes("facebook.com") || u.includes("fb.com")) {
    return { icon: faFacebook, color: "text-[#1877F2]" };
  }
  if (p.includes("linkedin") || u.includes("linkedin.com")) {
    return { icon: faLinkedin, color: "text-[#0A66C2]" };
  }
  if (p.includes("instagram") || u.includes("instagram.com") || u.includes("instagr.am")) {
    return { icon: faInstagram, color: "text-[#E4405F]" };
  }
  if (p.includes("youtube") || u.includes("youtube.com") || u.includes("youtu.be")) {
    return { icon: faYoutube, color: "text-[#FF0000]" };
  }
  if (p.includes("twitter") || p.includes("x.com") || p === "x" || u.includes("twitter.com") || u.includes("x.com")) {
    return { icon: faXTwitter, color: "text-foreground" };
  }
  if (p.includes("github") || u.includes("github.com")) {
    return { icon: faGithub, color: "text-foreground" };
  }
  return { icon: faGlobe, color: "text-primary" };
}

function ensureHttp(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  APPLIED: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400",
  UNDER_REVIEW: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400",
  SHORTLISTED: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400",
  INTERVIEWING: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400",
  HIRED: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400",
  REJECTED: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400",
  WITHDRAWN: "bg-muted text-muted-foreground border-border",
};

/* ────────────────────────────────────────────────────────────
 * Small building blocks
 * ──────────────────────────────────────────────────────────── */

function AnimatedSection({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  count,
  children,
  className,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border/80 bg-card p-4 shadow-sm", className)}>
      <header className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        <span>{title}</span>
        {typeof count === "number" && count > 0 && (
          <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none text-foreground/70">
            {count}
          </span>
        )}
      </header>
      <div className="text-sm text-foreground">{children}</div>
    </section>
  );
}

function QuickFact({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-[140px] shrink-0 items-center gap-2.5 rounded-lg border border-border/70 bg-background px-3 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="truncate text-sm font-semibold text-foreground">{children}</div>
      </div>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(value);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied" : `Copy ${label}`}
      aria-label={`Copy ${label}`}
      className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground max-md:h-9 max-md:w-9"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function DocRow({
  fileName,
  subtitle,
  fileUrl,
  downloadLabel,
  onPreview,
}: {
  fileName: string;
  subtitle: string;
  fileUrl: string;
  downloadLabel: string;
  onPreview: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPreview}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/60 max-md:min-h-12"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <FileText className="h-4 w-4 text-primary" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-foreground md:text-xs">{fileName}</span>
          <span className="text-xs font-normal text-muted-foreground md:text-[10px]">{subtitle}</span>
        </span>
        <Eye className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </button>
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted"
        title={downloadLabel}
        aria-label={downloadLabel}
      >
        <DownloadIcon className="h-4 w-4" />
      </a>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-center">
      <p className="text-sm font-medium text-muted-foreground md:text-xs">{children}</p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Main component
 * ──────────────────────────────────────────────────────────── */

interface ApplicantDetailsModalProps {
  applicant: Applicant | null;
  detail: CandidateDetail | null;
  loading: boolean;
  error: string;
  open: boolean;
  onClose: () => void;
  onUpdateStatus: () => void;
  onScheduleInterview: () => void;
}

export default function ApplicantDetailsModal({
  applicant,
  detail,
  loading,
  error,
  open,
  onClose,
  onUpdateStatus,
  onScheduleInterview,
}: ApplicantDetailsModalProps) {
  const [loadedAvatarUrl, setLoadedAvatarUrl] = useState<string | null>(null);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileUrl: string } | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [cachedAnalysis, setCachedAnalysis] = useState<CandidateAiAnalysis | null>(null);
  const [coverExpanded, setCoverExpanded] = useState(false);

  const activeApplicant: Applicant | null = applicant || (detail ? {
    application_id: detail.application_id,
    user_id: detail.user_id,
    job_id: detail.job_id,
    job_title: detail.job_title,
    applicant_name: detail.applicant_name,
    applicant_email: detail.applicant_email,
    profile_image_url: detail.profile_image,
    application_status: detail.application_status,
    applied_at: detail.applied_at,
    experience_years: detail.experience_years,
    work_experience_count: detail.work_experience_count,
    resume_count: detail.resume_count,
    skills: detail.skills,
  } as Applicant : null);

  const rawImage = detail?.profile_image ?? activeApplicant?.applicant_profile_image_url ?? activeApplicant?.profile_image_url;
  const avatarUrl = getApplicantAvatarUrl(rawImage);
  // Tracked per-URL so switching applicants never shows a stale loaded/failed state.
  const imageLoaded = !!avatarUrl && loadedAvatarUrl === avatarUrl;
  const imageError = !!avatarUrl && failedAvatarUrl === avatarUrl;

  const coverLetter = useMemo(() => parseCoverLetter(detail?.cover_letter), [detail?.cover_letter]);

  useEffect(() => {
    const appId = activeApplicant?.application_id || detail?.application_id;
    if (!appId || !open) {
      queueMicrotask(() => {
        setCachedAnalysis(null);
      });
      return;
    }

    // 1. Instant check from local cache
    let isMounted = true;
    getCachedApplicantAnalysis(appId).then((cached) => {
      if (!isMounted) return;
      if (cached) {
        setCachedAnalysis(cached);
        return; // Cache hit: skip redundant background DB fetch & re-encryption
      }

      // 2. Cache miss: Query DB to verify if evaluation exists for this exact application_id
      fetch(`/api/client/applicants/${appId}/ai-analysis`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (isMounted) {
            if (data?.success && data.analysis) {
              setCachedAnalysis(data.analysis);
              void setCachedApplicantAnalysis(appId, data.analysis);
            } else {
              setCachedAnalysis(null);
            }
          }
        })
        .catch(() => {
          if (isMounted) setCachedAnalysis(null);
        });
    });

    return () => {
      isMounted = false;
    };
  }, [activeApplicant?.application_id, detail?.application_id, aiModalOpen, open]);

  if (!activeApplicant && !loading) return null;

  const name = activeApplicant?.applicant_name ?? (detail?.application_id ? `Applicant #${detail.application_id}` : "Applicant Details");
  const status: ApplicationStatus = detail?.application_status ?? activeApplicant?.application_status ?? "APPLIED";
  const stageName = detail?.stage_name || activeApplicant?.stage_name || STATUS_LABELS[status] || status;
  const stageColor = detail?.stage_color || activeApplicant?.stage_color || "sky";
  const stageBadgeClasses = STAGE_COLOR_CLASSES[stageColor]?.badge || STATUS_STYLES[status] || STATUS_STYLES.APPLIED;

  const jobTitle = detail?.job_title ?? activeApplicant?.job_title ?? "—";
  const appliedAt = detail?.applied_at ?? activeApplicant?.applied_at;
  const expectedSalary = formatCurrency(detail?.expected_salary ?? null);

  const isTerminal =
    detail?.stage_type === "HIRED" ||
    detail?.stage_type === "REJECTED" ||
    detail?.stage_type === "WITHDRAWN" ||
    (!detail?.stage_type && (status === "HIRED" || status === "REJECTED" || status === "WITHDRAWN"));

  const isInterviewEligible =
    detail?.stage_type === "INTERVIEW" ||
    (!detail?.stage_type && (status === "INTERVIEWING" || status === "SHORTLISTED"));

  const isAssessmentStage =
    detail?.stage_type === "ASSESSMENT" ||
    (!detail?.stage_type && activeApplicant?.stage_type === "ASSESSMENT");

  const initials = getInitials(name);
  const profileCompletion = Math.min(100, Math.max(0, detail?.profile_completion ?? activeApplicant?.profile_completion ?? 0));
  const experienceYears = detail?.experience_years ?? activeApplicant?.experience_years ?? 0;
  const applicationId = activeApplicant?.application_id ?? detail?.application_id;

  const resumes = detail?.resumes ?? [];
  const hasCoverLetter = !!(coverLetter.text || coverLetter.document);
  const hasDocuments = resumes.length > 0 || hasCoverLetter;
  const coverIsLong = coverLetter.text.length > 420;

  const socialLinks = detail?.social_links ?? [];
  const screeningAnswers = detail?.screening_answers ?? [];
  const education = detail?.education ?? [];
  const skills = detail?.skills ?? [];
  const workExperience = detail?.work_experience ?? [];
  const certifications = detail?.certifications ?? [];

  const interviewId = detail?.active_interview_id || activeApplicant?.active_interview_id;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent showCloseButton={false} className="w-[95vw] !max-w-[1300px] h-[90vh] p-0 overflow-hidden flex flex-col border-border/80 bg-background max-md:max-w-[calc(100vw-2rem)] max-md:max-h-[90dvh]">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border bg-card/90 backdrop-blur-md px-6 py-4">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                {/* Avatar with image and fallback */}
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted shadow-sm">
                  {avatarUrl && !imageError ? (
                    <Image
                      key={avatarUrl}
                      src={avatarUrl}
                      alt={name}
                      width={56}
                      height={56}
                      onLoad={() => setLoadedAvatarUrl(avatarUrl)}
                      onError={() => setFailedAvatarUrl(avatarUrl)}
                      className={cn(
                        "h-full w-full object-cover transition-opacity duration-300",
                        imageLoaded ? "opacity-100" : "opacity-0"
                      )}
                    />
                  ) : null}

                  {(!avatarUrl || !imageLoaded || imageError) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/80 to-primary text-base font-bold text-primary-foreground">
                      {initials}
                    </div>
                  )}
                </div>

                {/* Candidate title & meta */}
                <div className="min-w-0 flex-1">
                  <DialogTitle className="flex flex-wrap items-center gap-2.5 text-lg font-bold text-foreground">
                    <span className="truncate">{name}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-semibold md:text-[10px]",
                        stageBadgeClasses
                      )}
                    >
                      {stageName}
                    </Badge>
                  </DialogTitle>

                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground md:text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                      <Briefcase className="h-3.5 w-3.5 text-muted-foreground/70" />
                      Applied for {jobTitle}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                      {timeAgo(appliedAt)}
                    </span>
                    {detail?.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />
                        {detail.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>


            </div>
          </DialogHeader>
        </div>

        {/* ── Quick-facts strip ──────────────────────────────── */}
        {detail && (
          <div className="shrink-0 border-b border-border bg-muted/30 px-6 py-3">
            <div className="flex gap-2.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
              <QuickFact icon={Briefcase} label="Experience">
                {experienceYears} {experienceYears === 1 ? "yr" : "yrs"}
              </QuickFact>
              <QuickFact icon={Wallet} label="Expected salary">
                {expectedSalary || "Not specified"}
              </QuickFact>
              <QuickFact icon={CalendarDays} label="Applied on">
                {appliedAt ? formatDate(appliedAt) || "—" : "—"}
              </QuickFact>
              <div className="flex min-w-[170px] shrink-0 items-center gap-2.5 rounded-lg border border-border/70 bg-background px-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Gauge className="h-4 w-4 text-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Profile</p>
                    <span className="text-sm font-semibold text-foreground">{profileCompletion}%</span>
                  </div>
                  <div
                    className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={profileCompletion}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Profile completion"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${profileCompletion}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Scrollable content ───────────────────────────────
            wrap-anywhere (overflow-wrap: anywhere) is inherited by every text
            node below, so one unbreakable token wraps inside its card instead of
            painting past it. (Tailwind 4 renamed break-anywhere -> wrap-anywhere.) */}
        <div className="flex-1 overflow-y-auto scroll-smooth bg-muted/20 p-6 wrap-anywhere [scrollbar-gutter:stable]">
          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive md:text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {loading && !detail ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-5 lg:col-span-7">
                {[28, 40, 52].map((h, i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-border/60 bg-card" style={{ height: h * 4 }} />
                ))}
              </div>
              <div className="space-y-5 lg:col-span-5">
                {[36, 44].map((h, i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-border/60 bg-card" style={{ height: h * 4 }} />
                ))}
              </div>
            </div>
          ) : detail ? (
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
              {/* ── Main column: candidate background ───────── */}
              <div className="space-y-5 lg:col-span-7">
                {/* Professional summary */}
                {(detail.profile_headline || detail.professional_summary) && (
                  <AnimatedSection delay={0.03}>
                    <SectionCard icon={User2} title="Professional Summary">
                      {detail.profile_headline && (
                        <h4 className="text-sm font-semibold text-foreground">{detail.profile_headline}</h4>
                      )}
                      {detail.professional_summary && (
                        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground md:text-xs">
                          {detail.professional_summary}
                        </p>
                      )}
                    </SectionCard>
                  </AnimatedSection>
                )}

                {/* Skills — surfaced early for quick screening */}
                {skills.length > 0 && (
                  <AnimatedSection delay={0.06}>
                    <SectionCard icon={Star} title="Skills" count={skills.length}>
                      <div className="flex flex-wrap gap-1.5">
                        {skills.map((skill) => (
                          <Badge
                            key={skill}
                            variant="secondary"
                            className="rounded-md border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-foreground"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </SectionCard>
                  </AnimatedSection>
                )}

                {/* Application documents (resume + cover letter in one place) */}
                {hasDocuments && (
                  <AnimatedSection delay={0.09}>
                    <SectionCard
                      icon={FileText}
                      title="Application Documents"
                      count={resumes.length + (coverLetter.document ? 1 : 0)}
                    >
                      <div className="space-y-4">
                        {resumes.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Resumé
                            </p>
                            {resumes.map((resume, idx) => (
                              <DocRow
                                key={resume.file_url || idx}
                                fileName={resume.file_name || "Resume.pdf"}
                                subtitle="Click to preview"
                                fileUrl={resume.file_url}
                                downloadLabel="Download resume"
                                onPreview={() =>
                                  setPreviewDoc({ fileName: resume.file_name || "Resume.pdf", fileUrl: resume.file_url })
                                }
                              />
                            ))}
                          </div>
                        )}

                        {hasCoverLetter && (
                          <div className={cn("space-y-2", resumes.length > 0 && "border-t border-border/60 pt-4")}>
                            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              <LetterText className="h-3.5 w-3.5" />
                              Cover Letter
                            </p>
                            {coverLetter.text && (
                              <div>
                                <p
                                  className={cn(
                                    "whitespace-pre-line text-sm leading-relaxed text-muted-foreground md:text-xs",
                                    coverIsLong && !coverExpanded && "line-clamp-6"
                                  )}
                                >
                                  {coverLetter.text}
                                </p>
                                {coverIsLong && (
                                  <button
                                    type="button"
                                    onClick={() => setCoverExpanded((v) => !v)}
                                    className="mt-1.5 text-xs font-semibold text-primary hover:underline max-md:min-h-10"
                                  >
                                    {coverExpanded ? "Show less" : "Read full letter"}
                                  </button>
                                )}
                              </div>
                            )}
                            {coverLetter.document && (
                              <DocRow
                                fileName={coverLetter.document.fileName}
                                subtitle="Cover letter document"
                                fileUrl={coverLetter.document.fileUrl}
                                downloadLabel="Download cover letter"
                                onPreview={() => setPreviewDoc(coverLetter.document!)}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </SectionCard>
                  </AnimatedSection>
                )}

                {/* Work experience */}
                {workExperience.length > 0 && (
                  <AnimatedSection delay={0.12}>
                    <SectionCard icon={Briefcase} title="Work Experience" count={workExperience.length}>
                      <div className="space-y-4">
                        {workExperience.map((exp) => (
                          <div key={exp.id} className="border-l-2 border-primary/40 py-0.5 pl-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground md:text-xs">
                                {exp.job_title}
                                {exp.is_current_role && (
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400"
                                  >
                                    Current
                                  </Badge>
                                )}
                              </h4>
                              <span className="text-xs text-muted-foreground md:text-[11px]">
                                {formatDateRange(exp.start_date, exp.end_date, exp.is_current_role)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-sm font-medium text-muted-foreground md:text-xs">
                              {exp.company_name}
                              {exp.location ? ` • ${exp.location}` : ""}
                            </p>
                            {exp.job_description && (
                              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground md:text-xs">
                                {exp.job_description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  </AnimatedSection>
                )}

                {/* Education */}
                {education.length > 0 && (
                  <AnimatedSection delay={0.15}>
                    <SectionCard icon={GraduationCap} title="Education" count={education.length}>
                      <div className="space-y-3">
                        {education.map((edu) => (
                          <div key={edu.id} data-education-id={edu.id} className="border-l-2 border-border py-0.5 pl-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-sm font-semibold text-foreground md:text-xs">{edu.school_name}</h4>
                              <Badge variant="outline" className="px-2 py-0 text-xs font-medium md:text-[10px]">
                                {edu.status}
                              </Badge>
                            </div>
                            {edu.course_name && (
                              <p className="mt-0.5 text-sm text-muted-foreground md:text-xs">{edu.course_name}</p>
                            )}
                            {(edu.start_date || edu.end_date) && (
                              <p className="mt-1 text-xs text-muted-foreground md:text-[11px]">
                                {formatDateRange(edu.start_date, edu.end_date)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  </AnimatedSection>
                )}

                {/* Certifications */}
                {certifications.length > 0 && (
                  <AnimatedSection delay={0.18}>
                    <SectionCard icon={AwardIcon} title="Certifications" count={certifications.length}>
                      <div className="space-y-2.5">
                        {certifications.map((cert) => (
                          <div
                            key={cert.id}
                            className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0"
                          >
                            <div>
                              <p className="text-sm font-semibold text-foreground md:text-xs">{cert.certificate_name}</p>
                              <p className="mt-0.5 text-sm text-muted-foreground md:text-xs">
                                {cert.issuing_organization}
                                {formatDate(cert.issue_date) ? ` • ${formatDate(cert.issue_date)}` : ""}
                              </p>
                            </div>
                            {cert.credential_url && (
                              <a
                                href={cert.credential_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline max-md:min-h-10 md:text-xs"
                              >
                                View <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  </AnimatedSection>
                )}
              </div>

              {/* ── Sidebar: evaluation & contact ───────────── */}
              <div className="space-y-5 lg:col-span-5">
                {/* AI analysis callout */}
                <AnimatedSection delay={0.03}>
                  <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-foreground">AI Candidate Analysis</h4>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {cachedAnalysis
                            ? "An evaluation of this candidate against the job is ready."
                            : "Get a quick fit assessment of this candidate against the job requirements."}
                        </p>
                        <Button
                          size="sm"
                          variant={cachedAnalysis ? "outline" : "default"}
                          onClick={() => setAiModalOpen(true)}
                          className="mt-3 gap-1.5 font-semibold max-md:min-h-10"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {cachedAnalysis ? "View analysis" : "Generate analysis"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </AnimatedSection>

                {/* Referral & institutional endorsement */}
                {detail.is_referred && (
                  <AnimatedSection delay={0.06}>
                    <div className="space-y-3 rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/15">
                          <GraduationCap className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-purple-700 dark:text-purple-300">
                            {detail.referral_type === "SCHOOL_ADMIN"
                              ? "Official Academic Endorsement"
                              : "Verified Peer Referral"}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {detail.referral_school_name
                              ? `Endorsed by ${detail.referral_school_name}${detail.referrer_name ? ` (${detail.referrer_name})` : ""}`
                              : detail.referrer_name
                                ? `Referred by ${detail.referrer_name}`
                                : "Referred candidate on LinkBridge"}
                          </p>
                        </div>
                      </div>

                      {detail.referral_letter && (
                        <div className="whitespace-pre-wrap rounded-lg border border-purple-200/60 bg-background/80 p-3 text-xs leading-relaxed text-foreground dark:border-purple-900/50">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                            Recommendation Letter
                          </p>
                          {detail.referral_letter}
                        </div>
                      )}
                    </div>
                  </AnimatedSection>
                )}

                {/* Contact & links (email, phone, location, portfolio, socials — all in one) */}
                <AnimatedSection delay={0.09}>
                  <SectionCard icon={Contact} title="Contact & Links">
                    <div className="space-y-1.5 text-sm md:text-xs">
                      <div className="flex items-center gap-2.5">
                        <Mail className="h-4 w-4 shrink-0 text-primary" />
                        {detail.applicant_email ? (
                          <>
                            <a
                              href={`mailto:${detail.applicant_email}`}
                              className="min-w-0 break-all font-medium hover:text-primary hover:underline"
                            >
                              {detail.applicant_email}
                            </a>
                            <CopyButton value={detail.applicant_email} label="email" />
                          </>
                        ) : (
                          <span className="font-medium">—</span>
                        )}
                      </div>

                      {detail.applicant_phone && (
                        <div className="flex items-center gap-2.5">
                          <Phone className="h-4 w-4 shrink-0 text-primary" />
                          <a
                            href={`tel:${detail.applicant_phone}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {detail.applicant_phone}
                          </a>
                          <CopyButton value={detail.applicant_phone} label="phone number" />
                        </div>
                      )}

                      {detail.location && (
                        <div className="flex items-center gap-2.5 py-1">
                          <MapPin className="h-4 w-4 shrink-0 text-primary" />
                          <span className="font-medium">{detail.location}</span>
                        </div>
                      )}

                      {detail.portfolio_url && (
                        <div className="flex items-center gap-2.5 py-1">
                          <Globe className="h-4 w-4 shrink-0 text-primary" />
                          <a
                            href={ensureHttp(detail.portfolio_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-w-0 items-center gap-1 font-medium text-primary hover:underline"
                          >
                            <span className="truncate">{detail.portfolio_url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </div>
                      )}
                    </div>

                    {socialLinks.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                        {socialLinks.map((link, index) => {
                          const platformStr = link.platform || link.platform_name || "";
                          const urlStr = link.profile_url || link.url || "";
                          if (!urlStr) return null;
                          const iconInfo = getSocialIcon(platformStr, urlStr);
                          const displayHandle = formatSocialHandle(urlStr);
                          const isPortfolio = platformStr.toLowerCase().includes("portfolio");
                          const chipLabel = isPortfolio ? "Portfolio Website" : displayHandle || platformStr || "Link";

                          return (
                            <a
                              key={index}
                              href={ensureHttp(urlStr)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-all hover:border-primary max-md:min-h-10"
                            >
                              <FontAwesomeIcon icon={iconInfo.icon} className={cn("h-3.5 w-3.5", iconInfo.color)} />
                              <span className="max-w-[140px] truncate text-xs md:text-[11px]">{chipLabel}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </SectionCard>
                </AnimatedSection>

                {/* Screening answers */}
                <AnimatedSection delay={0.12}>
                  <SectionCard icon={BadgeQuestionMark} title="Screening Answers" count={screeningAnswers.length}>
                    {screeningAnswers.length > 0 ? (
                      <div className="space-y-2.5">
                        {screeningAnswers.map((item, idx) => (
                          <div key={item.question_id} className="rounded-lg border border-border/60 bg-background/50 p-3">
                            <p className="flex gap-2 text-sm font-semibold text-foreground/80 md:text-xs">
                              <span className="text-primary">Q{idx + 1}.</span>
                              <span>{item.question_text}</span>
                            </p>
                            {item.answer_text?.trim() ? (
                              <p className="mt-1.5 whitespace-pre-line border-l-2 border-primary/40 pl-3 text-sm font-medium text-foreground md:text-xs">
                                {item.answer_text}
                              </p>
                            ) : (
                              <p className="mt-1.5 pl-3 text-sm italic text-muted-foreground md:text-xs">
                                No answer provided
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyHint>No screening answers submitted</EmptyHint>
                    )}
                  </SectionCard>
                </AnimatedSection>

                {/* Assessment review (employer) */}
                {applicationId && (
                  <AnimatedSection delay={0.15}>
                    <AssessmentReviewSection applicationId={Number(applicationId)} />
                  </AnimatedSection>
                )}

                {/* Client notes */}
                {detail.client_notes && (
                  <AnimatedSection delay={0.18}>
                    <SectionCard icon={NotebookText} title="Your Notes">
                      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90 md:text-xs">
                        {detail.client_notes}
                      </p>
                    </SectionCard>
                  </AnimatedSection>
                )}
              </div>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No additional details available.
            </p>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <DialogFooter className="sticky bottom-0 z-20 flex shrink-0 flex-row items-center justify-between gap-2.5 border-t border-border bg-card/90 px-6 py-3.5 backdrop-blur-md max-md:flex-col-reverse max-md:items-stretch">


          <div className="flex flex-row items-center gap-2.5 max-md:flex-col max-md:items-stretch">
            <Button asChild variant="outline" className="gap-1.5 border-border font-medium hover:bg-muted max-md:min-h-10 max-md:w-full">
              <Link href={`/linkbridge/client/messaging?freelancer_id=${activeApplicant?.user_id ?? ""}&job_id=${activeApplicant?.job_id ?? ""}`}>
                <MessageSquare className="h-4 w-4 text-primary" />
                Message
              </Link>
            </Button>

            {!isTerminal && !isAssessmentStage && (
              <Button variant="outline" onClick={onUpdateStatus} className="border-border max-md:min-h-10 max-md:w-full">
                Update Stage
              </Button>
            )}

            {isInterviewEligible &&
              (interviewId ? (
                <Button asChild variant="outline" className="gap-1.5 border-border font-medium hover:bg-muted max-md:min-h-10 max-md:w-full">
                  <Link href="/linkbridge/client/interviews">
                    <CalendarPlus className="h-4 w-4 text-primary" />
                    View Interview
                  </Link>
                </Button>
              ) : (
                <Button
                  onClick={onScheduleInterview}
                  className="gap-1.5 bg-primary font-medium text-primary-foreground hover:bg-primary/90 max-md:min-h-10 max-md:w-full"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Schedule Interview
                </Button>
              ))}
            <Button variant="ghost" onClick={onClose} className="max-md:min-h-10 max-md:w-full">
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* AI Candidate Evaluation Modal */}
      <ApplicantAiAnalysisModal
        open={aiModalOpen}
        onOpenChange={setAiModalOpen}
        applicant={detail}
      />

      {/* Nested Document Preview Modal */}
      <Dialog open={!!previewDoc} onOpenChange={(openState) => !openState && setPreviewDoc(null)}>
        <DialogContent showCloseButton={false} className="!w-[96vw] !max-w-[1600px] sm:!max-w-[1600px] !h-[92vh] max-md:max-h-[90dvh] p-0 flex flex-col z-[100] gap-0 overflow-hidden border-border bg-background">
          <DialogHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 border-b border-border bg-card px-6 py-3.5">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-4">
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <DialogTitle className="truncate text-sm font-bold">
                {previewDoc?.fileName || "Document Preview"}
              </DialogTitle>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {previewDoc?.fileUrl && (
                <>
                  <a
                    href={previewDoc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted max-md:min-h-10 md:text-xs"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Original
                  </a>
                  <a
                    href={previewDoc.fileUrl}
                    download={previewDoc.fileName}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 max-md:min-h-10 md:text-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewDoc(null)}
                className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </Button>
            </div>
          </DialogHeader>
          <div className="relative flex-1 overflow-hidden bg-muted/40">
            {previewDoc?.fileUrl && (
              <DocumentViewer
                fileUrl={previewDoc.fileUrl}
                fileName={previewDoc.fileName}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
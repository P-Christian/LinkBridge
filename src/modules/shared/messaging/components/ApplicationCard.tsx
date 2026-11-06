"use client";

// src/modules/shared/messaging/components/ApplicationCard.tsx

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Briefcase,
  CalendarDays,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Mail,
  Phone,
  UserRound,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
} from "lucide-react";
import { Message, HiringViewerRole } from "@/modules/client/messaging/types";
import SystemPill from "./SystemPill";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DocumentViewer = dynamic(
  () => import("@/components/DocumentViewer").then((mod) => mod.DocumentViewer),
  { ssr: false }
);

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
      fileUrl = `/api/assets/${assetsMatch[1]}`;
    }
    const text = raw.replace(match[0], "").trim();
    return { text, document: { fileName, fileUrl } };
  }
  return { text: raw.trim() };
}

interface ApplicationCardApplicant {
  user_id?: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  resume?: { file_name: string; file_path: string } | null;
  social_links?: Array<{ platform_name: string; url: string }>;
}

interface ApplicationCardJob {
  job_id?: number | null;
  title: string;
  salary_min?: number | null;
  salary_max?: number | null;
}

interface ApplicationCardApplication {
  status: string;
  expected_salary?: number | null;
  cover_letter?: string | null;
  portfolio_url?: string | null;
  applied_at?: string | null;
  updated_at?: string | null;
}

interface ApplicationCardData {
  event_type: string;
  application_id: number;
  viewer_role?: HiringViewerRole;

  // Domain Entity Projection
  applicant?: ApplicationCardApplicant;
  job?: ApplicationCardJob;
  application?: ApplicationCardApplication;

  // Flat fallback properties
  application_status?: string;
  applied_at?: string | null;
  updated_at?: string | null;
  status_updated_at?: string | null;
  expected_salary?: number | null;
  cover_letter?: string | null;
  portfolio_url?: string | null;
  applicant_name?: string;
  applicant_avatar?: string | null;
  applicant_email?: string | null;
  applicant_phone?: string | null;
  job_title?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  resume?: { file_name: string; file_path: string } | null;
  social_links?: Array<{ platform_name: string; url: string }>;
}

interface Props {
  message: Message;
}

interface EventMeta {
  icon: string;
  getLabel: (isCandidate: boolean) => string;
  accent: string;
  getHeadline: (isCandidate: boolean, applicantName: string, jobTitle: string) => React.ReactNode;
}

const EVENT_METAS: Record<string, EventMeta> = {
  APPLICATION_SUBMITTED: {
    icon: "📋",
    getLabel: (isCandidate) => (isCandidate ? "Application Submitted" : "New Application"),
    accent: "bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-200/60 dark:border-indigo-800/40",
    getHeadline: (isCandidate, applicantName, jobTitle) =>
      isCandidate ? (
        <span>
          You applied for <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{jobTitle}</strong>
        </span>
      ) : (
        <span>
          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{applicantName}</strong> applied for{" "}
          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{jobTitle}</strong>
        </span>
      ),
  },
  APPLICATION_STATUS_CHANGED: {
    icon: "🔄",
    getLabel: () => "Application Updated",
    accent: "bg-amber-50/90 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/40",
    getHeadline: (isCandidate, applicantName, jobTitle) =>
      isCandidate ? (
        <span>
          Application update for <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{jobTitle}</strong>
        </span>
      ) : (
        <span>
          Application update for <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{applicantName}</strong> &bull; {jobTitle}
        </span>
      ),
  },
  HIRED: {
    icon: "🎉",
    getLabel: (isCandidate) => (isCandidate ? "You Were Hired" : "Candidate Hired"),
    accent: "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/40",
    getHeadline: (isCandidate, applicantName, jobTitle) =>
      isCandidate ? (
        <span>
          You were hired for <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{jobTitle}</strong>
        </span>
      ) : (
        <span>
          You hired <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{applicantName}</strong> for{" "}
          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{jobTitle}</strong>
        </span>
      ),
  },
};

const STATUS_COLORS: Record<string, string> = {
  APPLIED: "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300",
  UNDER_REVIEW: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300",
  SHORTLISTED: "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300",
  INTERVIEW_SCHEDULED: "bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300",
  HIRED: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300",
  REJECTED: "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300",
  WITHDRAWN: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSalary(min?: number | null, max?: number | null, expected?: number | null): string | null {
  const fmt = (n: number) =>
    n >= 1000 ? `₱${(n / 1000).toFixed(0)}k` : `₱${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  if (max) return `Up to ${fmt(max)}`;
  if (expected) return `${fmt(expected)} (Expected)`;
  return null;
}

export default function ApplicationCard({ message }: Props) {
  const pathname = usePathname();
  const isFreelancerPath = pathname?.includes("/freelancer/");
  const viewDetailsUrl = isFreelancerPath
    ? "/linkbridge/freelancer/applications"
    : "/linkbridge/client/applicants";

  const initialData = (message as unknown as { system_card_data?: ApplicationCardData }).system_card_data ?? null;
  const [data, setData] = useState<ApplicationCardData | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [imgError, setImgError] = useState(false);
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileUrl: string } | null>(null);

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;

    fetch(`/api/messaging/system-card?message_id=${message.message_id}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          setData(json && !json.error ? json : null);
        }
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [message.message_id, initialData]);

  const eventType = message.system_message?.event_type ?? "APPLICATION_SUBMITTED";
  const meta = EVENT_METAS[eventType] ?? EVENT_METAS["APPLICATION_SUBMITTED"];

  const viewerRole = data?.viewer_role ?? (isFreelancerPath ? "FREELANCER" : "CLIENT");
  const isCandidate = viewerRole === "FREELANCER" || viewerRole === "CANDIDATE";

  // Contextual Domain Entities
  const applicantName = data?.applicant?.name ?? data?.applicant_name ?? "Applicant";
  const applicantAvatar = data?.applicant?.avatar ?? data?.applicant_avatar ?? null;
  const applicantEmail = data?.applicant?.email ?? data?.applicant_email ?? null;
  const applicantPhone = data?.applicant?.phone ?? data?.applicant_phone ?? null;
  const resume = data?.applicant?.resume ?? data?.resume ?? null;
  const socialLinks: Array<{ platform_name: string; url: string }> = data?.applicant?.social_links ?? data?.social_links ?? [];

  const jobTitle = data?.job?.title ?? data?.job_title ?? "Position";
  const salaryMin = data?.job?.salary_min ?? data?.salary_min ?? null;
  const salaryMax = data?.job?.salary_max ?? data?.salary_max ?? null;

  const appStatus = data?.application?.status ?? data?.application_status ?? "APPLIED";
  const expectedSalary = data?.application?.expected_salary ?? data?.expected_salary ?? null;
  const coverLetter = data?.application?.cover_letter ?? data?.cover_letter ?? null;
  const portfolioUrl = data?.application?.portfolio_url ?? data?.portfolio_url ?? null;
  const appliedAt = data?.application?.applied_at ?? data?.applied_at ?? null;
  const updatedAt = data?.application?.updated_at ?? data?.updated_at ?? data?.status_updated_at ?? null;

  const salary = useMemo(
    () => formatSalary(salaryMin, salaryMax, expectedSalary),
    [salaryMin, salaryMax, expectedSalary]
  );

  const statusColor = (appStatus && STATUS_COLORS[appStatus]) ?? "bg-muted text-muted-foreground";
  const hasCoverLetter = Boolean(coverLetter?.trim());
  const hasSocials = Boolean(socialLinks && socialLinks.length > 0);
  const hasResume = Boolean(resume?.file_path || resume?.file_name);
  const hasPortfolio = Boolean(portfolioUrl?.trim());

  if (loading) {
    return (
      <div className={`w-full max-w-sm rounded-2xl border p-4 ${meta.accent} flex items-center gap-3 shadow-xs`}>
        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        <span className="text-xs text-muted-foreground">Loading details...</span>
      </div>
    );
  }

  if (!data || (data as unknown as Record<string, unknown>).error) {
    return <SystemPill text={message.message_content} />;
  }

  const displayDate = updatedAt || message.created_at || appliedAt;

  return (
    <div className={`w-full max-w-sm sm:max-w-md rounded-2xl border shadow-xs overflow-hidden ${meta.accent}`}>
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-inherit flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{meta.icon}</span>
          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
            {meta.getLabel(isCandidate)}
          </span>
        </div>
        {displayDate && (
          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
            <CalendarDays className="h-3 w-3 shrink-0" />
            {formatDate(displayDate)}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3.5">
        {/* Dynamic Contextual Headline */}
        <div className="text-xs text-muted-foreground leading-snug">
          {meta.getHeadline(isCandidate, applicantName, jobTitle)}
        </div>

        {/* Applicant Header */}
        <div className="flex items-center gap-3 bg-card/50 p-2.5 rounded-xl border border-inherit/60">
          {applicantAvatar && !imgError ? (
            <Image
              src={applicantAvatar}
              alt={applicantName}
              width={40}
              height={40}
              unoptimized
              onError={() => setImgError(true)}
              className="h-10 w-10 rounded-full object-cover ring-1 ring-border shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <UserRound className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-card-foreground truncate">
              {isCandidate ? `${applicantName} (You)` : applicantName}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Briefcase className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {jobTitle}
              </span>
            </div>
          </div>
        </div>

        {/* Status + Salary Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${statusColor}`}>
            {appStatus}
          </span>
          {salary && (
            <span className="text-[11px] font-medium text-muted-foreground bg-card/70 px-2 py-0.5 rounded-md border border-border/60">
              {salary}
            </span>
          )}
        </div>

        {/* Contact Info (Email & Phone) */}
        {(applicantEmail || applicantPhone) && (
          <div className="pt-2 border-t border-inherit/60 space-y-1.5 text-xs text-muted-foreground">
            {applicantEmail && (
              <div className="flex items-center gap-2 truncate">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <a
                  href={`mailto:${applicantEmail}`}
                  className="truncate hover:underline text-primary"
                >
                  {applicantEmail}
                </a>
              </div>
            )}
            {applicantPhone && (
              <div className="flex items-center gap-2 truncate">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{applicantPhone}</span>
              </div>
            )}
          </div>
        )}

        {/* Attachments / Links Row (Resume, Portfolio, Socials) */}
        {(hasResume || hasPortfolio || hasSocials) && (
          <div className="pt-2 border-t border-inherit/60 space-y-2">
            {hasResume && resume && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-card border border-border/80 shadow-xs">
                <div className="p-1.5 rounded-lg bg-destructive/10 text-destructive shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-card-foreground truncate">
                    {resume.file_name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Resumé Document</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewDoc({
                        fileName: resume.file_name,
                        fileUrl: resume.file_path,
                      })
                    }
                    title="Preview Resumé"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-accent transition cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <a
                    href={resume.file_path}
                    download={resume.file_name}
                    title="Download Resumé"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-accent transition"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {hasPortfolio && (
                <a
                  href={portfolioUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-card border border-border text-foreground hover:bg-accent transition"
                >
                  <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>Portfolio</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                </a>
              )}

              {hasSocials &&
                socialLinks.map((social, idx) => (
                  <a
                    key={idx}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-card border border-border text-foreground hover:bg-accent transition"
                  >
                    <span className="capitalize">{social.platform_name}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                  </a>
                ))}
            </div>
          </div>
        )}

        {/* Cover Letter Accordion / Preview */}
        {hasCoverLetter && (() => {
          const parsed = parseCoverLetter(coverLetter);
          return (
            <div className="pt-2 border-t border-inherit/60">
              <button
                type="button"
                onClick={() => setShowCoverLetter((prev) => !prev)}
                className="flex items-center justify-between w-full text-sm md:text-xs font-semibold text-foreground py-1 max-md:min-h-11 hover:opacity-80 transition cursor-pointer"
              >
                <span>Cover Letter</span>
                {showCoverLetter ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              {showCoverLetter ? (
                <div className="mt-1.5 space-y-2 bg-card/70 p-3 rounded-xl border border-border/50 text-xs">
                  {parsed.text && (
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto">
                      {parsed.text}
                    </p>
                  )}
                  {parsed.document && (
                    <div className="flex items-center gap-2 p-2 rounded-xl border border-success/40 bg-success-bg/80 text-xs mt-2">
                      <FileText className="h-4 w-4 text-success shrink-0" />
                      <span className="truncate flex-1 font-medium text-success-foreground">
                        {parsed.document.fileName}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewDoc({
                            fileName: parsed.document!.fileName,
                            fileUrl: parsed.document!.fileUrl,
                          })
                        }
                        title="Preview Cover Letter Document"
                        className="p-1.5 rounded-lg text-success hover:bg-success/10 transition cursor-pointer max-md:size-11 max-md:grid max-md:place-items-center"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <a
                        href={parsed.document.fileUrl}
                        download={parsed.document.fileName}
                        title="Download Cover Letter Document"
                        className="p-1.5 rounded-lg text-success hover:bg-success/10 transition max-md:size-11 max-md:grid max-md:place-items-center"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-1 text-xs text-muted-foreground">
                  {parsed.text ? (
                    <p className="line-clamp-2 italic">&ldquo;{parsed.text}&rdquo;</p>
                  ) : parsed.document ? (
                    <p className="flex items-center gap-1.5 text-success font-medium">
                      <FileText className="h-3.5 w-3.5" />
                      <span>Document attached: {parsed.document.fileName}</span>
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Footer — Full View link */}
      <a
        href={viewDetailsUrl}
        className="flex items-center justify-center gap-1.5 py-2.5 border-t border-inherit text-sm md:text-xs font-medium text-primary hover:bg-accent/40 transition max-md:min-h-11"
      >
        View Full Application Details
        <ExternalLink className="h-3 w-3" />
      </a>

      {/* Document Preview Modal */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="sm:max-w-4xl w-full h-[85vh] flex flex-col p-0 gap-0 overflow-hidden max-md:h-[85dvh] max-md:[&>[data-slot=dialog-close]]:p-3.5 max-md:[&>[data-slot=dialog-close]]:-m-3.5">
          <DialogHeader className="px-6 py-3.5 border-b shrink-0 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 pr-4">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <DialogTitle className="text-sm font-bold truncate">
                {previewDoc?.fileName}
              </DialogTitle>
            </div>
            {previewDoc && (
              <a
                href={previewDoc.fileUrl}
                download={previewDoc.fileName}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shrink-0 transition max-md:min-h-11"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            )}
          </DialogHeader>
          <div className="flex-1 bg-muted overflow-hidden relative">
            {previewDoc && (
              <DocumentViewer
                fileUrl={previewDoc.fileUrl}
                fileName={previewDoc.fileName}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


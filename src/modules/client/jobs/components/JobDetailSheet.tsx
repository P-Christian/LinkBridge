/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import {
  MapPin,
  Briefcase,
  Users,
  GraduationCap,
  DollarSign,
  Building2,
  Layers,
  HelpCircle,
  Mail,
  Phone,
  Facebook,
  Instagram,
  Youtube,
  Twitter,
  Pencil,
  Clock,
} from "lucide-react";
import {
  PublicJobPosting,
  JobPosting,
  JobStatus,
  JOB_TYPE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  JobSkill,
} from "../types";
import JobPipelineSection from "@/modules/client/pipeline/components/JobPipelineSection";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";
import {
  applicantsHref,
  companyHeadquarters,
  formatPosted,
  formatSalary,
  getJobMeta,
  getStatusStyle,
  pluralizeApplicants,
  JOB_STATUSES,
} from "../job-helpers";
import ConfirmCloseJobDialog from "./ConfirmCloseJobDialog";

interface Props {
  job: PublicJobPosting | null;
  open: boolean;
  onClose: () => void;
  onApply?: (job: PublicJobPosting) => void;
  onEdit?: (job: JobPosting) => void;
  onStatusChange?: (jobId: number, newStatus: JobStatus) => void;
  appliedJobIds?: number[];
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {children}
    </section>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function Chip({
  icon: Icon,
  children,
  title,
  iconClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  title?: string;
  iconClass?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground"
    >
      <Icon className={cn("h-3 w-3 shrink-0", iconClass ?? "text-muted-foreground")} /> {children}
    </span>
  );
}

function getImageUrl(value: string | null | undefined): string {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }
  return `/api/client/assets/${value}`;
}

const parseJsonField = (value: string | null | undefined): { text: string; extra: Record<string, unknown> } => {
  if (!value) return { text: "", extra: {} };
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      return { text: (parsed.text as string) ?? "", extra: parsed };
    } catch {
      // ignore
    }
  }
  return { text: value, extra: {} };
};

const renderInlineMarkdown = (str: string) => {
  const parts = str.split(/(\*\*.*?\*\*|<b>.*?<\/b>|<strong>.*?<\/strong>)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={idx} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("<b>") && part.endsWith("</b>") && part.length >= 7) {
      return (
        <strong key={idx} className="font-bold text-foreground">
          {part.slice(3, -4)}
        </strong>
      );
    }
    if (part.startsWith("<strong>") && part.endsWith("</strong>") && part.length >= 17) {
      return (
        <strong key={idx} className="font-bold text-foreground">
          {part.slice(8, -9)}
        </strong>
      );
    }
    return part;
  });
};

function renderFormattedContent(text: string | null | undefined) {
  if (!text) return <p className="text-sm italic text-muted-foreground">No information provided.</p>;

  const trimmed = text.trim();
  if (!trimmed || trimmed === "<p><br></p>" || trimmed === "<br>") {
    return <p className="text-sm italic text-muted-foreground">No information provided.</p>;
  }

  // HTML from the RichTextEditor: explicit list/bold styling
  if (/<(b|strong|ul|ol|li|p|div|br|span|em|i)\b[^>]*>/i.test(trimmed)) {
    return (
      <div
        className="space-y-2 text-sm leading-relaxed text-foreground/85
          [&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5
          [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5
          [&_li]:leading-relaxed [&_li]:text-foreground/85
          [&_b]:font-bold [&_b]:text-foreground
          [&_strong]:font-bold [&_strong]:text-foreground
          [&_p]:my-1.5 [&_p]:leading-relaxed"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(trimmed) }}
      />
    );
  }

  // Markdown / plain text with bullets
  const blocks = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="space-y-2">
      {blocks.map((block, bIdx) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const isBullet = (line: string) =>
          line.startsWith("-") || line.startsWith("*") || line.startsWith("•") || /^\d+\./.test(line);
        const isList =
          lines.length > 0 &&
          (lines.every(isBullet) || (lines.length > 1 && lines.some(isBullet)));

        if (isList) {
          return (
            <ul key={bIdx} className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/85">
              {lines.map((line, lIdx) => (
                <li key={lIdx}>{renderInlineMarkdown(line.replace(/^([-*•]|\d+\.)\s*/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bIdx} className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
            {renderInlineMarkdown(block)}
          </p>
        );
      })}
    </div>
  );
}

function CompanyDetails({ job }: { job: PublicJobPosting }) {
  const hqAddress = companyHeadquarters(
    job.company_address ?? job.company?.company_address,
    job.company_city ?? job.company?.company_city,
    job.company_province ?? job.company?.company_province
  );

  const socials = [
    {
      href: job.company_facebook,
      label: "Facebook",
      Icon: Facebook,
      tone: "text-[#1877F2] bg-[#1877F2]/10 hover:bg-[#1877F2]/20",
    },
    {
      href: job.company_instagram,
      label: "Instagram",
      Icon: Instagram,
      tone: "text-[#E1306C] bg-[#E1306C]/10 hover:bg-[#E1306C]/20",
    },
    {
      href: job.company_x,
      label: "X (Twitter)",
      Icon: Twitter,
      tone: "text-[#1DA1F2] bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20",
    },
    {
      href: job.company_youtube,
      label: "YouTube",
      Icon: Youtube,
      tone: "text-[#FF0000] bg-[#FF0000]/10 hover:bg-[#FF0000]/20",
    },
  ].filter((s) => !!s.href);

  return (
    <dl className="space-y-4">
      <InfoRow label="Company headquarters">
        {hqAddress ? (
          <span className="flex items-start gap-1.5">
            <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
            <span>{hqAddress}</span>
          </span>
        ) : (
          <span className="text-muted-foreground italic">Not provided</span>
        )}
      </InfoRow>

      {job.company_email && (
        <InfoRow label="Company email">
          <a
            href={`mailto:${job.company_email}`}
            className="flex items-center gap-1.5 hover:underline"
            title={job.company_email}
          >
            <Mail className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span className="truncate">{job.company_email}</span>
          </a>
        </InfoRow>
      )}

      {job.company_contact && (
        <InfoRow label="Company contact">
          <a href={`tel:${job.company_contact}`} className="flex items-center gap-1.5 hover:underline">
            <Phone className="h-3.5 w-3.5 shrink-0 text-violet-500" />
            {job.company_contact}
          </a>
        </InfoRow>
      )}

      {socials.length > 0 && (
        <InfoRow label="Social media">
          <div className="flex flex-wrap gap-2 pt-1">
            {socials.map(({ href, label, Icon, tone }) => (
              <a
                key={label}
                href={href as string}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                className={cn(
                  "flex items-center justify-center rounded-lg p-1.5 transition-colors max-md:size-10 max-md:p-0",
                  tone
                )}
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </InfoRow>
      )}
    </dl>
  );
}

export function JobDetailSheet({ job, open, onClose, onEdit, onStatusChange }: Props) {
  const [confirmClose, setConfirmClose] = useState(false);

  if (!job) return null;

  // Owners get management controls; candidates browsing the same sheet don't.
  const isOwner = !!(onEdit || onStatusChange);
  const meta = getJobMeta(job);
  const posted = formatPosted(meta.postedAt);

  const descData = parseJsonField(job.job_description);
  const reqsData = parseJsonField(job.job_requirements);

  const descriptionText = descData.text || job.job_description || "";
  const responsibilitiesText = (descData.extra.job_responsibilities as string) || job.job_responsibilities || "";
  const qualificationsText = (reqsData.extra.job_qualifications as string) || job.job_qualifications || "";
  const salaryType = (reqsData.extra.salary_type as string) || job.salary_type || "Salary Range";
  const arrangement = (descData.extra.work_arrangement as string) || job.work_arrangement || "Remote";
  const openings = (descData.extra.number_of_openings as string) || job.number_of_openings || "1";
  const education = (reqsData.extra.education as string) || job.education || "";
  const department = job.job_department || "";
  const category = job.job_category || "";
  const skills = (reqsData.extra.skills as JobSkill[]) || job.skills || [];
  const benefits = (reqsData.extra.benefits as string[]) || job.benefits || [];
  const screeningQuestions = (reqsData.extra.screening_questions as string[]) || job.screening_questions || [];

  const totalApplicants = meta.applicantCount;
  const activeApplicants = meta.activeApplicantCount ?? totalApplicants;
  // null means the count was never resolved, so keep the link available.
  const hasApplicants = (totalApplicants ?? 1) > 0;

  const applicantsButtonInner = (
    <>
      <Users className="h-3.5 w-3.5" />
      View applicants
      <span
        className={cn(
          "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
          (activeApplicants ?? 0) > 0
            ? "bg-amber-300 text-amber-950"
            : "bg-primary-foreground/20 text-primary-foreground"
        )}
      >
        {activeApplicants ?? 0}
      </span>
    </>
  );

  const handleStatus = (value: string) => {
    const next = value as JobStatus;
    if (next === job.status) return;
    // Closing affects what candidates can do, so confirm first
    if (value === "CLOSED") setConfirmClose(true);
    else onStatusChange?.(job.job_id, next);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="right"
          // Radix focuses the first control on open, which put a focus ring on the status select.
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex w-full flex-col gap-0 p-0 sm:max-w-1/2"
        >
          {/* Cover banner */}
          <div className="relative h-24 w-full shrink-0 overflow-hidden border-b">
            {job.company_cover ? (
              <img
                src={getImageUrl(job.company_cover)}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800" />
            )}
          </div>

          {/* Header */}
          <SheetHeader className="shrink-0 border-b bg-card px-6 pb-4 pt-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <div className="relative z-20 -mt-12 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-muted text-base font-bold text-foreground shadow-xs">
                  {job.company_logo ? (
                    <img
                      src={getImageUrl(job.company_logo)}
                      alt={job.company?.company_name ?? ""}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(job.company?.company_name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-lg font-bold leading-tight text-foreground">
                    {job.job_title}
                  </SheetTitle>
                  <SheetDescription className="mt-0.5 text-sm text-muted-foreground">
                    {job.company?.company_name ?? "Unknown Company"}
                  </SheetDescription>
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {onStatusChange && (
                  <Select value={job.status} onValueChange={handleStatus}>
                    <SelectTrigger
                      aria-label="Job status"
                      className="h-9 w-32 rounded-lg border-border text-sm font-medium max-md:min-h-10 max-md:text-base"
                    >
                      <span className="flex items-center gap-2">
                      
                        <SelectValue />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          <span className="flex items-center gap-2">
                            <span className={cn("h-2 w-2 rounded-full", getStatusStyle(s).dot)} aria-hidden />
                            {getStatusStyle(s).label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {onEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onClose();
                      onEdit(job as unknown as JobPosting);
                    }}
                    className="h-9 gap-1.5 rounded-lg px-3 text-sm font-medium hover:border-primary hover:text-primary max-md:min-h-10"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit job
                  </Button>
                )}

                {isOwner &&
                  (hasApplicants ? (
                    <Button
                      asChild
                      size="sm"
                      title={
                        totalApplicants === null
                          ? undefined
                          : `${pluralizeApplicants(totalApplicants)} total, ${activeApplicants} in the pipeline`
                      }
                      className="h-9 gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 max-md:min-h-10"
                    >
                      <Link href={applicantsHref(job.job_id)}>{applicantsButtonInner}</Link>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled
                      title="No applicants yet for this posting"
                      className="h-9 gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground max-md:min-h-10 disabled:pointer-events-auto"
                    >
                      {applicantsButtonInner}
                    </Button>
                  ))}
              </div>
            </div>

            {/* Quick meta */}
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip icon={MapPin} title={job.job_location} iconClass="text-rose-500">
                {job.job_location || "Location undisclosed"}
              </Chip>
              <Chip icon={Briefcase} iconClass="text-sky-500">
                {JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
              </Chip>
              <Chip icon={Building2} iconClass="text-violet-500">
                {arrangement}
              </Chip>
              {!isOwner && Number(openings) > 1 && (
                <Chip icon={Users} iconClass="text-amber-500">
                  {openings} openings
                </Chip>
              )}
              {posted && (
                <Chip icon={Clock} iconClass="text-teal-500">
                  {posted}
                </Chip>
              )}
            </div>
          </SheetHeader>

          {/* Scrollable body */}
          <ScrollArea className="min-h-0 flex-1">
            <div className="grid grid-cols-1 gap-6 px-6 py-5 md:grid-cols-3">
              {/* Left column: job info */}
              <div className="space-y-6 md:col-span-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border bg-muted/40 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-500" /> Salary
                    </div>
                    <p className="text-sm font-semibold text-foreground">{formatSalary(job)}</p>
                    {/* "Negotiable" + "Salary Range" read as contradictory, so only show the type for real amounts */}
                    {!job.salary_negotiable && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{salaryType}</p>
                    )}
                  </div>
                  {job.experience_level && (
                    <div className="rounded-xl border bg-muted/40 p-3">
                      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Layers className="h-3.5 w-3.5 text-sky-500" /> Experience
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {EXPERIENCE_LEVEL_LABELS[job.experience_level] ?? job.experience_level}
                      </p>
                    </div>
                  )}
                  {education && (
                    <div className="col-span-2 rounded-xl border bg-muted/40 p-3">
                      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <GraduationCap className="h-3.5 w-3.5 text-violet-500" /> Education
                      </div>
                      <p className="text-sm text-foreground">{education}</p>
                    </div>
                  )}
                </div>

                <Separator />

                <Section title="Job description">{renderFormattedContent(descriptionText)}</Section>

                {responsibilitiesText && (
                  <>
                    <Separator />
                    <Section title="Responsibilities">{renderFormattedContent(responsibilitiesText)}</Section>
                  </>
                )}

                {qualificationsText && (
                  <>
                    <Separator />
                    <Section title="Qualifications">{renderFormattedContent(qualificationsText)}</Section>
                  </>
                )}

                {skills && skills.length > 0 && (
                  <>
                    <Separator />
                    <Section title="Required skills">
                      <div className="flex flex-wrap gap-1.5">
                        {skills.map((s) => (
                          <Badge
                            key={s.id}
                            variant="secondary"
                            className="rounded-full px-2.5 py-1 text-xs font-normal whitespace-normal break-words max-w-full text-left leading-snug h-auto"
                          >
                            {s.skill_name}
                          </Badge>
                        ))}
                      </div>
                    </Section>
                  </>
                )}

                {benefits && benefits.length > 0 && (
                  <>
                    <Separator />
                    <Section title="Benefits">
                      <div className="flex flex-wrap gap-1.5">
                        {benefits.map((b) => (
                          <span
                            key={b}
                            className="inline-flex items-center rounded-full border border-emerald-200/50 bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </Section>
                  </>
                )}

                {screeningQuestions && screeningQuestions.length > 0 && (
                  <>
                    <Separator />
                    <Section title={`Screening questions (${screeningQuestions.length})`}>
                      <ul className="space-y-2">
                        {screeningQuestions.map((q, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 rounded-lg bg-muted/40 p-2 text-sm text-foreground/80"
                          >
                            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {isOwner
                          ? "Candidates answer these in the application form."
                          : "You will answer these questions in the application form."}
                      </p>
                    </Section>
                  </>
                )}

                <Separator />
                <Section title="Hiring pipeline">
                  <JobPipelineSection jobId={job.job_id} readOnly />
                </Section>
              </div>

              {/* Right column */}
              <aside className="space-y-6 border-t border-border/80 pt-5 md:col-span-1 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                {isOwner && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Role details</h3>
                    <dl className="space-y-3">
                      {department && (
                        <InfoRow label="Department">{department}</InfoRow>
                      )}
                      {category && (
                        <InfoRow label="Job category">{category}</InfoRow>
                      )}
                      <InfoRow label="Openings">{openings}</InfoRow>
                      {totalApplicants !== null && (
                        <InfoRow label="Applicants">
                          {pluralizeApplicants(totalApplicants)}
                          {activeApplicants !== totalApplicants && (
                            <span className="text-muted-foreground">
                              {" "}· {activeApplicants} in the pipeline
                            </span>
                          )}
                        </InfoRow>
                      )}
                    </dl>
                    <Separator />
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {isOwner ? "Company details shown to candidates" : "About the client"}
                  </h3>
                  <CompanyDetails job={job} />
                </div>
              </aside>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <ConfirmCloseJobDialog
        open={confirmClose}
        jobTitle={job.job_title}
        onOpenChange={setConfirmClose}
        onConfirm={() => {
          setConfirmClose(false);
          onStatusChange?.(job.job_id, "CLOSED" as JobStatus);
        }}
      />
    </>
  );
}
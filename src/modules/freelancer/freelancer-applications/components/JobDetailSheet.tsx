/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MapPin,
  Briefcase,
  Users,
  GraduationCap,
  DollarSign,
  Send,
  Building2,
  Layers,
  HelpCircle,
  Mail,
  Phone,
  X,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFacebook,
  faLinkedin,
  faInstagram,
  faYoutube,
  faXTwitter,
} from "@fortawesome/free-brands-svg-icons";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { PublicJobPosting, JOB_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS } from "../types";

interface Props {
  job: PublicJobPosting | null;
  open: boolean;
  onClose: () => void;
}

function formatSalary(job: PublicJobPosting): string {
  if (job.salary_negotiable) return "Negotiable";
  const currency = job.currency ?? "PHP";
  if (job.salary_type === "Fixed Salary" && job.salary_min) {
    return `${currency} ${Number(job.salary_min).toLocaleString()} / mo`;
  }
  if (job.salary_min && job.salary_max) {
    return `${currency} ${Number(job.salary_min).toLocaleString()} – ${Number(job.salary_max).toLocaleString()} / mo`;
  }
  if (job.salary_min) return `${currency} ${Number(job.salary_min).toLocaleString()}+ / mo`;
  return "Salary not disclosed";
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm md:text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h4>
      {children}
    </div>
  );
}

function getImageUrl(value: string | null | undefined): string {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }
  return `/api/client/assets/${value}`;
}

export function JobDetailSheet({ job, open, onClose }: Props) {
  if (!job) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-1/2 flex flex-col p-0 gap-0 z-[100] max-md:[&>button]:p-3.5 max-md:[&>button]:-m-3.5"
      >
        {/* Cover Banner */}
        <div className="h-32 w-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 relative overflow-hidden shrink-0 border-b">
          {job.company_cover ? (
            <img
              src={getImageUrl(job.company_cover)}
              alt="Company Cover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800" />
          )}
          {/* noticeable close button */}
          <Button
            variant="secondary"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-background/80 hover:bg-background shadow-md border z-[110] flex items-center justify-center text-foreground max-md:size-11"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Header */}
        <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 -mt-12 relative z-20 rounded-2xl border-4 border-background bg-muted flex items-center justify-center text-md font-bold text-foreground shrink-0 overflow-hidden shadow-xs">
                {job.company_logo ? (
                  <img src={getImageUrl(job.company_logo)} alt={job.company_name ?? ""} className="w-full h-full object-cover" />
                ) : (
                  getInitials(job.company_name)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base font-bold text-foreground leading-tight">
                  {job.job_title}
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground mt-0.5">
                  {job.company_name ?? "Unknown Company"}
                </SheetDescription>
              </div>
            </div>
          </div>

          {/* Quick meta */}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
              <MapPin className="h-3 w-3" /> {job.job_location}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
              <Briefcase className="h-3 w-3" /> {JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
              <Building2 className="h-3 w-3" /> {job.work_arrangement}
            </span>
            {job.number_of_openings > 1 && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
                <Users className="h-3 w-3" /> {job.number_of_openings} openings
              </span>
            )}
          </div>
        </SheetHeader>

        {/* Scrollable body */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left Column: Job Info */}
            <div className="md:col-span-2 space-y-6">
              {/* Salary & Requirements Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/40 border">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase mb-1">
                    <DollarSign className="h-3 w-3" /> Salary
                  </div>
                  <p className="text-sm font-semibold text-foreground">{formatSalary(job)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{job.salary_type}</p>
                </div>
                {job.experience_level && (
                  <div className="p-3 rounded-xl bg-muted/40 border">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase mb-1">
                      <Layers className="h-3 w-3" /> Experience
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {EXPERIENCE_LEVEL_LABELS[job.experience_level] ?? job.experience_level}
                    </p>
                  </div>
                )}
                {job.education && (
                  <div className="p-3 rounded-xl bg-muted/40 border col-span-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase mb-1">
                      <GraduationCap className="h-3 w-3" /> Education
                    </div>
                    <p className="text-sm text-foreground">{job.education}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Job Description */}
              <Section title="Job Description">
                {/<(p|b|strong|ul|ol|li|div|br|h[1-6])\b[^>]*>/i.test(job.job_description || "") ? (
                  <div
                    className="text-sm text-foreground/80 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_li]:leading-normal [&_strong]:font-semibold [&_b]:font-semibold [&_p]:mb-2"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.job_description) }}
                  />
                ) : (
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                    {job.job_description}
                  </p>
                )}
              </Section>

              {/* Responsibilities */}
              {job.job_responsibilities && (
                <>
                  <Separator />
                  <Section title="Responsibilities">
                    {/<(p|b|strong|ul|ol|li|div|br|h[1-6])\b[^>]*>/i.test(job.job_responsibilities) ? (
                      <div
                        className="text-sm text-foreground/80 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_li]:leading-normal [&_strong]:font-semibold [&_b]:font-semibold [&_p]:mb-2"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.job_responsibilities) }}
                      />
                    ) : (
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                        {job.job_responsibilities}
                      </p>
                    )}
                  </Section>
                </>
              )}

              {/* Qualifications */}
              <Separator />
              <Section title="Qualifications">
                {/<(p|b|strong|ul|ol|li|div|br|h[1-6])\b[^>]*>/i.test(job.job_qualifications || "") ? (
                  <div
                    className="text-sm text-foreground/80 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_li]:leading-normal [&_strong]:font-semibold [&_b]:font-semibold [&_p]:mb-2"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.job_qualifications) }}
                  />
                ) : (
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                    {job.job_qualifications}
                  </p>
                )}
              </Section>

              {/* Skills */}
              {job.skills && job.skills.length > 0 && (
                <>
                  <Separator />
                  <Section title="Required Skills">
                    <div className="flex flex-wrap gap-1.5">
                      {job.skills.map((s) => (
                        <Badge key={s.id} variant="secondary" className="text-xs px-2.5 py-0.5 rounded-full font-normal">
                          {s.skill_name}
                        </Badge>
                      ))}
                    </div>
                  </Section>
                </>
              )}

              {/* Benefits */}
              {job.benefits && job.benefits.length > 0 && (
                <>
                  <Separator />
                  <Section title="Benefits">
                    <div className="flex flex-wrap gap-1.5">
                      {job.benefits.map((b) => (
                        <span
                          key={b}
                          className="inline-flex items-center text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/50"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </Section>
                </>
              )}

              {/* Screening Questions preview */}
              {job.screening_questions && job.screening_questions.length > 0 && (
                <>
                  <Separator />
                  <Section title={`Screening Questions (${job.screening_questions.length})`}>
                    <div className="space-y-2">
                      {job.screening_questions.map((q, i) => {
                        const qText = typeof q === "object" && q !== null ? (q as { question_text?: string }).question_text || "" : String(q);
                        return (
                          <div key={i} className="flex items-start gap-2 text-sm text-foreground/70 bg-muted/40 rounded-lg p-1">
                            <HelpCircle className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                            <span>{qText}</span>
                          </div>
                        );
                      })}
                    </div>
                  </Section>
                </>
              )}
            </div>

            {/* Right Column: Client info */}
            <div className="md:col-span-1 space-y-5 border-t pt-5 md:border-l md:border-l-0 md:pl-5 border-border/80">
              <h3 className="text-sm md:text-xs font-bold uppercase tracking-wider text-muted-foreground">About the client</h3>

              <div className="space-y-4">
                {/* Location */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Location</span>
                  <div className="flex items-start gap-1.5 text-sm md:text-xs text-foreground font-medium">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-500" />
                    <span>
                      {[job.company_address, job.company_city, job.company_province].filter(Boolean).join(", ") || job.job_location}
                    </span>
                  </div>
                </div>

                {/* Email */}
                {job.company_email && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Company Email</span>
                    <div className="flex items-center gap-1.5 text-sm md:text-xs text-foreground font-medium truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      <span className="truncate" title={job.company_email}>{job.company_email}</span>
                    </div>
                  </div>
                )}

                {/* Contact */}
                {job.company_contact && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Company Contact</span>
                    <div className="flex items-center gap-1.5 text-sm md:text-xs text-foreground font-medium">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      <span>{job.company_contact}</span>
                    </div>
                  </div>
                )}

                {/* Socials */}
                {(job.company_facebook || job.company_linkedin || job.company_instagram || job.company_x || job.company_youtube) && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Social Media</span>
                    <div className="flex flex-wrap gap-2">
                      {job.company_facebook && (
                        <a
                          href={job.company_facebook}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Facebook"
                          className="h-8 w-8 rounded-lg bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] border border-[#1877F2]/20 transition-all hover:scale-105 flex items-center justify-center max-md:size-11"
                        >
                          <FontAwesomeIcon icon={faFacebook} className="h-4 w-4" />
                        </a>
                      )}
                      {job.company_linkedin && (
                        <a
                          href={job.company_linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="LinkedIn"
                          className="h-8 w-8 rounded-lg bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 text-[#0A66C2] border border-[#0A66C2]/20 transition-all hover:scale-105 flex items-center justify-center max-md:size-11"
                        >
                          <FontAwesomeIcon icon={faLinkedin} className="h-4 w-4" />
                        </a>
                      )}
                      {job.company_instagram && (
                        <a
                          href={job.company_instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Instagram"
                          className="h-8 w-8 rounded-lg bg-[#E4405F]/10 hover:bg-[#E4405F]/20 text-[#E4405F] border border-[#E4405F]/20 transition-all hover:scale-105 flex items-center justify-center max-md:size-11"
                        >
                          <FontAwesomeIcon icon={faInstagram} className="h-4 w-4" />
                        </a>
                      )}
                      {job.company_x && (
                        <a
                          href={job.company_x}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="X (Twitter)"
                          className="h-8 w-8 rounded-lg bg-foreground/10 hover:bg-foreground/20 text-foreground border border-foreground/20 transition-all hover:scale-105 flex items-center justify-center max-md:size-11"
                        >
                          <FontAwesomeIcon icon={faXTwitter} className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {job.company_youtube && (
                        <a
                          href={job.company_youtube}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="YouTube"
                          className="h-8 w-8 rounded-lg bg-[#FF0000]/10 hover:bg-[#FF0000]/20 text-[#FF0000] border border-[#FF0000]/20 transition-all hover:scale-105 flex items-center justify-center max-md:size-11"
                        >
                          <FontAwesomeIcon icon={faYoutube} className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </ScrollArea>

        {/* Sticky Apply Button */}
        <div className="px-6 py-4 border-t bg-background shrink-0 flex gap-3">
          <Button
            id="job-detail-apply-btn"
            disabled={true}
            className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium gap-2 border-0 shadow-sm disabled:bg-zinc-100 disabled:text-zinc-400 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-600 max-md:min-h-11"
          >
            <Send className="h-4 w-4" />
            Already Applied
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

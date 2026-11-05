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
  ExternalLink,
  Mail,
  Phone,
  Facebook,
  Linkedin,
  Instagram,
  Youtube,
  Bookmark,
  Share2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { PublicJobPosting, JOB_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS } from "../types";
import ReferModal from "../../freelancer/freelancer-referrals/components/ReferModal";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { safeUrl } from "@/lib/safe-url";

interface Props {
  job: PublicJobPosting | null;
  open: boolean;
  onClose: () => void;
  onApply: (job: PublicJobPosting) => void;
  appliedJobIds?: number[];
  bookmarkedJobIds?: number[];
  onToggleBookmark?: (jobId: number) => void;
  referralInfo?: { referrer_name: string; expires_at: string | null } | null;
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
  if (!text) return <p className="text-sm text-muted-foreground italic">No information provided.</p>;
  if (/<(b|strong|ul|ol|li|p|div|br)\b[^>]*>/i.test(text)) {
    return (
      <div
        className="text-sm text-foreground/80 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-bold [&_b]:font-bold"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }}
      />
    );
  }
  const blocks = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="space-y-2.5">
      {blocks.map((block, bIdx) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const isList =
          lines.length > 0 &&
          (lines.every((line) => line.startsWith("-") || line.startsWith("*") || line.startsWith("•") || /^\d+\./.test(line)) ||
            (lines.length > 1 && lines.some((line) => line.startsWith("-") || line.startsWith("*") || line.startsWith("•") || /^\d+\./.test(line))));

        if (isList) {
          return (
            <ul key={bIdx} className="space-y-1.5 list-disc pl-4 text-sm text-foreground/80 leading-relaxed">
              {lines.map((line, lIdx) => {
                const cleaned = line.replace(/^[-*•\d+\.]\s*/, "");
                return <li key={lIdx}>{renderInlineMarkdown(cleaned)}</li>;
              })}
            </ul>
          );
        } else {
          return (
            <p key={bIdx} className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {renderInlineMarkdown(block)}
            </p>
          );
        }
      })}
    </div>
  );
}

export function JobDetailSheet({ job, open, onClose, onApply, appliedJobIds = [], bookmarkedJobIds = [], onToggleBookmark, referralInfo }: Props) {
  const [referModalOpen, setReferModalOpen] = React.useState(false);
  const [profileCompletion, setProfileCompletion] = React.useState<number | null>(null);
  const [now] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (open) {
      fetch("/api/freelancer/profile")
        .then((res) => res.json())
        .then((json) => {
          const profile = json?.data;
          if (profile) {
            const profileObj = profile.job_seeker_profile || profile.vs_job_seeker_profile;
            const record = Array.isArray(profileObj) ? profileObj[0] : profileObj;
            const percent = typeof record?.profile_completion_percent === "number" ? record.profile_completion_percent : 0;
            setProfileCompletion(percent);
          }
        })
        .catch((err) => console.error("Error checking profile completion in JobDetailSheet:", err));
    }
  }, [open]);

  if (!job) return null;

  const alreadyApplied = appliedJobIds.includes(job.job_id);
  const isBookmarked = bookmarkedJobIds.includes(job.job_id);
  const companyUrl = job.company_code
    ? `/companies/${job.company_code}`
    : `/companies?search=${encodeURIComponent(job.company_name ?? "")}`;

  const countdown = (() => {
    if (!referralInfo?.expires_at) return null;
    const diff = new Date(referralInfo.expires_at).getTime() - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return { label: "Expired", isUrgent: true };
    if (days === 1) return { label: "Expires tomorrow", isUrgent: true };
    if (days <= 3) return { label: `${days}d left`, isUrgent: true };
    return { label: `${days}d left`, isUrgent: false };
  })();

  // Employer-supplied socials must pass a scheme allowlist before reaching an href.
  const facebookUrl = safeUrl(job.company_facebook);
  const linkedinUrl = safeUrl(job.company_linkedin);
  const instagramUrl = safeUrl(job.company_instagram);
  const youtubeUrl = safeUrl(job.company_youtube);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-1/2 flex flex-col p-0 gap-0 max-md:[&>button]:p-3.5 max-md:[&>button]:-m-3.5"
      >
        {/* Cover Banner */}
        <div className="h-32 w-full bg-linear-to-r from-emerald-500/10 to-teal-500/10 relative overflow-hidden shrink-0 border-b">
          {job.company_cover ? (
            <img
              src={getImageUrl(job.company_cover)}
              alt="Company Cover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800" />
          )}
        </div>

        {/* Header */}
        <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-start gap-4">
              <a
                href={companyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-16 h-16 -mt-12 relative z-20 rounded-2xl border-4 border-background bg-muted flex items-center justify-center text-md font-bold text-foreground shrink-0 overflow-hidden shadow-xs hover:opacity-90 transition-opacity"
                title={`View ${job.company_name ?? "Company"} details`}
              >
                {job.company_logo ? (
                  <img src={getImageUrl(job.company_logo)} alt={job.company_name ?? ""} className="w-full h-full object-cover" />
                ) : (
                  getInitials(job.company_name)
                )}
              </a>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base font-bold text-foreground leading-tight">
                  {job.job_title}
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground mt-0.5" asChild>
                  <div>
                    {job.company_name ? (
                      <a
                        href={companyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary hover:underline transition-colors font-medium"
                        title={`View ${job.company_name} details`}
                      >
                        {job.company_name}
                      </a>
                    ) : (
                      "Unknown Company"
                    )}
                  </div>
                </SheetDescription>
              </div>
            </div>

            <a
              href={`/vos-sync/freelancer/jobs/${job.job_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold shrink-0 mr-6"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open job in a new window
            </a>
          </div>

          {/* Quick meta */}
          <div className="flex flex-wrap gap-2 mt-3 items-center">
            {referralInfo && (
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/25 text-xs font-semibold px-2.5 py-1 gap-1.5 rounded-full"
              >
                <span>👥 Referred by {referralInfo.referrer_name}</span>
                {countdown && (
                  <span className={countdown.isUrgent ? "text-amber-600 dark:text-amber-400 font-bold ml-1" : "text-muted-foreground ml-1"}>
                    · ⏳ {countdown.label}
                  </span>
                )}
              </Badge>
            )}
            <span className="inline-flex items-center gap-1 text-sm md:text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
              <MapPin className="h-3 w-3" /> {job.job_location}
            </span>
            <span className="inline-flex items-center gap-1 text-sm md:text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
              <Briefcase className="h-3 w-3" /> {JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
            </span>
            <span className="inline-flex items-center gap-1 text-sm md:text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
              <Building2 className="h-3 w-3" /> {job.work_arrangement}
            </span>
            {job.number_of_openings > 1 && (
              <span className="inline-flex items-center gap-1 text-sm md:text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
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
                  <div className="flex items-center gap-1.5 text-sm md:text-[10px] font-medium text-muted-foreground uppercase mb-1">
                    <DollarSign className="h-3 w-3" /> Salary
                  </div>
                  <p className="text-sm font-semibold text-foreground">{formatSalary(job)}</p>
                  <p className="text-sm md:text-[10px] text-muted-foreground mt-0.5">{job.salary_type}</p>
                </div>
                {job.experience_level && (
                  <div className="p-3 rounded-xl bg-muted/40 border">
                    <div className="flex items-center gap-1.5 text-sm md:text-[10px] font-medium text-muted-foreground uppercase mb-1">
                      <Layers className="h-3 w-3" /> Experience
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {EXPERIENCE_LEVEL_LABELS[job.experience_level] ?? job.experience_level}
                    </p>
                  </div>
                )}
                {job.education && (
                  <div className="p-3 rounded-xl bg-muted/40 border col-span-2">
                    <div className="flex items-center gap-1.5 text-sm md:text-[10px] font-medium text-muted-foreground uppercase mb-1">
                      <GraduationCap className="h-3 w-3" /> Education
                    </div>
                    <p className="text-sm text-foreground">{job.education}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Job Description */}
              <Section title="Job Description">
                {renderFormattedContent(job.job_description)}
              </Section>

              {/* Responsibilities */}
              {job.job_responsibilities && (
                <>
                  <Separator />
                  <Section title="Responsibilities">
                    {renderFormattedContent(job.job_responsibilities)}
                  </Section>
                </>
              )}

              {/* Qualifications */}
              <Separator />
              <Section title="Qualifications">
                {renderFormattedContent(job.job_qualifications)}
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
                        const qText = typeof q === "object" && q !== null ? q.question_text : String(q);
                        return (
                          <div key={i} className="flex items-start gap-2 text-sm text-foreground/70 bg-muted/40 rounded-lg p-1">
                            <HelpCircle className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                            <span>{qText}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-sm md:text-[11px] text-muted-foreground mt-2">
                      You will answer these questions in the application form.
                    </p>
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
                  <span className="text-sm md:text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Location</span>
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
                    <span className="text-sm md:text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Company Email</span>
                    <div className="flex items-center gap-1.5 text-sm md:text-xs text-foreground font-medium truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      <span className="truncate" title={job.company_email}>{job.company_email}</span>
                    </div>
                  </div>
                )}

                {/* Contact */}
                {job.company_contact && (
                  <div className="space-y-1">
                    <span className="text-sm md:text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Company Contact</span>
                    <div className="flex items-center gap-1.5 text-sm md:text-xs text-foreground font-medium">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      <span>{job.company_contact}</span>
                    </div>
                  </div>
                )}

                {/* Socials */}
                {(facebookUrl || linkedinUrl || instagramUrl || youtubeUrl) && (
                  <div className="space-y-2 pt-2">
                    <span className="text-sm md:text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Social Media</span>
                    <div className="flex flex-wrap gap-2">
                      {facebookUrl && (
                        <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-muted hover:bg-muted/85 rounded-lg text-zinc-600 dark:text-zinc-400 max-md:size-11 max-md:grid max-md:place-items-center">
                          <Facebook className="h-4 w-4" />
                        </a>
                      )}
                      {linkedinUrl && (
                        <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-muted hover:bg-muted/85 rounded-lg text-zinc-600 dark:text-zinc-400 max-md:size-11 max-md:grid max-md:place-items-center">
                          <Linkedin className="h-4 w-4" />
                        </a>
                      )}
                      {instagramUrl && (
                        <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-muted hover:bg-muted/85 rounded-lg text-zinc-600 dark:text-zinc-400 max-md:size-11 max-md:grid max-md:place-items-center">
                          <Instagram className="h-4 w-4" />
                        </a>
                      )}
                      {youtubeUrl && (
                        <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-muted hover:bg-muted/85 rounded-lg text-zinc-600 dark:text-zinc-400 max-md:size-11 max-md:grid max-md:place-items-center">
                          <Youtube className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </ScrollArea>

        {/* Sticky Apply Button and Requirements */}
        <div className="px-6 py-4 border-t bg-background shrink-0 flex flex-col gap-3">
          {profileCompletion !== null && profileCompletion < 100 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 shadow-xs dark:border-amber-900/60 dark:bg-amber-950/25 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-amber-950 dark:text-amber-200">
                    Profile Completion Required to Apply ({profileCompletion}%)
                  </h5>
                  <p className="text-[11px] text-amber-900/90 dark:text-amber-300/90 leading-relaxed">
                    You must complete your profile before applying. This job is saved in your bookmarks.
                  </p>
                  <div className="pt-1">
                    <a
                      href="/vos-sync/freelancer/profile"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:underline"
                    >
                      Complete Profile Now <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 max-md:flex-wrap">
            {onToggleBookmark && (
              <Button
                variant="outline"
                className={`h-10 px-4 rounded-xl font-medium gap-2 transition-colors max-md:min-h-11 ${
                  isBookmarked 
                    ? "border-primary text-primary hover:bg-primary/5" 
                    : "text-foreground border-zinc-200 dark:border-zinc-800"
                }`}
                onClick={() => onToggleBookmark(job.job_id)}
              >
                <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />
                {isBookmarked ? "Saved" : "Save Job"}
              </Button>
            )}
            <Button
              variant="outline"
              className="h-10 px-4 rounded-xl font-medium gap-2 text-foreground border-zinc-200 dark:border-zinc-800 max-md:min-h-11"
              onClick={() => setReferModalOpen(true)}
            >
              <Share2 className="h-4 w-4" />
              Refer
            </Button>
            <Button
              id="job-detail-apply-btn"
              onClick={() => onApply(job)}
              disabled={alreadyApplied || (profileCompletion !== null && profileCompletion < 100)}
              title={
                profileCompletion !== null && profileCompletion < 100
                  ? "You must complete your profile (100%) before applying"
                  : alreadyApplied
                  ? "Already Applied"
                  : "Apply Now"
              }
              className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium gap-2 border-0 shadow-sm disabled:bg-zinc-100 disabled:text-zinc-400 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-600 disabled:cursor-not-allowed max-md:min-h-11"
            >
              <Send className="h-4 w-4" />
              {alreadyApplied ? "Already Applied" : "Apply Now"}
            </Button>
          </div>
        </div>

        {/* Refer Modal */}
        <ReferModal
          jobId={job.job_id}
          jobTitle={job.job_title}
          open={referModalOpen}
          onClose={() => setReferModalOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

// src/modules/public/find-jobs/components/PublicJobDetailModal.tsx
"use client";

import React from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import {
  Building2,
  MapPin,
  Briefcase,
  ShieldCheck,
  ArrowRight,
  LogIn,
  UserPlus,
  Lock,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { PublicJobPosting } from "../types";
import { useAuthSession } from "@/hooks/useAuthSession";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { formatJobType } from "@/lib/utils";

function renderFormattedContent(text: string | null | undefined) {
  if (!text) {
    return <p className="text-sm text-muted-foreground italic">No job overview provided.</p>;
  }

  // If HTML tags are present, sanitize and render via dangerouslySetInnerHTML
  if (/<(b|strong|ul|ol|li|p|div|br|span|h[1-6]|em|i)\b[^>]*>/i.test(text)) {
    return (
      <div
        className="text-sm text-foreground/90 leading-relaxed space-y-2 [&_p]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-bold [&_b]:font-bold [&_li]:mb-1"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }}
      />
    );
  }

  // Plain text fallback with paragraph and list line parsing
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
            <ul key={bIdx} className="space-y-1.5 list-disc pl-4 text-sm text-foreground/90 leading-relaxed">
              {lines.map((line, lIdx) => (
                <li key={lIdx}>{line.replace(/^[-*•\d+\.]\s*/, "")}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bIdx} className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {block}
          </p>
        );
      })}
    </div>
  );
}

interface Props {
  job: PublicJobPosting | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PublicJobDetailModal({ job, isOpen, onClose }: Props) {
  const session = useAuthSession();
  const [imgError, setImgError] = React.useState(false);

  if (!job) return null;

  const isOwnJob = Boolean(
    session.isEmployer &&
    session.companyId &&
    job.company_id &&
    Number(session.companyId) === Number(job.company_id)
  );

  const openJobQuery = job.job_id ? `?open_job=${job.job_id}` : "";
  const targetPath = `/linkbridge/freelancer/jobs${openJobQuery}`;
  const loginHref = `/login?next=${encodeURIComponent(targetPath)}`;
  const signupHref = `/signup?next=${encodeURIComponent(targetPath)}`;
  const companyUrl = job.company_code
    ? `/companies/${job.company_code}`
    : `/companies?search=${encodeURIComponent(job.company_name ?? "")}`;

  const formatSalary = (min?: number | null, max?: number | null, curr?: string) => {
    if (!min && !max) return "Competitive Salary";
    const currency = curr || "PHP";
    const formatter = new Intl.NumberFormat("en-PH", { style: "currency", currency, maximumFractionDigits: 0 });
    if (min && max) return `${formatter.format(min)} - ${formatter.format(max)}`;
    if (min) return `From ${formatter.format(min)}`;
    return `Up to ${formatter.format(max!)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!max-w-3xl w-[92vw] max-h-[88vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="text-left p-4 md:p-6 border-b bg-muted/20 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <a
                href={companyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative h-14 w-14 rounded-2xl border bg-background overflow-hidden flex items-center justify-center shrink-0 shadow-xs hover:opacity-90 transition-opacity"
                title={`View ${job.company_name} details`}
              >
                {job.company_logo_url && !imgError ? (
                  <Image
                    src={job.company_logo_url}
                    alt={job.company_name}
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                    unoptimized
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <Building2 className="h-7 w-7 text-muted-foreground" />
                )}
              </a>
              <div>
                <div className="flex items-center gap-2">
                  <a
                    href={companyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-xs text-muted-foreground hover:text-primary hover:underline transition-colors"
                    title={`View ${job.company_name} details`}
                  >
                    {job.company_name}
                  </a>
                  {job.company_verification_status === "VERIFIED" && (
                    <Badge className="bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20 text-[10px] gap-1">
                      <ShieldCheck className="h-3 w-3" /> Verified Employer
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl font-extrabold text-foreground mt-0.5">
                  {job.job_title}
                </DialogTitle>
                {/* Mobile shows job type before the address (order-* only; the DOM order and the sm: reset keep desktop exactly as it was) */}
                <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 order-3 sm:order-none">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {job.location}
                  </span>
                  <span className="order-2 sm:order-none">•</span>
                  <span className="flex items-center gap-1 order-1 sm:order-none">
                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatJobType(job.job_type)} • {job.work_setup}
                  </span>
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 text-sm">
          {/* Quick Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 md:p-4 rounded-xl border bg-muted/20">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Salary Range</span>
              <span className="font-extrabold text-foreground text-sm flex items-center gap-1 mt-0.5">
                {formatSalary(job.salary_min, job.salary_max, job.salary_currency)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Employment Type</span>
              <span className="font-bold text-foreground text-sm block mt-0.5">{formatJobType(job.job_type)} • {job.work_setup}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Experience Level</span>
              <span className="font-bold text-foreground text-sm block mt-0.5">{job.experience_level || "Any Experience"}</span>
            </div>
          </div>

          {/* Job Overview */}
          <div className="space-y-3">
            <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
              Job Overview
            </h4>
            <div className="text-sm text-foreground leading-relaxed bg-background p-4 rounded-xl border">
              {renderFormattedContent(job.job_description)}
            </div>
          </div>

          {/* Dynamic Role-Aware CTA Card */}
          {session.isJobSeeker ? (
            /* Logged-in Job Seeker View */
            <div className="p-5 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent space-y-4">
              <div className="space-y-1">
                <h5 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Ready to apply for this opportunity?
                </h5>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Submit your profile directly to <strong className="text-foreground">{job.company_name}</strong>. You can track your application status, receive feedback, and schedule interviews.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="sm" className="font-bold text-xs gap-1.5 shadow-xs cursor-pointer">
                  <Link href={targetPath}>
                    Apply Now
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ) : session.isEmployer ? (
            /* Logged-in Employer View */
            <div className={`p-5 rounded-2xl border space-y-4 ${
              isOwnJob
                ? "border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent"
                : "border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent"
            }`}>
              <div className="space-y-1">
                <h5 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <Building2 className={`h-4 w-4 shrink-0 ${isOwnJob ? "text-primary" : "text-warning"}`} />
                  {isOwnJob ? "Your Company Job Posting" : "Signed in as Employer"}
                </h5>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isOwnJob ? (
                    <>
                      You are viewing this job posted by your company (<strong className="text-foreground">{job.company_name}</strong>). You can manage applications, candidate status, and posting details directly in the Client Portal.
                    </>
                  ) : (
                    <>
                      You are currently logged in with an Employer account. This position is posted by <strong className="text-foreground">{job.company_name}</strong>. Job applications are exclusive to Job Seeker accounts. You can manage your own company job postings in the Client Portal.
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {isOwnJob ? (
                  <Button asChild size="sm" className="font-bold text-xs gap-1.5 shadow-xs cursor-pointer">
                    <Link href="/linkbridge/client/jobs" className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Manage Jobs
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild size="sm" className="font-bold text-xs gap-1.5 shadow-xs cursor-pointer">
                      <Link href="/linkbridge/client/jobs" className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Go to Client Portal
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="font-bold text-xs gap-1.5 cursor-pointer">
                      <Link href={loginHref}>
                        <LogIn className="h-3.5 w-3.5" />
                        Sign In as Job Seeker
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Guest / Unauthenticated View */
            <div className="p-5 rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent space-y-4">
              <div className="space-y-1">
                <h5 className="font-bold text-foreground text-sm">
                  Interested in this opportunity?
                </h5>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Create a free Job Seeker account or sign in to submit your application, track application status, and receive job recommendations.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="sm" className="font-bold text-xs gap-1.5 shadow-xs">
                  <Link href={loginHref}>
                    <LogIn className="h-3.5 w-3.5" />
                    Sign In to Apply
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="font-bold text-xs gap-1.5">
                  <Link href={signupHref}>
                    <UserPlus className="h-3.5 w-3.5" />
                    Create Job Seeker Account
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Dynamic Notice Box */}
          {session.isJobSeeker ? (
            <div className="p-3 md:p-3.5 rounded-xl border border-primary/20 bg-primary/10 text-foreground text-xs flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span>
                <strong>Logged In:</strong> You are ready to apply with your active Job Seeker profile.
              </span>
            </div>
          ) : session.isEmployer ? (
            <div className={`p-3 md:p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
              isOwnJob
                ? "border-primary/20 bg-primary/10 text-foreground"
                : "border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/30 dark:border-amber-900/40 text-amber-900 dark:text-amber-300"
            }`}>
              {isOwnJob ? (
                <>
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    <strong>Your Posting:</strong> This job posting belongs to your organization.
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    <strong>Employer Preview:</strong> Viewing another company&apos;s position in public preview mode.
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="p-3 md:p-3.5 rounded-xl border border-muted bg-muted/40 text-muted-foreground text-xs flex items-center gap-2.5">
              <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                <strong>Sign in to apply</strong> — Create a free Job Seeker account or sign in to submit your application.
              </span>
            </div>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}


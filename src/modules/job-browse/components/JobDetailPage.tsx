/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  DollarSign,
  Send,
  Layers,
  HelpCircle,
  ArrowLeft,

  Mail,
  Phone,
  Facebook,

  Instagram,
  Youtube,
  Bookmark,
  Share2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PublicJobPosting, JOB_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS } from "../types";
import { ApplyModal } from "./ApplyModal";
import { useFreelancerBookmarks } from "../../freelancer/freelancer-bookmarks/hooks/useFreelancerBookmarks";
import ReferModal from "../../freelancer/freelancer-referrals/components/ReferModal";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { safeUrl } from "@/lib/safe-url";

interface Props {
  jobId: number;
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
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

export default function JobDetailPage({ jobId }: Props) {
  const router = useRouter();
  const [job, setJob] = useState<PublicJobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [referModalOpen, setReferModalOpen] = useState(false);
  const [referralInfo, setReferralInfo] = useState<{ referrer_name: string; expires_at: string | null } | null>(null);
  const [profileCompletion, setProfileCompletion] = useState<number | null>(null);
  const [now] = useState(() => Date.now());

  const { bookmarkedJobIds, toggleBookmark, fetchBookmarks } = useFreelancerBookmarks();
  const isBookmarked = bookmarkedJobIds.includes(jobId);
  const companyUrl = job?.company_code
    ? `/companies/${job.company_code}`
    : `/companies?search=${encodeURIComponent(job?.company_name ?? "")}`;

  useEffect(() => {
    fetchBookmarks();

    // Check referral claim for this job
    fetch(`/api/freelancer/referrals/check-claim?job_id=${jobId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.claimed) {
          setReferralInfo({
            referrer_name: data.referrer_name,
            expires_at: data.expires_at || null,
          });
        }
      })
      .catch((err) => console.error("Error checking claim in JobDetailPage:", err));

    // Check freelancer profile completion
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
      .catch((err) => console.error("Error checking profile completion in JobDetailPage:", err));
  }, [fetchBookmarks, jobId]);

  useEffect(() => {
    async function loadJob() {
      try {
        const res = await fetch("/api/freelancer/jobs");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load jobs.");
        const matched = (json.jobs as PublicJobPosting[]).find((j) => j.job_id === jobId);
        if (!matched) throw new Error("Job listing not found.");
        setJob(matched);

        const appsRes = await fetch("/api/freelancer/applications");
        if (appsRes.ok) {
          const appsJson = await appsRes.json();
          const apps = appsJson.applications ?? [];
          const exists = apps.some(
            (app: { job_id: number; application_status?: string }) =>
              Number(app.job_id) === jobId &&
              app.application_status !== "HIRED" &&
              app.application_status !== "REJECTED"
          );
          setAlreadyApplied(exists);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "An error occurred.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    loadJob();
  }, [jobId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 min-h-[50vh]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-zinc-400 animate-pulse">Loading job details...</span>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-center space-y-4">
        <div className="inline-flex p-3 bg-rose-50 rounded-full text-rose-500">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Failed to load job listing</h2>
        <p className="text-sm text-muted-foreground">{error || "The job listing may have been closed or removed."}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/vos-sync/freelancer/jobs")}>
          Back to Jobs List
        </Button>
      </div>
    );
  }

  // Employer-supplied socials must pass a scheme allowlist before reaching an href.
  const facebookUrl = safeUrl(job.company_facebook);
  const instagramUrl = safeUrl(job.company_instagram);
  const youtubeUrl = safeUrl(job.company_youtube);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Back button */}
      <Link
        href="/vos-sync/freelancer/jobs"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium mb-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Find Work
      </Link>

      {/* Main Upwork Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Left Column: Job Details */}
        <div className="lg:col-span-2 space-y-6 bg-card border rounded-2xl overflow-hidden shadow-xs">
          {/* Cover Banner */}
          <div className="relative h-48 w-full border-b bg-linear-to-r from-emerald-500/10 to-teal-500/10 shrink-0">
            {job.company_cover ? (
              <img
                src={getImageUrl(job.company_cover)}
                alt="Company Cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800" />
            )}
            {/* Overlapping Company Logo */}
            <a
              href={companyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute -bottom-6 left-8 w-20 h-20 rounded-2xl border-4 border-background bg-muted flex items-center justify-center text-lg font-bold text-foreground overflow-hidden shadow-md z-20 hover:opacity-90 transition-opacity"
              title={`View ${job.company_name ?? "Company"} details`}
            >
              {job.company_logo ? (
                <img src={getImageUrl(job.company_logo)} alt={job.company_name ?? ""} className="w-full h-full object-cover" />
              ) : (
                getInitials(job.company_name)
              )}
            </a>
          </div>

          <div className="px-6 sm:px-8 space-y-5">
            {/* Title Block with compact Referral Badge */}
            <div className="pt-2 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-foreground tracking-tight leading-snug">
                  {job.job_title}
                </h1>
                {referralInfo && (
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/25 text-xs font-semibold px-3 py-1 gap-1.5 rounded-full shrink-0 w-fit"
                  >
                    <span>👥 Referred by {referralInfo.referrer_name}</span>
                    {referralInfo.expires_at && (() => {
                      const diff = new Date(referralInfo.expires_at).getTime() - now;
                      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                      if (days <= 0) return <span className="text-destructive font-bold ml-1">· Expired</span>;
                      if (days === 1) return <span className="text-destructive font-bold ml-1">· ⚠️ Expires tomorrow</span>;
                      return (
                        <span className={days <= 3 ? "text-amber-600 dark:text-amber-400 font-bold ml-1" : "text-muted-foreground ml-1"}>
                          · ⏳ {days}d left
                        </span>
                      );
                    })()}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {job.company_name ? (
                  <a
                    href={companyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary hover:underline font-semibold transition-colors"
                    title={`View ${job.company_name} details`}
                  >
                    {job.company_name}
                  </a>
                ) : (
                  "Unknown Company"
                )}{" "}
                &bull; Posted {job.created_at ? new Date(job.created_at).toLocaleDateString() : ""}
              </p>
            </div>

            <Separator />

            {/* Quick stats grid (Hourly / Fixed info like Upwork) */}
            <div className="grid grid-cols-3 gap-4 py-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm md:text-xs text-muted-foreground">
                  <DollarSign className="h-4 w-4 shrink-0 text-zinc-500" />
                  <span>Salary Type</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{job.salary_type}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm md:text-xs text-muted-foreground">
                  <Briefcase className="h-4 w-4 shrink-0 text-zinc-500" />
                  <span>Job Type</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{JOB_TYPE_LABELS[job.job_type] ?? job.job_type}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm md:text-xs text-muted-foreground">
                  <Layers className="h-4 w-4 shrink-0 text-zinc-500" />
                  <span>Experience Level</span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {job.experience_level ? EXPERIENCE_LEVEL_LABELS[job.experience_level] : "Not Specified"}
                </p>
              </div>
            </div>

            <Separator />

            {/* Job Description */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Job Description</h3>
              {renderFormattedContent(job.job_description)}
            </div>

            {/* Responsibilities */}
            {job.job_responsibilities && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Responsibilities</h3>
                  {renderFormattedContent(job.job_responsibilities)}
                </div>
              </>
            )}

            {/* Qualifications */}
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Qualifications</h3>
              {renderFormattedContent(job.job_qualifications)}
            </div>

            {/* Required Skills */}
            {job.skills && job.skills.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Skills and Expertise</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {job.skills.map((s) => (
                      <Badge key={s.id} variant="secondary" className="text-xs px-2.5 py-1 rounded-full font-normal">
                        {s.skill_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Benefits */}
            {job.benefits && job.benefits.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Benefits</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {job.benefits.map((b) => (
                      <span
                        key={b}
                        className="inline-flex items-center text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-200/50"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Screening Questions preview */}
            {job.screening_questions && job.screening_questions.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Screening Questions ({job.screening_questions.length})</h3>
                  <div className="space-y-2">
                    {job.screening_questions.map((q, i) => {
                      const qText = typeof q === "object" && q !== null ? q.question_text : String(q);
                      return (
                        <div key={i} className="flex items-start gap-2.5 text-sm text-foreground/70 bg-muted/40 rounded-xl p-4">
                          <HelpCircle className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                          <span>{qText}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Actions / About Client Sidebar */}
        <div className="space-y-6">
          {/* Strict Profile Completion Requirement Alert */}
          {profileCompletion !== null && profileCompletion < 100 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-5 shadow-xs dark:border-amber-900/60 dark:bg-amber-950/25 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                    Profile Completion Required to Apply
                  </h4>
                  <p className="text-xs text-amber-900/90 dark:text-amber-300/90 leading-relaxed">
                    LinkBridge requires candidates to complete their profile (currently <strong>{profileCompletion}%</strong>) before submitting applications.
                  </p>
                  <p className="text-xs text-amber-800/80 dark:text-amber-400/80 leading-relaxed">
                    Don&apos;t worry—this job has already been saved to your <strong>Bookmarked Jobs</strong> so you can easily apply right after completing your profile!
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1.5">
                    <Link
                      href="/vos-sync/freelancer/profile"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors"
                    >
                      <span>Complete Profile Now</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href="/vos-sync/freelancer/bookmarks"
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-200/50 dark:hover:bg-amber-900/40 transition-colors"
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      <span>View Saved Jobs</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card 1: Apply / Action card */}
          <div className="bg-card border rounded-2xl p-6 shadow-xs space-y-4">
            <Button
              id="job-page-apply-btn"
              onClick={() => setApplyModalOpen(true)}
              disabled={alreadyApplied || (profileCompletion !== null && profileCompletion < 100)}
              title={
                profileCompletion !== null && profileCompletion < 100
                  ? "You must complete your profile (100%) before applying"
                  : alreadyApplied
                    ? "Already Applied"
                    : "Apply for Job"
              }
              className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium gap-2 border-0 shadow-xs disabled:bg-zinc-100 disabled:text-zinc-400 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-600 disabled:cursor-not-allowed max-md:min-h-11"
            >
              <Send className="h-4 w-4" />
              {alreadyApplied ? "Already Applied" : "Apply for Job"}
            </Button>
            <Button
              variant="outline"
              className={`w-full h-10 rounded-xl font-medium gap-2 transition-colors max-md:min-h-11 ${isBookmarked
                  ? "border-primary text-primary hover:bg-primary/5"
                  : "text-foreground border-zinc-200 dark:border-zinc-800"
                }`}
              onClick={() => toggleBookmark(jobId)}
            >
              <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />
              {isBookmarked ? "Saved" : "Save Job"}
            </Button>
            <Button
              variant="outline"
              className="w-full h-10 rounded-xl font-medium gap-2 text-foreground border-zinc-200 dark:border-zinc-800 max-md:min-h-11"
              onClick={() => setReferModalOpen(true)}
            >
              <Share2 className="h-4 w-4" />
              Refer a Friend
            </Button>
          </div>

          {/* Card 2: About Client */}
          <div className="bg-card border rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground">About the client</h3>

            <div className="space-y-4 text-xs">
              {/* <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#14a800]" />
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Payment method verified</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[#14a800]" />
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Phone number verified</span>
              </div>
              
              <Separator /> */}

              {/* Location */}
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Location</span>
                <span className="text-sm md:text-xs font-semibold text-foreground">
                  {[job.company_address, job.company_city, job.company_province].filter(Boolean).join(", ") || job.job_location}
                </span>
              </div>

              {/* Email */}
              {job.company_email && (
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Company Email</span>
                  <div className="flex items-center gap-1.5 text-sm md:text-xs text-foreground font-semibold truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    <span className="truncate" title={job.company_email}>{job.company_email}</span>
                  </div>
                </div>
              )}

              {/* Contact */}
              {job.company_contact && (
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Company Contact</span>
                  <div className="flex items-center gap-1.5 text-sm md:text-xs text-foreground font-semibold">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    <span>{job.company_contact}</span>
                  </div>
                </div>
              )}

              {/* Socials */}
              {(facebookUrl || instagramUrl || youtubeUrl) && (
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Social Media</span>
                  <div className="flex flex-wrap gap-2">
                    {facebookUrl && (
                      <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-muted hover:bg-muted/80 rounded-lg text-zinc-600 dark:text-zinc-400 max-md:size-11 max-md:grid max-md:place-items-center">
                        <Facebook className="h-4 w-4" />
                      </a>
                    )}

                    {instagramUrl && (
                      <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-muted hover:bg-muted/80 rounded-lg text-zinc-600 dark:text-zinc-400 max-md:size-11 max-md:grid max-md:place-items-center">
                        <Instagram className="h-4 w-4" />
                      </a>
                    )}
                    {youtubeUrl && (
                      <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-muted hover:bg-muted/80 rounded-lg text-zinc-600 dark:text-zinc-400 max-md:size-11 max-md:grid max-md:place-items-center">
                        <Youtube className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Job Post Status</span>
                <span className="text-sm md:text-xs font-semibold text-foreground">Active ({job.number_of_openings} openings)</span>
              </div>
            </div>
          </div>

          {/* Card 3: Job Link / Share */}
          <div className="bg-card border rounded-2xl p-6 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-foreground">Job Link</h3>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={typeof window !== "undefined" ? window.location.href : ""}
                className="w-full h-9 bg-muted/60 border rounded-lg text-base md:text-xs pl-3 pr-20 text-muted-foreground truncate focus:outline-none"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyLink}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 text-[10px] px-2 rounded-md font-semibold text-primary hover:bg-primary/10 max-md:min-h-11"
              >
                {copied ? "Copied" : "Copy Link"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      <ApplyModal
        job={job}
        open={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
        onSuccess={() => {
          setAlreadyApplied(true);
          router.push("/vos-sync/freelancer/applications");
        }}
      />

      {/* Refer Modal */}
      <ReferModal
        jobId={jobId}
        jobTitle={job.job_title}
        open={referModalOpen}
        onClose={() => setReferModalOpen(false)}
      />
    </div>
  );
}

interface AlertCircleProps {
  className?: string;
}

function AlertCircle({ className }: AlertCircleProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
    </svg>
  );
}

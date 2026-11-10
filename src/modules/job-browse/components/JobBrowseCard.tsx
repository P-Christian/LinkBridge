"use client";

import React from "react";
import Image from "next/image";
import { MapPin, Briefcase, Clock, Building2, ChevronRight, Wifi, Users, Bookmark, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PublicJobPosting, JOB_TYPE_LABELS } from "../types";

interface Props {
  job: PublicJobPosting;
  onViewDetail: (job: PublicJobPosting) => void;
  isBookmarked: boolean;
  onToggleBookmark: (jobId: number) => void;
  referralInfo?: { referrer_name: string; expires_at: string | null } | null;
}

function formatSalary(job: PublicJobPosting): string {
  if (job.salary_negotiable) return "Negotiable";
  const currency = job.currency ?? "PHP";
  if (job.salary_type === "Fixed Salary" && job.salary_min) {
    return `${currency} ${Number(job.salary_min).toLocaleString()}`;
  }
  if (job.salary_min && job.salary_max) {
    return `${currency} ${Number(job.salary_min).toLocaleString()} – ${Number(job.salary_max).toLocaleString()}`;
  }
  if (job.salary_min) {
    return `${currency} ${Number(job.salary_min).toLocaleString()}+`;
  }
  return "Salary not disclosed";
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const arrangementIcon: Record<string, React.ElementType> = {
  Remote: Wifi,
  Hybrid: Users,
  "On-site": Building2,
};

function getImageUrl(value: string | null | undefined): string {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }
  return `/api/client/assets/${value}`;
}

export function JobBrowseCard({ job, onViewDetail, isBookmarked, onToggleBookmark, referralInfo }: Props) {
  const [now] = React.useState(() => Date.now());
  const ArrangeIcon = arrangementIcon[job.work_arrangement] ?? Briefcase;
  const companyUrl = job.company_code
    ? `/companies/${job.company_code}`
    : `/companies?search=${encodeURIComponent(job.company_name ?? "")}`;

  const expiresAt = referralInfo?.expires_at;
  const countdown = React.useMemo(() => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return { label: "Expired", isUrgent: true };
    if (days === 1) return { label: "Expires tomorrow", isUrgent: true };
    if (days <= 3) return { label: `${days}d left`, isUrgent: true };
    return { label: `${days}d left`, isUrgent: false };
  }, [expiresAt, now]);

  return (
    <div
      className="group bg-card border border-border/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200 cursor-pointer flex flex-col justify-between h-full gap-4"
      onClick={() => onViewDetail(job)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onViewDetail(job)}
    >
      <div className="space-y-3.5 flex-1">
        {/* Header */}
        <div className="flex items-start gap-3 justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Company Avatar */}
            <a
              href={companyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-11 h-11 rounded-xl border border-border/70 bg-muted/60 flex items-center justify-center text-sm font-bold text-foreground shrink-0 overflow-hidden hover:opacity-85 transition-opacity relative"
              title={`View ${job.company_name ?? "Company"} details`}
            >
              {job.company_logo ? (
                <Image
                  src={getImageUrl(job.company_logo)}
                  alt={job.company_name ?? "Company logo"}
                  width={44}
                  height={44}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                getInitials(job.company_name)
              )}
            </a>

            <div className="min-w-0 flex-1">
              <h3 className="text-base md:text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {job.job_title}
              </h3>
              {job.company_name ? (
                <a
                  href={companyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors truncate mt-0.5 inline-block max-w-full"
                  title={`View ${job.company_name} details`}
                >
                  {job.company_name}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground truncate mt-0.5">—</p>
              )}
            </div>
          </div>

          {timeAgo(job.created_at) && (
            <span className="text-[11px] text-muted-foreground font-medium shrink-0 pt-0.5">
              {timeAgo(job.created_at)}
            </span>
          )}
        </div>

        {/* Meta pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {referralInfo && (
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/25 text-[11px] font-semibold px-2 py-0.5 gap-1 rounded-md"
            >
              <UserCheck className="h-3 w-3" />
              <span>{referralInfo.referrer_name ? `Referred by ${referralInfo.referrer_name}` : "Referred"}</span>
              {countdown && (
                <span className={countdown.isUrgent ? "text-amber-600 dark:text-amber-400 font-bold ml-1" : "text-muted-foreground ml-1"}>
                  · ⏳ {countdown.label}
                </span>
              )}
            </Badge>
          )}
          {job.job_location && (
            <span
              className="inline-flex items-center gap-1 text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md max-w-[150px]"
              title={job.job_location}
            >
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{job.job_location}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md shrink-0">
            <Briefcase className="h-3 w-3" />
            {JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md shrink-0">
            <ArrangeIcon className="h-3 w-3" />
            {job.work_arrangement}
          </span>
          {job.number_of_openings > 1 && (
            <span className="inline-flex items-center gap-1 text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md shrink-0">
              <Users className="h-3 w-3" />
              {job.number_of_openings} openings
            </span>
          )}
        </div>

        {/* Skills */}
        <div className="flex flex-wrap gap-1.5 min-h-[22px] items-center">
          {job.skills && job.skills.length > 0 ? (
            <>
              {job.skills.slice(0, 3).map((s) => (
                <Badge
                  key={s.id}
                  variant="secondary"
                  className="text-[10px] px-2 py-0.5 h-auto rounded-md font-normal max-w-[130px] inline-flex items-center"
                  title={s.skill_name}
                >
                  <span className="truncate">{s.skill_name}</span>
                </Badge>
              ))}
              {job.skills.length > 3 && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0.5 h-auto rounded-md font-normal text-muted-foreground shrink-0"
                >
                  +{job.skills.length - 3} more
                </Badge>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-auto">
        <div className="flex items-center gap-1.5 text-sm md:text-xs text-muted-foreground min-w-0 pr-2">
          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="font-semibold text-foreground truncate">{formatSalary(job)}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 max-md:size-11"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark(job.job_id);
            }}
            title={isBookmarked ? "Remove Bookmark" : "Save Job"}
          >
            <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-primary text-primary" : ""}`} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-sm md:text-xs font-medium gap-1 text-primary hover:text-primary hover:bg-primary/10 rounded-lg px-2.5 max-md:min-h-11"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetail(job);
            }}
          >
            View <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

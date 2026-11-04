// src/modules/freelancer/freelancer-bookmarks/components/BookmarkList.tsx
"use client";

import React from "react";
import Link from "next/link";
import { BookmarkedJob } from "../types";
import { MapPin, Briefcase, Clock, Building2, ChevronRight, Wifi, Users, Bookmark, BookmarkMinus, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  bookmarks: BookmarkedJob[];
  onRemoveBookmark: (jobId: number) => void;
}

function formatSalary(job: BookmarkedJob): string {
  if (job.salary_negotiable) return "Negotiable";
  const currency = job.currency ?? "PHP";
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

function formatExpirationCountdown(expiresAt?: string | null): { label: string; isUrgent: boolean } | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return { label: "Expired", isUrgent: true };
  if (days === 1) return { label: "Expires tomorrow", isUrgent: true };
  if (days <= 3) return { label: `${days}d left`, isUrgent: true };
  return { label: `${days}d left`, isUrgent: false };
}

const JOB_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: "Full-Time",
  PART_TIME: "Part-Time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  FREELANCE: "Freelance",
};

export const BookmarkList: React.FC<Props> = ({ bookmarks, onRemoveBookmark }) => {
  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="p-4 bg-muted/40 rounded-2xl">
          <BookmarkMinus className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">No saved jobs</p>
          <p className="text-muted-foreground max-w-sm mx-auto mt-1">
            You haven&apos;t bookmarked any jobs yet.
          </p>
        </div>
        <Button variant="outline" className="mt-2 max-md:min-h-11" asChild>
          <Link href="/vos-sync/freelancer/jobs">
            Browse Jobs
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {bookmarks.map((job) => {
        const ArrangeIcon = arrangementIcon[job.work_arrangement ?? ""] ?? Briefcase;

        return (
          <div
            key={job.bookmark_id}
            className="group bg-card border rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 flex flex-col gap-4"
          >
            {/* Header */}
            <div className="flex items-start gap-3 relative">
              {/* Company Avatar */}
              <div className="w-11 h-11 rounded-xl border bg-muted flex items-center justify-center text-sm font-bold text-foreground shrink-0 overflow-hidden">
                {job.company_logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getImageUrl(job.company_logo)} alt={job.company_name ?? ""} className="w-full h-full object-cover" />
                ) : (
                  getInitials(job.company_name)
                )}
              </div>

              <div className="flex-1 min-w-0 pr-8">
                <Link href={`/vos-sync/freelancer/jobs/${job.job_id}`} className="max-md:min-h-11 max-md:flex max-md:items-center">
                  <h3 className="text-base md:text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors cursor-pointer">
                    {job.job_title}
                  </h3>
                </Link>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {job.company_name ?? "—"}
                </p>
              </div>

              {/* Bookmark Toggle */}
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-0 right-0 h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary max-md:size-11"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveBookmark(job.job_id);
                }}
                title="Remove Bookmark"
              >
                <Bookmark className="h-4 w-4 fill-current" />
              </Button>
            </div>

            {/* Meta pills */}
            <div className="flex flex-wrap gap-2 items-center">
              {job.is_referred && (
                <>
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/25 text-[11px] font-semibold px-2 py-0.5 gap-1 rounded-full"
                  >
                    <UserCheck className="h-3 w-3" />
                    {job.referrer_name ? `Referred by ${job.referrer_name}` : "Referred"}
                  </Badge>
                  {(() => {
                    const countdown = formatExpirationCountdown(job.referral_expires_at);
                    if (!countdown) return null;
                    return (
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          countdown.isUrgent
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400"
                            : "bg-muted text-muted-foreground border-border/50"
                        }`}
                      >
                        ⏳ {countdown.label}
                      </span>
                    );
                  })()}
                </>
              )}
              {job.job_location && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                  <MapPin className="h-3 w-3" />
                  {job.job_location}
                </span>
              )}
              {job.job_type && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                  <Briefcase className="h-3 w-3" />
                  {JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
                </span>
              )}
              {job.work_arrangement && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                  <ArrangeIcon className="h-3 w-3" />
                  {job.work_arrangement}
                </span>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50 max-md:flex-wrap max-md:gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground max-md:min-w-0">
                <Clock className="h-3 w-3" />
                <span className="font-medium text-foreground max-md:truncate">{formatSalary(job)}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10 rounded-lg px-2 max-md:min-h-11"
                asChild
              >
                <Link href={`/vos-sync/freelancer/jobs/${job.job_id}`}>
                  View <ChevronRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

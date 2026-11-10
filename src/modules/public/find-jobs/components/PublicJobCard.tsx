// src/modules/public/find-jobs/components/PublicJobCard.tsx
"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Building2, MapPin, Briefcase, Clock, ShieldCheck, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PublicJobPosting } from "../types";
import { useAuthSession } from "@/hooks/useAuthSession";
import { formatJobType } from "@/lib/utils";

import { motion } from "framer-motion";

interface Props {
  job: PublicJobPosting;
  onSelectJob: (job: PublicJobPosting) => void;
  onApplyClick: (job: PublicJobPosting) => void;
  index?: number;
}

function getTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "Just posted";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return "Recently posted";
}

export function PublicJobCard({ job, onSelectJob, onApplyClick, index = 0 }: Props) {
  const session = useAuthSession();
  const [imgError, setImgError] = useState(false);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const formatSalary = (min?: number | null, max?: number | null, curr?: string) => {
    if (!min && !max) return "Competitive Salary";
    const currency = curr || "PHP";
    const formatter = new Intl.NumberFormat("en-PH", { style: "currency", currency, maximumFractionDigits: 0 });
    if (min && max) return `${formatter.format(min)} - ${formatter.format(max)}`;
    if (min) return `From ${formatter.format(min)}`;
    return `Up to ${formatter.format(max!)}`;
  };

  const companyUrl = job.company_code
    ? `/companies/${job.company_code}`
    : `/companies?search=${encodeURIComponent(job.company_name ?? "")}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4), ease: [0.21, 0.45, 0.27, 0.9] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onPointerMove={handlePointerMove}
      onClick={() => onSelectJob(job)}
      className="group relative overflow-hidden bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 rounded-2xl px-5 pt-5 pb-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgba(37,99,235,0.12)] hover:border-primary/40 transition-all duration-300 cursor-pointer flex flex-col justify-between gap-4"
    >
      {/* Pointer Hover Spotlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:hidden"
        style={{
          background:
            "radial-gradient(400px circle at var(--mx, 50%) var(--my, 50%), hsl(var(--info) / 0.12), transparent 60%)",
        }}
      />

      <div className="relative space-y-3">
        {/* Top Header: Logo + Title + Verified Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <a
              href={companyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="relative h-12 w-12 rounded-xl border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
              title={`View ${job.company_name} details`}
            >
              {job.company_logo_url && !imgError ? (
                <Image
                  src={job.company_logo_url}
                  alt={job.company_name}
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                  unoptimized
                  onError={() => setImgError(true)}
                />
              ) : (
                <Building2 className="h-6 w-6 text-muted-foreground" />
              )}
            </a>
            <div>
              <div className="flex items-center gap-1.5">
                <a
                  href={companyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-xs text-muted-foreground hover:text-primary hover:underline transition-colors truncate max-w-[200px]"
                  title={`View ${job.company_name} details`}
                >
                  {job.company_name}
                </a>
                {job.company_verification_status === "VERIFIED" && (
                  <span title="Verified Employer" className="inline-flex">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  </span>
                )}
              </div>
              <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                {job.job_title}
              </h3>
            </div>
          </div>

          <Badge variant="outline" className="text-[10px] uppercase font-semibold shrink-0 bg-muted/20">
            {job.work_setup}
          </Badge>
        </div>

        {/* Short Job Description Snippet */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {(job.job_description ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}
        </p>

        {/* Pills & Meta info */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <Badge variant="secondary" className="text-[10px] font-semibold">
            <Briefcase className="h-3 w-3 mr-1" />
            {formatJobType(job.job_type)}
          </Badge>

          <span className="text-muted-foreground text-[11px] flex items-center gap-1">
            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
            {job.location}
          </span>
        </div>
      </div>

      {/* Footer: Salary + Posted Date + Action CTA */}
      <div className="relative pt-3 border-t border-border/70 flex items-center justify-between gap-2 text-xs">
        <div className="space-y-0.5">
          <span className="font-bold text-foreground text-sm flex items-center gap-1">
            {formatSalary(job.salary_min, job.salary_max, job.salary_currency)}
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {getTimeAgo(job.created_at)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {session.isJobSeeker ? (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onApplyClick(job);
              }}
              className="h-8 text-xs font-semibold gap-1.5 rounded-full bg-gradient-to-r from-primary to-sky-600 text-white shadow-xs hover:shadow-[0_4px_16px_rgba(37,99,235,0.4)] hover:brightness-110 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 cursor-pointer [&>svg]:transition-transform [&>svg]:duration-200 hover:[&>svg]:translate-x-1"
            >
              Apply Now
              <ArrowRight className="h-3 w-3" />
            </Button>
          ) : session.isEmployer ? (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSelectJob(job);
              }}
              className="h-8 text-xs font-semibold gap-1.5 rounded-full border-border/80 bg-white/70 dark:bg-card/70 backdrop-blur-md text-foreground group-hover:border-primary/40 hover:!bg-primary hover:!text-white hover:!border-primary hover:shadow-[0_4px_16px_rgba(37,99,235,0.3)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 cursor-pointer [&>svg]:transition-transform [&>svg]:duration-200 hover:[&>svg]:translate-x-1"
            >
              View Details
              <ArrowRight className="h-3 w-3" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onApplyClick(job);
              }}
              className="h-8 text-xs font-semibold gap-1.5 rounded-full bg-gradient-to-r from-primary to-sky-600 text-white shadow-xs hover:shadow-[0_4px_16px_rgba(37,99,235,0.4)] hover:brightness-110 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 cursor-pointer [&>svg]:transition-transform [&>svg]:duration-200 hover:[&>svg]:translate-x-1"
            >
              Sign In to Apply
              <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}


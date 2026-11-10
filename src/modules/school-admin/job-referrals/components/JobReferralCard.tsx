// src/modules/school-admin/job-referrals/components/JobReferralCard.tsx
"use client";

import React, { useState } from 'react';
import { VsJobPosting } from '../types/job-referrals.types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Briefcase,
  MapPin,
  Building2,
  Users,
  Send,
  GraduationCap,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatSalary, stripHtmlTags } from '../utils/formatting';
import { sanitizeHtml } from '@/lib/sanitize-html';

interface JobReferralCardProps {
  job: VsJobPosting;
  onRefer: (job: VsJobPosting) => void;
}

function FormattedContent({
  html,
  fallbackText,
  isExpanded,
}: {
  html?: string | null;
  fallbackText?: string | null;
  isExpanded?: boolean;
}) {
  const content = html || fallbackText;
  if (!content) return null;

  const hasHtml = /<(p|ul|ol|li|b|strong|em|br|div)\b[^>]*>/i.test(content);

  if (hasHtml) {
    return (
      <div
        className={`text-sm text-foreground/85 leading-relaxed space-y-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:font-semibold [&_b]:font-semibold ${
          !isExpanded ? 'line-clamp-3' : ''
        }`}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
      />
    );
  }

  return (
    <p
      className={`text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap ${
        !isExpanded ? 'line-clamp-3' : ''
      }`}
    >
      {content}
    </p>
  );
}

export function JobReferralCard({ job, onRefer }: JobReferralCardProps) {
  const [showFullQuals, setShowFullQuals] = useState(false);
  const formatJobType = (t: string) => t.replace('_', ' ');

  const plainQuals = stripHtmlTags(job.job_qualifications);
  const isQualsLong = plainQuals.length > 150 || (job.job_qualifications && job.job_qualifications.includes('<li'));

  return (
    <Card className="hover:border-primary/40 transition-all duration-200 hover:shadow-md border-border/80 bg-card/90 overflow-hidden">
      <CardContent className="p-5 sm:p-6 space-y-4">
        {/* Top Bar: Company Badge, Tags & Badges */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-primary/10 text-primary">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              {job.company_name || 'VOS Partner Company'}
            </span>
            <Badge variant="outline" className="text-xs font-medium">
              {job.job_category}
            </Badge>
            <Badge
              variant="secondary"
              className="text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50"
            >
              {formatJobType(job.job_type)}
            </Badge>
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
              {job.work_arrangement}
            </Badge>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground/80 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Active Referral Partner</span>
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5">
          <h3 className="text-lg sm:text-xl font-bold text-foreground hover:text-primary transition-colors cursor-pointer">
            {job.job_title}
          </h3>
          <div className="pt-0.5">
            <FormattedContent html={job.job_description} fallbackText={job.job_description} isExpanded={false} />
          </div>
        </div>

        {/* Spacious Key Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1 text-xs">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/60">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate text-foreground/80 font-medium" title={job.job_location}>
              {job.job_location || 'Not specified'}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/60">
            <Briefcase className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate text-foreground/80 font-medium">
              {formatSalary(job.salary_min, job.salary_max, job.currency)}
              {job.salary_type ? ` • ${job.salary_type}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/60">
            <Users className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="truncate text-foreground/80 font-medium">
              {job.number_of_openings} {job.number_of_openings === 1 ? 'Opening' : 'Openings'}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/60">
            <GraduationCap className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="truncate text-foreground/80 font-medium" title={job.education || 'Open to all students'}>
              {job.education || 'Open to all students'}
            </span>
          </div>
        </div>

        {/* Qualifications Section */}
        {job.job_qualifications && (
          <div className="bg-muted/30 rounded-xl p-3.5 border border-border/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                Target Candidate Qualifications
              </span>
              {isQualsLong && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullQuals((prev) => !prev)}
                  className="h-6 px-2 text-[11px] text-primary hover:text-primary/90 flex items-center gap-1"
                >
                  {showFullQuals ? (
                    <>
                      Show less <ChevronUp className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      Show all <ChevronDown className="w-3 h-3" />
                    </>
                  )}
                </Button>
              )}
            </div>
            <FormattedContent
              html={job.job_qualifications}
              fallbackText={job.job_qualifications}
              isExpanded={showFullQuals}
            />
          </div>
        )}

        {/* Bottom Action Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 order-2 sm:order-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            Endorsement will issue an official verifiable institutional referral
          </span>

          <div className="flex items-center gap-3 order-1 sm:order-2 shrink-0">
            <Button
              onClick={() => onRefer(job)}
              className="w-full sm:w-auto px-5 h-9 gap-2 shadow-xs font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <Send className="w-4 h-4" />
              Refer Students
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

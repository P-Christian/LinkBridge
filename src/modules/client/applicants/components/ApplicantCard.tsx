// src/modules/client/applicants/components/ApplicantCard.tsx
"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User,
  Mail,
  Briefcase,
  Clock,
  GraduationCap,
  CalendarPlus,
  ChevronRight,
  MessageSquare,
  FileText,
  CheckCircle2,
  MoreVertical,
  Edit3,
  ClipboardCheck,
} from "lucide-react";
import { Applicant, ApplicationStatus, STATUS_LABELS } from "../types";
import { STAGE_COLOR_CLASSES } from "@/modules/client/pipeline/types";
import { getApplicantAvatarUrl, getInitials, timeAgo } from "../utils/applicantUtils";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  APPLIED: "bg-info/10 text-info border-info/20",
  UNDER_REVIEW: "bg-primary/10 text-primary border-primary/20",
  SHORTLISTED: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-300",
  INTERVIEWING: "bg-warning/10 text-warning border-warning/20",
  HIRED: "bg-success/10 text-success border-success/20",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/20",
  WITHDRAWN: "bg-muted text-muted-foreground border-border/80",
};

const AVATAR_TONES = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-fuchsia-600",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-cyan-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

interface ApplicantCardProps {
  applicant: Applicant;
  onUpdateStatus: (applicant: Applicant) => void;
  onQuickStageUpdate?: (applicant: Applicant, toStageId: number, stageName: string) => void;
  onScheduleInterview: (applicant: Applicant) => void;
  onViewScheduledInterview?: (interviewId: number) => void;
  onViewDetails: (applicant: Applicant) => void;
  onReviewAssessment?: (applicant: Applicant) => void;
}

export default function ApplicantCard({
  applicant,
  onUpdateStatus,
  onQuickStageUpdate,
  onScheduleInterview,
  onViewScheduledInterview,
  onViewDetails,
  onReviewAssessment,
}: ApplicantCardProps) {
  const [imageError, setImageError] = useState(false);
  const rawImage = applicant.applicant_profile_image_url || applicant.profile_image_url;
  const avatarUrl = getApplicantAvatarUrl(rawImage);
  const initials = getInitials(applicant.applicant_name);
  const avatarTone = AVATAR_TONES[hashString(applicant.applicant_name || String(applicant.application_id)) % AVATAR_TONES.length];

  // Canonical stage authority for interview operations:
  // Available when candidate is in an INTERVIEW stage (or legacy unmigrated status)
  const isInterviewEligible =
    applicant.stage_type === "INTERVIEW" ||
    (!applicant.stage_type &&
      (applicant.application_status === "SHORTLISTED" ||
        applicant.application_status === "INTERVIEWING"));

  const isAssessmentStage = applicant.stage_type === "ASSESSMENT";

  return (
    <Card
      role="button"
      tabIndex={0}
      title="View candidate profile"
      onClick={() => onViewDetails(applicant)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onViewDetails(applicant);
        }
      }}
      className="group relative overflow-hidden rounded-2xl border border-primary/10 hover:border-primary/30 bg-card/75 dark:bg-card/55 backdrop-blur-xl shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Left Side: Avatar + Stacked Info */}
          <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
            {/* Candidate Avatar */}
            <div className="relative shrink-0">
              <div className="h-12 w-12 rounded-full overflow-hidden ring-2 ring-background border border-primary/15 bg-muted/60 flex items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-105">
                {avatarUrl && !imageError ? (
                  <Image
                    src={avatarUrl}
                    alt={applicant.applicant_name || "Applicant Avatar"}
                    width={48}
                    height={48}
                    className="h-full w-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className={`h-full w-full bg-gradient-to-br ${avatarTone} flex items-center justify-center text-white font-bold text-sm tracking-wide`}>
                    {initials}
                  </div>
                )}
              </div>
            </div>

            {/* Candidate Info */}
            <div className="min-w-0 flex-1 space-y-1.5">
              {/* Row 1: Name, Target Job Title, Email, Referral */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                  {applicant.applicant_name ?? `Applicant #${applicant.application_id}`}
                </h3>

                {applicant.job_title && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                    <Briefcase className="h-3 w-3" />
                    {applicant.job_title}
                  </span>
                )}

                {applicant.applicant_email && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3 text-muted-foreground/70" />
                    {applicant.applicant_email}
                  </span>
                )}

                {applicant.is_referred && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px] font-semibold py-0.5 px-2 gap-1 rounded-full",
                      applicant.referral_type === "SCHOOL_ADMIN"
                        ? "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                        : "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                    )}
                  >
                    {applicant.referral_type === "SCHOOL_ADMIN" ? (
                      <>
                        🎓 {applicant.referral_school_name ? `Endorsed by ${applicant.referral_school_name}` : "School Endorsed"}
                      </>
                    ) : (
                      <>
                        👥 Peer Referral
                      </>
                    )}
                  </Badge>
                )}
              </div>

              {/* Row 2: Secondary Stats (Structured Chips) */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border/50">
                  <User className="h-3 w-3 text-muted-foreground/70" />
                  {applicant.experience_years} yrs exp
                </span>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border/50">
                  <Briefcase className="h-3 w-3 text-muted-foreground/70" />
                  {applicant.work_experience_count} {applicant.work_experience_count === 1 ? "job" : "jobs"}
                </span>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border/50">
                  <FileText className="h-3 w-3 text-muted-foreground/70" />
                  {(applicant.resume_count ?? 0) > 0 ? "1 resume" : "0 resumes"}
                </span>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border/50">
                  <CheckCircle2 className="h-3 w-3 text-muted-foreground/70" />
                  {applicant.profile_completion}% profile
                </span>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border/50">
                  <Clock className="h-3 w-3 text-muted-foreground/70" />
                  Applied {timeAgo(applicant.applied_at)}
                </span>
              </div>

              {/* Row 3: Education preview */}
              {(applicant.education_count ?? applicant.education?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {(() => {
                    const preview = (applicant.education ?? [])[0];
                    const total = applicant.education_count ?? applicant.education?.length ?? 0;
                    const label = preview
                      ? [preview.school_name, preview.course_name].filter(Boolean).join(" · ") || "Education on file"
                      : [applicant.education_school, applicant.education_course].filter(Boolean).join(" · ") || "Education on file";
                    return (
                      <>
                        <span className="inline-flex items-center gap-1.5 min-w-0 px-2 py-0.5 rounded-md bg-muted/30 border border-border/40">
                          <GraduationCap className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                          <span className="truncate max-w-[320px] sm:max-w-md">{label}</span>
                        </span>
                        {total > 1 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                            +{total - 1} more
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Status Badge Column + Action Buttons */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0 self-end xl:self-center pt-2 xl:pt-0 border-t xl:border-t-0 border-border/50 w-full xl:w-auto justify-between xl:justify-end">
            {/* Status Badges */}
            <div className="shrink-0 flex items-center gap-1.5 flex-wrap">
              <motion.div
                key={applicant.current_stage_id ?? applicant.application_status}
                initial={{ scale: 0.82, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 450, damping: 26 }}
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-semibold px-2.5 py-0.5 rounded-full border transition-all duration-200 shadow-2xs md:text-[11px]",
                    STAGE_COLOR_CLASSES[applicant.stage_color || "sky"]?.badge ||
                      STATUS_STYLES[applicant.application_status]
                  )}
                >
                  {applicant.stage_name || STATUS_LABELS[applicant.application_status] || applicant.application_status}
                </Badge>
              </motion.div>
              {applicant.assessment_needs_review ? (
                <Badge
                  variant="outline"
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 whitespace-nowrap flex items-center gap-1"
                >
                  <ClipboardCheck className="h-3 w-3" />
                  Assessment to review
                </Badge>
              ) : null}
            </div>

            {/* Action Buttons Group */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
              {/* Contextual Action: If Assessment Needs Review, direct Review Assessment button */}
              {applicant.assessment_needs_review && onReviewAssessment ? (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReviewAssessment(applicant);
                  }}
                  className="h-8 max-md:min-h-10 px-3 text-xs font-semibold rounded-lg gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  Review Assessment
                </Button>
              ) : isInterviewEligible ? (
                applicant.active_interview_id ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onViewScheduledInterview && applicant.active_interview_id) {
                        onViewScheduledInterview(applicant.active_interview_id);
                      }
                    }}
                    className="h-8 max-md:min-h-10 px-3 text-xs font-medium rounded-lg gap-1.5 border-border hover:bg-muted shadow-xs cursor-pointer"
                  >
                    <CalendarPlus className="h-3.5 w-3.5 text-primary" />
                    View Interview
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onScheduleInterview(applicant);
                    }}
                    className="h-8 max-md:min-h-10 px-3 text-xs font-medium rounded-lg gap-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                    Schedule Interview
                  </Button>
                )
              ) : null}

              {/* Message Button */}
              <Link
                href={`/linkbridge/client/messaging?freelancer_id=${applicant.user_id}&job_id=${applicant.job_id}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 max-md:min-h-10 px-3 text-xs font-medium rounded-lg gap-1.5 border-border hover:bg-muted cursor-pointer"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  Message
                </Button>
              </Link>

              {/* 3 Dots Actions (Pipeline-Driven Stage Progression) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => e.stopPropagation()}
                    className="h-8 w-8 p-0 max-md:size-10 max-md:p-0 max-md:shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                    aria-label="More candidate actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider md:text-[10px]">
                    Stage Progression
                  </DropdownMenuLabel>

                  {isAssessmentStage && (
                    <>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onReviewAssessment?.(applicant);
                        }}
                        className="text-sm gap-2 cursor-pointer py-1.5 max-md:min-h-10 font-medium md:text-xs"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />
                        Review Assessment
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  {/* Dynamic Destinations from Active Job Pipeline */}
                  {applicant.allowed_next_stages && applicant.allowed_next_stages.length > 0 ? (
                    applicant.allowed_next_stages.map((stage) => {
                      const dotColor =
                        STAGE_COLOR_CLASSES[stage.color]?.dot || "bg-primary";
                      return (
                        <DropdownMenuItem
                          key={stage.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onQuickStageUpdate) {
                              onQuickStageUpdate(
                                applicant,
                                stage.id,
                                stage.stage_name
                              );
                            } else {
                              onUpdateStatus(applicant);
                            }
                          }}
                          className={cn(
                            "text-sm gap-2 cursor-pointer py-1.5 max-md:min-h-10 font-medium md:text-xs",
                            stage.stage_type === "REJECTED"
                              ? "text-rose-600 focus:text-rose-600"
                              : stage.stage_type === "HIRED"
                              ? "text-emerald-600 focus:text-emerald-600"
                              : ""
                          )}
                        >
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full shrink-0",
                              dotColor
                            )}
                          />
                          <span>Move to {stage.stage_name}</span>
                        </DropdownMenuItem>
                      );
                    })
                  ) : (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground italic">
                      {applicant.stage_type === "HIRED" ||
                      applicant.stage_type === "REJECTED" ||
                      applicant.stage_type === "WITHDRAWN" ||
                      applicant.application_status === "HIRED" ||
                      applicant.application_status === "REJECTED" ||
                      applicant.application_status === "WITHDRAWN"
                        ? "Terminal state — no further moves"
                        : "No transitions available"}
                    </div>
                  )}

                  {isAssessmentStage ? null : (
                  <>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(applicant);
                    }}
                    className="text-sm gap-2 cursor-pointer max-md:min-h-10 md:text-xs"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                    Update Candidate Stage...
                  </DropdownMenuItem>
                  </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <ChevronRight className="hidden sm:block h-4 w-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


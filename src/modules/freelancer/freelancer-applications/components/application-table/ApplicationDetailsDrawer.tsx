// src/modules/freelancer/freelancer-applications/components/application-table/ApplicationDetailsDrawer.tsx
"use client";

import React, { useState } from "react";
import {
  DollarSign,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  HelpCircle,
  User,
  Briefcase,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { CompanyProfile, ApplicationItem, PublicJobPosting } from "../../types";
import { JobDetailSheet } from "../JobDetailSheet";
import { ApplicationProgressTimeline } from "./ApplicationProgressTimeline";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";
import { ReferralBlock } from "./ReferralBlock";
import { formatDate, getInitials } from "./formatters";
import { sanitizeHtml } from "@/lib/sanitize-html";

interface ParsedCoverLetter {
  text: string;
  document?: {
    fileName: string;
    fileUrl: string;
  } | null;
}

function parseCoverLetter(raw?: string | null): ParsedCoverLetter {
  if (!raw) return { text: "" };
  const linkRegex = /\[(?:Cover Letter Document:\s*)?([^\]]+)\]\(([^)]+)\)/i;
  const match = raw.match(linkRegex);
  if (match) {
    const fileName = match[1].trim();
    let fileUrl = match[2].trim();
    const assetsMatch = fileUrl.match(/\/assets\/([a-zA-Z0-9-]+)/);
    if (assetsMatch?.[1]) {
      fileUrl = `/api/assets/${assetsMatch[1]}`;
    }
    const text = raw.replace(match[0], "").trim();
    return { text, document: { fileName, fileUrl } };
  }
  return { text: raw.trim() };
}

interface Props {
  application: ApplicationItem | null;
  onClose: () => void;
  onSelectCompany: (company: CompanyProfile | null) => void;
}

export function ApplicationDetailsDrawer({ application, onClose, onSelectCompany }: Props) {
  const [originalJob, setOriginalJob] = useState<PublicJobPosting | null>(null);
  const [isJobSheetOpen, setIsJobSheetOpen] = useState(false);
  const [loadingJob, setLoadingJob] = useState(false);

  const handleOpenJobPost = async (jobId: number) => {
    try {
      setLoadingJob(true);
      const res = await fetch("/api/freelancer/jobs");
      if (res.ok) {
        const data = await res.json();
        const jobs: PublicJobPosting[] = data.jobs || [];
        const found = jobs.find((j) => j.job_id === jobId);
        if (found) {
          setOriginalJob(found);
          setIsJobSheetOpen(true);
        } else {
          toast.error("Could not find the original job post. It might have been closed or deleted.");
        }
      } else {
        toast.error("Failed to load original job post.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading job post.");
    } finally {
      setLoadingJob(false);
    }
  };

  const hasCompanyDetails = !!application?.company_details;

  return (
    <>
      <Drawer direction="right" open={!!application} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="h-full !w-[90vw] sm:!w-[800px] !max-w-none ml-auto right-0 rounded-none border-l">
          <DrawerHeader className="border-b pb-4">
            <DrawerTitle className="text-xl">Application Details</DrawerTitle>
            <DrawerDescription>
              Submitted on {formatDate(application?.applied_at)}
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-6 overflow-y-auto space-y-6">
            {application && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div
                    className={`flex items-center gap-4 ${hasCompanyDetails ? "group cursor-pointer" : ""}`}
                    onClick={(e) => {
                      if (application.company_details) {
                        e.stopPropagation();
                        onSelectCompany(application.company_details);
                      }
                    }}
                  >
                    <div
                      className={`w-12 h-12 rounded-lg border bg-muted flex items-center justify-center text-lg font-bold text-foreground shrink-0 overflow-hidden ${hasCompanyDetails ? "group-hover:border-primary/50 transition-colors" : ""}`}
                    >
                      {application.company_details?.company_logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            application.company_details.company_logo.startsWith("http")
                              ? application.company_details.company_logo
                              : `/api/client/assets/${application.company_details.company_logo}`
                          }
                          alt={application.company_name ?? ""}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(application.company_name)
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{application.job_title ?? "—"}</h3>
                      <p
                        className={`text-sm text-muted-foreground ${hasCompanyDetails ? "group-hover:text-primary group-hover:underline transition-all" : ""}`}
                      >
                        {application.company_name ?? "—"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 max-md:min-h-11"
                    disabled={loadingJob}
                    onClick={() => handleOpenJobPost(application.job_id)}
                  >
                    <span className="flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" />
                      {loadingJob ? "Loading..." : "View Original Job Post"}
                    </span>
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 border-b border-border/50 pb-6">
                  {application.job_location && (
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-muted-foreground/10 capitalize">
                      {application.job_location.toLowerCase()}
                    </span>
                  )}
                  {application.job_type && (
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-muted-foreground/10 capitalize">
                      {application.job_type.replace(/_/g, " ").toLowerCase()}
                    </span>
                  )}
                  {application.work_arrangement && (
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-muted-foreground/10 capitalize">
                      {application.work_arrangement.replace(/_/g, " ").toLowerCase()}
                    </span>
                  )}
                  {application.experience_level && (
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-muted-foreground/10 capitalize">
                      {application.experience_level.replace(/_/g, " ").toLowerCase()}
                    </span>
                  )}
                </div>

                {application.job_description && (
                  <div className="space-y-2">
                    <p className="text-sm md:text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Job Description
                    </p>
                    {/<(p|b|strong|ul|ol|li|div|br)\b[^>]*>/i.test(application.job_description) ? (
                      <div
                        className="bg-muted/30 p-4 rounded-lg text-sm border border-border/50 text-foreground max-h-60 overflow-y-auto space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-bold [&_b]:font-bold [&_p]:mb-2 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(application.job_description) }}
                      />
                    ) : (
                      <div className="bg-muted/30 p-4 rounded-lg text-sm whitespace-pre-wrap border border-border/50 text-foreground max-h-60 overflow-y-auto leading-relaxed">
                        {application.job_description}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm md:text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Current Status
                    </p>
                    <div>
                      <ApplicationStatusBadge
                        status={application.application_status}
                        stageName={application.current_stage?.stage_name}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm md:text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Expected Salary
                    </p>
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      {application.expected_salary
                        ? application.expected_salary.toLocaleString()
                        : "Not specified"}
                    </div>
                  </div>
                </div>

                {application.is_referred && (
                  <ReferralBlock
                    schoolName={application.school_name}
                    referrerName={application.referrer_name}
                    referralLetter={application.referral_letter}
                  />
                )}

                {(() => {
                  const parsed = parseCoverLetter(application.cover_letter);
                  const hasContent = Boolean(parsed.text || parsed.document);

                  return (
                    <div className="space-y-2">
                      <p className="text-sm md:text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> Cover Letter
                      </p>
                      {!hasContent ? (
                        <div className="bg-muted/30 p-4 rounded-lg text-sm border border-border/50 text-foreground">
                          <span className="text-muted-foreground italic">No cover letter provided.</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {parsed.text && (
                            <div className="bg-muted/30 p-4 rounded-lg text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0 max-w-full overflow-hidden border border-border/50 text-foreground leading-relaxed">
                              {parsed.text}
                            </div>
                          )}
                          {parsed.document && (
                            <a
                              href={
                                parsed.document.fileUrl.startsWith("http")
                                  ? parsed.document.fileUrl
                                  : parsed.document.fileUrl
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-3 p-3 w-full rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                            >
                              <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <span className="text-sm font-medium text-foreground truncate block flex-1">
                                {parsed.document.fileName}
                              </span>
                              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {application.portfolio_url && (
                  <div className="space-y-2">
                    <p className="text-sm md:text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5" /> Portfolio
                    </p>
                    <a
                      href={
                        application.portfolio_url.startsWith("http")
                          ? application.portfolio_url
                          : `https://${application.portfolio_url}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline block truncate"
                    >
                      {application.portfolio_url}
                    </a>
                  </div>
                )}

                {application.resume && (
                  <div className="space-y-2">
                    <p className="text-sm md:text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Attached Resume
                    </p>
                    <a
                      href={
                        application.resume.file_url.startsWith("http")
                          ? application.resume.file_url
                          : `/api/freelancer/assets/${application.resume.file_url}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-3 p-3 w-full rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-foreground truncate block flex-1">
                        {application.resume.file_name || "Resume Document"}
                      </span>
                    </a>
                  </div>
                )}

                {/* Screening Question Answers */}
                {application.screening_answers && application.screening_answers.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm md:text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-primary" /> Employer Questionnaire Responses
                    </p>
                    <div className="space-y-3">
                      {application.screening_answers.map((ans, idx) => (
                        <div
                          key={ans.question_id || idx}
                          className="bg-muted/20 border border-border/60 rounded-xl p-4 space-y-2"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-primary font-bold text-xs shrink-0 mt-0.5">
                              {idx + 1}.
                            </span>
                            <p className="text-xs font-semibold text-foreground/90 break-words">
                              {ans.question_text}
                            </p>
                          </div>
                          <div className="bg-background/80 rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere] border border-border/40">
                            {ans.answer_text || <span className="text-muted-foreground italic">No response provided</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Profile Snapshot Submitted with Application */}
                {application.profile_snapshot && (
                  <div className="space-y-3 border-t border-border/50 pt-5">
                    <p className="text-sm md:text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary" /> Submitted Profile Details
                    </p>

                    <div className="space-y-3 bg-muted/15 border border-border/60 rounded-xl p-4">
                      {/* Professional Summary */}
                      {application.profile_snapshot.professional_summary && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Professional Summary
                          </span>
                          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] bg-background/60 p-3 rounded-lg border border-border/40">
                            {application.profile_snapshot.professional_summary}
                          </p>
                        </div>
                      )}

                      {/* Submitted Skills */}
                      {application.profile_snapshot.skills && application.profile_snapshot.skills.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Skills
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {application.profile_snapshot.skills.map((s, idx) => {
                              const sName = s.skill?.skill_name || s.skill_name;
                              if (!sName) return null;
                              return (
                                <Badge key={idx} variant="secondary" className="text-xs font-normal">
                                  {sName}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Submitted Work Experience */}
                      {application.profile_snapshot.work_experience && application.profile_snapshot.work_experience.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <Briefcase className="w-3 h-3 text-muted-foreground" /> Work Experience
                          </span>
                          <div className="space-y-2">
                            {application.profile_snapshot.work_experience.map((exp, idx) => (
                              <div key={idx} className="text-xs border-l-2 border-primary/40 pl-3 py-1 bg-background/40 rounded-r-lg">
                                <p className="font-semibold text-foreground">{exp.job_title}</p>
                                <p className="text-muted-foreground">
                                  {exp.company_name}
                                  {(exp.start_date || exp.end_date) && (
                                    <span> • {exp.start_date || ""} - {exp.is_current_role ? "Present" : exp.end_date || ""}</span>
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Submitted Education */}
                      {application.profile_snapshot.education && application.profile_snapshot.education.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <GraduationCap className="w-3 h-3 text-muted-foreground" /> Education
                          </span>
                          <div className="space-y-2">
                            {application.profile_snapshot.education.map((edu, idx) => (
                              <div key={idx} className="text-xs border-l-2 border-primary/40 pl-3 py-1 bg-background/40 rounded-r-lg">
                                <p className="font-semibold text-foreground">{edu.school_name}</p>
                                {(edu.degree || edu.field_of_study) && (
                                  <p className="text-muted-foreground">
                                    {[edu.degree, edu.field_of_study].filter(Boolean).join(" in ")}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <ApplicationProgressTimeline
                  status={application.application_status}
                  application={application}
                />
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <JobDetailSheet
        job={originalJob}
        open={isJobSheetOpen}
        onClose={() => setIsJobSheetOpen(false)}
      />
    </>
  );
}

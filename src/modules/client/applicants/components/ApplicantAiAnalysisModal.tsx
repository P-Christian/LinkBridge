// src/modules/client/applicants/components/ApplicantAiAnalysisModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  BrainCircuit,
  MessageSquare,
  ShieldCheck,
  Briefcase,
} from "lucide-react";
import { CandidateDetail } from "../types";
import { toast } from "sonner";
import {
  CandidateAiAnalysis,
  getCachedApplicantAnalysis,
  setCachedApplicantAnalysis,
} from "../utils/applicantAiCache";

interface ApplicantAiAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicant: CandidateDetail | null;
}

export function ApplicantAiAnalysisModal({
  open,
  onOpenChange,
  applicant,
}: ApplicantAiAnalysisModalProps) {
  const [analysis, setAnalysis] = useState<CandidateAiAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applicationId = applicant?.application_id;

  const fetchAnalysis = React.useCallback(async (forceRegenerate = false) => {
    if (!applicant || !applicationId) return;

    let cached: CandidateAiAnalysis | null = null;

    if (!forceRegenerate) {
      // 1. Check L1 browser cache for instant 0ms display
      cached = getCachedApplicantAnalysis(applicationId);
      if (cached) {
        setAnalysis(cached);
      }

      // 2. Check active record from DB
      try {
        const getRes = await fetch(`/api/client/applicants/${applicationId}/ai-analysis`);
        const getData = await getRes.json().catch(() => null);

        if (getRes.ok && getData?.success && getData.analysis) {
          setAnalysis(getData.analysis);
          setCachedApplicantAnalysis(applicationId, getData.analysis);
          return;
        }

        // 3. An evaluation that could not be read is not an evaluation that was
        // never made. This used to fall through and generate: a paid model run
        // on every outage, which then superseded the stored record the read had
        // failed to return.
        if (!getRes.ok) {
          if (cached) return;
          setError(
            (getData?.error as string) ||
              "Saved evaluation could not be read. Please try again."
          );
          return;
        }
      } catch {
        if (cached) return;
        setError("Saved evaluation could not be read. Please try again.");
        return;
      }

      if (cached) return;
    }

    // 4. Generate or regenerate evaluation
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/client/applicants/${applicationId}/ai-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate: applicant }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to analyze candidate profile.");
      }

      setAnalysis(data.analysis);
      setCachedApplicantAnalysis(applicationId, data.analysis);

      // A generated evaluation the server could not retain is shown, but the
      // employer has to know it will not be there next time.
      const warnings = Array.isArray(data.warnings) ? data.warnings : [];
      warnings.forEach((warning: string) => toast.warning(warning));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error analyzing candidate.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [applicant, applicationId]);

  useEffect(() => {
    if (open && applicant) {
      queueMicrotask(() => {
        fetchAnalysis(false);
      });
    }
  }, [open, applicant, fetchAnalysis]);

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
    if (score >= 70) return "text-blue-500 bg-blue-500/10 border-blue-500/30";
    if (score >= 55) return "text-amber-500 bg-amber-500/10 border-amber-500/30";
    return "text-rose-500 bg-rose-500/10 border-rose-500/30";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] !max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-border bg-background shadow-2xl max-md:max-w-[calc(100vw-2rem)] max-md:max-h-[90dvh] max-md:overflow-y-auto">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border/70 flex flex-row items-center justify-between space-y-0 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-4">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold flex items-center gap-2 truncate">
                AI Candidate Evaluation
                {analysis && (
                  <Badge variant="outline" className={`text-xs px-2 py-0.5 font-bold ${getScoreColor(analysis.match_score)}`}>
                    {analysis.match_score}% Match
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground truncate md:text-xs">
                {applicant?.applicant_name} • Applied for {applicant?.job_title}
              </DialogDescription>
            </div>
          </div>


        </DialogHeader>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading && !analysis ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                  <Sparkles className="h-8 w-8 text-primary animate-spin" />
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-foreground">Analyzing Candidate Compatibility...</h4>
                <p className="text-sm text-muted-foreground max-w-sm md:text-xs">
                  Evaluating professional background, screening answers, technical skills, and requirements against {applicant?.job_title}.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="p-3 rounded-full bg-rose-500/10 text-rose-500">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <p className="text-sm text-rose-500 font-medium md:text-xs">{error}</p>
              <Button size="sm" onClick={() => fetchAnalysis(true)} variant="outline" className="text-sm max-md:min-h-10 md:text-xs">
                Retry Analysis
              </Button>
            </div>
          ) : analysis ? (
            <>
              {/* Top Highlights Banner */}
              <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">Overall Fit Rating</span>
                  </div>
                  <Badge variant="outline" className={`font-semibold text-xs px-2.5 py-0.5 rounded-full ${getScoreColor(analysis.match_score)}`}>
                    {analysis.fit_level}
                  </Badge>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed font-normal md:text-xs">
                  {analysis.executive_summary}
                </p>
              </div>

              {/* Strengths & Gaps Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] space-y-2.5">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 md:text-xs">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Key Strengths & Qualifications</span>
                  </div>
                  <ul className="space-y-1.5 text-sm text-foreground/85 md:text-xs">
                    {analysis.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span className="leading-snug">{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Gaps & Considerations */}
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] space-y-2.5">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400 md:text-xs">
                    <HelpCircle className="h-4 w-4" />
                    <span>Gaps & Interview Probing Points</span>
                  </div>
                  <ul className="space-y-1.5 text-sm text-foreground/85 md:text-xs">
                    {analysis.gaps_or_considerations.map((gap, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <span className="leading-snug">{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Screening Question Assessment */}
              {analysis.screening_assessment && (
                <div className="p-4 rounded-xl border border-border/70 bg-card/40 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground md:text-xs">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span>Screening Answers Evaluation</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed md:text-xs">
                    {analysis.screening_assessment}
                  </p>
                </div>
              )}

              {/* Alternative Company Openings Recommendation */}
              <div className="p-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/[0.04] to-primary/[0.01] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-primary md:text-xs">
                    <Briefcase className="h-4 w-4" />
                    <span>Alternative Company Openings — Cross-Role Match</span>
                  </div>
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 font-medium md:text-[10px]">
                    AI Opportunity Scan
                  </Badge>
                </div>

                {analysis.alternative_job_recommendations && analysis.alternative_job_recommendations.length > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground md:text-xs">
                      Based on their technical skillset and qualifications, this candidate also shows strong alignment for the following active job posting{analysis.alternative_job_recommendations.length > 1 ? "s" : ""}:
                    </p>
                    <div className="space-y-2 pt-1">
                      {analysis.alternative_job_recommendations.map((alt) => (
                        <div
                          key={alt.job_id}
                          className="p-3 rounded-lg border border-border bg-card/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-foreground md:text-xs">
                                {alt.job_title}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-xs px-2 py-0 font-bold md:text-[10px] ${getScoreColor(alt.match_score)}`}
                              >
                                {alt.match_score}% Match
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground/90 leading-snug md:text-xs">
                              {alt.reasoning}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="p-3 rounded-lg border border-border/60 bg-muted/20 text-sm text-muted-foreground leading-relaxed md:text-xs">
                    No alternative active openings found with a higher match — candidate is currently best aligned with this applied role.
                  </div>
                )}
              </div>

              {/* Hiring Recommendation Callout */}
              <div className="p-4 rounded-xl border border-primary/25 bg-primary/[0.04] space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-primary md:text-xs">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Recruiter Action Recommendation</span>
                </div>
                <p className="text-sm text-foreground font-medium leading-relaxed md:text-xs">
                  {analysis.recommendation}
                </p>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t gap-2 border-border/70 bg-muted/20 flex items-center justify-end shrink-0">

          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchAnalysis(true)}
            disabled={loading}
            className="h-8 max-md:min-h-10 px-3 text-sm gap-1.5 border-border hover:bg-muted font-medium cursor-pointer md:text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-primary" : "text-muted-foreground"}`} />
            Regenerate
          </Button>

          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} className="text-sm max-md:min-h-10 md:text-xs">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

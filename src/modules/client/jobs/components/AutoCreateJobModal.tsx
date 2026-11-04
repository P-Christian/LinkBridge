// src/modules/client/jobs/components/AutoCreateJobModal.tsx
"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  MapPin,
  CircleDollarSign,
  ArrowRight,
  Edit3,
  BookmarkPlus,
  RefreshCw,
} from "lucide-react";
import { JobFormData } from "../types";

interface AutoCreateJobModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobGenerated: (jobData: JobFormData) => void;
  onDirectSaveDraft: (jobData: JobFormData) => Promise<void>;
}

export function AutoCreateJobModal({
  open,
  onOpenChange,
  onJobGenerated,
  onDirectSaveDraft,
}: AutoCreateJobModalProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<JobFormData | null>(null);
  const [isSavingDirectDraft, setIsSavingDirectDraft] = useState(false);

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Please describe the role you are hiring for.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedDraft(null);

    try {
      const res = await fetch("/api/client/jobs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate job draft.");
      }

      setGeneratedDraft(data.job as JobFormData);
    } catch (err: unknown) {
      setError((err as Error).message || "An unexpected error occurred during generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReviewInForm = () => {
    if (!generatedDraft) return;
    onJobGenerated(generatedDraft);
    onOpenChange(false);
    resetState();
  };

  const handleSaveDirectlyAsDraft = async () => {
    if (!generatedDraft) return;
    setIsSavingDirectDraft(true);
    try {
      await onDirectSaveDraft({
        ...generatedDraft,
        status: "DRAFT",
      });
      onOpenChange(false);
      resetState();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to save draft.");
    } finally {
      setIsSavingDirectDraft(false);
    }
  };

  const resetState = () => {
    setPrompt("");
    setError(null);
    setGeneratedDraft(null);
    setIsGenerating(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !isGenerating) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-3xl p-6 overflow-hidden max-md:max-w-[calc(100vw-2rem)] max-md:max-h-[90dvh] max-md:overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border/80">
          <div className="flex items-center gap-2.5">
   
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                Auto Create Job with AI
                <Badge variant="secondary" className="text-xs md:text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border-0">
                  AI Generator
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-sm md:text-xs text-muted-foreground mt-0.5">
                Describe the role in your own words. AI will enrich it with your company profile and taxonomy.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 text-rose-700 dark:text-rose-300 text-sm md:text-xs flex items-center gap-2 mt-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. INPUT FORM STATE */}
        {!isGenerating && !generatedDraft && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex items-center justify-between">
                <span>Describe the job you are hiring for</span>
                <span className="text-sm md:text-xs text-muted-foreground font-normal">Min. 10 characters</span>
              </label>
              <Textarea
                rows={13}
                placeholder="Describe the position, core responsibilities, preferred technologies, years of experience, work setup, or budget..."
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (error) setError(null);
                }}
                className="min-h-[280px] md:text-sm rounded-xl resize-y leading-relaxed p-4 focus-visible:ring-emerald-500 border-border/80 max-md:min-h-[180px] max-md:text-base"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex items-start gap-2.5 text-sm md:text-xs text-muted-foreground">

              <p className="leading-relaxed">
                AI automatically synchronizes with your <strong>company address, industry, and canonical taxonomy</strong>. If compensation is unstated, it will default to <em>negotiable / undisclosed</em>.
              </p>
            </div>
          </div>
        )}

        {/* 2. PROGRESS GENERATING STATE */}
        {isGenerating && (
          <div className="py-8 px-4 space-y-6 animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 mb-1 animate-pulse">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Drafting Your Job Posting...</h3>
              <p className="text-sm md:text-xs text-muted-foreground max-w-sm mx-auto">
                Synthesizing role requirements, responsibilities, and skill tags.
              </p>
            </div>
          </div>
        )}

        {/* 3. GENERATED DRAFT REVIEW STATE */}
        {!isGenerating && generatedDraft && (
          <div className="space-y-4 py-2 animate-fadeIn">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm md:text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Job Draft Generated Successfully</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setGeneratedDraft(null)}
                className="h-7 text-sm md:text-xs text-muted-foreground hover:text-foreground gap-1 max-md:min-h-10"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </Button>
            </div>

            {/* Structured Card Overview */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-3.5 shadow-xs">
              <div>
                <span className="text-xs md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Job Position
                </span>
                <h4 className="text-base font-bold text-foreground mt-0.5">
                  {generatedDraft.job_title}
                </h4>
              </div>

              {generatedDraft.is_new_category_suggested && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 text-sm md:text-xs flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold">AI Proposed New Role Category: </span>
                    <span className="font-medium">&ldquo;{generatedDraft.job_category}&rdquo;</span>
                    {generatedDraft.category_suggestion_rationale && (
                      <p className="text-xs md:text-[11px] text-muted-foreground">
                        {generatedDraft.category_suggestion_rationale}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border/80 text-sm md:text-xs">
                <div>
                  <span className="text-xs md:text-[10px] text-muted-foreground block font-medium">Category</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {generatedDraft.job_category || "Unassigned"}
                    </span>
                    {generatedDraft.is_new_category_suggested && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/30 text-amber-600 bg-amber-500/10">
                        Suggested
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-xs md:text-[10px] text-muted-foreground block font-medium">Arrangement</span>
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Briefcase className="h-3 w-3 text-muted-foreground" />
                    {generatedDraft.work_arrangement}
                  </span>
                </div>
                <div>
                  <span className="text-xs md:text-[10px] text-muted-foreground block font-medium">Experience Level</span>
                  <span className="font-semibold text-foreground">
                    {generatedDraft.experience_level || "Mid Level"}
                  </span>
                </div>
                <div>
                  <span className="text-xs md:text-[10px] text-muted-foreground block font-medium">Minimum Education</span>
                  <span className="font-semibold text-foreground truncate" title={generatedDraft.education || "Bachelor's Degree Graduate"}>
                    {generatedDraft.education || "Bachelor's Degree Graduate"}
                  </span>
                </div>
                <div>
                  <span className="text-xs md:text-[10px] text-muted-foreground block font-medium">Location</span>
                  <span className="font-semibold text-foreground flex items-center gap-1 truncate" title={generatedDraft.job_location}>
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    {generatedDraft.job_location || "Philippines"}
                  </span>
                </div>
                <div>
                  <span className="text-xs md:text-[10px] text-muted-foreground block font-medium">Compensation</span>
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <CircleDollarSign className="h-3 w-3 text-muted-foreground" />
                    {generatedDraft.salary_negotiable
                      ? "Negotiable / Undisclosed"
                      : generatedDraft.salary_min
                      ? `₱${Number(generatedDraft.salary_min).toLocaleString()}+`
                      : "Negotiable / Undisclosed"}
                  </span>
                </div>
              </div>

              {/* Screening & Benefits Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/80 text-xs md:text-[11px]">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="font-semibold text-foreground">Screening Questions:</span>
                  <span>{generatedDraft.screening_questions?.length || 0} questions configured</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="font-semibold text-foreground">Included Benefits:</span>
                  <span>{generatedDraft.benefits?.length || 0} benefits selected</span>
                </div>
              </div>

              {/* Skills preview */}
              {generatedDraft.skills && generatedDraft.skills.length > 0 && (
                <div className="pt-2 border-t border-border/80 space-y-1.5">
                  <span className="text-xs md:text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Extracted Skills ({generatedDraft.skills.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {generatedDraft.skills.map((s) => (
                      <Badge
                        key={s.id}
                        variant="secondary"
                        className="text-xs md:text-[11px] font-normal py-0.5 px-2 bg-muted rounded-md"
                      >
                        {s.skill_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs md:text-[11px] text-muted-foreground italic text-center">
              You can review rich-text descriptions, screening questions, and details in the standard job editor.
            </p>
          </div>
        )}

        <DialogFooter className="gap-3 sm:gap-3 pt-3 border-t border-border/80">
          {!generatedDraft ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isGenerating}
                className="h-9 text-sm md:text-xs max-md:min-h-10"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="h-9 text-sm md:text-xs font-semibold gap-1.5 bg-[#14a800] hover:bg-[#118f00] text-white border-0 max-md:min-h-10"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                  
                    Generate Job
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveDirectlyAsDraft}
                disabled={isSavingDirectDraft}
                className="h-9 text-sm md:text-xs gap-1.5 w-full sm:w-auto max-md:min-h-10"
              >
                {isSavingDirectDraft ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BookmarkPlus className="h-3.5 w-3.5" />
                )}
                Save as Draft Directly
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleReviewInForm}
                className="h-9 text-sm md:text-xs font-semibold gap-1.5 bg-[#14a800] hover:bg-[#118f00] text-white border-0 w-full sm:w-auto max-md:min-h-10"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Review & Edit in Job Form
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

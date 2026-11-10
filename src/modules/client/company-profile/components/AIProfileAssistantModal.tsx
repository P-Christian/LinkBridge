// src/modules/client/company-profile/components/AIProfileAssistantModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRequestAbort } from "@/hooks/useRequestAbort";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Briefcase,
  Layers,
  HeartHandshake,
  Gift,
  Tag,
 
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { CompanyProfile, EditableCompanyFields } from "../types";

export interface AISuggestionsData {
  company_description?: string;
  company_mission?: string;
  company_vision?: string;
  company_culture?: string;
  company_benefits?: string;
  company_tags?: string;
  suggested_industry_id?: number | null;
  suggested_industry_name?: string;
  industry_confidence?: number;
  industry_reason?: string;
  suggested_organization_type_id?: number | null;
  suggested_organization_type_name?: string;
  org_type_confidence?: number;
}

interface AIProfileAssistantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCompany: Partial<CompanyProfile>;
  onApplySuggestions: (acceptedFields: Partial<EditableCompanyFields>) => void;
}

const GENERATION_STEPS = [
  "Analyzing company identity & existing notes",
  "Formulating compelling candidate-facing description",
  "Structuring culture pillars & working environment",
  "Structuring grounded perks & benefits summary",
  "Classifying industry & org type against taxonomy",
  "Extracting high-value search & matching tags",
];

export default function AIProfileAssistantModal({
  open,
  onOpenChange,
  currentCompany,
  onApplySuggestions,
}: AIProfileAssistantModalProps) {
  const [promptNotes, setPromptNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AISuggestionsData | null>(null);
  const abortGenerate = useRequestAbort();

  // Field selection toggles (default all true, mission & vision omitted)
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({
    company_description: true,
    company_culture: true,
    company_benefits: true,
    company_tags: true,
    industry_id: true,
    organization_type_id: true,
  });

  // Step progression animation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      queueMicrotask(() => {
        setCurrentStepIndex(0);
      });
      interval = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev < GENERATION_STEPS.length - 1) return prev + 1;
          return prev;
        });
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setSuggestions(null);

    // Two clicks can both start a read before the button state commits, so only
    // the newest one may own the spinner and the panel — otherwise its proposals
    // land under a client who is already ticking boxes against the first set.
    const signal = abortGenerate();
    try {
      const res = await fetch("/api/client/company-profile/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          company_name: currentCompany.company_name,
          website: currentCompany.company_website,
          prompt: promptNotes.trim(),
          current_description: currentCompany.company_description,
          current_culture: currentCompany.company_culture,
          current_benefits: currentCompany.company_benefits,
        }),
      });

      if (signal.aborted) return;
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to generate AI profile suggestions.");
      }

      const json = await res.json();
      if (signal.aborted) return;
      if (json.data) {
        setSuggestions(json.data);
      } else {
        throw new Error("Invalid response format from AI service.");
      }
    } catch (err: unknown) {
      if (signal.aborted) return;
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to generate profile suggestions.");
    } finally {
      if (!signal.aborted) setIsGenerating(false);
    }
  };

  const toggleField = (field: string) => {
    setSelectedFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleApply = () => {
    if (!suggestions) return;

    const updates: Partial<EditableCompanyFields> = {};

    if (selectedFields.company_description && suggestions.company_description) {
      updates.company_description = suggestions.company_description;
    }
    if (selectedFields.company_culture && suggestions.company_culture) {
      updates.company_culture = suggestions.company_culture;
    }
    if (selectedFields.company_benefits && suggestions.company_benefits) {
      updates.company_benefits = suggestions.company_benefits;
    }
    if (selectedFields.company_tags && suggestions.company_tags) {
      updates.company_tags = suggestions.company_tags;
    }
    if (selectedFields.industry_id && suggestions.suggested_industry_id) {
      updates.industry_id = suggestions.suggested_industry_id;
    }
    if (selectedFields.organization_type_id && suggestions.suggested_organization_type_id) {
      updates.organization_type_id = suggestions.suggested_organization_type_id;
    }

    onApplySuggestions(updates);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col p-0 gap-0 max-md:max-w-[calc(100vw-2rem)] max-md:max-h-[90dvh]">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800 bg-linear-to-r from-emerald-500/10 via-teal-500/5 to-transparent">
          <div className="flex items-center gap-2 mb-1">
 
            <div>
              <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                AI Company Profile Assistant
              </DialogTitle>
              <DialogDescription className="text-sm md:text-xs text-zinc-500">
                Generate high-impact candidate-facing profile content and classify your taxonomy. Propose → Review → Apply.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6 flex-1">
          {/* Top Control Bar: Prompt / Guidance */}
          {!suggestions && !isGenerating && (
            <div className="space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-600" />
                    Custom Notes / Context (Optional)
                  </span>
                  <span className="text-xs md:text-[11px] text-zinc-400">
                    Company: <strong className="text-zinc-700 dark:text-zinc-300">{currentCompany.company_name || "Company"}</strong>
                  </span>
                </div>
                <Textarea
                  value={promptNotes}
                  onChange={(e) => setPromptNotes(e.target.value)}
                  placeholder="e.g. We are a fast-growing B2B SaaS startup specializing in AI workflow automation. Hybrid in Makati, offering HMO with dependents and learning stipends..."
                  rows={3}
                  className="md:text-xs max-md:text-base resize-none"
                />
                <p className="text-xs md:text-[11px] text-zinc-400">
                  AI will use your existing company name, website, and entered notes to generate accurate, grounded recommendations.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 rounded-xl text-rose-700 dark:text-rose-300 text-sm md:text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleGenerate}
                  className="h-10 max-md:min-h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm flex items-center gap-2 transition-transform active:scale-[0.98]"
                >
                   
                  Generate AI Profile Recommendations
                </Button>
              </div>
            </div>
          )}

          {/* Progressive Generation Loading State */}
          {isGenerating && (
            <div className="py-12 px-4 flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                </div>
                
              </div>

              <div className="text-center space-y-1.5 max-w-sm">
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Analyzing & Crafting Profile Intelligence
                </h4>
                <p className="text-sm md:text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-pulse">
                  {GENERATION_STEPS[currentStepIndex]}...
                </p>
              </div>

              <div className="w-full max-w-md bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-700 ease-out"
                  style={{
                    width: `${((currentStepIndex + 1) / GENERATION_STEPS.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Suggestions Review Layout */}
          {suggestions && !isGenerating && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-sm md:text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                    Recommendations Ready! Review proposals and uncheck anything you wish to skip.
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerate}
                  className="h-7 max-md:min-h-10 px-2.5 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Regenerate
                </Button>
              </div>

              <div className="space-y-4">
                {/* 1. Description */}
                {suggestions.company_description && (
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2 bg-white dark:bg-zinc-900">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none max-md:min-h-10 max-md:items-center">
                        <Checkbox
                          checked={selectedFields.company_description}
                          onCheckedChange={() => toggleField("company_description")}
                        />
                        <span className="text-sm md:text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                          Company Description
                        </span>
                      </label>
                      <Badge variant="outline" className="text-xs md:text-[10px] text-emerald-600 border-emerald-300">
                        AI Recommended
                      </Badge>
                    </div>
                    <p className="text-sm md:text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap pl-6">
                      {suggestions.company_description}
                    </p>
                  </div>
                )}



                {/* 3. Culture & Values */}
                {suggestions.company_culture && (
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2 bg-white dark:bg-zinc-900">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none max-md:min-h-10 max-md:items-center">
                        <Checkbox
                          checked={selectedFields.company_culture}
                          onCheckedChange={() => toggleField("company_culture")}
                        />
                        <span className="text-sm md:text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                          <HeartHandshake className="h-3.5 w-3.5 text-rose-500" />
                          Company Culture & Work Environment
                        </span>
                      </label>
                    </div>
                    <p className="text-sm md:text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap pl-6">
                      {suggestions.company_culture}
                    </p>
                  </div>
                )}

                {/* 4. Benefits */}
                {suggestions.company_benefits && (
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2 bg-white dark:bg-zinc-900">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none max-md:min-h-10 max-md:items-center">
                        <Checkbox
                          checked={selectedFields.company_benefits}
                          onCheckedChange={() => toggleField("company_benefits")}
                        />
                        <span className="text-sm md:text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                          <Gift className="h-3.5 w-3.5 text-amber-500" />
                          Perks & Benefits
                        </span>
                      </label>
                    </div>
                    <p className="text-sm md:text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap pl-6">
                      {suggestions.company_benefits}
                    </p>
                  </div>
                )}

                {/* 5. Classification & Tags Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Industry Suggestion */}
                  {suggestions.suggested_industry_name && (
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2 bg-white dark:bg-zinc-900">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none max-md:min-h-10 max-md:items-center">
                          <Checkbox
                            checked={selectedFields.industry_id}
                            onCheckedChange={() => toggleField("industry_id")}
                          />
                          <span className="text-sm md:text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5 text-emerald-600" />
                            Taxonomy Industry
                          </span>
                        </label>
                        {suggestions.industry_confidence && (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs md:text-[10px]">
                            {suggestions.industry_confidence}% Match
                          </Badge>
                        )}
                      </div>
                      <div className="pl-6 space-y-1">
                        <p className="text-sm md:text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          {suggestions.suggested_industry_name}
                        </p>
                        {suggestions.industry_reason && (
                          <p className="text-xs md:text-[11px] text-zinc-500 leading-relaxed">
                            Reason: {suggestions.industry_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Organization Type Suggestion */}
                  {suggestions.suggested_organization_type_name && (
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2 bg-white dark:bg-zinc-900">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none max-md:min-h-10 max-md:items-center">
                          <Checkbox
                            checked={selectedFields.organization_type_id}
                            onCheckedChange={() => toggleField("organization_type_id")}
                          />
                          <span className="text-sm md:text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-indigo-600" />
                            Organization Type
                          </span>
                        </label>
                        {suggestions.org_type_confidence && (
                          <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 text-xs md:text-[10px]">
                            {suggestions.org_type_confidence}% Match
                          </Badge>
                        )}
                      </div>
                      <div className="pl-6">
                        <p className="text-sm md:text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          {suggestions.suggested_organization_type_name}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. Tags */}
                {suggestions.company_tags && (
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2 bg-white dark:bg-zinc-900">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none max-md:min-h-10 max-md:items-center">
                        <Checkbox
                          checked={selectedFields.company_tags}
                          onCheckedChange={() => toggleField("company_tags")}
                        />
                        <span className="text-sm md:text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5 text-teal-600" />
                          Matching & Discovery Tags
                        </span>
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-6 pt-1">
                      {suggestions.company_tags.split(",").map((tag, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="text-xs font-medium px-2.5 py-0.5 rounded-md"
                        >
                          {tag.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {suggestions && !isGenerating && (
          <DialogFooter className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs max-md:min-h-10"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm max-md:min-h-10"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Apply Selected Suggestions to Draft
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

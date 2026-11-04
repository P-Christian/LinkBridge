// src/modules/vos-admin/career-advice-management/components/AiArticleAssistant.tsx
"use client";

import React, { useState } from "react";
import { Sparkles, Wand2, Check, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_CAREER_CATEGORIES } from "../services/article.helpers";
import { sanitizeArticleHtml } from "@/lib/sanitize-html";
import { useArticleAiAssistant } from "../hooks/useArticleAiAssistant";
import { AiAssistResponsePayload } from "../types/article.types";

interface AiArticleAssistantProps {
  onApplyDraft: (draft: AiAssistResponsePayload) => void;
  onApplySeo: (seo: { seo_title?: string; seo_description?: string; excerpt?: string }) => void;
  currentTitle?: string;
  currentContent?: string;
}

export function AiArticleAssistant({
  onApplyDraft,
  onApplySeo,
  currentTitle,
  currentContent,
}: AiArticleAssistantProps) {
  const { isGenerating, requestAiAssist } = useArticleAiAssistant();

  const [mode, setMode] = useState<"draft" | "proofread" | "seo">("draft");
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState<string>("Career Strategy");
  const [targetAudience, setTargetAudience] = useState("Graduates and early-career tech professionals");
  const [result, setResult] = useState<AiAssistResponsePayload | null>(null);

  const handleGenerateDraft = async () => {
    if (!topic.trim()) return;
    const res = await requestAiAssist({
      action: "generate_draft",
      topic,
      category,
      target_audience: targetAudience,
    });
    if (res) setResult(res);
  };

  const handleGenerateSeo = async () => {
    const res = await requestAiAssist({
      action: "generate_seo",
      title: currentTitle,
      content: currentContent,
    });
    if (res) {
      setResult(res);
      onApplySeo({
        seo_title: res.seo_title,
        seo_description: res.seo_description,
        excerpt: res.excerpt,
      });
    }
  };

  const handleProofread = async () => {
    if (!currentContent?.trim()) return;
    const res = await requestAiAssist({
      action: "proofread",
      content: currentContent,
    });
    if (res) setResult(res);
  };

  return (
    <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4 min-w-0 overflow-hidden">
      {/* Header */}
      <div className="space-y-3 border-b border-primary/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-foreground truncate">Gemini Writing Assistant</h4>
            <p className="text-[10px] text-muted-foreground truncate">Draft, polish tone, and optimize SEO</p>
          </div>
        </div>

        {/* Mode selector - full width stacked row */}
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/60 bg-background/90 p-1 w-full">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setMode("draft"); setResult(null); }}
            className={`h-7 px-1 text-[11px] truncate ${mode === "draft" ? "bg-muted font-semibold text-primary shadow-xs" : "text-muted-foreground"}`}
          >
            Draft
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setMode("proofread"); setResult(null); }}
            className={`h-7 px-1 text-[11px] truncate ${mode === "proofread" ? "bg-muted font-semibold text-primary shadow-xs" : "text-muted-foreground"}`}
          >
            Proofread
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setMode("seo"); setResult(null); }}
            className={`h-7 px-1 text-[11px] truncate ${mode === "seo" ? "bg-muted font-semibold text-primary shadow-xs" : "text-muted-foreground"}`}
          >
            SEO Meta
          </Button>
        </div>
      </div>

      {/* Mode 1: Draft from Topic */}
      {mode === "draft" && (
        <div className="space-y-3 min-w-0">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Article Topic or Idea</label>
            <Input
              placeholder="e.g. 5 Ways to Stand Out in Interviews"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="text-xs h-8 bg-background"
            />
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {DEFAULT_CAREER_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground">Target Audience</label>
              <Input
                placeholder="e.g. Junior devs, fresh grads"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="text-xs h-8 bg-background"
              />
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleGenerateDraft}
            disabled={isGenerating || !topic.trim()}
            className="w-full text-xs shadow-xs"
          >
            {isGenerating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-2 h-3.5 w-3.5" />}
            Generate Draft Article with AI
          </Button>
        </div>
      )}

      {/* Mode 2: Proofread */}
      {mode === "proofread" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Gemini will analyze your current editor body text, fix grammatical issues, and enhance readability while preserving your key ideas.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={handleProofread}
            disabled={isGenerating || !currentContent?.trim()}
            className="w-full text-xs shadow-xs"
          >
            {isGenerating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-2 h-3.5 w-3.5" />}
            Proofread and Polish Body Text
          </Button>
        </div>
      )}

      {/* Mode 3: SEO */}
      {mode === "seo" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Generate an optimized SEO Title, 150-character meta description, and article preview teaser based on your written content.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={handleGenerateSeo}
            disabled={isGenerating || (!currentTitle && !currentContent)}
            className="w-full text-xs shadow-xs"
          >
            {isGenerating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
            Auto-Generate SEO Title & Description
          </Button>
        </div>
      )}

      {/* Results Box */}
      {result && (
        <div className="mt-4 rounded-lg border border-border bg-background p-3.5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" /> AI Suggestions Ready
            </span>
            {result.title && (
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() => onApplyDraft(result)}
                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Apply to Article Form
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>

          {result.title && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">Generated Title:</p>
              <p className="text-xs font-medium text-foreground">{result.title}</p>
            </div>
          )}

          {result.excerpt && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">Teaser Excerpt:</p>
              <p className="text-xs text-muted-foreground italic">&quot;{result.excerpt}&quot;</p>
            </div>
          )}

          {result.seo_title && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground">SEO Title:</p>
                <p className="font-mono text-[11px] text-foreground">{result.seo_title}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground">SEO Description:</p>
                <p className="font-mono text-[11px] text-foreground truncate">{result.seo_description}</p>
              </div>
            </div>
          )}

          {result.proofread_text && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">Proofread Output:</p>
              <div
                className="max-h-36 overflow-y-auto rounded-md bg-muted/40 p-2 text-xs prose prose-sm dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(result.proofread_text) }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onApplyDraft({ content: result.proofread_text })}
                className="mt-2 text-xs w-full"
              >
                Replace Editor Body with Polished Version
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

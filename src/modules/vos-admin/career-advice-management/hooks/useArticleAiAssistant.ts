"use client";

// src/modules/vos-admin/career-advice-management/hooks/useArticleAiAssistant.ts
import { useState } from "react";
import { AiAssistRequestPayload, AiAssistResponsePayload } from "../types/article.types";
import { toast } from "sonner";

export function useArticleAiAssistant() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<AiAssistResponsePayload | null>(null);

  const requestAiAssist = async (payload: AiAssistRequestPayload): Promise<AiAssistResponsePayload | null> => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/vos-admin/career-articles/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || "AI assist service error");
      }

      const json = await res.json();
      setLastResult(json.data);
      toast.success("AI suggestion generated!");
      return json.data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate AI assistance";
      toast.error(message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    lastResult,
    requestAiAssist,
  };
}

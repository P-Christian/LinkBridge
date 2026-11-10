/* eslint-disable react-hooks/set-state-in-effect */
// src/modules/client/pipeline/hooks/usePipelineSettings.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import {
  CanonicalStageType,
  CompanyPipeline,
  PipelineStage,
} from "../types";

export function usePipelineSettings() {
  const [pipelines, setPipelines] = useState<CompanyPipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const abortRead = useRequestAbort();

  const clearMessages = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  const fetchPipelines = useCallback(async () => {
    setLoading(true);
    setError("");
    // Every mutation below refetches the whole pipeline list, so a snapshot
    // taken before a stage was added, renamed, moved or deleted can still land
    // last and put the board back the way it looked before that change.
    const signal = abortRead();
    try {
      const res = await fetch("/api/client/pipelines", { cache: "no-store", signal });
      const json = await res.json();
      if (signal.aborted) return;
      if (!res.ok) {
        throw new Error(json.error || "Failed to load pipelines.");
      }

      const list: CompanyPipeline[] = json.pipelines ?? [];
      setPipelines(list);

      // Select default or first pipeline
      if (list.length > 0) {
        setSelectedPipelineId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          const defaultPipe = list.find((p) => p.is_default) ?? list[0];
          return defaultPipe.id;
        });
      }
    } catch (err) {
      if (signal.aborted) return;
      const msg = err instanceof Error ? err.message : "Error fetching pipelines.";
      setError(msg);
      toast.error(msg);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [abortRead]);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  const selectedPipeline =
    pipelines.find((p) => p.id === selectedPipelineId) ?? pipelines[0] ?? null;

  const createPipeline = useCallback(
    async (name: string, isDefault = false) => {
      setSaving(true);
      setError("");
      setSuccess("");
      try {
        const res = await fetch("/api/client/pipelines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, is_default: isDefault }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to create pipeline.");
        }

        const msg = `Pipeline "${name}" created successfully.`;
        setSuccess(msg);
        toast.success(msg);
        await fetchPipelines();
        if (json.pipeline?.id) {
          setSelectedPipelineId(json.pipeline.id);
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create pipeline.";
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [fetchPipelines]
  );

  const addStage = useCallback(
    async (data: {
      stage_name: string;
      stage_type: CanonicalStageType;
      color?: string;
      description?: string;
    }) => {
      if (!selectedPipeline) return false;
      setSaving(true);
      setError("");
      setSuccess("");
      try {
        const res = await fetch(`/api/client/pipelines/${selectedPipeline.id}/stages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to add stage.");
        }

        const msg = `Stage "${data.stage_name}" added.`;
        setSuccess(msg);
        toast.success(msg);
        await fetchPipelines();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to add stage.";
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [selectedPipeline, fetchPipelines]
  );

  const updateStage = useCallback(
    async (
      stageId: number,
      data: { stage_name?: string; color?: string; description?: string }
    ) => {
      if (!selectedPipeline) return false;
      setSaving(true);
      setError("");
      setSuccess("");
      try {
        const res = await fetch(
          `/api/client/pipelines/${selectedPipeline.id}/stages/${stageId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }
        );
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to update stage.");
        }

        setSuccess("Stage updated successfully.");
        toast.success("Stage updated successfully.");
        await fetchPipelines();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update stage.";
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [selectedPipeline, fetchPipelines]
  );

  const deleteStage = useCallback(
    async (stageId: number) => {
      if (!selectedPipeline) return false;
      const currentPipelineId = selectedPipeline.id;
      const originalPipelines = [...pipelines];

      // Optimistic update: instantly remove stage and clean allowed_next_stage_ids across remaining stages
      const stageNum = Number(stageId);
      setPipelines((prev) =>
        prev.map((p) =>
          p.id === currentPipelineId
            ? {
                ...p,
                stages: (p.stages ?? [])
                  .filter((s) => Number(s.id) !== stageNum)
                  .map((s) => ({
                    ...s,
                    allowed_next_stage_ids: (s.allowed_next_stage_ids ?? [])
                      .map(Number)
                      .filter((id) => id !== stageNum),
                  })),
              }
            : p
        )
      );

      setError("");
      setSuccess("");
      try {
        const res = await fetch(
          `/api/client/pipelines/${currentPipelineId}/stages/${stageId}`,
          {
            method: "DELETE",
          }
        );
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to delete stage.");
        }

        setSuccess("Stage removed successfully.");
        toast.success("Stage removed successfully.");
        await fetchPipelines();
        return true;
      } catch (err) {
        // Rollback on failure
        setPipelines(originalPipelines);
        const msg = err instanceof Error ? err.message : "Failed to delete stage.";
        setError(msg);
        toast.error(msg);
        return false;
      }
    },
    [selectedPipeline, pipelines, fetchPipelines]
  );

  const updateTransitions = useCallback(
    async (fromStageId: number, targetStageIds: number[]) => {
      if (!selectedPipeline) return false;
      setSaving(true);
      setError("");
      setSuccess("");
      try {
        const res = await fetch(
          `/api/client/pipelines/${selectedPipeline.id}/transitions`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              from_stage_id: fromStageId,
              target_stage_ids: targetStageIds,
            }),
          }
        );
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to update transitions.");
        }

        setSuccess("Stage transitions updated.");
        toast.success("Stage transitions updated.");
        await fetchPipelines();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update transitions.";
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [selectedPipeline, fetchPipelines]
  );

  const moveStageOrder = useCallback(
    async (stageId: number, direction: "up" | "down") => {
      if (!selectedPipeline?.stages) return false;
      const currentPipelineId = selectedPipeline.id;
      const originalPipelines = [...pipelines];

      const stages = [...selectedPipeline.stages].sort(
        (a, b) => a.stage_order - b.stage_order
      );
      const currentIndex = stages.findIndex((s) => s.id === stageId);
      if (currentIndex === -1) return false;

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= stages.length) return false;

      // Pin APPLIED: Cannot move APPLIED down, and cannot move any stage above APPLIED
      if (
        stages[currentIndex].stage_type === "APPLIED" ||
        stages[targetIndex].stage_type === "APPLIED"
      ) {
        return false;
      }

      // Swap in array
      const temp = stages[currentIndex];
      stages[currentIndex] = stages[targetIndex];
      stages[targetIndex] = temp;

      // Update stage_order numbers to reflect new array order
      const reorderedStages = stages.map((s, idx) => ({
        ...s,
        stage_order: idx + 1,
      }));

      // Optimistic update: update state immediately for smooth animation
      setPipelines((prev) =>
        prev.map((p) =>
          p.id === currentPipelineId ? { ...p, stages: reorderedStages } : p
        )
      );

      const orderedIds = reorderedStages.map((s) => s.id);
      setError("");

      try {
        const res = await fetch(
          `/api/client/pipelines/${currentPipelineId}/reorder`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ordered_stage_ids: orderedIds }),
          }
        );
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Failed to reorder stages.");
        }

        return true;
      } catch (err) {
        // Rollback on failure
        setPipelines(originalPipelines);
        const msg = err instanceof Error ? err.message : "Failed to reorder stages.";
        setError(msg);
        toast.error(msg);
        return false;
      }
    },
    [selectedPipeline, pipelines]
  );

  const reorderStages = useCallback(
    async (newOrderedStages: PipelineStage[]) => {
      if (!selectedPipeline?.stages) return false;
      const currentPipelineId = selectedPipeline.id;
      const originalPipelines = [...pipelines];

      // Ensure APPLIED stage stays pinned at position 1
      const appliedIdx = newOrderedStages.findIndex((s) => s.stage_type === "APPLIED");
      const normalizedStages = [...newOrderedStages];
      if (appliedIdx > 0) {
        const [applied] = normalizedStages.splice(appliedIdx, 1);
        normalizedStages.unshift(applied);
      }

      // Update stage_order numbers to reflect new array order
      const reorderedStages = normalizedStages.map((s, idx) => ({
        ...s,
        stage_order: idx + 1,
      }));

      // Optimistic update: update state immediately for smooth drag-and-drop
      setPipelines((prev) =>
        prev.map((p) =>
          p.id === currentPipelineId ? { ...p, stages: reorderedStages } : p
        )
      );

      const orderedIds = reorderedStages.map((s) => s.id);
      setError("");

      try {
        const res = await fetch(
          `/api/client/pipelines/${currentPipelineId}/reorder`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ordered_stage_ids: orderedIds }),
          }
        );
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Failed to reorder stages.");
        }

        return true;
      } catch (err) {
        // Rollback on failure
        setPipelines(originalPipelines);
        const msg = err instanceof Error ? err.message : "Failed to reorder stages.";
        setError(msg);
        toast.error(msg);
        return false;
      }
    },
    [selectedPipeline, pipelines]
  );

  const setDefaultPipeline = useCallback(
    async (pipelineId: number) => {
      setSaving(true);
      setError("");
      setSuccess("");
      try {
        const res = await fetch(`/api/client/pipelines/${pipelineId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_default: true }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to set default template.");
        }

        const msg = "Template marked as company default successfully.";
        setSuccess(msg);
        toast.success(msg);
        await fetchPipelines();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to set default template.";
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [fetchPipelines]
  );

  const deletePipeline = useCallback(
    async (pipelineId: number) => {
      setSaving(true);
      setError("");
      setSuccess("");
      try {
        const res = await fetch(`/api/client/pipelines/${pipelineId}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to delete pipeline template.");
        }

        const msg = "Pipeline template deleted successfully.";
        setSuccess(msg);
        toast.success(msg);

        // Optimistically update list and switch selected if needed
        setPipelines((prev) => {
          const remaining = prev.filter((p) => p.id !== pipelineId);
          if (selectedPipelineId === pipelineId) {
            const nextSelected = remaining.find((p) => p.is_default) ?? remaining[0] ?? null;
            if (nextSelected) {
              setSelectedPipelineId(nextSelected.id);
            }
          }
          return remaining;
        });

        await fetchPipelines();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete pipeline template.";
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [selectedPipelineId, fetchPipelines]
  );

  return {
    pipelines,
    selectedPipeline,
    selectedPipelineId,
    setSelectedPipelineId,
    loading,
    saving,
    error,
    success,
    clearMessages,
    fetchPipelines,
    createPipeline,
    setDefaultPipeline,
    deletePipeline,
    addStage,
    updateStage,
    deleteStage,
    updateTransitions,
    moveStageOrder,
    reorderStages,
  };
}

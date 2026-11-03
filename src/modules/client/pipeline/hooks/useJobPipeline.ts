/* eslint-disable react-hooks/set-state-in-effect */
// src/modules/client/pipeline/hooks/useJobPipeline.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CanonicalStageType,
  JobPipelineVersion,
} from "../types";

export function useJobPipeline(jobId?: number | null) {
  const [pipeline, setPipeline] = useState<JobPipelineVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const clearMessages = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  // Switching jobs refetches, and the two responses can arrive in either order.
  // A stale pipeline for job A rendered under job B would send A's stage ids to
  // B's endpoints, so only the newest jobId may write.
  const requestedJobIdRef = useRef<number | null>(null);

  const fetchPipeline = useCallback(async () => {
    if (!jobId) {
      requestedJobIdRef.current = null;
      setPipeline(null);
      return;
    }
    requestedJobIdRef.current = jobId;
    const isCurrent = () => requestedJobIdRef.current === jobId;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/client/jobs/${jobId}/pipeline`, { cache: "no-store" });
      const json = await res.json();
      if (!isCurrent()) return;
      if (!res.ok) {
        throw new Error(json.error || "Failed to load job pipeline.");
      }
      setPipeline(json.pipeline ?? null);
    } catch (err) {
      if (!isCurrent()) return;
      const msg = err instanceof Error ? err.message : "Error fetching job pipeline.";
      setError(msg);
      toast.error(msg);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (jobId) {
      fetchPipeline();
    }
  }, [jobId, fetchPipeline]);

  const resetToCompanyDefault = useCallback(
    async (sourcePipelineId?: number) => {
      if (!jobId) return false;
      setSaving(true);
      setError("");
      setSuccess("");
      try {
        const res = await fetch(`/api/client/jobs/${jobId}/pipeline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_pipeline_id: sourcePipelineId }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to reset to company default.");
        }
        setSuccess("Hiring pipeline reset to company default snapshot.");
        toast.success("Hiring pipeline reset to company default snapshot.");
        if (json.pipeline) {
          setPipeline(json.pipeline);
        }
        await fetchPipeline();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to reset pipeline.";
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [jobId, fetchPipeline]
  );

  const addStage = useCallback(
    async (data: {
      stage_name: string;
      stage_type: CanonicalStageType;
      color?: string;
      description?: string;
    }) => {
      if (!jobId) return false;
      setSaving(true);
      setError("");
      setSuccess("");
      try {
        const res = await fetch(`/api/client/jobs/${jobId}/pipeline/stages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to add stage.");
        }
        setSuccess(`Stage "${data.stage_name}" added successfully.`);
        toast.success(`Stage "${data.stage_name}" added successfully.`);
        await fetchPipeline();
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
    [jobId, fetchPipeline]
  );

  const updateStage = useCallback(
    async (
      stageId: number,
      data: {
        stage_name?: string;
        color?: string;
        description?: string;
        stage_order?: number;
      }
    ) => {
      if (!jobId) return false;
      setSaving(true);
      setError("");
      setSuccess("");
      try {
        const res = await fetch(`/api/client/jobs/${jobId}/pipeline/stages/${stageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to update stage.");
        }
        setSuccess("Stage updated successfully.");
        toast.success("Stage updated successfully.");
        await fetchPipeline();
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
    [jobId, fetchPipeline]
  );

  const deleteStage = useCallback(
    async (stageId: number) => {
      if (!jobId || !pipeline) return false;
      const originalPipeline = { ...pipeline };

      // Optimistic update: instantly remove stage from state
      setPipeline((prev) =>
        prev
          ? {
              ...prev,
              stages: (prev.stages ?? []).filter((s) => s.id !== stageId),
            }
          : prev
      );

      setError("");
      setSuccess("");
      try {
        const res = await fetch(`/api/client/jobs/${jobId}/pipeline/stages/${stageId}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to delete stage.");
        }
        setSuccess("Stage removed successfully.");
        toast.success("Stage removed successfully.");
        return true;
      } catch (err) {
        // Rollback on failure
        setPipeline(originalPipeline);
        const msg = err instanceof Error ? err.message : "Failed to delete stage.";
        setError(msg);
        toast.error(msg);
        return false;
      }
    },
    [jobId, pipeline]
  );

  const updateTransitions = useCallback(
    async (fromStageId: number, targetStageIds: number[]) => {
      if (!jobId) return false;
      setSaving(true);
      setError("");
      setSuccess("");
      try {
        const res = await fetch(`/api/client/jobs/${jobId}/pipeline/transitions`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from_stage_id: fromStageId,
            target_stage_ids: targetStageIds,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to update transitions.");
        }
        setSuccess("Transition routes updated.");
        toast.success("Transition routes updated.");
        await fetchPipeline();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update transitions.";
        setError(msg);
        toast.error(msg);
        // One route can fail to retire after the new ones are live, so re-read
        // what the server actually holds instead of leaving the modal's choice
        // on screen.
        await fetchPipeline();
        return false;
      } finally {
        setSaving(false);
      }
    },
    [jobId, fetchPipeline]
  );

  const moveStageOrder = useCallback(
    async (stageId: number, direction: "up" | "down") => {
      if (!jobId || !pipeline?.stages) return false;
      const originalPipeline = { ...pipeline };

      const stages = [...pipeline.stages].sort((a, b) => a.stage_order - b.stage_order);
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
      setPipeline((prev) => (prev ? { ...prev, stages: reorderedStages } : prev));

      const orderedIds = reorderedStages.map((s) => s.id);
      setError("");

      try {
        const res = await fetch(`/api/client/jobs/${jobId}/pipeline/reorder`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ordered_stage_ids: orderedIds }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to reorder stages.");
        }
        return true;
      } catch (err) {
        // Rollback on failure
        setPipeline(originalPipeline);
        const msg = err instanceof Error ? err.message : "Failed to reorder stages.";
        setError(msg);
        toast.error(msg);
        return false;
      }
    },
    [jobId, pipeline]
  );

  return {
    pipeline,
    loading,
    saving,
    error,
    success,
    clearMessages,
    fetchPipeline,
    resetToCompanyDefault,
    addStage,
    updateStage,
    deleteStage,
    updateTransitions,
    moveStageOrder,
    isLocked: !!pipeline?.is_locked,
    applicationCount: pipeline?.application_count ?? 0,
  };
}

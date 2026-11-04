/* eslint-disable react-hooks/set-state-in-effect */
// src/modules/client/pipeline/components/JobPipelineSection.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useJobPipeline } from "../hooks/useJobPipeline";
import {
  CanonicalStageType,
  CompanyPipeline,
  JobPipelineStage,
  STAGE_COLOR_CLASSES,
  STAGE_TYPE_DETAILS,
} from "../types";
import StageEditModal from "./StageEditModal";
import TransitionConfigModal from "./TransitionConfigModal";
import JobAssessmentTaskBlock from "./JobAssessmentTaskBlock";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  GitFork,
  Trash2,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Lock,
  RotateCcw,
  Sparkles,
  Info,
} from "lucide-react";

interface JobPipelineSectionProps {
  jobId?: number | null;
  onSourcePipelineChange?: (pipelineId: number | undefined) => void;
  selectedSourcePipelineId?: number | null;
  readOnly?: boolean;
}

export default function JobPipelineSection({
  jobId,
  onSourcePipelineChange,
  selectedSourcePipelineId,
  readOnly = false,
}: JobPipelineSectionProps) {
  const {
    pipeline,
    loading,
    saving,
    clearMessages,
    fetchPipeline,
    resetToCompanyDefault,
    addStage,
    updateStage,
    deleteStage,
    updateTransitions,
    moveStageOrder,
    isLocked,
    applicationCount,
  } = useJobPipeline(jobId);

  // Customization Mode Toggle: "DEFAULT" | "CUSTOM"
  // An existing job already owns its snapshotted workflow, so the editor opens
  // on the mode that shows and edits those stages. Opening on "DEFAULT" used to
  // make the only visible action for a customized job a re-sync that replaces
  // them.
  const [mode, setMode] = useState<"DEFAULT" | "CUSTOM">(jobId ? "CUSTOM" : "DEFAULT");
  const [reSyncArmed, setReSyncArmed] = useState(false);

  // Modals
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<JobPipelineStage | null>(null);

  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [transitionSourceStage, setTransitionSourceStage] =
    useState<JobPipelineStage | null>(null);

  // Pipelines state for new jobs without an ID yet
  const [companyPipelines, setCompanyPipelines] = useState<CompanyPipeline[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [pipelineSelectionMode, setPipelineSelectionMode] = useState<"DEFAULT" | "TEMPLATE">("DEFAULT");

  // Deletion crack & split animation state
  const [deletingStageId, setDeletingStageId] = useState<number | null>(null);

  const handleDeleteStage = (stageId: number) => {
    if (deletingStageId !== null) return;
    setDeletingStageId(stageId);
    setTimeout(async () => {
      await deleteStage(stageId);
      setDeletingStageId(null);
    }, 420);
  };

  useEffect(() => {
    if (!jobId) {
      setLoadingPipelines(true);
      fetch("/api/client/pipelines")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.pipelines && Array.isArray(data.pipelines)) {
            setCompanyPipelines(data.pipelines);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingPipelines(false));
    }
  }, [jobId]);

  const defaultPipeline = useMemo(() => {
    return companyPipelines.find((p) => p.is_default) || companyPipelines[0] || null;
  }, [companyPipelines]);

  const templateOptions = useMemo(() => {
    return companyPipelines.map((p) => ({
      value: String(p.id),
      label: `${p.name}${p.is_default ? " (Default)" : ""}`,
    }));
  }, [companyPipelines]);

  // Synchronize selection mode if selectedSourcePipelineId changes from outside
  useEffect(() => {
    if (selectedSourcePipelineId && defaultPipeline) {
      if (selectedSourcePipelineId !== defaultPipeline.id) {
        setPipelineSelectionMode("TEMPLATE");
      }
    }
  }, [selectedSourcePipelineId, defaultPipeline]);

  const activeSelectedTemplateId = useMemo(() => {
    if (selectedSourcePipelineId) return selectedSourcePipelineId;
    return defaultPipeline?.id;
  }, [selectedSourcePipelineId, defaultPipeline]);

  const activePreviewPipeline = useMemo(() => {
    if (pipelineSelectionMode === "DEFAULT") {
      return defaultPipeline;
    }
    const found = companyPipelines.find((p) => p.id === activeSelectedTemplateId);
    return found || defaultPipeline;
  }, [pipelineSelectionMode, activeSelectedTemplateId, defaultPipeline, companyPipelines]);

  const handleSelectDefaultMode = () => {
    setPipelineSelectionMode("DEFAULT");
    onSourcePipelineChange?.(defaultPipeline?.id);
  };

  const handleSelectTemplateMode = () => {
    setPipelineSelectionMode("TEMPLATE");
    const idToUse = activeSelectedTemplateId || defaultPipeline?.id;
    if (idToUse) {
      onSourcePipelineChange?.(idToUse);
    }
  };

  const stages = pipeline?.stages ?? [];
  const sortedStages = [...stages].sort((a, b) => a.stage_order - b.stage_order);
  const stageMap = new Map(stages.map((s) => [s.id, s]));

  const handleOpenAddStage = () => {
    clearMessages();
    setEditingStage(null);
    setStageModalOpen(true);
  };

  const handleOpenEditStage = (st: JobPipelineStage) => {
    clearMessages();
    setEditingStage(st);
    setStageModalOpen(true);
  };

  const handleOpenTransitions = (st: JobPipelineStage) => {
    clearMessages();
    setTransitionSourceStage(st);
    setTransitionModalOpen(true);
  };

  const handleSaveStage = async (data: {
    stage_name: string;
    stage_type: CanonicalStageType;
    color: string;
    description: string;
  }) => {
    if (editingStage) {
      const ok = await updateStage(editingStage.id, {
        stage_name: data.stage_name,
        color: data.color,
        description: data.description,
      });
      if (ok) setStageModalOpen(false);
    } else {
      const ok = await addStage(data);
      if (ok) setStageModalOpen(false);
    }
  };

  const handleSaveTransitions = async (
    fromStageId: number,
    targetStageIds: number[]
  ) => {
    const ok = await updateTransitions(fromStageId, targetStageIds);
    if (ok) setTransitionModalOpen(false);
  };

  // If new job posting (jobId is not yet assigned)
  if (!jobId) {
    const previewStages = activePreviewPipeline?.stages ?? [];
    const sortedPreviewStages = [...previewStages].sort(
      (a, b) => a.stage_order - b.stage_order
    );

    return (
      <div className="space-y-4 p-5 bg-card border border-border/80 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" /> Hiring Pipeline Workflow
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose the pipeline template to snapshot for this job posting upon creation.
            </p>
          </div>
        </div>

        {/* Radio Option Header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Card 1: Company Default */}
          <div
            onClick={handleSelectDefaultMode}
            className={`flex flex-col justify-between p-3.5 rounded-lg border transition-all cursor-pointer ${
              pipelineSelectionMode === "DEFAULT"
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border/70 hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <div className="flex items-start gap-2.5">
              <input
                type="radio"
                name="hiring_pipeline_mode"
                checked={pipelineSelectionMode === "DEFAULT"}
                onChange={handleSelectDefaultMode}
                className="mt-0.5 text-primary focus:ring-primary cursor-pointer"
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-foreground">Company Default</p>
                  <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal text-muted-foreground">
                    Recommended
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Automatically snapshot standard company stages.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Choose Saved Template */}
          <div
            onClick={handleSelectTemplateMode}
            className={`flex flex-col justify-between p-3.5 rounded-lg border transition-all cursor-pointer ${
              pipelineSelectionMode === "TEMPLATE"
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border/70 hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <div className="flex items-start gap-2.5">
              <input
                type="radio"
                name="hiring_pipeline_mode"
                checked={pipelineSelectionMode === "TEMPLATE"}
                onChange={handleSelectTemplateMode}
                className="mt-0.5 text-primary focus:ring-primary cursor-pointer"
              />
              <div className="space-y-0.5 w-full">
                <p className="text-xs font-semibold text-foreground">Choose Saved Template</p>
                <p className="text-[11px] text-muted-foreground">
                  Select from any of your created pipeline templates.
                </p>

                {pipelineSelectionMode === "TEMPLATE" && (
                  <div
                    className="mt-2.5 pt-2 border-t border-border/40"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SearchableSelect
                      options={templateOptions}
                      value={activeSelectedTemplateId ? String(activeSelectedTemplateId) : undefined}
                      onValueChange={(val) => {
                        const id = Number(val);
                        onSourcePipelineChange?.(id);
                      }}
                      placeholder="Select a pipeline template..."
                      className="h-8 text-xs w-full bg-background"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Preview of stages */}
        <div className="pt-2 border-t border-border/60">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-primary" />
              <span>
                Snapshot Preview ({sortedPreviewStages.length} Stages):{" "}
                <span className="font-semibold text-foreground">
                  {activePreviewPipeline?.name || "Loading..."}
                </span>
              </span>
            </p>
            {Boolean(activePreviewPipeline?.is_default) ? (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal text-muted-foreground">
                Company Default
              </Badge>
            ) : null}
          </div>

          {loadingPipelines ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading pipeline stages...
            </div>
          ) : sortedPreviewStages.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-2">
              No stages defined in this pipeline template.
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {sortedPreviewStages.map((st, idx) => {
                const colorClass =
                  STAGE_COLOR_CLASSES[st.color] || STAGE_COLOR_CLASSES.sky;
                return (
                  <React.Fragment key={st.id || idx}>
                    <Badge
                      variant="outline"
                      className={`text-xs py-1 px-2.5 rounded-md font-semibold border ${colorClass}`}
                    >
                      {st.stage_name}
                    </Badge>
                    {idx < sortedPreviewStages.length - 1 && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border/40">
          <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span>
            Once created, you can further customize this job&apos;s stages and transition rules prior to receiving candidates.
          </span>
        </div>
      </div>
    );
  }

  // Editing existing job
  return (
    <div className="space-y-4 p-5 bg-card border border-border/80 rounded-xl">
      {/* Header and Locking State */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" /> Hiring Pipeline Workflow
            </Label>

          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dedicated candidate progression workflow for this job posting.
          </p>
        </div>

        {!readOnly && !isLocked && mode === "CUSTOM" && (
          <Button
            type="button"
            size="sm"
            onClick={handleOpenAddStage}
            disabled={saving}
            className="h-8 px-3 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Add Stage
          </Button>
        )}
      </div>


      {/* Immutability Notice if Locked */}
      {isLocked && (
        <div className="flex items-start gap-2.5 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-800 dark:text-amber-300 text-xs">
          <Lock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          {applicationCount < 0 ? (
            <div className="space-y-2">
              <div>
                <span className="font-bold">Hiring Pipeline Locked:</span> The
                candidate count for this job could not be read, so editing is
                refused until it can be verified.
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fetchPipeline()}
                disabled={loading}
                className="h-7 text-xs font-semibold gap-1.5"
              >
                <RotateCcw className="h-3 w-3" /> Try again
              </Button>
            </div>
          ) : (
            <div>
              <span className="font-bold">Hiring Pipeline Locked:</span> This job has received{" "}
              {applicationCount} candidate application(s). The active stage workflow is immutable
              to preserve candidate progress, transition history, and audit compliance.
            </div>
          )}
        </div>
      )}

      {/* Radio Choice (Disabled if locked or readOnly) */}
      {!readOnly && !isLocked && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <label
            onClick={() => setMode("DEFAULT")}
            className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
              mode === "DEFAULT"
                ? "border-primary/50 bg-primary/5 shadow-sm"
                : "border-border/60 hover:bg-muted/30"
            }`}
          >
            <input
              type="radio"
              name="hiring_pipeline_mode"
              checked={mode === "DEFAULT"}
              onChange={() => setMode("DEFAULT")}
              className="mt-0.5 text-primary focus:ring-primary"
            />
            <div>
              <p className="text-xs font-semibold text-foreground">Company Default</p>
              <p className="text-[11px] text-muted-foreground">
                Reset or keep identical to company standard hiring stages.
              </p>
            </div>
          </label>

          <label
            onClick={() => {
              setMode("CUSTOM");
              setReSyncArmed(false);
            }}
            className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
              mode === "CUSTOM"
                ? "border-primary/50 bg-primary/5 shadow-sm"
                : "border-border/60 hover:bg-muted/30"
            }`}
          >
            <input
              type="radio"
              name="hiring_pipeline_mode"
              checked={mode === "CUSTOM"}
              onChange={() => {
                setMode("CUSTOM");
                setReSyncArmed(false);
              }}
              className="mt-0.5 text-primary focus:ring-primary"
            />
            <div>
              <p className="text-xs font-semibold text-foreground">Customize for this Job</p>
              <p className="text-[11px] text-muted-foreground">
                Add unique stages, adjust sequence, or define transitions.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* If Mode is DEFAULT and not locked/readOnly, offer Reset button */}
      {!readOnly && !isLocked && mode === "DEFAULT" && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 text-xs">
          <span className="text-muted-foreground">
            {reSyncArmed
              ? "This replaces this job's stages, transitions and copied assessment tasks with the company template. Continue?"
              : "Want to re-synchronize with your latest company default template?"}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {reSyncArmed && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReSyncArmed(false)}
                disabled={saving}
                className="h-7 text-xs font-semibold"
              >
                Cancel
              </Button>
            )}
            <Button
              type="button"
              variant={reSyncArmed ? "destructive" : "outline"}
              size="sm"
              onClick={() => {
                if (!reSyncArmed) {
                  setReSyncArmed(true);
                  return;
                }
                setReSyncArmed(false);
                resetToCompanyDefault(pipeline?.source_pipeline_id ?? undefined);
              }}
              disabled={saving}
              className="h-7 text-xs font-semibold gap-1.5"
            >
              <RotateCcw className="h-3 w-3" />
              {reSyncArmed ? "Confirm re-sync" : "Re-sync from Company Default"}
            </Button>
          </div>
        </div>
      )}

      {/* Stage List / Interactive Editor */}
      <div className="space-y-2 pt-1">
        {loading && sortedStages.length === 0 ? (
          <div className="flex items-center justify-center py-8 gap-2 text-xs text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading job pipeline snapshot...
          </div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {sortedStages.map((st, index) => {
              const details = STAGE_TYPE_DETAILS[st.stage_type];
              const categoryLabel = details?.label || st.stage_type;
              const showCategoryBadge =
                st.stage_name.trim().toLowerCase() !== categoryLabel.trim().toLowerCase() &&
                !(st.stage_type === "APPLIED" && st.stage_name.trim().toLowerCase() === "application received");
              const colorClass =
                STAGE_COLOR_CLASSES[st.color] || STAGE_COLOR_CLASSES.sky;
              const allowedIds = st.allowed_next_stage_ids ?? [];

              const isDeleting = deletingStageId === st.id;

              const cardContent = (
                <>
                {/* Stage Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold text-muted-foreground w-4 text-center shrink-0">
                    {st.stage_order}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-xs py-0.5 px-2 rounded-md font-bold border ${colorClass}`}
                      >
                        {st.stage_name}
                      </Badge>

                      {showCategoryBadge && (
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          ({categoryLabel})
                        </span>
                      )}

                      {Boolean(st.is_system) && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1.5 py-0 rounded flex items-center gap-0.5 text-muted-foreground"
                        >
                          <ShieldCheck className="h-2.5 w-2.5" /> System
                        </Badge>
                      )}

                      {Boolean(st.is_terminal) && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1.5 py-0 rounded text-muted-foreground"
                        >
                          Terminal
                        </Badge>
                      )}
                    </div>

                    {st.description && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {st.description}
                      </p>
                    )}

                    {/* Transition Route Summary */}
                    {!st.is_terminal && (
                      <div className="mt-1">
                        {allowedIds.length === 0 ? (
                          <div className="space-y-0.5 text-[10px] pt-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                Progression:
                              </span>
                              <span className="text-amber-700 dark:text-amber-300 font-medium">
                                No progression stages configured
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap text-muted-foreground">
                              <span className="font-medium text-foreground/80">Terminal exits:</span>
                              <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                                <CheckCircle className="h-2.5 w-2.5" /> Rejected
                              </span>
                              <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                                <CheckCircle className="h-2.5 w-2.5" /> Withdrawn
                              </span>
                            </div>
                            <p className="text-amber-600 dark:text-amber-400 font-medium">
                              Candidates cannot reach Hired from this stage.
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                            <span className="font-semibold text-muted-foreground/80">
                              Next:
                            </span>
                            {allowedIds.map((targetId) => {
                              const target = stageMap.get(targetId);
                              if (!target) return null;
                              const tColor =
                                STAGE_COLOR_CLASSES[target.color] ||
                                STAGE_COLOR_CLASSES.sky;
                              return (
                                <Badge
                                  key={targetId}
                                  variant="outline"
                                  className={`text-[9px] px-1.5 py-0 rounded font-medium border ${tColor}`}
                                >
                                  → {target.stage_name}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions (Only enabled if !readOnly, !isLocked, and mode === "CUSTOM") */}
                {!readOnly && !isLocked && mode === "CUSTOM" && (
                  <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === 0 || sortedStages[index - 1]?.stage_type === "APPLIED"}
                      onClick={() => moveStageOrder(st.id, "up")}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                      title={index === 0 || sortedStages[index - 1]?.stage_type === "APPLIED" ? "Cannot move above initial application stage" : "Move Up"}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === sortedStages.length - 1 || st.stage_type === "APPLIED"}
                      onClick={() => moveStageOrder(st.id, "down")}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                      title={st.stage_type === "APPLIED" ? "Initial application stage cannot be moved down" : "Move Down"}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>

                    {!st.is_terminal && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenTransitions(st)}
                        disabled={saving}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Configure Transitions"
                      >
                        <GitFork className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEditStage(st)}
                      disabled={saving}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Edit Stage"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>

                    {!Boolean(st.is_system) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteStage(st.id)}
                        disabled={saving || deletingStageId !== null}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Delete Stage"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
                </>
              );

              if (isDeleting) {
                return (
                  <div key={st.id} className="relative w-full overflow-visible pointer-events-none">
                    {/* Left Cracked Piece */}
                    <motion.div
                      initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                      animate={{ x: -48, y: 36, rotate: -8.5, opacity: 0 }}
                      transition={{ duration: 0.42, ease: [0.36, 0, 0.66, -0.56] }}
                      style={{
                        clipPath: "polygon(0 0, 52% 0, 47% 30%, 54% 60%, 48% 85%, 52% 100%, 0 100%)",
                      }}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-destructive/60 bg-card shadow-lg gap-2"
                    >
                      {cardContent}
                    </motion.div>

                    {/* Right Cracked Piece */}
                    <motion.div
                      initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                      animate={{ x: 48, y: 42, rotate: 9.5, opacity: 0 }}
                      transition={{ duration: 0.42, ease: [0.36, 0, 0.66, -0.56] }}
                      style={{
                        clipPath: "polygon(52% 0, 100% 0, 100% 100%, 52% 100%, 48% 85%, 54% 60%, 47% 30%)",
                      }}
                      className="absolute inset-0 flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-destructive/60 bg-card shadow-lg gap-2"
                    >
                      {cardContent}
                    </motion.div>

                    {/* Lightning Fracture Line */}
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <motion.path
                        d="M 52 0 L 47 30 L 54 60 L 48 85 L 52 100"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        initial={{ pathLength: 0, opacity: 1 }}
                        animate={{ pathLength: 1, opacity: [1, 0.8, 0] }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="text-destructive drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]"
                      />
                      <motion.path
                        d="M 52 0 L 47 30 L 54 60 L 48 85 L 52 100"
                        fill="none"
                        stroke="white"
                        strokeWidth="1"
                        initial={{ pathLength: 0, opacity: 1 }}
                        animate={{ pathLength: 1, opacity: [1, 0.8, 0] }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                      />
                    </svg>
                  </div>
                );
              }

              return (
                <motion.div
                  key={st.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{
                    layout: { type: "spring", stiffness: 450, damping: 32 },
                    opacity: { duration: 0.2 },
                  }}
                  className="flex flex-col flex-wrap sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-border/70 bg-card hover:border-border transition-colors gap-2"
                >
                  {cardContent}
                  {st.stage_type === "ASSESSMENT" && jobId ? (
                    <JobAssessmentTaskBlock
                      jobId={jobId}
                      stageId={st.id}
                      stageType={st.stage_type}
                      readOnly={isLocked}
                      initialWindowDays={st.assessment_submission_window_days ?? null}
                    />
                  ) : null}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Modals */}
      <StageEditModal
        open={stageModalOpen}
        onClose={() => setStageModalOpen(false)}
        stage={editingStage}
        onSave={handleSaveStage}
        saving={saving}
      />

      <TransitionConfigModal
        open={transitionModalOpen}
        onClose={() => setTransitionModalOpen(false)}
        sourceStage={transitionSourceStage}
        allStages={sortedStages}
        onSave={handleSaveTransitions}
        saving={saving}
      />
    </div>
  );
}

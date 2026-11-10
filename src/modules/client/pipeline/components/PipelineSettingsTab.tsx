// src/modules/client/pipeline/components/PipelineSettingsTab.tsx
"use client";

import React, { useState, useMemo } from "react";
import { motion, Reorder, useDragControls } from "framer-motion";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { usePipelineSettings } from "../hooks/usePipelineSettings";
import {
  CanonicalStageType,
  PipelineStage,
  STAGE_COLOR_CLASSES,
  STAGE_TYPE_DETAILS,
} from "../types";
import StageEditModal from "./StageEditModal";
import TransitionConfigModal from "./TransitionConfigModal";
import AssessmentTaskEditor from "./AssessmentTaskEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  Layers,
  GripVertical,
  Star,
} from "lucide-react";

interface ReorderableStageItemProps {
  stage: PipelineStage;
  index: number;
  prevStage?: PipelineStage;
  totalStages: number;
  stageMap: Map<number, PipelineStage>;
  isDeleting: boolean;
  deletingStageId: number | null;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOpenTransitions: () => void;
  onOpenEditStage: () => void;
  onDeleteStage: () => void;
  belowCard?: React.ReactNode;
}

function ReorderableStageItem({
  stage,
  index,
  prevStage,
  totalStages,
  stageMap,
  isDeleting,
  deletingStageId,
  onMoveUp,
  onMoveDown,
  onOpenTransitions,
  onOpenEditStage,
  onDeleteStage,
  belowCard,
}: ReorderableStageItemProps) {
  const dragControls = useDragControls();

  const palette = STAGE_COLOR_CLASSES[stage.color] || STAGE_COLOR_CLASSES.sky;
  const categoryInfo = STAGE_TYPE_DETAILS[stage.stage_type];
  const categoryLabel = categoryInfo?.label ?? stage.stage_type;
  const showCategoryBadge =
    stage.stage_name.trim().toLowerCase() !== categoryLabel.trim().toLowerCase() &&
    !(
      stage.stage_type === "APPLIED" &&
      stage.stage_name.trim().toLowerCase() === "application received"
    );
  const nextStages = (stage.allowed_next_stage_ids ?? [])
    .map((id) => stageMap.get(id))
    .filter(Boolean) as PipelineStage[];

  const isApplied = stage.stage_type === "APPLIED";
  const isFirst = index === 0;
  const isLast = index === totalStages - 1;
  const isMoveUpDisabled = isFirst || prevStage?.stage_type === "APPLIED";
  const isMoveDownDisabled = isLast || isApplied;

  const cardContent = (
    <>
      {/* Stage Info */}
      <div className="flex items-start md:items-center gap-3 min-w-0">
        {/* Drag Handle & Ordering Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isApplied ? (
            <div
              className="p-1.5 rounded-md text-muted-foreground/30 cursor-not-allowed"
              title="First stage is fixed and cannot be reordered"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          ) : (
            <button
              type="button"
              onPointerDown={(e) => dragControls.start(e)}
              className="cursor-grab active:cursor-grabbing p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/80 transition-colors touch-none"
              title="Drag to reorder stage"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}

          <div className="flex flex-col items-center justify-center shrink-0 gap-0.5 pt-0.5 md:pt-0">
            <button
              type="button"
              disabled={isMoveUpDisabled}
              onClick={onMoveUp}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title={isMoveUpDisabled ? "Cannot move above initial application stage" : "Move Up"}
            >
              <ArrowUp className="h-3 w-3" />
            </button>
            <span className="text-[10px] font-bold text-muted-foreground w-4 text-center">
              {index + 1}
            </span>
            <button
              type="button"
              disabled={isMoveDownDisabled}
              onClick={onMoveDown}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title={isMoveDownDisabled ? "Initial application stage cannot be moved down" : "Move Down"}
            >
              <ArrowDown className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Stage Label & Details */}
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${palette.badge}`}
            >
              <span className={`h-2 w-2 rounded-full ${palette.dot}`} />
              <span>{stage.stage_name}</span>
            </div>

            {/* Canonical Badge */}
            {showCategoryBadge && (
              <Badge variant="outline" className="text-[10px] font-medium border-border/80">
                {categoryLabel}
              </Badge>
            )}

            {/* System / Terminal Indicators */}
            {Boolean(stage.is_system) && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <ShieldCheck className="h-3 w-3 text-primary" /> Core
              </span>
            )}
            {Boolean(stage.is_terminal) && (
              <Badge variant="secondary" className="text-[10px] bg-muted/80 text-muted-foreground">
                Terminal State
              </Badge>
            )}
          </div>

          {stage.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {stage.description}
            </p>
          )}

          {/* Next Transitions Pills */}
          {!stage.is_terminal && (
            <div className="pt-0.5">
              {nextStages.length === 0 ? (
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                    <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      Progression:
                    </span>
                    <span className="text-amber-700 dark:text-amber-300 font-medium">
                      No progression stages configured
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
                    <span className="font-medium text-foreground/80">Terminal exits:</span>
                    <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle className="h-2.5 w-2.5" /> Rejected
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle className="h-2.5 w-2.5" /> Withdrawn
                    </span>
                  </div>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    Candidates cannot reach Hired from this stage.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <ArrowRight className="h-3 w-3 text-primary" />
                    Leads to:
                  </span>
                  {nextStages.map((ns) => {
                    const nsPalette =
                      STAGE_COLOR_CLASSES[ns.color] || STAGE_COLOR_CLASSES.sky;
                    return (
                      <span
                        key={ns.id}
                        className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${nsPalette.badge}`}
                      >
                        {ns.stage_name}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
        {!stage.is_terminal && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenTransitions}
            className="h-7 text-xs gap-1 rounded-lg"
            title="Configure valid transitions from this stage"
          >
            <GitFork className="h-3.5 w-3.5 text-primary" />
            <span>Transitions</span>
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOpenEditStage}
          className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
          title="Edit stage name and appearance"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>

        {!Boolean(stage.is_system) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={deletingStageId !== null}
            onClick={onDeleteStage}
            className="h-7 w-7 p-0 rounded-lg text-destructive hover:bg-destructive/10"
            title="Delete stage"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </>
  );

  return (
    <Reorder.Item
      value={stage}
      dragListener={false}
      dragControls={dragControls}
      whileDrag={{
        scale: 1.015,
        boxShadow: "0 14px 28px -4px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
        zIndex: 50,
      }}
      transition={{
        layout: { type: "spring", stiffness: 450, damping: 32 },
      }}
      className={`group relative rounded-xl transition-colors select-none ${isDeleting
        ? "overflow-visible pointer-events-none border-transparent bg-transparent shadow-none"
        : "border border-border/80 bg-card hover:border-primary/40 hover:shadow-xs"
        }`}
    >
      {isDeleting ? (
        <div className="relative w-full overflow-visible pointer-events-none">
          {/* Left Cracked Piece */}
          <motion.div
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
            animate={{ x: -48, y: 36, rotate: -8.5, opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.36, 0, 0.66, -0.56] }}
            style={{
              clipPath: "polygon(0 0, 52% 0, 47% 30%, 54% 60%, 48% 85%, 52% 100%, 0 100%)",
            }}
            className="flex flex-col md:flex-row md:items-center justify-between p-3.5 md:p-4 rounded-xl border border-destructive/60 bg-card shadow-lg gap-3"
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
            className="absolute inset-0 flex flex-col md:flex-row md:items-center justify-between p-3.5 md:p-4 rounded-xl border border-destructive/60 bg-card shadow-lg gap-3"
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
      ) : (
        <div className="flex flex-col md:flex-row md:items-center justify-between p-3.5 md:p-4 gap-3">
          {cardContent}
        </div>
      )}
      {belowCard ? (
        <div className="px-3.5 pb-3.5 md:px-4 md:pb-4">{belowCard}</div>
      ) : null}
    </Reorder.Item>
  );
}

interface PipelineSettingsTabProps {
  isStandalonePage?: boolean;
}

export default function PipelineSettingsTab({ isStandalonePage = true }: PipelineSettingsTabProps = {}) {
  const {
    pipelines,
    selectedPipeline,
    selectedPipelineId,
    setSelectedPipelineId,
    loading,
    saving,
    clearMessages,
    createPipeline,
    setDefaultPipeline,
    deletePipeline,
    addStage,
    updateStage,
    deleteStage,
    updateTransitions,
    moveStageOrder,
    reorderStages,
  } = usePipelineSettings();

  // Modals state
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);

  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [transitionSourceStage, setTransitionSourceStage] =
    useState<PipelineStage | null>(null);

  const [newPipelineModalOpen, setNewPipelineModalOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");

  const [deletePipelineModalOpen, setDeletePipelineModalOpen] = useState(false);
  const [deletingPipeline, setDeletingPipeline] = useState(false);

  const handleConfirmDeletePipeline = async () => {
    if (!selectedPipeline || deletingPipeline) return;
    setDeletingPipeline(true);
    try {
      const ok = await deletePipeline(selectedPipeline.id);
      if (ok) {
        setDeletePipelineModalOpen(false);
      }
    } finally {
      setDeletingPipeline(false);
    }
  };

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

  const handleOpenAddStage = () => {
    clearMessages();
    setEditingStage(null);
    setStageModalOpen(true);
  };

  const handleOpenEditStage = (stage: PipelineStage) => {
    clearMessages();
    setEditingStage(stage);
    setStageModalOpen(true);
  };

  const handleOpenTransitions = (stage: PipelineStage) => {
    clearMessages();
    setTransitionSourceStage(stage);
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

  const handleCreateNewPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPipelineName.trim()) return;
    const ok = await createPipeline(newPipelineName.trim());
    if (ok) {
      setNewPipelineName("");
      setNewPipelineModalOpen(false);
    }
  };

  const stages = selectedPipeline?.stages ?? [];
  const sortedStages = [...stages].sort((a, b) => a.stage_order - b.stage_order);
  const stageMap = new Map(stages.map((s) => [s.id, s]));

  const pipelineOptions = useMemo(() => {
    return pipelines.map((p) => ({
      value: String(p.id),
      label: `${p.name} ${p.is_default ? "(Default)" : ""}`.trim(),
    }));
  }, [pipelines]);

  if (loading && !selectedPipeline) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Page Header Skeleton */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-64 rounded-xl bg-muted/70" />
            <div className="h-4 w-80 sm:w-96 rounded-lg bg-muted/40" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-36 rounded-xl bg-muted/60" />
            <div className="h-9 w-28 rounded-full bg-muted/60" />
          </div>
        </div>

        {/* Main Pipeline Container Skeleton */}
        <Card className="overflow-hidden rounded-2xl border border-primary/10 bg-card/80 backdrop-blur-xl shadow-sm">
          <CardContent className="p-0">
            {/* Template Summary Bar Skeleton */}
            <div className="h-16 border-b border-primary/10 bg-muted/20 p-4 sm:px-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-5 w-40 rounded-lg bg-muted/60" />
                <div className="h-5 w-24 rounded-full bg-muted/40" />
                <div className="h-4 w-28 rounded-lg bg-muted/40" />
              </div>
              <div className="h-8 w-28 rounded-full bg-muted/50" />
            </div>

            {/* Stages List Skeletons */}
            <div className="p-4 sm:p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl border border-border/80 bg-card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="h-9 w-9 rounded-xl bg-muted/60 shrink-0" />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-48 rounded-full bg-muted/70" />
                        <div className="h-5 w-16 rounded-full bg-muted/40" />
                      </div>
                      <div className="h-3.5 w-72 rounded-md bg-muted/40" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <div className="h-8 w-24 rounded-xl bg-muted/60" />
                    <div className="h-8 w-8 rounded-xl bg-muted/50" />
                    <div className="h-8 w-8 rounded-xl bg-muted/40" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header and Template Switcher */}
      {isStandalonePage ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              ATS Pipeline Configuration
            </h1>
            <p className="text-sm text-muted-foreground">
              Design custom progression stages, enforce valid candidate transitions, and assign automated assessment workflows.
            </p>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex flex-wrap items-center gap-2.5">
            {pipelines.length > 1 && (
              <div className="w-full sm:w-auto sm:min-w-[210px]">
                <SearchableSelect
                  options={pipelineOptions}
                  value={selectedPipelineId ? String(selectedPipelineId) : undefined}
                  onValueChange={(val) => setSelectedPipelineId(Number(val))}
                  placeholder="Select Template"
                  className="h-9 text-xs bg-card/70 border-primary/15 rounded-xl font-medium"
                />
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewPipelineModalOpen(true)}
              className="h-9 text-xs px-3.5 gap-1.5 rounded-full border-primary/20 bg-card/60 hover:bg-primary/10 font-medium"
            >
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span>New Template</span>
            </Button>
            {pipelines.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving || deletingPipeline}
                onClick={() => setDeletePipelineModalOpen(true)}
                className="h-8 text-xs gap-1.5 rounded-full border-destructive/20 text-destructive hover:bg-destructive/10 hover:border-destructive/40 transition-colors"
                title="Delete this template"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Template
              </Button>
            )}

          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">Hiring Workflow & ATS Pipeline</h2>
              <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                Configurable Workflow Layer
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Customize the stages and transition rules for candidate progression. All custom stages map to deterministic canonical categories.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {pipelines.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Template:</span>
                <SearchableSelect
                  options={pipelineOptions}
                  value={selectedPipelineId ? String(selectedPipelineId) : undefined}
                  onValueChange={(val) => setSelectedPipelineId(Number(val))}
                  placeholder="Template"
                  className="h-8 text-xs w-72"
                />
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewPipelineModalOpen(true)}
              className="h-8 text-xs gap-1.5 rounded-lg"
            >
              <Layers className="h-3.5 w-3.5" />
              New Template
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleOpenAddStage}
              className="h-8 text-xs gap-1.5 rounded-lg"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Stage
            </Button>
          </div>
        </div>
      )}

      {/* Main Pipeline Container Card */}
      <Card className="overflow-hidden rounded-2xl !py-0 border border-primary/10 bg-card/80 backdrop-blur-xl shadow-sm">
        <CardContent className="p-0  pt-2 ">
          {/* Pipeline Status Summary Toolbar */}
          {selectedPipeline && (
            <div className="p-4 sm:px-6 border-b border-primary/10 bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <Layers className="h-4 w-4 text-primary" />
                  <span>{selectedPipeline.name}</span>
                </div>
                {Boolean(selectedPipeline.is_default) ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                    <Star className="h-3 w-3 fill-primary text-primary" /> Company Default
                  </span>
                ) : (
                  <Badge variant="outline" className="text-[11px] text-muted-foreground border-border/70">
                    Custom Template
                  </Badge>
                )}
                <span className="text-muted-foreground font-medium">
                  · <strong className="text-foreground">{sortedStages.length}</strong> Total Stages
                </span>
                <span className="text-muted-foreground font-medium">
                  · <strong className="text-foreground">{sortedStages.filter((s) => !s.is_terminal).length}</strong> Active Progression Steps
                </span>
                <span className="text-muted-foreground font-medium">
                  · <strong className="text-foreground">{sortedStages.filter((s) => s.is_terminal).length}</strong> Terminal Exits
                </span>
              </div>

              {!Boolean(selectedPipeline.is_default) && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving || deletingPipeline}
                    onClick={() => setDefaultPipeline(selectedPipeline.id)}
                    className="h-8 text-xs gap-1.5 rounded-full border-primary/20 hover:bg-primary/10 hover:text-primary transition-colors"
                    title="Make this template the default for all future jobs"
                  >
                    <Star className="h-3.5 w-3.5 text-primary" />
                    Make Default
                  </Button>
                  
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleOpenAddStage}
                    className="h-9 text-xs px-4 gap-1.5 rounded-full font-semibold bg-gradient-to-r from-primary to-info hover:brightness-110 shadow-sm shadow-primary/25 text-primary-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Stage</span>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Stages List */}
          <div className="p-4 sm:p-6 space-y-3">
            {sortedStages.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl p-8">
                <p className="text-sm font-semibold text-muted-foreground">No stages configured</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add your first stage to build the hiring workflow.
                </p>
                <Button
                  type="button"
                  onClick={handleOpenAddStage}
                  className="mt-4 h-8 text-xs gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add First Stage
                </Button>
              </div>
            ) : (
              <Reorder.Group
                axis="y"
                values={sortedStages}
                onReorder={reorderStages}
                className="space-y-3"
              >
                {sortedStages.map((stage, index) => (
                  <ReorderableStageItem
                    key={stage.id}
                    stage={stage}
                    index={index}
                    prevStage={index > 0 ? sortedStages[index - 1] : undefined}
                    totalStages={sortedStages.length}
                    stageMap={stageMap}
                    isDeleting={deletingStageId === stage.id}
                    deletingStageId={deletingStageId}
                    onMoveUp={() => moveStageOrder(stage.id, "up")}
                    onMoveDown={() => moveStageOrder(stage.id, "down")}
                    onOpenTransitions={() => handleOpenTransitions(stage)}
                    onOpenEditStage={() => handleOpenEditStage(stage)}
                    onDeleteStage={() => handleDeleteStage(stage.id)}
                    belowCard={
                      stage.stage_type === "ASSESSMENT" && selectedPipeline ? (
                        <AssessmentTaskEditor
                          stageId={stage.id}
                          stageType={stage.stage_type}
                          initialWindowDays={stage.assessment_submission_window_days ?? null}
                          endpoints={{
                            list: `/api/client/pipelines/${selectedPipeline.id}/stages/${stage.id}/assessment-tasks`,
                            create: `/api/client/pipelines/${selectedPipeline.id}/stages/${stage.id}/assessment-tasks`,
                            update: (taskId: number) =>
                              `/api/client/pipelines/${selectedPipeline.id}/stages/${stage.id}/assessment-tasks/${taskId}`,
                            remove: (taskId: number) =>
                              `/api/client/pipelines/${selectedPipeline.id}/stages/${stage.id}/assessment-tasks/${taskId}`,
                            reorder: `/api/client/pipelines/${selectedPipeline.id}/stages/${stage.id}/assessment-tasks/reorder`,
                            window: `/api/client/pipelines/${selectedPipeline.id}/stages/${stage.id}`,
                            library: "/api/client/assessment-tasks/library",
                          }}
                        />
                      ) : undefined
                    }
                  />
                ))}
              </Reorder.Group>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stage Editor Modal */}
      <StageEditModal
        open={stageModalOpen}
        onClose={() => setStageModalOpen(false)}
        stage={editingStage}
        onSave={handleSaveStage}
        saving={saving}
      />

      {/* Transition Configuration Modal */}
      <TransitionConfigModal
        open={transitionModalOpen}
        onClose={() => setTransitionModalOpen(false)}
        sourceStage={transitionSourceStage}
        allStages={sortedStages}
        onSave={handleSaveTransitions}
        saving={saving}
      />

      {/* New Pipeline Modal */}
      <Dialog open={newPipelineModalOpen} onOpenChange={setNewPipelineModalOpen}>
        <DialogContent className="max-w-sm max-md:max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Create New Pipeline Template
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateNewPipeline} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pipe-name" className="text-xs font-medium">
                Template Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="pipe-name"
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                placeholder="e.g., Engineering Pipeline, Executive Hiring"
                className="h-9 text-xs"
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewPipelineModalOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="h-8 text-xs">
                {saving ? "Creating..." : "Create Pipeline"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Pipeline Template Confirmation Modal */}
      <Dialog open={deletePipelineModalOpen} onOpenChange={setDeletePipelineModalOpen}>
        <DialogContent className="max-w-sm max-md:max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-destructive flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Delete Pipeline Template
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs text-muted-foreground">
            <p>
              Are you sure you want to delete <strong className="text-foreground">{selectedPipeline ? `"${selectedPipeline.name}"` : "this template"}</strong>?
            </p>
            <p>
              This template will be removed from your company templates. Existing jobs that previously copied this template will not be affected.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={deletingPipeline}
              onClick={() => setDeletePipelineModalOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingPipeline}
              onClick={handleConfirmDeletePipeline}
              className="h-8 text-xs gap-1.5"
            >
              <Trash2 className="h-3 w-3" />
              {deletingPipeline ? "Deleting..." : "Delete Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

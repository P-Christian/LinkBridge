// src/modules/client/pipeline/components/AssessmentTaskEditor.tsx
// Reusable employer authoring surface for assessment tasks bound to a
// pipeline stage. Driven entirely by caller-supplied endpoint URLs so the
// same component serves company pipeline stages and job pipeline stages.
// Client surface: correct answers are visible here by design and must never
// be forwarded into freelancer-facing payloads.
"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { CreateTaskInput } from "@/modules/shared/assessment";
import { AlertCircle, ChevronDown, ClipboardList, Loader2, Plus } from "lucide-react";
import TaskForm from "./assessment-task-editor/TaskForm";
import TaskRow from "./assessment-task-editor/TaskRow";
import SubmissionWindowField from "./assessment-task-editor/SubmissionWindowField";
import TaskSourceModal from "./assessment-task-editor/TaskSourceModal";
import { useAssessmentTasks } from "./assessment-task-editor/useAssessmentTasks";
import {
  formStateFromTask,
  type TaskFormState,
} from "./assessment-task-editor/task-form-state";
import type {
  AssessmentTaskEditorEndpoints,
  AssessmentTaskEditorProps,
} from "./assessment-task-editor/types";
import { motion, AnimatePresence, Reorder } from "framer-motion";

export type { AssessmentTaskEditorEndpoints, AssessmentTaskEditorProps };

export default function AssessmentTaskEditor({
  stageId,
  stageType,
  endpoints,
  readOnly = false,
  initialWindowDays = null,
}: AssessmentTaskEditorProps) {
  const isAssessment = stageType === "ASSESSMENT";
  const {
    tasks,
    loading,
    error,
    submitting,
    busyTaskId,
    isReordering,
    loadInitial,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    reorderTasks,
  } = useAssessmentTasks({
    listUrl: endpoints.list,
    createUrl: endpoints.create,
    reorderUrl: endpoints.reorder,
    updateUrl: endpoints.update,
    removeUrl: endpoints.remove,
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [reuseInitial, setReuseInitial] = useState<TaskFormState | null>(null);
  const [reuseSeq, setReuseSeq] = useState(0);
  // The job detail sheet renders this read-only inside an already long pipeline
  // list, so it starts folded there; authors need the controls visible.
  const [open, setOpen] = useState(!readOnly);

  // The effect only kicks off the async load; every setState happens in
  // promise callbacks and event handlers, never synchronously here.
  useEffect(() => {
    if (isAssessment) {
      void loadInitial();
    }
  }, [isAssessment, loadInitial, stageId]);

  // Company pipeline stages carry a library endpoint and get the chooser
  // modal; job stages omit it and open the blank form directly.
  const openAddFlow = () => {
    setOpen(true);
    setEditingTaskId(null);
    if (endpoints.library) {
      setChooserOpen(true);
      return;
    }
    setReuseInitial(null);
    setReuseSeq((seq) => seq + 1);
    setShowAddForm(true);
  };

  if (!isAssessment) {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 text-xs text-muted-foreground">
        Assessment tasks can only be authored on ASSESSMENT stages.
      </div>
    );
  }

  const handleCreate = async (
    payload: CreateTaskInput
  ): Promise<string | null> => {
    const failure = await createTask(payload);
    if (!failure) {
      setShowAddForm(false);
      setReuseInitial(null);
    }
    return failure;
  };

  const handleUpdate = async (
    taskId: number,
    payload: CreateTaskInput
  ): Promise<string | null> => {
    const failure = await updateTask(taskId, payload);
    if (!failure) setEditingTaskId(null);
    return failure;
  };

  const handleConfirmDelete = async (taskId: number): Promise<void> => {
    const deleted = await deleteTask(taskId);
    if (deleted) setConfirmDeleteId(null);
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="space-y-3 rounded-xl border border-border/80 bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CollapsibleTrigger className="group flex min-w-0 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              !open && "-rotate-90"
            )}
          />
          <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="text-sm font-semibold tracking-tight">
            Assessment tasks
          </h3>
          {!loading && tasks.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {tasks.length} task{tasks.length === 1 ? "" : "s"}
            </Badge>
          )}
        </CollapsibleTrigger>
        {!readOnly && !showAddForm && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openAddFlow}
            className="h-8 text-xs gap-1.5 rounded-lg"
          >
            <Plus className="h-3.5 w-3.5" /> Add task
          </Button>
        )}
      </div>

      <CollapsibleContent className="space-y-3">
        {readOnly && (
          <p className="text-[11px] text-muted-foreground">
            Assessment tasks are read-only because this job is locked (it has
            applications).
          </p>
        )}

        {endpoints.window ? (
          <SubmissionWindowField
            endpoint={endpoints.window}
            initialDays={initialWindowDays}
            readOnly={readOnly}
          />
        ) : null}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void loadInitial()}
              className="h-7 shrink-0 text-xs"
            >
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">
              Loading assessment tasks...
            </span>
          </div>
        ) : tasks.length === 0 && !showAddForm ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <ClipboardList className="mx-auto h-6 w-6 text-muted-foreground/60" />
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              No assessment tasks yet
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Add single-choice questions, external tasks, file uploads, or text
              responses for candidates in this stage.
            </p>
            {!readOnly && (
              <Button
                type="button"
                size="sm"
                onClick={openAddFlow}
                className="mt-3 h-8 text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add first task
              </Button>
            )}
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={tasks}
            onReorder={(newTasks) => {
              if (!isReordering && !submitting && busyTaskId === null) {
                void reorderTasks(newTasks);
              }
            }}
            className="space-y-2"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {tasks.map((task, index) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === tasks.length - 1}
                  busy={busyTaskId === task.id}
                  submitting={submitting}
                  isReordering={isReordering}
                  editing={editingTaskId === task.id}
                  confirmingDelete={confirmDeleteId === task.id}
                  readOnly={readOnly}
                  onMove={(direction) => void moveTask(task.id, direction)}
                  onStartEdit={() => {
                    setConfirmDeleteId(null);
                    setShowAddForm(false);
                    setEditingTaskId(task.id);
                  }}
                  onCancelEdit={() => setEditingTaskId(null)}
                  onSubmitEdit={(payload) => handleUpdate(task.id, payload)}
                  onAskDelete={() => {
                    setEditingTaskId(null);
                    setConfirmDeleteId(task.id);
                  }}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  onConfirmDelete={() => void handleConfirmDelete(task.id)}
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}

        <AnimatePresence>
          {showAddForm && !readOnly && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <TaskForm
                key={`add-${reuseSeq}`}
                initial={reuseInitial}
                sortOrder={tasks.length + 1}
                submitting={submitting}
                onCancel={() => {
                  setShowAddForm(false);
                  setReuseInitial(null);
                }}
                onSubmit={handleCreate}
              />
            </motion.div>
          )}
        </AnimatePresence>

      </CollapsibleContent>

      {endpoints.library ? (
        <TaskSourceModal
          open={chooserOpen}
          libraryEndpoint={endpoints.library}
          onClose={() => setChooserOpen(false)}
          onPickBlank={() => {
            setReuseInitial(null);
            setReuseSeq((seq) => seq + 1);
            setChooserOpen(false);
            setShowAddForm(true);
          }}
          onPickTask={(task) => {
            setReuseInitial(formStateFromTask(task));
            setReuseSeq((seq) => seq + 1);
            setChooserOpen(false);
            setShowAddForm(true);
          }}
        />
      ) : null}
    </Collapsible>
  );
}

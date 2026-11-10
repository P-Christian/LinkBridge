// src/modules/client/pipeline/components/assessment-task-editor/useAssessmentTasks.ts
// Server-state owner for the assessment task editor: list loading plus
// create / update / delete / reorder against caller-supplied endpoints.
// UI state (open forms, delete confirmation) stays in the components.

import { useCallback, useState } from "react";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import type { CompanyAssessmentTaskRow } from "../../services/assessment-task.service";
import type { CreateTaskInput } from "@/modules/shared/assessment";
import { fetchTaskList, readErrorMessage } from "./task-api";
import { toUpdateInput } from "./task-submit";

interface UseAssessmentTasksOptions {
  listUrl: string;
  createUrl: string;
  reorderUrl: string;
  updateUrl: (taskId: number) => string;
  removeUrl: (taskId: number) => string;
}

export function useAssessmentTasks(options: UseAssessmentTasksOptions) {
  const { listUrl, createUrl, reorderUrl } = options;
  const [tasks, setTasks] = useState<CompanyAssessmentTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const abortRead = useRequestAbort();

  /**
   * Every list read claims a token, so only the newest one writes state. Two
   * edits to one stage's tasks could otherwise land out of order and leave the
   * editor showing another stage's rows — which is what its update and delete
   * URLs would then be aimed at.
   */
  const readList = useCallback(
    async (url: string) => {
      const signal = abortRead();
      try {
        const fresh = await fetchTaskList(url, signal);
        if (signal.aborted) return;
        setTasks(fresh);
      } catch (err: unknown) {
        if (signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load tasks.");
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [abortRead]
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError("");
    await readList(listUrl);
  }, [listUrl, readList]);

  const createTask = async (
    payload: CreateTaskInput
  ): Promise<string | null> => {
    setSubmitting(true);
    try {
      const res = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return await readErrorMessage(res);
      await readList(listUrl);
      return null;
    } catch {
      return "Failed to create the task. Try again.";
    } finally {
      setSubmitting(false);
    }
  };

  const updateTask = async (
    taskId: number,
    payload: CreateTaskInput
  ): Promise<string | null> => {
    setSubmitting(true);
    try {
      const res = await fetch(options.updateUrl(taskId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toUpdateInput(payload)),
      });
      if (!res.ok) return await readErrorMessage(res);
      await readList(listUrl);
      return null;
    } catch {
      return "Failed to save the task. Try again.";
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTask = async (taskId: number): Promise<boolean> => {
    setBusyTaskId(taskId);
    const previous = tasks;
    // Optimistic removal for immediate smooth exit animation
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    try {
      const res = await fetch(options.removeUrl(taskId), {
        method: "DELETE",
      });
      if (!res.ok) {
        setTasks(previous);
        setError(await readErrorMessage(res));
        return false;
      }
      setError("");
      return true;
    } catch {
      setTasks(previous);
      setError("Failed to delete the task. Try again.");
      return false;
    } finally {
      setBusyTaskId(null);
    }
  };

  const reorderTasks = async (
    newTasks: CompanyAssessmentTaskRow[]
  ): Promise<void> => {
    if (isReordering) return;
    setIsReordering(true);
    const previous = tasks;
    const reindexed = newTasks.map((task, idx) => ({
      ...task,
      sort_order: idx + 1,
    }));
    setTasks(reindexed);

    try {
      const res = await fetch(reorderUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordered_task_ids: reindexed.map((task) => task.id),
        }),
      });
      if (!res.ok) {
        setTasks(previous);
        setError(await readErrorMessage(res));
        return;
      }
      setError("");
    } catch {
      setTasks(previous);
      setError("Failed to reorder tasks. Try again.");
    } finally {
      setIsReordering(false);
    }
  };

  const moveTask = async (
    taskId: number,
    direction: "up" | "down"
  ): Promise<void> => {
    if (isReordering) return;
    const index = tasks.findIndex((task) => task.id === taskId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= tasks.length) return;

    const next = [...tasks];
    const moving = next[index];
    next[index] = next[target];
    next[target] = moving;

    await reorderTasks(next);
  };

  return {
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
  };
}

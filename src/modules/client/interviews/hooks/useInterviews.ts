"use client";

// src/modules/client/interviews/hooks/useInterviews.ts

import { useCallback, useMemo, useState } from "react";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import {
  Interview,
  InterviewFormData,
  EvaluationFormData,
  InterviewStatus,
} from "../types";
import {
  fetchInterviews,
  createInterviewSchedule,
  updateInterviewDetails,
  submitInterviewEvaluation,
} from "../providers/InterviewsProvider";

import { toast } from "sonner";

export const EMPTY_FORM: InterviewFormData = {
  application_ids: [],
  scheduled_at: "",
  duration_minutes: 60,
  timezone: "Asia/Manila",
  interview_format: "",
  meeting_link: "",
  meeting_location: "",
  interview_notes: "",
  include_buffer: true,
};

export function useInterviews() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [filterStatus, setFilterStatus] = useState<InterviewStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");

  const abortRead = useRequestAbort();

  const loadInterviews = useCallback(async (status?: InterviewStatus | "ALL") => {
    setLoading(true);
    setError("");
    const signal = abortRead();
    try {
      const data = await fetchInterviews(status, signal);
      setInterviews(data);
    } catch (err: unknown) {
      if (signal.aborted) return;
      const msg = err instanceof Error ? err.message : "An error occurred.";
      setError(msg);
      toast.error(msg);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [abortRead]);

  const createInterview = useCallback(async (data: InterviewFormData) => {
    setSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const warnings = await createInterviewSchedule(data);
      const msg = "Interview scheduled successfully.";
      setSuccessMessage(msg);
      toast.success(msg);
      warnings.forEach((warning) => toast.warning(warning));
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to schedule interview.";
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateStatus = useCallback(
    async (
      interviewId: number,
      status: InterviewStatus,
      extra?: Partial<InterviewFormData> & { cancel_reason?: string }
    ) => {
      setSaving(true);
      setError("");
      setSuccessMessage("");
      try {
        await updateInterviewDetails(interviewId, {
          interview_status: status,
          ...extra,
        });
        setInterviews((prev) =>
          prev.map((item) =>
            item.interview_id === interviewId
              ? {
                  ...item,
                  interview_status: status,
                  scheduled_at: extra?.scheduled_at ?? item.scheduled_at,
                  duration_minutes: extra?.duration_minutes ?? item.duration_minutes,
                  timezone: extra?.timezone ?? item.timezone,
                  meeting_link: extra?.meeting_link ?? item.meeting_link,
                  meeting_location: extra?.meeting_location ?? item.meeting_location,
                  cancel_reason: extra?.cancel_reason ?? item.cancel_reason,
                }
              : item
          )
        );
        const msg = `Interview status updated to ${status}.`;
        setSuccessMessage(msg);
        toast.success(msg);
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to update interview.";
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const saveEvaluation = useCallback(
    async (payload: EvaluationFormData) => {
      setSaving(true);
      setError("");
      setSuccessMessage("");
      try {
        const warnings = await submitInterviewEvaluation(payload);
        const msg = "Evaluation recorded successfully.";
        setSuccessMessage(msg);
        toast.success(msg);
        // The evaluation row is committed but the stage move, notes or the
        // candidate email may not be; the refresh alone would hide that.
        warnings.forEach((warning) => toast.warning(warning));
        await loadInterviews();
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to save evaluation.";
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [loadInterviews]
  );

  const filteredInterviews = useMemo(() => {
    const query = search.trim().toLowerCase();
    return interviews.filter((item) => {
      const matchesStatus =
        filterStatus === "ALL" || item.interview_status === filterStatus;
      if (!matchesStatus) return false;
      if (!query) return true;

      const hasApplicantMatch = item.applications?.some(
        (app) =>
          app.applicant_name?.toLowerCase().includes(query) ||
          app.job_title?.toLowerCase().includes(query)
      );

      return Boolean(
        hasApplicantMatch || item.meeting_location?.toLowerCase().includes(query)
      );
    });
  }, [interviews, filterStatus, search]);

  return {
    interviews: filteredInterviews,
    rawInterviews: interviews,

    loading,
    saving,
    error,
    successMessage,

    filterStatus,
    setFilterStatus,
    search,
    setSearch,

    loadInterviews,
    createInterview,
    updateStatus,
    saveEvaluation,

    clearMessages: () => {
      setError("");
      setSuccessMessage("");
    },

    EMPTY_FORM,
  };
}

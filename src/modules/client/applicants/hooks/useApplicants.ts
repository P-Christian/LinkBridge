"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import {
  Applicant,
  ApplicantFilterStatus,
  ApplicationStatus,
  AssessmentMoveOutcome,
  CandidateDetail,
} from "../types";
import { JobPipelineVersion } from "@/modules/client/pipeline/types";
import {
  ApplicantFiltersState,
  EMPTY_APPLICANT_FILTERS,
  matchesAdvancedFilters,
  matchesStageFilter,
} from "../utils/applicantFilters";

export interface UpdateStatusResult {
  ok: boolean;
  /** True when the move left an ASSESSMENT stage toward a non-exit target and
   *  must be routed through requestStageMove (assessment decision modal)
   *  instead of a direct stage PATCH. No mutation was performed. */
  gated: boolean;
  toStageId?: number;
  stageName?: string;
}

export function useApplicants() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [jobPipeline, setJobPipeline] = useState<JobPipelineVersion | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [filterStatus, setFilterStatus] = useState<ApplicantFilterStatus>("ACTIVE_PIPELINE");

  const [search, setSearch] = useState("");

  const [filters, setFilters] = useState<ApplicantFiltersState>(
    EMPTY_APPLICANT_FILTERS
  );

  const [detail, setDetail] =
    useState<CandidateDetail | null>(null);

  const [detailLoading, setDetailLoading] =
    useState(false);

  const [detailError, setDetailError] =
    useState("");

  // --------------------------------
  // Fetch applicant list
  // --------------------------------

  const abortRead = useRequestAbort();
  // Separate controller: the list read and a candidate-detail read must not
  // cancel each other.
  const abortDetail = useRequestAbort();

  const fetchApplicants = useCallback(
    async (
      status?: ApplicantFilterStatus,
      jobId?: number
    ) => {
      setLoading(true);
      setError("");

      const signal = abortRead();
      try {
        const params = new URLSearchParams();

        if (status && status !== "ALL" && status !== "ACTIVE_PIPELINE") {
          params.set("status", status);
        }

        if (jobId) {
          params.set("job_id", String(jobId));
        }

        const query = params.toString();

        const res = await fetch(
          `/api/client/applicants${
            query ? `?${query}` : ""
          }`,
          { signal }
        );

        const json = await res.json();

        if (!res.ok) {
          throw new Error(
            json.error ||
              "Failed to load applicants."
          );
        }

        setApplicants(json.applicants ?? []);
        setJobPipeline(json.pipeline ?? null);
        // Anchor for the "date applied" windows; refreshed with every fetch so
        // the filter is pure during render and still tracks the server clock.
        setFetchedAt(Date.now());
      } catch (err: unknown) {
        if (signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Failed to load applicants.";
        setError(msg);
        toast.error(msg);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [abortRead]
  );

  // --------------------------------
  // Update Stage (Dynamic Pipeline-driven)
  // --------------------------------

  const updateApplicantStage = useCallback(
    async (
      applicationId: number,
      toStageId: number,
      notes?: string,
      assessmentOutcome?: AssessmentMoveOutcome
    ): Promise<{ ok: boolean; moved: boolean }> => {
      setSaving(true);
      setError("");

      let rollbackList: Applicant[] = [];

      // 1. Optimistic local mutation
      setApplicants((prev) => {
        rollbackList = prev;
        return prev.map((applicant) => {
          if (applicant.application_id === applicationId) {
            const targetStage =
              applicant.allowed_next_stages?.find((s) => s.id === toStageId) ||
              jobPipeline?.stages?.find((s) => s.id === toStageId);

            return {
              ...applicant,
              current_stage_id: toStageId,
              stage_name: targetStage?.stage_name || applicant.stage_name,
              stage_type: targetStage?.stage_type || applicant.stage_type,
              stage_color: targetStage?.color || applicant.stage_color,
              application_status: (targetStage?.stage_type as ApplicationStatus) || applicant.application_status,
              client_notes: notes !== undefined ? notes : applicant.client_notes,
            };
          }
          return applicant;
        });
      });

      try {
        const res = await fetch(`/api/client/applicants/${applicationId}/stage`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to_stage_id: toStageId,
            notes,
            ...(assessmentOutcome ? { assessment_outcome: assessmentOutcome } : {}),
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to update stage.");
        }

        if (json.moved === false) {
          setApplicants(rollbackList);
          return { ok: true, moved: false };
        }

        if (json.to_stage) {
          setApplicants((prev) =>
            prev.map((a) =>
              a.application_id === applicationId
                ? {
                    ...a,
                    current_stage_id: json.to_stage.id,
                    stage_name: json.to_stage.stage_name,
                    stage_type: json.to_stage.stage_type,
                    stage_color: json.to_stage.color,
                    application_status: json.to_stage.stage_type,
                    client_notes: notes !== undefined ? notes : a.client_notes,
                  }
                : a
            )
          );

          setDetail((prev) =>
            prev && prev.application_id === applicationId
              ? {
                  ...prev,
                  current_stage_id: json.to_stage.id,
                  stage_name: json.to_stage.stage_name,
                  stage_type: json.to_stage.stage_type,
                  stage_color: json.to_stage.color,
                  application_status: json.to_stage.stage_type,
                  client_notes: notes !== undefined ? notes : prev.client_notes,
                }
              : prev
          );
        }

        return { ok: true, moved: true };
      } catch (err: unknown) {
        setApplicants(rollbackList);
        const msg = err instanceof Error ? err.message : "Failed to update stage.";
        setError(msg);
        toast.error(msg);
        return { ok: false, moved: false };
      } finally {
        setSaving(false);
      }
    },
    [jobPipeline]
  );

  // --------------------------------
  // Update status (Legacy & backwards-compatible wrapper)
  // --------------------------------

  const updateStatus = useCallback(
    async (
      applicationId: number,
      status: ApplicationStatus,
      notes: string
    ): Promise<UpdateStatusResult> => {
      // Find candidate
      const target = applicants.find((a) => a.application_id === applicationId);
      const stageMatch =
        target?.allowed_next_stages?.find((s) => s.stage_type === status) ||
        jobPipeline?.stages?.find((s) => s.stage_type === status);

      if (stageMatch) {
        const isAssessmentSource = target?.stage_type === "ASSESSMENT";
        const isUniversalExit =
          stageMatch.stage_type === "REJECTED" ||
          stageMatch.stage_type === "WITHDRAWN";
        if (isAssessmentSource && !isUniversalExit) {
          return {
            ok: false,
            gated: true,
            toStageId: stageMatch.id,
            stageName: stageMatch.stage_name,
          };
        }
        const moved = await updateApplicantStage(applicationId, stageMatch.id, notes);
        return { ok: moved.ok, gated: false };
      }

      setSaving(true);
      setError("");

      let rollbackList: Applicant[] = [];

      setApplicants((prev) => {
        rollbackList = prev;
        return prev.map((applicant) =>
          applicant.application_id === applicationId
            ? {
                ...applicant,
                application_status: status,
                client_notes: notes,
              }
            : applicant
        );
      });

      try {
        const res = await fetch(
          `/api/client/applicants/${applicationId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              application_status: status,
              client_notes: notes,
            }),
          }
        );

        const json = await res.json();

        if (!res.ok) {
          throw new Error(
            json.error || "Failed to update status."
          );
        }

        (Array.isArray(json.warnings) ? (json.warnings as string[]) : []).forEach((w) =>
          toast.warning(w)
        );

        return { ok: true, gated: false };
      } catch (err: unknown) {
        setApplicants(rollbackList);
        const msg = err instanceof Error ? err.message : "Failed to update status.";
        setError(msg);
        toast.error(msg);

        return { ok: false, gated: false };
      } finally {
        setSaving(false);
      }
    },
    [applicants, jobPipeline, updateApplicantStage]
  );

  // --------------------------------
  // Fetch single applicant
  // --------------------------------

  const fetchApplicantDetail =
    useCallback(
      async (
        applicationId: number
      ) => {
        setDetailLoading(true);
        setDetailError("");

        const signal = abortDetail();

        try {
          const res = await fetch(
            `/api/client/applicants/${applicationId}`,
            { signal }
          );

          const json =
            await res.json();

          if (signal.aborted) return;

          if (!res.ok) {
            throw new Error(
              json.error ||
                "Failed to load candidate details."
            );
          }

          if (json.applicant) {
            setDetail(json.applicant);
            setApplicants((prev) =>
              prev.map((a) =>
                a.application_id === applicationId
                  ? { ...a, application_status: json.applicant.application_status }
                  : a
              )
            );
          } else {
            setDetail(null);
          }
        } catch (err: unknown) {
          if (signal.aborted) return;
          setDetailError(
            err instanceof Error
              ? err.message
              : "An error occurred."
          );

          setDetail(null);
        } finally {
          if (!signal.aborted) {
            setDetailLoading(false);
          }
        }
      },
      [abortDetail]
    );

  // --------------------------------
  // Clear detail
  // --------------------------------

  const clearDetail = useCallback(() => {
    // Cancel any read still in flight, otherwise it repopulates the detail the
    // user just closed.
    abortDetail();
    setDetail(null);
    setDetailError("");
    setDetailLoading(false);
  }, [abortDetail]);

  // --------------------------------
  // Search + filters
  // --------------------------------

  const filteredApplicants = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    const now = fetchedAt;

    return applicants.filter((applicant) => {
      if (!matchesStageFilter(applicant, filterStatus, jobPipeline)) {
        return false;
      }

      if (!matchesAdvancedFilters(applicant, filters, now)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const skillsText =
        applicant.skills?.join(" ").toLowerCase() ?? "";

      return (
        applicant.applicant_name?.toLowerCase().includes(query) ||
        applicant.applicant_email?.toLowerCase().includes(query) ||
        applicant.job_title?.toLowerCase().includes(query) ||
        skillsText.includes(query)
      );
    });
  }, [applicants, filterStatus, filters, jobPipeline, search, fetchedAt]);

  return {
    applicants: filteredApplicants,

    rawApplicants: applicants,

    jobPipeline,

    loading,
    saving,

    error,

    filterStatus,
    setFilterStatus,

    search,
    setSearch,

    filters,
    setFilters,

    fetchApplicants,
    updateStatus,
    updateApplicantStage,

    clearError: () =>
      setError(""),

    detail,
    detailLoading,
    detailError,

    fetchApplicantDetail,
    clearDetail,
  };
}
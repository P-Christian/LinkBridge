// src/modules/client/jobs/hooks/useJobs.ts
"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import { JobPosting, JobFormData, JobStatus, JobType, ExperienceLevel } from "../types";

const EMPTY_FORM: JobFormData = {
  job_title: "",
  job_description: "",
  job_requirements: "",
  job_type: "FULL_TIME",
  job_location: "",
  job_department: "",
  salary_min: "",
  salary_max: "",
  salary_negotiable: true,
  experience_level: "MID",
  education: "Bachelor's Degree Graduate",
  benefits: ["13th Month Pay & Bonuses", "Paid Leave (Sick, Vacation)"],
  screening_questions: [],
  status: "DRAFT",
  source_pipeline_id: null,
};

interface JobsResponse {
  jobs: JobPosting[];
}

interface JobResponse {
  job?: JobPosting;
  error?: string;
  warnings?: string[];
}

export function useJobs() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [filterStatus, setFilterStatus] = useState<JobStatus | "ALL">("ALL");

  const abortRead = useRequestAbort();

  const fetchJobs = useCallback(async (status?: JobStatus | "ALL") => {
    setLoading(true);
    setError("");

    const signal = abortRead();
    try {
      const query = status && status !== "ALL" ? `?status=${status}` : "";
      const res = await fetch(`/api/client/jobs${query}`, { signal });
      const json: JobsResponse & { error?: string } = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load jobs.");
      }

      setJobs(json.jobs ?? []);
    } catch (err: unknown) {
      if (signal.aborted) return;
      const msg = err instanceof Error ? err.message : "Failed to load jobs.";
      setError(msg);
      toast.error(msg);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [abortRead]);

  const normalizeJobPayload = (formData: JobFormData) => ({
    ...formData,
    salary_min: formData.salary_min ? Number(formData.salary_min) : null,
    salary_max: formData.salary_max ? Number(formData.salary_max) : null,
    source_pipeline_id: formData.source_pipeline_id ? Number(formData.source_pipeline_id) : undefined,
  });

  // OPTIMISTIC CREATE JOB
  const createJob = useCallback(async (formData: JobFormData) => {
    setSaving(true);
    setError("");
    setSuccessMessage("");

    const tempId = -Date.now();
    const optimisticJob: JobPosting = {
      job_id: tempId,
      company_id: 0,
      job_title: formData.job_title || "New Job Position",
      job_type: (formData.job_type as JobType) || "FULL_TIME",
      job_location: formData.job_location || "",
      job_department: formData.job_department || "",
      job_description: formData.job_description || "",
      job_requirements: formData.job_requirements || "",
      job_responsibilities: formData.job_responsibilities || "",
      job_qualifications: formData.job_qualifications || "",
      category_id: formData.category_id || null,
      job_category: formData.job_category || "",
      work_arrangement: formData.work_arrangement || "Remote",
      number_of_openings: formData.number_of_openings || "1",
      salary_type: formData.salary_type || "Salary Range",
      salary_min: formData.salary_min ? Number(formData.salary_min) : null,
      salary_max: formData.salary_max ? Number(formData.salary_max) : null,
      salary_negotiable: formData.salary_negotiable || false,
      currency: formData.currency || "PHP",
      experience_level: (formData.experience_level as ExperienceLevel) || null,
      education: formData.education || "",
      skills: formData.skills || [],
      benefits: formData.benefits || [],
      screening_questions: formData.screening_questions || [],
      status: (formData.status as JobStatus) || "DRAFT",
      applicants_count: 0,
      active_applicants_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistically prepend to list (0ms)
    setJobs((prev) => [optimisticJob, ...prev]);

    try {
      const res = await fetch("/api/client/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizeJobPayload(formData)),
      });

      const json: JobResponse = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to create job.");
      }

      if (json.job) {
        setJobs((prev) => prev.map((j) => (j.job_id === tempId ? json.job! : j)));
      }

      setSuccessMessage("Job posting created successfully.");
      if (json.warnings?.length) {
        toast.warning(json.warnings.join(" "));
      } else {
        toast.success("Job posting created successfully.");
      }
      return true;
    } catch (err: unknown) {
      // Rollback on network failure
      setJobs((prev) => prev.filter((j) => j.job_id !== tempId));
      const msg = err instanceof Error ? err.message : "Failed to create job.";
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  // OPTIMISTIC UPDATE JOB
  const updateJob = useCallback(
    async (jobId: number, formData: JobFormData) => {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const previousJobs = [...jobs];

      // Optimistically update existing job in state (0ms)
      setJobs((prev) =>
        prev.map((j) => {
          if (j.job_id !== jobId) return j;
          return {
            ...j,
            job_title: formData.job_title || j.job_title,
            job_type: (formData.job_type as JobType) || j.job_type,
            job_location: formData.job_location || j.job_location,
            job_department: formData.job_department || j.job_department,
            job_description: formData.job_description || j.job_description,
            job_requirements: formData.job_requirements || j.job_requirements,
            job_responsibilities: formData.job_responsibilities || j.job_responsibilities,
            job_qualifications: formData.job_qualifications || j.job_qualifications,
            category_id: formData.category_id !== undefined ? formData.category_id : j.category_id,
            job_category: formData.job_category || j.job_category,
            work_arrangement: formData.work_arrangement || j.work_arrangement,
            number_of_openings: formData.number_of_openings || j.number_of_openings,
            salary_type: formData.salary_type || j.salary_type,
            salary_min: formData.salary_min ? Number(formData.salary_min) : null,
            salary_max: formData.salary_max ? Number(formData.salary_max) : null,
            salary_negotiable:
              formData.salary_negotiable !== undefined ? formData.salary_negotiable : j.salary_negotiable,
            currency: formData.currency || j.currency,
            experience_level: (formData.experience_level as ExperienceLevel) || j.experience_level,
            education: formData.education || j.education,
            skills: formData.skills || j.skills,
            benefits: formData.benefits || j.benefits,
            screening_questions: formData.screening_questions || j.screening_questions,
            status: (formData.status as JobStatus) || j.status,
            updated_at: new Date().toISOString(),
          };
        })
      );

      try {
        const res = await fetch(`/api/client/jobs/${jobId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(normalizeJobPayload(formData)),
        });

        const json: JobResponse = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "Failed to update job.");
        }

        if (json.job) {
          setJobs((prev) => prev.map((j) => (j.job_id === jobId ? { ...j, ...json.job } : j)));
        }

        setSuccessMessage("Job posting updated successfully.");
        if (json.warnings?.length) {
          toast.warning(json.warnings.join(" "));
        } else {
          toast.success("Job posting updated successfully.");
        }
        return true;
      } catch (err: unknown) {
        // Rollback on network failure
        setJobs(previousJobs);
        const msg = err instanceof Error ? err.message : "Failed to update job.";
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [jobs]
  );

  // OPTIMISTIC STATUS CHANGE
  const changeJobStatus = useCallback(
    async (jobId: number, newStatus: JobStatus) => {
      const previousJobs = [...jobs];
      const target = previousJobs.find((j) => j.job_id === jobId);
      if (!target || target.status === newStatus) return;

      // Optimistically update status (0ms)
      setJobs((prev) =>
        prev.map((job) =>
          job.job_id === jobId
            ? { ...job, status: newStatus, updated_at: new Date().toISOString() }
            : job
        )
      );

      try {
        const res = await fetch(`/api/client/jobs/${jobId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "Failed to update status.");
        }

        if (json.job) {
          setJobs((prev) =>
            prev.map((job) => (job.job_id === jobId ? { ...job, ...json.job } : job))
          );
        }
        toast.success(`Job status updated to ${newStatus}.`);
      } catch (err: unknown) {
        // Rollback on network failure
        setJobs(previousJobs);
        const msg = err instanceof Error ? err.message : "Failed to update job status.";
        setError(msg);
        toast.error(msg);
        throw err;
      }
    },
    [jobs]
  );

  const clearMessages = () => {
    setError("");
    setSuccessMessage("");
  };

  return {
    jobs,
    loading,
    saving,
    error,
    successMessage,
    filterStatus,
    setFilterStatus,
    fetchJobs,
    createJob,
    updateJob,
    changeJobStatus,
    EMPTY_FORM,
    clearMessages,
  };
}
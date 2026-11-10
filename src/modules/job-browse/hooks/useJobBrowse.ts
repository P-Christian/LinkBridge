/* eslint-disable react-hooks/set-state-in-effect */
// src/modules/job-browse/hooks/useJobBrowse.ts
"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { PublicJobPosting, JobType, WorkArrangement, ExperienceLevel, DatePostedFilter } from "../types";

export const PAGE_SIZE = 15;

export function useJobBrowse() {
  const [jobs, setJobs] = useState<PublicJobPosting[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [page, setPage] = useState(1);
  const [appliedJobIds, setAppliedJobIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filter state — all multi-select arrays + date posted
  const [search, setSearch] = useState("");
  const [filterJobTypes, setFilterJobTypes] = useState<JobType[]>([]);
  const [filterArrangements, setFilterArrangements] = useState<WorkArrangement[]>([]);
  const [filterExperienceLevels, setFilterExperienceLevels] = useState<ExperienceLevel[]>([]);
  const [filterDatePosted, setFilterDatePosted] = useState<DatePostedFilter>("ALL");

  // Detail sheet state
  const [selectedJob, setSelectedJob] = useState<PublicJobPosting | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Apply modal state
  const [applyModalOpen, setApplyModalOpen] = useState(false);

  // Debounced search query
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to page 1 on filter or search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterJobTypes, filterArrangements, filterExperienceLevels, filterDatePosted]);

  const fetchApplications = useCallback(async () => {
    try {
      const appsRes = await fetch("/api/freelancer/applications");
      if (appsRes.ok) {
        const appsJson = await appsRes.json();
        const apps = appsJson.applications ?? [];
        const ids = apps
          .filter((app: { application_status?: string }) => app.application_status !== "HIRED" && app.application_status !== "REJECTED")
          .map((app: { job_id: number }) => Number(app.job_id));
        setAppliedJobIds(ids);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchJobs = useCallback(async (targetPage?: number) => {
    const currentPage = targetPage ?? page;
    setLoading(true);
    setError("");

    const offset = (currentPage - 1) * PAGE_SIZE;
    const limit = PAGE_SIZE;

    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });

    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (filterJobTypes.length > 0) params.set("job_type", filterJobTypes.join(","));
    if (filterArrangements.length > 0) params.set("work_arrangement", filterArrangements.join(","));
    if (filterExperienceLevels.length > 0) params.set("experience_level", filterExperienceLevels.join(","));
    if (filterDatePosted !== "ALL") params.set("date_posted", filterDatePosted);

    try {
      const startTime = Date.now();
      const res = await fetch(`/api/freelancer/jobs?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load jobs.");

      const elapsed = Date.now() - startTime;
      if (elapsed < 150) {
        await new Promise((r) => setTimeout(r, 150 - elapsed));
      }

      setJobs(json.jobs ?? []);
      const total = json.total ?? json.jobs?.length ?? 0;
      const filterCount = json.filterCount ?? json.jobs?.length ?? 0;

      setTotalCount(total);
      setFilteredCount(filterCount);
    } catch (err: unknown) {
      console.error("[JobBrowse] ❌ Fetch Error:", err);
      const msg = err instanceof Error ? err.message : "Failed to load jobs.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterJobTypes, filterArrangements, filterExperienceLevels, filterDatePosted, page]);

  // Fetch whenever page or filters change
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  const openDetail = useCallback((job: PublicJobPosting) => {
    setSelectedJob(job);
    setSheetOpen(true);
  }, []);

  const closeDetail = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const openApply = useCallback((job: PublicJobPosting) => {
    setSelectedJob(job);
    setSheetOpen(false);
    setApplyModalOpen(true);
  }, []);

  const closeApply = useCallback(() => {
    setApplyModalOpen(false);
  }, []);

  const markJobAsApplied = useCallback((jobId: number) => {
    setAppliedJobIds((prev) => (prev.includes(jobId) ? prev : [...prev, jobId]));
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setFilterJobTypes([]);
    setFilterArrangements([]);
    setFilterExperienceLevels([]);
    setFilterDatePosted("ALL");
    setPage(1);
  }, []);

  const hasActiveFilters = Boolean(
    search.trim() ||
    filterJobTypes.length > 0 ||
    filterArrangements.length > 0 ||
    filterExperienceLevels.length > 0 ||
    filterDatePosted !== "ALL"
  );

  return {
    jobs,
    totalCount,
    filteredCount,
    page,
    setPage,
    totalPages,
    pageSize: PAGE_SIZE,
    loading,
    error,
    appliedJobIds,
    search,
    setSearch,
    filterJobTypes,
    setFilterJobTypes,
    filterArrangements,
    setFilterArrangements,
    filterExperienceLevels,
    setFilterExperienceLevels,
    filterDatePosted,
    setFilterDatePosted,
    hasActiveFilters,
    clearAllFilters,
    selectedJob,
    sheetOpen,
    applyModalOpen,
    fetchJobs,
    fetchApplications,
    markJobAsApplied,
    openDetail,
    closeDetail,
    openApply,
    closeApply,
  };
}

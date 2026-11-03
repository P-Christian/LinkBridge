/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
// src/modules/client/jobs/JobsModule.tsx
"use client";
import { JobDetailSheet } from "./components/JobDetailSheet";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useJobs } from "./hooks/useJobs";
import JobList from "./components/JobList";
import JobPagination from "./components/JobPagination";
import JobForm from "./components/JobForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Search, X, RotateCcw, Sparkles } from "lucide-react";
import CompanyVerificationGuard from "../components/CompanyVerificationGuard";
import ListSkeleton from "../components/ListSkeleton";
import { KpiPending } from "@/components/shared/KpiValue";

import { JobPosting, JobFormData, JobStatus, JobType, WorkArrangement, JOB_TYPE_LABELS, JOB_STATUS_LABELS } from "./types";
import { countByStatus } from "./components/JobListControls";
import { AutoCreateJobModal } from "./components/AutoCreateJobModal";
import { useRoleCategories } from "./hooks/useRoleCategories";

const JOB_TYPE_OPTIONS = [
  { value: "ALL", label: "All Types" },
  { value: "FULL_TIME", label: "Full-Time" },
  { value: "PART_TIME", label: "Part-Time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "FREELANCE", label: "Freelance" },
];

const WORK_ARRANGEMENT_OPTIONS = [
  { value: "ALL", label: "All Setups" },
  { value: "Remote", label: "Remote" },
  { value: "Hybrid", label: "Hybrid" },
  { value: "On-site", label: "On-site" },
];

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Status" },
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Draft" },
  { value: "CLOSED", label: "Closed" },
];

export default function JobsModule() {
  const searchParams = useSearchParams();
  const targetJobId =
    searchParams.get("jobId") ||
    searchParams.get("job_id") ||
    searchParams.get("selectedJobId") ||
    searchParams.get("id");

  const { categories: roleCategories, findCategoryByName, findCategoryById } = useRoleCategories();
  const {
    jobs,
    loading,
    saving,
    filterStatus,
    setFilterStatus,
    fetchJobs,
    createJob,
    updateJob,
    changeJobStatus,
    EMPTY_FORM,
    clearMessages,
  } = useJobs();
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const handleViewJob = (job: JobPosting) => {
    setSelectedJob(job);
    setIsPreviewOpen(true);
  };
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAutoCreateOpen, setIsAutoCreateOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [formData, setFormData] = useState<JobFormData>(EMPTY_FORM);

  // Search & Multi-Filter States (Client-Side)
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterJobType, setFilterJobType] = useState<JobType | "ALL">("ALL");
  const [filterWorkArrangement, setFilterWorkArrangement] = useState<WorkArrangement | "ALL">("ALL");

  useEffect(() => {
    fetchJobs(filterStatus);
  }, [fetchJobs, filterStatus]);

  // Auto-open job details sheet if targetJobId is present in URL params
  useEffect(() => {
    if (!targetJobId || loading || jobs.length === 0) return;
    const found = jobs.find((j) => String(j.job_id) === String(targetJobId));
    if (found) {
      setSelectedJob(found);
      setIsPreviewOpen(true);
    }
  }, [targetJobId, loading, jobs]);

  const parseJsonField = (value: string | null | undefined): { text: string; extra: Record<string, unknown> } => {
    if (!value) return { text: "", extra: {} };
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        return { text: parsed.text ?? "", extra: parsed };
      } catch {
        // ignore
      }
    }
    return { text: value, extra: {} };
  };

  // Transform dynamic role categories into SearchableSelect options
  const categoryOptions = useMemo(() => {
    const list = [{ value: "ALL", label: "All Categories" }];
    roleCategories.forEach((c) => {
      list.push({ value: c.category_name, label: c.category_name });
    });
    return list;
  }, [roleCategories]);

  // Filtered jobs memo
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // 1. Text Search (job_title, job_department, job_location)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = job.job_title?.toLowerCase().includes(q) ?? false;
        const matchesDept = job.job_department?.toLowerCase().includes(q) ?? false;
        const matchesLoc = job.job_location?.toLowerCase().includes(q) ?? false;
        if (!matchesTitle && !matchesDept && !matchesLoc) return false;
      }

      // 2. Category Filter (matches category_id or category_name)
      if (filterCategory !== "ALL") {
        const catObj = roleCategories.find((c) => c.category_name === filterCategory);
        const matchesCatId = catObj && job.category_id && job.category_id === catObj.category_id;
        const matchesCatName = job.job_category?.toLowerCase() === filterCategory.toLowerCase();
        if (!matchesCatId && !matchesCatName) return false;
      }

      // 3. Employment Type Filter
      if (filterJobType !== "ALL" && job.job_type !== filterJobType) {
        return false;
      }

      // 4. Work Arrangement Filter
      if (filterWorkArrangement !== "ALL" && job.work_arrangement !== filterWorkArrangement) {
        return false;
      }

      return true;
    });
  }, [jobs, searchQuery, filterCategory, filterJobType, filterWorkArrangement, roleCategories]);

  // Pagination over the filtered result set. The page is keyed to a signature of
  // the active filters, so any filter change falls back to page 1 during render
  // instead of needing a reset effect.
  const filterSignature = `${filterStatus}|${searchQuery.trim()}|${filterCategory}|${filterJobType}|${filterWorkArrangement}`;
  const [pageState, setPageState] = useState({ signature: "", page: 1 });
  const [pageSize, setPageSize] = useState(10);
  const listRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));
  const requestedPage = pageState.signature === filterSignature ? pageState.page : 1;
  const page = Math.min(requestedPage, totalPages);
  const paginatedJobs = useMemo(
    () => filteredJobs.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
    [filteredJobs, page, pageSize]
  );

  const changePage = (nextPage: number) => {
    setPageState({
      signature: filterSignature,
      page: Math.min(Math.max(1, nextPage), totalPages),
    });
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const changePageSize = (nextSize: number) => {
    setPageSize(nextSize);
    setPageState({ signature: filterSignature, page: 1 });
  };

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    filterCategory !== "ALL" ||
    filterJobType !== "ALL" ||
    filterWorkArrangement !== "ALL" ||
    filterStatus !== "ALL"
  );

  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterCategory("ALL");
    setFilterJobType("ALL");
    setFilterWorkArrangement("ALL");
    setFilterStatus("ALL");
  };

  const handleFieldChange = (
    field: keyof JobFormData,
    value: string | number | boolean | null | string[] | { id: number; skill_name: string }[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNewJob = (initialData?: Partial<JobFormData>) => {
    setEditingJob(null);
    const defaultBenefits = ["13th Month Pay & Bonuses", "Paid Leave (Sick, Vacation)"];
    const hasInitialSalary = Boolean(initialData?.salary_min && initialData.salary_min.trim() !== "");
    const isNegotiable = initialData?.salary_negotiable !== undefined ? initialData.salary_negotiable : !hasInitialSalary;

    setFormData({
      ...EMPTY_FORM,
      category_id: initialData?.category_id ?? null,
      job_category: initialData?.job_category ?? "",
      work_arrangement: initialData?.work_arrangement ?? "Remote",
      number_of_openings: initialData?.number_of_openings ?? "1",
      job_responsibilities: initialData?.job_responsibilities ?? "",
      job_qualifications: initialData?.job_qualifications ?? "",
      skills: initialData?.skills ?? [],
      salary_type: initialData?.salary_type ?? "Salary Range",
      currency: initialData?.currency ?? "PHP",
      salary_min: initialData?.salary_min ?? "",
      salary_max: initialData?.salary_max ?? "",
      salary_negotiable: isNegotiable,
      benefits: initialData?.benefits && initialData.benefits.length > 0 ? initialData.benefits : defaultBenefits,
      education: initialData?.education || "Bachelor's Degree Graduate",
      screening_questions: initialData?.screening_questions ?? [],
      job_title: initialData?.job_title ?? "",
      job_description: initialData?.job_description ?? "",
      job_type: initialData?.job_type ?? "FULL_TIME",
      job_location: initialData?.job_location ?? "",
      job_department: initialData?.job_department ?? "",
      experience_level: initialData?.experience_level || "MID",
      status: initialData?.status ?? "DRAFT",
      source_pipeline_id: initialData?.source_pipeline_id ?? null,
    });
    clearMessages();
    setIsDialogOpen(true);
  };

  const handleDirectSaveDraft = async (draftData: JobFormData) => {
    const serializedDescription = JSON.stringify({
      text: draftData.job_description,
      category_id: draftData.category_id,
      job_category: draftData.job_category,
      work_arrangement: draftData.work_arrangement || "Remote",
      number_of_openings: draftData.number_of_openings || "1",
      job_responsibilities: draftData.job_responsibilities || "",
    });

    const serializedRequirements = JSON.stringify({
      text: draftData.job_requirements,
      job_qualifications: draftData.job_qualifications || "",
      skills: draftData.skills || [],
      salary_type: draftData.salary_type || "Salary Range",
      currency: draftData.currency || "PHP",
      benefits: draftData.benefits || [],
      education: draftData.education || "",
      screening_questions: draftData.screening_questions || [],
    });

    const payload = {
      ...draftData,
      status: "DRAFT" as JobStatus,
      skills: draftData.skills || [],
      benefits: draftData.benefits || [],
      education: draftData.education || "",
      screening_questions: draftData.screening_questions || [],
      job_description: serializedDescription,
      job_requirements: serializedRequirements,
    };

    await createJob(payload);
  };

  const handleEditJob = (job: JobPosting) => {
    setEditingJob(job);
    const descData = parseJsonField(job.job_description);
    const reqsData = parseJsonField(job.job_requirements);

    const rawCategory = (descData.extra.job_category as string) || job.job_category || "";
    const rawCategoryId = job.category_id || (descData.extra.category_id as number) || null;
    const resolvedCat = findCategoryById(rawCategoryId) || findCategoryByName(rawCategory);

    // Resolve skills from job.skills (API) with fallback to serialized requirements JSON
    const resolvedSkills = (job.skills && job.skills.length > 0)
      ? job.skills
      : ((reqsData.extra.skills as { id: number; skill_name: string }[]) || []);

    const resolvedBenefits = (job.benefits && job.benefits.length > 0)
      ? job.benefits
      : ((reqsData.extra.benefits as string[]) || []);

    const resolvedEducation = job.education || (reqsData.extra.education as string) || "";

    const resolvedQuestions = (job.screening_questions && job.screening_questions.length > 0)
      ? job.screening_questions
      : ((reqsData.extra.screening_questions as string[]) || []);

    const resolvedDescription = descData.text || job.job_description || "";
    const resolvedResponsibilities =
      (descData.extra.job_responsibilities as string) ||
      (descData.extra.responsibilities as string) ||
      job.job_responsibilities ||
      "";
    const resolvedQualifications =
      (reqsData.extra.job_qualifications as string) ||
      (reqsData.extra.qualifications as string) ||
      job.job_qualifications ||
      reqsData.text ||
      "";

    setFormData({
      job_id: job.job_id,
      job_title: job.job_title ?? "",
      job_description: resolvedDescription,
      job_requirements: reqsData.text || resolvedQualifications,
      job_type: job.job_type ?? "",
      job_location: job.job_location ?? "",
      job_department: job.job_department ?? "",
      salary_min: job.salary_min?.toString() ?? "",
      salary_max: job.salary_max?.toString() ?? "",
      salary_negotiable: job.salary_negotiable ?? false,
      experience_level: job.experience_level ?? "",
      status: job.status ?? "DRAFT",
      // Extra step fields with canonical category resolution
      category_id: resolvedCat?.category_id || rawCategoryId || null,
      job_category: resolvedCat?.category_name || rawCategory,
      work_arrangement: (descData.extra.work_arrangement as string) ?? (job.work_arrangement || "Remote"),
      number_of_openings: (descData.extra.number_of_openings as string) ?? (job.number_of_openings || "1"),
      job_responsibilities: resolvedResponsibilities,
      job_qualifications: resolvedQualifications,
      skills: resolvedSkills,
      salary_type: (reqsData.extra.salary_type as string) ?? (job.salary_type || "Salary Range"),
      currency: (reqsData.extra.currency as string) ?? (job.currency || "PHP"),
      benefits: resolvedBenefits,
      education: resolvedEducation,
      screening_questions: resolvedQuestions,
    });
    clearMessages();
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    clearMessages();

    const resolvedCategory = findCategoryByName(formData.job_category) || findCategoryById(formData.category_id);
    const finalCategoryId = formData.category_id || resolvedCategory?.category_id || null;
    const finalCategoryName = resolvedCategory?.category_name || formData.job_category || "";

    // Serialize extra fields into job_description and job_requirements text columns
    const serializedDescription = JSON.stringify({
      text: formData.job_description,
      category_id: finalCategoryId,
      job_category: finalCategoryName,
      work_arrangement: formData.work_arrangement || "Remote",
      number_of_openings: formData.number_of_openings || "1",
      job_responsibilities: formData.job_responsibilities || "",
    });

    const serializedRequirements = JSON.stringify({
      text: formData.job_requirements,
      job_qualifications: formData.job_qualifications || "",
      skills: formData.skills || [],
      salary_type: formData.salary_type || "Salary Range",
      currency: formData.currency || "PHP",
      benefits: formData.benefits || [],
      education: formData.education || "",
      screening_questions: formData.screening_questions || [],
    });

    const payload = {
      ...formData,
      skills: formData.skills || [],
      benefits: formData.benefits || [],
      education: formData.education || "",
      screening_questions: formData.screening_questions || [],
      category_id: finalCategoryId,
      job_category: finalCategoryName,
      job_description: serializedDescription,
      job_requirements: serializedRequirements,
    };

    let ok: boolean;
    if (editingJob) {
      ok = await updateJob(editingJob.job_id, payload);
    } else {
      ok = await createJob(payload);
    }
    if (ok) setIsDialogOpen(false);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    clearMessages();
  };

  const statusCounts = countByStatus(jobs);
  // A refetch keeps the previous postings, so only a first load with nothing to
  // count may replace these numbers with a placeholder.
  const countsPending = loading && jobs.length === 0;
  const breakdown = (["ACTIVE", "DRAFT", "CLOSED"] as JobStatus[])
    .map((s) => `${statusCounts[s]} ${JOB_STATUS_LABELS[s].toLowerCase()}`)
    .join(" • ");
  const shownCount = statusCounts[filterStatus];

  return (
    <CompanyVerificationGuard moduleName="Job Postings">
      <div className="space-y-4 md:space-y-6 client-page-transition">
        <style>{`
          @keyframes page-entry {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .client-page-transition {
            animation: page-entry 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Job Postings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {countsPending ? (
                <KpiPending />
              ) : filterStatus === "ALL" ? (
                breakdown
              ) : (
                `${shownCount} ${JOB_STATUS_LABELS[filterStatus].toLowerCase()} shown`
              )}
            </p>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              onClick={() => setIsAutoCreateOpen(true)}
              className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold gap-1.5 shadow-sm border-0 flex-1 sm:flex-none cursor-pointer max-md:min-h-10"
            >
              <Sparkles className="h-4 w-4" />
              Auto Create Job
            </Button>
            <Button
              variant="outline"
              onClick={() => handleNewJob()}
              className="h-10 rounded-xl text-sm font-medium gap-1.5 flex-1 sm:flex-none max-md:min-h-10"
            >
              <Plus className="h-4 w-4" />
              Manual Post
            </Button>
          </div>
        </div>



        {/* Filter & Job List */}
        <Card className="shadow-sm border border-border/80 bg-card rounded-xl py-0 gap-0 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 space-y-3">
            {/* 2-Column Balanced Toolbar: Left (Search Bar), Right (4 Equal Filter Dropdowns) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
              {/* Col 1: Search Bar (5 cols) */}
              <div className="relative lg:col-span-5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by job title, department, or location..."
                  className="pl-9 pr-9 h-9 sm:text-sm bg-background border-border/80 rounded-lg focus-visible:ring-primary/20 w-full max-md:h-10 max-md:text-base"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5 max-md:relative max-md:after:absolute max-md:after:-inset-3 max-md:after:content-['']" />
                  </button>
                )}
              </div>

              {/* Col 2: 4 Equally Spaced Filter Dropdowns (7 cols) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:col-span-7">
                {/* Category (Searchable Combobox) */}
                <div className="w-full">
                  <SearchableSelect
                    options={categoryOptions}
                    value={filterCategory}
                    onValueChange={(v) => setFilterCategory(v)}
                    placeholder="All Categories"
                    className="h-9 md:text-xs rounded-lg border-border/80 bg-background font-medium w-full max-md:h-10 max-md:px-3 max-md:[&_svg]:size-4 max-md:[&_svg]:opacity-60"
                  />
                </div>

                {/* Employment Type */}
                <div className="w-full">
                  <SearchableSelect
                    options={JOB_TYPE_OPTIONS}
                    value={filterJobType}
                    onValueChange={(v) => setFilterJobType(v as JobType | "ALL")}
                    placeholder="All Types"
                    className="h-9 md:text-xs rounded-lg border-border/80 bg-background font-medium w-full max-md:h-10 max-md:px-3 max-md:[&_svg]:size-4 max-md:[&_svg]:opacity-60"
                  />
                </div>

                {/* Work Arrangement */}
                <div className="w-full">
                  <SearchableSelect
                    options={WORK_ARRANGEMENT_OPTIONS}
                    value={filterWorkArrangement}
                    onValueChange={(v) => setFilterWorkArrangement(v as WorkArrangement | "ALL")}
                    placeholder="All Setups"
                    className="h-9 md:text-xs rounded-lg border-border/80 bg-background font-medium w-full max-md:h-10 max-md:px-3 max-md:[&_svg]:size-4 max-md:[&_svg]:opacity-60"
                  />
                </div>

                {/* Status Filter */}
                <div className="w-full">
                  <SearchableSelect
                    options={STATUS_OPTIONS}
                    value={filterStatus}
                    onValueChange={(v) => setFilterStatus(v as JobStatus | "ALL")}
                    placeholder="All Status"
                    className="h-9 md:text-xs rounded-lg border-border/80 bg-background font-medium w-full max-md:h-10 max-md:px-3 max-md:[&_svg]:size-4 max-md:[&_svg]:opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* Active Filters Bar / Results Summary */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-sm md:text-xs text-muted-foreground">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">
                  {countsPending ? (
                    <KpiPending />
                  ) : (
                    <>
                      Found {filteredJobs.length}{" "}
                      {filteredJobs.length === 1 ? "posting" : "postings"}
                      {jobs.length !== filteredJobs.length && (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          (filtered from {jobs.length})
                        </span>
                      )}
                    </>
                  )}
                </span>

                {/* Active Filter Chips */}
                {searchQuery.trim() && (
                  <Badge variant="secondary" className="text-xs md:text-[11px] gap-1 py-0.5 px-2 bg-muted rounded-md font-normal">
                    Search: &ldquo;{searchQuery}&rdquo;
                    <button onClick={() => setSearchQuery("")} className="hover:text-foreground">
                      <X className="h-3 w-3 max-md:relative max-md:after:absolute max-md:after:-inset-3 max-md:after:content-['']" />
                    </button>
                  </Badge>
                )}
                {filterCategory !== "ALL" && (
                  <Badge variant="secondary" className="text-xs md:text-[11px] gap-1 py-0.5 px-2 bg-muted rounded-md font-normal">
                    Category: {filterCategory}
                    <button onClick={() => setFilterCategory("ALL")} className="hover:text-foreground">
                      <X className="h-3 w-3 max-md:relative max-md:after:absolute max-md:after:-inset-3 max-md:after:content-['']" />
                    </button>
                  </Badge>
                )}
                {filterJobType !== "ALL" && (
                  <Badge variant="secondary" className="text-xs md:text-[11px] gap-1 py-0.5 px-2 bg-muted rounded-md font-normal">
                    Type: {JOB_TYPE_LABELS[filterJobType]}
                    <button onClick={() => setFilterJobType("ALL")} className="hover:text-foreground">
                      <X className="h-3 w-3 max-md:relative max-md:after:absolute max-md:after:-inset-3 max-md:after:content-['']" />
                    </button>
                  </Badge>
                )}
                {filterWorkArrangement !== "ALL" && (
                  <Badge variant="secondary" className="text-xs md:text-[11px] gap-1 py-0.5 px-2 bg-muted rounded-md font-normal">
                    Arrangement: {filterWorkArrangement}
                    <button onClick={() => setFilterWorkArrangement("ALL")} className="hover:text-foreground">
                      <X className="h-3 w-3 max-md:relative max-md:after:absolute max-md:after:-inset-3 max-md:after:content-['']" />
                    </button>
                  </Badge>
                )}
                {filterStatus !== "ALL" && (
                  <Badge variant="secondary" className="text-xs md:text-[11px] gap-1 py-0.5 px-2 bg-muted rounded-md font-normal">
                    Status: {filterStatus}
                    <button onClick={() => setFilterStatus("ALL")} className="hover:text-foreground">
                      <X className="h-3 w-3 max-md:relative max-md:after:absolute max-md:after:-inset-3 max-md:after:content-['']" />
                    </button>
                  </Badge>
                )}
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-7 px-2 text-sm md:text-xs text-muted-foreground hover:text-foreground gap-1 -mr-1 max-md:min-h-10"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset all
                </Button>
              )}
            </div>
          </div>

          <CardContent className="p-3 sm:p-6">
            {loading ? (
              <ListSkeleton rows={4} label="Loading job postings…" />
            ) : (
              <>
                <div ref={listRef}>
                  <JobList
                    jobs={paginatedJobs}
                    totalJobsCount={jobs.length}
                    hasActiveFilters={hasActiveFilters}
                    onResetFilters={handleResetFilters}
                    onView={handleViewJob}
                    onEdit={handleEditJob}
                    onStatusChange={changeJobStatus}
                  />
                  {filteredJobs.length > 0 && (
                    <JobPagination
                      page={page}
                      pageSize={pageSize}
                      total={filteredJobs.length}
                      onPageChange={changePage}
                      onPageSizeChange={changePageSize}
                    />
                  )}
                </div>
                <JobDetailSheet
                  job={selectedJob ? (() => {
                    const descData = parseJsonField(selectedJob.job_description);
                    const reqsData = parseJsonField(selectedJob.job_requirements);
                    return {
                      ...selectedJob,
                      job_category: (selectedJob.job_category || (descData.extra.job_category as string) || ""),
                      work_arrangement: ((selectedJob.work_arrangement || (descData.extra.work_arrangement as string) || "Remote") as WorkArrangement),
                      job_description: descData.text || selectedJob.job_description || "",
                      job_responsibilities: (selectedJob.job_responsibilities || (descData.extra.job_responsibilities as string) || ""),
                      job_requirements: reqsData.text || selectedJob.job_requirements || "",
                      job_qualifications: (selectedJob.job_qualifications || (reqsData.extra.job_qualifications as string) || ""),
                      number_of_openings: (selectedJob.number_of_openings || (descData.extra.number_of_openings as string) || "1"),
                      skills: (selectedJob.skills || (reqsData.extra.skills as any) || []),
                      benefits: (selectedJob.benefits || (reqsData.extra.benefits as string[]) || []),
                      education: (selectedJob.education || (reqsData.extra.education as string) || ""),
                      screening_questions: (selectedJob.screening_questions || (reqsData.extra.screening_questions as string[]) || []),
                      salary_type: (selectedJob.salary_type || (reqsData.extra.salary_type as string) || "Salary Range") as any,
                      salary_negotiable: selectedJob.salary_negotiable ?? false,
                      currency: selectedJob.currency ?? "PHP",
                    } as any;
                  })() : null}
                  open={isPreviewOpen}
                  onClose={() => {
                    setIsPreviewOpen(false);
                    setSelectedJob(null);
                  }}
                  onEdit={handleEditJob}
                  onStatusChange={async (jobId, newStatus) => {
                    const currentStatus = selectedJob?.status;
                    setSelectedJob((prev) => prev ? { ...prev, status: newStatus } : null);
                    try {
                      await changeJobStatus(jobId, newStatus);
                    } catch {
                      if (currentStatus) {
                        setSelectedJob((prev) => prev ? { ...prev, status: currentStatus } : null);
                      }
                    }
                  }}
                  onApply={() => { }}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Create / Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-5xl w-full h-[85vh] max-h-[85vh] flex flex-col p-6 overflow-hidden max-md:max-w-[calc(100vw-2rem)] max-md:max-h-[90dvh] max-md:overflow-y-auto">
            <DialogHeader className="pb-2 border-b border-border/80">
              <DialogTitle className="text-base font-bold">
                {editingJob ? "Edit Job Posting" : "Create New Job Posting"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Fill out the details of the job posting below.
              </DialogDescription>
            </DialogHeader>

            <JobForm
              data={formData}
              onChange={handleFieldChange}
              onCancel={handleClose}
              onSubmit={handleSave}
              saving={saving}
              editingJob={!!editingJob}
            />
          </DialogContent>
        </Dialog>

        {/* Auto Create Job Modal */}
        <AutoCreateJobModal
          open={isAutoCreateOpen}
          onOpenChange={setIsAutoCreateOpen}
          onJobGenerated={(aiJob) => {
            handleNewJob(aiJob);
          }}
          onDirectSaveDraft={handleDirectSaveDraft}
        />
      </div>
    </CompanyVerificationGuard>
  );
}



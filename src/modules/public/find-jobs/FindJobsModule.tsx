// src/modules/public/find-jobs/FindJobsModule.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  JobHeroBanner,
  JobFilterSidebar,
  PublicJobCard,
  PublicJobSkeleton,
  PublicJobDetailModal,
  GuestAuthModal,
} from "./components";

import { PublicJobPosting, PopularPreset } from "./types";
import { Briefcase, AlertCircle, ArrowLeft, ArrowRight, ChevronDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuthSession } from "@/hooks/useAuthSession";
import { motion, AnimatePresence } from "framer-motion";

interface FindJobsModuleProps {
  initialJobs?: PublicJobPosting[];
  initialTotal?: number;
  initialTotalPages?: number;
  initialPopularPresets?: PopularPreset[];
}

export default function FindJobsModule({
  initialJobs = [],
  initialTotal = 0,
  initialTotalPages = 1,
  initialPopularPresets = [],
}: FindJobsModuleProps = {}) {

  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useAuthSession();

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") || "");
  const [locationQuery, setLocationQuery] = useState(() => searchParams.get("location") || "");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState(() => searchParams.get("q") || "");
  const [appliedLocationQuery, setAppliedLocationQuery] = useState(() => searchParams.get("location") || "");
  const [selectedJobType, setSelectedJobType] = useState("All");
  const [selectedWorkSetup, setSelectedWorkSetup] = useState("All");
  const [popularPresets, setPopularPresets] = useState<PopularPreset[]>(initialPopularPresets);
  const [searchTrigger, setSearchTrigger] = useState(0);
  
  const [jobs, setJobs] = useState<PublicJobPosting[]>(initialJobs);
  const [loading, setLoading] = useState(initialJobs.length === 0);
  const [error, setError] = useState<string | null>(null);
  
  const [totalJobs, setTotalJobs] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);

  const [selectedJob, setSelectedJob] = useState<PublicJobPosting | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  const [authModalJob, setAuthModalJob] = useState<PublicJobPosting | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const resultsTopRef = React.useRef<HTMLDivElement>(null);
  const [paginationDirection, setPaginationDirection] = useState<1 | -1 | 0>(0);
  const [isPaginating, setIsPaginating] = useState(false);

  const lastParamsRef = useRef(searchParams.toString());
  const lastOpenJobRef = useRef<string | null>(null);
  const isFirstMountRef = useRef(initialJobs.length > 0);

  // Sync filters if URL searchParams change
  useEffect(() => {
    const currentParams = searchParams.toString();
    if (currentParams !== lastParamsRef.current) {
      lastParamsRef.current = currentParams;
      const qParam = searchParams.get("q") || "";
      const locParam = searchParams.get("location") || "";
      setSearchQuery(qParam);
      setAppliedSearchQuery(qParam);
      setLocationQuery(locParam);
      setAppliedLocationQuery(locParam);
      setPage(1);
    }
  }, [searchParams]);

  // Handle open_job query param to open job detail modal automatically
  useEffect(() => {
    const openJobId = searchParams.get("open_job");
    if (!openJobId || openJobId === lastOpenJobRef.current) return;

    const found = jobs.find((j) => String(j.job_id) === openJobId);
    if (found) {
      lastOpenJobRef.current = openJobId;
      queueMicrotask(() => {
        setSelectedJob(found);
        setIsDetailOpen(true);
      });
      return;
    }

    let isMounted = true;
    fetch(`/api/public/find-jobs?job_id=${openJobId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.data?.length) return;
        const target = data.data[0];
        if (target) {
          lastOpenJobRef.current = openJobId;
          setSelectedJob(target);
          setIsDetailOpen(true);
        }
      })
      .catch((err) => console.error("Error fetching open_job details:", err));

    return () => {
      isMounted = false;
    };
  }, [searchParams, jobs]);

  useEffect(() => {
    // If initial jobs were provided by the server and default filters apply, skip the initial client fetch
    if (
      isFirstMountRef.current &&
      searchTrigger === 0 &&
      initialJobs.length > 0 &&
      initialPopularPresets.length > 0 &&
      !appliedSearchQuery &&
      !appliedLocationQuery &&
      selectedJobType === "All" &&
      selectedWorkSetup === "All" &&
      page === 1
    ) {
      isFirstMountRef.current = false;
      return;
    }
    isFirstMountRef.current = false;

    let isMounted = true;
    const fetchJobs = async () => {
      if (!isPaginating) {
        setLoading(true);
      }
      setError(null);
      const startTime = Date.now();
      try {
        const params = new URLSearchParams();
        if (appliedSearchQuery.trim()) params.set("q", appliedSearchQuery.trim());
        if (appliedLocationQuery.trim()) params.set("location", appliedLocationQuery.trim());
        if (selectedJobType !== "All") params.set("job_type", selectedJobType);
        if (selectedWorkSetup !== "All") params.set("work_setup", selectedWorkSetup);
        params.set("page", String(page));
        params.set("limit", "12");

        const res = await fetch(`/api/public/find-jobs?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to load public job postings.");
        }
        const data = await res.json();
        
        // Brief minimum delay for smooth visual transition when not paginating
        const elapsed = Date.now() - startTime;
        if (!isPaginating && elapsed < 200) {
          await new Promise((r) => setTimeout(r, 200 - elapsed));
        }

        if (isMounted) {
          setJobs(data.data || []);
          setTotalJobs(data.meta?.total || 0);
          setTotalPages(data.meta?.totalPages || 1);
          if (Array.isArray(data.meta?.popularPresets) && data.meta.popularPresets.length > 0) {
            setPopularPresets(data.meta.popularPresets);
          }
        }
      } catch (err: unknown) {
        console.error("fetchJobs error:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to fetch job listings.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setIsPaginating(false);
        }
      }
    };

    fetchJobs();

    return () => {
      isMounted = false;
    };
  }, [appliedSearchQuery, appliedLocationQuery, selectedJobType, selectedWorkSetup, page, isPaginating, initialJobs.length, initialPopularPresets.length, searchTrigger]);


  const handlePageChange = (newPage: number) => {
    if (newPage === page || loading || isPaginating) return;
    setPaginationDirection(newPage > page ? 1 : -1);
    setIsPaginating(true);
    setPage(newPage);
    resultsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() && !locationQuery.trim()) return;
    setPaginationDirection(0);
    setIsPaginating(false);
    setAppliedSearchQuery(searchQuery);
    setAppliedLocationQuery(locationQuery);
    setPage(1);
    setSearchTrigger((prev) => prev + 1);
  };

  const handleQuickPresetClick = (preset: PopularPreset) => {
    setPaginationDirection(0);
    setIsPaginating(false);
    setPage(1);

    if (preset.type === "work_setup") {
      const isAlreadyActive = selectedWorkSetup.toLowerCase() === preset.label.toLowerCase();
      setSelectedWorkSetup(isAlreadyActive ? "All" : preset.label);
    } else if (preset.type === "job_type") {
      const isAlreadyActive = selectedJobType.toLowerCase() === preset.label.toLowerCase();
      setSelectedJobType(isAlreadyActive ? "All" : preset.label);
    } else {
      const isAlreadyActive = appliedSearchQuery.trim().toLowerCase() === preset.label.trim().toLowerCase();
      if (isAlreadyActive) {
        setSearchQuery("");
        setAppliedSearchQuery("");
      } else {
        setSearchQuery(preset.label);
        setAppliedSearchQuery(preset.label);
      }
    }
  };

  const handleQuickCategoryClick = (tag: string) => {
    setPaginationDirection(0);
    setIsPaginating(false);
    if (tag === "Remote" || tag === "On-site" || tag === "Hybrid") {
      const isAlreadyActive = selectedWorkSetup.toLowerCase() === tag.toLowerCase();
      setSelectedWorkSetup(isAlreadyActive ? "All" : tag);
    } else if (tag === "Full Time" || tag === "Part Time" || tag === "Contract") {
      const isAlreadyActive = selectedJobType.toLowerCase() === tag.toLowerCase();
      setSelectedJobType(isAlreadyActive ? "All" : tag);
    } else {
      const isAlreadyActive = appliedSearchQuery.trim().toLowerCase() === tag.trim().toLowerCase();
      if (isAlreadyActive) {
        setSearchQuery("");
        setAppliedSearchQuery("");
      } else {
        setSearchQuery(tag);
        setAppliedSearchQuery(tag);
      }
    }
    setPage(1);
  };

  const handleResetFilters = () => {
    setPaginationDirection(0);
    setIsPaginating(false);
    setSearchQuery("");
    setLocationQuery("");
    setAppliedSearchQuery("");
    setAppliedLocationQuery("");
    setSelectedJobType("All");
    setSelectedWorkSetup("All");
    setPage(1);
  };

  const activeFilterCount =
    (selectedJobType !== "All" ? 1 : 0) +
    (selectedWorkSetup !== "All" ? 1 : 0) +
    (appliedSearchQuery.trim() ? 1 : 0) +
    (appliedLocationQuery.trim() ? 1 : 0);

  const handleApplyClick = (job: PublicJobPosting) => {
    if (session.isJobSeeker) {
      router.push(`/linkbridge/freelancer/jobs?open_job=${job.job_id}`);
      return;
    }
    if (session.isEmployer) {
      setSelectedJob(job);
      setIsDetailOpen(true);
      return;
    }
    setAuthModalJob(job);
    setIsAuthModalOpen(true);
  };

  const handleSelectJob = (job: PublicJobPosting) => {
    setSelectedJob(job);
    setIsDetailOpen(true);
  };

  return (
    <div className="min-h-screen text-foreground pb-20 relative z-10">
      {/* 1. Hero Search Section */}
      <JobHeroBanner
        searchQuery={searchQuery}
        locationQuery={locationQuery}
        onSearchChange={setSearchQuery}
        onLocationChange={setLocationQuery}
        onSearchSubmit={handleSearchSubmit}
        totalJobs={totalJobs}
        popularPresets={popularPresets}
        selectedJobType={selectedJobType}
        selectedWorkSetup={selectedWorkSetup}
        appliedSearchQuery={appliedSearchQuery}
        onQuickPresetClick={handleQuickPresetClick}
        onQuickCategoryClick={handleQuickCategoryClick}
        isLoading={loading}
      />


      {/* 2. Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Filter Sidebar (4 cols on lg) */}
          <div className="hidden md:block lg:col-span-3">
            <JobFilterSidebar
              selectedJobType={selectedJobType}
              selectedWorkSetup={selectedWorkSetup}
              onJobTypeChange={(type) => {
                setPaginationDirection(0);
                setIsPaginating(false);
                setSelectedJobType(type);
                setPage(1);
              }}
              onWorkSetupChange={(setup) => {
                setPaginationDirection(0);
                setIsPaginating(false);
                setSelectedWorkSetup(setup);
                setPage(1);
              }}
              onResetFilters={handleResetFilters}
              activeFilterCount={activeFilterCount}
            />
          </div>

          {/* Right Column: Job Listings Grid (9 cols on lg) */}
          <div className="lg:col-span-9 space-y-6">
            {/* Mobile filter trigger (below md only; the inline sidebar stays at >=768) */}
            <div className="md:hidden">
              <Button
                onClick={() => setIsFilterSheetOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={isFilterSheetOpen}
                className="w-full h-11 justify-between text-sm font-semibold rounded-xl shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </span>
                <span className="flex items-center gap-2">
                  {activeFilterCount > 0 && (
                    <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary-foreground/20 text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4" />
                </span>
              </Button>
            </div>

            {/* Anchor ref for smooth scroll */}
            <div ref={resultsTopRef} className="scroll-mt-24" />

            {/* Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <span>Open Job Opportunities</span>
                  <Badge variant="secondary" className="text-xs font-semibold">
                    {totalJobs} Jobs Available
                  </Badge>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Showing active openings verified by our compliance team.
                </p>
              </div>

              {activeFilterCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-xs h-8 rounded-full hover:border-primary/40"
                >
                  Clear All Filters
                </Button>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Smooth Animated Job Content Container */}
            <div className="min-h-[520px]">
              <AnimatePresence mode="wait" custom={paginationDirection}>
                {loading && !isPaginating ? (
                  <motion.div
                    key="loading-skeleton"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <PublicJobSkeleton key={i} />
                    ))}
                  </motion.div>
                ) : jobs.length === 0 ? (
                  /* Empty State */
                  <motion.div
                    key="empty-state"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="min-h-[380px] flex flex-col items-center justify-center bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 rounded-2xl p-8 md:p-12 text-center space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                  >
                    <div className="mx-auto h-14 w-14 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center">
                      <Briefcase className="h-7 w-7" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-foreground text-base">No Matching Jobs Found</h3>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        We couldn&apos;t find any positions matching your search filters. Try adjusting your search query or location.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleResetFilters} className="text-xs font-semibold rounded-full hover:border-primary/40">
                      Reset Search Filters
                    </Button>
                  </motion.div>
                ) : (
                  /* Job Grid */
                  <motion.div
                    key={`job-grid-${selectedJobType}-${selectedWorkSetup}-${appliedSearchQuery}-${appliedLocationQuery}-${page}`}
                    custom={paginationDirection}
                    initial={{
                      x: paginationDirection !== 0 ? (paginationDirection > 0 ? 28 : -28) : 0,
                      opacity: 0,
                    }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{
                      x: paginationDirection !== 0 ? (paginationDirection > 0 ? -28 : 28) : 0,
                      opacity: 0,
                    }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity duration-200 ${
                      isPaginating ? "opacity-60 pointer-events-none" : "opacity-100"
                    }`}
                  >
                    {jobs.map((job, idx) => (
                      <PublicJobCard
                        key={job.job_id}
                        job={job}
                        index={idx}
                        onSelectJob={handleSelectJob}
                        onApplyClick={handleApplyClick}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>


            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="pt-6 border-t border-border/70 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading || isPaginating}
                  onClick={() => handlePageChange(page - 1)}
                  className="text-xs gap-1.5 rounded-full px-4 hover:border-primary/40 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Previous
                </Button>

                <span className="text-xs text-muted-foreground font-semibold">
                  Page {page} of {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading || isPaginating}
                  onClick={() => handlePageChange(page + 1)}
                  className="text-xs gap-1.5 rounded-full px-4 hover:border-primary/40 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3b. Mobile Filter Sheet (below md only; desktop keeps the inline sidebar) */}
      <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto overscroll-contain p-0 pb-4"
        >
          <SheetHeader className="border-b pb-3">
            <SheetTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              Filter Positions
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pt-4">
            <JobFilterSidebar
              selectedJobType={selectedJobType}
              selectedWorkSetup={selectedWorkSetup}
              onJobTypeChange={(type) => {
                setPaginationDirection(0);
                setIsPaginating(false);
                setSelectedJobType(type);
                setPage(1);
              }}
              onWorkSetupChange={(setup) => {
                setPaginationDirection(0);
                setIsPaginating(false);
                setSelectedWorkSetup(setup);
                setPage(1);
              }}
              onResetFilters={handleResetFilters}
              activeFilterCount={activeFilterCount}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* 3. Job Detail Modal */}
      <PublicJobDetailModal
        job={selectedJob}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />

      {/* 4. Guest Apply Auth Prompt Modal */}
      <GuestAuthModal
        job={authModalJob}
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

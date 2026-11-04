"use client";

import React, { useEffect, useState } from "react";
import { Search, Briefcase, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useJobBrowse } from "./hooks/useJobBrowse";
import { JobBrowseFilters } from "./components/JobBrowseFilters";
import { JobBrowseCard } from "./components/JobBrowseCard";
import { JobDetailSheet } from "./components/JobDetailSheet";
import { ApplyModal } from "./components/ApplyModal";
import { useFreelancerBookmarks } from "../freelancer/freelancer-bookmarks/hooks/useFreelancerBookmarks";
import { useUserProfile } from "@/components/shared/providers/UserProfileProvider";
import { RegisterRequiredModal } from "./components/RegisterRequiredModal";
import { PublicJobSkeleton } from "@/modules/public/find-jobs/components/PublicJobSkeleton";
import { PublicJobPosting } from "./types";

export default function JobBrowseModule() {
  const {
    jobs,
    totalCount,
    filteredCount,
    page,
    setPage,
    totalPages,
    pageSize,
    loading,
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
  } = useJobBrowse();

  const { bookmarkedJobIds, toggleBookmark, fetchBookmarks } = useFreelancerBookmarks();
  const userProfile = useUserProfile();
  const isGuest = !userProfile || userProfile.email === "guest@example.com";
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [referralClaimsMap, setReferralClaimsMap] = useState<Record<number, { referrer_name: string; expires_at: string | null }>>({});

  useEffect(() => {
    if (!isGuest) {
      fetchBookmarks();
      fetchApplications();

      // Fetch active referral claims for recipient
      fetch("/api/freelancer/referrals/check-claim")
        .then((res) => res.json())
        .then((data) => {
          if (data.claims && Array.isArray(data.claims)) {
            const map: Record<number, { referrer_name: string; expires_at: string | null }> = {};
            for (const c of data.claims) {
              map[c.job_id] = {
                referrer_name: c.referrer_name,
                expires_at: c.expires_at,
              };
            }
            setReferralClaimsMap(map);
          }
        })
        .catch((err) => console.error("Error loading referral claims:", err));
    }
  }, [fetchBookmarks, fetchApplications, isGuest]);

  useEffect(() => {
    if (typeof window !== "undefined" && jobs.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const openJobId = params.get("open_job");
      if (openJobId) {
        const matched = jobs.find((j) => j.job_id === Number(openJobId));
        if (matched) {
          openDetail(matched);
        }
      }
    }
  }, [jobs, openDetail]);

  const handleApply = (job: PublicJobPosting) => {
    if (isGuest) {
      setRegisterModalOpen(true);
    } else {
      openApply(job);
    }
  };

  const handleToggleBookmark = (jobId: number) => {
    if (isGuest) {
      setRegisterModalOpen(true);
    } else {
      toggleBookmark(jobId);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <style>{`
        @keyframes page-entry {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .job-browse-page {
          animation: page-entry 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className="job-browse-page space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-emerald-950 via-zinc-900 to-teal-950 dark:from-black dark:via-zinc-950 dark:to-zinc-900 text-white p-6 sm:p-8 rounded-3xl border border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 h-40 w-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-white/10 backdrop-blur rounded-2xl border border-white/20">
              <Briefcase className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Find Work</h1>
              <p className="text-sm text-zinc-300 mt-1">
                {totalCount} active job{totalCount !== 1 ? "s" : ""} available
              </p>
            </div>
          </div>
        </div>



        {/* Filters */}
        <JobBrowseFilters
          search={search}
          onSearchChange={setSearch}
          filterJobTypes={filterJobTypes}
          onJobTypesChange={setFilterJobTypes}
          filterArrangements={filterArrangements}
          onArrangementsChange={setFilterArrangements}
          filterExperienceLevels={filterExperienceLevels}
          onExperienceLevelsChange={setFilterExperienceLevels}
          filterDatePosted={filterDatePosted}
          onDatePostedChange={setFilterDatePosted}
          hasActiveFilters={hasActiveFilters}
          onClearAll={clearAllFilters}
          totalCount={totalCount}
          filteredCount={filteredCount}
        />

        {/* Job Grid */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="freelancer-jobs-skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <PublicJobSkeleton key={i} />
              ))}
            </motion.div>
          ) : jobs.length === 0 ? (
            <motion.div
              key="freelancer-jobs-empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center justify-center py-20 gap-4 text-center border border-dashed rounded-3xl bg-card/50"
            >
              <div className="p-4 bg-muted/40 rounded-2xl">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No jobs found</p>
                <p className="text-sm md:text-xs text-muted-foreground mt-1">
                  Try adjusting your filters or search terms
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <motion.div
                key={`freelancer-jobs-grid-${page}-${filterJobTypes.join(",")}-${filterArrangements.join(",")}-${filterExperienceLevels.join(",")}-${filterDatePosted}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {jobs.map((job, idx) => (
                  <motion.div
                    key={job.job_id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min((idx % 15) * 0.03, 0.3) }}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="h-full"
                  >
                    <JobBrowseCard
                      job={job}
                      onViewDetail={openDetail}
                      isBookmarked={bookmarkedJobIds.includes(job.job_id)}
                      onToggleBookmark={handleToggleBookmark}
                      referralInfo={referralClaimsMap[job.job_id] ?? null}
                    />
                  </motion.div>
                ))}
              </motion.div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/80">
                  <p className="text-xs text-muted-foreground">
                    Showing <span className="font-semibold text-foreground">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredCount)}</span> of{' '}
                    <span className="font-semibold text-foreground">{filteredCount}</span> jobs
                    <span className="ml-1 text-muted-foreground">
                      (Page {page} of {totalPages})
                    </span>
                  </p>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPage((p) => Math.max(p - 1, 1));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={page === 1 || loading}
                      className="h-8 px-2.5 text-xs gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </Button>

                    {/* Numerical Page Buttons */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => {
                          return (
                            p === 1 ||
                            p === totalPages ||
                            Math.abs(p - page) <= 1
                          );
                        })
                        .map((p, index, array) => {
                          const showEllipsis = index > 0 && p - array[index - 1] > 1;
                          return (
                            <React.Fragment key={p}>
                              {showEllipsis && (
                                <span className="px-1 text-xs text-muted-foreground">...</span>
                              )}
                              <Button
                                variant={page === p ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                  setPage(p);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                disabled={loading}
                                className="h-8 w-8 p-0 text-xs font-medium"
                              >
                                {p}
                              </Button>
                            </React.Fragment>
                          );
                        })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPage((p) => Math.min(p + 1, totalPages));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={page === totalPages || loading}
                      className="h-8 px-2.5 text-xs gap-1"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>


      {/* Job Detail Sheet */}
      <JobDetailSheet
        job={selectedJob}
        open={sheetOpen}
        onClose={closeDetail}
        onApply={handleApply}
        appliedJobIds={appliedJobIds}
        bookmarkedJobIds={bookmarkedJobIds}
        onToggleBookmark={handleToggleBookmark}
        referralInfo={selectedJob ? (referralClaimsMap[selectedJob.job_id] ?? null) : null}
      />

      {/* Apply Modal */}
      <ApplyModal
        job={selectedJob}
        open={applyModalOpen}
        onClose={closeApply}
        onSuccess={() => {
          if (selectedJob?.job_id) {
            markJobAsApplied(selectedJob.job_id);
          }
          fetchApplications();
          fetchJobs();
        }}
      />

      {/* Register Required Modal */}
      <RegisterRequiredModal
        open={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
      />
    </div>
  );
}

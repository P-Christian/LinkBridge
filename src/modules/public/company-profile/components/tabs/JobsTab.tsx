import { useState, useEffect, useRef } from "react";
import { Search, Loader2, MapPin, Clock, DollarSign, Filter, ChevronDown, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CompanyJob, PublicCompanyProfile } from "../../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PublicJobDetailModal } from "@/modules/public/find-jobs/components/PublicJobDetailModal";
import { PublicJobSkeleton } from "@/modules/public/find-jobs/components/PublicJobSkeleton";
import { PublicJobPosting } from "@/modules/public/find-jobs/types";

interface JobsTabProps {
  company: PublicCompanyProfile;
  onArrangementsChange?: (arrangements: string[]) => void;
}

const JOB_TYPE_OPTIONS = [
  { value: "ALL", label: "All Job Types" },
  { value: "FULL_TIME", label: "Full Time" },
  { value: "PART_TIME", label: "Part Time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "FREELANCE", label: "Freelance" },
  { value: "INTERNSHIP", label: "Internship" },
];

const ARRANGEMENT_OPTIONS = [
  { value: "ALL", label: "All Work Setups" },
  { value: "Remote", label: "Remote" },
  { value: "Hybrid", label: "Hybrid" },
  { value: "On-site", label: "On-site" },
];

export function JobsTab({ company, onArrangementsChange }: JobsTabProps) {

  const [jobs, setJobs] = useState<CompanyJob[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedJob, setSelectedJob] = useState<PublicJobPosting | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Filters state
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [jobType, setJobType] = useState("ALL");
  const [arrangement, setArrangement] = useState("ALL");
  const [experience, setExperience] = useState("ALL");
  const [page, setPage] = useState(1);

  const limit = 5;
  const totalPages = Math.ceil(total / limit);
  const activeFilterCount =
    (appliedSearch.trim() ? 1 : 0) + (jobType !== "ALL" ? 1 : 0) + (arrangement !== "ALL" ? 1 : 0);

  const loadJobs = async () => {
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const params = new URLSearchParams();
      if (appliedSearch.trim()) params.append("search", appliedSearch.trim());
      if (jobType !== "ALL") params.append("job_type", jobType);
      if (arrangement !== "ALL") params.append("work_arrangement", arrangement);
      if (experience !== "ALL") params.append("experience_level", experience);
      params.append("page", String(page));
      params.append("limit", String(limit));

      const res = await fetch(`/api/public/companies/${company.company_code}/jobs?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();

        const elapsed = Date.now() - startTime;
        if (elapsed < 250) {
          await new Promise((r) => setTimeout(r, 250 - elapsed));
        }

        setJobs(json.jobs || []);
        setTotal(json.total || 0);

        // Bubble up work arrangements if needed for hiring status
        if (json.jobs && json.jobs.length > 0 && onArrangementsChange) {
          const uniqueArrangements = Array.from(new Set(json.jobs.map((j: CompanyJob) => j.work_arrangement))) as string[];
          onArrangementsChange(uniqueArrangements);
        }
      }
    } catch (e) {
      console.error("Failed to load jobs for company:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      loadJobs();
      return;
    }

    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, jobType, arrangement, experience, page]);


  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(search);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setJobType("ALL");
    setArrangement("ALL");
    setExperience("ALL");
    setPage(1);
  };


  const formatJobType = (type: string) => {
    return type.replace("_", " ");
  };

  const handleOpenJobDetail = (job: CompanyJob) => {
    const posting: PublicJobPosting = {
      job_id: job.id,
      company_id: company.company_id,
      company_code: company.company_code,
      company_name: company.company_name,
      company_logo_url: company.company_logo,
      company_verification_status: company.verification_status,
      job_title: job.title,
      job_description: job.description || "No full description provided.",
      job_type: formatJobType(job.type),
      work_setup: job.work_arrangement,
      location: job.location,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      salary_currency: job.salary_currency,
      experience_level: job.experience_level,
      created_at: job.created_at || new Date().toISOString(),
    };
    setSelectedJob(posting);
    setIsDetailOpen(true);
  };

  const filterPanel = (
    <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Text search */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search job title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 md:h-10 rounded-xl text-base md:text-xs font-medium"
            />
          </div>

          {/* Job Type Searchable Select */}
          <div className="md:col-span-3">
            <SearchableSelect
              options={JOB_TYPE_OPTIONS}
              value={jobType}
              onValueChange={(val) => {
                setJobType(val);
                setPage(1);
              }}
              placeholder="All Types"
              className="h-11 md:h-10 rounded-xl text-sm md:text-xs font-medium"
            />
          </div>

          {/* Work Arrangement Searchable Select */}
          <div className="md:col-span-3">
            <SearchableSelect
              options={ARRANGEMENT_OPTIONS}
              value={arrangement}
              onValueChange={(val) => {
                setArrangement(val);
                setPage(1);
              }}
              placeholder="All Setup"
              className="h-11 md:h-10 rounded-xl text-sm md:text-xs font-medium"
            />
          </div>

          {/* Action buttons */}
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit" disabled={isLoading} className="flex-1 h-11 md:h-10 rounded-xl font-semibold cursor-pointer gap-1 text-sm md:text-xs">
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              {isLoading ? "..." : "Search"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleResetFilters}
              className="h-11 md:h-10 px-3 rounded-xl border-input hover:bg-muted text-sm md:text-xs font-medium cursor-pointer"
              title="Reset Filters"
            >
              Reset
            </Button>
          </div>
    </form>
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Mobile filter trigger (below md only; the inline panel stays at >=768px) */}
      <div className="md:hidden">
        <Button
          type="button"
          onClick={() => setIsFilterOpen((open) => !open)}
          aria-expanded={isFilterOpen}
          aria-controls="jobs-filter-panel"
          className="w-full h-11 justify-between text-sm font-semibold shadow-sm cursor-pointer"
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
            <ChevronDown className={`h-4 w-4 transition-transform ${isFilterOpen ? "rotate-180" : ""}`} />
          </span>
        </Button>
      </div>

      {/* Mobile filter panel — rendered inline so the on-screen keyboard can never cover it (below md only; the inline card stays at >=768px) */}
      {/* Mobile filter panel — rendered inline so the on-screen keyboard can never cover it (below md only; the inline card stays at >=768px) */}
      {isFilterOpen && (
        <div id="jobs-filter-panel" className="md:hidden bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          {filterPanel}
        </div>
      )}

      {/* Search and Filters box (inline at >=768px; below md the same panel renders inline above) */}
      <div className="hidden md:block bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)]">{filterPanel}</div>

      {/* Jobs results list */}
      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading-skeletons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 gap-4"
            >
              {[1, 2, 3].map((i) => (
                <PublicJobSkeleton key={i} />
              ))}
            </motion.div>
          ) : jobs.length === 0 ? (
            <motion.div
              key="empty-jobs"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="border border-dashed rounded-3xl py-16 px-4 bg-muted/10 text-center"
            >
              <h3 className="text-lg font-bold text-foreground mb-1">No open jobs found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                There are currently no active job postings matching your filter selections.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={`jobs-list-${appliedSearch}-${jobType}-${arrangement}-${page}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-3">
                {jobs.map((job, idx) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}
                    whileHover={{ y: -3, transition: { duration: 0.2 } }}
                    onClick={() => handleOpenJobDetail(job)}
                    className="group bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 p-4 sm:p-5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgba(37,99,235,0.12)] hover:border-primary/40 transition-all duration-300 flex flex-col justify-between cursor-pointer"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-3">
                      <div>
                        <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer">
                          {job.title}
                        </h3>
                        {job.department && (
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mt-1">
                            {job.department}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Badge variant="outline" className="rounded-xl px-2.5 py-0.5 font-semibold text-[10px] bg-muted/30">
                          {formatJobType(job.type)}
                        </Badge>
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 font-semibold px-2.5 py-0.5 rounded-xl text-[10px] border-none">
                          {job.work_arrangement}
                        </Badge>
                      </div>
                    </div>

                    {/* Skills/Tags */}
                    {job.tags && job.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {job.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="px-2 py-0.5 text-[10px] font-semibold rounded-md">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Footer details row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground mt-2">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-medium">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 shrink-0" />
                          {job.location}
                        </span>
                        <span className="flex items-center gap-1 text-foreground font-semibold text-sm">
                          <DollarSign className="w-4 h-4 shrink-0 text-muted-foreground" />
                          {job.salary}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {job.posted}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs font-semibold gap-1.5 rounded-full border-border/80 bg-white/70 dark:bg-card/70 backdrop-blur-md text-foreground group-hover:border-primary/40 hover:!bg-primary hover:!text-white hover:!border-primary hover:shadow-[0_4px_16px_rgba(37,99,235,0.3)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 cursor-pointer [&>svg]:transition-transform [&>svg]:duration-200 hover:[&>svg]:translate-x-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenJobDetail(job);
                          }}
                        >
                          View Details
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border pt-6 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1 || isLoading}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="rounded-xl font-medium cursor-pointer"
                  >
                    Previous
                  </Button>
                  <span className="text-sm font-semibold text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages || isLoading}
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    className="rounded-xl font-medium cursor-pointer"
                  >
                    Next
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>


      {/* In-Place Public Job Detail Modal */}
      <PublicJobDetailModal
        job={selectedJob}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedJob(null);
        }}
      />
    </div>
  );
}

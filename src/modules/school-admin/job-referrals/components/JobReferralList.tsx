// src/modules/school-admin/job-referrals/components/JobReferralList.tsx
"use client";

import React, { useState, useMemo } from 'react';
import { useJobReferralsContext } from '../providers/JobReferralsProvider';
import { JobReferralCard } from './JobReferralCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search,
  Briefcase,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { stripHtmlTags } from '../utils/formatting';

const ITEMS_PER_PAGE = 10;

export function JobReferralList() {
  const { jobs, openReferralWizard, isLoading } = useJobReferralsContext();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [arrangementFilter, setArrangementFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Filter jobs
  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const plainDesc = stripHtmlTags(job.job_description).toLowerCase();
      const plainQuals = stripHtmlTags(job.job_qualifications).toLowerCase();

      const matchSearch =
        q === '' ||
        job.job_title.toLowerCase().includes(q) ||
        (job.company_name && job.company_name.toLowerCase().includes(q)) ||
        job.job_category.toLowerCase().includes(q) ||
        plainDesc.includes(q) ||
        plainQuals.includes(q);

      const matchType = typeFilter === 'ALL' || job.job_type === typeFilter;
      const matchArrangement = arrangementFilter === 'ALL' || job.work_arrangement === arrangementFilter;

      return matchSearch && matchType && matchArrangement;
    });
  }, [jobs, search, typeFilter, arrangementFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredJobs.length);

  const paginatedJobs = useMemo(() => {
    return filteredJobs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredJobs, startIndex]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleTypeFilterChange = (val: string) => {
    setTypeFilter(val);
    setCurrentPage(1);
  };

  const handleArrangementFilterChange = (val: string) => {
    setArrangementFilter(val);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setTypeFilter('ALL');
    setArrangementFilter('ALL');
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-44 rounded-xl border bg-card/40 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search active vacancies, companies, roles..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 text-sm bg-background"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {/* Job Type Filter */}
            <div className="flex items-center gap-1.5">
              <select
                value={typeFilter}
                onChange={(e) => handleTypeFilterChange(e.target.value)}
                className="text-xs bg-background border border-input rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">All Job Types</option>
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERNSHIP">Internship</option>
                <option value="FREELANCE">Freelance</option>
              </select>
            </div>

            {/* Work Arrangement Filter */}
            <div className="flex items-center gap-1.5">
              <select
                value={arrangementFilter}
                onChange={(e) => handleArrangementFilterChange(e.target.value)}
                className="text-xs bg-background border border-input rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">All Work Setups</option>
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
                <option value="On-site">On-site</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span className="flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-primary" />
            {filteredJobs.length === 0 ? (
              <span>No vacancies found</span>
            ) : (
              <span>
                Showing <strong className="text-foreground">{startIndex + 1}–{endIndex}</strong> of{' '}
                <strong className="text-foreground">{filteredJobs.length}</strong> available vacancies
                {totalPages > 1 && (
                  <span className="ml-1 text-muted-foreground">
                    (Page {currentPage} of {totalPages})
                  </span>
                )}
              </span>
            )}
          </span>
          {(search || typeFilter !== 'ALL' || arrangementFilter !== 'ALL') && (
            <button
              onClick={handleResetFilters}
              className="text-primary hover:underline text-xs"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Jobs Roster Cards */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-16 space-y-3 rounded-xl border border-dashed border-border bg-card/30">
          <SlidersHorizontal className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">No matching job vacancies</h3>
            <p className="text-xs text-muted-foreground">
              Try adjusting your search terms or filter criteria.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {paginatedJobs.map((job) => (
            <JobReferralCard key={job.job_id} job={job} onRefer={openReferralWizard} />
          ))}
        </div>
      )}

      {/* Pagination Controls Footer */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/60">
          <p className="text-xs text-muted-foreground">
            Page <span className="font-semibold text-foreground">{currentPage}</span> of{' '}
            <span className="font-semibold text-foreground">{totalPages}</span>
          </p>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="h-8 px-2.5 text-xs gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </Button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  return (
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                  );
                })
                .map((page, index, array) => {
                  const showEllipsis = index > 0 && page - array[index - 1] > 1;
                  return (
                    <React.Fragment key={page}>
                      {showEllipsis && (
                        <span className="px-1 text-xs text-muted-foreground">...</span>
                      )}
                      <Button
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="h-8 w-8 p-0 text-xs font-medium"
                      >
                        {page}
                      </Button>
                    </React.Fragment>
                  );
                })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="h-8 px-2.5 text-xs gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

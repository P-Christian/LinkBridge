// src/modules/client/applicants/components/ApplicantList.tsx
"use client";

import React from "react";
import { Applicant } from "../types";
import ApplicantCard from "./ApplicantCard";
import ApplicantPagination from "./ApplicantPagination";
import { Users, SearchX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import ErrorState from "../../components/ErrorState";

const DEFAULT_PAGE_SIZE = 20;

interface ApplicantListProps {
  applicants: Applicant[];
  onUpdateStatus: (applicant: Applicant) => void;
  onQuickStageUpdate?: (applicant: Applicant, toStageId: number, stageName: string) => void;
  onScheduleInterview: (applicant: Applicant) => void;
  onViewScheduledInterview?: (interviewId: number) => void;
  onViewDetails: (applicant: Applicant) => void;
  onReviewAssessment?: (applicant: Applicant) => void;
  /** Applicants that exist before search/stage filters are applied. */
  totalCount?: number;
  /** Changes whenever the query behind `applicants` changes, resetting to page 1. */
  resetKey?: string;
  /** Load error; only shown as the empty state when there is nothing to display. */
  error?: string;
  onRetry?: () => void;
  onClearFilters?: () => void;
}

type CardProps = Pick<
  ApplicantListProps,
  | "onUpdateStatus"
  | "onQuickStageUpdate"
  | "onScheduleInterview"
  | "onViewScheduledInterview"
  | "onViewDetails"
  | "onReviewAssessment"
>;

/**
 * Remounted (via `key`) whenever the query changes, which is what returns the
 * reader to page 1. A stage move refreshes rows without changing resetKey, so
 * the recruiter stays on the page they were working through.
 */
function PaginatedApplicantGrid({
  applicants,
  pageSize,
  onPageSizeChange,
  ...cardProps
}: {
  applicants: Applicant[];
  pageSize: number;
  onPageSizeChange: (size: number) => void;
} & CardProps) {
  const listTopRef = React.useRef<HTMLDivElement>(null);
  const [page, setPage] = React.useState(1);

  const totalPages = Math.max(1, Math.ceil(applicants.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const visibleApplicants = applicants.slice(startIndex, startIndex + pageSize);

  const scrollToListTop = () => {
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={listTopRef} className="space-y-3 relative">
      <AnimatePresence mode="popLayout" initial={false}>
        {visibleApplicants.map((a) => (
          <motion.div
            key={a.application_id}
            layout
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: -8,
              transition: { duration: 0.2, ease: "easeInOut" },
            }}
            transition={{
              duration: 0.25,
              ease: "easeOut",
              layout: { duration: 0.25, ease: "easeInOut" },
            }}
          >
            <ApplicantCard applicant={a} {...cardProps} />
          </motion.div>
        ))}
      </AnimatePresence>

      <ApplicantPagination
        page={currentPage}
        pageSize={pageSize}
        total={applicants.length}
        onPageChange={(nextPage) => {
          setPage(nextPage);
          scrollToListTop();
        }}
        onPageSizeChange={(nextSize) => {
          onPageSizeChange(nextSize);
          scrollToListTop();
        }}
      />
    </div>
  );
}

export default function ApplicantList({
  applicants,
  totalCount = 0,
  resetKey = "",
  error,
  onRetry,
  onClearFilters,
  ...cardProps
}: ApplicantListProps) {
  // Page size survives a query change; only the page number resets.
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  if (applicants.length === 0 && error && totalCount === 0) {
    return <ErrorState title="Couldn't load candidates" message={error} onRetry={onRetry} />;
  }

  if (applicants.length === 0 && totalCount > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="p-4 bg-muted/60 rounded-2xl mb-4 border border-border/40">
          <SearchX className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <h3 className="font-semibold text-foreground text-sm">No candidates match these filters</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs md:text-xs">
          {totalCount} {totalCount === 1 ? "candidate is" : "candidates are"} hidden by your current search or stage filter.
        </p>
        {onClearFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters} className="mt-4 max-md:min-h-10">
            Show all candidates
          </Button>
        )}
      </motion.div>
    );
  }

  if (applicants.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="p-4 bg-muted/60 rounded-2xl mb-4 border border-border/40">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground text-sm">No applicants found</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs md:text-xs">
          Applicants will appear here once job seekers apply to your postings.
        </p>
      </motion.div>
    );
  }

  return (
    <PaginatedApplicantGrid
      key={`${resetKey}|${pageSize}`}
      applicants={applicants}
      pageSize={pageSize}
      onPageSizeChange={setPageSize}
      {...cardProps}
    />
  );
}

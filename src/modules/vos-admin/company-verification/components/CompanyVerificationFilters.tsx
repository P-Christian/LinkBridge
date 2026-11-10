"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Search, Filter, X } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface CompanyVerificationFiltersProps {
  statusFilter: string;
  onStatusChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (search: string) => void;
}

const COMPANY_STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING_VERIFICATION", label: "Pending Verification" },
  { value: "IN_REVIEW", label: "Pending: Under Review" },
  { value: "NEEDS_REVISION", label: "Needs Revision" },
  { value: "VERIFIED", label: "Verified" },
  { value: "REJECTED_OR_SUSPENDED", label: "Rejected / Suspended" },
  { value: "REJECTED", label: "Rejected" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DRAFT", label: "Draft / Incomplete" },
];

export const CompanyVerificationFilters: React.FC<CompanyVerificationFiltersProps> = ({
  statusFilter,
  onStatusChange,
  searchQuery,
  onSearchChange,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4"
    >
      {/* Search Input */}
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by company, TIN, Reg No..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-8 bg-background h-9 text-xs rounded-lg border-border"
        />
        {searchQuery && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSearchChange("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Filter Dropdown */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Filter className="h-4 w-4 text-muted-foreground hidden sm:inline" />
        <SearchableSelect
          value={statusFilter}
          onValueChange={onStatusChange}
          options={COMPANY_STATUS_OPTIONS}
          placeholder="All Statuses"
          triggerClassName="w-full sm:w-64 bg-background text-xs h-9 rounded-lg border-border"
        />
      </div>
    </motion.div>
  );
};

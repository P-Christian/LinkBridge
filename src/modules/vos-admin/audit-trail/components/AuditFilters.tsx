// src/modules/vos-admin/audit-trail/components/AuditFilters.tsx
"use client";

import React from 'react';
import { AuditFilters as AuditFiltersType } from '../types/audit.types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Search, RotateCcw, Download, SlidersHorizontal, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface AuditFiltersProps {
  filters: AuditFiltersType;
  onFilterChange: (newFilters: Partial<AuditFiltersType>) => void;
  onReset: () => void;
  onExportCSV: () => void;
  onOpenSettings?: () => void;
  isExporting?: boolean;
}

const CATEGORIES = [
  { value: "ALL", label: "All Categories" },
  { value: "AUTHENTICATION", label: "Authentication" },
  { value: "USER", label: "User Management" },
  { value: "COMPANY", label: "Company Verification" },
  { value: "EMPLOYEE", label: "Employee Actions" },
  { value: "SCHOOL", label: "School Actions" },
  { value: "JOB", label: "Job Module" },
  { value: "APPLICATION", label: "Application Module" },
  { value: "MESSAGE", label: "Message" },
  { value: "NOTIFICATION", label: "Notification" },
  { value: "ADMIN", label: "Administrative" },
  { value: "SYSTEM", label: "System" },
];

const ACTIONS = [
  { value: "ALL", label: "All Actions" },
  { value: "CREATE", label: "CREATE / REGISTER" },
  { value: "UPDATE", label: "UPDATE / EDIT" },
  { value: "DELETE", label: "DELETE" },
  { value: "LOGIN", label: "LOGIN" },
  { value: "LOGOUT", label: "LOGOUT" },
  { value: "FAILED_LOGIN", label: "FAILED LOGIN" },
  { value: "LOCKOUT", label: "LOCKOUT" },
  { value: "VERIFY", label: "VERIFY" },
  { value: "OTP_VERIFY", label: "OTP VERIFY" },
  { value: "PASSWORD_RESET", label: "PASSWORD RESET" },
  { value: "ACCOUNT_RECOVERY", label: "ACCOUNT RECOVERY" },
  { value: "ROLE_ASSIGN", label: "ROLE ASSIGN" },
  { value: "ROLE_REVOKE", label: "ROLE REVOKE" },
  { value: "PERMISSION_CHANGE", label: "PERMISSION CHANGE" },
  { value: "SUBMIT", label: "SUBMIT" },
  { value: "REJECT", label: "REJECT" },
  { value: "DOC_UPLOAD", label: "DOCUMENT UPLOAD" },
  { value: "DOC_DELETE", label: "DOCUMENT DELETE" },
  { value: "OVERRIDE", label: "VERIFICATION OVERRIDE" },
  { value: "PUBLISH", label: "PUBLISH PROFILE" },
  { value: "POST", label: "JOB POSTED" },
  { value: "CLOSE", label: "JOB CLOSED" },
  { value: "SCHEDULE", label: "INTERVIEW SCHEDULED" },
  { value: "OFFER_SENT", label: "OFFER SENT" },
  { value: "EXPORT", label: "EXPORT" },
  { value: "SEARCH", label: "SEARCH" },
  { value: "VIEW_AUDIT", label: "VIEW AUDIT" },
  { value: "RETENTION_CHANGE", label: "RETENTION CHANGE" },
  { value: "LEGAL_HOLD", label: "LEGAL HOLD" },
  { value: "CONFIG_CHANGE", label: "CONFIG CHANGE" },
];

const STATUSES = [
  { value: "ALL", label: "All Statuses" },
  { value: "SUCCESS", label: "SUCCESS" },
  { value: "FAILED", label: "FAILED" },
  { value: "DENIED", label: "DENIED" },
];

const ACTOR_TYPES = [
  { value: "ALL", label: "All Actors" },
  { value: "ADMIN", label: "Admin" },
  { value: "SCH_ADMIN", label: "School Admin" },
  { value: "CLIENT", label: "Client" },
  { value: "FREELANCER", label: "Freelancer" },
  { value: "SYSTEM", label: "System" },
];

const ORG_TYPES = [
  { value: "ALL", label: "All Organizations" },
  { value: "EMPLOYER", label: "Employer" },
  { value: "FREELANCER", label: "Freelancer" },
  { value: "SCHOOL", label: "School" },
  { value: "PLATFORM", label: "Platform" },
];

export function AuditFilters({
  filters,
  onFilterChange,
  onReset,
  onExportCSV,
  onOpenSettings,
  isExporting,
}: AuditFiltersProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3.5 p-4 rounded-xl border border-border bg-card shadow-2xs mb-4"
    >
      {/* Top Row: Search & Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search event type, reason, resource ID, correlation ID..."
            value={filters.search || ""}
            onChange={(e) => onFilterChange({ search: e.target.value, page: 1 })}
            className="pl-9 pr-8 h-9 text-xs rounded-lg border-border bg-background"
          />
          {filters.search && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onFilterChange({ search: "", page: 1 })}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenSettings && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSettings}
              className="h-9 text-xs rounded-lg flex items-center gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Audit Settings
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="h-9 text-xs rounded-lg flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onExportCSV}
            disabled={isExporting}
            className="h-9 text-xs rounded-lg flex items-center gap-1.5 shadow-2xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>

      {/* Bottom Row: Filter Selectors & Date Range */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
        {/* Category */}
        <SearchableSelect
          value={filters.event_category || "ALL"}
          onValueChange={(val) => onFilterChange({ event_category: val, page: 1 })}
          options={CATEGORIES}
          placeholder="Category"
          triggerClassName="h-9 text-xs bg-background border-border rounded-lg w-full sm:w-[145px]"
        />

        {/* Action */}
        <SearchableSelect
          value={filters.action || "ALL"}
          onValueChange={(val) => onFilterChange({ action: val, page: 1 })}
          options={ACTIONS}
          placeholder="Action"
          triggerClassName="h-9 text-xs bg-background border-border rounded-lg w-full sm:w-[140px]"
        />

        {/* Status */}
        <SearchableSelect
          value={filters.status || "ALL"}
          onValueChange={(val) => onFilterChange({ status: val, page: 1 })}
          options={STATUSES}
          placeholder="Status"
          triggerClassName="h-9 text-xs bg-background border-border rounded-lg w-full sm:w-[125px]"
        />

        {/* Actor Type */}
        <SearchableSelect
          value={filters.actor_type || "ALL"}
          onValueChange={(val) => onFilterChange({ actor_type: val, page: 1 })}
          options={ACTOR_TYPES}
          placeholder="Actor Type"
          triggerClassName="h-9 text-xs bg-background border-border rounded-lg w-full sm:w-[125px]"
        />

        {/* Org Type */}
        <SearchableSelect
          value={filters.organization_type || "ALL"}
          onValueChange={(val) => onFilterChange({ organization_type: val, page: 1 })}
          options={ORG_TYPES}
          placeholder="Org Type"
          triggerClassName="h-9 text-xs bg-background border-border rounded-lg w-full sm:w-[135px]"
        />

        {/* Date From */}
        <Input
          type="date"
          value={filters.date_from || ""}
          onChange={(e) => onFilterChange({ date_from: e.target.value, page: 1 })}
          className="h-9 text-xs bg-background border-border rounded-lg w-full sm:w-[135px]"
          placeholder="Date From"
        />

        {/* Date To */}
        <Input
          type="date"
          value={filters.date_to || ""}
          onChange={(e) => onFilterChange({ date_to: e.target.value, page: 1 })}
          className="h-9 text-xs bg-background border-border rounded-lg w-full sm:w-[135px]"
          placeholder="Date To"
        />
      </div>
    </motion.div>
  );
}

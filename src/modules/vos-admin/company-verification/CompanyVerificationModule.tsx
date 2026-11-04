"use client";

import React, { useState } from "react";
import { useCompanyVerification } from "./hooks/useCompanyVerification";
import {
  CompanyVerificationKpis,
  CompanyVerificationFilters,
  CompanyVerificationTable,
  CompanyVerificationDetailModal,
  RevisionRequestModal,
  ApproveConfirmationModal,
} from "./components";
import { Building2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function CompanyVerificationModule() {
  const {
    records,
    allRecords,
    loading,
    kpiData,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    selectedCompany,
    isDetailModalOpen,
    isRevisionModalOpen,
    isSubmitting,
    openDetailModal,
    closeDetailModal,
    openRevisionModal,
    closeRevisionModal,
    handleDecision,
    refetch,
  } = useCompanyVerification();

  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);

  const handleConfirmApprove = async () => {
    setIsApproveModalOpen(false);
    await handleDecision("approve");
  };

  const handleConfirmRevision = async (reason: string, internalNotes: string) => {
    await handleDecision("request_revision", reason, internalNotes);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col p-6 md:p-8 max-w-[1600px] mx-auto w-full overflow-y-auto h-full min-h-0"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">
            <span>Admin Governance & Verification</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" />
            Company Verification Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review employer registration applications, verify tax/registration documents, and manage corporate approval status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={loading}
            className="gap-2 text-xs rounded-lg shadow-2xs hover:bg-accent"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Error alert banner */}
      {/* KPI Stat Cards */}
      <CompanyVerificationKpis
        kpis={kpiData}
        loading={loading && allRecords.length === 0}
        currentFilter={statusFilter}
        onFilterSelect={(status) => setStatusFilter(status)}
      />

      {/* Filter Bar */}
      <CompanyVerificationFilters
        statusFilter={statusFilter}
        onStatusChange={(s) => setStatusFilter(s)}
        searchQuery={searchQuery}
        onSearchChange={(q) => setSearchQuery(q)}
      />

      {/* Table List */}
      <CompanyVerificationTable
        records={records}
        loading={loading}
        onSelectCompany={(company) => openDetailModal(company)}
      />

      {/* Company Detail Review Drawer / Modal */}
      <CompanyVerificationDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => closeDetailModal()}
        company={selectedCompany}
        onApprove={() => setIsApproveModalOpen(true)}
        onRequestRevision={(c) => openRevisionModal(c)}
        isSubmitting={isSubmitting}
      />

      {/* Approve Confirmation Modal */}
      <ApproveConfirmationModal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        companyName={selectedCompany?.company_name}
        onConfirm={handleConfirmApprove}
        isSubmitting={isSubmitting}
      />

      {/* Revision Request Modal */}
      <RevisionRequestModal
        isOpen={isRevisionModalOpen}
        onClose={() => closeRevisionModal()}
        company={selectedCompany}
        onConfirm={handleConfirmRevision}
        isSubmitting={isSubmitting}
      />
    </motion.div>
  );
}

export default CompanyVerificationModule;

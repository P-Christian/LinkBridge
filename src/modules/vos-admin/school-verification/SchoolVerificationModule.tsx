// src/modules/vos-admin/school-verification/SchoolVerificationModule.tsx
"use client";

import React, { useState } from "react";
import { useSchoolVerification } from "./hooks/useSchoolVerification";
import {
  SchoolVerificationKpis,
  SchoolVerificationFilters,
  SchoolVerificationTable,
  SchoolVerificationDetailModal,
  SchoolRejectionReasonModal,
} from "./components";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { GraduationCap, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function SchoolVerificationModule() {
  const {
    records,
    allRecords,
    loading,
    kpiData,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    selectedSchool,
    isDetailModalOpen,
    isRejectionModalOpen,
    isSubmitting,
    openDetailModal,
    closeDetailModal,
    openRejectionModal,
    closeRejectionModal,
    handleDecision,
    refetch,
  } = useSchoolVerification();

  const [modalMode, setModalMode] = useState<"reject" | "request_correction">("reject");
  const [approveConfirmSchool, setApproveConfirmSchool] = useState<typeof selectedSchool | null>(null);

  const handleApproveAction = (school: typeof selectedSchool) => {
    if (!school) return;
    setApproveConfirmSchool(school);
  };

  const handleConfirmApprove = async () => {
    if (!approveConfirmSchool) return;
    await handleDecision("approve");
    setApproveConfirmSchool(null);
  };

  const handleOpenRejection = (school: typeof selectedSchool) => {
    if (!school) return;
    setModalMode("reject");
    openRejectionModal(school);
  };

  const handleOpenCorrection = (school: typeof selectedSchool) => {
    if (!school) return;
    setModalMode("request_correction");
    openRejectionModal(school);
  };

  const handleConfirmRejectionModal = async (
    action: "reject" | "request_correction",
    reason: string,
    internalNotes: string
  ) => {
    await handleDecision(action, reason, internalNotes);
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
            <GraduationCap className="h-7 w-7 text-primary" />
            School Verification Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review school accreditation applications, verify CHED/DepEd/TESDA recognition documents, and manage educational institution accounts.
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
      <SchoolVerificationKpis
        kpis={kpiData}
        loading={loading && allRecords.length === 0}
        currentFilter={statusFilter}
        onFilterSelect={(status) => setStatusFilter(status)}
      />

      {/* Filter Bar */}
      <SchoolVerificationFilters
        statusFilter={statusFilter}
        onStatusChange={(s) => setStatusFilter(s)}
        searchQuery={searchQuery}
        onSearchChange={(q) => setSearchQuery(q)}
      />

      {/* Table List */}
      <SchoolVerificationTable
        records={records}
        loading={loading}
        onSelectSchool={(school) => openDetailModal(school)}
      />

      {/* School Detail Review Drawer / Modal */}
      <SchoolVerificationDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => closeDetailModal()}
        school={selectedSchool}
        onApprove={(s) => handleApproveAction(s)}
        onRequestCorrection={(s) => handleOpenCorrection(s)}
        onReject={(s) => handleOpenRejection(s)}
        isSubmitting={isSubmitting}
      />

      {/* Rejection / Correction Modal */}
      <SchoolRejectionReasonModal
        isOpen={isRejectionModalOpen}
        onClose={() => closeRejectionModal()}
        school={selectedSchool}
        mode={modalMode}
        onConfirm={handleConfirmRejectionModal}
        isSubmitting={isSubmitting}
      />

      {/* Approve Confirmation AlertDialog */}
      <AlertDialog open={Boolean(approveConfirmSchool)} onOpenChange={(open) => !open && setApproveConfirmSchool(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Approve School Verification
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground mt-1">
              Are you sure you want to approve verification for <strong className="text-foreground">{approveConfirmSchool?.school_name}</strong>? This will grant the institution active verified status on LinkBridge.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={isSubmitting} className="rounded-lg text-xs">
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              onClick={handleConfirmApprove}
              disabled={isSubmitting}
              className="rounded-lg text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs"
            >
              {isSubmitting ? "Approving..." : "Confirm Approval"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

export default SchoolVerificationModule;

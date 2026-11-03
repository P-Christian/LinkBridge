"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CompanyVerificationRecord, CompanyVerificationKPIs, VerificationDecisionPayload, VerificationStatus } from "../types";
import { fetchCompanyVerifications, submitVerificationDecision } from "../services/companyVerification.service";
import { calculateCompanyKPIs, filterCompanyRecords } from "../utils/companyVerification.utils";
import { toast } from "sonner";
import { useRequestAbort } from "@/hooks/useRequestAbort";

export function useCompanyVerification() {
  const searchParams = useSearchParams();
  const targetCompanyId = searchParams?.get("companyId") || searchParams?.get("id");

  const [records, setRecords] = useState<CompanyVerificationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Detail Modal & Action Modal state
  const [selectedCompany, setSelectedCompany] = useState<CompanyVerificationRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const abortRead = useRequestAbort();

  /**
   * `followDeepLink` is only set by the read that runs for a `?companyId=` entry,
   * so a later manual refresh cannot resurrect a detail modal the admin closed.
   */
  const loadData = useCallback(async (options?: { followDeepLink?: boolean }) => {
    setLoading(true);
    // Each read gets a token; a superseded read must not write state, or a slow
    // first page lands after a fast refresh and reverts the row just decided.
    const signal = abortRead();
    try {
      const data = await fetchCompanyVerifications();
      if (signal.aborted) return;
      setRecords(data);

      if (options?.followDeepLink && targetCompanyId) {
        const match = data.find((r) => String(r.company_id) === String(targetCompanyId));
        if (match) {
          setSelectedCompany(match);
          setIsDetailModalOpen(true);
        }
      }
    } catch (err) {
      if (signal.aborted) return;
      toast.error(
        err instanceof Error ? err.message : "Failed to load company verifications"
      );
      // Rows from the last good read stay on screen: a failed refresh must not
      // wipe the queue the admin is working through.
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [targetCompanyId, abortRead]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData({ followDeepLink: true });
  }, [loadData]);

  // Pure filtered dataset
  const filteredRecords = useMemo(() => {
    return filterCompanyRecords(records, statusFilter, searchQuery);
  }, [records, statusFilter, searchQuery]);

  // KPIs derived from raw records
  const kpiData: CompanyVerificationKPIs = useMemo(() => {
    return calculateCompanyKPIs(records);
  }, [records]);

  // Actions
  const openDetailModal = (company: CompanyVerificationRecord) => {
    setSelectedCompany(company);
    setIsDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedCompany(null);
  };

  const openRevisionModal = (company: CompanyVerificationRecord) => {
    setSelectedCompany(company);
    setIsRevisionModalOpen(true);
  };

  const closeRevisionModal = () => {
    setIsRevisionModalOpen(false);
  };

  const handleDecision = async (
    action: "approve" | "request_revision" | "suspend",
    rejectionReason?: string,
    internalNotes?: string
  ) => {
    if (!selectedCompany) return;

    const companyToUpdate = selectedCompany;
    const previousRecords = records;

    const newStatus: VerificationStatus =
      action === "approve" ? "VERIFIED" : action === "request_revision" ? "DRAFT" : "SUSPENDED";

    const newVerifStatus =
      action === "approve"
        ? "APPROVED"
        : action === "request_revision"
        ? "CORRECTION_REQUIRED"
        : "SUSPENDED";

    const actionDescription =
      action === "approve"
        ? "approved and marked verified"
        : action === "request_revision"
        ? "returned for revision"
        : "suspended";

    // 1. Instant 0ms Optimistic State Update
    setRecords((prev) =>
      prev.map((item) =>
        item.company_id === companyToUpdate.company_id
          ? {
              ...item,
              verification_status: newStatus,
              rejection_reason: rejectionReason || item.rejection_reason,
              verified_at: action === "approve" ? new Date().toISOString() : item.verified_at,
              latest_verification: {
                id: Date.now(),
                company_id: item.company_id,
                verification_type: "INITIAL_REGISTRATION",
                status: newVerifStatus,
                public_rejection_reason: rejectionReason || null,
                internal_notes: internalNotes || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            }
          : item
      )
    );

    // Close modals immediately
    closeRevisionModal();
    closeDetailModal();

    toast.success(`${companyToUpdate.company_name} was ${actionDescription}.`);

    setIsSubmitting(true);
    const payload: VerificationDecisionPayload = {
      companyId: companyToUpdate.company_id,
      action,
      rejectionReason,
      internalNotes,
    };

    try {
      const result = await submitVerificationDecision(payload);
      // The company row moved, but the owner cascade, the workflow log or the
      // audit row may not have. The optimistic row above cannot show that.
      if (result.warnings?.length) {
        toast.warning(result.warnings.join(" "));
      }
    } catch (err) {
      // 2. Automatic Rollback on failure
      setRecords(previousRecords);
      const msg = err instanceof Error ? err.message : "Failed to update verification status";
      toast.error(`Rollback: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    records: filteredRecords,
    allRecords: records,
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
    refetch: loadData,
  };
}

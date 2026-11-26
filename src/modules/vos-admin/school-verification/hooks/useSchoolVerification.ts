// src/modules/vos-admin/school-verification/hooks/useSchoolVerification.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import {
  SchoolVerificationRecord,
  SchoolVerificationKPIs,
  VerificationDecisionPayload,
} from "../types";
import {
  fetchSchoolVerifications,
  submitSchoolVerificationDecision,
} from "../services/schoolVerification.api";
import { computeSchoolKpis } from "../services/schoolVerification.helpers";
import { requestSchoolInvite, type SchoolInviteResult } from "@/lib/school-invite";

export function useSchoolVerification() {
  const searchParams = useSearchParams();
  const targetSchoolId = searchParams?.get("schoolId") || searchParams?.get("id");

  const [allRecords, setAllRecords] = useState<SchoolVerificationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [selectedSchool, setSelectedSchool] = useState<SchoolVerificationRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const abortRead = useRequestAbort();

  /**
   * `followDeepLink` is only set by the read that runs for a `?schoolId=` entry,
   * so a later manual refresh cannot resurrect a detail modal the admin closed.
   */
  const loadRecords = useCallback(async (options?: { followDeepLink?: boolean }) => {
    setLoading(true);
    // Each read gets a token; a read that has been superseded must not write
    // state, or a slow first page lands after a fast `refetch` and reverts the
    // row the admin just approved.
    const signal = abortRead();
    try {
      const data = await fetchSchoolVerifications();
      if (signal.aborted) return;
      setAllRecords(data);

      if (options?.followDeepLink && targetSchoolId) {
        const match = data.find((r) => String(r.school_id) === String(targetSchoolId));
        if (match) {
          setSelectedSchool(match);
          setIsDetailModalOpen(true);
        }
      }
    } catch (err: unknown) {
      if (signal.aborted) return;
      toast.error(
        err instanceof Error ? err.message : "Failed to load school verifications"
      );
      // Rows from the last good read stay on screen: a failed refresh must not
      // wipe the queue the admin is working through.
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [targetSchoolId, abortRead]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRecords({ followDeepLink: true });
  }, [loadRecords]);

  // Derive KPI counts from all fetched records
  const kpiData: SchoolVerificationKPIs = useMemo(() => {
    return computeSchoolKpis(allRecords);
  }, [allRecords]);

  // Client-side filtering for fast, smooth table experience
  const filteredRecords = useMemo(() => {
    const matches = allRecords.filter((rec) => {
      // 1. Status filter
      if (statusFilter !== "ALL") {
        const s = String(rec.verification_status || "").toUpperCase();
        if (statusFilter === "INACTIVE") {
          if (s !== "REJECTED" && s !== "SUSPENDED" && s !== "INACTIVE") {
            return false;
          }
        } else if (s !== statusFilter) {
          return false;
        }
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (rec.school_name || "").toLowerCase().includes(q);
        const matchesEmail = (rec.school_email || "").toLowerCase().includes(q);
        const matchesCity = (rec.city_municipality || "").toLowerCase().includes(q);
        const matchesProv = (rec.province || "").toLowerCase().includes(q);
        const matchesType = (rec.school_type || "").toLowerCase().includes(q);

        return matchesName || matchesEmail || matchesCity || matchesProv || matchesType;
      }

      return true;
    });

    // Drafts sort after all non-Draft records; API order is preserved in each group.
    const nonDrafts = matches.filter(
      (rec) => String(rec.verification_status || "").toUpperCase() !== "DRAFT"
    );
    const drafts = matches.filter(
      (rec) => String(rec.verification_status || "").toUpperCase() === "DRAFT"
    );
    return [...nonDrafts, ...drafts];
  }, [allRecords, statusFilter, searchQuery]);

  const openDetailModal = (school: SchoolVerificationRecord) => {
    setSelectedSchool(school);
    setIsDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedSchool(null);
  };

  const openRejectionModal = (school: SchoolVerificationRecord) => {
    setSelectedSchool(school);
    setIsRejectionModalOpen(true);
  };

  const closeRejectionModal = () => {
    setIsRejectionModalOpen(false);
  };

  const generateSchoolInvite = useCallback(
    async (schoolId: number, email: string): Promise<SchoolInviteResult | null> => {
      return requestSchoolInvite(schoolId, email);
    },
    []
  );

  const handleDecision = async (
    action: VerificationDecisionPayload["action"],
    rejectionReason?: string,
    internalNotes?: string
  ) => {
    if (!selectedSchool) return;

    setIsSubmitting(true);
    try {
      const res = await submitSchoolVerificationDecision({
        schoolId: selectedSchool.school_id,
        action,
        rejectionReason,
        internalNotes,
      });

      const actionLabels: Record<string, string> = {
        approve: "approved",
        suspend: "suspended",
        request_correction: "returned for correction",
      };

      toast.success(
        res.message || `School "${selectedSchool.school_name}" has been ${actionLabels[action] || "updated"}.`
      );
      res.warnings.forEach((warning) => toast.warning(warning));

      // Reload dataset and close modals
      await loadRecords();
      closeRejectionModal();
      closeDetailModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to apply verification decision";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    records: filteredRecords,
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
    generateSchoolInvite,
    refetch: loadRecords,
  };
}

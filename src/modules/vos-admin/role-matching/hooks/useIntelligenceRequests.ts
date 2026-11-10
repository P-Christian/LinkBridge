"use client";

// src/modules/vos-admin/role-matching/hooks/useIntelligenceRequests.ts

import { useState, useCallback, useEffect } from "react";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import {
  IntelligenceRequest,
  IntelligenceRequestStatus,
  IntelligenceRequestAction,
  ReviewRequestPayload,
} from "../types";
import {
  fetchIntelligenceRequests,
  reviewIntelligenceRequest,
} from "../services/roleMatchingService";
import { toast } from "sonner";

export function useIntelligenceRequests(status?: IntelligenceRequestStatus) {
  const [requests, setRequests] = useState<IntelligenceRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const abortRead = useRequestAbort();

  const loadRequests = useCallback(
    async (requestStatus?: IntelligenceRequestStatus) => {
      setLoading(true);
      // Switching tabs starts a new read; this one must then stay out of state,
      // or a slow queue for the previous tab lands on top of the tab now shown
      // and approveRequest/rejectRequest are aimed at the wrong suggestions.
      const signal = abortRead();
      try {
        const data = await fetchIntelligenceRequests(requestStatus);
        if (signal.aborted) return;
        setRequests(data);
      } catch (err: unknown) {
        if (signal.aborted) return;
        toast.error((err as Error).message || "Failed to load intelligence requests.");
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [abortRead]
  );

  const approveRequest = useCallback(
    async (
      suggestionId: number,
      payload: Omit<ReviewRequestPayload, "action">
    ): Promise<boolean> => {
      try {
        const warnings = await reviewIntelligenceRequest(
          suggestionId,
          "APPROVE" as IntelligenceRequestAction,
          payload
        );
        // Update local state — mark as APPROVED with resolution type
        setRequests((prev) =>
          prev.map((r) =>
            r.suggestion_id === suggestionId
              ? {
                  ...r,
                  status: "APPROVED",
                  resolution_type: payload.resolution_type || "CREATED_NEW",
                  resolved_category_id: payload.existing_category_id ?? r.resolved_category_id,
                  admin_remarks: payload.admin_remarks ?? r.admin_remarks,
                }
              : r
          )
        );
        warnings.forEach((warning) => toast.warning(warning));
        return true;
      } catch (err: unknown) {
        toast.error((err as Error).message || "Failed to approve request.");
        return false;
      }
    },
    []
  );

  const rejectRequest = useCallback(
    async (suggestionId: number, adminRemarks: string): Promise<boolean> => {
      try {
        await reviewIntelligenceRequest(suggestionId, "REJECT" as IntelligenceRequestAction, {
          admin_remarks: adminRemarks,
          resolution_type: "REJECTED",
        });
        // Update local state — mark as REJECTED with resolution_type
        setRequests((prev) =>
          prev.map((r) =>
            r.suggestion_id === suggestionId
              ? {
                  ...r,
                  status: "REJECTED",
                  resolution_type: "REJECTED",
                  admin_remarks: adminRemarks,
                }
              : r
          )
        );
        return true;
      } catch (err: unknown) {
        toast.error((err as Error).message || "Failed to reject request.");
        return false;
      }
    },
    []
  );

  useEffect(() => {
    // The caller owns the tab, so `status` is the only trigger here. Mirroring
    // it into hook state as well used to re-run this effect after every load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRequests(status);
  }, [loadRequests, status]);

  return {
    requests,
    loading,
    loadRequests,
    approveRequest,
    rejectRequest,
  };
}

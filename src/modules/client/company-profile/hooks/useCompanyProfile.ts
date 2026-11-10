// src/modules/client/company-profile/hooks/useCompanyProfile.ts
"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import { CompanyProfile, CompanyProfileMeta, EditableCompanyFields } from "../types";

export function useCompanyProfile(
  initialCompany: CompanyProfile | null = null,
  initialMeta: CompanyProfileMeta | null = null,
  initialError: string = ""
) {
  const [company, setCompany] = useState<CompanyProfile | null>(initialCompany);
  const [meta, setMeta] = useState<CompanyProfileMeta | null>(initialMeta);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(initialError);
  const [successMessage, setSuccessMessage] = useState("");

  const abortRead = useRequestAbort();

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    const signal = abortRead();
    try {
      const res = await fetch("/api/client/company-profile", { signal });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load company profile.");
      }
      setCompany(json.company);
      setMeta(json.meta);
    } catch (err: unknown) {
      if (signal.aborted) return;
      const msg = err instanceof Error ? err.message : "Failed to load company profile.";
      setError(msg);
      toast.error(msg);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [abortRead]);

  const updateProfile = useCallback(
    async (fields: Partial<EditableCompanyFields>) => {
      setSaving(true);
      setError("");
      setSuccessMessage("");
      try {
        const res = await fetch("/api/client/company-profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to save company profile.");
        }
        if (json.company) {
          setCompany((prev) =>
            prev ? { ...prev, ...(json.company as Partial<CompanyProfile>) } : null
          );
        }
        setSuccessMessage("Company profile updated successfully.");
        toast.success("Company profile updated successfully.");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "An error occurred while saving.";
        setError(msg);
        toast.error(msg);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const createProfile = useCallback(
    async (fields: Partial<EditableCompanyFields>) => {
      setSaving(true);
      setError("");
      setSuccessMessage("");
      try {
        const res = await fetch("/api/client/company-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to create company profile.");
        }
        if (json.company) {
          setCompany(json.company);
          // Re-fetch profile to load updated links/meta
          await fetchProfile();
        }
        setSuccessMessage("Company profile created successfully.");
        toast.success("Company profile created successfully.");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "An error occurred while setting up profile.";
        setError(msg);
        toast.error(msg);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [fetchProfile]
  );

  const submitForVerification = useCallback(async () => {
    setSubmitting(true);
    setError("");
    setSuccessMessage("");
    try {
      const res = await fetch("/api/client/company-profile/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to submit company profile.");
      }
      if (json.company) {
        setCompany((prev) =>
          prev
            ? {
                ...prev,
                ...(json.company as Partial<CompanyProfile>),
                verification_workflow_status: "PENDING_VERIFICATION",
                rejection_reason: null,
                public_rejection_reason: null,
              }
            : null
        );
      }
      await fetchProfile();
      setSuccessMessage("Company profile submitted for verification successfully.");
      toast.success("Company profile submitted for verification successfully.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred while submitting.";
      setError(msg);
      toast.error(msg);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [fetchProfile]);

  return {
    company,
    meta,
    loading,
    saving,
    submitting,
    error,
    successMessage,
    fetchProfile,
    updateProfile,
    createProfile,
    submitForVerification,
    clearMessages: () => {
      setError("");
      setSuccessMessage("");
    },
  };
}

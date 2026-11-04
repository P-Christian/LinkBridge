"use client"

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import { PlatformCompany, PlatformCompanyFormData } from "../types/platformCompany.types";
import {
  fetchPlatformCompanies,
  updatePlatformCompany,
  setPrimaryPlatformCompany,
} from "../services/platformCompany.service";

export function usePlatformCompany() {
  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCompany, setEditingCompany] = useState<PlatformCompany | null>(null);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  const abortRead = useRequestAbort();

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    clearMessages();
    // Saving or setting a primary company reloads the list while the mount read
    // may still be running; only the newest read may write.
    const signal = abortRead();
    try {
      const res = await fetchPlatformCompanies();
      if (signal.aborted) return;
      setCompanies(res.data ?? []);
    } catch (err: unknown) {
      if (signal.aborted) return;
      const e = err as Error;
      setError(e.message || "Failed to load platform companies");
      toast.error(e.message || "Failed to load platform companies");
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [clearMessages, abortRead]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCompanies();
  }, [loadCompanies]);

  const openCreateModal = useCallback(() => {
    clearMessages();
    setEditingCompany(null);
    setIsModalOpen(true);
  }, [clearMessages]);

  const openEditModal = useCallback(
    (company: PlatformCompany) => {
      clearMessages();
      setEditingCompany(company);
      setIsModalOpen(true);
    },
    [clearMessages]
  );

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingCompany(null);
  }, []);

  const saveCompany = useCallback(
    async (formData: PlatformCompanyFormData, targetCompanyId?: number) => {
      setSaving(true);
      clearMessages();
      try {
        const idToUpdate = targetCompanyId ?? formData.company_id ?? editingCompany?.company_id ?? companies[0]?.company_id;
        const saved = await updatePlatformCompany(formData, idToUpdate);
        const msg = `Updated "${formData.company_name}" successfully.`;
        setSuccessMessage(msg);
        toast.success(msg);
        // The company row saved, but a value row beside it may not have. Without
        // this the admin is told only that everything saved.
        if (saved.warnings?.length) {
          toast.warning(saved.warnings.join(" "));
        }
        setIsModalOpen(false);
        setEditingCompany(null);
        await loadCompanies();
      } catch (err: unknown) {
        const e = err as Error;
        const msg = e.message || "Failed to save platform company details";
        setError(msg);
        toast.error(msg);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [editingCompany, companies, clearMessages, loadCompanies]
  );

  const handleSetPrimary = useCallback(
    async (company: PlatformCompany) => {
      clearMessages();
      try {
        await setPrimaryPlatformCompany(company.company_id);
        const msg = `Set "${company.company_name}" as the primary company.`;
        setSuccessMessage(msg);
        toast.success(msg);
        await loadCompanies();
      } catch (err: unknown) {
        const e = err as Error;
        const msg = e.message || "Failed to update primary company status";
        setError(msg);
        toast.error(msg);
      }
    },
    [clearMessages, loadCompanies]
  );

  const handleToggleActive = useCallback(
    async (company: PlatformCompany) => {
      clearMessages();
      const currentActive = Number(company.is_active) === 1 || company.is_active === true;
      const nextActive = !currentActive;
      try {
        await updatePlatformCompany(company.company_id, { is_active: nextActive ? 1 : 0 });
        const msg = `Company "${company.company_name}" is now ${nextActive ? "Active" : "Archived"}.`;
        setSuccessMessage(msg);
        toast.success(msg);
        await loadCompanies();
      } catch (err: unknown) {
        const e = err as Error;
        const msg = e.message || "Failed to update active status";
        setError(msg);
        toast.error(msg);
      }
    },
    [clearMessages, loadCompanies]
  );

  return {
    companies,
    loading,
    saving,
    error,
    successMessage,
    isModalOpen,
    editingCompany,
    loadCompanies,
    openCreateModal,
    openEditModal,
    closeModal,
    saveCompany,
    handleSetPrimary,
    handleToggleActive,
    clearMessages,
  };
}

// src/modules/client/company-profile/CompanyProfileModule.tsx
"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useCompanyProfile } from "./hooks/useCompanyProfile";
import { CompanyProfile, CompanyProfileMeta, VerificationStatus } from "./types";
import CompanyStatus from "./components/CompanyStatus";
import CompanyBasicInfo from "./components/CompanyBasicInfo";
import CompanyClassification from "./components/CompanyClassification";
import CompanyAddress from "./components/CompanyAddress";
import CompanyCompletionBar from "./components/CompanyCompletionBar";
import CompanyPreviewModal from "./components/CompanyPreviewModal";
import CompanyDocuments from "./components/CompanyDocuments";
import { SubmitVerificationModal } from "./components/SubmitVerificationModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  CheckCircle,
  Building,
  Layers,
  MapPin,
  ShieldCheck,
  Pencil,
  Globe,
  Loader2,
  Building2,
  Eye,
  Send,
  RefreshCw,
  FileText,
 
} from "lucide-react";
import AIProfileAssistantModal from "./components/AIProfileAssistantModal";
import { EditableCompanyFields } from "./types";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};


interface CompanyProfileModuleProps {
  initialCompany?: CompanyProfile | null;
  initialMeta?: CompanyProfileMeta | null;
  initialError?: string;
}

export default function CompanyProfileModule({
  initialCompany = null,
  initialMeta = null,
  initialError = "",
}: CompanyProfileModuleProps = {}) {
  const {
    company,
    meta,
    loading,
    saving,
    submitting,
    error,
    fetchProfile,
    updateProfile,
    createProfile,
    submitForVerification,
    clearMessages,
  } = useCompanyProfile(initialCompany, initialMeta, initialError);

  const isFirstMountRef = useRef(Boolean(initialCompany || initialError));

  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [uploadedDocsCount, setUploadedDocsCount] = useState(0);

  const handleDocsChange = useCallback((count: number) => {
    setUploadedDocsCount((prev) => (prev !== count ? count : prev));
  }, []);
  const [isEditingClassification, setIsEditingClassification] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [draft, setDraft] = useState<Partial<EditableCompanyFields & { custom_industry_name?: string }>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [activeProfileSection, setActiveProfileSection] = useState(0);

  const mobileSectionClass = (index: number) =>
    `max-md:order-2${activeProfileSection === index ? "" : " max-md:hidden"}`;

  const [setupForm, setSetupForm] = useState({
    company_name: "",
    company_legal_name: "",
    company_email: "",
    company_contact: "",
    company_description: "",
    registration_no: "",
    company_tin: "",
  });
  const [setupError, setSetupError] = useState("");

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError("");

    if (!setupForm.company_name.trim()) return setSetupError("Company display name is required.");
    if (!setupForm.company_legal_name.trim()) return setSetupError("Legal company name is required.");
    if (!setupForm.company_email.trim()) return setSetupError("Company email is required.");
    if (!setupForm.company_contact.trim()) return setSetupError("Company contact number is required.");

    const phoneRegex = /^(?:\+?\d{1,4}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,9}$/;
    if (!phoneRegex.test(setupForm.company_contact.trim())) {
      return setSetupError("Please enter a valid company contact phone number (e.g. +63 912 345 6789 or 09123456789).");
    }

    if (!setupForm.company_description.trim()) return setSetupError("Company description is required.");

    try {
      await createProfile(setupForm);
    } catch (err: unknown) {
      setSetupError(
        err instanceof Error ? err.message : "Failed to create company profile."
      );
    }
  };

  useEffect(() => {
    if (isFirstMountRef.current && (initialCompany || initialError)) {
      isFirstMountRef.current = false;
      return;
    }
    isFirstMountRef.current = false;
    fetchProfile();
  }, [fetchProfile, initialCompany, initialError]);

  const [infoErrors, setInfoErrors] = useState<Record<string, string>>({});
  const [classificationErrors, setClassificationErrors] = useState<Record<string, string>>({});

  const handleFieldChange = (
    field: keyof EditableCompanyFields | "custom_industry_name",
    value: string | number | boolean | null | undefined
  ) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    if (infoErrors[field]) {
      setInfoErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (classificationErrors[field]) {
      setClassificationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleApplyAISuggestions = async (acceptedFields: Partial<EditableCompanyFields>) => {
    clearMessages();
    // If currently editing, merge into draft state so user can review/edit further
    if (isEditingInfo || isEditingClassification) {
      setDraft((prev) => ({ ...prev, ...acceptedFields }));
    } else {
      // Direct save and reload
      await updateProfile(acceptedFields);
      await fetchProfile();
    }
  };

  // ── Company Information Handlers ──────────────────────────────────────
  const handleEditInfo = () => {
    if (company) {
      setDraft({
        company_name: company.company_name ?? "",
        company_legal_name: company.company_legal_name ?? "",
        company_email: company.company_email ?? "",
        company_contact: company.company_contact ?? "",
        company_website: company.company_website ?? "",
        company_description: company.company_description ?? "",
        company_mission: company.company_mission ?? "",
        company_vision: company.company_vision ?? "",
        company_culture: company.company_culture ?? "",
        company_benefits: company.company_benefits ?? "",
        company_logo: company.company_logo ?? "",
        company_cover: company.company_cover ?? "",
        company_facebook: company.company_facebook ?? "",
        company_linkedin: company.company_linkedin ?? "",
        company_instagram: company.company_instagram ?? "",
        company_x: company.company_x ?? "",
        company_youtube: company.company_youtube ?? "",
        registration_no: company.registration_no ?? "",
        company_tin: company.company_tin ?? "",
      });
    }
    setInfoErrors({});
    clearMessages();
    setIsEditingInfo(true);
  };

  const handleSaveInfo = async () => {
    clearMessages();

    // Client-side validation
    const errors: Record<string, string> = {};

    const name = (draft.company_name ?? "").trim();
    if (!name) {
      errors.company_name = "Company display name is required.";
    } else if (name.length < 2 || name.length > 100) {
      errors.company_name = "Display name must be between 2 and 100 characters.";
    }

    const legalName = (draft.company_legal_name ?? "").trim();
    if (!legalName) {
      errors.company_legal_name = "Legal company name is required.";
    } else if (legalName.length < 2 || legalName.length > 150) {
      errors.company_legal_name = "Legal name must be between 2 and 150 characters.";
    }

    const email = (draft.company_email ?? "").trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      errors.company_email = "Company email is required.";
    } else if (!emailRegex.test(email) || email.length > 100) {
      errors.company_email = "Please enter a valid company email address.";
    }

    const contact = (draft.company_contact ?? "").trim();
    const phoneRegex = /^(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,9}$/;
    if (!contact) {
      errors.company_contact = "Company contact number is required.";
    } else if (!phoneRegex.test(contact) || contact.length > 50) {
      errors.company_contact = "Please enter a valid phone number (e.g. 0912-345-6789 or +63 912 345 6789).";
    }

    const regNo = (draft.registration_no ?? "").trim();
    if (regNo && (regNo.length < 3 || regNo.length > 50)) {
      errors.registration_no = "Registration number must be between 3 and 50 characters.";
    }

    const tin = (draft.company_tin ?? "").trim();
    const tinRegex = /^\d{3}-?\d{3}-?\d{3}(-?\d{3})?$/;
    if (tin && (!tinRegex.test(tin) || tin.length > 20)) {
      errors.company_tin = "TIN must be 9–12 digits (e.g., 000-000-000-000 or 000123456000).";
    }

    const desc = (draft.company_description ?? "").trim();
    if (!desc) {
      errors.company_description = "Company description is required.";
    } else if (desc.length < 20 || desc.length > 2000) {
      errors.company_description = "Description must be between 20 and 2,000 characters.";
    }

    const mission = (draft.company_mission ?? "").trim();
    if (mission && mission.length > 1000) {
      errors.company_mission = "Mission statement cannot exceed 1,000 characters.";
    }

    const vision = (draft.company_vision ?? "").trim();
    if (vision && vision.length > 1000) {
      errors.company_vision = "Vision statement cannot exceed 1,000 characters.";
    }

    const culture = (draft.company_culture ?? "").trim();
    if (culture && culture.length > 1500) {
      errors.company_culture = "Culture text cannot exceed 1,500 characters.";
    }

    const benefits = (draft.company_benefits ?? "").trim();
    if (benefits && benefits.length > 1500) {
      errors.company_benefits = "Perks & benefits cannot exceed 1,500 characters.";
    }

    const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
    const urlFields: Array<{ key: keyof EditableCompanyFields; label: string }> = [
      { key: "company_website", label: "Company Website" },
      { key: "company_facebook", label: "Facebook URL" },
      { key: "company_linkedin", label: "LinkedIn URL" },
      { key: "company_instagram", label: "Instagram URL" },
      { key: "company_x", label: "𝕏 (Twitter) URL" },
      { key: "company_youtube", label: "YouTube URL" },
    ];

    for (const { key, label } of urlFields) {
      const val = (draft[key] as string ?? "").trim();
      if (val && (!urlRegex.test(val) || val.length > 500)) {
        errors[key] = `Please enter a valid URL for ${label}.`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setInfoErrors(errors);
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
      return;
    }

    setInfoErrors({});
    try {
      await updateProfile({
        company_name: draft.company_name?.trim(),
        company_legal_name: draft.company_legal_name?.trim(),
        company_email: draft.company_email?.trim(),
        company_contact: draft.company_contact?.trim(),
        company_website: draft.company_website?.trim() || null,
        company_description: draft.company_description?.trim(),
        company_mission: draft.company_mission?.trim() || null,
        company_vision: draft.company_vision?.trim() || null,
        company_culture: draft.company_culture?.trim() || null,
        company_benefits: draft.company_benefits?.trim() || null,
        company_logo: draft.company_logo || null,
        company_cover: draft.company_cover || null,
        company_facebook: draft.company_facebook?.trim() || null,
        company_linkedin: draft.company_linkedin?.trim() || null,
        company_instagram: draft.company_instagram?.trim() || null,
        company_x: draft.company_x?.trim() || null,
        company_youtube: draft.company_youtube?.trim() || null,
        registration_no: draft.registration_no?.trim() || null,
        company_tin: draft.company_tin?.trim() || null,
      });
      await fetchProfile();
      toast.success("Company profile updated successfully.");
      setIsEditingInfo(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update company profile.";
      toast.error(msg);
    }
  };

  const handleCancelInfo = () => {
    setIsEditingInfo(false);
    setDraft({});
    setInfoErrors({});
    clearMessages();
  };

  // ── Company Classification Handlers ──────────────────────────────────
  const handleEditClassification = () => {
    if (company) {
      setDraft({
        industry_id: company.industry_id ?? null,
        organization_type_id: company.organization_type_id ?? null,
        company_size_id: company.company_size_id ?? null,
        year_established: company.year_established ?? null,
        company_tags: company.company_tags ?? "",
      });
    }
    setClassificationErrors({});
    clearMessages();
    setIsEditingClassification(true);
  };

  const handleSaveClassification = async () => {
    clearMessages();

    // Validation
    const classErrors: Record<string, string> = {};
    const tags = (draft.company_tags ?? "").trim();
    if (tags.length > 255) {
      classErrors.company_tags = "Company tags cannot exceed 255 characters.";
    }

    if (draft.year_established !== undefined && draft.year_established !== null && (draft.year_established as unknown) !== "") {
      const year = Number(draft.year_established);
      const currentYear = new Date().getFullYear();
      if (isNaN(year) || year < 1800 || year > currentYear + 1) {
        classErrors.year_established = `Year must be between 1800 and ${currentYear + 1}.`;
      }
    }

    if (Object.keys(classErrors).length > 0) {
      setClassificationErrors(classErrors);
      const firstErr = Object.values(classErrors)[0];
      toast.error(firstErr);
      return;
    }

    setClassificationErrors({});
    let targetIndustryId: number | string | null | undefined = draft.industry_id;

    if (
      draft.industry_id === "OTHERS" ||
      String(draft.industry_id).toUpperCase() === "OTHERS"
    ) {
      const customName = draft.custom_industry_name?.trim();
      if (customName) {
        try {
          const res = await fetch("/api/client/company-profile?directusCollection=vs_industry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ industry_name: customName }),
          });
          const json = await res.json();
          if (res.ok && (json.data?.industry_id || json.industry_id)) {
            targetIndustryId = Number(json.data?.industry_id ?? json.industry_id);
          }
        } catch (err) {
          console.error("Error creating custom industry:", err);
        }
      }
    } else if (draft.industry_id) {
      targetIndustryId = Number(draft.industry_id);
    }

    try {
      await updateProfile({
        industry_id: targetIndustryId as number | null,
        organization_type_id: draft.organization_type_id ? Number(draft.organization_type_id) : null,
        company_size_id: draft.company_size_id ? Number(draft.company_size_id) : null,
        year_established: draft.year_established ? Number(draft.year_established) : null,
        company_tags: tags || null,
      });

      await fetchProfile();
      toast.success("Company classification updated successfully.");
      setIsEditingClassification(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update classification.";
      toast.error(msg);
    }
  };

  const handleCancelClassification = () => {
    setIsEditingClassification(false);
    setDraft({});
    setClassificationErrors({});
    clearMessages();
  };

  // ── Company Address Handlers ──────────────────────────────────────────
  const handleEditAddress = () => {
    if (company) {
      setDraft({
        company_province: company.company_province ?? "",
        company_city: company.company_city ?? "",
        company_brgy: company.company_brgy ?? "",
        company_address: company.company_address ?? "",
        company_zipCode: company.company_zipCode ?? "",
      });
    }
    clearMessages();
    setIsEditingAddress(true);
  };

  const handleSaveAddress = async () => {
    clearMessages();
    try {
      await updateProfile({
        company_province: draft.company_province,
        company_city: draft.company_city,
        company_brgy: draft.company_brgy,
        company_address: draft.company_address,
        company_zipCode: draft.company_zipCode,
      });
      await fetchProfile();
      toast.success("Company address updated successfully.");
      setIsEditingAddress(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update company address.";
      toast.error(msg);
    }
  };

  const handleCancelAddress = () => {
    setIsEditingAddress(false);
    setDraft({});
    clearMessages();
  };

  // ── Submit / Resubmit Handler ─────────────────────────────────────────
  const handleConfirmSubmitForVerification = async () => {
    clearMessages();
    try {
      await submitForVerification();
      setIsSubmitModalOpen(false);
      toast.success(
        isResubmission
          ? "Company profile resubmitted for verification successfully."
          : "Company profile submitted for verification successfully."
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to submit company profile.";
      toast.error(msg);
    }
  };

  // ── Derived State ─────────────────────────────────────────────────────
  const completionPercent = company?.profile_completion_percent ?? 0;
  const verificationStatus = company?.verification_status;
  const needsRevision = company?.verification_workflow_status === "CORRECTION_REQUIRED";
  const isResubmission = needsRevision || verificationStatus === "REJECTED";
  const displayStatus: VerificationStatus = needsRevision
    ? "CORRECTION_REQUIRED"
    : verificationStatus || "DRAFT";

  const missingSections = useMemo(() => {
    if (!company) return [];
    const missing: string[] = [];
    if (!company.industry_id || !company.organization_type_id || !company.company_size_id) {
      missing.push("Classification");
    }
    const hasSocial = [
      company.company_facebook,
      company.company_linkedin,
      company.company_instagram,
      company.company_x,
      company.company_youtube,
    ].some((s) => s && String(s).trim().length > 0);
    if (!hasSocial) {
      missing.push("Social Links");
    }
    if (!company.company_province || !company.company_city || !company.company_address) {
      missing.push("Address");
    }
    if (!company.company_logo || !company.company_cover) {
      missing.push("Branding Media");
    }
    if (!company.registration_no && !company.company_tin) {
      missing.push("Registration / TIN");
    }
    return missing;
  }, [company]);

  const canSubmit =
    completionPercent >= 80 &&
    uploadedDocsCount > 0 &&
    (verificationStatus === "DRAFT" ||
      verificationStatus === "REJECTED" ||
      needsRevision);

  const isOwnerOrAdmin =
    meta?.company_user_role === "OWNER" || meta?.company_user_role === "ADMIN";

  const displayDataInfo = isEditingInfo ? draft : (company ?? {});
  const displayDataClassification = isEditingClassification ? draft : (company ?? {});
  const displayDataAddress = isEditingAddress ? draft : (company ?? {});

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60dvh] gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-zinc-500 font-medium animate-pulse text-sm">
          Loading company profile...
        </p>
      </div>
    );
  }

  // ── Onboarding: No company linked ────────────────────────────────────
  if (!loading && !company && error) {
    if (error === "No company associated with this account.") {
      return (
        <div className="max-w-2xl mx-auto py-8">
          <Card className="border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl">
            <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <CardHeader className="pt-8 pb-6 px-8 text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mb-2">
                <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center justify-center gap-2">
               Welcome to VOS Sync!
              </CardTitle>
              <p className="text-sm text-zinc-550 dark:text-zinc-400 max-w-md mx-auto">
                Let&apos;s set up your company profile to start posting job listings, managing applications, and onboarding talent.
              </p>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <form onSubmit={handleSetupSubmit} className="space-y-6">
                {setupError && (
                  <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 rounded-xl text-rose-700 dark:text-rose-300 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {setupError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="setup-name" className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Company Display Name <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="setup-name"
                      value={setupForm.company_name}
                      onChange={(e) => setSetupForm((prev) => ({ ...prev, company_name: e.target.value }))}
                      placeholder="e.g. Acme Corporation"
                      className="h-10 md:text-sm max-md:h-10 max-md:text-base border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-lg"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="setup-legal-name" className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Legal Company Name <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="setup-legal-name"
                      value={setupForm.company_legal_name}
                      onChange={(e) => setSetupForm((prev) => ({ ...prev, company_legal_name: e.target.value }))}
                      placeholder="e.g. Acme Corp. Ltd"
                      className="h-10 md:text-sm max-md:h-10 max-md:text-base border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-lg"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="setup-email" className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Company Email <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="setup-email"
                      type="email"
                      value={setupForm.company_email}
                      onChange={(e) => setSetupForm((prev) => ({ ...prev, company_email: e.target.value }))}
                      placeholder="hr@acme.com"
                      className="h-10 md:text-sm max-md:h-10 max-md:text-base border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-lg"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="setup-contact" className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Company Contact <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="setup-contact"
                      value={setupForm.company_contact}
                      onChange={(e) => setSetupForm((prev) => ({ ...prev, company_contact: e.target.value }))}
                      placeholder="09XXXXXXXXX"
                      className="h-10 md:text-sm max-md:h-10 max-md:text-base border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-lg"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="setup-reg" className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Registration Number <span className="text-zinc-400">(Optional)</span>
                    </Label>
                    <Input
                      id="setup-reg"
                      value={setupForm.registration_no}
                      onChange={(e) => setSetupForm((prev) => ({ ...prev, registration_no: e.target.value }))}
                      placeholder="e.g. SEC-123456"
                      className="h-10 md:text-sm max-md:h-10 max-md:text-base border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="setup-tin" className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      TIN <span className="text-zinc-400">(Optional)</span>
                    </Label>
                    <Input
                      id="setup-tin"
                      value={setupForm.company_tin}
                      onChange={(e) => setSetupForm((prev) => ({ ...prev, company_tin: e.target.value }))}
                      placeholder="e.g. 000-123-456-000"
                      className="h-10 md:text-sm max-md:h-10 max-md:text-base border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setup-desc" className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Company Description <span className="text-rose-500">*</span>
                  </Label>
                  <Textarea
                    id="setup-desc"
                    value={setupForm.company_description}
                    onChange={(e) => setSetupForm((prev) => ({ ...prev, company_description: e.target.value }))}
                    rows={4}
                    placeholder="Provide a brief description of your company, core business, and culture..."
                    className="md:text-sm max-md:text-base border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-lg resize-none"
                    required
                  />
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Setting Up Profile...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Complete Company Setup
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <Card className="border-rose-100 shadow-md">
          <CardContent className="p-6 space-y-4">
            <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Unable to Load Profile
            </h3>
            <p className="text-sm text-zinc-500">{error}</p>
            <Button onClick={fetchProfile} className="w-full max-md:min-h-10">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-4 md:space-y-6"
    >


      {/* Cards Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* ── Left Column ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Company Information */}
          <motion.div variants={itemVariants}>
            <Card className="rounded-2xl border border-primary/10 bg-card/80 backdrop-blur-xl shadow-sm hover:border-primary/20 transition-colors gap-0 py-0 overflow-hidden">
              <CardHeader className="border-b border-border/60 px-6 py-4 bg-muted/30 flex flex-row justify-between items-center">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wider">
                    Company Information
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {isOwnerOrAdmin && isEditingInfo && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 max-md:min-h-10 text-xs font-semibold text-primary bg-primary/10 border-primary/20 hover:bg-primary/15 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs"
                      onClick={() => setShowAIAssistant(true)}
                    >
                      <span>AI Assistant</span>
                    </Button>
                  )}
                  {isOwnerOrAdmin && !isEditingInfo && (
                    <Button variant="ghost" size="sm" className="h-8 max-md:size-10 text-primary font-medium hover:bg-primary/10 transition-colors" onClick={handleEditInfo}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <AnimatePresence mode="wait">
                  {isEditingInfo ? (
                    <motion.div
                      key="editing-info"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="space-y-6"
                    >
                      <CompanyBasicInfo
                        data={displayDataInfo}
                        onChange={handleFieldChange}
                        fieldErrors={infoErrors}
                        readOnly={false}
                      />
                      <div className="flex justify-end gap-3 pt-6 border-t border-border/60 mt-6">
                        <Button variant="outline" size="sm" onClick={handleCancelInfo} disabled={saving} className="h-9 max-md:min-h-10 px-5 text-sm rounded-xl">
                          Cancel
                        </Button>
                        <Button onClick={handleSaveInfo} size="sm" disabled={saving} className="h-9 max-md:min-h-10 px-6 text-sm rounded-xl bg-gradient-to-r from-primary to-info hover:brightness-110 text-primary-foreground border-0 shadow-sm transition-transform active:scale-[0.98]">
                          {saving ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="view-info"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <CompanyBasicInfo
                        data={company ?? {}}
                        onChange={() => {}}
                        readOnly={true}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 2: Company Classification */}
          <motion.div variants={itemVariants}>
            <Card className="rounded-2xl border border-primary/10 bg-card/80 backdrop-blur-xl shadow-sm hover:border-primary/20 transition-colors py-0 gap-0 overflow-hidden">
              <CardHeader className="border-b border-border/60 px-6 py-4 bg-muted/30 flex flex-row justify-between items-center">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wider">
                    Company Classification
                  </CardTitle>
                </div>
                {isOwnerOrAdmin && !isEditingClassification && (
                  <Button variant="ghost" size="sm" className="h-8 max-md:size-10 text-primary font-medium hover:bg-primary/10 transition-colors" onClick={handleEditClassification}>
                    <Pencil />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-6">
                <AnimatePresence mode="wait">
                  {isEditingClassification ? (
                    <motion.div
                      key="editing-class"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="space-y-6"
                    >
                      <CompanyClassification
                        data={displayDataClassification}
                        onChange={handleFieldChange}
                        fieldErrors={classificationErrors}
                        readOnly={false}
                      />
                      <div className="flex justify-end gap-3 pt-6 border-t border-border/60 mt-6">
                        <Button variant="outline" size="sm" onClick={handleCancelClassification} disabled={saving} className="h-9 max-md:min-h-10 px-5 text-sm rounded-xl">
                          Cancel
                        </Button>
                        <Button onClick={handleSaveClassification} size="sm" disabled={saving} className="h-9 max-md:min-h-10 px-6 text-sm rounded-xl bg-gradient-to-r from-primary to-info hover:brightness-110 text-primary-foreground border-0 shadow-sm transition-transform active:scale-[0.98]">
                          {saving ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="view-class"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <CompanyClassification
                        data={company ?? {}}
                        onChange={() => {}}
                        readOnly={true}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 3: Company Address */}
          <motion.div variants={itemVariants}>
            <Card className="rounded-2xl border border-primary/10 bg-card/80 backdrop-blur-xl shadow-sm hover:border-primary/20 transition-colors py-0 gap-0 overflow-hidden">
              <CardHeader className="border-b border-border/60 px-6 py-4 bg-muted/30 flex flex-row justify-between items-center">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wider">
                    Company Address
                  </CardTitle>
                </div>
                {isOwnerOrAdmin && !isEditingAddress && (
                  <Button variant="ghost" size="sm" className="h-8 max-md:size-10 text-primary font-medium hover:bg-primary/10 transition-colors" onClick={handleEditAddress}>
                    <Pencil />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-6">
                <AnimatePresence mode="wait">
                  {isEditingAddress ? (
                    <motion.div
                      key="editing-addr"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="space-y-6"
                    >
                      <CompanyAddress
                        data={displayDataAddress}
                        onChange={handleFieldChange}
                        readOnly={false}
                      />
                      <div className="flex justify-end gap-3 pt-6 border-t border-border/60 mt-6">
                        <Button variant="outline" size="sm" onClick={handleCancelAddress} disabled={saving} className="h-9 max-md:min-h-10 px-5 text-sm rounded-xl">
                          Cancel
                        </Button>
                        <Button onClick={handleSaveAddress} size="sm" disabled={saving} className="h-9 max-md:min-h-10 px-6 text-sm rounded-xl bg-gradient-to-r from-primary to-info hover:brightness-110 text-primary-foreground border-0 shadow-sm transition-transform active:scale-[0.98]">
                          {saving ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="view-addr"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Province</span>
                          <p className="text-sm font-medium text-foreground">{company?.company_province || "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">City / Municipality</span>
                          <p className="text-sm font-medium text-foreground">{company?.company_city || "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Barangay</span>
                          <p className="text-sm font-medium text-foreground">{company?.company_brgy || "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Zip Code</span>
                          <p className="text-sm font-medium text-foreground">{company?.company_zipCode || "—"}</p>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-border/60 space-y-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Street Address</span>
                        <p className="text-sm font-medium text-foreground">{company?.company_address || "—"}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ── Right Column ─────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6 max-md:flex max-md:flex-col lg:sticky lg:top-24">
          {/* Mobile-only section tabs (desktop keeps every section stacked) */}
          <div className="md:hidden max-md:order-1 flex items-center gap-1 rounded-xl border bg-card p-1">
            {["Profile Status", "Documents", "Public Profile"].map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => setActiveProfileSection(i)}
                className={`flex-1 min-h-10 rounded-lg px-2 py-1 text-[11px] leading-tight text-center font-medium transition-colors ${activeProfileSection === i ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Profile Completion */}
          <motion.div variants={itemVariants} className={mobileSectionClass(0)}>
            <Card className="rounded-2xl border border-primary/10 bg-card/80 backdrop-blur-xl shadow-sm hover:border-primary/20 transition-colors py-0 gap-0 overflow-hidden">
              <CardContent className="p-6">
                <CompanyCompletionBar percent={completionPercent} missingSections={missingSections} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Verification Status */}
          {company?.verification_status && (
            <motion.div variants={itemVariants} className={mobileSectionClass(0)}>
              <Card className="rounded-2xl border border-primary/10 bg-card/80 backdrop-blur-xl shadow-sm hover:border-primary/20 transition-colors py-0 gap-0 overflow-hidden">
                <CardHeader className="border-b border-border/60 px-6 py-4 bg-muted/30 flex flex-row items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wider">
                    Verification Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <CompanyStatus
                    status={displayStatus}
                    remarks={company.rejection_reason || company.verification_remarks}
                    publicRejectionReason={company.public_rejection_reason || company.rejection_reason || company.verification_remarks}
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Verification Documents */}
          <motion.div variants={itemVariants} className={mobileSectionClass(1)}>
            <Card className="rounded-2xl border border-primary/10 bg-card/80 backdrop-blur-xl shadow-sm hover:border-primary/20 transition-colors py-0 gap-0 overflow-hidden">
              <CardHeader className="border-b border-border/60 px-6 py-4 bg-muted/30 flex flex-row items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Verification Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <CompanyDocuments
                  companyId={company?.company_id}
                  verificationStatus={displayStatus}
                  onDocsChange={handleDocsChange}
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Submit / Resubmit for Verification */}
          {isOwnerOrAdmin &&
            (verificationStatus === "DRAFT" ||
              verificationStatus === "REJECTED" ||
              needsRevision) && (
              <motion.div variants={itemVariants} className="max-md:order-3">
                <Card className="rounded-2xl border border-primary/10 bg-card/80 backdrop-blur-xl shadow-sm hover:border-primary/20 transition-colors py-0 gap-0 overflow-hidden">
                  <CardHeader className="border-b border-border/60 px-6 py-4 bg-muted/30 flex flex-row items-center gap-2">
                    <Send className="h-5 w-5 text-primary" />
                    <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wider">
                      {isResubmission ? "Resubmit Profile" : "Submit for Verification"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    {!canSubmit && (
                      <p className="text-sm md:text-xs text-muted-foreground leading-relaxed">
                        Your profile must be at least{" "}
                        <span className="font-semibold text-foreground">80% complete</span>,
                        include a company logo, and have at least{" "}
                        <span className="font-semibold text-foreground">one verification document uploaded</span>
                        {" "}before you can submit for verification. Currently at <span className="font-semibold text-foreground">{Math.round(completionPercent)}%</span> with <span className="font-semibold text-foreground">{uploadedDocsCount} documents</span> uploaded.
                      </p>
                    )}
                    {canSubmit && isResubmission && (
                      <p className="text-sm md:text-xs text-warning leading-relaxed bg-warning/10 p-3 rounded-lg border border-warning/20">
                        Please review the reviewer feedback above, make the necessary corrections, then resubmit.
                      </p>
                    )}
                    <Button
                      onClick={() => setIsSubmitModalOpen(true)}
                      disabled={!canSubmit || submitting}
                      className="w-full h-10 max-md:min-h-10 text-sm font-semibold rounded-xl bg-gradient-to-r from-primary to-info hover:brightness-110 text-primary-foreground border-0 shadow-sm disabled:opacity-50 transition-transform active:scale-[0.98]"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Submitting...
                        </>
                      ) : isResubmission ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Resubmit for Verification
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Submit for Verification
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

          {/* Preview Public Profile */}
          {company && (
            <motion.div variants={itemVariants} className={mobileSectionClass(2)}>
              <Card className="rounded-2xl border border-primary/10 bg-card/80 backdrop-blur-xl shadow-sm hover:border-primary/20 transition-colors py-0 gap-0 overflow-hidden">
                <CardHeader className="border-b border-border/60 px-6 py-4 bg-muted/30 flex flex-row items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wider">
                    Public Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  <p className="text-sm md:text-xs text-muted-foreground leading-relaxed">
                    Preview how job seekers will see your company profile once it goes public.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setShowPreview(true)}
                    className="w-full h-9 max-md:min-h-10 text-sm rounded-xl font-medium transition-colors hover:border-primary/50"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview Public Profile
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Public Visibility */}
          <motion.div variants={itemVariants} className={mobileSectionClass(2)}>
            <Card className="shadow-sm border bg-card rounded-xl py-0 gap-0 overflow-hidden">
              <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/10 flex flex-row items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                  Public Visibility
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {company?.is_public ? "Public Profile" : "Private Profile"}
                    </p>
                    <p className="text-sm md:text-xs text-zinc-500 mt-0.5">
                      {company?.is_public
                        ? "Searchable by job seekers and visible on postings."
                        : "Only visible to authorized organization users."}
                    </p>
                  </div>
                  {isOwnerOrAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={async () => {
                        clearMessages();
                        const nextVal = company?.is_public ? 0 : 1;
                        await updateProfile({ is_public: nextVal });
                      }}
                      className="h-9 max-md:min-h-10 px-4 text-xs font-semibold rounded-xl transition-colors hover:border-primary/50"
                    >
                      Change Visibility
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Preview Modal */}
      {company && (
        <CompanyPreviewModal
          open={showPreview}
          onClose={() => setShowPreview(false)}
          company={company}
        />
      )}

      {/* AI Profile Assistant Modal */}
      {company && (
        <AIProfileAssistantModal
          open={showAIAssistant}
          onOpenChange={setShowAIAssistant}
          currentCompany={company}
          onApplySuggestions={handleApplyAISuggestions}
        />
      )}

      {/* Submit / Resubmit Confirmation Modal */}
      <SubmitVerificationModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirm={handleConfirmSubmitForVerification}
        isSubmitting={submitting}
        isResubmission={isResubmission}
        companyName={company?.company_name}
        completionPercent={completionPercent}
        uploadedDocsCount={uploadedDocsCount}
      />
    </motion.div>
  );
}


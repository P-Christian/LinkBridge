"use client";

import React, { useState, useRef, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { formatAssetUrl } from "@/lib/utils";
import {
  PlatformCompany,
  PlatformCompanyFormData,
  PlatformCompanyValue,
} from "../types/platformCompany.types";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Building2,
  FileText,
  Share2,
  Settings,
  HeartHandshake,
  ShieldCheck,
  Zap,
  Award,
  Users,
  Star,
  Globe,
  Clock,
  Sparkles,
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Target,
  UploadCloud,
  RotateCcw,
  Check,
} from "lucide-react";

interface SinglePlatformCompanyEditorProps {
  company: PlatformCompany;
  onSave: (data: PlatformCompanyFormData) => Promise<void>;
  saving: boolean;
}

const AVAILABLE_ICONS = [
  { label: "Heart Handshake", value: "HeartHandshake", icon: HeartHandshake },
  { label: "Shield Check", value: "ShieldCheck", icon: ShieldCheck },
  { label: "Zap (Speed)", value: "Zap", icon: Zap },
  { label: "Award (Quality)", value: "Award", icon: Award },
  { label: "Users (Community)", value: "Users", icon: Users },
  { label: "Star (Excellence)", value: "Star", icon: Star },
  { label: "Globe (Global)", value: "Globe", icon: Globe },
  { label: "Target (Precision)", value: "Target", icon: Target },
  { label: "Sparkles (Innovation)", value: "Sparkles", icon: Sparkles },
  { label: "Briefcase (Work)", value: "Briefcase", icon: Briefcase },
  { label: "Building (Enterprise)", value: "Building2", icon: Building2 },
];

const COLOR_THEMES = [
  { label: "Blue", value: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { label: "Emerald", value: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  { label: "Amber", value: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { label: "Purple", value: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { label: "Rose", value: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
  { label: "Sky", value: "bg-sky-500/10 text-sky-500 border-sky-500/20" },
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB size limit
const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
];

export const isUploadedIcon = (iconStr?: string | null): boolean => {
  if (!iconStr) return false;
  return (
    iconStr.startsWith("http://") ||
    iconStr.startsWith("https://") ||
    iconStr.startsWith("/api/assets/") ||
    iconStr.startsWith("/") ||
    iconStr.startsWith("data:") ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(iconStr)
  );
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_CHARS_REGEX = /[^0-9+\s\-()]/g;

function extractInitialValues(company: PlatformCompany): PlatformCompanyValue[] {
  const normalize = (v: PlatformCompanyValue, idx: number): PlatformCompanyValue => ({
    id: v.id,
    company_id: v.company_id,
    title: (v.title || `Core Value #${idx + 1}`).slice(0, 50),
    description: (v.description || v.desc || "").slice(0, 200),
    desc: (v.description || v.desc || "").slice(0, 200),
    icon_name: v.icon_name || (typeof v.icon === "string" ? v.icon : "HeartHandshake"),
    icon: v.icon_name || (typeof v.icon === "string" ? v.icon : "HeartHandshake"),
    color: v.color || COLOR_THEMES[idx % COLOR_THEMES.length].value,
    display_order: typeof v.display_order === "number" ? v.display_order : idx + 1,
    is_active: v.is_active !== false && Number(v.is_active) !== 0,
  });

  if (Array.isArray(company.values) && company.values.length > 0) {
    return company.values.slice(0, 4).map(normalize);
  }
  const metaValues = (company.metadata as Record<string, unknown> | null)?.values;
  if (Array.isArray(metaValues) && metaValues.length > 0) {
    return (metaValues as PlatformCompanyValue[]).slice(0, 4).map(normalize);
  }
  return [
    {
      title: "People First",
      description: "We put job seekers and employers at the center of every product decision we make.",
      desc: "We put job seekers and employers at the center of every product decision we make.",
      icon_name: "HeartHandshake",
      icon: "HeartHandshake",
      color: "bg-rose-500/10 text-rose-500 border-rose-500/20",
      display_order: 1,
      is_active: true,
    },
    {
      title: "Trust & Safety",
      description: "Every listing is verified. We work hard to keep our platform free from scams and bad actors.",
      desc: "Every listing is verified. We work hard to keep our platform free from scams and bad actors.",
      icon_name: "ShieldCheck",
      icon: "ShieldCheck",
      color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      display_order: 2,
      is_active: true,
    },
    {
      title: "Speed Matters",
      description: "Hiring moves fast. Our platform is designed to match candidates and companies in days, not months.",
      desc: "Hiring moves fast. Our platform is designed to match candidates and companies in days, not months.",
      icon_name: "Zap",
      icon: "Zap",
      color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      display_order: 3,
      is_active: true,
    },
    {
      title: "Quality over Quantity",
      description: "Smart role matching means fewer irrelevant applications and higher placement satisfaction.",
      desc: "Smart role matching means fewer irrelevant applications and higher placement satisfaction.",
      icon_name: "Award",
      icon: "Award",
      color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      display_order: 4,
      is_active: true,
    },
  ];
}

const CharCounter = ({ current = 0, max }: { current?: number; max: number }) => {
  const isNear = current > max * 0.85;
  const isMax = current >= max;
  return (
    <span
      className={`text-[10px] font-mono transition-colors ${
        isMax ? "text-destructive font-semibold" : isNear ? "text-amber-500" : "text-muted-foreground"
      }`}
    >
      {current}/{max}
    </span>
  );
};

export function SinglePlatformCompanyEditor({
  company,
  onSave,
  saving,
}: SinglePlatformCompanyEditorProps) {
  const [formData, setFormData] = useState<PlatformCompanyFormData>({
    slug: company.slug || "vos-sync",
    company_code: company.company_code || "VTC",
    company_name: company.company_name || "VOS Sync",
    company_legal_name: company.company_legal_name || "Vertex Technologies Corporation",
    platform_name:
      company.platform_name ||
      ((company.metadata as Record<string, unknown> | null)?.platform_name as string) ||
      "VOS Sync",
    platform_icon:
      company.platform_icon ||
      ((company.metadata as Record<string, unknown> | null)?.platform_icon as string) ||
      "Briefcase",
    support_hours_days:
      company.support_hours_days ||
      ((company.metadata as Record<string, unknown> | null)?.support_hours_days as string) ||
      "Mon–Fri",
    support_hours_time:
      company.support_hours_time ||
      ((company.metadata as Record<string, unknown> | null)?.support_hours_time as string) ||
      "8am–5pm",
    support_hours_timezone:
      company.support_hours_timezone ||
      ((company.metadata as Record<string, unknown> | null)?.support_hours_timezone as string) ||
      "Philippine Time (PHT)",
    company_tagline: company.company_tagline || "Where Lines Meet.",
    year_established: company.year_established ?? 2024,
    organization_type_id: company.organization_type_id ?? null,
    industry_id: company.industry_id ?? null,
    company_size_id: company.company_size_id ?? null,
    company_address: company.company_address || "Gonzales Street",
    company_brgy: company.company_brgy || "Bonuan Boquig",
    company_city: company.company_city || "Dagupan",
    company_province: company.company_province || "Pangasinan",
    company_country: company.company_country || "PH",
    company_zipCode: company.company_zipCode || "2400",
    map_embed_url: company.map_embed_url || "",
    registration_no: company.registration_no || "",
    company_tin: company.company_tin || "",
    company_contact: company.company_contact || "+639451232521",
    company_email: company.company_email || "contact@vosync.com",
    support_email: company.support_email || "support@vosync.com",
    company_website: company.company_website || "www.vosync.com",
    company_logo: company.company_logo || "",
    company_cover: company.company_cover || "",
    company_facebook: company.company_facebook || "",
    company_linkedin: company.company_linkedin || "",
    company_instagram: company.company_instagram || "",
    company_x: company.company_x || "",
    company_youtube: company.company_youtube || "",
    company_short_description: company.company_short_description || "",
    company_description: company.company_description || "",
    company_mission: company.company_mission || "",
    company_vision: company.company_vision || "",
    company_culture: company.company_culture || "",
    company_benefits: company.company_benefits || "",
    company_tags: company.company_tags || "",
    metadata: company.metadata ?? null,
    is_primary: 1,
    is_active: 1,
    display_order: 1,
  });

  const [valuesList, setValuesList] = useState<PlatformCompanyValue[]>(() =>
    extractInitialValues(company)
  );

  const [metadataJsonText, setMetadataJsonText] = useState<string>(() =>
    company.metadata ? JSON.stringify(company.metadata, null, 2) : ""
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("identity");

  // React recommended render-phase state sync when prop changes (prevents effect cascading render)
  const [prevCompany, setPrevCompany] = useState<PlatformCompany>(company);
  if (company !== prevCompany) {
    setPrevCompany(company);
    setFormData((prev) => ({
      ...prev,
      slug: company.slug || prev.slug,
      company_code: company.company_code || prev.company_code,
      company_name: company.company_name || prev.company_name,
      company_legal_name: company.company_legal_name || prev.company_legal_name,
      platform_name:
        company.platform_name ||
        ((company.metadata as Record<string, unknown> | null)?.platform_name as string) ||
        prev.platform_name,
      platform_icon:
        company.platform_icon ||
        ((company.metadata as Record<string, unknown> | null)?.platform_icon as string) ||
        prev.platform_icon,
      support_hours_days:
        company.support_hours_days ||
        ((company.metadata as Record<string, unknown> | null)?.support_hours_days as string) ||
        prev.support_hours_days,
      support_hours_time:
        company.support_hours_time ||
        ((company.metadata as Record<string, unknown> | null)?.support_hours_time as string) ||
        prev.support_hours_time,
      support_hours_timezone:
        company.support_hours_timezone ||
        ((company.metadata as Record<string, unknown> | null)?.support_hours_timezone as string) ||
        prev.support_hours_timezone,
      company_tagline: company.company_tagline ?? prev.company_tagline,
      year_established: company.year_established ?? prev.year_established,
      company_address: company.company_address ?? prev.company_address,
      company_brgy: company.company_brgy ?? prev.company_brgy,
      company_city: company.company_city ?? prev.company_city,
      company_province: company.company_province ?? prev.company_province,
      company_country: company.company_country || prev.company_country,
      company_zipCode: company.company_zipCode ?? prev.company_zipCode,
      map_embed_url: company.map_embed_url ?? prev.map_embed_url,
      registration_no: company.registration_no ?? prev.registration_no,
      company_tin: company.company_tin ?? prev.company_tin,
      company_contact: company.company_contact || prev.company_contact,
      company_email: company.company_email || prev.company_email,
      support_email: company.support_email ?? prev.support_email,
      company_website: company.company_website ?? prev.company_website,
      company_logo: company.company_logo ?? prev.company_logo,
      company_cover: company.company_cover ?? prev.company_cover,
      company_facebook: company.company_facebook ?? prev.company_facebook,
      company_linkedin: company.company_linkedin ?? prev.company_linkedin,
      company_instagram: company.company_instagram ?? prev.company_instagram,
      company_x: company.company_x ?? prev.company_x,
      company_youtube: company.company_youtube ?? prev.company_youtube,
      company_short_description: company.company_short_description ?? prev.company_short_description,
      company_description: company.company_description ?? prev.company_description,
      company_mission: company.company_mission ?? prev.company_mission,
      company_vision: company.company_vision ?? prev.company_vision,
      company_culture: company.company_culture ?? prev.company_culture,
      company_benefits: company.company_benefits ?? prev.company_benefits,
      company_tags: company.company_tags ?? prev.company_tags,
    }));
    setValuesList(extractInitialValues(company));
    setMetadataJsonText(company.metadata ? JSON.stringify(company.metadata, null, 2) : "");
  }

  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [uploadingBrandIcon, setUploadingBrandIcon] = useState<boolean>(false);
  const brandIconInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: keyof PlatformCompanyFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const MAX_VALUES = 4;
  const isMaxValues = valuesList.length >= MAX_VALUES;

  // Real-time metadata JSON validity check
  const isMetadataValid = useMemo(() => {
    if (!metadataJsonText.trim()) return true;
    try {
      JSON.parse(metadataJsonText);
      return true;
    } catch {
      return false;
    }
  }, [metadataJsonText]);

  const handleBeautifyJson = () => {
    if (!metadataJsonText.trim()) return;
    try {
      const parsed = JSON.parse(metadataJsonText);
      setMetadataJsonText(JSON.stringify(parsed, null, 2));
      toast.success("Metadata JSON formatted successfully.");
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(`Invalid JSON syntax: ${err.message}`);
    }
  };

  const handleAddValue = () => {
    if (valuesList.length >= MAX_VALUES) return;
    setValuesList((prev) => [
      ...prev,
      {
        title: "New Company Value",
        description: "Description of this organizational value and how it impacts work.",
        desc: "Description of this organizational value and how it impacts work.",
        icon_name: "HeartHandshake",
        icon: "HeartHandshake",
        color: COLOR_THEMES[prev.length % COLOR_THEMES.length].value,
        display_order: prev.length + 1,
        is_active: true,
      },
    ]);
    toast.success("Value card added.");
  };

  const handleUpdateValue = (index: number, updates: Partial<PlatformCompanyValue>) => {
    setValuesList((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleRemoveValue = (index: number) => {
    setValuesList((prev) => prev.filter((_, i) => i !== index));
    toast.info("Value card removed.");
  };

  // Safe file upload validation for Core Values Icon
  const handleUploadValueIcon = async (idx: number, file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      const msg = "Invalid format. Please upload PNG, JPG, WEBP, or SVG.";
      setValidationError(msg);
      toast.error(msg);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      const msg = "Image file size exceeds the 5MB limit.";
      setValidationError(msg);
      toast.error(msg);
      return;
    }

    setUploadingIdx(idx);
    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
      const res = await fetch("/api/vos-admin/platform-company/upload", {
        method: "POST",
        body: uploadData,
      });
      if (!res.ok) {
        throw new Error("Failed to upload image.");
      }
      const json = await res.json();
      const fileUrl = json.file_url || `/api/assets/${json.file_id}`;
      handleUpdateValue(idx, {
        icon_name: fileUrl,
        icon: fileUrl,
      });
      setValidationError(null);
      toast.success("Value card icon uploaded successfully.");
    } catch (err: unknown) {
      const e = err as Error;
      const msg = e.message || "Failed to upload image icon.";
      setValidationError(msg);
      toast.error(msg);
    } finally {
      setUploadingIdx(null);
    }
  };

  // Safe file upload validation for Platform Brand Icon
  const handleBrandIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      const msg = "Invalid format. Please upload PNG, JPG, WEBP, or SVG.";
      setValidationError(msg);
      toast.error(msg);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      const msg = "Image file size exceeds the 5MB limit.";
      setValidationError(msg);
      toast.error(msg);
      return;
    }

    setUploadingBrandIcon(true);
    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
      const res = await fetch("/api/vos-admin/platform-company/upload", {
        method: "POST",
        body: uploadData,
      });
      if (!res.ok) {
        throw new Error("Failed to upload brand image icon.");
      }
      const json = await res.json();
      const fileUrl = json.file_url || `/api/assets/${json.file_id}`;
      handleChange("platform_icon", fileUrl);
      setValidationError(null);
      toast.success("Brand icon uploaded successfully.");
    } catch (err: unknown) {
      const e = err as Error;
      const msg = e.message || "Failed to upload brand icon.";
      setValidationError(msg);
      toast.error(msg);
    } finally {
      setUploadingBrandIcon(false);
      if (brandIconInputRef.current) brandIconInputRef.current.value = "";
    }
  };

  // Form submit with comprehensive validation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Identity validation
    if (!formData.company_name?.trim()) {
      const msg = "Company Display Name is required.";
      setValidationError(msg);
      toast.error(msg);
      setActiveTab("identity");
      return;
    }
    if (formData.company_name.trim().length > 100) {
      const msg = "Company Display Name cannot exceed 100 characters.";
      setValidationError(msg);
      toast.error(msg);
      setActiveTab("identity");
      return;
    }

    if (!formData.company_legal_name?.trim()) {
      const msg = "Legal Registered Name is required.";
      setValidationError(msg);
      toast.error(msg);
      setActiveTab("identity");
      return;
    }
    if (formData.company_legal_name.trim().length > 150) {
      const msg = "Legal Registered Name cannot exceed 150 characters.";
      setValidationError(msg);
      toast.error(msg);
      setActiveTab("identity");
      return;
    }

    if (!formData.company_code?.trim()) {
      const msg = "Company Code is required.";
      setValidationError(msg);
      toast.error(msg);
      setActiveTab("identity");
      return;
    }
    if (formData.company_code.trim().length < 2 || formData.company_code.trim().length > 10) {
      const msg = "Company Code must be between 2 and 10 alphanumeric characters.";
      setValidationError(msg);
      toast.error(msg);
      setActiveTab("identity");
      return;
    }

    if (!formData.slug?.trim()) {
      const msg = "Routing Slug is required.";
      setValidationError(msg);
      toast.error(msg);
      setActiveTab("identity");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug.trim())) {
      const msg = "Routing Slug must contain only lowercase letters, numbers, and single hyphens.";
      setValidationError(msg);
      toast.error(msg);
      setActiveTab("identity");
      return;
    }

    if (formData.year_established) {
      const currentYear = new Date().getFullYear();
      if (formData.year_established < 1800 || formData.year_established > currentYear) {
        const msg = `Year Established must be between 1800 and ${currentYear}.`;
        setValidationError(msg);
        toast.error(msg);
        setActiveTab("identity");
        return;
      }
    }

    // Contact & Support validation
    if (!formData.company_email?.trim()) {
      const msg = "General Inquiries Email is required.";
      setValidationError(msg);
      toast.error(msg);
      setActiveTab("contact");
      return;
    }
    if (!EMAIL_REGEX.test(formData.company_email.trim())) {
      const msg = "Please enter a valid General Email address (e.g. name@domain.com).";
      setValidationError(msg);
      toast.error(msg);
      setActiveTab("contact");
      return;
    }

    if (formData.support_email?.trim() && !EMAIL_REGEX.test(formData.support_email.trim())) {
      const msg = "Please enter a valid Customer Support Email address.";
      setValidationError(msg);
      toast.error(msg);
      setActiveTab("contact");
      return;
    }

    if (!formData.company_contact?.trim()) {
      const msg = "Primary Contact Number is required.";
      setValidationError(msg);
      toast.error(msg);
      setActiveTab("contact");
      return;
    }
    const contactDigits = formData.company_contact.replace(/\D/g, "");
    if (contactDigits.length < 7 || formData.company_contact.length > 20) {
      const msg = "Primary Contact Number must contain at least 7 digits (max 20 chars).";
      setValidationError(msg);
      toast.error(msg);
      setActiveTab("contact");
      return;
    }

    if (formData.map_embed_url?.trim() && !/^https?:\/\//i.test(formData.map_embed_url.trim())) {
      const msg = "Google Maps Embed URL must begin with https://";
      setValidationError(msg);
      toast.error(msg);
      setActiveTab("contact");
      return;
    }

    // Core Values validation
    for (let i = 0; i < valuesList.length; i++) {
      const v = valuesList[i];
      if (!v.title?.trim()) {
        const msg = `Core Value #${i + 1} requires a Title.`;
        setValidationError(msg);
        toast.error(msg);
        setActiveTab("values");
        return;
      }
    }

    // Metadata JSON validation
    let parsedMetadata: Record<string, unknown> = {};
    if (metadataJsonText.trim()) {
      try {
        parsedMetadata = JSON.parse(metadataJsonText);
      } catch {
        const msg = "Invalid JSON syntax in Metadata. Please correct errors before saving.";
        setValidationError(msg);
        toast.error(msg);
        setActiveTab("settings");
        return;
      }
    } else if (formData.metadata && typeof formData.metadata === "object") {
      parsedMetadata = { ...formData.metadata };
    }

    const finalValues = valuesList.slice(0, MAX_VALUES).map((v, i) => ({
      ...v,
      company_id: company.company_id,
      title: v.title.trim().slice(0, 50),
      description: (v.description || v.desc || "").trim().slice(0, 200),
      desc: (v.description || v.desc || "").trim().slice(0, 200),
      icon_name: v.icon_name || (typeof v.icon === "string" ? v.icon : "HeartHandshake"),
      icon: v.icon_name || (typeof v.icon === "string" ? v.icon : "HeartHandshake"),
      display_order: typeof v.display_order === "number" ? v.display_order : i + 1,
    }));

    parsedMetadata.values = finalValues;
    parsedMetadata.platform_name = formData.platform_name?.trim() || "VOS Sync";
    parsedMetadata.platform_icon = formData.platform_icon?.trim() || "Briefcase";
    parsedMetadata.support_hours_days = formData.support_hours_days?.trim() || "Mon–Fri";
    parsedMetadata.support_hours_time = formData.support_hours_time?.trim() || "8am–5pm";
    parsedMetadata.support_hours_timezone = formData.support_hours_timezone?.trim() || "Philippine Time (PHT)";

    const payload: PlatformCompanyFormData = {
      ...formData,
      company_id: company.company_id,
      company_name: formData.company_name.trim(),
      company_legal_name: formData.company_legal_name.trim(),
      company_code: formData.company_code.trim(),
      slug: formData.slug.trim(),
      company_email: formData.company_email.trim(),
      support_email: formData.support_email?.trim() || "",
      company_contact: formData.company_contact.trim(),
      values: finalValues,
      metadata: parsedMetadata,
      is_primary: 1,
      is_active: 1,
      display_order: 1,
    };

    await onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Animated Validation Error Banner */}
      <AnimatePresence>
        {validationError && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/25 text-destructive text-xs flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-medium">{validationError}</span>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => setValidationError(null)}
                className="text-[11px] underline hover:no-underline font-semibold cursor-pointer shrink-0"
              >
                Dismiss
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Tabs Container */}
      <div className="bg-card/70 border border-primary/10 rounded-3xl p-4 sm:p-6 backdrop-blur-xl shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto p-1 bg-muted/40 rounded-2xl border border-border/40 gap-1">
            <TabsTrigger
              value="identity"
              className="text-xs rounded-xl gap-2 py-2.5 transition-all cursor-pointer active:scale-95 data-[state=active]:shadow-sm"
            >
              <Building2 className="h-3.5 w-3.5" /> Identity & Brand
            </TabsTrigger>
            <TabsTrigger
              value="contact"
              className="text-xs rounded-xl gap-2 py-2.5 transition-all cursor-pointer active:scale-95 data-[state=active]:shadow-sm"
            >
              <Clock className="h-3.5 w-3.5" /> Support & Contact
            </TabsTrigger>
            <TabsTrigger
              value="story"
              className="text-xs rounded-xl gap-2 py-2.5 transition-all cursor-pointer active:scale-95 data-[state=active]:shadow-sm"
            >
              <FileText className="h-3.5 w-3.5" /> Story & Copy
            </TabsTrigger>
            <TabsTrigger
              value="values"
              className="text-xs rounded-xl gap-2 py-2.5 transition-all cursor-pointer active:scale-95 data-[state=active]:shadow-sm"
            >
              <HeartHandshake className="h-3.5 w-3.5" /> Core Values
            </TabsTrigger>
            <TabsTrigger
              value="media"
              className="text-xs rounded-xl gap-2 py-2.5 transition-all cursor-pointer active:scale-95 data-[state=active]:shadow-sm"
            >
              <Share2 className="h-3.5 w-3.5" /> Media & Social
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="text-xs rounded-xl gap-2 py-2.5 transition-all cursor-pointer active:scale-95 data-[state=active]:shadow-sm"
            >
              <Settings className="h-3.5 w-3.5" /> Metadata
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: BRANDING & IDENTITY */}
          <TabsContent value="identity" className="space-y-5 m-0 pt-2">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
                  <Sparkles className="h-4 w-4" /> Platform Branding Header & Navigation
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Platform Brand Name</Label>
                      <CharCounter current={formData.platform_name?.length || 0} max={60} />
                    </div>
                    <Input
                      maxLength={60}
                      value={formData.platform_name || ""}
                      onChange={(e) => handleChange("platform_name", e.target.value)}
                      placeholder="e.g. VOS Sync"
                      className="rounded-xl h-10 text-xs transition-all"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Displayed in top navigation header, footer brand, and page titles.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Platform Brand Icon (Max 5MB)</Label>
                      {isUploadedIcon(formData.platform_icon) && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          type="button"
                          onClick={() => {
                            handleChange("platform_icon", "Briefcase");
                            toast.info("Reset brand icon to standard Briefcase.");
                          }}
                          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" /> Reset to standard
                        </motion.button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isUploadedIcon(formData.platform_icon) ? (
                        <div className="h-10 w-10 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center overflow-hidden p-1.5 shrink-0">
                          <Image
                            src={formatAssetUrl(formData.platform_icon) || formData.platform_icon!}
                            alt="Brand icon"
                            width={32}
                            height={32}
                            className="h-7 w-7 object-contain"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <Input
                          maxLength={40}
                          value={formData.platform_icon || ""}
                          onChange={(e) => handleChange("platform_icon", e.target.value)}
                          placeholder="e.g. Briefcase"
                          className="rounded-xl h-10 text-xs flex-1 transition-all"
                        />
                      )}
                      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingBrandIcon}
                          onClick={() => brandIconInputRef.current?.click()}
                          className="rounded-xl h-10 px-3 text-xs gap-1.5 shrink-0 cursor-pointer shadow-sm"
                        >
                          {uploadingBrandIcon ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UploadCloud className="h-3.5 w-3.5" />
                          )}
                          {isUploadedIcon(formData.platform_icon) ? "Change Image" : "Upload Image"}
                        </Button>
                      </motion.div>
                      <input
                        ref={brandIconInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={handleBrandIconUpload}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Upload image (PNG, JPG, SVG, WEBP up to 5MB) or specify a Lucide icon identifier.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Company Display Name *</Label>
                    <CharCounter current={formData.company_name?.length || 0} max={100} />
                  </div>
                  <Input
                    maxLength={100}
                    value={formData.company_name}
                    onChange={(e) => handleChange("company_name", e.target.value)}
                    placeholder="e.g. Vertex Technologies Corporation"
                    className="rounded-xl h-10 text-xs transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Legal Registered Business Name *</Label>
                    <CharCounter current={formData.company_legal_name?.length || 0} max={150} />
                  </div>
                  <Input
                    maxLength={150}
                    value={formData.company_legal_name}
                    onChange={(e) => handleChange("company_legal_name", e.target.value)}
                    placeholder="Full legal entity name on corporate registrations"
                    className="rounded-xl h-10 text-xs transition-all"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Company Code *</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">UPPERCASE</span>
                  </div>
                  <Input
                    maxLength={10}
                    value={formData.company_code}
                    onChange={(e) => {
                      const uppercaseVal = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
                      handleChange("company_code", uppercaseVal);
                    }}
                    placeholder="e.g. VTC"
                    className="rounded-xl h-10 text-xs font-mono uppercase transition-all"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">Alphanumeric identifier (2-10 characters).</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Routing Slug *</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">kebab-case</span>
                  </div>
                  <Input
                    maxLength={60}
                    value={formData.slug}
                    onChange={(e) => {
                      const slugVal = e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "")
                        .replace(/--+/g, "-")
                        .slice(0, 60);
                      handleChange("slug", slugVal);
                    }}
                    placeholder="e.g. vertex-technologies"
                    className="rounded-xl h-10 text-xs font-mono transition-all"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">URL slug (lowercase letters, numbers, hyphens).</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Year Established</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={formData.year_established ?? ""}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                      handleChange("year_established", digits ? parseInt(digits, 10) : null);
                    }}
                    placeholder="e.g. 2024"
                    className="rounded-xl h-10 text-xs transition-all font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">4-digit founding year (1800–{new Date().getFullYear()}).</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Hero Tagline / Punchy Slogan</Label>
                  <CharCounter current={formData.company_tagline?.length || 0} max={160} />
                </div>
                <Input
                  maxLength={160}
                  value={formData.company_tagline || ""}
                  onChange={(e) => handleChange("company_tagline", e.target.value)}
                  placeholder="e.g. Where Lines Meet."
                  className="rounded-xl h-10 text-xs transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Short Introduction</Label>
                  <CharCounter current={formData.company_short_description?.length || 0} max={300} />
                </div>
                <Textarea
                  maxLength={300}
                  value={formData.company_short_description || ""}
                  onChange={(e) => handleChange("company_short_description", e.target.value)}
                  placeholder="Brief introductory summary powering landing page cards and search previews..."
                  className="rounded-xl text-xs resize-none h-20 transition-all"
                />
              </div>
            </motion.div>
          </TabsContent>

          {/* TAB 2: SUPPORT & CONTACT */}
          <TabsContent value="contact" className="space-y-5 m-0 pt-2">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="p-4 rounded-2xl bg-info/5 border border-info/20 space-y-4">
                <div className="flex items-center gap-2 text-info font-semibold text-xs uppercase tracking-wider">
                  <Clock className="h-4 w-4" /> Customer Support Operating Hours (Contact Us Page)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Operating Days</Label>
                    <Input
                      maxLength={50}
                      value={formData.support_hours_days || ""}
                      onChange={(e) => handleChange("support_hours_days", e.target.value)}
                      placeholder="e.g. Mon–Fri"
                      className="rounded-xl h-10 text-xs transition-all"
                    />
                    <p className="text-[11px] text-muted-foreground">Days when support staff is active.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Daily Operating Hours</Label>
                    <Input
                      maxLength={50}
                      value={formData.support_hours_time || ""}
                      onChange={(e) => handleChange("support_hours_time", e.target.value)}
                      placeholder="e.g. 8am–5pm"
                      className="rounded-xl h-10 text-xs transition-all"
                    />
                    <p className="text-[11px] text-muted-foreground">Office hours window.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Timezone Designation</Label>
                    <Input
                      maxLength={50}
                      value={formData.support_hours_timezone || ""}
                      onChange={(e) => handleChange("support_hours_timezone", e.target.value)}
                      placeholder="e.g. Philippine Time (PHT)"
                      className="rounded-xl h-10 text-xs transition-all"
                    />
                    <p className="text-[11px] text-muted-foreground">Timezone descriptor for visitors.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">General Inquiries Email *</Label>
                    {formData.company_email && !EMAIL_REGEX.test(formData.company_email) && (
                      <span className="text-[10px] text-destructive">Invalid email format</span>
                    )}
                  </div>
                  <Input
                    type="email"
                    maxLength={100}
                    value={formData.company_email}
                    onChange={(e) => handleChange("company_email", e.target.value.trim())}
                    placeholder="e.g. contact@vosync.com"
                    className="rounded-xl h-10 text-xs transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Dedicated Customer Support Email</Label>
                    {formData.support_email && !EMAIL_REGEX.test(formData.support_email) && (
                      <span className="text-[10px] text-destructive">Invalid email format</span>
                    )}
                  </div>
                  <Input
                    type="email"
                    maxLength={100}
                    value={formData.support_email || ""}
                    onChange={(e) => handleChange("support_email", e.target.value.trim())}
                    placeholder="e.g. support@vosync.com"
                    className="rounded-xl h-10 text-xs transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Primary Contact Phone / Mobile *</Label>
                    <CharCounter current={formData.company_contact?.length || 0} max={20} />
                  </div>
                  <Input
                    maxLength={20}
                    value={formData.company_contact}
                    onChange={(e) => {
                      const cleanPhone = e.target.value.replace(PHONE_CHARS_REGEX, "").slice(0, 20);
                      handleChange("company_contact", cleanPhone);
                    }}
                    placeholder="e.g. +63 945 123 2521"
                    className="rounded-xl h-10 text-xs transition-all font-mono"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">Supports +, digits, hyphens, and spaces.</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Official Website</Label>
                    <CharCounter current={formData.company_website?.length || 0} max={255} />
                  </div>
                  <Input
                    maxLength={255}
                    value={formData.company_website || ""}
                    onChange={(e) => handleChange("company_website", e.target.value.trim())}
                    placeholder="e.g. https://www.vosync.com"
                    className="rounded-xl h-10 text-xs transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Physical Street Address</Label>
                  <CharCounter current={formData.company_address?.length || 0} max={150} />
                </div>
                <Input
                  maxLength={150}
                  value={formData.company_address || ""}
                  onChange={(e) => handleChange("company_address", e.target.value)}
                  placeholder="e.g. Gonzales Street"
                  className="rounded-xl h-10 text-xs transition-all"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Barangay</Label>
                  <Input
                    maxLength={100}
                    value={formData.company_brgy || ""}
                    onChange={(e) => handleChange("company_brgy", e.target.value)}
                    placeholder="e.g. Bonuan Boquig"
                    className="rounded-xl h-10 text-xs transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">City / Municipality</Label>
                  <Input
                    maxLength={100}
                    value={formData.company_city || ""}
                    onChange={(e) => handleChange("company_city", e.target.value)}
                    placeholder="e.g. Dagupan"
                    className="rounded-xl h-10 text-xs transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Province / State</Label>
                  <Input
                    maxLength={100}
                    value={formData.company_province || ""}
                    onChange={(e) => handleChange("company_province", e.target.value)}
                    placeholder="e.g. Pangasinan"
                    className="rounded-xl h-10 text-xs transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">ZIP Code</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">4 digits</span>
                  </div>
                  <Input
                    inputMode="numeric"
                    maxLength={4}
                    value={formData.company_zipCode || ""}
                    onChange={(e) => {
                      const zipVal = e.target.value.replace(/\D/g, "").slice(0, 4);
                      handleChange("company_zipCode", zipVal);
                    }}
                    placeholder="e.g. 2400"
                    className="rounded-xl h-10 text-xs font-mono transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">SEC / DTI Registration No.</Label>
                  <Input
                    maxLength={50}
                    value={formData.registration_no || ""}
                    onChange={(e) => handleChange("registration_no", e.target.value)}
                    placeholder="Registration number"
                    className="rounded-xl h-10 text-xs transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Tax Identification Number (TIN)</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">000-000-000-000</span>
                  </div>
                  <Input
                    maxLength={16}
                    value={formData.company_tin || ""}
                    onChange={(e) => {
                      const rawDigits = e.target.value.replace(/\D/g, "").slice(0, 12);
                      const parts: string[] = [];
                      for (let i = 0; i < rawDigits.length; i += 3) {
                        parts.push(rawDigits.slice(i, i + 3));
                      }
                      handleChange("company_tin", parts.join("-"));
                    }}
                    placeholder="000-000-000-000"
                    className="rounded-xl h-10 text-xs font-mono transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Google Maps Embed URL</Label>
                  <CharCounter current={formData.map_embed_url?.length || 0} max={1000} />
                </div>
                <Input
                  maxLength={1000}
                  value={formData.map_embed_url || ""}
                  onChange={(e) => handleChange("map_embed_url", e.target.value.trim())}
                  placeholder="https://www.google.com/maps/embed?..."
                  className="rounded-xl h-10 text-xs transition-all"
                />
              </div>
            </motion.div>
          </TabsContent>

          {/* TAB 3: STORY & NARRATIVE */}
          <TabsContent value="story" className="space-y-5 m-0 pt-2">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Comprehensive Company Narrative</Label>
                  <CharCounter current={formData.company_description?.length || 0} max={2000} />
                </div>
                <Textarea
                  maxLength={2000}
                  value={formData.company_description || ""}
                  onChange={(e) => handleChange("company_description", e.target.value)}
                  placeholder="Detailed narrative detailing platform journey, scope, and background..."
                  className="rounded-xl text-xs min-h-[90px] transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Mission Statement (About Us)</Label>
                    <CharCounter current={formData.company_mission?.length || 0} max={500} />
                  </div>
                  <Textarea
                    maxLength={500}
                    value={formData.company_mission || ""}
                    onChange={(e) => handleChange("company_mission", e.target.value)}
                    placeholder="e.g. To connect people and opportunities through technology that inspires growth."
                    className="rounded-xl text-xs min-h-[80px] transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Vision Statement (About Us)</Label>
                    <CharCounter current={formData.company_vision?.length || 0} max={500} />
                  </div>
                  <Textarea
                    maxLength={500}
                    value={formData.company_vision || ""}
                    onChange={(e) => handleChange("company_vision", e.target.value)}
                    placeholder="e.g. A future where connections inspire progress and everyone has the opportunity to grow."
                    className="rounded-xl text-xs min-h-[80px] transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Our Culture (About Us Highlight Card)</Label>
                    <CharCounter current={formData.company_culture?.length || 0} max={800} />
                  </div>
                  <Textarea
                    maxLength={800}
                    value={formData.company_culture || ""}
                    onChange={(e) => handleChange("company_culture", e.target.value)}
                    placeholder="Workplace culture, principles, and team ethos..."
                    className="rounded-xl text-xs min-h-[80px] transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Platform Benefits (About Us Highlight Card)</Label>
                    <CharCounter current={formData.company_benefits?.length || 0} max={800} />
                  </div>
                  <Textarea
                    maxLength={800}
                    value={formData.company_benefits || ""}
                    onChange={(e) => handleChange("company_benefits", e.target.value)}
                    placeholder="Key platform perks and organizational advantages..."
                    className="rounded-xl text-xs min-h-[80px] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Mission Checkpoints & Badges (Comma-separated)</Label>
                  <CharCounter current={formData.company_tags?.length || 0} max={250} />
                </div>
                <Input
                  maxLength={250}
                  value={formData.company_tags || ""}
                  onChange={(e) => handleChange("company_tags", e.target.value)}
                  placeholder="Verified employers, Authentic job listings, AI-assisted talent matching, Transparent salary ranges"
                  className="rounded-xl h-10 text-xs transition-all"
                />
                <p className="text-[11px] text-muted-foreground">
                  Items separated by commas will be rendered as checkmarked badges under Our Mission.
                </p>
              </div>
            </motion.div>
          </TabsContent>

          {/* TAB 4: CORE VALUES (DYNAMIC CMS) */}
          <TabsContent value="values" className="space-y-5 m-0 pt-2">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <HeartHandshake className="h-4 w-4 text-primary" /> What Guides Our Work (Core Values)
                    </h3>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {valuesList.length} / {MAX_VALUES}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manage up to 4 core value cards rendered on the About Us page grid.
                  </p>
                </div>
                <motion.div whileHover={{ scale: isMaxValues ? 1 : 1.04 }} whileTap={{ scale: isMaxValues ? 1 : 0.96 }}>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddValue}
                    disabled={isMaxValues}
                    className="rounded-full bg-primary text-primary-foreground text-xs gap-1.5 shrink-0 disabled:opacity-50 disabled:pointer-events-none cursor-pointer shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" /> {isMaxValues ? "Max 4 Reached" : "Add Value Card"}
                  </Button>
                </motion.div>
              </div>

              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {valuesList.map((val, idx) => (
                    <motion.div
                      key={val.id || idx}
                      layout
                      initial={{ opacity: 0, y: 14, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96, y: -10, transition: { duration: 0.2 } }}
                      transition={{ duration: 0.25 }}
                      className="p-4 sm:p-5 rounded-2xl border border-primary/15 bg-card/90 space-y-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
                        <span className="text-xs font-bold text-foreground">Value #{idx + 1}</span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`val-active-${idx}`} className="text-xs text-muted-foreground cursor-pointer">
                              {val.is_active !== false ? "Active" : "Hidden"}
                            </Label>
                            <Switch
                              id={`val-active-${idx}`}
                              checked={val.is_active !== false}
                              onCheckedChange={(checked) => handleUpdateValue(idx, { is_active: checked })}
                            />
                          </div>
                          <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveValue(idx)}
                              className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0 rounded-xl cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5 sm:col-span-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">Title *</Label>
                            <CharCounter current={val.title?.length || 0} max={50} />
                          </div>
                          <Input
                            maxLength={50}
                            value={val.title}
                            onChange={(e) => handleUpdateValue(idx, { title: e.target.value })}
                            placeholder="e.g. People First"
                            className="rounded-xl h-9 text-xs transition-all"
                            required
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">Icon (Max 5MB)</Label>
                            {isUploadedIcon(val.icon_name || val.icon) && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                type="button"
                                onClick={() => {
                                  handleUpdateValue(idx, {
                                    icon_name: "HeartHandshake",
                                    icon: "HeartHandshake",
                                  });
                                  toast.info("Reset icon to standard HeartHandshake.");
                                }}
                                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 cursor-pointer transition-colors"
                              >
                                <RotateCcw className="h-2.5 w-2.5" /> Standard
                              </motion.button>
                            )}
                          </div>

                          {isUploadedIcon(val.icon_name || val.icon) ? (
                            <div className="flex items-center gap-2">
                              <div className="h-9 w-9 rounded-xl border border-primary/20 bg-muted/40 flex items-center justify-center overflow-hidden p-1 shrink-0">
                                <Image
                                  src={
                                    formatAssetUrl(val.icon_name || val.icon) ||
                                    (val.icon_name || val.icon)!
                                  }
                                  alt={val.title}
                                  width={28}
                                  height={28}
                                  className="h-7 w-7 object-contain"
                                  unoptimized
                                />
                              </div>
                              <label className="flex-1 cursor-pointer">
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleUploadValueIcon(idx, f);
                                  }}
                                />
                                <motion.div
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className="h-9 px-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 flex items-center justify-center gap-1.5 text-xs text-primary transition-colors"
                                >
                                  {uploadingIdx === idx ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      <span>Uploading...</span>
                                    </>
                                  ) : (
                                    <>
                                      <UploadCloud className="h-3.5 w-3.5" />
                                      <span>Change Image</span>
                                    </>
                                  )}
                                </motion.div>
                              </label>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <select
                                value={val.icon_name || val.icon || "HeartHandshake"}
                                onChange={(e) =>
                                  handleUpdateValue(idx, {
                                    icon_name: e.target.value,
                                    icon: e.target.value,
                                  })
                                }
                                className="flex-1 h-9 rounded-xl border border-primary/15 bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                              >
                                {AVAILABLE_ICONS.map((ic) => (
                                  <option key={ic.value} value={ic.value}>
                                    {ic.label}
                                  </option>
                                ))}
                              </select>
                              <label className="cursor-pointer shrink-0">
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleUploadValueIcon(idx, f);
                                  }}
                                />
                                <motion.div
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  title="Upload custom image (Max 5MB)"
                                  className="h-9 px-2.5 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 flex items-center justify-center gap-1 text-xs text-primary transition-colors cursor-pointer"
                                >
                                  {uploadingIdx === idx ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <UploadCloud className="h-3.5 w-3.5" />
                                      <span className="hidden xl:inline text-[11px]">Upload</span>
                                    </>
                                  )}
                                </motion.div>
                              </label>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5 sm:col-span-1">
                          <Label className="text-xs font-medium">Color Tone</Label>
                          <select
                            value={val.color || COLOR_THEMES[0].value}
                            onChange={(e) => handleUpdateValue(idx, { color: e.target.value })}
                            className="w-full h-9 rounded-xl border border-primary/15 bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                          >
                            {COLOR_THEMES.map((theme) => (
                              <option key={theme.label} value={theme.value}>
                                {theme.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium">Description</Label>
                          <CharCounter current={(val.description || val.desc || "").length} max={200} />
                        </div>
                        <Textarea
                          maxLength={200}
                          value={val.description || val.desc || ""}
                          onChange={(e) =>
                            handleUpdateValue(idx, {
                              description: e.target.value,
                              desc: e.target.value,
                            })
                          }
                          placeholder="Value impact narrative..."
                          className="rounded-xl text-xs min-h-[60px] transition-all"
                        />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          </TabsContent>

          {/* TAB 5: MEDIA & SOCIAL */}
          <TabsContent value="media" className="space-y-5 m-0 pt-2">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Primary Logo Asset Path / URL</Label>
                    <CharCounter current={formData.company_logo?.length || 0} max={500} />
                  </div>
                  <Input
                    maxLength={500}
                    value={formData.company_logo || ""}
                    onChange={(e) => handleChange("company_logo", e.target.value.trim())}
                    placeholder="https://... or /logo.png"
                    className="rounded-xl h-10 text-xs transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Hero Banner / Cover Image URL</Label>
                    <CharCounter current={formData.company_cover?.length || 0} max={500} />
                  </div>
                  <Input
                    maxLength={500}
                    value={formData.company_cover || ""}
                    onChange={(e) => handleChange("company_cover", e.target.value.trim())}
                    placeholder="https://... or /cover.jpg"
                    className="rounded-xl h-10 text-xs transition-all"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Label className="text-xs font-bold text-foreground">Official Social Media Profiles</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">LinkedIn</Label>
                      <CharCounter current={formData.company_linkedin?.length || 0} max={255} />
                    </div>
                    <Input
                      maxLength={255}
                      value={formData.company_linkedin || ""}
                      onChange={(e) => handleChange("company_linkedin", e.target.value.trim())}
                      placeholder="https://linkedin.com/company/..."
                      className="rounded-xl h-10 text-xs transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Facebook</Label>
                      <CharCounter current={formData.company_facebook?.length || 0} max={255} />
                    </div>
                    <Input
                      maxLength={255}
                      value={formData.company_facebook || ""}
                      onChange={(e) => handleChange("company_facebook", e.target.value.trim())}
                      placeholder="https://facebook.com/..."
                      className="rounded-xl h-10 text-xs transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Instagram</Label>
                      <CharCounter current={formData.company_instagram?.length || 0} max={255} />
                    </div>
                    <Input
                      maxLength={255}
                      value={formData.company_instagram || ""}
                      onChange={(e) => handleChange("company_instagram", e.target.value.trim())}
                      placeholder="https://instagram.com/..."
                      className="rounded-xl h-10 text-xs transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">X / Twitter</Label>
                      <CharCounter current={formData.company_x?.length || 0} max={255} />
                    </div>
                    <Input
                      maxLength={255}
                      value={formData.company_x || ""}
                      onChange={(e) => handleChange("company_x", e.target.value.trim())}
                      placeholder="https://x.com/..."
                      className="rounded-xl h-10 text-xs transition-all"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">YouTube</Label>
                      <CharCounter current={formData.company_youtube?.length || 0} max={255} />
                    </div>
                    <Input
                      maxLength={255}
                      value={formData.company_youtube || ""}
                      onChange={(e) => handleChange("company_youtube", e.target.value.trim())}
                      placeholder="https://youtube.com/@..."
                      className="rounded-xl h-10 text-xs transition-all"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </TabsContent>

          {/* TAB 6: METADATA */}
          <TabsContent value="settings" className="space-y-4 m-0 pt-2">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-medium">Raw Extensible JSON Metadata</Label>
                    {isMetadataValid ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <Check className="h-3 w-3" /> Valid JSON
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20 font-medium">
                        <AlertCircle className="h-3 w-3" /> Syntax Error
                      </span>
                    )}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={handleBeautifyJson}
                    className="text-xs px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" /> Format JSON
                  </motion.button>
                </div>
                <Textarea
                  value={metadataJsonText}
                  onChange={(e) => setMetadataJsonText(e.target.value)}
                  placeholder='{\n  "stats": [\n    { "label": "Talent Community", "value": "20,000+" }\n  ]\n}'
                  className={`font-mono text-xs min-h-[220px] rounded-xl transition-all ${
                    !isMetadataValid ? "border-destructive/60 focus-visible:ring-destructive/30" : ""
                  }`}
                />
                <p className="text-[11px] text-muted-foreground">
                  Directly stores customizable metrics (stats, milestones, SEO attributes). Core Values and Support Hours are automatically synchronized here.
                </p>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom Save Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-card/80 border border-primary/10 rounded-2xl backdrop-blur-xl shadow-sm">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>Updates immediately power landing pages, About Us, and Contact sections.</span>
        </div>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full sm:w-auto">
          <Button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto rounded-full bg-gradient-to-r from-primary to-info text-primary-foreground font-semibold px-6 shadow-md hover:brightness-110 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving Changes...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" /> Save Platform Changes
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </form>
  );
}

export default SinglePlatformCompanyEditor;

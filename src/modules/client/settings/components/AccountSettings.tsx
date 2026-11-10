"use client";

// src/modules/client/settings/components/AccountSettings.tsx

import React, { useMemo, useState, useRef, useEffect } from "react";
import Image from "next/image";
import { UserProfile } from "../types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";

import {
  fetchProvinces,
  fetchCities,
  fetchBarangays,
  PsgcItem,
} from "@/lib/psgc";
import {
  CONTACT_MAX_LENGTH,
  caretForDigitCount,
  formatContactInput,
  validatePhContact,
} from "@/lib/phone";

import {
  Loader2,
  User,
  Mail,
  Phone,
  Briefcase,
  CheckCircle,
  Camera,
  MapPin,
  Calendar,
  Heart,
  Trash2,
} from "lucide-react";
import ImageCropModal from "../../company-profile/components/ImageCropModal";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CIVIL_STATUS_OPTIONS = [
  { value: "unspecified", label: "Select Status" },
  { value: "Single", label: "Single" },
  { value: "Married", label: "Married" },
  { value: "Widowed", label: "Widowed" },
  { value: "Separated", label: "Separated" },
  { value: "Divorced", label: "Divorced" },
];

interface AccountSettingsProps {
  user: UserProfile | null;
  saving: boolean;
  onSave: (data: Partial<UserProfile>) => Promise<boolean>;
}

// Fields tracked for the dirty state (profile_image_url saves immediately
// from the photo flow and user_email is read-only, so both are excluded).
const EDITABLE_FIELDS = [
  "user_fname",
  "user_mname",
  "user_lname",
  "suffix_name",
  "nickname",
  "user_contact",
  "user_position",
  "user_province",
  "user_city",
  "user_brgy",
  "gender",
  "user_bday",
  "civil_status",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

function getImageUrl(val?: string | null): string {
  if (!val) return "";
  if (val.startsWith("http://") || val.startsWith("https://") || val.startsWith("data:")) return val;
  return `/api/client/assets/${val}`;
}

function getInitials(fname?: string, lname?: string): string {
  const f = fname?.[0] ?? "";
  const l = lname?.[0] ?? "";
  return (f + l).toUpperCase() || "U";
}

export default function AccountSettings({
  user,
  saving,
  onSave,
}: AccountSettingsProps) {
  const [overrides, setOverrides] = useState<Partial<UserProfile>>({});

  // Image crop & upload state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [confirmRemovePhoto, setConfirmRemovePhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Contact number validation
  const [contactError, setContactError] = useState<string | null>(null);

  // PSGC address cascade
  const [provinces, setProvinces] = useState<PsgcItem[]>([]);
  const [cities, setCities] = useState<PsgcItem[]>([]);
  const [barangays, setBarangays] = useState<PsgcItem[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  const formData = useMemo(
    () => ({
      user_fname: overrides.user_fname ?? user?.user_fname ?? "",
      user_mname: overrides.user_mname ?? user?.user_mname ?? "",
      user_lname: overrides.user_lname ?? user?.user_lname ?? "",
      suffix_name: overrides.suffix_name ?? user?.suffix_name ?? "",
      nickname: overrides.nickname ?? user?.nickname ?? "",
      user_email: user?.user_email ?? "", // Read-only primary email
      user_contact: overrides.user_contact ?? user?.user_contact ?? "",
      user_position: overrides.user_position ?? user?.user_position ?? "",
      user_province: overrides.user_province ?? user?.user_province ?? "",
      user_city: overrides.user_city ?? user?.user_city ?? "",
      user_brgy: overrides.user_brgy ?? user?.user_brgy ?? "",
      gender: overrides.gender ?? user?.gender ?? "",
      user_bday: overrides.user_bday ?? user?.user_bday ?? "",
      civil_status: overrides.civil_status ?? user?.civil_status ?? "",
      profile_image_url: overrides.profile_image_url ?? user?.profile_image_url ?? "",
    }),
    [user, overrides]
  );

  const isDirty = useMemo(
    () =>
      EDITABLE_FIELDS.some((field: EditableField) => {
        const baseline = user?.[field] ?? "";
        const current = overrides[field] ?? baseline;
        if (field === "user_bday") {
          // The date input only carries YYYY-MM-DD while the stored value
          // may include a time component.
          return current.slice(0, 10) !== baseline.slice(0, 10);
        }
        if (field === "user_contact") {
          // The input auto-formats; only a real digit change counts as dirty.
          return current.replace(/\D/g, "") !== baseline.replace(/\D/g, "");
        }
        return current !== baseline;
      }),
    [user, overrides]
  );

  // Saved address names are matched case-insensitively so legacy free-text
  // values (e.g. "DAGUPAN") still resolve to their PSGC entry.
  const selectedProvinceCode = useMemo(
    () =>
      provinces.find(
        (p) => p.name.toLowerCase() === formData.user_province.trim().toLowerCase()
      )?.code ?? "",
    [provinces, formData.user_province]
  );
  const selectedCityCode = useMemo(
    () =>
      cities.find(
        (c) => c.name.toLowerCase() === formData.user_city.trim().toLowerCase()
      )?.code ?? "",
    [cities, formData.user_city]
  );
  const selectedBrgyCode = useMemo(
    () =>
      barangays.find(
        (b) => b.name.toLowerCase() === formData.user_brgy.trim().toLowerCase()
      )?.code ?? "",
    [barangays, formData.user_brgy]
  );

  // Load the full province list once.
  useEffect(() => {
    let cancelled = false;
    fetchProvinces()
      .then((data) => {
        if (!cancelled) setProvinces(data);
      })
      .catch((err) => console.error("Failed to load provinces", err))
      .finally(() => {
        if (!cancelled) setLoadingProvinces(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load cities for the currently selected province.
  useEffect(() => {
    if (!selectedProvinceCode) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- spinner must show during the fetch
    setLoadingCities(true);
    fetchCities(selectedProvinceCode)
      .then((data) => {
        if (!cancelled) setCities(data);
      })
      .catch((err) => console.error("Failed to load cities", err))
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProvinceCode]);

  // Load barangays for the currently selected city.
  useEffect(() => {
    if (!selectedCityCode) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- spinner must show during the fetch
    setLoadingBarangays(true);
    fetchBarangays(selectedCityCode)
      .then((data) => {
        if (!cancelled) setBarangays(data);
      })
      .catch((err) => console.error("Failed to load barangays", err))
      .finally(() => {
        if (!cancelled) setLoadingBarangays(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCityCode]);

  const handleChange = (field: keyof UserProfile, value: string) => {
    setOverrides((prev) => ({ ...prev, [field]: value }));
  };

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const raw = el.value;
    const digitsBeforeCaret = raw
      .slice(0, el.selectionStart ?? raw.length)
      .replace(/\D/g, "").length;
    const formatted = formatContactInput(raw);
    const caret = caretForDigitCount(formatted, digitsBeforeCaret);
    handleChange("user_contact", formatted);
    setContactError(validatePhContact(formatted));
    // React re-commits the controlled value first, then we restore the caret.
    requestAnimationFrame(() => {
      if (document.activeElement === el) el.setSelectionRange(caret, caret);
    });
  };

  const handleProvinceChange = (code: string) => {
    const name = provinces.find((p) => p.code === code)?.name ?? "";
    setBarangays([]);
    setOverrides((prev) => ({
      ...prev,
      user_province: name,
      user_city: "",
      user_brgy: "",
    }));
  };

  const handleCityChange = (code: string) => {
    const name = cities.find((c) => c.code === code)?.name ?? "";
    setOverrides((prev) => ({ ...prev, user_city: name, user_brgy: "" }));
  };

  const handleBrgyChange = (code: string) => {
    const name = barangays.find((b) => b.code === code)?.name ?? "";
    handleChange("user_brgy", name);
  };

  // Image Upload Handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImageSrc(reader.result as string);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirmCrop = async (croppedFile: File) => {
    setUploadingImage(true);
    try {
      const uploadData = new FormData();
      uploadData.append("file", croppedFile);

      const res = await fetch("/api/client/upload", {
        method: "POST",
        body: uploadData,
      });

      if (!res.ok) {
        throw new Error("Failed to upload image.");
      }

      const fileObj = await res.json();
      const newImageUrl = fileObj.id || fileObj.filename_disk || fileObj.url;

      setOverrides((prev) => ({ ...prev, profile_image_url: newImageUrl }));
      await onSave({ profile_image_url: newImageUrl });
      setCropModalOpen(false);
      setSelectedImageSrc(null);
    } catch (err) {
      console.error("Photo upload error:", err);
      toast.error("Couldn't upload your photo. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemovePhoto = async () => {
    setConfirmRemovePhoto(false);
    setOverrides((prev) => ({ ...prev, profile_image_url: "" }));
    await onSave({ profile_image_url: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Only enforce format on values modified in this session so untouched
    // legacy contact data does not block unrelated saves.
    const baselineContact = (user?.user_contact ?? "").replace(/\D/g, "");
    if (formData.user_contact.replace(/\D/g, "") !== baselineContact) {
      const error = validatePhContact(formData.user_contact);
      if (error) {
        setContactError(error);
        toast.error("Please enter a valid contact number before saving.");
        return;
      }
    }
    const ok = await onSave({
      user_fname: formData.user_fname,
      user_mname: formData.user_mname,
      user_lname: formData.user_lname,
      suffix_name: formData.suffix_name,
      nickname: formData.nickname,
      user_contact: formData.user_contact,
      user_position: formData.user_position,
      user_province: formData.user_province,
      user_city: formData.user_city,
      user_brgy: formData.user_brgy,
      gender: formData.gender,
      user_bday: formData.user_bday,
      civil_status: formData.civil_status,
      profile_image_url: formData.profile_image_url,
    });
    if (ok) {
      setOverrides({});
      setContactError(null);
    }
  };

  const avatarSrc = getImageUrl(formData.profile_image_url);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Image Crop Modal */}
      <ImageCropModal
        isOpen={cropModalOpen}
        imageSrc={selectedImageSrc}
        type="company_logo"
        onCancel={() => {
          setCropModalOpen(false);
          setSelectedImageSrc(null);
        }}
        onConfirm={handleConfirmCrop}
        uploading={uploadingImage}
      />

      {/* Two Balanced Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column Card: Profile & Identity */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 sm:p-6 space-y-6 shadow-xs">
          <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Profile &amp; Identity
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Your account photo, full name, and personal details.
              </p>
            </div>
          </div>

          {/* Profile Avatar Header */}
          <div className="flex items-center gap-4 p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800">
            <div className="relative group shrink-0">
              <div className="w-16 h-16 rounded-full border-2 border-white dark:border-zinc-800 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-lg flex items-center justify-center overflow-hidden shadow-xs">
                {avatarSrc ? (
                  <Image
                    src={avatarSrc}
                    alt="Profile"
                    width={64}
                    height={64}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getInitials(formData.user_fname, formData.user_lname)
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-1 flex items-center justify-center bg-[#14a800] hover:bg-[#118f00] text-white rounded-full shadow-md transition-transform hover:scale-105"
                title="Change Profile Photo"
              >
                <Camera className="h-3 w-3" />
              </button>
            </div>

            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 min-w-0 truncate">
                  {formData.user_fname || formData.user_lname
                    ? `${formData.user_fname} ${formData.user_lname}`.trim()
                    : "Your Account"}
                </h4>
                {formData.nickname && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium truncate">
                    &quot;{formData.nickname}&quot;
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 truncate">
                PNG, JPG or WebP (max 5MB).
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 text-xs font-semibold rounded-lg border-zinc-200 dark:border-zinc-700"
                >
                  Upload New Photo
                </Button>
                {avatarSrc && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmRemovePhoto(true)}
                    className="h-7 text-xs font-medium text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Names */}
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="fname" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-zinc-400" /> First Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="fname"
                  value={formData.user_fname}
                  onChange={(e) => handleChange("user_fname", e.target.value)}
                  placeholder="First name"
                  className="h-9 text-sm rounded-lg"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lname" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Last Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="lname"
                  value={formData.user_lname}
                  onChange={(e) => handleChange("user_lname", e.target.value)}
                  placeholder="Last name"
                  className="h-9 text-sm rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="mname" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Middle Name <span className="text-zinc-400 font-normal">(Optional)</span>
                </Label>
                <Input
                  id="mname"
                  value={formData.user_mname}
                  onChange={(e) => handleChange("user_mname", e.target.value)}
                  placeholder="Middle name"
                  className="h-9 text-sm rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nickname" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Nickname <span className="text-zinc-400 font-normal">(Optional)</span>
                </Label>
                <Input
                  id="nickname"
                  value={formData.nickname}
                  onChange={(e) => handleChange("nickname", e.target.value)}
                  placeholder="Preferred name"
                  className="h-9 text-sm rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="suffix_name" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Suffix Name <span className="text-zinc-400 font-normal">(Optional, e.g. Jr., Sr., III)</span>
              </Label>
              <Input
                id="suffix_name"
                value={formData.suffix_name}
                onChange={(e) => handleChange("suffix_name", e.target.value)}
                placeholder="Jr. / III"
                className="h-9 text-sm rounded-lg"
              />
            </div>
          </div>

          {/* Personal Details (Optional) */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3.5">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
              Personal Information <span className="font-normal lowercase">(optional)</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="bday" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-zinc-400" /> Date of Birth
                </Label>
                <Input
                  id="bday"
                  type="date"
                  value={formData.user_bday ? formData.user_bday.slice(0, 10) : ""}
                  onChange={(e) => handleChange("user_bday", e.target.value)}
                  className="h-9 text-sm rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gender" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Gender
                </Label>
                <Select
                  value={formData.gender || "unspecified"}
                  onValueChange={(val) => handleChange("gender", val === "unspecified" ? "" : val)}
                >
                  <SelectTrigger id="gender" className="h-9 text-sm rounded-lg border-zinc-200 dark:border-zinc-700">
                    <SelectValue placeholder="Select Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unspecified" className="text-sm">Prefer not to say</SelectItem>
                    <SelectItem value="Male" className="text-sm">Male</SelectItem>
                    <SelectItem value="Female" className="text-sm">Female</SelectItem>
                    <SelectItem value="Non-Binary" className="text-sm">Non-Binary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="civil_status" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-zinc-400" /> Civil Status
              </Label>
              <SearchableSelect
                options={CIVIL_STATUS_OPTIONS}
                value={formData.civil_status || "unspecified"}
                onValueChange={(val) => handleChange("civil_status", val === "unspecified" ? "" : val)}
                placeholder="Select Status"
                className="h-9 text-sm rounded-lg border-zinc-200 dark:border-zinc-700"
              />
            </div>
          </div>
        </div>

        {/* Right Column Card: Work, Contact & Address */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 sm:p-6 space-y-6 shadow-xs">
          <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Work, Contact &amp; Location
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Your company role, reachability, and registered address.
              </p>
            </div>
          </div>

          {/* Work & Contact */}
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="position" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-zinc-400" /> Job Title / Position
              </Label>
              <Input
                id="position"
                value={formData.user_position}
                onChange={(e) => handleChange("user_position", e.target.value)}
                placeholder="e.g. HR Director / Talent Acquisition Lead"
                className="h-9 text-sm rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-zinc-400" /> Contact Number
              </Label>
              <Input
                id="contact"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={CONTACT_MAX_LENGTH}
                value={formatContactInput(formData.user_contact)}
                onChange={handleContactChange}
                placeholder="+63 912 345 6789"
                aria-invalid={!!contactError}
                className="h-9 text-sm rounded-lg"
              />
              {contactError ? (
                <p className="text-[11px] font-medium text-rose-500">{contactError}</p>
              ) : (
                <p className="text-[11px] text-zinc-400">
                  Philippine mobile (+63 9XX XXX XXXX) or landline format.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-zinc-400" /> Account Email Address
              </Label>
              <Input
                id="email"
                value={formData.user_email}
                disabled
                className="h-9 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800/50 cursor-not-allowed text-zinc-500"
              />
              <p className="text-[11px] text-zinc-400">Primary login email cannot be changed directly.</p>
            </div>
          </div>

          {/* Location & Address */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3.5">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                Location &amp; Address
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="province" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                  Province
                  {loadingProvinces && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
                </Label>
                <SearchableSelect
                  options={provinces.map((prov) => ({ value: prov.code, label: prov.name }))}
                  value={selectedProvinceCode}
                  onValueChange={handleProvinceChange}
                  disabled={loadingProvinces}
                  ariaLabel="Province"
                  placeholder={loadingProvinces ? "Loading provinces..." : "Select Province"}
                  className="h-9 text-sm rounded-lg border-zinc-200 dark:border-zinc-700"
                />
                {formData.user_province && !selectedProvinceCode && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Saved province &quot;{formData.user_province}&quot; is not in the official list — please select a new one.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                  City / Municipality
                  {loadingCities && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
                </Label>
                <SearchableSelect
                  options={cities.map((city) => ({ value: city.code, label: city.name }))}
                  value={selectedCityCode}
                  onValueChange={handleCityChange}
                  disabled={!selectedProvinceCode || loadingCities}
                  ariaLabel="City / Municipality"
                  placeholder={
                    loadingCities
                      ? "Loading cities..."
                      : selectedProvinceCode
                      ? "Select City / Municipality"
                      : "Select province first"
                  }
                  className="h-9 text-sm rounded-lg border-zinc-200 dark:border-zinc-700"
                />
                {formData.user_city && !selectedCityCode && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Saved city &quot;{formData.user_city}&quot; is not in the official list — please select a new one.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brgy" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                Barangay
                {loadingBarangays && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
              </Label>
              <SearchableSelect
                options={barangays.map((bgy) => ({ value: bgy.code, label: bgy.name }))}
                value={selectedBrgyCode}
                onValueChange={handleBrgyChange}
                disabled={!selectedCityCode || loadingBarangays}
                ariaLabel="Barangay"
                placeholder={
                  loadingBarangays
                    ? "Loading barangays..."
                    : selectedCityCode
                    ? "Select Barangay"
                    : "Select city first"
                }
                className="h-9 text-sm rounded-lg border-zinc-200 dark:border-zinc-700"
              />
              {formData.user_brgy && !selectedBrgyCode && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Saved barangay &quot;{formData.user_brgy}&quot; is not in the official list — please select a new one.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Button Bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-200/70 dark:border-zinc-800">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Make sure to save changes after modifying your profile details.
        </p>
        <Button
          type="submit"
          disabled={saving || !isDirty}
          className="h-10 px-6 text-sm rounded-xl bg-[#14a800] hover:bg-[#118f00] text-white border-0 font-medium shadow-xs flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving Profile...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              {isDirty ? "Save Account Profile" : "No changes to save"}
            </>
          )}
        </Button>
      </div>

      <AlertDialog open={confirmRemovePhoto} onOpenChange={setConfirmRemovePhoto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove profile photo?</AlertDialogTitle>
            <AlertDialogDescription>
              Your photo will be removed from your account. You can upload a new one at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep photo</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemovePhoto}>Remove photo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}


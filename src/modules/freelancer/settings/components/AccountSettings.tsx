"use client";

import React, { useMemo, useState } from "react";
import { UserProfile } from "@/modules/client/settings/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, User, Mail, Phone, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import {
  CONTACT_MAX_LENGTH,
  caretForDigitCount,
  formatContactInput,
  validatePhContact,
} from "@/lib/phone";

interface AccountSettingsProps {
  user: UserProfile | null;
  saving: boolean;
  onSave: (data: Partial<UserProfile>) => Promise<boolean>;
}

export default function AccountSettings({
  user,
  saving,
  onSave,
}: AccountSettingsProps) {
  const [overrides, setOverrides] = useState<Partial<UserProfile>>({});
  const [contactError, setContactError] = useState<string | null>(null);

  const formData = useMemo(
    () => ({
      user_fname: overrides.user_fname ?? user?.user_fname ?? "",
      user_mname: overrides.user_mname ?? user?.user_mname ?? "",
      user_lname: overrides.user_lname ?? user?.user_lname ?? "",
      user_email: user?.user_email ?? "",
      user_contact: overrides.user_contact ?? user?.user_contact ?? "",
    }),
    [user, overrides]
  );

  const isDirty = useMemo(
    () =>
      (
        [
          "user_fname",
          "user_mname",
          "user_lname",
          "user_contact",
        ] as const
      ).some((field) => {
        const baseline = user?.[field] ?? "";
        const current = overrides[field] ?? baseline;
        if (field === "user_contact") {
          // The input auto-formats; only a real digit change counts as dirty.
          return current.replace(/\D/g, "") !== baseline.replace(/\D/g, "");
        }
        return current !== baseline;
      }),
    [user, overrides]
  );

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
      user_contact: formData.user_contact,
    });
    if (ok) {
      setOverrides({});
      setContactError(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="space-y-2">
          <Label htmlFor="fname" className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-zinc-400" /> First Name <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="fname"
            value={formData.user_fname}
            onChange={(e) => handleChange("user_fname", e.target.value)}
            placeholder="First Name"
            className="h-11 md:h-10 text-base md:text-sm rounded-lg"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mname" className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Middle Name <span className="text-zinc-400 font-normal">(Optional)</span>
          </Label>
          <Input
            id="mname"
            value={formData.user_mname}
            onChange={(e) => handleChange("user_mname", e.target.value)}
            placeholder="Middle Name"
            className="h-11 md:h-10 text-base md:text-sm rounded-lg"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lname" className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Last Name <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="lname"
            value={formData.user_lname}
            onChange={(e) => handleChange("user_lname", e.target.value)}
            placeholder="Last Name"
            className="h-11 md:h-10 text-base md:text-sm rounded-lg"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-zinc-400" /> Account Email address
          </Label>
          <Input
            id="email"
            value={formData.user_email}
            disabled
            className="h-11 md:h-10 text-base md:text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800/50 cursor-not-allowed text-zinc-500"
          />
          <span className="text-sm md:text-xs text-zinc-400">Primary login email cannot be changed directly.</span>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact" className="text-sm md:text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
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
            className="h-11 md:h-10 text-base md:text-sm rounded-lg"
          />
          {contactError ? (
            <span className="text-sm md:text-xs font-medium text-rose-500">{contactError}</span>
          ) : (
            <span className="text-sm md:text-xs text-zinc-400">
              Philippine mobile (+63 9XX XXX XXXX) or landline format.
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <Button
          type="submit"
          disabled={saving || !isDirty}
          className="h-9 px-6 text-sm rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground border-0 font-medium shadow-sm transition-all max-md:min-h-11"
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
              Saving Profile...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              {isDirty ? "Save Account Profile" : "No changes to save"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// src/modules/vos-admin/request-management/components/CreateSchoolDraftModal.tsx
//
// Standalone draft-school form opened from the review dialog when the requested
// school has no selectable match. It owns only its field/submitting state: the
// parent supplies the guarded creation call, toasts its outcome, and decides
// what happens on success (select the returned draft in the review dialog).
"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SchoolDraftOutcome } from "../types/request.types";
import type { SchoolPlaceholderInput } from "./SchoolRequestDecisionModal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Guarded draft creation; resolves null on failure and the parent toasts it. */
  onSubmit: (input: SchoolPlaceholderInput) => Promise<SchoolDraftOutcome | null>;
  initialName?: string;
  initialCity?: string;
  initialProvince?: string;
}

export function CreateSchoolDraftModal({
  open,
  onOpenChange,
  onSubmit,
  initialName = "",
  initialCity = "",
  initialProvince = "",
}: Props) {
  const [schoolName, setSchoolName] = useState(initialName);
  const [city, setCity] = useState(initialCity);
  const [province, setProvince] = useState(initialProvince);
  const [submitting, setSubmitting] = useState(false);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSchoolName(initialName);
      setCity(initialCity);
      setProvince(initialProvince);
      setSubmitting(false);
    }
  }

  const valid = schoolName.trim() !== "";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        school_name: schoolName.trim(),
        ...(city.trim() !== "" ? { city_municipality: city.trim() } : {}),
        ...(province.trim() !== "" ? { province: province.trim() } : {}),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={submitting ? () => undefined : onOpenChange}>
      <DialogContent className="max-w-md" data-testid="create-school-draft-modal">
        <DialogHeader>
          <DialogTitle>Create a draft school</DialogTitle>
          <DialogDescription>
            This adds the school to the system as a draft so it can be onboarded later. A draft
            school is not a VOS partner yet.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="create-school-draft-name">School name</Label>
            <Input
              id="create-school-draft-name"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="e.g. San Carlos State University"
              disabled={submitting}
              autoComplete="off"
              data-testid="school-decision-placeholder-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-school-draft-city">City / municipality (optional)</Label>
            <Input
              id="create-school-draft-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. San Carlos"
              disabled={submitting}
              autoComplete="off"
              data-testid="school-decision-placeholder-city"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-school-draft-province">Province (optional)</Label>
            <Input
              id="create-school-draft-province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="e.g. Pangasinan"
              disabled={submitting}
              autoComplete="off"
              data-testid="school-decision-placeholder-province"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !valid}
              data-testid="school-decision-placeholder-confirm"
            >
              {submitting ? "Creating..." : "Create draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

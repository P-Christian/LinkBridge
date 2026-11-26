// src/modules/school-admin/school-profile/components/SchoolAddress.tsx
"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditableSchoolFields } from "../types/school-profile.types";

interface SchoolAddressProps {
  data: Partial<EditableSchoolFields>;
  onChange: (field: keyof EditableSchoolFields, value: string | boolean | number) => void;
  readOnly?: boolean;
}

export default function SchoolAddress({
  data,
  onChange,
  readOnly = false,
}: SchoolAddressProps) {
  if (readOnly) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="min-w-0 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Province
            </span>
            <p className="break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">
              {data.province || "—"}
            </p>
          </div>

          <div className="min-w-0 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              City / Municipality
            </span>
            <p className="break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">
              {data.city_municipality || "—"}
            </p>
          </div>

          <div className="min-w-0 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Barangay
            </span>
            <p className="break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">
              {data.barangay || "—"}
            </p>
          </div>

          <div className="min-w-0 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Postal Code
            </span>
            <p className="break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">
              {data.postal_code || "—"}
            </p>
          </div>
        </div>

        <div className="min-w-0 space-y-1 border-t border-border pt-4">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Campus Street Address / Building Details
          </span>
          <p className="break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">
            {data.address_line || "—"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="school_address_line" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Street Address / Campus Building
          </Label>
          <Input
            id="school_address_line"
            value={data.address_line || ""}
            onChange={(e) => onChange("address_line", e.target.value)}
            placeholder="e.g. 2401 Taft Avenue"
            className="h-10 text-sm rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="school_province" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Province <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="school_province"
            value={data.province || ""}
            onChange={(e) => onChange("province", e.target.value)}
            placeholder="e.g. Metro Manila"
            className="h-10 text-sm rounded-xl"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="school_city" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            City / Municipality <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="school_city"
            value={data.city_municipality || ""}
            onChange={(e) => onChange("city_municipality", e.target.value)}
            placeholder="e.g. Manila"
            className="h-10 text-sm rounded-xl"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="school_barangay" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Barangay
          </Label>
          <Input
            id="school_barangay"
            value={data.barangay || ""}
            onChange={(e) => onChange("barangay", e.target.value)}
            placeholder="e.g. Barangay 709, Malate"
            className="h-10 text-sm rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="school_postal" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Postal Code
          </Label>
          <Input
            id="school_postal"
            value={data.postal_code || ""}
            onChange={(e) => onChange("postal_code", e.target.value)}
            placeholder="e.g. 1004"
            className="h-10 text-sm rounded-xl"
          />
        </div>
      </div>
    </div>
  );
}

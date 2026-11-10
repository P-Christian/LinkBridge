// src/modules/client/company-profile/components/CompanyClassification.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2, AlertCircle } from "lucide-react";
import { EditableCompanyFields } from "../types";
import InlineAITrigger from "./InlineAITrigger";
import { cn } from "@/lib/utils";

interface CompanyClassificationProps {
  data: Partial<EditableCompanyFields & { custom_industry_name?: string }>;
  onChange: (
    field: keyof EditableCompanyFields | "custom_industry_name",
    value: string | number | boolean | null | undefined
  ) => void;
  fieldErrors?: Record<string, string>;
  readOnly?: boolean;
}

function CharCounter({
  current,
  max,
  min,
}: {
  current: number;
  max: number;
  min?: number;
}) {
  const isOver = current > max;
  const isUnder = min !== undefined && current > 0 && current < min;

  return (
    <span
      className={cn(
        "text-[10px] font-mono transition-colors",
        isOver
          ? "text-destructive font-bold"
          : isUnder
          ? "text-amber-500 dark:text-amber-400 font-medium"
          : "text-muted-foreground"
      )}
    >
      {min !== undefined && isUnder ? `min ${min} · ` : ""}
      {current}/{max}
    </span>
  );
}

interface IndustryItem {
  industry_id: number | string;
  industry_name: string;
}

interface OrgTypeItem {
  organization_type_id: number;
  organization_type_name: string;
}

interface CompanySizeItem {
  company_size_id: number;
  company_size_name: string;
}

export default function CompanyClassification({
  data,
  onChange,
  fieldErrors = {},
  readOnly = false,
}: CompanyClassificationProps) {
  const [industries, setIndustries] = useState<IndustryItem[]>([]);
  const [orgTypes, setOrgTypes] = useState<OrgTypeItem[]>([]);
  const [sizes, setSizes] = useState<CompanySizeItem[]>([]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadMasterData() {
      setLoading(true);
      try {
        const [indRes, orgRes, sizeRes] = await Promise.all([
          fetch("/api/client/company-profile?directusCollection=vs_industry&limit=-1"),
          fetch("/api/client/company-profile?directusCollection=vs_organization_type&limit=-1"),
          fetch("/api/client/company-profile?directusCollection=vs_company_size&limit=-1"),
        ]);

        const [indData, orgData, sizeData] = await Promise.all([
          indRes.json(),
          orgRes.json(),
          sizeRes.json(),
        ]);

        if (indData.errors) console.error("[Classification] vs_industry error:", indData.errors);
        if (orgData.errors) console.error("[Classification] vs_organization_type error:", orgData.errors);
        if (sizeData.errors) console.error("[Classification] vs_company_size error:", sizeData.errors);

        setIndustries(indData.data || []);
        setOrgTypes(orgData.data || []);
        setSizes(sizeData.data || []);
      } catch (err) {
        console.error("Failed to load master classification data", err);
      } finally {
        setLoading(false);
      }
    }
    loadMasterData();
  }, []);

  const sortedIndustries = [...industries].sort((a, b) =>
    a.industry_name.localeCompare(b.industry_name)
  );

  const hasOthersInList = sortedIndustries.some(
    (i) => i.industry_name.trim().toLowerCase() === "others"
  );

  const industryOptions = [
    ...sortedIndustries.map((i) => ({ value: String(i.industry_id), label: i.industry_name })),
    ...(!hasOthersInList ? [{ value: "OTHERS", label: "Others" }] : []),
  ];

  const orgTypeOptions = [...orgTypes]
    .sort((a, b) => a.organization_type_name.localeCompare(b.organization_type_name))
    .map((t) => ({ value: String(t.organization_type_id), label: t.organization_type_name }));

  const sizeOptions = [...sizes]
    .sort((a, b) => a.company_size_name.localeCompare(b.company_size_name))
    .map((s) => ({ value: String(s.company_size_id), label: s.company_size_name }));

  const isOthersSelected = (val: string | number | null | undefined) => {
    if (!val) return false;
    if (String(val).toUpperCase() === "OTHERS") return true;
    const match = industries.find((i) => String(i.industry_id) === String(val));
    return match?.industry_name?.trim().toLowerCase() === "others";
  };

  const currentIsOthers = isOthersSelected(data.industry_id);

  const foundIndustry = industries.find(
    (i) => String(i.industry_id) === String(data.industry_id)
  );

  const selectedIndustryName =
    foundIndustry?.industry_name ||
    (data.custom_industry_name?.trim() ? data.custom_industry_name.trim() : null) ||
    (currentIsOthers ? "Others" : "—");

  const selectedOrgTypeName = orgTypes.find(
    (o) => o.organization_type_id === Number(data.organization_type_id)
  )?.organization_type_name || "—";

  const selectedSizeName = sizes.find(
    (s) => s.company_size_id === Number(data.company_size_id)
  )?.company_size_name || "—";

  const liveErrors = useMemo(() => {
    const errs: Record<string, string> = {};

    // Tags: max 255
    const tags = data.company_tags ?? "";
    if (tags.length > 255) {
      errs.company_tags = "Company tags cannot exceed 255 characters.";
    }

    // Year Established: between 1800 and current year + 1
    if (data.year_established !== undefined && data.year_established !== null && (data.year_established as unknown) !== "") {
      const year = Number(data.year_established);
      const currentYear = new Date().getFullYear();
      if (isNaN(year) || year < 1800 || year > currentYear + 1) {
        errs.year_established = `Year must be between 1800 and ${currentYear + 1}.`;
      }
    }

    return errs;
  }, [data.company_tags, data.year_established]);

  const getError = (field: string) => liveErrors[field] || fieldErrors[field];
  const hasError = (field: string) => Boolean(getError(field));

  if (readOnly) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Industry</span>
            <p className="text-sm font-medium text-foreground">{selectedIndustryName}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Organization Type</span>
            <p className="text-sm font-medium text-foreground">{selectedOrgTypeName}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Company Size</span>
            <p className="text-sm font-medium text-foreground">{selectedSizeName}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Year Established</span>
            <p className="text-sm font-medium text-foreground">{data.year_established || "—"}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Tags</span>
            <p className="text-sm font-medium text-foreground">{data.company_tags || "—"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
        <span className="inline-block w-1 h-4 bg-primary rounded-full" />
        Company Classification
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="cp-industry" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
            <span>Industry <span className="text-rose-500">*</span></span>
            {loading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          </Label>
          <SearchableSelect
            options={industryOptions}
            value={data.industry_id ? String(data.industry_id) : ""}
            onValueChange={(v) => {
              onChange("industry_id", v);
            }}
            disabled={loading}
            placeholder="Select industry"
            className="h-9 max-md:min-h-10 border-zinc-200 font-normal focus:ring-2 focus:ring-primary/20 transition-all"
          />

          {currentIsOthers && (
            <div className="pt-1.5 space-y-1">
              <Label htmlFor="cp-custom-industry" className="text-xs md:text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                Specify Industry Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="cp-custom-industry"
                value={data.custom_industry_name ?? ""}
                onChange={(e) => onChange("custom_industry_name", e.target.value)}
                placeholder="Type your industry name..."
                className="h-8 md:text-xs max-md:min-h-10 max-md:text-base border-emerald-300 focus:border-emerald-500 rounded-lg"
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cp-business-type" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
            <span>Organization Type</span>
            {loading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          </Label>
          <SearchableSelect
            options={orgTypeOptions}
            value={data.organization_type_id ? String(data.organization_type_id) : ""}
            onValueChange={(v) => onChange("organization_type_id", Number(v))}
            disabled={loading}
            placeholder="Select type"
            className="h-9 max-md:min-h-10 border-zinc-200 font-normal focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cp-company-size" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
            <span>Company Size</span>
            {loading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          </Label>
          <SearchableSelect
            options={sizeOptions}
            value={data.company_size_id ? String(data.company_size_id) : ""}
            onValueChange={(v) => onChange("company_size_id", Number(v))}
            disabled={loading}
            placeholder="Select size"
            className="h-9 max-md:min-h-10 border-zinc-200 font-normal focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between h-7">
            <Label htmlFor="cp-year-established" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Year Established
            </Label>
          </div>
          <Input
            id="cp-year-established"
            type="number"
            value={data.year_established ?? ""}
            onChange={(e) => onChange("year_established", e.target.value ? Number(e.target.value) : "")}
            placeholder="e.g. 2026"
            aria-invalid={hasError("year_established")}
            className={cn(
              "h-9 md:text-sm max-md:h-10 max-md:text-base",
              hasError("year_established") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
            )}
          />
          {hasError("year_established") && (
            <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {getError("year_established")}
            </p>
          )}
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <div className="flex items-center justify-between h-7">
            <Label htmlFor="cp-tags" className="text-sm md:text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Tags
            </Label>
            <div className="flex items-center gap-2">
              <CharCounter current={(data.company_tags ?? "").length} max={255} />
              <InlineAITrigger
                currentText={data.company_tags ?? ""}
                fieldType="company_tags"
                companyName="Company"
                onRefined={(val) => onChange("company_tags", val)}
              />
            </div>
          </div>
          <Input
            id="cp-tags"
            value={data.company_tags ?? ""}
            onChange={(e) => onChange("company_tags", e.target.value)}
            placeholder="e.g. Software Development, Cloud Computing, SaaS"
            maxLength={255}
            aria-invalid={hasError("company_tags")}
            className={cn(
              "h-9 md:text-sm max-md:h-10 max-md:text-base",
              hasError("company_tags") && "border-destructive ring-2 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20"
            )}
          />
          {hasError("company_tags") && (
            <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {getError("company_tags")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

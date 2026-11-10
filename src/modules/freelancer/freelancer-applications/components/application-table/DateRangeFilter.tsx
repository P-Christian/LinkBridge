// src/modules/freelancer/freelancer-applications/components/application-table/DateRangeFilter.tsx
"use client";

import React, { useState } from "react";
import { Calendar as CalendarIcon, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type DateFilterPreset = "ALL" | "7_DAYS" | "30_DAYS" | "90_DAYS" | "CUSTOM";

export interface DateRangeFilterValue {
  preset: DateFilterPreset;
  startDate?: string | null; // "YYYY-MM-DD"
  endDate?: string | null;   // "YYYY-MM-DD"
}

interface DateRangeFilterProps {
  value: DateRangeFilterValue;
  onChange: (value: DateRangeFilterValue) => void;
}

const PRESET_OPTIONS: Array<{ preset: DateFilterPreset; label: string }> = [
  { preset: "ALL", label: "All Time" },
  { preset: "7_DAYS", label: "Past 7 Days" },
  { preset: "30_DAYS", label: "Past 30 Days" },
  { preset: "90_DAYS", label: "Past 90 Days" },
  { preset: "CUSTOM", label: "Custom Range" },
];

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(value.startDate || "");
  const [customEnd, setCustomEnd] = useState(value.endDate || "");

  const getButtonLabel = (): string => {
    switch (value.preset) {
      case "7_DAYS":
        return "Past 7 Days";
      case "30_DAYS":
        return "Past 30 Days";
      case "90_DAYS":
        return "Past 90 Days";
      case "CUSTOM":
        if (value.startDate && value.endDate) {
          return `${value.startDate} to ${value.endDate}`;
        }
        if (value.startDate) return `From ${value.startDate}`;
        if (value.endDate) return `Until ${value.endDate}`;
        return "Custom Range";
      case "ALL":
      default:
        return "Date Applied";
    }
  };

  const isFiltered = value.preset !== "ALL";

  const handleSelectPreset = (preset: DateFilterPreset) => {
    if (preset !== "CUSTOM") {
      onChange({ preset, startDate: null, endDate: null });
      setOpen(false);
    } else {
      onChange({
        preset: "CUSTOM",
        startDate: customStart || null,
        endDate: customEnd || null,
      });
    }
  };

  const handleApplyCustom = () => {
    onChange({
      preset: "CUSTOM",
      startDate: customStart || null,
      endDate: customEnd || null,
    });
    setOpen(false);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomStart("");
    setCustomEnd("");
    onChange({ preset: "ALL", startDate: null, endDate: null });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`h-10 px-3 gap-2 text-sm justify-between rounded-lg border font-normal ${
            isFiltered ? "border-primary/50 bg-primary/5 text-primary font-medium" : "text-muted-foreground"
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{getButtonLabel()}</span>
          </div>
          {isFiltered && (
            <span
              onClick={handleReset}
              className="ml-1 hover:bg-muted p-0.5 rounded-full"
              title="Clear date filter"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-3" align="start">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Filter by Date Applied
          </p>
        </div>

        <div className="space-y-1">
          {PRESET_OPTIONS.map((opt) => {
            const isSelected = value.preset === opt.preset;
            return (
              <button
                key={opt.preset}
                type="button"
                onClick={() => handleSelectPreset(opt.preset)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>

        {value.preset === "CUSTOM" && (
          <div className="pt-2 border-t space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor="custom-start-date" className="text-[11px] text-muted-foreground">
                Start Date
              </Label>
              <Input
                id="custom-start-date"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="custom-end-date" className="text-[11px] text-muted-foreground">
                End Date
              </Label>
              <Input
                id="custom-end-date"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleApplyCustom}
              className="w-full h-8 text-xs font-medium"
            >
              Apply Range
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

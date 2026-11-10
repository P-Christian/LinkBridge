"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export interface MultiSelectFilterProps {
  title: string;
  allLabel: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  triggerClassName?: string;
  placeholder?: string;
}

export function MultiSelectFilter({
  title,
  allLabel,
  options,
  selectedValues,
  onSelectionChange,
  triggerClassName,
  placeholder,
}: MultiSelectFilterProps) {
  const [open, setOpen] = React.useState(false);

  // Compute trigger label
  const triggerLabel = React.useMemo(() => {
    if (!selectedValues || selectedValues.length === 0) {
      return allLabel;
    }
    if (selectedValues.length === 1) {
      const match = options.find((opt) => opt.value === selectedValues[0]);
      return match ? match.label : allLabel;
    }
    if (selectedValues.length === 2) {
      const labels = selectedValues
        .map((val) => options.find((opt) => opt.value === val)?.label)
        .filter(Boolean);
      return labels.join(", ");
    }
    return `${title} (${selectedValues.length})`;
  }, [selectedValues, options, allLabel, title]);

  const handleToggle = (val: string) => {
    if (selectedValues.includes(val)) {
      onSelectionChange(selectedValues.filter((v) => v !== val));
    } else {
      onSelectionChange([...selectedValues, val]);
    }
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  const isAllSelected = selectedValues.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-8 justify-between text-sm md:text-xs rounded-lg font-normal max-md:min-h-11 border-zinc-200 dark:border-zinc-800",
            isAllSelected && "text-muted-foreground",
            !isAllSelected && "text-foreground font-medium border-primary/40 bg-primary/5",
            triggerClassName
          )}
        >
          <span className="truncate">{triggerLabel || placeholder || allLabel}</span>
          <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput
            placeholder={`Search ${title.toLowerCase()}...`}
            className="text-base md:text-sm h-9"
          />
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {/* Option: All (Reset) */}
              <CommandItem
                onSelect={handleClearAll}
                className={cn(
                  "cursor-pointer flex items-center justify-between text-xs py-2 px-2.5 rounded-lg font-medium transition-colors my-0.5",
                  isAllSelected
                    ? "bg-primary/15 dark:bg-primary/25 text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted/60 dark:hover:bg-zinc-800/60"
                )}
              >
                <span>{allLabel}</span>
                {isAllSelected && (
                  <div className="w-4 h-4 rounded-[4px] bg-primary flex items-center justify-center text-white">
                    <Check className="h-3 w-3 stroke-[3] text-white" />
                  </div>
                )}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {options.map((opt) => {
                const checked = selectedValues.includes(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => handleToggle(opt.value)}
                    className={cn(
                      "cursor-pointer flex items-center gap-2.5 text-xs py-2 px-2.5 rounded-lg transition-colors my-0.5",
                      checked
                        ? "bg-primary/15 dark:bg-primary/25 text-foreground font-semibold hover:bg-primary/20 dark:hover:bg-primary/30"
                        : "text-muted-foreground hover:bg-muted/60 dark:hover:bg-zinc-800/60"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 transition-all",
                        checked
                          ? "bg-primary border-2 border-primary text-white shadow-xs"
                          : "border-2 border-zinc-400 dark:border-zinc-500 bg-white/70 dark:bg-zinc-800/70"
                      )}
                    >
                      {checked && <Check className="h-3 w-3 stroke-[3] text-white" />}
                    </div>
                    <span className="flex-1 truncate">{opt.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

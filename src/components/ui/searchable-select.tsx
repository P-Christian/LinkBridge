"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export interface SearchableSelectProps {
    options: { value: string; label: string }[];
    value?: string;
    onValueChange: (value: string) => void;
    onSearchChange?: (term: string) => void;
    serverFiltered?: boolean;
    placeholder?: string;
    /** Placeholder for the in-popover search input; defaults to a form derived from `placeholder`. */
    searchPlaceholder?: string;
    /** Accessible name for the combobox trigger, which takes no name from its content. */
    ariaLabel?: string;
    disabled?: boolean;
    className?: string;
    triggerClassName?: string;
}

export function SearchableSelect({
    options,
    value,
    onValueChange,
    onSearchChange,
    serverFiltered = false,
    placeholder = "Select option...",
    searchPlaceholder,
    ariaLabel,
    disabled = false,
    className,
    triggerClassName,
}: SearchableSelectProps) {
    const [open, setOpen] = React.useState(false);

    // Find the label for the current value
    const selectedLabel = React.useMemo(() => {
        return options.find((opt) => opt.value === value)?.label;
    }, [options, value]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={ariaLabel}
                    className={cn("w-full min-w-0 justify-between", !value && "text-muted-foreground", className, triggerClassName)}
                    disabled={disabled}
                >
                    <span className="truncate">{selectedLabel || placeholder}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto min-w-[max(200px,var(--radix-popover-trigger-width))] max-w-[340px] p-0 shadow-lg" align="start">
                <Command shouldFilter={!serverFiltered}>
                    <CommandInput
              className="text-base md:text-sm"
              placeholder={searchPlaceholder ?? `Search ${placeholder.toLowerCase()}...`}
              onValueChange={onSearchChange}
            />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt) => (
                                <CommandItem
                                    key={opt.value}
                                    value={opt.label} // Use label for searching
                                    onSelect={() => {
                                        // We need to map back to the ID/value since CommandItem uses text content or value prop
                                        // Here we used label as value for search, so we find the option by label and call onValueChange with its value
                                        // However, simpler is to use the option.value if unique, but Command compares normalized search.
                                        // Let's stick to using the opt.value if we want precise selection.
                                        // Re-eval: onSelect returns the value prop (opt.label).
                                        // Actually, let's use the option value but ensure standard shadcn pattern.

                                        onValueChange(opt.value);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === opt.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <span className="min-w-0 flex-1 whitespace-nowrap">{opt.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

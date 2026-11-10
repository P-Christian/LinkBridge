"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Search, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AddressOption {
    code: string;
    name: string;
}

interface SearchableAddressSelectProps {
    options: AddressOption[];
    value: string; // code or name
    onChange: (code: string, name: string) => void;
    placeholder: string;
    searchPlaceholder?: string;
    disabled?: boolean;
    loading?: boolean;
    matchByName?: boolean;
}

export function SearchableAddressSelect({
    options,
    value,
    onChange,
    placeholder,
    searchPlaceholder = "Search...",
    disabled = false,
    loading = false,
    matchByName = false,
}: SearchableAddressSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            setSearch("");
        }
    };

    // Focus input on open
    useEffect(() => {
        if (open) {
            const timer = setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [open]);

    const selectedOption = options.find((opt) =>
        matchByName ? opt.name === value : opt.code === value || opt.name === value
    );

    const filteredOptions = options.filter((opt) =>
        opt.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled || loading}
                    className={cn(
                        "w-full h-11 md:h-10 justify-between font-normal text-base md:text-sm bg-transparent border-input hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring px-3 py-2",
                        !selectedOption && "text-muted-foreground",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <span className="truncate text-left">
                        {loading
                            ? "Loading..."
                            : selectedOption
                            ? selectedOption.name
                            : placeholder}
                    </span>
                    {loading ? (
                        <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
                    ) : (
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0 z-[60] bg-popover shadow-md border rounded-md"
                align="start"
            >
                <div className="flex items-center border-b px-3 py-2 gap-2 bg-muted/20">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                </div>
                <div className="max-h-60 overflow-y-auto p-1 divide-y divide-border/20">
                    {filteredOptions.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            No results found.
                        </div>
                    ) : (
                        filteredOptions.map((opt) => {
                            const isSelected = matchByName
                                ? opt.name === value
                                : opt.code === value || opt.name === value;
                            return (
                                <button
                                    key={opt.code}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt.code, opt.name);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md text-left transition-colors cursor-pointer hover:bg-muted/80",
                                        isSelected && "bg-primary/10 text-primary font-medium"
                                    )}
                                >
                                    <span className="truncate">{opt.name}</span>
                                    {isSelected && <Check className="ml-2 h-4 w-4 shrink-0 text-primary" />}
                                </button>
                            );
                        })
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFreelancerProfileContext } from "../providers/FreelancerProfileProvider";
import { VsJobPreferences } from "../types/freelancer-profile.types";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Input } from "@/components/ui/input";
import { fetchProvinces, fetchCities, PsgcItem } from "@/lib/psgc";

const JOB_TYPE_OPTIONS = [
  { value: "Full-time", label: "Full-time" },
  { value: "Part-time", label: "Part-time" },
  { value: "Contract", label: "Contract" },
  { value: "Freelance", label: "Freelance" },
  { value: "Internship", label: "Internship" },
];

const CURRENCY_OPTIONS = [
  { value: "PHP", label: "PHP (₱)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "AUD", label: "AUD (A$)" },
  { value: "SGD", label: "SGD (S$)" },
  { value: "JPY", label: "JPY (¥)" },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: "₱",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  SGD: "S$",
  JPY: "¥",
};

const AVAILABILITY_OPTIONS = [
  { value: "Immediate", label: "Immediate" },
  { value: "1 Week Notice", label: "1 Week Notice" },
  { value: "2 Weeks Notice", label: "2 Weeks Notice" },
  { value: "1 Month Notice", label: "1 Month Notice" },
  { value: "Not Looking", label: "Not Looking currently" },
];

const WORK_SETUP_OPTIONS = ["Remote", "Hybrid", "On-site"];

const PREFERRED_INDUSTRY_OPTIONS = [
  "Information Technology & Services",
  "Financial Services, Accounting & Banking",
  "BPO & Customer Support",
  "Healthcare & Pharmaceuticals",
  "Education & Training",
  "Manufacturing & Logistics",
  "Marketing, Advertising & Creative Media",
  "Real Estate & Construction",
  "Retail, E-commerce & Consumer Goods",
  "Hospitality, Travel & Tourism",
  "Legal & Professional Services",
  "Telecommunications",
];

export function parseIndustries(raw: string | null | undefined): string[] {
    if (!raw || !raw.trim()) return [];
    
    // If separated by semicolon
    if (raw.includes(";")) {
        return Array.from(new Set(raw.split(";").map(s => s.trim()).filter(Boolean)));
    }
    
    // If legacy comma separated, check if it matches catalog items before splitting
    let text = raw.trim();
    const result: string[] = [];
    
    // Check for catalog items that contain commas first
    for (const opt of PREFERRED_INDUSTRY_OPTIONS) {
        if (text.includes(opt)) {
            result.push(opt);
            text = text.replace(opt, "").replace(/^[,\s]+|[,\s]+$/g, "");
        }
    }
    
    // If fragments remain, split by comma
    if (text) {
        const remaining = text.split(",").map(s => s.trim()).filter(Boolean);
        result.push(...remaining);
    }
    
    return Array.from(new Set(result));
}

interface JobPreferencesModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialPreferences: Partial<VsJobPreferences>;
    userId: number;
}

export function JobPreferencesModal({ isOpen, onClose, initialPreferences }: JobPreferencesModalProps) {
    const { setJobPreferencesDraft, pendingJobPreferences } = useFreelancerProfileContext();
    
    const [preferences, setPreferences] = useState<Partial<VsJobPreferences>>({});

    const [provinces, setProvinces] = useState<PsgcItem[]>([]);
    const [cities, setCities] = useState<PsgcItem[]>([]);
    const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
    const [selectedCityCode, setSelectedCityCode] = useState("");
    const [locationError, setLocationError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPreferences(pendingJobPreferences !== null ? pendingJobPreferences : initialPreferences);
        }
    }, [isOpen, pendingJobPreferences, initialPreferences]);

    useEffect(() => {
        if (!isOpen) return;
        let isMounted = true;
        async function loadProvinces() {
            try {
                const data = await fetchProvinces();
                if (!isMounted) return;
                setProvinces(data);
                setLocationError(null);
            } catch (err) { // eslint-disable-line @typescript-eslint/no-unused-vars
                if (isMounted) setLocationError("Failed to load provinces from PSGC.");
            }
        }
        loadProvinces();
        return () => { isMounted = false; };
    }, [isOpen]);

    // Re-hydrate selected codes when modal opens or provinces load
    useEffect(() => {
        if (provinces.length > 0 && preferences.preferred_location) {
            const parts = preferences.preferred_location.split(",").map(s => s.trim());
            const provStr = parts.length > 1 ? parts[1] : parts[0];
            const matchedProv = provinces.find(p => p.name === provStr);
            if (matchedProv && matchedProv.code !== selectedProvinceCode) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setSelectedProvinceCode(matchedProv.code);
            }
        }
    }, [provinces, preferences.preferred_location, selectedProvinceCode]);

    useEffect(() => {
        if (!selectedProvinceCode) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCities([]);
            return;
        }
        let isMounted = true;
        async function loadCities() {
            try {
                const data = await fetchCities(selectedProvinceCode);
                if (!isMounted) return;
                setCities(data);
                setLocationError(null);
            } catch (err) { // eslint-disable-line @typescript-eslint/no-unused-vars
                if (isMounted) setLocationError("Failed to load cities from PSGC.");
            }
        }
        loadCities();
        return () => { isMounted = false; };
    }, [selectedProvinceCode]);

    useEffect(() => {
        if (cities.length > 0 && preferences.preferred_location) {
            const parts = preferences.preferred_location.split(",").map(s => s.trim());
            const cityStr = parts.length > 1 ? parts[0] : "";
            if (cityStr) {
                const matchedCity = cities.find(c => c.name === cityStr);
                if (matchedCity && matchedCity.code !== selectedCityCode) {
                    // eslint-disable-next-line react-hooks/set-state-in-effect
                    setSelectedCityCode(matchedCity.code);
                }
            }
        }
    }, [cities, preferences.preferred_location, selectedCityCode]);

    if (!isOpen) return null;

    const handleSave = () => {
        const now = new Date();
        const dtf = new Intl.DateTimeFormat("sv-SE", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
        const phTimestamp = dtf.format(now);

        setJobPreferencesDraft({
            ...preferences,
            updated_at: phTimestamp
        });
        onClose();
    };

    const handleChange = (field: keyof VsJobPreferences, value: string | number | null | undefined) => {
        setPreferences(prev => ({ ...prev, [field]: value }));
    };

    const handleProvinceChange = (code: string) => {
        const selected = provinces.find(p => p.code === code);
        setSelectedProvinceCode(code);
        setSelectedCityCode("");
        if (selected) {
            handleChange("preferred_location", selected.name);
        } else {
            handleChange("preferred_location", "");
        }
    };

    const handleCityChange = (code: string) => {
        const selectedCity = cities.find(c => c.code === code);
        const selectedProv = provinces.find(p => p.code === selectedProvinceCode);
        setSelectedCityCode(code);
        
        if (selectedCity && selectedProv) {
            handleChange("preferred_location", `${selectedCity.name}, ${selectedProv.name}`);
        } else if (selectedProv) {
            handleChange("preferred_location", selectedProv.name);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-background rounded-xl shadow-lg flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-semibold text-foreground">Edit Job Preferences</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="max-md:size-11">
                        <X className="h-5 w-5" />
                    </Button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Job Type</label>
                            <p className="text-xs text-muted-foreground">Select one or more job types</p>
                            <div className="flex flex-wrap gap-2 pt-1">
                                {JOB_TYPE_OPTIONS.map(opt => {
                                    const currentValues = (preferences.job_type || "")
                                        .split(",")
                                        .map(s => s.trim())
                                        .filter(Boolean);
                                    const isSelected = currentValues.includes(opt.value);

                                    const toggleJobType = () => {
                                        let updated: string[];
                                        if (isSelected) {
                                            updated = currentValues.filter(v => v !== opt.value);
                                        } else {
                                            updated = [...currentValues, opt.value];
                                        }
                                        handleChange("job_type", updated.length > 0 ? updated.join(", ") : null);
                                    };

                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={toggleJobType}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer select-none max-md:py-2 max-md:px-3.5 ${
                                                isSelected
                                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                    : "bg-background text-foreground border-input hover:bg-muted/70"
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Work Setup</label>
                            <p className="text-xs text-muted-foreground">Select one or more work setups</p>
                            <div className="flex flex-wrap gap-2 pt-1">
                                {WORK_SETUP_OPTIONS.map(setup => {
                                    const currentValues = (preferences.work_setup || "")
                                        .split(",")
                                        .map(s => s.trim())
                                        .filter(Boolean);
                                    const isSelected = currentValues.includes(setup);

                                    const toggleWorkSetup = () => {
                                        let updated: string[];
                                        if (isSelected) {
                                            updated = currentValues.filter(v => v !== setup);
                                        } else {
                                            updated = [...currentValues, setup];
                                        }
                                        handleChange("work_setup", updated.length > 0 ? updated.join(", ") : null);
                                    };

                                    return (
                                        <button
                                            key={setup}
                                            type="button"
                                            onClick={toggleWorkSetup}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer select-none max-md:py-2 max-md:px-3.5 ${
                                                isSelected
                                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                    : "bg-background text-foreground border-input hover:bg-muted/70"
                                            }`}
                                        >
                                            {setup}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm font-medium">Preferred Location</label>
                            {locationError && (
                                <div className="p-2 bg-destructive/10 text-destructive rounded-md text-sm md:text-xs">
                                    {locationError}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
                                <SearchableSelect 
                                    options={provinces.map(p => ({ value: p.code, label: p.name }))}
                                    value={selectedProvinceCode} 
                                    onValueChange={handleProvinceChange}
                                    placeholder="Select Province"
                                    className="max-md:min-h-11"
                                />
                                
                                <SearchableSelect 
                                    options={cities.map(c => ({ value: c.code, label: c.name }))}
                                    value={selectedCityCode} 
                                    onValueChange={handleCityChange}
                                    disabled={!selectedProvinceCode || cities.length === 0}
                                    placeholder="Select City/Municipality"
                                    className="max-md:min-h-11"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Preferred Industry</label>
                                <span className="text-xs text-muted-foreground">Up to 5 industries</span>
                            </div>
                            
                            {(() => {
                                const selectedIndustries = parseIndustries(preferences.preferred_industry);

                                const removeIndustry = (industryToRemove: string) => {
                                    const updated = selectedIndustries.filter(i => i !== industryToRemove);
                                    handleChange("preferred_industry", updated.length > 0 ? updated.join("; ") : null);
                                };

                                const addIndustry = (industryToAdd: string) => {
                                    if (selectedIndustries.length >= 5) return;
                                    if (!selectedIndustries.includes(industryToAdd)) {
                                        const updated = [...selectedIndustries, industryToAdd];
                                        handleChange("preferred_industry", updated.join("; "));
                                    }
                                };

                                const availableOptions = PREFERRED_INDUSTRY_OPTIONS
                                    .filter(opt => !selectedIndustries.includes(opt))
                                    .map(opt => ({ value: opt, label: opt }));

                                return (
                                    <div className="space-y-2">
                                        {selectedIndustries.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pb-1">
                                                {selectedIndustries.map((industry, idx) => (
                                                    <span 
                                                        key={`${industry}-${idx}`}
                                                        className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 shadow-xs transition-colors"
                                                    >
                                                        <span>{industry}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeIndustry(industry)}
                                                            className="text-primary/70 hover:text-primary hover:bg-primary/20 rounded-full p-0.5 transition-colors cursor-pointer"
                                                            aria-label={`Remove ${industry}`}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {selectedIndustries.length < 5 ? (
                                            <SearchableSelect 
                                                options={availableOptions}
                                                value=""
                                                onValueChange={addIndustry}
                                                placeholder="Select industry..."
                                                searchPlaceholder="Search industry..."
                                                className="max-md:min-h-11"
                                            />
                                        ) : (
                                            <p className="text-xs text-muted-foreground italic">
                                                Maximum of 5 industries selected.
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Currency</label>
                                <SearchableSelect 
                                    options={CURRENCY_OPTIONS}
                                    value={preferences.currency || "PHP"} 
                                    onValueChange={(val) => handleChange("currency", val)}
                                    placeholder="Select currency"
                                    className="max-md:min-h-11"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Minimum Salary</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none select-none">
                                            {CURRENCY_SYMBOLS[preferences.currency || "PHP"] || "₱"}
                                        </span>
                                        <Input 
                                            type="text"
                                            value={preferences.salary_range_min !== null && preferences.salary_range_min !== undefined ? preferences.salary_range_min.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""} 
                                            onChange={(e) => {
                                                const numericStr = e.target.value.replace(/[^\d]/g, "");
                                                handleChange("salary_range_min", numericStr ? Number(numericStr) : null);
                                            }}
                                            placeholder="Min expected salary"
                                            className="pl-8"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Maximum Salary</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none select-none">
                                            {CURRENCY_SYMBOLS[preferences.currency || "PHP"] || "₱"}
                                        </span>
                                        <Input 
                                            type="text"
                                            value={preferences.salary_range_max !== null && preferences.salary_range_max !== undefined ? preferences.salary_range_max.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""} 
                                            onChange={(e) => {
                                                const numericStr = e.target.value.replace(/[^\d]/g, "");
                                                handleChange("salary_range_max", numericStr ? Number(numericStr) : null);
                                            }}
                                            placeholder="Max expected salary"
                                            className="pl-8"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Availability</label>
                            <SearchableSelect 
                                options={AVAILABILITY_OPTIONS}
                                value={preferences.availability || ""} 
                                onValueChange={(val) => handleChange("availability", val)}
                                placeholder="Select availability"
                                className="max-md:min-h-11"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t flex justify-end gap-3 bg-muted/20">
                    <Button variant="outline" onClick={onClose} className="max-md:min-h-11">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} className="max-md:min-h-11">
                        Save Changes
                    </Button>
                </div>
            </div>
        </div>
    );
}

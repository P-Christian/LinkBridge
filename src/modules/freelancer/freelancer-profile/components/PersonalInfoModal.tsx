"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./local-dialog";
import { useFreelancerProfileContext } from "../providers/FreelancerProfileProvider";
import { FreelancerProfile, VsUserSocialLink } from "../types/freelancer-profile.types";
import { Plus, X } from "lucide-react";
import { fetchProvinces, fetchCities, fetchBarangays, PsgcItem } from "@/lib/psgc";
import { SearchableAddressSelect } from "./SearchableAddressSelect";
import { SOCIAL_PLATFORMS, validateSocialUrl } from "../constants/social-platforms";
import { toast } from "sonner";

interface PersonalInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function PersonalInfoModal({ isOpen, onClose }: PersonalInfoModalProps) {
    const { data, pendingPersonalInfo, setPersonalInfoDraft, pendingSocialLinks, setSocialLinksDraft } = useFreelancerProfileContext();
    
    // Initial state setup based on pending draft or live data
    const [formData, setFormData] = useState<Partial<FreelancerProfile>>({});
    const [socialLinks, setSocialLinks] = useState<VsUserSocialLink[]>([]);

    // PSGC State
    const [provinces, setProvinces] = useState<PsgcItem[]>([]);
    const [cities, setCities] = useState<PsgcItem[]>([]);
    const [barangays, setBarangays] = useState<PsgcItem[]>([]);
    const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
    const [selectedCityCode, setSelectedCityCode] = useState("");
    const [locationError, setLocationError] = useState<string | null>(null);
    const [socialLinkErrors, setSocialLinkErrors] = useState<Record<number, string>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen && data) {
            // Use pending draft if it exists, otherwise use live data
            const source = (pendingPersonalInfo || data) as (FreelancerProfile & { first_name?: string; last_name?: string });
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData({
                user_fname: source.user_fname || source.first_name || "",
                user_mname: source.user_mname || "",
                user_lname: source.user_lname || source.last_name || "",
                suffix_name: source.suffix_name || "",
                nickname: source.nickname || "",
                user_position: source.user_position || "",
                user_contact: source.user_contact || "",
                user_bday: source.user_bday || "",
                gender: source.gender || "",
                civil_status: source.civil_status || "",
                blood_type: source.blood_type || "",
                nationality: source.nationality || "",
                place_of_birth: source.place_of_birth || "",
                user_province: source.user_province || "",
                user_city: source.user_city || "",
                user_brgy: source.user_brgy || "",
            });

            if (pendingSocialLinks) {
                setSocialLinks(pendingSocialLinks);
            } else if (data.social_links) {
                setSocialLinks(data.social_links);
            } else {
                setSocialLinks([]);
            }
        }
    }, [isOpen, data, pendingPersonalInfo, pendingSocialLinks]);

    // Load Provinces on mount
    useEffect(() => {
        if (!isOpen) return;
        let isMounted = true;
        async function loadProvinces() {
            try {
                const data = await fetchProvinces();
                if (!isMounted) return;
                setProvinces(data);
                setLocationError(null);
                
                // Restore province code if we have a saved name
                // We actually want to check the `formData.user_province` because it is set when the modal opens
            } catch (err) {
                if (isMounted) setLocationError("Failed to load provinces from PSGC. Please try again later.");
                console.error("Failed to load provinces", err);
            }
        }
        loadProvinces();
        return () => { isMounted = false; };
    }, [isOpen, pendingPersonalInfo]);

    // Sync province code with formData
    useEffect(() => {
        if (provinces.length > 0 && formData.user_province) {
            const matched = provinces.find(p => p.name === formData.user_province);
            if (matched && matched.code !== selectedProvinceCode) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setSelectedProvinceCode(matched.code);
            }
        }
    }, [provinces, formData.user_province, selectedProvinceCode]);

    // Load Cities when selectedProvinceCode changes
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
            } catch (err) {
                if (isMounted) setLocationError("Failed to load cities from PSGC.");
                console.error("Failed to load cities", err);
            }
        }
        loadCities();
        return () => { isMounted = false; };
    }, [selectedProvinceCode]);

    // Sync city code with formData
    useEffect(() => {
        if (cities.length > 0 && formData.user_city) {
            const matched = cities.find(c => c.name === formData.user_city);
            if (matched && matched.code !== selectedCityCode) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setSelectedCityCode(matched.code);
            }
        }
    }, [cities, formData.user_city, selectedCityCode]);

    // Load Barangays when selectedCityCode changes
    useEffect(() => {
        if (!selectedCityCode) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setBarangays([]);
            return;
        }
        let isMounted = true;
        async function loadBarangays() {
            try {
                const data = await fetchBarangays(selectedCityCode);
                if (!isMounted) return;
                setBarangays(data);
                setLocationError(null);
            } catch (err) {
                if (isMounted) setLocationError("Failed to load barangays from PSGC.");
                console.error("Failed to load barangays", err);
            }
        }
        loadBarangays();
        return () => { isMounted = false; };
    }, [selectedCityCode]);

    if (!isOpen || !data) return null;

    const handleApply = () => {
        const errors: Record<number, string> = {};
        const normalizedLinks = socialLinks.map((link) => {
            if (!link.profile_url || !link.profile_url.trim()) {
                return link;
            }
            const validation = validateSocialUrl(link.platform_name, link.profile_url);
            if (!validation.isValid) {
                errors[link.id] = validation.error || "Invalid URL";
            }
            return {
                ...link,
                profile_url: validation.normalizedUrl || link.profile_url.trim(),
            };
        });

        const newFieldErrors: Record<string, string> = {};
        if (!formData.user_fname || !formData.user_fname.trim()) {
            newFieldErrors.user_fname = "First name is required";
        }
        if (!formData.user_lname || !formData.user_lname.trim()) {
            newFieldErrors.user_lname = "Last name is required";
        }
        if (!formData.user_contact || !formData.user_contact.trim()) {
            newFieldErrors.user_contact = "Contact number is required";
        }
        if (!formData.user_bday || !formData.user_bday.trim()) {
            newFieldErrors.user_bday = "Birthday is required";
        }
        if (!formData.gender || !formData.gender.trim()) {
            newFieldErrors.gender = "Gender is required";
        }
        if (!formData.user_province || !formData.user_province.trim()) {
            newFieldErrors.user_province = "Province is required";
        }
        if (!formData.user_city || !formData.user_city.trim()) {
            newFieldErrors.user_city = "City/Municipality is required";
        }

        const hasFieldErrors = Object.keys(newFieldErrors).length > 0;
        const hasSocialErrors = Object.keys(errors).length > 0;

        if (hasFieldErrors || hasSocialErrors) {
            if (hasFieldErrors) {
                setFormErrors(newFieldErrors);
                toast.error("Please fill in all mandatory fields before applying changes.");
            }
            if (hasSocialErrors) {
                setSocialLinkErrors(errors);
                toast.error("Please fix invalid social profile URLs before applying changes.");
            }
            return;
        }

        setPersonalInfoDraft(formData);
        setSocialLinksDraft(normalizedLinks);
        onClose();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (formErrors[name]) {
            setFormErrors(prev => {
                const copy = { ...prev };
                delete copy[name];
                return copy;
            });
        }
    };

    const handleBirthdayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (!val) {
            setFormData(prev => ({ ...prev, user_bday: "" }));
            return;
        }

        // Enforce strict 4-digit maximum on the year segment (YYYY-MM-DD)
        const parts = val.split("-");
        if (parts[0] && parts[0].length > 4) {
            return;
        }

        setFormData(prev => ({ ...prev, user_bday: val }));
        if (formErrors.user_bday) {
            setFormErrors(prev => {
                const copy = { ...prev };
                delete copy.user_bday;
                return copy;
            });
        }
    };

    const handleProvinceSelect = (code: string, name: string) => {
        setSelectedProvinceCode(code);
        setSelectedCityCode("");
        setBarangays([]);
        setFormData(prev => ({
            ...prev,
            user_province: name,
            user_city: "",
            user_brgy: ""
        }));
        if (formErrors.user_province) {
            setFormErrors(prev => {
                const copy = { ...prev };
                delete copy.user_province;
                return copy;
            });
        }
    };

    const handleCitySelect = (code: string, name: string) => {
        setSelectedCityCode(code);
        setFormData(prev => ({
            ...prev,
            user_city: name,
            user_brgy: ""
        }));
        if (formErrors.user_city) {
            setFormErrors(prev => {
                const copy = { ...prev };
                delete copy.user_city;
                return copy;
            });
        }
    };

    const handleBarangaySelect = (_code: string, name: string) => {
        setFormData(prev => ({
            ...prev,
            user_brgy: name
        }));
    };

    const todayString = new Date().toISOString().split("T")[0];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background max-md:max-w-[calc(100vw-2rem)]">
                <DialogHeader className="p-6 border-b shrink-0 flex flex-row items-center justify-between">
                    <DialogTitle className="text-xl font-semibold text-foreground">
                        Edit Personal Information
                    </DialogTitle>
                </DialogHeader>
                
                <div className="p-6 overflow-y-auto flex-1 space-y-8 min-h-0">
                    
                    {/* Basic Info Section */}
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 border-b pb-2">Basic Info</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">First Name *</label>
                                <input
                                    type="text"
                                    name="user_fname"
                                    value={formData.user_fname || ""}
                                    onChange={handleChange}
                                    className={`flex h-11 md:h-10 w-full rounded-md border bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 ${
                                        formErrors.user_fname
                                            ? "border-destructive focus-visible:ring-destructive"
                                            : "border-input focus-visible:ring-ring"
                                    }`}
                                />
                                {formErrors.user_fname && (
                                    <p className="text-xs text-destructive font-medium">{formErrors.user_fname}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Middle Name</label>
                                <input
                                    type="text"
                                    name="user_mname"
                                    value={formData.user_mname || ""}
                                    onChange={handleChange}
                                    className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Last Name *</label>
                                <input
                                    type="text"
                                    name="user_lname"
                                    value={formData.user_lname || ""}
                                    onChange={handleChange}
                                    className={`flex h-11 md:h-10 w-full rounded-md border bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 ${
                                        formErrors.user_lname
                                            ? "border-destructive focus-visible:ring-destructive"
                                            : "border-input focus-visible:ring-ring"
                                    }`}
                                />
                                {formErrors.user_lname && (
                                    <p className="text-xs text-destructive font-medium">{formErrors.user_lname}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Suffix</label>
                                <input
                                    type="text"
                                    name="suffix_name"
                                    value={formData.suffix_name || ""}
                                    onChange={handleChange}
                                    placeholder="e.g. Jr, Sr, III"
                                    className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Nickname</label>
                                <input
                                    type="text"
                                    name="nickname"
                                    value={formData.nickname || ""}
                                    onChange={handleChange}
                                    className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <label className="text-sm font-medium text-foreground">Primary Role</label>
                                <input
                                    type="text"
                                    name="user_position"
                                    value={formData.user_position || ""}
                                    onChange={handleChange}
                                    placeholder="e.g. Senior Frontend Developer, Virtual Assistant"
                                    className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Contact Section */}
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 border-b pb-2">Contact</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Contact Number *</label>
                                <input
                                    type="text"
                                    name="user_contact"
                                    value={formData.user_contact || ""}
                                    onChange={handleChange}
                                    className={`flex h-11 md:h-10 w-full rounded-md border bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 ${
                                        formErrors.user_contact
                                            ? "border-destructive focus-visible:ring-destructive"
                                            : "border-input focus-visible:ring-ring"
                                    }`}
                                />
                                {formErrors.user_contact && (
                                    <p className="text-xs text-destructive font-medium">{formErrors.user_contact}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Personal Details Section */}
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 border-b pb-2">Personal Details</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Birthday *</label>
                                <input
                                    type="date"
                                    name="user_bday"
                                    min="1900-01-01"
                                    max={todayString}
                                    value={formData.user_bday ? formData.user_bday.slice(0, 10) : ""}
                                    onChange={handleBirthdayChange}
                                    className={`flex h-11 md:h-10 w-full rounded-md border bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 ${
                                        formErrors.user_bday
                                            ? "border-destructive focus-visible:ring-destructive"
                                            : "border-input focus-visible:ring-ring"
                                    }`}
                                />
                                {formErrors.user_bday && (
                                    <p className="text-xs text-destructive font-medium">{formErrors.user_bday}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Gender *</label>
                                <select
                                    name="gender"
                                    value={formData.gender || ""}
                                    onChange={handleChange}
                                    className={`flex h-11 md:h-10 w-full rounded-md border bg-transparent px-3 py-2 text-base md:text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 ${
                                        formErrors.gender
                                            ? "border-destructive focus-visible:ring-destructive"
                                            : "border-input focus-visible:ring-ring"
                                    }`}
                                >
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                                {formErrors.gender && (
                                    <p className="text-xs text-destructive font-medium">{formErrors.gender}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Civil Status</label>
                                <select
                                    name="civil_status"
                                    value={formData.civil_status || ""}
                                    onChange={handleChange}
                                    className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    <option value="">Select Status</option>
                                    <option value="Single">Single</option>
                                    <option value="Married">Married</option>
                                    <option value="Widowed">Widowed</option>
                                    <option value="Divorced">Divorced</option>
                                    <option value="Separated">Separated</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Blood Type</label>
                                <select
                                    name="blood_type"
                                    value={formData.blood_type || ""}
                                    onChange={handleChange}
                                    className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    <option value="">Select Type</option>
                                    <option value="A+">A+</option>
                                    <option value="A-">A-</option>
                                    <option value="B+">B+</option>
                                    <option value="B-">B-</option>
                                    <option value="AB+">AB+</option>
                                    <option value="AB-">AB-</option>
                                    <option value="O+">O+</option>
                                    <option value="O-">O-</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Nationality</label>
                                <input
                                    type="text"
                                    name="nationality"
                                    value={formData.nationality || ""}
                                    onChange={handleChange}
                                    className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <label className="text-sm font-medium text-foreground">Place of Birth</label>
                                <input
                                    type="text"
                                    name="place_of_birth"
                                    value={formData.place_of_birth || ""}
                                    onChange={handleChange}
                                    className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Address Section */}
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 border-b pb-2">Address</h3>
                        {locationError && (
                            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                                {locationError}
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Province *</label>
                                <div className={formErrors.user_province ? "rounded-md ring-1 ring-destructive" : ""}>
                                    <SearchableAddressSelect
                                        options={provinces}
                                        value={selectedProvinceCode}
                                        onChange={handleProvinceSelect}
                                        placeholder="Select Province"
                                        searchPlaceholder="Search province..."
                                    />
                                </div>
                                {formErrors.user_province && (
                                    <p className="text-xs text-destructive font-medium">{formErrors.user_province}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">City/Municipality *</label>
                                <div className={formErrors.user_city ? "rounded-md ring-1 ring-destructive" : ""}>
                                    <SearchableAddressSelect
                                        options={cities}
                                        value={selectedCityCode}
                                        onChange={handleCitySelect}
                                        placeholder="Select City/Municipality"
                                        searchPlaceholder="Search city/municipality..."
                                        disabled={!selectedProvinceCode || cities.length === 0}
                                    />
                                </div>
                                {formErrors.user_city && (
                                    <p className="text-xs text-destructive font-medium">{formErrors.user_city}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Barangay</label>
                                <SearchableAddressSelect
                                    options={barangays}
                                    value={formData.user_brgy || ""}
                                    onChange={handleBarangaySelect}
                                    placeholder="Select Barangay"
                                    searchPlaceholder="Search barangay..."
                                    disabled={!selectedCityCode || barangays.length === 0}
                                    matchByName={true}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Social Links Section */}
                    <div>
                        <div className="flex items-center justify-between border-b pb-2 mb-4">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Social Links</h3>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 gap-1 max-md:min-h-11"
                                onClick={() => setSocialLinks([...socialLinks, { id: -Date.now(), user_id: data.user_id, platform_name: 'Github', profile_url: '' }])}
                            >
                                <Plus className="h-4 w-4" /> Add Link
                            </Button>
                        </div>
                        <div className="space-y-4">
                            {socialLinks.map((link, idx) => {
                                const currentPlatformConfig = SOCIAL_PLATFORMS.find(
                                    (p) => p.name.toLowerCase() === (link.platform_name || "").toLowerCase()
                                );
                                const linkError = socialLinkErrors[link.id];

                                return (
                                    <div key={link.id} className="space-y-1">
                                        <div className="flex items-center gap-3 max-md:flex-wrap">
                                            <select
                                                value={link.platform_name}
                                                onChange={(e) => {
                                                    const newPlatform = e.target.value as VsUserSocialLink['platform_name'];
                                                    const newLinks = [...socialLinks];
                                                    newLinks[idx].platform_name = newPlatform;
                                                    setSocialLinks(newLinks);
                                                    // Re-validate if url has content
                                                    if (newLinks[idx].profile_url.trim()) {
                                                        const validation = validateSocialUrl(newPlatform, newLinks[idx].profile_url);
                                                        setSocialLinkErrors((prev) => ({
                                                            ...prev,
                                                            [link.id]: validation.isValid ? "" : (validation.error || "Invalid URL"),
                                                        }));
                                                    }
                                                }}
                                                className="flex h-11 md:h-10 w-44 shrink-0 rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-md:w-full"
                                            >
                                                {SOCIAL_PLATFORMS.map((platform) => (
                                                    <option key={platform.name} value={platform.name}>
                                                        {platform.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="url"
                                                placeholder={currentPlatformConfig?.placeholder || "https://example.com/profile"}
                                                value={link.profile_url}
                                                onChange={(e) => {
                                                    const newLinks = [...socialLinks];
                                                    newLinks[idx].profile_url = e.target.value;
                                                    setSocialLinks(newLinks);
                                                    if (socialLinkErrors[link.id]) {
                                                        const validation = validateSocialUrl(link.platform_name, e.target.value);
                                                        setSocialLinkErrors((prev) => ({
                                                            ...prev,
                                                            [link.id]: validation.isValid ? "" : (validation.error || "Invalid URL"),
                                                        }));
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    const val = e.target.value.trim();
                                                    if (val) {
                                                        const validation = validateSocialUrl(link.platform_name, val);
                                                        setSocialLinkErrors((prev) => ({
                                                            ...prev,
                                                            [link.id]: validation.isValid ? "" : (validation.error || "Invalid URL"),
                                                        }));
                                                    } else {
                                                        setSocialLinkErrors((prev) => {
                                                            const copy = { ...prev };
                                                            delete copy[link.id];
                                                            return copy;
                                                        });
                                                    }
                                                }}
                                                className={`flex h-11 md:h-10 w-full rounded-md border bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                                                    linkError ? "border-destructive focus-visible:ring-destructive" : "border-input"
                                                }`}
                                            />
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive max-md:size-11"
                                                onClick={() => {
                                                    const newLinks = [...socialLinks];
                                                    newLinks.splice(idx, 1);
                                                    setSocialLinks(newLinks);
                                                    setSocialLinkErrors((prev) => {
                                                        const copy = { ...prev };
                                                        delete copy[link.id];
                                                        return copy;
                                                    });
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        {linkError && (
                                            <p className="text-xs text-destructive font-medium pl-1">
                                                {linkError}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                            {socialLinks.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">No social links added yet.</p>
                            )}
                        </div>
                    </div>

                </div>

                <div className="p-6 border-t flex justify-end gap-3 shrink-0 bg-muted/20">
                    <Button variant="outline" onClick={onClose} className="max-md:min-h-11">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleApply}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 max-md:min-h-11"
                    >
                        Apply Changes
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./local-dialog";
import { toast } from "sonner";
import { useFreelancerProfileContext } from "../providers/FreelancerProfileProvider";
import type { VsEducation } from "../types/freelancer-profile.types";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { generateUUID } from "@/lib/utils";
import { fetchProvinces, fetchCities, type PsgcItem } from "@/lib/psgc";
import { SearchableAddressSelect } from "./SearchableAddressSelect";

interface EducationModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: number;
    educationToEdit?: VsEducation | null;
}

// Server-derived verification route for a school-search result, consumed
// verbatim from GET /api/freelancer/schools.
type FreelancerSchoolVerificationRoute =
    | "DIRECT_REVIEW"
    | "AWAITING_ACTIVATION"
    | "AWAITING_REGISTRATION";

interface FreelancerSchoolSearchResult {
    school_id: number;
    school_name: string;
    city_municipality: string | null;
    province: string | null;
    verification_route: FreelancerSchoolVerificationRoute;
}

export function EducationModal({ isOpen, onClose, userId, educationToEdit }: EducationModalProps) {
    const [schoolId, setSchoolId] = useState<string>("");
    const [courseId, setCourseId] = useState<string>("");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    
    const [schools, setSchools] = useState<FreelancerSchoolSearchResult[]>([]);
    const [courses, setCourses] = useState<any[] /* eslint-disable-line @typescript-eslint/no-explicit-any */>([]);
    const [loadingSchools, setLoadingSchools] = useState(false);
    const [loadingCourses, setLoadingCourses] = useState(false);
    const schoolSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const [isUnverifiedSchool, setIsUnverifiedSchool] = useState(false);
    const [isUnverifiedCourse, setIsUnverifiedCourse] = useState(false);
    const [rawSchoolName, setRawSchoolName] = useState("");
    const [rawCourseName, setRawCourseName] = useState("");
    const [rawProvince, setRawProvince] = useState("");
    const [rawCity, setRawCity] = useState("");
    const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
    const [selectedCityCode, setSelectedCityCode] = useState("");
    const [provinces, setProvinces] = useState<PsgcItem[]>([]);
    const [cities, setCities] = useState<PsgcItem[]>([]);
    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);
    const [provinceLoadError, setProvinceLoadError] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [schoolOpen, setSchoolOpen] = useState(false);
    const newDraftKeyRef = useRef<string | null>(null);

    const { data, pendingEducation, setEducationDraft } = useFreelancerProfileContext();
    const liveEducation = data?.education || [];
    const educationList = pendingEducation !== null ? pendingEducation : liveEducation;
    const isVerifiedEdit = educationToEdit?.education_status === "Verified";
    const isApprovedCourse = isVerifiedEdit && educationToEdit.course_verification?.status === "Approved";

    useEffect(() => {
        return () => {
            if (schoolSearchTimerRef.current) {
                clearTimeout(schoolSearchTimerRef.current);
            }
        };
    }, []);

    const fetchSchools = React.useCallback((query?: string) => {
        setLoadingSchools(true);
        const url = query && query.trim()
            ? `/api/freelancer/schools?search=${encodeURIComponent(query.trim())}`
            : `/api/freelancer/schools`;
        fetch(url)
            .then(async (res) => {
                const json: unknown = await res.json();
                if (
                    json &&
                    typeof json === "object" &&
                    Array.isArray((json as { schools?: unknown }).schools)
                ) {
                    setSchools((json as { schools: FreelancerSchoolSearchResult[] }).schools);
                } else {
                    setSchools([]);
                }
            })
            .catch((e) => {
                console.error(e);
                setSchools([]);
            })
            .finally(() => {
                setLoadingSchools(false);
            });
    }, []);

    const handleSchoolSearch = React.useCallback((term: string) => {
        if (schoolSearchTimerRef.current) {
            clearTimeout(schoolSearchTimerRef.current);
        }
        const query = term.trim();
        schoolSearchTimerRef.current = setTimeout(() => {
            fetchSchools(query);
        }, 300);
    }, [fetchSchools]);

    const loadProvinces = React.useCallback(async () => {
        setLoadingProvinces(true);
        setProvinceLoadError(null);
        try {
            setProvinces(await fetchProvinces());
        } catch (e) {
            console.error(e);
            setProvinceLoadError("Failed to load provinces. Please try again.");
        } finally {
            setLoadingProvinces(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen && isUnverifiedSchool) {
            loadProvinces();
        }
    }, [isOpen, isUnverifiedSchool, loadProvinces]);

    useEffect(() => {
        if (provinces.length > 0 && rawProvince) {
            const matched = provinces.find((p) => p.name === rawProvince);
            if (matched && matched.code !== selectedProvinceCode) {
                setSelectedProvinceCode(matched.code);
            }
        }
    }, [provinces, rawProvince, selectedProvinceCode]);

    useEffect(() => {
        if (!selectedProvinceCode) {
            setCities([]);
            return;
        }
        let isMounted = true;
        async function loadCities() {
            setLoadingCities(true);
            try {
                const data = await fetchCities(selectedProvinceCode);
                if (!isMounted) return;
                setCities(data);
            } catch (e) {
                console.error(e);
            } finally {
                if (isMounted) setLoadingCities(false);
            }
        }
        loadCities();
        return () => { isMounted = false; };
    }, [selectedProvinceCode]);

    useEffect(() => {
        if (cities.length > 0 && rawCity) {
            const matched = cities.find((c) => c.name === rawCity);
            if (matched && matched.code !== selectedCityCode) {
                setSelectedCityCode(matched.code);
            }
        }
    }, [cities, rawCity, selectedCityCode]);

    useEffect(() => {
        if (isOpen) {
            fetchSchools();
            if (educationToEdit) {
                if (educationToEdit.school_id) {
                    setSchoolId(String(educationToEdit.school_id));
                    setIsUnverifiedSchool(false);
                    setRawSchoolName("");
                    setRawProvince("");
                    setRawCity("");
                    setSelectedProvinceCode("");
                    setSelectedCityCode("");
                    setCities([]);
                } else {
                    setSchoolId("");
                    setIsUnverifiedSchool(true);
                    setRawSchoolName(educationToEdit.school_name_raw || "");
                    setRawProvince(educationToEdit.school_province_raw || "");
                    setRawCity(educationToEdit.school_city_raw || "");
                    setSelectedProvinceCode("");
                    setSelectedCityCode("");
                    setCities([]);
                }
                setIsUnverifiedCourse(Boolean(educationToEdit.school_id && !educationToEdit.school_course_id && educationToEdit.course_name_raw));
                setRawCourseName(educationToEdit.course_name_raw || "");
                setCourseId(educationToEdit.school_course_id ? String(educationToEdit.school_course_id) : "");
                setStartDate(educationToEdit.start_date ? educationToEdit.start_date.split("T")[0] : "");
                setEndDate(educationToEdit.end_date ? educationToEdit.end_date.split("T")[0] : "");
            } else {
                if (newDraftKeyRef.current === null) {
                    newDraftKeyRef.current = generateUUID();
                }
                setSchoolId("");
                setIsUnverifiedSchool(false);
                setIsUnverifiedCourse(false);
                setRawSchoolName("");
                setRawCourseName("");
                setRawProvince("");
                setRawCity("");
                setSelectedProvinceCode("");
                setSelectedCityCode("");
                setCities([]);
                setProvinceLoadError(null);
                setCourseId("");
                setStartDate("");
                setEndDate("");
            }
        }
    }, [isOpen, educationToEdit, fetchSchools]);

    useEffect(() => {
        async function fetchCourses(sId: string) {
            setLoadingCourses(true);
            try {
                const res = await fetch(`/api/freelancer/schools/${sId}/courses`);
                const json = await res.json();
                if (json.courses) setCourses(json.courses);
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingCourses(false);
            }
        }

        if (schoolId) {
            fetchCourses(schoolId);
        } else {
            setCourses([]);
        }
    }, [schoolId]);

    const schoolOptions = React.useMemo(() => {
        const opts = schools.map((s) => ({ value: String(s.school_id), label: String(s.school_name) }));
        if (educationToEdit?.school_id) {
            const v = String(educationToEdit.school_id);
            if (!opts.some((o) => o.value === v)) {
                opts.push({ value: v, label: educationToEdit.school_name || educationToEdit.school_name_raw || "Unknown School" });
            }
        }
        return opts;
    }, [schools, educationToEdit]);

    const selectedVerificationRoute: FreelancerSchoolVerificationRoute | null = React.useMemo(() => {
        if (isUnverifiedSchool || !schoolId) return null;
        const selected = schools.find((s) => String(s.school_id) === schoolId);
        return selected?.verification_route ?? null;
    }, [isUnverifiedSchool, schoolId, schools]);

    const showDirectReviewPanel = selectedVerificationRoute === "DIRECT_REVIEW";
    const showQueuedPanel =
        selectedVerificationRoute === "AWAITING_ACTIVATION" ||
        selectedVerificationRoute === "AWAITING_REGISTRATION";

    const courseOptions = React.useMemo(() => {
        const opts = courses.map((c) => ({ value: String(c.school_course_id), label: String(c.course_name) }));
        if (educationToEdit?.school_course_id) {
            const v = String(educationToEdit.school_course_id);
            if (!opts.some((o) => o.value === v)) {
                opts.push({ value: v, label: educationToEdit.course_name || educationToEdit.course_name_raw || "No Course Specified" });
            }
        }
        return opts;
    }, [courses, educationToEdit]);

    const handleSave = async () => {
        if (!isUnverifiedSchool && !schoolId) {
            toast.error("Please select a school.");
            return;
        }

        if (isUnverifiedSchool && !rawSchoolName.trim()) {
            toast.error("Please enter the school name.");
            return;
        }

        if (isUnverifiedSchool && !isVerifiedEdit) {
            if (!rawProvince.trim()) {
                toast.error("Please select the school province.");
                return;
            }
            if (!rawCity.trim()) {
                toast.error("Please select the school city or municipality.");
                return;
            }
        }

        if ((isUnverifiedSchool || isUnverifiedCourse) && !rawCourseName.trim()) {
            toast.error("Please enter the course/degree name.");
            return;
        }

        const draftKey = educationToEdit?.course_request_draft_key ?? newDraftKeyRef.current;
        if (!educationToEdit && !draftKey) {
            toast.error("Unable to prepare this education draft. Please reopen the form.");
            return;
        }

        const payload = {
            school_id: isUnverifiedSchool ? null : parseInt(schoolId, 10),
            school_name_raw: isUnverifiedSchool ? rawSchoolName.trim() : null,
            school_city_raw: isUnverifiedSchool ? rawCity.trim() : null,
            school_province_raw: isUnverifiedSchool ? rawProvince.trim() : null,
            course_name_raw: (isUnverifiedSchool || isUnverifiedCourse) ? rawCourseName.trim() : null,
            education_status: educationToEdit?.education_status ?? 'Pending' as const,
            course_request_draft_key: draftKey,
            school_course_id: (!isUnverifiedSchool && !isUnverifiedCourse && courseId) ? parseInt(courseId, 10) : null,
            start_date: startDate || null,
            end_date: endDate || null,
            updated_at: new Date().toISOString(),
            school_name: isUnverifiedSchool ? rawSchoolName.trim() : schoolOptions.find(o => o.value === schoolId)?.label,
            course_name: isUnverifiedSchool ? rawCourseName.trim() : courseOptions.find(o => o.value === courseId)?.label,
        };

        const updatedList = [...educationList];

        if (educationToEdit) {
            const index = updatedList.findIndex(e => e.id === educationToEdit.id);
            if (index >= 0) {
                updatedList[index] = { ...updatedList[index], ...payload } as VsEducation;
            }
        } else {
            updatedList.push({
                id: -Math.floor(Math.random() * 1000000), // temp id
                user_id: userId,
                ...payload
            } as VsEducation);
        }

        setEducationDraft(updatedList);
        if (!educationToEdit) {
            newDraftKeyRef.current = null;
        }
        onClose();
    };

    const confirmDelete = () => {
        if (!educationToEdit) return;
        
        const updatedList = educationList.filter(e => e.id !== educationToEdit.id);
        setEducationDraft(updatedList);
        setShowDeleteModal(false);
        onClose();
    };

    const handleDeleteClick = () => {
        setShowDeleteModal(true);
    };
    if (!isOpen) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background max-md:max-w-[calc(100vw-2rem)]">
                    <DialogHeader className="p-6 border-b shrink-0 flex flex-row items-center justify-between">
                        <DialogTitle className="text-xl font-semibold text-foreground">
                            {educationToEdit ? "Edit Education" : "Add Education"}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="p-6 overflow-y-auto flex-1 space-y-4 min-h-0">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">School Name *</label>
                            <div className="flex gap-2 flex-col">
                                {isUnverifiedSchool ? (
                                    <>
                                        <Input 
                                            value={rawSchoolName} 
                                            onChange={(e) => setRawSchoolName(e.target.value)} 
                                            placeholder="Enter school name" 
                                            disabled={isVerifiedEdit}
                                        />
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground">Province *</label>
                                            <SearchableAddressSelect
                                                options={provinces}
                                                value={selectedProvinceCode}
                                                onChange={(code, name) => { setSelectedProvinceCode(code); setRawProvince(name); setSelectedCityCode(""); setRawCity(""); }}
                                                placeholder="Select province"
                                                searchPlaceholder="Search province..."
                                                disabled={isVerifiedEdit}
                                                loading={loadingProvinces}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground">City / Municipality *</label>
                                            <SearchableAddressSelect
                                                options={cities}
                                                value={selectedCityCode}
                                                onChange={(code, name) => { setSelectedCityCode(code); setRawCity(name); }}
                                                placeholder="Select city / municipality"
                                                searchPlaceholder="Search city / municipality..."
                                                disabled={isVerifiedEdit || !selectedProvinceCode}
                                                loading={loadingCities}
                                            />
                                        </div>
                                        {provinceLoadError && (
                                            <div className="flex items-center justify-between gap-2 text-sm text-destructive">
                                                <span>{provinceLoadError}</span>
                                                <button type="button" onClick={loadProvinces} className="font-medium text-primary hover:underline">Retry</button>
                                            </div>
                                        )}
                                        {!isVerifiedEdit && (
                                            <div className="text-sm md:text-xs text-muted-foreground mt-1 text-right">
                                                Found your school? <button type="button" onClick={() => { setIsUnverifiedSchool(false); setRawSchoolName(""); setRawProvince(""); setRawCity(""); setSelectedProvinceCode(""); setSelectedCityCode(""); setCities([]); }} className="text-primary font-medium hover:underline">Select from list</button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Popover open={schoolOpen} onOpenChange={setSchoolOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={schoolOpen}
                                                    className={cn("w-full min-w-0 justify-between font-normal", !schoolId && "text-muted-foreground")}
                                                    disabled={isVerifiedEdit}
                                                >
                                                    <span className="truncate">
                                                        {schoolOptions.find((o) => o.value === schoolId)?.label || (loadingSchools ? "Loading schools..." : "Search for your school...")}
                                                    </span>
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                                <Command shouldFilter={false}>
                                                    <CommandInput
                                                        className="text-base md:text-sm"
                                                        placeholder="Search for your school..."
                                                        onValueChange={handleSchoolSearch}
                                                    />
                                                    <CommandList>
                                                        {loadingSchools ? (
                                                            <div className="py-6 text-center text-sm text-muted-foreground">Loading schools...</div>
                                                        ) : schoolOptions.length === 0 ? (
                                                            <CommandEmpty>No results found.</CommandEmpty>
                                                        ) : (
                                                            <CommandGroup>
                                                                {schoolOptions.map((opt) => (
                                                                    <CommandItem
                                                                        key={opt.value}
                                                                        value={`${opt.label}__${opt.value}`}
                                                                        onSelect={() => {
                                                                            setSchoolId(opt.value);
                                                                            setCourseId("");
                                                                            setIsUnverifiedCourse(false);
                                                                            setRawCourseName("");
                                                                            setRawProvince("");
                                                                            setRawCity("");
                                                                            setSelectedProvinceCode("");
                                                                            setSelectedCityCode("");
                                                                            setCities([]);
                                                                            setSchoolOpen(false);
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4 shrink-0",
                                                                                schoolId === opt.value ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        <span className="min-w-0 flex-1 break-words">{opt.label}</span>
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        )}
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        {!isVerifiedEdit && (
                                            <div className="text-sm md:text-xs text-muted-foreground mt-1 text-right">
                                                Can&apos;t find your school? <button type="button" onClick={() => { setIsUnverifiedSchool(true); setIsUnverifiedCourse(false); setSchoolId(""); setCourseId(""); }} className="text-primary font-medium hover:underline">Request to add school</button>
                                            </div>
                                        )}
                                        {showDirectReviewPanel && (
                                            <div
                                                data-testid="school-verification-panel"
                                                role="status"
                                                className="rounded-md border border-input bg-muted/40 px-4 py-3"
                                            >
                                                <p className="text-sm font-medium text-foreground">School verification available</p>
                                                <p className="mt-1 text-sm text-muted-foreground">This school can review your education request. Your education will remain Pending until the school approves it.</p>
                                            </div>
                                        )}
                                        {showQueuedPanel && (
                                            <div
                                                data-testid="school-queued-panel"
                                                role="status"
                                                className="rounded-md border border-input bg-muted/40 px-4 py-3"
                                            >
                                                <p className="text-sm font-medium text-foreground">School not yet active</p>
                                                <p className="mt-1 text-sm text-muted-foreground">This school is not yet accepting verifications. Your request will be queued and routed automatically once the school is active.</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            {isVerifiedEdit && (
                                <p data-testid="verified-school-lock" className="text-sm text-muted-foreground">
                                    School is locked after attendance verification. You can still update the dates.
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Course / Degree (Optional)</label>
                            <div className="flex gap-2 flex-col">
                                {isUnverifiedSchool || isUnverifiedCourse ? (
                                    <>
                                    <Input 
                                        value={rawCourseName} 
                                        onChange={(e) => setRawCourseName(e.target.value)} 
                                        placeholder="Enter course or degree" 
                                        disabled={isApprovedCourse}
                                    />
                                    {isUnverifiedCourse && !isApprovedCourse && (
                                        <div className="text-sm md:text-xs text-muted-foreground mt-1 text-right">
                                            Found your course? <button type="button" onClick={() => { setIsUnverifiedCourse(false); setRawCourseName(""); }} className="text-primary font-medium hover:underline">Select from list</button>
                                        </div>
                                    )}
                                    </>
                                ) : (
                                    <>
                                        <SearchableSelect
                                            options={courseOptions}
                                            value={courseId}
                                            onValueChange={setCourseId}
                                            placeholder={loadingCourses ? "Loading courses..." : (schoolId ? "Search courses..." : "Select a school first")}
                                            disabled={!schoolId || loadingCourses || isApprovedCourse}
                                        />
                                        {schoolId && !isApprovedCourse && (
                                            <div className="text-sm md:text-xs text-muted-foreground mt-1 text-right">
                                                Can&apos;t find your course? <button type="button" onClick={() => { setIsUnverifiedCourse(true); setCourseId(""); }} className="text-primary font-medium hover:underline">Enter it manually</button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            {isApprovedCourse ? (
                                <p data-testid="approved-course-lock" className="text-sm text-muted-foreground">
                                    This course is approved and cannot be changed. Add a new education record to use a different course.
                                </p>
                            ) : isVerifiedEdit ? (
                                <p data-testid="verified-course-review-note" className="text-sm text-muted-foreground">
                                    Changing this course will submit it for review while keeping your attendance verified.
                                </p>
                            ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Start Date (Optional)</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">End Date (Optional)</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 border-t flex justify-end gap-3 shrink-0 bg-muted/20">
                        {educationToEdit && (
                            <Button variant="destructive" onClick={handleDeleteClick} className="mr-auto max-md:min-h-11">Delete</Button>
                        )}
                        <Button variant="outline" onClick={onClose} className="max-md:min-h-11">Cancel</Button>
                        <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90 max-md:min-h-11">
                            Save Education
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Education</AlertDialogTitle>
                        <AlertDialogDescription>
                                    Are you sure you want to delete this education record? This permanently removes the education, its verified attendance record, and any linked requests. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="max-md:min-h-11">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 max-md:min-h-11"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./local-dialog";
import { Pencil } from "lucide-react";
import { VsWorkExperience, VsMasterSkill } from "../types/freelancer-profile.types";
import { WorkExperienceSkillsInput } from "./WorkExperienceSkillsInput";
import { WorkExperienceMediaInput } from "./WorkExperienceMediaInput";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFreelancerProfileContext } from "../providers/FreelancerProfileProvider";
import { formatAssetUrl } from "@/lib/utils";

function formatDisplayDate(dateStr: string) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function calculateDuration(start: string, end: string | null, isCurrent: boolean) {
    if (!start) return "";
    const startDate = new Date(start);
    const endDate = isCurrent || !end ? new Date() : new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "";

    let months = (endDate.getFullYear() - startDate.getFullYear()) * 12;
    months -= startDate.getMonth();
    months += endDate.getMonth();
    
    months += 1; // Inclusive

    if (months <= 0) return "1 mo";

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    const parts = [];
    if (years > 0) parts.push(`${years} yr${years > 1 ? 's' : ''}`);
    if (remainingMonths > 0) parts.push(`${remainingMonths} mo${remainingMonths > 1 ? 's' : ''}`);

    return parts.join(" ");
}

interface WorkExperienceItemProps {
    experience: VsWorkExperience;
    userId: number;
    isLast: boolean;
}

export function WorkExperienceItem({ experience, isLast }: Omit<WorkExperienceItemProps, 'userId'> & { userId?: number }) {
    const [isEditing, setIsEditing] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    
    // Form state
    const [companyName, setCompanyName] = useState(experience.company_name);
    const [jobTitle, setJobTitle] = useState(experience.job_title);
    const [startDate, setStartDate] = useState(experience.start_date || "");
    const [endDate, setEndDate] = useState(experience.end_date || "");
    const [isCurrentRole, setIsCurrentRole] = useState(experience.is_current_role);
    const [jobDescription, setJobDescription] = useState(experience.job_description || "");
    const [location, setLocation] = useState(experience.location || "");
    const [locationType, setLocationType] = useState(experience.location_type || "");
    const [employmentType, setEmploymentType] = useState(experience.employment_type || "");
    const [selectedSkills, setSelectedSkills] = useState<VsMasterSkill[]>(
        (experience.skills?.map(s => s.skill).filter(Boolean) as VsMasterSkill[]) || []
    );
    const [mediaUrls, setMediaUrls] = useState<string[]>(
        experience.media?.map(m => m.media_url) || []
    );

    const [error, setError] = useState<string | null>(null);

    // Sync local state whenever the parent re-fetches the experience data (e.g. after save)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMediaUrls(experience.media?.map(m => m.media_url) || []);
        setSelectedSkills((experience.skills?.map(s => s.skill).filter(Boolean) as VsMasterSkill[]) || []);
    }, [experience]);

    const { data, pendingWorkExperience, setWorkExperienceDraft } = useFreelancerProfileContext();
    const liveExperience = data?.work_experience || [];
    const experienceList = pendingWorkExperience !== null ? pendingWorkExperience : liveExperience;

    const handleSave = async () => {
        if (!companyName.trim() || !jobTitle.trim() || !startDate) {
            setError("Company name, job title, and start date are required.");
            return;
        }

        const today = new Date().toISOString().split("T")[0];
        if (startDate > today) {
            setError("Start date cannot be in the future.");
            return;
        }

        if (!isCurrentRole && endDate && endDate < startDate) {
            setError("End date cannot be earlier than start date.");
            return;
        }

        const payload = {
            company_name: companyName,
            job_title: jobTitle,
            start_date: startDate,
            end_date: isCurrentRole ? null : (endDate || null),
            is_current_role: isCurrentRole,
            job_description: jobDescription || null,
            location: location || null,
            location_type: locationType || null,
            employment_type: employmentType || null,
            skills: selectedSkills.map(s => ({ skill_id: s.id, skill: s })),
            media: mediaUrls.map((url) => ({ id: -Math.floor(Math.random() * 1000000), media_url: url, experience_id: experience.id, media_type: 'image', media_title: null, media_description: null }))
        };

        const updatedList = [...experienceList];
        const index = updatedList.findIndex(e => e.id === experience.id);
        if (index >= 0) {
            updatedList[index] = { ...updatedList[index], ...payload } as VsWorkExperience;
        }

        setWorkExperienceDraft(updatedList);
        setIsEditing(false);
    };

    const confirmDelete = () => {
        const updatedList = experienceList.filter(e => e.id !== experience.id);
        setWorkExperienceDraft(updatedList);
        setShowDeleteModal(false);
    };

    const handleDeleteClick = () => {
        setShowDeleteModal(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setCompanyName(experience.company_name);
        setJobTitle(experience.job_title);
        setStartDate(experience.start_date || "");
        setEndDate(experience.end_date || "");
        setIsCurrentRole(experience.is_current_role);
        setJobDescription(experience.job_description || "");
        setLocation(experience.location || "");
        setLocationType(experience.location_type || "");
        setEmploymentType(experience.employment_type || "");
        setSelectedSkills((experience.skills?.map(s => s.skill).filter(Boolean) as VsMasterSkill[]) || []);
        setMediaUrls(experience.media?.map(m => m.media_url) || []);
        setError(null);
    };

    return (
        <div className="relative">
            {isEditing && (
                <Dialog open={isEditing} onOpenChange={handleCancel}>
                    <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background max-md:max-w-[calc(100vw-2rem)]">
                        <DialogHeader className="p-6 border-b shrink-0 flex flex-row items-center justify-between">
                            <DialogTitle className="text-xl font-semibold text-foreground">Edit Work Experience</DialogTitle>
                        </DialogHeader>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4 min-h-0">
                            {error && (
                    <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                        {error}
                    </div>
                )}
                
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Company Name *</label>
                            <input
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                className="flex h-11 md:h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base md:text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Job Title *</label>
                            <input
                                type="text"
                                value={jobTitle}
                                onChange={(e) => setJobTitle(e.target.value)}
                                className="flex h-11 md:h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base md:text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Location</label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="flex h-11 md:h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base md:text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Location Type</label>
                            <select
                                value={locationType}
                                onChange={(e) => setLocationType(e.target.value)}
                                className="flex h-11 md:h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base md:text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="">Select Type</option>
                                <option value="On-site">On-site</option>
                                <option value="Hybrid">Hybrid</option>
                                <option value="Remote">Remote</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Employment Type</label>
                            <select
                                value={employmentType}
                                onChange={(e) => setEmploymentType(e.target.value)}
                                className="flex h-11 md:h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base md:text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="">Select Type</option>
                                <option value="Full-time">Full-time</option>
                                <option value="Part-time">Part-time</option>
                                <option value="Contract">Contract</option>
                                <option value="Freelance">Freelance</option>
                                <option value="Internship">Internship</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Start Date *</label>
                            <input
                                type="date"
                                value={startDate}
                                max={new Date().toISOString().split("T")[0]}
                                min="1960-01-01"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const yearPart = val.split("-")[0];
                                    if (yearPart && yearPart.length > 4) return;
                                    setStartDate(val);
                                }}
                                className="flex h-11 md:h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base md:text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">End Date</label>
                            <input
                                type="date"
                                value={endDate}
                                min={startDate || "1960-01-01"}
                                max="2099-12-31"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const yearPart = val.split("-")[0];
                                    if (yearPart && yearPart.length > 4) return;
                                    setEndDate(val);
                                }}
                                className="flex h-11 md:h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base md:text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isCurrentRole}
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 max-md:min-h-11 max-md:items-center">
                        <input
                            type="checkbox"
                            id={`isCurrentRole-${experience.id}`}
                            checked={isCurrentRole}
                            onChange={(e) => {
                                setIsCurrentRole(e.target.checked);
                                if (e.target.checked) setEndDate("");
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor={`isCurrentRole-${experience.id}`} className="text-sm font-medium text-foreground cursor-pointer">
                            I currently work here
                        </label>
                    </div>

                    <div className="pt-2">
                        <WorkExperienceSkillsInput
                            selectedSkills={selectedSkills}
                            onChange={setSelectedSkills}
                        />
                    </div>

                    <div className="space-y-2 pt-2">
                        <label className="text-sm font-medium text-foreground">Description</label>
                        <textarea
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            className="w-full min-h-[100px] p-2 rounded-md border border-input bg-transparent text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>
                            <div className="pt-4 border-t">
                                <WorkExperienceMediaInput
                                    mediaUrls={mediaUrls}
                                    onChange={setMediaUrls}
                                />
                            </div>
                        </div>
                        </div>

                        <div className="flex justify-end gap-2 p-6 border-t shrink-0">
                            <Button variant="destructive" onClick={handleDeleteClick} className="mr-auto max-md:min-h-11">
                                Delete
                            </Button>
                            <Button variant="outline" onClick={handleCancel} className="max-md:min-h-11">
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleSave} 
                                className="bg-primary text-primary-foreground hover:bg-primary/90 max-md:min-h-11"
                            >
                                Save Experience
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
            {!isLast && (
                <div className="absolute top-8 bottom-0 left-2 w-px bg-border -ml-px" />
            )}
            <div className="flex gap-4">
                <div className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 mt-1.5">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
                <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-lg text-foreground">{experience.job_title}</h4>
                        <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-8 w-8 rounded-full text-primary hover:bg-primary/10 hover:text-primary max-md:size-11">
                            <Pencil className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="text-sm font-medium text-foreground">
                        {experience.company_name} {experience.employment_type ? `· ${experience.employment_type}` : ''}
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {formatDisplayDate(experience.start_date)} - {experience.is_current_role ? "Present" : formatDisplayDate(experience.end_date || "")} · {calculateDuration(experience.start_date, experience.end_date, experience.is_current_role)}
                    </div>
                    {(experience.location || experience.location_type) && (
                        <div className="text-sm text-muted-foreground">
                            {[experience.location, experience.location_type].filter(Boolean).join(" · ")}
                        </div>
                    )}
                    {experience.job_description && (
                        <p className="text-sm text-foreground mt-4 leading-relaxed whitespace-pre-wrap">
                            {experience.job_description}
                        </p>
                    )}
                    {experience.media && experience.media.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {experience.media.map((m: { id?: number; media_url?: string; media_title?: string | null }) => {
                                const urlStr = m.media_url || m.id || "";
                                if (!urlStr || typeof urlStr !== 'string') return null;

                                const previewUrl = formatAssetUrl(urlStr) || "";
                                
                                return (
                                    <div key={m.id || urlStr} className="relative w-[120px] h-[70px] bg-muted rounded-md overflow-hidden border border-border shadow-sm transition-all hover:shadow-md cursor-pointer flex-shrink-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={previewUrl} alt={m.media_title || "Media"} className="object-cover w-full h-full" />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {experience.skills && experience.skills.length > 0 && (
                        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-foreground">
                            <span className="flex items-center justify-center">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M6 3h12l4 6-10 12L2 9l4-6z"/></svg>
                            </span>
                            <span>
                                {experience.skills.slice(0, 2).map(s => s.skill?.skill_name).filter(Boolean).join(", ")}
                                {experience.skills.length > 2 ? ` and +${experience.skills.length - 2} skill${experience.skills.length - 2 > 1 ? 's' : ''}` : ''}
                            </span>
                        </div>
                    )}
                </div>
            </div>
            
            <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Work Experience</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this work experience? This action cannot be undone.
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
        </div>
    );
}

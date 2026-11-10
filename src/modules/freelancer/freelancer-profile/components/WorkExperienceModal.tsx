/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./local-dialog";
import { useFreelancerProfileContext } from "../providers/FreelancerProfileProvider";
import { VsMasterSkill, VsWorkExperience } from "../types/freelancer-profile.types";
import { WorkExperienceSkillsInput } from "./WorkExperienceSkillsInput";
import { WorkExperienceMediaInput } from "./WorkExperienceMediaInput";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface WorkExperienceModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: number;
    experienceToEdit?: VsWorkExperience | null;
}

export function WorkExperienceModal({ isOpen, onClose, userId, experienceToEdit }: WorkExperienceModalProps) {
    const [companyName, setCompanyName] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [isCurrentRole, setIsCurrentRole] = useState(false);
    const [jobDescription, setJobDescription] = useState("");
    const [location, setLocation] = useState("");
    const [locationType, setLocationType] = useState("");
    const [employmentType, setEmploymentType] = useState("");
    const [selectedSkills, setSelectedSkills] = useState<VsMasterSkill[]>([]);
    const [mediaUrls, setMediaUrls] = useState<string[]>([]);
    
    const [error, setError] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const { data, pendingWorkExperience, setWorkExperienceDraft } = useFreelancerProfileContext();

    const liveExperience = data?.work_experience || [];
    const experienceList = pendingWorkExperience !== null ? pendingWorkExperience : liveExperience;

    React.useEffect(() => {
        if (isOpen) {
            if (experienceToEdit) {
                setCompanyName(experienceToEdit.company_name || "");
                setJobTitle(experienceToEdit.job_title || "");
                setStartDate(experienceToEdit.start_date ? experienceToEdit.start_date.split("T")[0] : "");
                setEndDate(experienceToEdit.end_date ? experienceToEdit.end_date.split("T")[0] : "");
                setIsCurrentRole(experienceToEdit.is_current_role || false);
                setJobDescription(experienceToEdit.job_description || "");
                setLocation(experienceToEdit.location || "");
                setLocationType(experienceToEdit.location_type || "");
                setEmploymentType(experienceToEdit.employment_type || "");
                // map skills from experienceToEdit to VsMasterSkill[] format expected by Input if available
                setSelectedSkills(experienceToEdit.skills?.map(s => s.skill).filter(Boolean) as VsMasterSkill[] || []);
                setMediaUrls(experienceToEdit.media?.map(m => m.media_url) || []);
            } else {
                setCompanyName("");
                setJobTitle("");
                setStartDate("");
                setEndDate("");
                setIsCurrentRole(false);
                setJobDescription("");
                setLocation("");
                setLocationType("");
                setEmploymentType("");
                setSelectedSkills([]);
                setMediaUrls([]);
            }
            setError(null);
        }
    }, [isOpen, experienceToEdit]);

    if (!isOpen) return null;

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

        setError(null);
        
        const payload = {
            company_name: companyName,
            location: location,
            location_type: locationType,
            job_title: jobTitle,
            employment_type: employmentType,
            start_date: startDate,
            end_date: isCurrentRole ? null : (endDate || null),
            is_current_role: isCurrentRole,
            job_description: jobDescription,
            skills: selectedSkills.map(s => ({ skill_id: s.id })),
            media: mediaUrls.map(url => ({
                media_type: "image",
                media_url: url
            })),
        };

        const updatedList = [...experienceList];

        if (experienceToEdit) {
            const index = updatedList.findIndex(e => e.id === experienceToEdit.id);
            if (index >= 0) {
                updatedList[index] = { ...updatedList[index], ...payload } as VsWorkExperience;
            }
        } else {
            updatedList.push({
                id: -Math.floor(Math.random() * 1000000), // temp id
                user_id: userId,
                ...payload
            } as VsWorkExperience);
        }

        setWorkExperienceDraft(updatedList);
        onClose();
    };

    const confirmDelete = () => {
        if (!experienceToEdit) return;
        
        const updatedList = experienceList.filter(e => e.id !== experienceToEdit.id);
        setWorkExperienceDraft(updatedList);
        setShowDeleteModal(false);
        onClose();
    };

    const handleDeleteClick = () => {
        setShowDeleteModal(true);
    };

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background max-md:max-w-[calc(100vw-2rem)]">
                <DialogHeader className="p-6 border-b shrink-0 flex flex-row items-center justify-between">
                    <DialogTitle className="text-xl font-semibold text-foreground">
                        {experienceToEdit ? "Edit Work Experience" : "Add Work Experience"}
                    </DialogTitle>
                </DialogHeader>
                
                <div className="p-6 overflow-y-auto flex-1 space-y-4 min-h-0">
                    {error && (
                        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                            {error}
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Company Name *</label>
                        <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="e.g. Acme Corp"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Job Title *</label>
                        <input
                            type="text"
                            value={jobTitle}
                            onChange={(e) => setJobTitle(e.target.value)}
                            className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="e.g. Software Engineer"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Location</label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="e.g. Metro Manila"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Location Type</label>
                            <select
                                value={locationType}
                                onChange={(e) => setLocationType(e.target.value)}
                                className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="">Select Type</option>
                                <option value="On-site">On-site</option>
                                <option value="Hybrid">Hybrid</option>
                                <option value="Remote">Remote</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Employment Type</label>
                        <select
                            value={employmentType}
                            onChange={(e) => setEmploymentType(e.target.value)}
                            className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="">Select Type</option>
                            <option value="Full-time">Full-time</option>
                            <option value="Part-time">Part-time</option>
                            <option value="Contract">Contract</option>
                            <option value="Freelance">Freelance</option>
                            <option value="Internship">Internship</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
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
                                className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                                className="flex h-11 md:h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isCurrentRole}
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2 max-md:min-h-11 max-md:items-center">
                        <input
                            type="checkbox"
                            id="isCurrentRole"
                            checked={isCurrentRole}
                            onChange={(e) => {
                                setIsCurrentRole(e.target.checked);
                                if (e.target.checked) setEndDate("");
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor="isCurrentRole" className="text-sm font-medium text-foreground cursor-pointer">
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
                            className="w-full min-h-[120px] p-3 rounded-md border border-input bg-transparent text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Describe your responsibilities and achievements..."
                        />
                    </div>

                    <div className="pt-4 border-t">
                        <WorkExperienceMediaInput
                            mediaUrls={mediaUrls}
                            onChange={setMediaUrls}
                        />
                    </div>
                </div>

                <div className="p-6 border-t flex justify-end gap-3 shrink-0 bg-muted/20">
                    {experienceToEdit && (
                        <Button 
                            variant="destructive" 
                            onClick={handleDeleteClick} 
                            className="mr-auto max-md:min-h-11"
                        >
                            Delete
                        </Button>
                    )}
                    <Button variant="outline" onClick={onClose} className="max-md:min-h-11">
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
        <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Work Experience</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete this experience record? This action cannot be undone.
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

"use client";

import React, { useState, useRef } from "react";
import { FileUp, FileText, Download, Trash2, Globe, Lock, Users, Star, Loader2 } from "lucide-react";
import { useFreelancerProfileContext } from "../providers/FreelancerProfileProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VisibilityModal } from "./VisibilityModal";
import { UploadOptionsModal } from "./UploadOptionsModal";
import { AutofillConfirmModal } from "./AutofillConfirmModal";
import { DeleteResumeModal } from "./DeleteResumeModal";
import { uploadResumeAction, setPrimaryResumeAction, deleteResumeAction, uploadAndAutofillResumeAction } from "../services/resumes/resumes.actions";
import { resolveSkillsAction } from "../services/freelancer-profile.actions";
import { toast } from "sonner";
import { VsJobSeekerResume } from "../types/freelancer-profile.types";

export function ResumeSidebar() {
    const { 
        data, 
        pendingVisibility, 
        refresh, 
        updateProfile,
        isAutofilling, 
        setIsAutofilling,
        setProfessionalSummaryDraft,
        setWorkExperienceDraft,
        setEducationDraft,
        setSkillsDraft
    } = useFreelancerProfileContext();
    const [isVisibilityModalOpen, setIsVisibilityModalOpen] = useState(false);
    
    // Modal states
    const [isUploadOptionsOpen, setIsUploadOptionsOpen] = useState(false);
    const [isAutofillConfirmOpen, setIsAutofillConfirmOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    
    const [activeSection, setActiveSection] = useState("resume");

    // Data states
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [resumeToDelete, setResumeToDelete] = useState<{ id: number, name: string } | null>(null);
    const [updatingResumeId, setUpdatingResumeId] = useState<number | null>(null);
    
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!data) return null;

    const profile = data.job_seeker_profile?.[0];
    const visibility = pendingVisibility ?? profile?.profile_visibility ?? "Public";
    
    // Fallback array if no resumes
    const resumes = data.resumes || [];
    const primaryResume = resumes.find(r => r.is_primary);
    const historyResumes = resumes.filter(r => !r.is_primary).sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (file.size > 10 * 1024 * 1024) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            toast.error(`File is too large (${sizeMB}MB). Maximum allowed size is 10MB.`);
            return;
        }

        setSelectedFile(file);
        setIsUploadOptionsOpen(true);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const processUpload = async (file: File, isAutofill: boolean) => {
        setIsUploading(true);
        if (isAutofill) setIsAutofilling(true);
        
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("folder", "c380f14b-75d1-4b61-b2b4-9a6e596f3162");
            
            let res: { success: boolean; parsedData?: import("@/lib/gemini/resumeParser").ParsedResumeData; error?: string; record?: unknown } | undefined;
            if (isAutofill) {
                const currentProfileJson = JSON.stringify(data);
                res = await uploadAndAutofillResumeAction(data.user_id, formData, file.name, currentProfileJson);
            } else {
                res = await uploadResumeAction(data.user_id, formData, file.name);
            }
            
            if (res.success) {
                if (isAutofill && res.parsedData) {
                    const parsed = res.parsedData;
                    
                    if (parsed.professional_summary) {
                        setProfessionalSummaryDraft(parsed.professional_summary);
                    }
                    const sanitizeDate = (d: unknown): string | null => {
                        if (!d || typeof d !== "string") return null;
                        const trimmed = d.trim();
                        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
                        const dateObj = new Date(trimmed);
                        if (!isNaN(dateObj.getTime())) {
                            return dateObj.toISOString().split("T")[0];
                        }
                        return null;
                    };

                    if (parsed.work_experience && parsed.work_experience.length > 0) {
                        const newWorkExp = parsed.work_experience.map((we: { job_title: string; company_name: string; start_date: string; end_date: string | null; description: string }, i: number) => {
                            const existingMatch = data.work_experience?.find(
                                (exp) => exp.company_name.trim().toLowerCase() === we.company_name.trim().toLowerCase() && 
                                         exp.job_title.trim().toLowerCase() === we.job_title.trim().toLowerCase()
                            );
                            
                            return {
                                id: existingMatch ? existingMatch.id : -(Date.now() + i),
                                user_id: data.user_id,
                                job_title: we.job_title,
                                company_name: we.company_name,
                                start_date: sanitizeDate(we.start_date) || new Date().toISOString().split("T")[0],
                                end_date: sanitizeDate(we.end_date),
                                job_description: we.description,
                                is_current_role: !we.end_date,
                                location: existingMatch?.location || null,
                                location_type: existingMatch?.location_type || null,
                                employment_type: existingMatch?.employment_type || null,
                                discovery_source: existingMatch?.discovery_source || null
                            };
                        });
                        setWorkExperienceDraft(newWorkExp);
                    }
                    if (parsed.education && parsed.education.length > 0) {
                        const newEdu = parsed.education.map((ed: { school_name: string; course_name: string; start_date: string; end_date: string | null }, i: number) => {
                            const existingMatch = data.education?.find(
                                (exp) => (exp.school_name_raw?.trim().toLowerCase() === ed.school_name.trim().toLowerCase() || exp.school_name?.trim().toLowerCase() === ed.school_name.trim().toLowerCase())
                            );
                            
                            return {
                                id: existingMatch ? (existingMatch.id || -(Date.now() + i)) : -(Date.now() + i),
                                user_id: data.user_id,
                                school_name_raw: ed.school_name,
                                course_name_raw: ed.course_name,
                                start_date: sanitizeDate(ed.start_date),
                                end_date: sanitizeDate(ed.end_date),
                                education_status: existingMatch?.education_status || 'Pending' as const,
                                course_request_draft_key: existingMatch?.course_request_draft_key || crypto.randomUUID(),
                                school_id: existingMatch?.school_id || null,
                                school_course_id: existingMatch?.school_course_id || null
                            };
                        });
                        setEducationDraft(newEdu);
                    }
                    if (parsed.skills && parsed.skills.length > 0) {
                        const resolvedSkills = await resolveSkillsAction(parsed.skills);
                        const newSkills = resolvedSkills.map((rs: { id: number; skill_name: string }) => {
                            // Deduplicate existing skills
                            const existing = data.skills?.find(s => s.skill?.id === rs.id || s.skill_id === rs.id);
                            if (existing) return null;

                            return {
                                user_id: data.user_id,
                                skill_id: rs.id,
                                skill: { id: rs.id, skill_name: rs.skill_name }
                            };
                        }).filter(Boolean);
                        
                        setSkillsDraft(newSkills as import("../types/freelancer-profile.types").VsUserSkillMap[]);
                    }
                    
                    toast.success("Resume uploaded and profile autofilled! Please review and save your changes.");
                } else {
                    toast.success("Resume uploaded successfully!");
                }
                refresh();
            } else {
                toast.error(res.error || "Failed to process resume");
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "An unexpected error occurred";
            toast.error(msg);
        } finally {
            setIsUploading(false);
            if (isAutofill) setIsAutofilling(false);
            setSelectedFile(null);
        }
    };

    const handleUploadOnly = () => {
        setIsUploadOptionsOpen(false);
        if (selectedFile) processUpload(selectedFile, false);
    };

    const handleUploadAndAutofill = () => {
        setIsUploadOptionsOpen(false);
        setIsAutofillConfirmOpen(true);
    };

    const handleConfirmAutofill = () => {
        setIsAutofillConfirmOpen(false);
        if (selectedFile) processUpload(selectedFile, true);
    };

    const handleMakePrimary = async (resumeId: number) => {
        const previousResumes = data.resumes || [];
        const optimisticResumes = previousResumes.map(r => ({
            ...r,
            is_primary: r.id === resumeId
        }));

        // Instant optimistic update (0ms UI latency)
        updateProfile({ resumes: optimisticResumes });
        setUpdatingResumeId(resumeId);

        try {
            const res = await setPrimaryResumeAction(data.user_id, resumeId);
            if (res.success) {
                toast.success("Primary resume updated");
            } else {
                // Roll back to previous state if backend operation fails
                updateProfile({ resumes: previousResumes });
                toast.error(res.error || "Failed to set primary resume");
            }
        } catch {
            // Roll back on network or unexpected exception
            updateProfile({ resumes: previousResumes });
            toast.error("An unexpected error occurred");
        } finally {
            setUpdatingResumeId(null);
        }
    };

    const promptDelete = (id: number, name: string) => {
        setResumeToDelete({ id, name });
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!resumeToDelete) return;
        
        setIsDeleteModalOpen(false);
        try {
            const res = await deleteResumeAction(resumeToDelete.id);
            if (res.success) {
                toast.success("Resume deleted");
                refresh();
            } else {
                toast.error(res.error || "Failed to delete resume");
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setResumeToDelete(null);
        }
    };

    return (
        <div className="space-y-6">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".pdf,.doc,.docx" 
                className="hidden" 
            />
            
            {/* Mobile-only section tabs (desktop keeps every section stacked) */}
            <div className="md:hidden flex items-center gap-1 rounded-xl border bg-card p-1">
                {[
                    { key: "resume", label: "Resume" },
                    { key: "primary", label: "Primary Document" },
                    ...(historyResumes.length > 0 ? [{ key: "history", label: "Document History" }] : []),
                    { key: "visibility", label: "Visibility" },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveSection(tab.key)}
                        className={`flex-1 min-h-10 rounded-lg px-2 py-1 text-[11px] leading-tight text-center font-medium transition-colors ${activeSection === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className={`border border-dashed rounded-xl p-8 text-center bg-card flex flex-col items-center justify-center space-y-4 max-md:p-6${activeSection === "resume" ? "" : " max-md:hidden"}`}>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-foreground">Resume/CV</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-[200px] mx-auto">
                        Upload your latest professional document. PDF, DOCX (Max 10MB)
                    </p>
                </div>
                <Button 
                    className="w-full sm:w-auto font-medium max-md:min-h-11"
                    onClick={handleUploadClick}
                    disabled={isUploading || isAutofilling}
                >
                    {isUploading || isAutofilling ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <PlusIcon className="mr-2 h-4 w-4" />
                    )}
                    {isUploading || isAutofilling ? "Processing..." : "Upload New File"}
                </Button>
            </div>

            <div className={`bg-card text-card-foreground border rounded-xl shadow-sm p-6 space-y-6${activeSection === "primary" ? "" : " max-md:hidden"}`}>
                <h3 className="text-sm md:text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Star className="h-3 w-3 fill-primary text-primary" />
                    Primary Document
                </h3>
                
                {primaryResume ? (
                    <ResumeItem 
                        resume={primaryResume} 
                        onDelete={() => promptDelete(primaryResume.id, primaryResume.file_name || "Document")}
                        isPrimary={true}
                    />
                ) : (
                    <p className="text-sm text-muted-foreground italic">No primary document.</p>
                )}
            </div>

            {historyResumes.length > 0 && (
                <div className={`bg-card text-card-foreground border rounded-xl shadow-sm p-6 space-y-6${activeSection === "history" ? "" : " max-md:hidden"}`}>
                    <h3 className="text-sm md:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Document History
                    </h3>
                    
                    <div className="space-y-4">
                        {historyResumes.map((resume) => (
                            <ResumeItem 
                                key={resume.id}
                                resume={resume} 
                                onDelete={() => promptDelete(resume.id, resume.file_name || "Document")}
                                onMakePrimary={() => handleMakePrimary(resume.id)}
                                isPrimary={false}
                                isUpdating={updatingResumeId === resume.id}
                            />
                        ))}
                    </div>
                </div>
            )}

            <div className={`bg-card text-card-foreground border rounded-xl shadow-sm p-6 flex flex-row items-center justify-between max-md:flex-col max-md:items-start max-md:gap-2${activeSection === "visibility" ? "" : " max-md:hidden"}`}>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full text-primary">
                        {visibility === "Private" ? <Lock className="h-5 w-5" /> : visibility === "Recruiters Only" ? <Users className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-foreground">{visibility}</p>
                        <p className="text-sm md:text-xs text-muted-foreground">Profile Visibility</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" className="relative max-md:min-h-11" onClick={() => setIsVisibilityModalOpen(true)}>
                    Change Visibility
                    {pendingVisibility && (
                        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary border-2 border-background"></span>
                    )}
                </Button>
            </div>

            <VisibilityModal 
                isOpen={isVisibilityModalOpen}
                onClose={() => setIsVisibilityModalOpen(false)}
            />

            <UploadOptionsModal 
                isOpen={isUploadOptionsOpen} 
                onClose={() => { setIsUploadOptionsOpen(false); setSelectedFile(null); }}
                onUploadOnly={handleUploadOnly}
                onUploadAndAutofill={handleUploadAndAutofill}
            />

            <AutofillConfirmModal 
                isOpen={isAutofillConfirmOpen}
                onClose={() => { setIsAutofillConfirmOpen(false); setSelectedFile(null); }}
                onConfirm={handleConfirmAutofill}
                fileName={selectedFile?.name || "Document"}
            />

            <DeleteResumeModal 
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                fileName={resumeToDelete?.name || "Document"}
            />
        </div>
    );
}

function ResumeItem({ resume, onDelete, onMakePrimary, isPrimary, isUpdating }: { resume: VsJobSeekerResume, onDelete: () => void, onMakePrimary?: () => void, isPrimary: boolean, isUpdating?: boolean }) {
    const rawFileReference = String(resume.file_url || "");
    const fileId = rawFileReference.includes("/assets/")
        ? rawFileReference.split("/assets/").pop()?.split(/[?#]/u)[0]
        : rawFileReference.split(/[?#]/u)[0];
    const downloadUrl = fileId ? `/api/freelancer/assets/${encodeURIComponent(fileId)}?download` : "#";

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between p-3 border rounded-lg bg-background/50 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="h-8 w-8 text-destructive shrink-0" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                            {resume.file_name || "Resume Document"}
                        </p>
                        <p className="text-sm md:text-xs text-muted-foreground">
                            {new Date(resume.uploaded_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                    {!isPrimary && onMakePrimary && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-sm md:text-xs text-muted-foreground hover:text-primary max-md:min-h-11 flex items-center gap-1.5" 
                            onClick={onMakePrimary}
                            disabled={isUpdating}
                        >
                            {isUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Make Primary
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground max-md:size-11" asChild>
                        <a href={downloadUrl} download>
                            <Download className="h-4 w-4" />
                        </a>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive max-md:size-11" onClick={onDelete}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            
            {isPrimary && (
                <>
                    <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm text-muted-foreground">Parsing Status:</span>
                        <Badge variant="secondary" className="badge-success text-xs">
                            Completed
                        </Badge>
                    </div>
                    <p className="text-sm md:text-xs text-muted-foreground">
                        Our AI has parsed this resume to improve your search visibility by 34%.
                    </p>
                </>
            )}
        </div>
    );
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </svg>
    )
}

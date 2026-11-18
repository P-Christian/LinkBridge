"use client";

import React, { useState } from "react";
import { GraduationCap, Plus, Pencil, CircleCheck, ShieldAlert } from "lucide-react";
import { useFreelancerProfileContext } from "../providers/FreelancerProfileProvider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { EducationModal } from "./EducationModal";
import { EducationVerificationModal } from "./EducationVerificationModal";
import { VsEducation } from "../types/freelancer-profile.types";

type EducationVerificationState = NonNullable<VsEducation["verification_state"]>;

function isUnsavedEducationDraft(education: VsEducation): boolean {
    return typeof education.id === "number" && education.id < 0;
}

function resolveVerificationState(education: VsEducation): EducationVerificationState | null {
    if (education.verification_state) return education.verification_state;
    if (isUnsavedEducationDraft(education)) return null;
    switch (education.education_status) {
        case "Verified":
            return "VERIFIED";
        case "Pending":
            return "PENDING";
        case "Unverified":
            return "UNVERIFIED";
        default:
            return null;
    }
}

export function EducationalBackgroundCard() {
    const { data: profile, pendingEducation, isAutofilling, refresh } = useFreelancerProfileContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEducation, setEditingEducation] = useState<VsEducation | null>(null);
    const [verificationEducation, setVerificationEducation] = useState<VsEducation | null>(null);

    if (!profile) return null;

    const educationList = pendingEducation !== null ? pendingEducation : profile.education || [];
    const visibleEducation = educationList.filter((education) => education.attendance_rejected !== true);
    const attendanceFullyVerified =
        visibleEducation.length > 0 &&
        visibleEducation.every((education) => resolveVerificationState(education) === "VERIFIED");
    const verificationEducationId =
        verificationEducation?.employee_education_id ?? verificationEducation?.id ?? null;

    const handleAddClick = () => {
        setEditingEducation(null);
        setIsModalOpen(true);
    };

    const handleEditClick = (edu: VsEducation) => {
        setEditingEducation(edu);
        setIsModalOpen(true);
    };

    return (
        <div className="bg-background rounded-lg border shadow-sm p-6">
            <div className="flex items-center justify-between mb-6 relative">
                <div className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Educational Background</h3>
                    {attendanceFullyVerified ? (
                        <div className="ml-2 flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                    ) : (
                        <div className="ml-2 flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground">
                            <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {pendingEducation !== null && (
                        <span className="h-2.5 w-2.5 bg-primary rounded-full" title="Unsaved changes" />
                    )}
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-full text-primary hover:bg-primary/10 hover:text-primary max-md:size-11"
                        onClick={handleAddClick}
                        disabled={isAutofilling}
                    >
                        <Plus className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                {isAutofilling ? (
                    Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="flex gap-4">
                            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-5 w-[40%]" />
                                <Skeleton className="h-4 w-[30%]" />
                                <Skeleton className="h-3 w-[20%]" />
                            </div>
                        </div>
                    ))
                ) : visibleEducation.map((edu) => {
                    const verificationState = resolveVerificationState(edu);
                    const educationId = edu.employee_education_id ?? edu.id;
                    const canVerify =
                        verificationState === "INVITED" &&
                        typeof educationId === "number" &&
                        educationId > 0;
                    return (
                    <div key={edu.id} className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                            <GraduationCap className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex min-w-0 items-center gap-2">
                                        <h4 className="font-medium text-foreground break-words">{edu.school_name || edu.school_name_raw || "Unknown School"}</h4>
                                        {verificationState === 'VERIFIED' && (
                                            <span className="shrink-0 inline-flex items-center text-green-600 dark:text-green-500" title="Attendance verified">
                                                <CircleCheck className="h-4 w-4" />
                                                <span className="sr-only">Attendance verified</span>
                                            </span>
                                        )}
                                    </span>
                                    {verificationState === 'PENDING' && (
                                        <StatusBadge tone="warning">
                                            Pending Verification
                                        </StatusBadge>
                                    )}
                                    {verificationState === 'UNVERIFIED' && (
                                        <StatusBadge tone="destructive">
                                            Unverified
                                        </StatusBadge>
                                    )}
                                    {canVerify && (
                                        <button
                                            type="button"
                                            aria-label="Verify this education"
                                            title="This school can verify your education."
                                            onClick={() => setVerificationEducation(edu)}
                                            className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-destructive transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 after:absolute after:-inset-2 after:content-['']"
                                        >
                                            <ShieldAlert className="h-4 w-4 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
                                        </button>
                                    )}
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-full text-primary hover:bg-primary/10 hover:text-primary max-md:size-11"
                                    onClick={() => handleEditClick(edu)}
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </div>
                            {edu.course_verification?.status !== 'Rejected' && (
                                <div className="text-sm font-medium text-muted-foreground">
                                    {edu.course_name || edu.course_name_raw || "No Course Specified"}
                                </div>
                            )}
                            <div className="text-sm md:text-xs text-muted-foreground">
                                {edu.start_date ? new Date(edu.start_date).getFullYear() : "?"} - {edu.end_date ? new Date(edu.end_date).getFullYear() : "Present"}
                            </div>
                        </div>
                    </div>
                    );
                })}
            </div>

            <EducationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                userId={profile.user_id}
                educationToEdit={editingEducation}
            />

            {verificationEducation && verificationEducationId !== null && (
                <EducationVerificationModal
                    isOpen
                    onClose={() => setVerificationEducation(null)}
                    educationId={verificationEducationId}
                    schoolName={verificationEducation.school_name || verificationEducation.school_name_raw}
                    courseName={verificationEducation.course_name || verificationEducation.course_name_raw}
                    onSubmitted={refresh}
                />
            )}
        </div>
    );
}

"use client";

import React, { useState } from "react";
import { FileText, Pencil } from "lucide-react";
import { useFreelancerProfileContext } from "../providers/FreelancerProfileProvider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfessionalSummaryModal } from "./ProfessionalSummaryModal";

export function ProfessionalSummaryCard() {
    const { data, pendingProfessionalSummary, isAutofilling } = useFreelancerProfileContext();
    const [isModalOpen, setIsModalOpen] = useState(false);

    if (!data) return null;

    const profile = data.job_seeker_profile?.[0];
    const liveSummary = profile?.professional_summary || '';
    const summary = pendingProfessionalSummary !== null ? pendingProfessionalSummary : liveSummary;
    const profileId = profile?.profile_id;

    return (
        <div className="bg-card text-card-foreground border rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center relative">
                <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Professional Summary</h2>
                    {summary ? (
                        <div className="ml-2 flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                    ) : (
                        <div className="ml-2 flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground">
                            <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                        </div>
                    )}
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full text-primary hover:bg-primary/10 hover:text-primary relative max-md:size-11"
                    onClick={() => setIsModalOpen(true)}
                    disabled={isAutofilling}
                >
                    <Pencil className="h-4 w-4" />
                    {pendingProfessionalSummary !== null && (
                        <span className="absolute top-0 right-0 h-2.5 w-2.5 bg-primary rounded-full border-2 border-background" />
                    )}
                </Button>
            </div>
            
            <div className="p-6 pb-7">
                {isAutofilling ? (
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-[90%]" />
                        <Skeleton className="h-4 w-[80%]" />
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {summary || 'No professional summary provided.'}
                    </p>
                )}
            </div>

            <ProfessionalSummaryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialSummary={summary}
                profileId={profileId}
                userId={data.user_id}
            />
        </div>
    );
}

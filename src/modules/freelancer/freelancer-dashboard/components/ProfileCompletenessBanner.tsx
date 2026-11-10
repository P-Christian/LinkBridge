"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useFreelancerProfileContext } from "@/modules/freelancer/freelancer-profile/providers/FreelancerProfileProvider";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProfileCompletenessBanner() {
    const { data: profile, isLoading } = useFreelancerProfileContext();

    const { missingSections, completeness } = useMemo(() => {
        if (!profile) return { missingSections: [], completeness: 0 };
        
        const missing = [];
        let completed = 0;
        const total = 6;

        if (!(profile.user_fname && profile.user_lname && profile.user_bday && profile.gender)) {
            missing.push({ name: "Personal Information", href: "/linkbridge/freelancer/profile" });
        } else {
            completed++;
        }

        if (!(profile.resumes && profile.resumes.length > 0)) {
            missing.push({ name: "Resume", href: "/linkbridge/freelancer/profile" });
        } else {
            completed++;
        }

        if (!profile.job_seeker_profile?.[0]?.professional_summary) {
            missing.push({ name: "Professional Summary", href: "/linkbridge/freelancer/profile" });
        } else {
            completed++;
        }

        if (!(profile.skills && profile.skills.length > 0)) {
            missing.push({ name: "Skills", href: "/linkbridge/freelancer/profile" });
        } else {
            completed++;
        }

        if (!(profile.work_experience && profile.work_experience.length > 0)) {
            missing.push({ name: "Work Experience", href: "/linkbridge/freelancer/profile" });
        } else {
            completed++;
        }

        if (!(profile.education && profile.education.length > 0)) {
            missing.push({ name: "Education", href: "/linkbridge/freelancer/profile" });
        } else {
            completed++;
        }

        return {
            missingSections: missing,
            completeness: Math.round((completed / total) * 100)
        };
    }, [profile]);

    if (isLoading) {
        return <div className="h-24 bg-muted/50 animate-pulse rounded-xl w-full mb-8" />;
    }

    if (!profile) return null;

    if (missingSections.length === 0) {
        return (
            <Card className="mb-8 border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20 shadow-sm max-md:hidden">
                <CardContent className="p-4 sm:p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                        <div>
                            <h3 className="font-semibold text-green-800 dark:text-green-300 text-lg">
                                Profile 100% Complete!
                            </h3>
                            <p className="text-green-700/80 dark:text-green-400/80 text-sm">
                                Great job! You are ready to apply for the best opportunities.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="mb-8 border-orange-200 bg-orange-50/50 dark:border-orange-900/50 dark:bg-orange-950/20 shadow-sm">
            <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-4 sm:items-start justify-between">
                    <div className="flex gap-4">
                        <div className="mt-1">
                            <AlertCircle className="h-6 w-6 text-orange-500" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-orange-800 dark:text-orange-300 text-lg">
                                Profile is {completeness}% Complete
                            </h3>
                            <p className="text-orange-700/80 dark:text-orange-400/80 text-sm mt-1">
                                Complete your profile to stand out to employers. You are missing:
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {missingSections.map((section, idx) => (
                                    <Link key={idx} href={section.href}>
                                        <span className="inline-flex items-center rounded-md bg-orange-100 dark:bg-orange-900/40 px-2.5 py-1 text-sm md:text-xs font-medium text-orange-700 dark:text-orange-300 ring-1 ring-inset ring-orange-600/20 hover:bg-orange-200 dark:hover:bg-orange-800/50 transition-colors cursor-pointer">
                                            {section.name}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                    <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600 text-white shrink-0 sm:mt-2 max-md:min-h-11">
                        <Link href="/linkbridge/freelancer/profile">
                            Update Profile <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

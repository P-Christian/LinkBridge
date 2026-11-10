"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useFreelancerProfileContext } from "@/modules/freelancer/freelancer-profile/providers/FreelancerProfileProvider";
import { ArrowRight } from "lucide-react";

export function DashboardGreetingHeader() {
    const { data: profile } = useFreelancerProfileContext();

    const completeness = useMemo(() => {
        if (!profile) return 0;
        const profileObj = profile.job_seeker_profile || profile.vs_job_seeker_profile;
        const record = Array.isArray(profileObj) ? profileObj[0] : profileObj;

        if (record && typeof record.profile_completion_percent === "number") {
            return record.profile_completion_percent;
        }

        // Graceful fallback if profile record is pending creation
        return 0;
    }, [profile]);

    const isComplete = completeness === 100;
    const firstName = profile?.user_fname || "User";

    return (
        <div className="h-full bg-white dark:bg-card border border-slate-200/90 dark:border-border border-t-4 border-t-blue-600 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-center transition-all duration-200 ease-out hover:border-blue-300 dark:hover:border-blue-800/60 hover:shadow-md">
            <div className="flex flex-wrap items-center gap-2.5">
                <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${isComplete
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                        }`}
                >
                    <span
                        className={`w-1.5 h-1.5 rounded-full ${isComplete ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                            }`}
                    />
                    {completeness}% Profile {isComplete ? "Complete" : "Ready"}
                </span>
                {isComplete ? (
                    <span className="text-xs text-slate-400 dark:text-muted-foreground">Ready to apply!</span>
                ) : (
                    <Link
                        href="/linkbridge/freelancer/profile"
                        className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                    >
                        Complete now <ArrowRight className="w-3 h-3" />
                    </Link>
                )}
            </div>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-foreground mt-3 tracking-tight">
                Welcome back, {firstName}
            </h2>
            <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">
                Here is a summary of your activity and AI matches on LinkBridge.
            </p>
        </div>
    );
}

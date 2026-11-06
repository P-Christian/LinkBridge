"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useFreelancerApplications } from "@/modules/freelancer/freelancer-applications/hooks/useFreelancerApplications";
import { ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { formatAssetUrl } from "@/lib/utils";

import type { ApplicationItem } from "@/modules/freelancer/freelancer-applications/types";

interface RecentApplicationsPreviewProps {
    applications?: ApplicationItem[];
    loading?: boolean;
}

export function RecentApplicationsPreview({
    applications: propApplications,
    loading: propLoading,
}: RecentApplicationsPreviewProps = {}) {
    const { applications: hookApplications, loading: hookLoading, fetchApplications } = useFreelancerApplications();

    const isControlled = propApplications !== undefined;

    useEffect(() => {
        if (!isControlled) {
            fetchApplications();
        }
    }, [isControlled, fetchApplications]);

    const applications = propApplications || hookApplications;
    const loading = isControlled ? Boolean(propLoading) : hookLoading;
    const recentApps = applications.slice(0, 5);

    const getStatusBadge = (status: string) => {
        const s = (status || "").toUpperCase();
        switch (s) {
            case "APPLIED":
            case "PENDING":
                return (
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800">
                        APPLIED
                    </span>
                );
            case "INTERVIEW":
            case "INTERVIEWING":
            case "IN_REVIEW":
                return (
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800">
                        INTERVIEWING
                    </span>
                );
            case "HIRED":
            case "ACCEPTED":
                return (
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800">
                        HIRED
                    </span>
                );
            case "WITHDRAWN":
            case "REJECTED":
                return (
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-muted text-slate-600 dark:text-muted-foreground border border-slate-200/60 dark:border-border">
                        {s}
                    </span>
                );
            default:
                return (
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-muted text-slate-700 dark:text-foreground">
                        {s}
                    </span>
                );
        }
    };

    const getInitials = (title?: string, company?: string) => {
        const source = company || title || "JC";
        return source
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase())
            .join("");
    };

    const formatAppliedTime = (dateStr?: string | null) => {
        if (!dateStr) return "Recently";
        try {
            return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
        } catch {
            return "Recently";
        }
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-card rounded-2xl border border-slate-200/90 dark:border-border shadow-sm p-6 space-y-4 animate-pulse">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-border">
                    <div className="h-4 w-36 bg-slate-200 dark:bg-muted rounded"></div>
                    <div className="h-3 w-16 bg-slate-100 dark:bg-muted rounded"></div>
                </div>
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-muted"></div>
                            <div className="space-y-1.5">
                                <div className="h-3.5 w-32 bg-slate-200 dark:bg-muted rounded"></div>
                                <div className="h-2.5 w-24 bg-slate-100 dark:bg-muted rounded"></div>
                            </div>
                        </div>
                        <div className="h-5 w-16 bg-slate-100 dark:bg-muted rounded-md"></div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-card rounded-2xl border border-slate-200/90 dark:border-border shadow-sm overflow-hidden transition-colors flex flex-col justify-between h-full">
            <div>
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-border flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-foreground">Recent Applications</h3>
                        <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">Track your job application status</p>
                    </div>
                    <Link
                        href="/linkbridge/freelancer/applications"
                        className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
                    >
                        View All <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>

                {/* Un-nested List */}
                {recentApps.length === 0 ? (
                    <div className="p-8 text-center">
                        <p className="text-xs text-slate-500 dark:text-muted-foreground">You haven&apos;t applied to any roles yet.</p>
                        <Button variant="outline" asChild size="sm" className="mt-3">
                            <Link href="/linkbridge/freelancer/jobs">Browse Jobs</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-border">
                        {recentApps.map((app) => (
                            <Link
                                key={app.application_id}
                                href="/linkbridge/freelancer/applications"
                                className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-muted/40 transition group"
                            >
                                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                                    {app.company_details?.company_logo ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={formatAssetUrl(app.company_details.company_logo) || undefined}
                                            alt={app.company_name || "Company"}
                                            className="w-9 h-9 rounded-lg object-cover shrink-0 border border-slate-200/80 dark:border-border shadow-sm"
                                            onError={(e) => {
                                                e.currentTarget.style.display = "none";
                                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                                if (fallback) fallback.style.display = "flex";
                                            }}
                                        />
                                    ) : null}
                                    <div
                                        className={`w-9 h-9 rounded-lg bg-slate-100 dark:bg-muted text-slate-700 dark:text-foreground font-bold text-xs flex items-center justify-center shrink-0 ${
                                            app.company_details?.company_logo ? "hidden" : ""
                                        }`}
                                    >
                                        {getInitials(app.job_title, app.company_name)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-foreground truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {app.job_title || "Application"}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-muted-foreground truncate">
                                            {app.company_name || "Company"} • {formatAppliedTime(app.applied_at)}
                                        </p>
                                    </div>
                                </div>
                                <div className="shrink-0">{getStatusBadge(app.application_status)}</div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

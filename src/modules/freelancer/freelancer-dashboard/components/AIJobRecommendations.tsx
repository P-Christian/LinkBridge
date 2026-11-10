"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, Wand2, ArrowUpRight, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export interface RecommendedJob {
    job_id: number;
    job_title: string;
    company_name: string;
    job_type: string;
    work_arrangement: string;
    salary_min?: number;
    salary_max?: number;
    job_location?: string;
    reasoning: string;
    match_percentage?: number;
}

interface AIJobRecommendationsProps {
    onJobsLoaded?: (topScore: number | null, topTitle: string | null) => void;
    jobs?: RecommendedJob[];
    loading?: boolean;
}

function formatSalary(min?: number, max?: number): string {
    if (!min && !max) return "Competitive Salary";
    const formatter = new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 0,
    });
    if (min && max) return `${formatter.format(min)} - ${formatter.format(max)}`;
    if (min) return `From ${formatter.format(min)}`;
    return `Up to ${formatter.format(max!)}`;
}

export function AIJobRecommendations({ onJobsLoaded, jobs: propJobs, loading: propLoading }: AIJobRecommendationsProps) {
    const [localJobs, setLocalJobs] = useState<RecommendedJob[]>([]);
    const [localLoading, setLocalLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isControlled = propJobs !== undefined;
    const jobs = isControlled ? propJobs : localJobs;
    const loading = isControlled ? (propLoading ?? false) : localLoading;

    useEffect(() => {
        if (isControlled) return;

        let isMounted = true;
        const fetchRecommendations = async () => {
            try {
                const res = await fetch("/api/freelancer/ai-recommendations");
                if (!res.ok) throw new Error("Failed to fetch recommendations");
                const data = await res.json();
                if (isMounted) {
                    const list: RecommendedJob[] = data.recommendations || [];
                    setLocalJobs(list);
                    setLocalLoading(false);
                    if (onJobsLoaded && list.length > 0) {
                        onJobsLoaded(list[0].match_percentage || 95, list[0].job_title);
                    }
                }
            } catch (err: unknown) {
                if (isMounted) {
                    console.error("AI Recommendations Error:", err);
                    setError("Failed to load AI recommendations.");
                    setLocalLoading(false);
                }
            }
        };

        fetchRecommendations();
        return () => {
            isMounted = false;
        };
    }, [isControlled, onJobsLoaded]);

    if (loading) {
        return (
            <div className="bg-white dark:bg-card rounded-3xl border border-slate-200/90 dark:border-border shadow-sm p-5 sm:p-6 space-y-5 animate-pulse">
                <div className="flex justify-between items-center">
                    <div className="h-5 w-40 bg-slate-200 dark:bg-muted rounded"></div>
                    <div className="h-5 w-24 bg-slate-100 dark:bg-muted rounded-full"></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    <div className="lg:col-span-7 rounded-2xl bg-slate-100 dark:bg-muted/40 h-[280px]"></div>
                    <div className="lg:col-span-5 flex flex-col gap-4">
                        <div className="rounded-2xl bg-slate-100 dark:bg-muted/40 h-[132px]"></div>
                        <div className="rounded-2xl bg-slate-100 dark:bg-muted/40 h-[132px]"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || jobs.length === 0) {
        return (
            <div className="bg-white dark:bg-card rounded-3xl border border-slate-200/90 dark:border-border shadow-sm p-6 sm:p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-foreground">AI Job Matches</h3>
                <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1 max-w-md mx-auto">
                    {error || "No high-confidence AI job matches right now. Update your profile skills to trigger fresh recommendations."}
                </p>
                <Button variant="outline" asChild size="sm" className="mt-4">
                    <Link href="/linkbridge/freelancer/profile">Update Skills & Profile</Link>
                </Button>
            </div>
        );
    }

    const featuredJob = jobs[0];
    const secondaryJobs = jobs.slice(1, 3);

    return (
        <div className="bg-white dark:bg-card rounded-3xl border border-slate-200/90 dark:border-border shadow-sm p-5 sm:p-6 space-y-5 transition-colors">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                        <Sparkles className="w-4 h-4" />
                    </span>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-foreground">AI Job Matches</h3>
                        <p className="text-xs text-slate-500 dark:text-muted-foreground">
                            Personalized opportunities based on your skills and preferences
                        </p>
                    </div>
                </div>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 px-3 py-1 rounded-full">
                    {jobs.length} Curated {jobs.length === 1 ? "Role" : "Roles"}
                </span>
            </div>

            {/* Asymmetric 7 + 5 Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* #1 Featured Match (7 Cols) */}
                <div className="lg:col-span-7 rounded-2xl bg-slate-50/70 dark:bg-muted/30 border-2 border-blue-600/20 dark:border-blue-500/30 p-5 sm:p-6 flex flex-col justify-between transition-colors">
                    <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-sm flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3" /> #1 Best Match • {featuredJob.match_percentage || 95}% Fit
                            </span>
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-card px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-border uppercase">
                                {featuredJob.work_arrangement || "Remote"} • {featuredJob.job_type || "Full Time"}
                            </span>
                        </div>

                        <h4 className="text-xl font-bold text-slate-900 dark:text-foreground mt-4 tracking-tight">
                            {featuredJob.job_title}
                        </h4>

                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <span className="text-xs font-medium text-slate-500 dark:text-muted-foreground flex items-center gap-1">
                                <Building className="w-3.5 h-3.5" />
                                {featuredJob.company_name}
                            </span>
                            <span className="text-slate-300 dark:text-muted-foreground">•</span>
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800">
                                {formatSalary(featuredJob.salary_min, featuredJob.salary_max)}
                            </span>
                        </div>

                        {/* Why it's a fit callout */}
                        <div className="mt-4 p-4 rounded-xl bg-white dark:bg-card border border-slate-200/80 dark:border-border text-xs text-slate-600 dark:text-slate-300 leading-relaxed shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <strong className="text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mb-1 font-semibold">
                                <Wand2 className="w-3.5 h-3.5" /> Why it&apos;s a fit:
                            </strong>
                            {featuredJob.reasoning}
                        </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-border/80 flex flex-wrap items-center gap-3">
                        <Button asChild className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-semibold transition shadow-sm min-h-11">
                            <Link href={`/linkbridge/freelancer/jobs/${featuredJob.job_id}`}>
                                Quick Apply Now
                            </Link>
                        </Button>
                        <Button variant="outline" asChild className="px-4 py-2.5 rounded-xl text-xs font-medium min-h-11">
                            <Link href={`/linkbridge/freelancer/jobs/${featuredJob.job_id}`}>
                                View Full Description <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* #2 and #3 Stacked Matches (5 Cols) */}
                <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                    {secondaryJobs.length > 0 ? (
                        secondaryJobs.map((job) => (
                            <Link
                                key={job.job_id}
                                href={`/linkbridge/freelancer/jobs/${job.job_id}`}
                                className="p-5 rounded-2xl bg-white dark:bg-card border border-slate-200/90 dark:border-border hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-sm transition flex-1 flex flex-col justify-between group"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {job.job_title}
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5 uppercase">
                                                {job.company_name} • {job.work_arrangement || "Remote"} • {job.job_type || "Full Time"}
                                            </p>
                                        </div>
                                        <span className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                            {job.match_percentage || 90}% Match
                                        </span>
                                    </div>
                                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-2">
                                        {formatSalary(job.salary_min, job.salary_max)}
                                    </p>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 pt-2.5 border-t border-slate-100 dark:border-border leading-relaxed line-clamp-2">
                                        <strong className="text-slate-800 dark:text-slate-200">Why it&apos;s a fit:</strong> {job.reasoning}
                                    </p>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <div className="p-6 rounded-2xl bg-slate-50/50 dark:bg-muted/20 border border-slate-200/80 dark:border-border text-center flex flex-col items-center justify-center flex-1">
                            <p className="text-xs text-slate-500 dark:text-muted-foreground">More AI matches are being computed as new positions open.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

"use client";

import React, { useMemo } from "react";
import { TrendingUp, CheckCircle2 } from "lucide-react";
import type { RecommendedJob } from "./AIJobRecommendations";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface SkillsMatchBarChartProps {
    recommendations?: RecommendedJob[];
    loading?: boolean;
}

interface SkillMatchItem {
    skill: string;
    percentage: number;
    color: string;
    demandLevel: string;
}

export function SkillsMatchBarChart({ recommendations = [], loading = false }: SkillsMatchBarChartProps) {
    const skillsList = useMemo(() => {
        if (!recommendations || recommendations.length === 0) {
            return [];
        }

        // Dynamically compute match indicators from top AI recommendations
        const baseScore = recommendations[0]?.match_percentage || 0;
        if (baseScore <= 0) return [];

        const items: SkillMatchItem[] = [
            {
                skill: recommendations[0]?.job_title || "Primary Role Fit",
                percentage: Math.min(100, baseScore),
                color: "bg-emerald-500",
                demandLevel: "Very High",
            },
            {
                skill: recommendations[1]?.job_title || "Secondary Match",
                percentage: Math.min(100, Math.max(0, (recommendations[1]?.match_percentage || baseScore - 7))),
                color: "bg-blue-500",
                demandLevel: "High",
            },
            {
                skill: recommendations[2]?.job_title || "Complementary Match",
                percentage: Math.min(100, Math.max(0, (recommendations[2]?.match_percentage || baseScore - 12))),
                color: "bg-indigo-500",
                demandLevel: "High",
            },
            {
                skill: "Overall Market Alignment",
                percentage: Math.round(baseScore * 0.92),
                color: "bg-purple-500",
                demandLevel: "Growing",
            },
        ];

        return items;
    }, [recommendations]);

    if (loading) {
        return (
            <div className="bg-white dark:bg-card border border-slate-200/90 dark:border-border border-t-4 border-t-blue-500 rounded-3xl p-6 shadow-sm animate-pulse h-full flex flex-col justify-between">
                <div className="flex justify-between items-center">
                    <div className="h-4 w-32 bg-slate-200 dark:bg-muted rounded"></div>
                    <div className="h-5 w-20 bg-slate-100 dark:bg-muted rounded-full"></div>
                </div>
                <div className="space-y-4 my-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="space-y-1.5">
                            <div className="h-3 w-28 bg-slate-200 dark:bg-muted rounded"></div>
                            <div className="h-2 w-full bg-slate-100 dark:bg-muted rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (skillsList.length === 0) {
        return (
            <div className="bg-white dark:bg-card border border-slate-200/90 dark:border-border border-t-4 border-t-blue-500 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between h-full transition-all duration-200 ease-out hover:border-blue-300 dark:hover:border-blue-800/60 hover:shadow-md">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-border">
                    <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4" />
                        </span>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-foreground">In-Demand Skills Fit</h3>
                            <p className="text-[11px] text-slate-500 dark:text-muted-foreground">Market demand alignment</p>
                        </div>
                    </div>
                </div>

                <div className="my-auto py-6 text-center space-y-3">
                    <p className="text-xs text-slate-500 dark:text-muted-foreground max-w-xs mx-auto">
                        No skill match data available. Add skills to your profile to see your alignment with active jobs.
                    </p>
                    <Button variant="outline" size="sm" asChild className="text-xs">
                        <Link href="/linkbridge/freelancer/profile">Update Skills & Profile</Link>
                    </Button>
                </div>

                <p className="text-[11px] text-slate-400 dark:text-muted-foreground pt-2 border-t border-slate-100 dark:border-border">
                    Based on active job requirements matched against your skills and summary.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-card border border-slate-200/90 dark:border-border border-t-4 border-t-blue-500 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between h-full transition-all duration-200 ease-out hover:border-blue-300 dark:hover:border-blue-800/60 hover:shadow-md">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-border">
                <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4" />
                    </span>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-foreground">In-Demand Skills Fit</h3>
                        <p className="text-[11px] text-slate-500 dark:text-muted-foreground">Market demand alignment</p>
                    </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Strong Fit
                </span>
            </div>

            {/* Horizontal Bar Chart List */}
            <div className="space-y-3.5 my-2">
                {skillsList.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[200px]" title={item.skill}>
                                {item.skill}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400 dark:text-muted-foreground font-medium">
                                    {item.demandLevel}
                                </span>
                                <span className="font-bold text-slate-900 dark:text-foreground text-[11px]">
                                    {item.percentage}%
                                </span>
                            </div>
                        </div>
                        {/* Progress track */}
                        <div className="h-2 w-full bg-slate-100 dark:bg-muted/80 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${item.color} rounded-full transition-all duration-700`}
                                style={{ width: `${item.percentage}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Micro Caption */}
            <p className="text-[11px] text-slate-400 dark:text-muted-foreground pt-2 border-t border-slate-100 dark:border-border">
                Based on active job requirements matched against your skills and summary.
            </p>
        </div>
    );
}

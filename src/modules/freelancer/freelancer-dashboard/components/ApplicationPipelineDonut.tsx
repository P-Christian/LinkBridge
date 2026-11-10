"use client";

import React, { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { ApplicationItem } from "@/modules/freelancer/freelancer-applications/types";
import { Layers } from "lucide-react";

interface ApplicationPipelineDonutProps {
    applications?: ApplicationItem[];
    loading?: boolean;
}

interface StageData {
    name: string;
    value: number;
    color: string;
}

export function ApplicationPipelineDonut({ applications = [], loading = false }: ApplicationPipelineDonutProps) {
    const { chartData, activeCount } = useMemo(() => {
        let applied = 0;
        let screening = 0;
        let interviewing = 0;
        let hired = 0;

        applications.forEach((app) => {
            const status = (app.application_status || "").trim().toUpperCase();
            const stageType = (app.current_stage?.stage_type || "").trim().toUpperCase();
            const isStageTerminal = Boolean(app.current_stage?.is_terminal);

            // Terminal, withdrawn, or draft statuses must NOT be counted in the active funnel
            const isTerminalOrWithdrawn =
                ["WITHDRAWN", "REJECTED", "DECLINED", "CANCELLED", "CANCELLED_CLOSED", "DRAFT"].includes(status) ||
                ["WITHDRAWN", "REJECTED", "DECLINED", "CANCELLED", "DRAFT"].includes(stageType) ||
                (isStageTerminal && stageType !== "HIRED" && status !== "HIRED");

            if (isTerminalOrWithdrawn) {
                return;
            }

            if (status === "HIRED" || stageType === "HIRED") {
                hired += 1;
            } else if (status === "INTERVIEWING" || status === "INTERVIEW" || stageType === "INTERVIEW") {
                interviewing += 1;
            } else if (
                status === "UNDER_REVIEW" ||
                status === "SHORTLISTED" ||
                stageType === "SCREENING" ||
                stageType === "ASSESSMENT" ||
                stageType === "SHORTLISTED" ||
                stageType === "UNDER_REVIEW"
            ) {
                screening += 1;
            } else if (status === "APPLIED" || status === "PENDING" || stageType === "APPLIED") {
                applied += 1;
            } else {
                applied += 1;
            }
        });

        const data: StageData[] = [
            { name: "Applied", value: applied, color: "#0284c7" }, // Sky Blue
            { name: "Screening", value: screening, color: "#6366f1" }, // Indigo
            { name: "Interviewing", value: interviewing, color: "#8b5cf6" }, // Purple
            { name: "Hired", value: hired, color: "#10b981" }, // Emerald
        ].filter((d) => d.value > 0);

        const active = applied + screening + interviewing;

        return { chartData: data, activeCount: active };
    }, [applications]);

    if (loading) {
        return (
            <div className="bg-white dark:bg-card border border-slate-200/90 dark:border-border border-t-4 border-t-indigo-500 rounded-3xl p-6 shadow-sm animate-pulse h-full flex flex-col justify-between">
                <div className="flex justify-between items-center">
                    <div className="h-4 w-32 bg-slate-200 dark:bg-muted rounded"></div>
                    <div className="h-6 w-16 bg-slate-100 dark:bg-muted rounded-full"></div>
                </div>
                <div className="w-40 h-40 rounded-full bg-slate-100 dark:bg-muted mx-auto my-4"></div>
                <div className="h-3 w-48 bg-slate-100 dark:bg-muted rounded mx-auto"></div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-card border border-slate-200/90 dark:border-border border-t-4 border-t-indigo-500 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between h-full transition-all duration-200 ease-out hover:border-indigo-300 dark:hover:border-indigo-800/60 hover:shadow-md">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-border">
                <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Layers className="w-4 h-4" />
                    </span>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-foreground">Application Pipeline</h3>
                        <p className="text-[11px] text-slate-500 dark:text-muted-foreground">Active stage funnel breakdown</p>
                    </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800">
                    {activeCount} Active
                </span>
            </div>

            {/* Donut Chart with Centered Metric */}
            <div className="relative w-full h-[180px] my-1 flex items-center justify-center">
                {chartData.length === 0 ? (
                    <div className="text-center p-4">
                        <p className="text-xs text-slate-400 dark:text-muted-foreground">No active applications yet.</p>
                        <p className="text-[11px] text-slate-400 dark:text-muted-foreground mt-0.5">Apply to jobs to track your funnel!</p>
                    </div>
                ) : (
                    <>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const item = payload[0].payload as StageData;
                                            return (
                                                <div className="rounded-lg border bg-white dark:bg-popover p-2 shadow-md text-xs">
                                                    <span className="font-semibold text-slate-900 dark:text-foreground">
                                                        {item.name}:{" "}
                                                    </span>
                                                    <span className="text-primary font-bold">{item.value}</span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Pie
                                    data={chartData}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={50}
                                    outerRadius={72}
                                    paddingAngle={4}
                                    stroke="none"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Metric Label */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-2xl font-extrabold text-slate-900 dark:text-foreground">
                                {activeCount}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 dark:text-muted-foreground tracking-tight uppercase">
                                Active Apps
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* Legend Chips */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-border text-xs">
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7]" />
                    <span className="text-slate-600 dark:text-slate-300 text-[11px] font-medium">Applied</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" />
                    <span className="text-slate-600 dark:text-slate-300 text-[11px] font-medium">Screening</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" />
                    <span className="text-slate-600 dark:text-slate-300 text-[11px] font-medium">Interviewing</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                    <span className="text-slate-600 dark:text-slate-300 text-[11px] font-medium">Hired</span>
                </div>
            </div>
        </div>
    );
}

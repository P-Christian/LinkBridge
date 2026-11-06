"use client";

import React, { useEffect, useMemo } from "react";
import { useFreelancerApplications } from "@/modules/freelancer/freelancer-applications/hooks/useFreelancerApplications";
import { useConversations } from "@/modules/freelancer/freelancer-messaging/hooks/useConversations";
import { AlertCircle, CheckCircle2, Sparkles, MessageSquare } from "lucide-react";
import Link from "next/link";

import type { ApplicationItem, ApplicationSummary } from "@/modules/freelancer/freelancer-applications/types";
import type { Conversation } from "@/modules/freelancer/freelancer-messaging/types";

interface DashboardKpiStatsProps {
    topMatchScore?: number | null;
    topMatchTitle?: string | null;
    summary?: ApplicationSummary;
    conversations?: Conversation[];
    applications?: ApplicationItem[];
    loading?: boolean;
}

export function DashboardKpiStats({
    topMatchScore,
    topMatchTitle,
    summary: propSummary,
    conversations: propConversations,
    applications: propApplications,
    loading: propLoading,
}: DashboardKpiStatsProps) {
    const { applications: hookApplications, loading: isAppsLoading, fetchApplications } = useFreelancerApplications();
    const { conversations: hookConversations, loading: isMessagesLoading, loadConversations } = useConversations();

    const isControlled = propSummary !== undefined && propConversations !== undefined;

    useEffect(() => {
        if (!isControlled) {
            fetchApplications();
            loadConversations();
        }
    }, [isControlled, fetchApplications, loadConversations]);

    const isLoading = isControlled ? Boolean(propLoading) : (isAppsLoading || isMessagesLoading);
    const conversations = propConversations || hookConversations;
    const applications = propApplications || hookApplications;
    const unreadConversationsCount = conversations.filter((c) => (c.unread_count || 0) > 0).length;

    // Action Required: count applications needing candidate attention (assessment pending or draft)
    const actionRequiredCount = useMemo(() => {
        if (!applications || applications.length === 0) return 0;
        return applications.filter((app) => {
            const isDraft = app.application_status === "DRAFT";
            const needsAssessment =
                app.current_stage?.stage_type === "ASSESSMENT" ||
                Boolean(app.assessment?.needs_action);
            return isDraft || needsAssessment;
        }).length;
    }, [applications]);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 h-full">
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="bg-white dark:bg-card border border-slate-200/90 dark:border-border rounded-2xl p-5 shadow-sm animate-pulse flex flex-col justify-between h-[128px]"
                    >
                        <div className="flex justify-between items-center">
                            <div className="h-3 w-20 bg-slate-200 dark:bg-muted rounded"></div>
                            <div className="h-7 w-7 bg-slate-100 dark:bg-muted/80 rounded-lg"></div>
                        </div>
                        <div className="h-6 w-14 bg-slate-200 dark:bg-muted rounded my-2"></div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-muted rounded"></div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 h-full">
            {/* Card 1: Action Required (Replaces duplicate Active Apps) */}
            <Link
                href="/linkbridge/freelancer/applications"
                className="bg-white dark:bg-card border border-slate-200/90 dark:border-border border-t-4 border-t-amber-500 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all duration-200 ease-out hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5 group"
            >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-muted-foreground font-medium">
                    <span>Action Required</span>
                    <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        {actionRequiredCount > 0 ? (
                            <AlertCircle className="w-3.5 h-3.5" />
                        ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                    </div>
                </div>
                <div className="my-2">
                    <span className={`text-2xl font-bold ${actionRequiredCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-foreground"}`}>
                        {actionRequiredCount}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-muted-foreground">
                        {actionRequiredCount === 0 ? " · All caught up" : actionRequiredCount === 1 ? " pending task" : " pending tasks"}
                    </span>
                </div>
                <p className="text-[11px] font-medium truncate text-slate-500 dark:text-muted-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {actionRequiredCount > 0
                        ? `${actionRequiredCount} application${actionRequiredCount === 1 ? " needs" : "s need"} review`
                        : "No pending tasks or tests"}
                </p>
            </Link>

            {/* Card 2: Top AI Match */}
            <Link
                href="/linkbridge/freelancer/find-work"
                className="bg-white dark:bg-card border border-slate-200/90 dark:border-border border-t-4 border-t-indigo-500 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all duration-200 ease-out hover:border-indigo-400 hover:shadow-md hover:-translate-y-0.5 group"
            >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-muted-foreground font-medium">
                    <span>Top AI Match</span>
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Sparkles className="w-3.5 h-3.5" />
                    </div>
                </div>
                <div className="my-2">
                    {topMatchScore ? (
                        <>
                            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                {topMatchScore}%
                            </span>
                            <span className="text-xs text-slate-400 dark:text-muted-foreground"> fit score</span>
                        </>
                    ) : (
                        <span className="text-2xl font-bold text-slate-400 dark:text-muted-foreground">
                            —
                        </span>
                    )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-muted-foreground truncate font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {topMatchTitle || "No matches yet · Explore jobs"}
                </p>
            </Link>

            {/* Card 3: Recent Messages */}
            <Link
                href="/linkbridge/freelancer/messaging"
                className="bg-white dark:bg-card border border-slate-200/90 dark:border-border border-t-4 border-t-emerald-500 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all duration-200 ease-out hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5 group"
            >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-muted-foreground font-medium">
                    <span>Recent Messages</span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                </div>
                <div className="my-2">
                    <span className="text-2xl font-bold text-slate-900 dark:text-foreground">{unreadConversationsCount}</span>
                    <span className="text-xs text-slate-400 dark:text-muted-foreground"> unread in {conversations.length} {conversations.length === 1 ? "chat" : "chats"}</span>
                </div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    {unreadConversationsCount === 0 ? "All caught up" : `${unreadConversationsCount} ${unreadConversationsCount === 1 ? "chat requires" : "chats require"} attention`}
                </p>
            </Link>
        </div>
    );
}

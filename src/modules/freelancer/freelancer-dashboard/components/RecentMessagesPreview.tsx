"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useConversations } from "@/modules/freelancer/freelancer-messaging/hooks/useConversations";
import { ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Conversation } from "@/modules/freelancer/freelancer-messaging/types";

const AVATAR_GRADIENTS = [
    "from-indigo-600 to-blue-500",
    "from-blue-600 to-cyan-500",
    "from-amber-600 to-orange-500",
    "from-purple-600 to-pink-500",
    "from-emerald-600 to-teal-500",
];

interface RecentMessagesPreviewProps {
    conversations?: Conversation[];
    loading?: boolean;
}

export function RecentMessagesPreview({
    conversations: propConversations,
    loading: propLoading,
}: RecentMessagesPreviewProps = {}) {
    const { conversations: hookConversations, loading: hookLoading, loadConversations } = useConversations();

    const isControlled = propConversations !== undefined;

    useEffect(() => {
        if (!isControlled) {
            loadConversations();
        }
    }, [isControlled, loadConversations]);

    const conversations = propConversations || hookConversations;
    const loading = isControlled ? Boolean(propLoading) : hookLoading;

    const recentConversations = [...conversations]
        .sort((a, b) => {
            const unreadA = a.unread_count || 0;
            const unreadB = b.unread_count || 0;
            if (unreadA > 0 && unreadB === 0) return -1;
            if (unreadB > 0 && unreadA === 0) return 1;

            const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
        })
        .slice(0, 5);

    const getInitials = (name?: string) => {
        if (!name) return "U";
        return name
            .split(" ")
            .filter(Boolean)
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .substring(0, 2);
    };

    const formatMessageTime = (dateStr?: string | null) => {
        if (!dateStr) return "Recently";
        try {
            return formatDistanceToNow(new Date(dateStr), { addSuffix: false });
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
                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-muted"></div>
                            <div className="space-y-1.5">
                                <div className="h-3.5 w-32 bg-slate-200 dark:bg-muted rounded"></div>
                                <div className="h-2.5 w-40 bg-slate-100 dark:bg-muted rounded"></div>
                            </div>
                        </div>
                        <div className="h-3 w-12 bg-slate-100 dark:bg-muted rounded"></div>
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
                        <h3 className="text-sm font-bold text-slate-900 dark:text-foreground">Recent Messages</h3>
                        <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">Your latest conversations</p>
                    </div>
                    <Link
                        href="/linkbridge/freelancer/messaging"
                        className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
                    >
                        View All <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>

                {/* Un-nested List */}
                {recentConversations.length === 0 ? (
                    <div className="p-8 text-center">
                        <p className="text-xs text-slate-500 dark:text-muted-foreground">No conversations yet.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-border">
                        {recentConversations.map((conv, idx) => {
                            const name = conv.other_party_name || "Employer";
                            const gradient = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
                            const isUnread = (conv.unread_count || 0) > 0;

                            return (
                                <Link
                                    key={conv.conversation_id}
                                    href={`/linkbridge/freelancer/messaging?conversationId=${conv.conversation_id}`}
                                    className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-muted/40 transition group cursor-pointer"
                                >
                                    <div className="flex items-center gap-3.5 min-w-0 pr-3">
                                        {conv.other_party_avatar ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={conv.other_party_avatar}
                                                alt={name}
                                                className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200/80 dark:border-border shadow-sm"
                                                onError={(e) => {
                                                    // Fallback to initials if image fails to load
                                                    e.currentTarget.style.display = "none";
                                                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                                    if (fallback) fallback.style.display = "flex";
                                                }}
                                            />
                                        ) : null}
                                        <div
                                            className={`w-9 h-9 rounded-full bg-gradient-to-tr ${gradient} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm ${
                                                conv.other_party_avatar ? "hidden" : ""
                                            }`}
                                        >
                                            {getInitials(name)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-foreground truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {name}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-muted-foreground truncate">
                                                {conv.last_message_preview || "No message preview"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {isUnread && (
                                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                                        )}
                                        <span className="text-xs text-slate-400 dark:text-muted-foreground">
                                            {formatMessageTime(conv.last_message_at)}
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
import Link from "next/link";
import {
    ServerOff,
    DatabaseZap,
    RefreshCw,
    WifiOff,
    CheckCircle2,
    AlertTriangle,
    ArrowLeft,
    ShieldAlert,
    Clock,
    X
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SystemStatus {
    server: boolean;
    database: boolean;
    checking: boolean;
    lastChecked: string | null;
    latencyMs: number | null;
    errorType: "database" | "server" | "network" | "unknown";
}

interface ServerDownContentProps {
    title?: string;
    description?: string;
    errorCode?: string;
    reset?: () => void;
    onClose?: () => void;
    isOverlay?: boolean;
}

export const ServerDownContent = memo(function ServerDownContent({
    title = "System Temporarily Unavailable",
    description = "We are currently experiencing a disruption with our database or backend servers. You can retry the connection or dismiss this overlay.",
    errorCode = "503_SERVICE_UNAVAILABLE",
    reset,
    onClose,
    isOverlay = true,
}: ServerDownContentProps) {
    const [dismissed, setDismissed] = useState(false);
    const [status, setStatus] = useState<SystemStatus>({
        server: true,
        database: false,
        checking: false,
        lastChecked: null,
        latencyMs: null,
        errorType: "database",
    });

    const checkSystemHealth = useCallback(async () => {
        setStatus((prev) => ({ ...prev, checking: true }));
        const startTime = Date.now();

        try {
            const res = await fetch("/api/health", { cache: "no-store" });
            const latency = Date.now() - startTime;
            const data = await res.json().catch(() => null);

            // Format PH Local Time (UTC+8)
            const phTime = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace("T", " ").substring(0, 19) + " PST";

            if (res.ok && data?.database) {
                setStatus({
                    server: true,
                    database: true,
                    checking: false,
                    lastChecked: phTime,
                    latencyMs: latency,
                    errorType: "unknown",
                });
                if (reset) {
                    reset();
                } else if (onClose) {
                    onClose();
                }
            } else {
                setStatus({
                    server: data?.server ?? true,
                    database: data?.database ?? false,
                    checking: false,
                    lastChecked: phTime,
                    latencyMs: latency,
                    errorType: data?.database === false ? "database" : "server",
                });
            }
        } catch {
            const phTime = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace("T", " ").substring(0, 19) + " PST";
            setStatus({
                server: false,
                database: false,
                checking: false,
                lastChecked: phTime,
                latencyMs: null,
                errorType: "network",
            });
        }
    }, [reset, onClose]);

    useEffect(() => {
        checkSystemHealth();
    }, [checkSystemHealth]);

    if (dismissed) {
        return null;
    }

    const handleDismiss = () => {
        setDismissed(true);
        if (onClose) onClose();
    };

    const containerClasses = isOverlay
        ? "fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200"
        : "min-h-screen w-full flex items-center justify-center bg-background text-foreground p-4 md:p-8 relative overflow-hidden";

    return (
        <div className={containerClasses}>
            {/* Background Decorative Blur Gradients (only on standalone page) */}
            {!isOverlay && (
                <>
                    <div className="absolute -top-40 -left-40 w-96 h-96 bg-destructive/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                </>
            )}

            <div className="max-w-xl w-full bg-card/95 backdrop-blur-2xl border border-border/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 relative z-10 animate-in zoom-in-95 duration-200">
                {/* Header Badge */}
                <div className="flex items-start justify-between border-b border-border/60 pb-5">
                    <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-destructive/15 text-destructive rounded-xl shrink-0">
                            {status.errorType === "database" ? (
                                <DatabaseZap className="h-5 w-5 animate-pulse" />
                            ) : status.errorType === "network" ? (
                                <WifiOff className="h-5 w-5 animate-pulse" />
                            ) : (
                                <ServerOff className="h-5 w-5 animate-pulse" />
                            )}
                        </div>
                        <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-destructive">
                                System Outage Detected
                            </span>
                            <h2 className="text-lg font-bold text-foreground">LinkBridge Service Monitor</h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-muted text-muted-foreground border border-border">
                            {errorCode}
                        </span>
                        {(onClose || isOverlay) && (
                            <button
                                type="button"
                                onClick={handleDismiss}
                                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                                title="Dismiss Overlay"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="space-y-2">
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                        {title}
                    </h1>
                    <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                        {description}
                    </p>
                </div>

                {/* Live System Diagnostics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Server Status Card */}
                    <div className="bg-muted/40 border border-border/70 rounded-xl p-3.5 flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                            <ServerOff className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-[11px] font-medium text-muted-foreground">Web Server</p>
                                <p className="text-xs font-semibold text-foreground">
                                    {status.server ? "Operational" : "Offline / Unreachable"}
                                </p>
                            </div>
                        </div>
                        {status.server ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                        )}
                    </div>

                    {/* Database Status Card */}
                    <div className="bg-muted/40 border border-border/70 rounded-xl p-3.5 flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                            <DatabaseZap className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-[11px] font-medium text-muted-foreground">Database Backend</p>
                                <p className="text-xs font-semibold text-foreground">
                                    {status.database ? "Connected" : "Disconnected / Outage"}
                                </p>
                            </div>
                        </div>
                        {status.database ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                            <ShieldAlert className="h-4 w-4 text-destructive animate-bounce" />
                        )}
                    </div>
                </div>

                {/* Diagnostic Details & Timestamp */}
                <div className="bg-muted/25 border border-border/40 rounded-xl p-3 text-xs font-mono space-y-1.5 text-muted-foreground">
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[11px]">
                            <Clock className="h-3 w-3" /> Last Verified (PST):
                        </span>
                        <span className="font-semibold text-foreground text-[11px]">
                            {status.lastChecked || "Checking system..."}
                        </span>
                    </div>
                    {status.latencyMs !== null && (
                        <div className="flex items-center justify-between text-[11px]">
                            <span>Response Latency:</span>
                            <span className="font-semibold text-foreground">{status.latencyMs} ms</span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border/60">
                    <Button
                        onClick={checkSystemHealth}
                        disabled={status.checking}
                        variant="default"
                        size="sm"
                        className="w-full sm:w-auto font-semibold gap-2 shadow-sm"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${status.checking ? "animate-spin" : ""}`} />
                        {status.checking ? "Verifying..." : "Retry Connection"}
                    </Button>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {(onClose || isOverlay) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleDismiss}
                                className="w-full sm:w-auto text-xs"
                            >
                                Dismiss
                            </Button>
                        )}
                        <Button variant="outline" size="sm" asChild className="w-full sm:w-auto gap-1.5 text-xs">
                            <Link href="/">
                                <ArrowLeft className="h-3.5 w-3.5" /> Home
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
});

ServerDownContent.displayName = "ServerDownContent";


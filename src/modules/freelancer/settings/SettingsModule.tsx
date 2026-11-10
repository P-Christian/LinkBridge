"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSettings } from "@/modules/client/settings/hooks/useSettings";
import AccountSettings from "./components/AccountSettings";
import SecuritySettings from "./components/SecuritySettings";
import NotificationSettings from "./components/NotificationSettings";
import GeneralSettings from "./components/GeneralSettings";
import PrivacyDataRequests from "./components/PrivacyDataRequests";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Settings2,
  User,
  Shield,
  Bell,
  ChevronRight,
  Database,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsTab = "account" | "appearance" | "security" | "notifications" | "privacy";

const TABS: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "account", label: "Account Profile", icon: User },
  { id: "appearance", label: "Appearance & Themes", icon: Palette },
  { id: "security", label: "Security & Sessions", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Data & Privacy Requests", icon: Database },
];

export default function SettingsModule() {
  const {
    user,
    loading,
    saving,
    loadProfile,
    saveProfile,
    changePassword,
  } = useSettings();

  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(true);
  const tabScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
  };

  const handleTabsScroll = () => {
    const el = tabScrollRef.current;
    if (!el) return;
    setCanScrollTabsRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  return (
    <div className="space-y-6 freelancer-page-transition">
      <style>{`
        @keyframes page-entry {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .freelancer-page-transition {
          animation: page-entry 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-emerald-950 via-zinc-900 to-teal-950 dark:from-black dark:via-zinc-950 dark:to-zinc-900 text-white p-6 sm:p-8 rounded-3xl border border-white/10 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 h-40 w-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 bg-white/10 backdrop-blur rounded-2xl border border-white/20">
            <Settings2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Freelancer Settings</h1>
            <p className="text-sm text-zinc-300 mt-1">
              Manage your profile preferences, credentials, visual settings, and data privacy options.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs & Module Body */}
      <Card className="shadow-sm border bg-card rounded-xl py-0 gap-0 overflow-hidden">
        <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 px-6 py-0 bg-zinc-50/50 dark:bg-zinc-900/10">
          <div className="relative min-w-0">
            <div
              ref={tabScrollRef}
              onScroll={handleTabsScroll}
              className="flex items-center gap-2 overflow-x-auto no-scrollbar"
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                      activeTab === tab.id
                        ? "border-primary text-primary font-semibold"
                        : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute right-0 top-[25px] flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border bg-background/95 shadow-sm backdrop-blur transition-opacity md:hidden",
                canScrollTabsRight ? "opacity-100" : "opacity-0"
              )}
            >
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {loading && activeTab === "account" ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-zinc-400">Loading settings...</span>
            </div>
          ) : (
            <>
              {activeTab === "account" && (
                <AccountSettings user={user} saving={saving} onSave={saveProfile} />
              )}
              {activeTab === "appearance" && (
                <GeneralSettings />
              )}
              {activeTab === "security" && (
                <SecuritySettings saving={saving} onChangePassword={changePassword} />
              )}
              {activeTab === "notifications" && (
                <NotificationSettings />
              )}
              {activeTab === "privacy" && (
                <PrivacyDataRequests />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

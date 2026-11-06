"use client";

import React, { useEffect, useState } from "react";
import { useSettings } from "@/modules/client/settings/hooks/useSettings";
import AccountSettings from "@/modules/freelancer/settings/components/AccountSettings";
import SecuritySettings from "@/modules/freelancer/settings/components/SecuritySettings";
import { SettingsAppearance } from "@/app/(linkbridge)/linkbridge/settings/settings-appearance";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Settings2, User, Shield, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { SchoolAdminModuleHeader } from "./SchoolAdminModuleHeader";

type SettingsTab = "account" | "security" | "appearance";

const TABS: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "account", label: "Account Profile", icon: User },
  { id: "security", label: "Change Password", icon: Shield },
  { id: "appearance", label: "Appearance", icon: Palette },
];

export function SchoolAdminSettingsModule() {
  const {
    user,
    loading,
    saving,
    loadProfile,
    saveProfile,
    changePassword,
  } = useSettings();

  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
  };

  return (
    <div className="space-y-6 school-admin-page-transition">
      <style>{`
        @keyframes page-entry {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .school-admin-page-transition {
          animation: page-entry 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header */}
      <SchoolAdminModuleHeader
        title="Admin Profile Settings"
        description="Manage your personal administrator account details, security credentials, and workspace theme."
        icon={Settings2}
      />

      {/* Tabs Card */}
      <Card className="shadow-sm border bg-card rounded-xl py-0 gap-0 overflow-hidden">
        <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 px-6 py-0 bg-zinc-50/50 dark:bg-zinc-900/10">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
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
              {activeTab === "security" && (
                <SecuritySettings saving={saving} onChangePassword={changePassword} />
              )}
              {activeTab === "appearance" && (
                <SettingsAppearance />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

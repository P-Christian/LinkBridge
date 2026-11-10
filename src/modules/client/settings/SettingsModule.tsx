"use client";

// src/modules/client/settings/SettingsModule.tsx

import React, { useEffect, useState } from "react";
import { useSettings } from "./hooks/useSettings";
import AccountSettings from "./components/AccountSettings";
import SecuritySettings from "./components/SecuritySettings";
import NotificationSettings from "./components/NotificationSettings";
// import IntegrationSettings from "./components/IntegrationSettings";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  User,
  Shield,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export type SettingsTab = "account" | "security" | "notifications";

const TABS: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "account", label: "Account Profile", icon: User },
  { id: "security", label: "Security & Auth", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  // { id: "integrations", label: "Integrations", icon: Blocks },
];

export default function SettingsModule({
  initialTab = "account",
}: {
  initialTab?: SettingsTab;
}) {
  const {
    user,
    loading,
    saving,
    loadProfile,
    saveProfile,
    changePassword,
  } = useSettings();

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <div className="space-y-4 md:space-y-6 client-page-transition">
      <style>{`
        @keyframes page-entry {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .client-page-transition {
          animation: page-entry 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* ── Page Header & Breadcrumb ─────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Client Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your account preferences, password security, and notification preferences.
          </p>
        </div>
      </div>

      {/* Tabs & Module Body */}
      <Card className="shadow-sm border bg-card rounded-xl !py-0 gap-0 overflow-hidden">
        <CardHeader className="border-b gap-0 border-zinc-100 dark:border-zinc-800 px-6 max-md:px-1 !py-0 bg-zinc-50/50 dark:bg-zinc-900/10">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-md:grid max-md:grid-cols-3 max-md:items-stretch max-md:gap-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors whitespace-nowrap max-md:flex-col max-md:justify-center max-md:gap-1 max-md:px-1 max-md:py-3 max-md:text-xs max-md:tracking-tight max-md:text-center max-md:leading-tight max-md:whitespace-normal max-md:break-words",
                    isActive
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="activeTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          {loading && activeTab === "account" ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
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
              {activeTab === "notifications" && <NotificationSettings />}
              {/* {activeTab === "integrations" && <IntegrationSettings />} */}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Loader2, Mail, Smartphone, AlertCircle, CheckCircle, BellRing, Info, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  FreelancerNotificationPreference,
  FREELANCER_NOTIFICATION_CATEGORIES,
} from "../types";

// Common timezones list (self-contained)
const TIMEZONES = [
  { value: "Asia/Manila", label: "Manila (UTC+8)" },
  { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
  { value: "America/New_York", label: "Eastern Time (UTC-5/UTC-4)" },
  { value: "America/Los_Angeles", label: "Pacific Time (UTC-8/UTC-7)" },
  { value: "UTC", label: "UTC" },
];

interface Props {
  preferences: FreelancerNotificationPreference[];
  quietHours: { start: string | null; end: string | null; timezone: string | null };
  loading: boolean;
  saving: boolean;
  error: string;
  onSave: (payload: {
    preferences: Partial<FreelancerNotificationPreference>[];
    quiet_hours_start?: string | null;
    quiet_hours_end?: string | null;
    timezone?: string | null;
  }) => Promise<boolean>;
}

export default function FreelancerNotificationPreferences({
  preferences,
  quietHours,
  loading,
  saving,
  error,
  onSave,
}: Props) {
  // Global email master switch state
  const [globalEmailEnabled, setGlobalEmailEnabled] = useState(true);

  // Local state overrides for quiet hours inputs
  const [qStart, setQStart] = useState("");
  const [qEnd, setQEnd] = useState("");
  const [timezone, setTimezone] = useState("Asia/Manila");

  // Local overrides map for categories
  const [overrides, setOverrides] = useState<Map<string, Partial<FreelancerNotificationPreference>>>(
    () => new Map()
  );
  const [saved, setSaved] = useState(false);

  // Initialize quiet hours local inputs on prop changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (quietHours.start) setQStart(quietHours.start);
    if (quietHours.end) setQEnd(quietHours.end);
    if (quietHours.timezone) setTimezone(quietHours.timezone);
  }, [quietHours]);

  const draftMap = useMemo(() => {
    const map = new Map<string, FreelancerNotificationPreference>();

    // Seed with all known categories and their defaults first
    FREELANCER_NOTIFICATION_CATEGORIES.flatMap((g) => g.categories).forEach((catItem) => {
      map.set(catItem.category, {
        user_id: 0,
        category: catItem.category,
        email_enabled: catItem.defaultEmail,
        in_app_enabled: catItem.defaultInApp,
      });
    });

    // Merge server preferences
    preferences.forEach((p) => {
      map.set(p.category, {
        ...map.get(p.category),
        ...p,
      });
    });

    // Apply local unsaved overrides
    overrides.forEach((val, cat) => {
      const existing = map.get(cat) ?? {
        user_id: 0,
        category: cat,
        email_enabled: true,
        in_app_enabled: true,
      };
      map.set(cat, {
        ...existing,
        ...val,
      });
    });

    return map;
  }, [preferences, overrides]);

  const handleToggle = (
    category: string,
    field: "email_enabled" | "in_app_enabled",
    value: boolean
  ) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      const current = draftMap.get(category) ?? {
        user_id: 0,
        category,
        email_enabled: true,
        in_app_enabled: true,
      };
      next.set(category, {
        ...current,
        [field]: value,
      });
      return next;
    });
    setSaved(false);
  };

  const handleMasterEmailToggle = (enabled: boolean) => {
    setGlobalEmailEnabled(enabled);
    setOverrides((prev) => {
      const next = new Map(prev);
      FREELANCER_NOTIFICATION_CATEGORIES.flatMap((g) => g.categories).forEach((item) => {
        const current = draftMap.get(item.category) ?? {
          user_id: 0,
          category: item.category,
          email_enabled: item.defaultEmail,
          in_app_enabled: item.defaultInApp,
        };
        next.set(item.category, {
          ...current,
          email_enabled: enabled ? item.defaultEmail : false,
        });
      });
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    const allCategories = FREELANCER_NOTIFICATION_CATEGORIES.flatMap((g) => g.categories.map((c) => c.category));
    const payloadPrefs: Partial<FreelancerNotificationPreference>[] = [];

    const categoryKeys = Array.from(new Set([...allCategories, ...Array.from(draftMap.keys())]));

    categoryKeys.forEach((cat) => {
      const item = draftMap.get(cat);
      if (item) {
        payloadPrefs.push({
          category: cat,
          email_enabled: globalEmailEnabled ? item.email_enabled : false,
          in_app_enabled: item.in_app_enabled,
        });
      }
    });

    const ok = await onSave({
      preferences: payloadPrefs,
      quiet_hours_start: qStart || null,
      quiet_hours_end: qEnd || null,
      timezone: timezone || null,
    });

    if (ok) {
      setOverrides(new Map());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-zinc-400">Loading notification preferences...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-start gap-3">
        <BellRing className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-200">
            Freelancer Notification Center
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage how and when you receive emails and in-app alerts for job status updates, interview schedules, and platform communications.
          </p>
        </div>
      </div>

      {/* Global Email Switch */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-zinc-500" />
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Receive email notifications
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Master toggle for all email alerts across all categories
          </p>
        </div>
        <Switch
          id="global-email-toggle"
          checked={globalEmailEnabled}
          onCheckedChange={handleMasterEmailToggle}
          disabled={saving}
        />
      </div>

      {/* Column Headers */}
      <div className="flex items-center justify-between px-2 pt-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
        <span>Notification Category</span>
        <div className="flex items-center gap-8 pr-2">
          <span className="w-16 text-center flex items-center justify-center gap-1">
            <Mail className="h-3 w-3" /> Email
          </span>
          <span className="w-16 text-center flex items-center justify-center gap-1">
            <Smartphone className="h-3 w-3" /> In-App
          </span>
        </div>
      </div>

      {/* Grouped Notification Categories */}
      {FREELANCER_NOTIFICATION_CATEGORIES.map((group) => (
        <div
          key={group.title}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm space-y-0"
        >
          {/* Section Header */}
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              {group.title}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{group.description}</p>
          </div>

          {/* Items List */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {group.categories.map((catItem) => {
              const pref = draftMap.get(catItem.category) ?? {
                user_id: 0,
                category: catItem.category,
                email_enabled: catItem.defaultEmail,
                in_app_enabled: catItem.defaultInApp,
              };

              const emailActive = globalEmailEnabled && pref.email_enabled;

              return (
                <div
                  key={catItem.category}
                  className="flex items-center justify-between px-4 py-3.5 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {catItem.label}
                  </span>

                  <div className="flex items-center gap-8 pr-2">
                    {/* Email Switch */}
                    <div className="w-16 flex justify-center">
                      <Switch
                        id={`email-${catItem.category}`}
                        checked={emailActive}
                        onCheckedChange={(val) =>
                          handleToggle(catItem.category, "email_enabled", val)
                        }
                        disabled={saving || !globalEmailEnabled}
                        className="cursor-pointer"
                        aria-label={`Enable email notifications for ${catItem.label}`}
                      />
                    </div>

                    {/* In-App Switch */}
                    <div className="w-16 flex justify-center">
                      <Switch
                        id={`inapp-${catItem.category}`}
                        checked={pref.in_app_enabled}
                        onCheckedChange={(val) =>
                          handleToggle(catItem.category, "in_app_enabled", val)
                        }
                        disabled={saving}
                        className="cursor-pointer"
                        aria-label={`Enable in-app notifications for ${catItem.label}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Quiet Hours Settings Panel */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
          <Clock className="h-4 w-4 text-zinc-500" />
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            Quiet Hours (Optional)
          </h3>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Delay non-urgent notification emails during your local resting period. Critical transactional updates bypass quiet hours.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Quiet Hours Start</label>
            <input
              type="time"
              value={qStart}
              onChange={(e) => { setQStart(e.target.value); setSaved(false); }}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Quiet Hours End</label>
            <input
              type="time"
              value={qEnd}
              onChange={(e) => { setQEnd(e.target.value); setSaved(false); }}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => { setTimezone(e.target.value); setSaved(false); }}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Feedback Messages */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 px-1">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 px-1">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Changes saved successfully.
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <span className="text-xs text-zinc-500 flex items-center gap-1">
          <Info className="h-3.5 w-3.5" /> Preference updates apply immediately across all notifications.
        </span>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-6 text-sm rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground border-0 font-semibold shadow-sm transition-all"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving Changes...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
}

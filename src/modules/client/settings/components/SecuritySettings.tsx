"use client";

// src/modules/client/settings/components/SecuritySettings.tsx

import React, { useState, useEffect } from "react";
import { SecurityPayload } from "../types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  KeyRound,
  ShieldCheck,
  Lock,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  LogOut,
  Laptop,
} from "lucide-react";
import { toast } from "sonner";
import { validatePasswordStrict } from "@/lib/password-validation";
import PasswordRequirementsChecklist from "@/components/auth/PasswordRequirementsChecklist";
import { ConnectedAccountsCard } from "@/modules/auth/components/ConnectedAccountsCard";

interface SecuritySettingsProps {
  saving: boolean;
  onChangePassword: (payload: SecurityPayload) => Promise<boolean>;
}

interface DeviceSession {
  session_id: string;
  device: string;
  device_type?: "DESKTOP" | "MOBILE" | "TABLET" | "UNKNOWN";
  browser: string;
  deployment_id?: string;
  ip_address: string;
  location: string;
  last_active: string;
  is_current: boolean;
}

export default function SecuritySettings({
  saving,
  onChangePassword,
}: SecuritySettingsProps) {
  const [form, setForm] = useState<SecurityPayload>({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [localError, setLocalError] = useState("");
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);

  // Sessions states
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const fetchSessions = React.useCallback(async () => {
    try {
      setSessionsLoading(true);
      const res = await fetch("/api/client/settings/sessions");
      if (!res.ok) throw new Error("Failed to load active sessions.");
      const json = await res.json();
      setSessions(json.sessions || []);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/client/settings/sessions");
        if (!res.ok) throw new Error("Failed to load active sessions.");
        const json = await res.json();
        if (!ignore) {
          setSessions(json.sessions || []);
        }
      } catch (err: unknown) {
        console.error(err);
      } finally {
        if (!ignore) {
          setSessionsLoading(false);
        }
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");

    if (!form.current_password) {
      setLocalError("Current password is required.");
      return;
    }
    if (!form.new_password || !validatePasswordStrict(form.new_password)) {
      setLocalError("New password does not meet all security requirements.");
      return;
    }
    if (form.new_password !== form.confirm_password) {
      setLocalError("New password and confirm password do not match.");
      return;
    }

    setShowLogoutDialog(true);
  };

  const executePasswordChange = async (revokeOthers: boolean) => {
    try {
      setDialogLoading(true);
      const payload: SecurityPayload = {
        ...form,
        revoke_other_sessions: revokeOthers,
      };

      const ok = await onChangePassword(payload);
      if (ok) {
        setForm({ current_password: "", new_password: "", confirm_password: "" });
        setShowLogoutDialog(false);
        fetchSessions();
      }
    } finally {
      setDialogLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      setRevokingId(sessionId);
      const res = await fetch(`/api/client/settings/sessions?session_id=${sessionId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to revoke session.");
      toast.success("Session terminated successfully.");

      const isCurrentSession =
        sessionId === "current-session" ||
        sessions.find((s) => s.session_id === sessionId)?.is_current;

      if (isCurrentSession) {
        window.location.replace("/login");
      } else {
        setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to terminate session.");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    try {
      setRevokingAll(true);
      const res = await fetch("/api/client/settings/sessions?session_id=all-other", {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to revoke other sessions.");
      toast.success("All other device sessions have been signed out.");
      fetchSessions();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to terminate other sessions.");
    } finally {
      setRevokingAll(false);
    }
  };

  const renderDeviceIcon = (session: DeviceSession) => {
    const type = session.device_type?.toUpperCase();
    if (type === "MOBILE" || session.device.toLowerCase().includes("iphone") || session.device.toLowerCase().includes("android")) {
      return <Smartphone className="h-4 w-4" />;
    }
    if (type === "TABLET" || session.device.toLowerCase().includes("ipad") || session.device.toLowerCase().includes("tab")) {
      return <Tablet className="h-4 w-4" />;
    }
    if (session.device.toLowerCase().includes("macbook") || session.device.toLowerCase().includes("laptop")) {
      return <Laptop className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const otherSessionsCount = sessions.filter((s) => !s.is_current).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Password Management */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Account Password &amp; Security
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Use a strong, unique password. Changing it requires verifying your current one.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {localError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm md:text-xs">
                {localError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="curr-pass" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-zinc-400" /> Current Password
              </Label>
              <Input
                id="curr-pass"
                type="password"
                value={form.current_password}
                onChange={(e) => setForm((p) => ({ ...p, current_password: e.target.value }))}
                placeholder="••••••••"
                className="h-9 text-sm rounded-lg"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-pass" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-zinc-400" /> New Password
              </Label>
              <Input
                id="new-pass"
                type="password"
                value={form.new_password}
                onChange={(e) => setForm((p) => ({ ...p, new_password: e.target.value }))}
                placeholder="Min. 8 characters"
                className="h-9 text-sm rounded-lg"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="conf-pass" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-zinc-400" /> Confirm New Password
              </Label>
              <Input
                id="conf-pass"
                type="password"
                value={form.confirm_password}
                onChange={(e) => setForm((p) => ({ ...p, confirm_password: e.target.value }))}
                placeholder="Re-enter new password"
                className="h-9 text-sm rounded-lg"
                required
              />
            </div>

            <PasswordRequirementsChecklist password={form.new_password || ""} confirmPassword={form.confirm_password} />

            <div className="pt-1">
              <Button
                type="submit"
                disabled={saving || !validatePasswordStrict(form.new_password || "")}
                className="h-9 w-full sm:w-auto px-6 text-sm rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                    Updating Password...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Right Column: Active Device Sessions */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <Monitor className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  Active Device Sessions
                  {!sessionsLoading && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                      {sessions.length}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  Devices currently signed in to your account.
                </p>
              </div>
            </div>
            {otherSessionsCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRevokeAllOtherSessions}
                disabled={revokingAll}
                className="shrink-0 h-7 rounded-lg text-xs border-destructive/20 text-destructive hover:bg-destructive/10"
              >
                {revokingAll ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                ) : (
                  <LogOut className="h-3 w-3 mr-1.5" />
                )}
                Log out others
              </Button>
            )}
          </div>

          {sessionsLoading ? (
            <div className="flex items-center justify-center py-10 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading active sessions...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              No active sessions found.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[26rem] overflow-y-auto pr-1">
              {sessions.map((session) => (
                <div
                  key={session.session_id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors max-md:flex-wrap max-md:gap-2"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 bg-white dark:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-lg mt-0.5 shrink-0">
                      {renderDeviceIcon(session)}
                    </div>
                    <div className="min-w-0 max-md:break-words space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{session.device}</span>
                        {session.is_current && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            This device
                          </span>
                        )}
                        {session.deployment_id && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                            {session.deployment_id.includes("msi-lo") || session.deployment_id === "local" ? "Local" : session.deployment_id}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {session.browser} • {session.ip_address}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                        <Globe className="h-3 w-3 shrink-0" /> {session.location} • {session.last_active}
                      </p>
                    </div>
                  </div>

                  {!session.is_current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeSession(session.session_id)}
                      disabled={revokingId === session.session_id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg p-2 shrink-0"
                      title="Revoke this session"
                    >
                      {revokingId === session.session_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Connected Accounts & Social Logins */}
      <ConnectedAccountsCard returnTo="/linkbridge/client/settings" />

      {/* Choice B Password Change Confirmation Dialog */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-xl p-6 shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-foreground">
              Log Out of Other Devices?
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground">
              Would you like to sign out of all other devices and browser sessions? You will stay logged in on this device.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-2.5">
            <Button
              type="button"
              onClick={() => executePasswordChange(true)}
              disabled={dialogLoading || saving}
              className="w-full rounded-full bg-primary font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
            >
              {dialogLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Log Out Other Devices (Recommended)
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => executePasswordChange(false)}
              disabled={dialogLoading || saving}
              className="w-full rounded-full border border-primary/20 bg-card/70 hover:bg-primary/10 font-medium"
            >
              Keep Other Devices Logged In
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowLogoutDialog(false)}
              disabled={dialogLoading || saving}
              className="w-full rounded-full text-muted-foreground hover:text-foreground text-xs"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

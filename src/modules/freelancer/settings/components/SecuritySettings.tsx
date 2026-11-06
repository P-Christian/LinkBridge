"use client";

import React, { useState, useEffect } from "react";
import { SecurityPayload } from "@/modules/client/settings/types";
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
  Eye,
  EyeOff,
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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      const res = await fetch("/api/freelancer/settings/sessions");
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSessions();
  }, [fetchSessions]);

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

    // Open confirmation dialog for Choice B
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
        if (revokeOthers) {
          toast.success("Password changed. All other device sessions were signed out.");
        } else {
          toast.success("Password changed successfully.");
        }
        fetchSessions();
      }
    } finally {
      setDialogLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      setRevokingId(sessionId);
      const res = await fetch(`/api/freelancer/settings/sessions?session_id=${sessionId}`, {
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
      const res = await fetch("/api/freelancer/settings/sessions?session_id=all-other", {
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
    <div className="space-y-4 md:space-y-8">
      {/* Security Guidance Banner */}
      <div className="bg-primary/10 border border-primary/20 p-4 rounded-2xl flex items-start gap-3 backdrop-blur-md">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Account Password & Security
          </h4>
          <p className="text-sm md:text-xs text-muted-foreground mt-0.5">
            Ensure your account uses a strong, unique password with at least 8 characters. Changing your credentials requires verifying your current password.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        {/* Password Form */}
        <div className="space-y-5">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Change Password</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {localError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm md:text-xs">
                {localError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="curr-pass" className="text-sm md:text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Current Password
              </Label>
              <div className="relative">
                <Input
                  id="curr-pass"
                  type={showCurrentPassword ? "text" : "password"}
                  value={form.current_password}
                  onChange={(e) => setForm((p) => ({ ...p, current_password: e.target.value }))}
                  placeholder="••••••••"
                  className="h-11 md:h-10 text-base md:text-sm rounded-xl pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-pass" className="text-sm md:text-xs font-semibold text-foreground flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> New Password
              </Label>
              <div className="relative">
                <Input
                  id="new-pass"
                  type={showNewPassword ? "text" : "password"}
                  value={form.new_password}
                  onChange={(e) => setForm((p) => ({ ...p, new_password: e.target.value }))}
                  placeholder="Min. 8 characters"
                  className="h-11 md:h-10 text-base md:text-sm rounded-xl pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conf-pass" className="text-sm md:text-xs font-semibold text-foreground flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="conf-pass"
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirm_password}
                  onChange={(e) => setForm((p) => ({ ...p, confirm_password: e.target.value }))}
                  placeholder="Re-enter new password"
                  className="h-11 md:h-10 text-base md:text-sm rounded-xl pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <PasswordRequirementsChecklist password={form.new_password || ""} confirmPassword={form.confirm_password} />

            <div className="pt-2">
              <Button
                type="submit"
                disabled={saving || !validatePasswordStrict(form.new_password || "")}
                className="h-11 md:h-10 px-6 text-sm rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md transition-all disabled:opacity-50"
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

        {/* Active Sessions Panel */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Active Device Sessions</h3>
            {otherSessionsCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRevokeAllOtherSessions}
                disabled={revokingAll}
                className="rounded-full text-xs border-destructive/20 text-destructive hover:bg-destructive/10"
              >
                {revokingAll ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                ) : (
                  <LogOut className="h-3 w-3 mr-1.5" />
                )}
                Log out other devices
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Manage devices and browsers currently signed in to your account across local and production deployments.
          </p>

          {sessionsLoading ? (
            <div className="flex items-center justify-center py-10 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm md:text-xs text-muted-foreground">Loading active sessions...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div 
                  key={session.session_id} 
                  className="flex items-center justify-between p-4 rounded-2xl border border-primary/10 bg-card/70 backdrop-blur-xl shadow-sm hover:border-primary/20 transition-all max-md:flex-wrap max-md:gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2.5 bg-primary/10 text-primary rounded-xl mt-0.5 shrink-0">
                      {renderDeviceIcon(session)}
                    </div>
                    <div className="min-w-0 max-md:break-words space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{session.device}</span>
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
                      <p className="text-xs text-muted-foreground">
                        {session.browser} • {session.ip_address}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
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
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl p-2 shrink-0"
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

      <div className="max-w-2xl">
        <ConnectedAccountsCard returnTo="/linkbridge/freelancer/settings" />
      </div>

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

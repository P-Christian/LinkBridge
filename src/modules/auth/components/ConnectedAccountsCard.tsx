// src/modules/auth/components/ConnectedAccountsCard.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Globe,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Link as LinkIcon,
  Unlink,
  ExternalLink,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { openOAuthPopup } from "@/modules/auth/utils/oauth-popup";
import { motion } from "framer-motion";

interface ConnectedAccountsCardProps {
  returnTo: string;
}

interface SocialAuthStatus {
  connected: boolean;
  name: string | null;
  email: string | null;
  linked_at: string | null;
  has_password: boolean;
}

function GoogleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LinkedInIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#0A66C2"
        d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76c.94 0 1.7-.76 1.7-1.7s-.76-1.7-1.7-1.7a1.7 1.7 0 0 0-1.7 1.7c0 .94.76 1.7 1.7 1.7m1.39 9.74v-8.37H5.07v8.37h2.78z"
      />
    </svg>
  );
}

function FacebookIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
  );
}

type ProviderKey = "google" | "linkedin" | "facebook";

export function ConnectedAccountsCard({ returnTo }: ConnectedAccountsCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [googleStatus, setGoogleStatus] = useState<SocialAuthStatus | null>(null);
  const [linkedinStatus, setLinkedinStatus] = useState<SocialAuthStatus | null>(null);
  const [facebookStatus, setFacebookStatus] = useState<SocialAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlinkingProvider, setUnlinkingProvider] = useState<ProviderKey | null>(null);
  const [confirmProvider, setConfirmProvider] = useState<ProviderKey | null>(null);
  const [noPasswordProvider, setNoPasswordProvider] = useState<ProviderKey | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<ProviderKey | null>(null);

  // Cross-account email conflict pending confirmation
  const [pendingLinkOpen, setPendingLinkOpen] = useState(false);
  const [pendingLinkEmail, setPendingLinkEmail] = useState<string | null>(null);
  const [confirmingLink, setConfirmingLink] = useState(false);

  // Email Already Registered conflict modal
  const [conflictModal, setConflictModal] = useState<{
    open: boolean;
    provider: ProviderKey;
    email: string | null;
  }>({
    open: false,
    provider: "facebook",
    email: null,
  });

  const fetchStatuses = useCallback(async () => {
    try {
      setLoading(true);
      const [googleRes, linkedinRes, facebookRes] = await Promise.all([
        fetch("/api/auth/google/status", { cache: "no-store" }),
        fetch("/api/auth/linkedin/status", { cache: "no-store" }),
        fetch("/api/auth/facebook/status", { cache: "no-store" }),
      ]);

      if (googleRes.ok) {
        const gData = (await googleRes.json()) as { ok: boolean } & SocialAuthStatus;
        if (gData.ok) {
          setGoogleStatus({
            connected: gData.connected,
            name: gData.name ?? null,
            email: gData.email,
            linked_at: gData.linked_at,
            has_password: gData.has_password,
          });
        }
      }

      if (linkedinRes.ok) {
        const lData = (await linkedinRes.json()) as { ok: boolean } & SocialAuthStatus;
        if (lData.ok) {
          setLinkedinStatus({
            connected: lData.connected,
            name: lData.name ?? null,
            email: lData.email,
            linked_at: lData.linked_at,
            has_password: lData.has_password,
          });
        }
      }

      if (facebookRes.ok) {
        const fData = (await facebookRes.json()) as { ok: boolean } & SocialAuthStatus;
        if (fData.ok) {
          setFacebookStatus({
            connected: fData.connected,
            name: fData.name ?? null,
            email: fData.email,
            linked_at: fData.linked_at,
            has_password: fData.has_password,
          });
        }
      }
    } catch (err: unknown) {
      console.error("[ConnectedAccountsCard] Status fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchStatuses();
    });
  }, [fetchStatuses]);

  // Handle URL redirect query feedback
  useEffect(() => {
    const linked = searchParams.get("linked");
    const error = searchParams.get("error");
    const notice = searchParams.get("notice");
    const pendingLink = searchParams.get("pending_link");
    const pendingEmail = searchParams.get("email");
    const conflict = searchParams.get("conflict");
    const conflictProvider = searchParams.get("conflict_provider");

    if (conflict === "email_already_registered") {
      queueMicrotask(() => {
        setConflictModal({
          open: true,
          provider: (conflictProvider || "facebook") as ProviderKey,
          email: pendingEmail || null,
        });
      });
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("conflict");
      nextUrl.searchParams.delete("conflict_provider");
      nextUrl.searchParams.delete("email");
      router.replace(nextUrl.pathname + nextUrl.search);
      return;
    }

    if (notice === "already_connected") {
      toast.info("Already connected", {
        description: "This Google account is already linked to your LinkBridge account.",
      });
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("notice");
      router.replace(nextUrl.pathname + nextUrl.search);
    }

    if (pendingLink === "google" && pendingEmail) {
      queueMicrotask(() => {
        setPendingLinkEmail(pendingEmail);
        setPendingLinkOpen(true);
      });
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("pending_link");
      nextUrl.searchParams.delete("email");
      router.replace(nextUrl.pathname + nextUrl.search);
    }

    if (linked === "google") {
      toast.success("Google account connected", {
        description: "Your Google identity was successfully linked to this account.",
      });
      queueMicrotask(() => {
        fetchStatuses();
      });
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("linked");
      router.replace(nextUrl.pathname + nextUrl.search);
    } else if (linked === "linkedin") {
      toast.success("LinkedIn account connected", {
        description: "Your LinkedIn identity was successfully linked to this account.",
      });
      queueMicrotask(() => {
        fetchStatuses();
      });
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("linked");
      router.replace(nextUrl.pathname + nextUrl.search);
    } else if (linked === "facebook") {
      toast.success("Facebook account connected", {
        description: "Your Facebook identity was successfully linked to this account.",
      });
      queueMicrotask(() => {
        fetchStatuses();
      });
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("linked");
      router.replace(nextUrl.pathname + nextUrl.search);
    }

    if (error) {
      const errorMap: Record<string, string> = {
        google_already_linked: "This Google account is already linked to another LinkBridge user. Linking is blocked.",
        linkedin_already_linked: "This LinkedIn account is already linked to another LinkBridge user. Linking is blocked.",
        facebook_already_linked: "This Facebook account is already linked to another LinkBridge user. Linking is blocked.",
        link_unauthorized: "Authentication session verification failed. Please try again.",
        session_expired: "Your active session expired during linking. Please log in again.",
        oauth_callback_failed: "Could not complete social account authentication.",
        linkedin_callback_failed: "Could not complete LinkedIn authentication.",
        facebook_callback_failed: "Could not complete Facebook authentication.",
      };
      const description = errorMap[error];
      if (description) {
        toast.error("Linking failed", { description });
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete("error");
        router.replace(nextUrl.pathname + nextUrl.search);
      }
    }
  }, [searchParams, fetchStatuses, router]);

  const handleConfirmPendingLink = useCallback(async () => {
    try {
      setConfirmingLink(true);
      const res = await fetch("/api/auth/google/confirm-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to confirm account link.");
      }
      toast.success("Google account connected", {
        description: "Your Google identity was successfully linked to this account.",
      });
      setPendingLinkOpen(false);
      setPendingLinkEmail(null);
      fetchStatuses();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Confirmation failed.";
      toast.error("Linking failed", { description: message });
    } finally {
      setConfirmingLink(false);
    }
  }, [fetchStatuses]);

  const handleCancelPendingLink = useCallback(async () => {
    try {
      await fetch("/api/auth/google/cancel-link", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setPendingLinkOpen(false);
      setPendingLinkEmail(null);
    }
  }, []);

  const handleConnect = useCallback(
    (provider: ProviderKey) => {
      setConnectingProvider(provider);
      const targetUrl = `/api/auth/${provider}?mode=link&returnTo=${encodeURIComponent(returnTo)}`;
      const title = `Connect ${provider.charAt(0).toUpperCase() + provider.slice(1)}`;

      openOAuthPopup({
        url: targetUrl,
        title,
        onSuccess: (response) => {
          setConnectingProvider(null);
          if (response.notice === "already_connected") {
            toast.info("Already connected", {
              description: "This account is already linked to your LinkBridge profile.",
            });
            return;
          }

          const redirectUrl = response.redirectUrl;
          if (redirectUrl) {
            try {
              const parsed = new URL(redirectUrl, window.location.origin);
              if (parsed.searchParams.get("pending_link") === "google") {
                const emailParam = parsed.searchParams.get("email");
                if (emailParam) {
                  setPendingLinkEmail(emailParam);
                  setPendingLinkOpen(true);
                }
                return;
              }
            } catch {
              // ignore
            }
          }

          const providerLabel =
            provider === "google"
              ? "Google"
              : provider === "linkedin"
                ? "LinkedIn"
                : "Facebook";
          toast.success(`${providerLabel} account connected`, {
            description: `Your ${providerLabel} identity was successfully linked to this account.`,
          });
          fetchStatuses();
        },
        onCancel: () => {
          setConnectingProvider(null);
          toast.info("Connection cancelled", {
            description: "The authentication window was closed before completing.",
          });
        },
        onError: (payload) => {
          setConnectingProvider(null);
          const errCode = payload.error;

          if (errCode === "email_already_registered") {
            setConflictModal({
              open: true,
              provider: (payload.provider || "facebook") as ProviderKey,
              email: payload.email || null,
            });
            return;
          }

          const errorMap: Record<string, string> = {
            google_already_linked: "This Google account is already linked to another LinkBridge user. Linking is blocked.",
            linkedin_already_linked: "This LinkedIn account is already linked to another LinkBridge user. Linking is blocked.",
            facebook_already_linked: "This Facebook account is already linked to another LinkBridge user. Linking is blocked.",
            link_unauthorized: "Authentication session verification failed. Please try again.",
            session_expired: "Your active session expired during linking. Please log in again.",
            oauth_callback_failed: "Could not complete social account authentication.",
            linkedin_callback_failed: "Could not complete LinkedIn authentication.",
            facebook_callback_failed: "Could not complete Facebook authentication.",
            cancelled: "Authentication was cancelled.",
          };
          const description = (errCode && errorMap[errCode]) || "Social account linking failed.";
          toast.error("Linking failed", { description });
        },
        onClose: () => {
          setConnectingProvider(null);
        },
      });
    },
    [returnTo, fetchStatuses]
  );

  const handleDisconnectClick = useCallback(
    (provider: ProviderKey) => {
      const currentStatus =
        provider === "google"
          ? googleStatus
          : provider === "linkedin"
            ? linkedinStatus
            : facebookStatus;
      if (!currentStatus?.has_password) {
        setNoPasswordProvider(provider);
        return;
      }
      setConfirmProvider(provider);
    },
    [googleStatus, linkedinStatus, facebookStatus]
  );

  const handleConfirmDisconnect = useCallback(async () => {
    if (!confirmProvider) return;
    const provider = confirmProvider;

    try {
      setUnlinkingProvider(provider);
      const res = await fetch(`/api/auth/${provider}/unlink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Failed to disconnect ${provider} account.`);
      }

      const providerLabel =
        provider === "google"
          ? "Google"
          : provider === "linkedin"
            ? "LinkedIn"
            : "Facebook";
      toast.success("Account disconnected", {
        description: `Your ${providerLabel} account has been disconnected successfully.`,
      });
      setConfirmProvider(null);
      fetchStatuses();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Disconnect failed.";
      toast.error("Disconnection failed", { description: message });
    } finally {
      setUnlinkingProvider(null);
    }
  }, [confirmProvider, fetchStatuses]);

  const activeDisconnectEmail =
    confirmProvider === "google"
      ? googleStatus?.email
      : confirmProvider === "linkedin"
        ? linkedinStatus?.email
        : confirmProvider === "facebook"
          ? facebookStatus?.email
          : "";

  const activeDisconnectName =
    confirmProvider === "google"
      ? googleStatus?.name
      : confirmProvider === "linkedin"
        ? linkedinStatus?.name
        : confirmProvider === "facebook"
          ? facebookStatus?.name
          : "";

  const activeDisconnectLabel =
    confirmProvider === "google"
      ? "Google"
      : confirmProvider === "linkedin"
        ? "LinkedIn"
        : "Facebook";

  return (
    <div className="space-y-4 pt-6 ">
      <div className="flex items-start gap-3">
        <LinkIcon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Connected Accounts & Social Logins
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Link external federated providers to enable fast, single-click sign-in to your LinkBridge account.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        {/* Google Provider Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg border border-border bg-background flex items-center justify-center shrink-0">
              <GoogleIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Google Account</span>
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                ) : googleStatus?.connected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border">
                    Not Connected
                  </span>
                )}
              </div>
              {googleStatus?.connected ? (
                <div className="text-xs mt-0.5 space-y-0.5">
                  {googleStatus.name && (
                    <div className="font-medium text-foreground">{googleStatus.name}</div>
                  )}
                  <div className="text-muted-foreground">{googleStatus.email || "No email available"}</div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  No Google identity linked to this account
                </p>
              )}
            </div>
          </div>

          <div>
            {loading ? (
              <Button variant="outline" size="sm" disabled className="h-9">
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Checking...
              </Button>
            ) : googleStatus?.connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDisconnectClick("google")}
                disabled={unlinkingProvider === "google"}
                className="h-9 border-border text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
              >
                {unlinkingProvider === "google" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <Unlink className="w-3.5 h-3.5 mr-1.5" />
                    Disconnect
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConnect("google")}
                disabled={connectingProvider !== null}
                className="h-9 border-border text-foreground hover:bg-muted transition-colors"
              >
                {connectingProvider === "google" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5 mr-1.5 text-primary" />
                    Connect Google
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-border" />

        {/* LinkedIn Provider Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg border border-border bg-background flex items-center justify-center shrink-0">
              <LinkedInIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">LinkedIn Account</span>
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                ) : linkedinStatus?.connected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border">
                    Not Connected
                  </span>
                )}
              </div>
              {linkedinStatus?.connected ? (
                <div className="text-xs mt-0.5 space-y-0.5">
                  {linkedinStatus.name && (
                    <div className="font-medium text-foreground">{linkedinStatus.name}</div>
                  )}
                  <div className="text-muted-foreground">{linkedinStatus.email || "No email available"}</div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  No LinkedIn identity linked to this account
                </p>
              )}
            </div>
          </div>

          <div>
            {loading ? (
              <Button variant="outline" size="sm" disabled className="h-9">
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Checking...
              </Button>
            ) : linkedinStatus?.connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDisconnectClick("linkedin")}
                disabled={unlinkingProvider === "linkedin"}
                className="h-9 border-border text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
              >
                {unlinkingProvider === "linkedin" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <Unlink className="w-3.5 h-3.5 mr-1.5" />
                    Disconnect
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConnect("linkedin")}
                disabled={connectingProvider !== null}
                className="h-9 border-border text-foreground hover:bg-muted transition-colors"
              >
                {connectingProvider === "linkedin" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5 mr-1.5 text-primary" />
                    Connect LinkedIn
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Facebook Provider Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg border border-border bg-background flex items-center justify-center shrink-0">
              <FacebookIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Facebook Account</span>
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                ) : facebookStatus?.connected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border">
                    Not Connected
                  </span>
                )}
              </div>
              {facebookStatus?.connected ? (
                <div className="text-xs mt-0.5 space-y-0.5">
                  {facebookStatus.name && (
                    <div className="font-medium text-foreground">{facebookStatus.name}</div>
                  )}
                  <div className="text-muted-foreground">{facebookStatus.email || "No email available"}</div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  No Facebook identity linked to this account
                </p>
              )}
            </div>
          </div>

          <div>
            {loading ? (
              <Button variant="outline" size="sm" disabled className="h-9">
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Checking...
              </Button>
            ) : facebookStatus?.connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDisconnectClick("facebook")}
                disabled={unlinkingProvider === "facebook"}
                className="h-9 border-border text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
              >
                {unlinkingProvider === "facebook" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <Unlink className="w-3.5 h-3.5 mr-1.5" />
                    Disconnect
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConnect("facebook")}
                disabled={connectingProvider !== null}
                className="h-9 border-border text-foreground hover:bg-muted transition-colors"
              >
                {connectingProvider === "facebook" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5 mr-1.5 text-primary" />
                    Connect Facebook
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Disconnecting */}
      <Dialog open={Boolean(confirmProvider)} onOpenChange={(open) => !open && setConfirmProvider(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect {activeDisconnectLabel} Account?</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect your {activeDisconnectLabel} account{" "}
              {activeDisconnectName && (
                <strong className="text-foreground">{activeDisconnectName} </strong>
              )}
              {activeDisconnectEmail && (
                <span className="text-muted-foreground">({activeDisconnectEmail})</span>
              )}? You will still be able to sign in using your account email and password.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmProvider(null)}
              disabled={Boolean(unlinkingProvider)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDisconnect}
              disabled={Boolean(unlinkingProvider)}
            >
              {unlinkingProvider ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Disconnecting...
                </>
              ) : (
                "Yes, Disconnect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lockout Prevention Warning Dialog */}
      <Dialog open={Boolean(noPasswordProvider)} onOpenChange={(open) => !open && setNoPasswordProvider(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <DialogTitle>Password Required to Disconnect</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-foreground/90">
              Your account currently does not have a password configured. Disconnecting your{" "}
              {noPasswordProvider === "google" ? "Google" : "LinkedIn"} account now would leave you without a sign-in method and lock you out of your account.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 rounded-lg bg-muted text-xs text-muted-foreground border border-border">
            Please use the <strong>Change Password</strong> form above to set a password first before disconnecting.
          </div>
          <DialogFooter>
            <Button variant="default" onClick={() => setNoPasswordProvider(null)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Explicit Confirmation Dialog for Cross-Account Email Conflict */}
      <Dialog open={pendingLinkOpen} onOpenChange={(open) => !open && handleCancelPendingLink()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Globe className="w-5 h-5 shrink-0" />
              <DialogTitle>Link this Google account?</DialogTitle>
            </div>
            <div className="pt-2 text-sm text-foreground/90 space-y-2">
              <p>
                The Google account{" "}
                {pendingLinkEmail && <strong className="text-foreground">{pendingLinkEmail}</strong>}{" "}
                is associated with another account in our system. Linking it will connect this Google identity to your currently signed-in account.
              </p>
              <p className="text-xs text-muted-foreground">
                Do you want to continue?
              </p>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={handleCancelPendingLink}
              disabled={confirmingLink}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleConfirmPendingLink}
              disabled={confirmingLink}
            >
              {confirmingLink ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Linking...
                </>
              ) : (
                "Confirm link"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Already Registered Conflict Dialog */}
      <Dialog
        open={conflictModal.open}
        onOpenChange={(open) => {
          if (!open) {
            setConflictModal((prev) => ({ ...prev, open: false }));
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className=" p-0 overflow-hidden border-border bg-card shadow-2xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 320, duration: 0.25 }}
            className="p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-base font-semibold text-foreground">
                  Email Already Registered
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  The email address associated with your{" "}
                  <strong className="text-foreground">
                    {conflictModal.provider === "facebook"
                      ? "Facebook"
                      : conflictModal.provider === "linkedin"
                        ? "LinkedIn"
                        : "Google"}
                  </strong>{" "}
                  account is already linked to another account on LinkBridge.
                </DialogDescription>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Conflicting Email</span>
                <span className="font-mono font-medium text-foreground bg-background px-2 py-0.5 rounded border border-border text-[11px] break-all">
                  {conflictModal.email || "No email available"}
                </span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed pt-1.5 border-t border-border/60">
                Your current account and existing data will remain completely unchanged. To connect a different account, switch your social provider session first.
              </p>
            </div>

            {(() => {
              const providerLabel =
                conflictModal.provider === "facebook"
                  ? "Facebook"
                  : conflictModal.provider === "linkedin"
                    ? "LinkedIn"
                    : "Google";

              return (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-xs min-h-9 h-auto py-2 px-2.5 justify-center border-border hover:bg-muted font-medium text-center leading-snug"
                      onClick={() => {
                        const logoutUrl =
                          conflictModal.provider === "linkedin"
                            ? "https://www.linkedin.com/m/logout"
                            : conflictModal.provider === "facebook"
                              ? "https://www.facebook.com"
                              : "https://accounts.google.com/Logout";
                        window.open(logoutUrl, "_blank", "noopener,noreferrer");
                        setConflictModal({ open: false, provider: "facebook", email: null });
                        toast.info(`Signed out of ${providerLabel}`, {
                          description: `Please switch to your desired ${providerLabel} account in the new tab, then click Connect ${providerLabel} again.`,
                        });
                      }}
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                      <span>Switch {providerLabel} Account</span>
                    </Button>

                    {conflictModal.email && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full text-xs min-h-9 h-auto py-2 px-2.5 justify-center border-border hover:bg-muted font-medium text-center leading-snug"
                        onClick={async () => {
                          try {
                            await fetch("/api/auth/logout", { method: "POST" });
                          } catch {
                            // ignore
                          }
                          window.location.href = `/login?email=${encodeURIComponent(conflictModal.email || "")}`;
                        }}
                      >
                        <LogIn className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                        <span>Switch to this LinkBridge account</span>
                      </Button>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="w-full text-xs h-9 font-medium"
                    onClick={() => {
                      setConflictModal({ open: false, provider: "facebook", email: null });
                      toast.info("Linking cancelled", {
                        description: `Cancelled ${providerLabel} linking and continued using your currently signed-in account.`,
                      });
                    }}
                  >
                    Keep current account
                  </Button>
                </div>
              );
            })()}
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
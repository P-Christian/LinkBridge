"use client";

import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { openOAuthPopup } from "@/modules/auth/utils/oauth-popup";

export type AuthProviderId = "google" | "facebook" | "apple" | "linkedin";

export interface AuthProviderConfig {
  id: AuthProviderId;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  href?: string;
  onClick?: () => void;
}

interface SocialAuthButtonsProps {
  mode?: "login" | "signup";
  className?: string;
  disabled?: boolean;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("w-5 h-5", className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.27-2.09 3.675-5.17 3.675-9.15z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.61H1.28C.46 8.23 0 10.06 0 12s.46 3.77 1.28 5.39l3.99-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.28 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("w-5 h-5", className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#0A66C2"
        d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76c.94 0 1.7-.76 1.7-1.7s-.76-1.7-1.7-1.7a1.7 1.7 0 0 0-1.7 1.7c0 .94.76 1.7 1.7 1.7m1.39 9.74v-8.37H5.07v8.37h2.78z"
      />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("w-5 h-5", className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#1877F2"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
  );
}

export function SocialAuthButtons({
  mode = "login",
  className,
  disabled = false,
}: SocialAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = React.useState<string | null>(null);

  const handleProviderClick = React.useCallback(
    (provider: AuthProviderConfig) => {
      if (disabled || loadingProvider) return;

      if (provider.onClick) {
        provider.onClick();
        return;
      }

      if (provider.href) {
        setLoadingProvider(provider.id);

        const title = provider.label;
        openOAuthPopup({
          url: provider.href,
          title,
          onSuccess: (response) => {
            if (response.redirectUrl) {
              window.location.assign(response.redirectUrl);
            } else {
              window.location.assign(
                mode === "signup" ? "/signup" : "/linkbridge/freelancer/dashboard"
              );
            }
          },
          onCancel: () => {
            setLoadingProvider(null);
            toast.info("Authentication cancelled", {
              description: "The authentication window was closed before completing.",
            });
          },
          onError: (payload) => {
            setLoadingProvider(null);
            const errCode = payload.error;
            const errorMap: Record<string, string> = {
              account_blocked: "Your account has been suspended. Please contact support.",
              account_inactive: "Your account is inactive. Please contact support.",
              account_not_found: "No account found with this email. Please sign up first.",
              google_not_connected: "This Google account is not connected. Sign up or link it in settings.",
              linkedin_not_connected: "This LinkedIn account is not connected. Sign up or link it in settings.",
              facebook_not_connected: "This Facebook account is not connected. Sign up or link it in settings.",
              google_identity_conflict: "Identity conflict: this email belongs to a different account.",
              linkedin_identity_conflict: "Identity conflict: this email belongs to a different account.",
              facebook_identity_conflict: "Identity conflict: this email belongs to a different account.",
              oauth_callback_failed: "Social authentication failed. Please try again.",
              cancelled: "Authentication was cancelled.",
            };
            const description = (errCode && errorMap[errCode]) || "Social authentication failed. Please try again.";
            toast.error("Authentication failed", { description });
          },
          onClose: () => {
            setLoadingProvider(null);
          },
        });
      }
    },
    [disabled, loadingProvider, mode]
  );

  const providers = React.useMemo<AuthProviderConfig[]>(() => {
    return [
      {
        id: "google",
        label: mode === "signup" ? "Sign up with Google" : "Continue with Google",
        icon: <GoogleIcon />,
        enabled: true,
        href: `/api/auth/google?mode=${mode}`,
      },
      {
        id: "linkedin",
        label: mode === "signup" ? "Sign up with LinkedIn" : "Continue with LinkedIn",
        icon: <LinkedInIcon />,
        enabled: true,
        href: `/api/auth/linkedin?mode=${mode}`,
      },
      {
        id: "facebook",
        label: mode === "signup" ? "Sign up with Facebook" : "Continue with Facebook",
        icon: <FacebookIcon />,
        enabled: true,
        href: `/api/auth/facebook?mode=${mode}`,
      },
      {
        id: "apple",
        label: "Continue with Apple",
        icon: null,
        enabled: false,
      },
    ];
  }, [mode]);

  const enabledProviders = React.useMemo(
    () => providers.filter((p) => p.enabled),
    [providers]
  );

  if (enabledProviders.length === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground font-medium tracking-wider">
            Or continue with
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        {enabledProviders.map((provider) => {
          const isLoading = loadingProvider === provider.id;

          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => handleProviderClick(provider)}
              disabled={disabled || isLoading}
              aria-label={provider.label}
              title={provider.label}
              className={cn(
                "h-12 w-12 flex items-center justify-center rounded-lg border border-input bg-background text-foreground transition-all duration-150",
                "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50 shadow-sm cursor-pointer",
                isLoading && "opacity-75"
              )}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                provider.icon
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

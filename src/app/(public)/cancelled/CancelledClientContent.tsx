"use client";

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  XCircle,
  ShieldCheck,
  RefreshCw,
  Home,
  Settings,
  ArrowLeft,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function FacebookIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
  );
}

function GoogleIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
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

function LinkedInIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#0A66C2"
        d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76c.94 0 1.7-.76 1.7-1.7s-.76-1.7-1.7-1.7a1.7 1.7 0 0 0-1.7 1.7c0 .94.76 1.7 1.7 1.7m1.39 9.74v-8.37H5.07v8.37h2.78z"
      />
    </svg>
  );
}

interface ProviderMeta {
  name: string;
  icon: React.ReactNode;
}

export function CancelledClientContent() {
  const searchParams = useSearchParams();

  // Strip Facebook trailing fragment '#_=_' cleanly from address bar
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("_=_")) {
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", cleanUrl);
    }
  }, []);

  const providerKey = useMemo(() => {
    const rawProvider = (searchParams.get("provider") || "").toLowerCase();
    const rawError = (searchParams.get("error") || "").toLowerCase();

    if (rawProvider.includes("facebook") || rawError.includes("facebook")) return "facebook";
    if (rawProvider.includes("google") || rawError.includes("google")) return "google";
    if (rawProvider.includes("linkedin") || rawError.includes("linkedin")) return "linkedin";
    return "social";
  }, [searchParams]);

  const flowType = useMemo(() => {
    const rawFlow = (searchParams.get("flow") || "").toLowerCase();
    if (rawFlow === "link" || rawFlow.includes("link")) return "link";
    if (rawFlow === "signup" || rawFlow.includes("signup")) return "signup";
    return "login";
  }, [searchParams]);

  const returnTo = useMemo(() => {
    const raw = searchParams.get("returnTo");
    if (raw && (raw.startsWith("/") || raw.startsWith("http"))) {
      return raw;
    }
    return null;
  }, [searchParams]);

  const providerMeta: ProviderMeta = useMemo(() => {
    switch (providerKey) {
      case "facebook":
        return { name: "Facebook", icon: <FacebookIcon className="w-8 h-8" /> };
      case "google":
        return { name: "Google", icon: <GoogleIcon className="w-8 h-8" /> };
      case "linkedin":
        return { name: "LinkedIn", icon: <LinkedInIcon className="w-8 h-8" /> };
      default:
        return {
          name: "Authentication",
          icon: <XCircle className="w-8 h-8 text-muted-foreground" />,
        };
    }
  }, [providerKey]);

  const title = useMemo(() => {
    if (flowType === "link") {
      return `${providerMeta.name} Connection Cancelled`;
    }
    if (flowType === "signup") {
      return `${providerMeta.name} Sign-Up Cancelled`;
    }
    return `${providerMeta.name} Sign-In Cancelled`;
  }, [flowType, providerMeta.name]);

  const description = useMemo(() => {
    if (flowType === "link") {
      return `You cancelled linking your ${providerMeta.name} account. Your existing VOS Sync profile and credentials remain unchanged.`;
    }
    if (flowType === "signup") {
      return `You cancelled sign-up with ${providerMeta.name}. No account was created and no personal data was saved.`;
    }
    return `You cancelled signing in with ${providerMeta.name}. You can try again or use your email and password to sign in.`;
  }, [flowType, providerMeta.name]);

  const retryHref = useMemo(() => {
    if (flowType === "link" && returnTo) return returnTo;
    if (flowType === "signup") return "/signup";
    return "/login";
  }, [flowType, returnTo]);

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        <Card className="border border-border/80 bg-card shadow-lg">
          <CardHeader className="text-center pb-4 pt-8 space-y-4">
            <div className="relative mx-auto w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center border border-border">
              {providerMeta.icon}
              <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 border border-border shadow-sm">
                <XCircle className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Action Not Completed
              </span>
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                {title}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground text-balance max-w-sm mx-auto leading-relaxed">
                {description}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 px-6 pt-2 pb-6">
            <div className="rounded-lg border border-border bg-muted/30 p-3.5 text-xs text-muted-foreground flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-medium text-foreground">Security Notice</p>
                <p>
                  No changes were applied to your profile. You may securely restart this authorization whenever you are ready.
                </p>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2.5 px-6 pb-8 pt-0">
            {flowType === "link" && returnTo ? (
              <>
                <Button asChild size="lg" className="w-full">
                  <Link href={returnTo}>
                    <Settings className="w-4 h-4 mr-2" />
                    Return to Settings
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link href={retryHref}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Link>
                </Button>
              </>
            ) : flowType === "signup" ? (
              <>
                <Button asChild size="lg" className="w-full">
                  <Link href="/signup">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Sign Up Again
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link href="/login">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Go to Sign In
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="lg" className="w-full">
                  <Link href="/login">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Sign In Again
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link href="/signup">
                    Create an Account
                  </Link>
                </Button>
              </>
            )}

            <div className="pt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <Link
                href="/"
                className="hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                <Home className="w-3.5 h-3.5" />
                Home
              </Link>
              <span>•</span>
              <Link
                href="/main-dashboard"
                className="hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Dashboard
              </Link>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

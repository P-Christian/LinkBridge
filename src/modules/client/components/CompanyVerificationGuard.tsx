"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Building2, ArrowRight, Lock, AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface CompanyVerificationGuardProps {
  moduleName: string;
  children: React.ReactNode;
}

const STORAGE_KEY = "vos_client_company_verification";

export default function CompanyVerificationGuard({
  moduleName,
  children,
}: CompanyVerificationGuardProps) {
  const router = useRouter();

  // Initialize consistently to avoid SSR-to-client hydration mismatches
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkCompanyStatus = useCallback(async function checkStatus(retryCount = 0): Promise<void> {
    setErrorMessage(null);
    try {
      const res = await fetch("/api/client/company-profile", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        // A company with a non-null verified_at is always treated as VERIFIED,
        // regardless of the verification_status string (handles stale status edge cases).
        const hasVerifiedAt = Boolean(json.company?.verified_at);
        const rawStatus = json.company?.verification_status
          ? String(json.company.verification_status).toUpperCase()
          : "DRAFT";
        const status = hasVerifiedAt ? "VERIFIED" : rawStatus;
        setVerificationStatus(status);
        try {
          sessionStorage.setItem(STORAGE_KEY, status);
        } catch {
          // Ignore storage restrictions
        }
        setLoading(false);
      } else {
        // On transient errors (5xx, 429, 401 during concurrent reload bursts), retry up to 2 times
        if (retryCount < 2 && (res.status >= 500 || res.status === 429 || res.status === 401)) {
          setTimeout(() => {
            void checkStatus(retryCount + 1);
          }, 600 * (retryCount + 1));
          return;
        }

        // If previously verified in this session, keep access active during temporary failures
        let cached: string | null = null;
        try {
          cached = sessionStorage.getItem(STORAGE_KEY);
        } catch {
          // Ignore
        }

        if (cached === "VERIFIED") {
          setVerificationStatus("VERIFIED");
          setLoading(false);
          return;
        }

        if (res.status >= 500) {
          setErrorMessage("Failed to verify account status due to a temporary server connection error.");
        } else {
          setVerificationStatus("DRAFT");
        }
        setLoading(false);
      }
    } catch {
      if (retryCount < 2) {
        setTimeout(() => {
          void checkStatus(retryCount + 1);
        }, 600 * (retryCount + 1));
        return;
      }

      let cached: string | null = null;
      try {
        cached = sessionStorage.getItem(STORAGE_KEY);
      } catch {
        // Ignore
      }

      if (cached === "VERIFIED") {
        setVerificationStatus("VERIFIED");
        setLoading(false);
        return;
      }

      setErrorMessage("Unable to connect to the verification service. Please check your network connection.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const cached = sessionStorage.getItem(STORAGE_KEY);
        if (cached) {
          setVerificationStatus(cached);
          if (cached === "VERIFIED") {
            setLoading(false);
          }
        }
      } catch {
        // Ignore storage restrictions
      }

      void checkCompanyStatus();
    });
  }, [checkCompanyStatus]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] py-16 gap-3" role="status" aria-busy="true">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm font-medium text-muted-foreground animate-pulse">
          Verifying account status...
        </span>
      </div>
    );
  }

  // Error State: Temporary failure during verification check
  if (errorMessage && verificationStatus !== "VERIFIED") {
    return (
      <div className="max-w-md mx-auto py-16 px-4" role="alert">
        <Card className="border border-destructive/20 bg-card/80 backdrop-blur-xl shadow-lg rounded-2xl p-6 text-center space-y-4">
          <CardContent className="p-0 flex flex-col items-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">Verification Check Failed</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{errorMessage}</p>
            </div>
            <Button
              onClick={() => {
                setLoading(true);
                void checkCompanyStatus();
              }}
              variant="outline"
              className="gap-2 rounded-xl text-sm font-medium border-primary/20 hover:bg-primary/5"
            >
              <RotateCcw className="h-4 w-4" /> Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isVerified = verificationStatus === "VERIFIED";

  if (!isVerified) {
    const statusLabel =
      verificationStatus === "PENDING_VERIFICATION" || verificationStatus === "PENDING"
        ? "Under Admin Review"
        : verificationStatus === "REJECTED"
        ? "Verification Rejected"
        : verificationStatus === "SUSPENDED" || verificationStatus === "INACTIVE"
        ? "Account Inactive"
        : "Unverified / Draft";

    const statusDescription =
      verificationStatus === "PENDING_VERIFICATION" || verificationStatus === "PENDING"
        ? `Your company documents have been submitted and are currently under review by our verification team. Access to ${moduleName} will unlock as soon as your company is approved.`
        : verificationStatus === "REJECTED"
        ? "Your company verification application was rejected. Please review your company profile and resubmit valid details."
        : `You must complete your company profile and submit it for admin verification before accessing ${moduleName}.`;

    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 client-page-transition">
        <style>{`
          @keyframes page-entry {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .client-page-transition {
            animation: page-entry 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>

        <Card className="border-2 border-warning/30 bg-gradient-to-b from-warning/10 via-card to-card shadow-xl rounded-3xl overflow-hidden p-6 sm:p-10">
          <CardContent className="p-0 flex flex-col items-center text-center space-y-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-warning/15 flex items-center justify-center border border-warning/30">
                <Lock className="h-10 w-10 text-warning" />
              </div>
              <span className="absolute -bottom-1 -right-1 p-1.5 bg-warning text-warning-foreground rounded-full shadow-md">
                <ShieldAlert size={16} />
              </span>
            </div>

            <div className="space-y-2 max-w-lg">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-warning/15 border border-warning/30 text-warning text-xs font-bold uppercase tracking-wider">
                Status: {statusLabel}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Access Restricted: {moduleName}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed pt-1">
                {statusDescription}
              </p>
            </div>

            <div className="w-full max-w-md bg-muted/40 rounded-2xl p-5 border border-border text-left space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Building2 size={14} className="text-warning" /> Restricted Features for Unverified Companies:
              </h4>
              <ul className="text-xs text-muted-foreground space-y-2 font-medium">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Job Creation & Publishing
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Candidate Profile & Applicant Review
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Direct Candidate Messaging & Interview Scheduling
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto pt-2">
              <Button
                onClick={() => router.push("/linkbridge/client/company-profile")}
                className="w-full sm:w-auto h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-bold text-sm shadow-md gap-2 transition-all border-0"
              >
                Go to Company Profile <ArrowRight size={16} />
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/linkbridge/client/dashboard")}
                className="w-full sm:w-auto h-12 px-6 rounded-2xl text-sm font-semibold border-border"
              >
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

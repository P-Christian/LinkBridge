/* eslint-disable react-hooks/set-state-in-effect */
// src/app/(public)/referral/[token]/ReferralLandingClient.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Briefcase, MapPin, User, Check, LogIn, UserPlus, Bookmark } from "lucide-react";

interface ReferralLandingClientProps {
  referral: {
    referral_id: number;
    job_id: {
      job_id: number;
      job_title: string;
      work_arrangement?: string;
      job_type?: string;
      job_location?: string;
      job_description?: string;
    };
    referrer_user_id?: {
      user_fname?: string;
      user_lname?: string;
    };
    is_school_admin?: boolean;
    school_name?: string;
    status: string;
    expires_at: string;
  };
  token: string;
  isLoggedIn: boolean;
}

export default function ReferralLandingClient({ referral, token, isLoggedIn: isLoggedInFromServer }: ReferralLandingClientProps) {
  const router = useRouter();
  const [consented, setConsented] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(isLoggedInFromServer);
  const [claimCompleted, setClaimCompleted] = React.useState(false);
  const [alreadyClaimed, setAlreadyClaimed] = React.useState(false);
  const [now] = React.useState(() => Date.now());

  // Invalidate bfcache on browser back navigation
  React.useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  // Check if current authenticated user already claimed this referral/job
  React.useEffect(() => {
    if (isLoggedInFromServer) {
      fetch(`/api/freelancer/referrals/check-claim?job_id=${referral.job_id.job_id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.claimed) {
            setAlreadyClaimed(true);
          }
        })
        .catch((err) => console.error("Error checking existing claim:", err));
    }
  }, [isLoggedInFromServer, referral.job_id.job_id]);

  React.useEffect(() => {
    // Sync login state with the server-resolved prop. The auth cookie is
    // HttpOnly, so document.cookie can never observe it (PRIV-017).
    const resolvedLogged = isLoggedInFromServer;
    setIsLoggedIn((prev) => {
      if (prev !== resolvedLogged) {
        return resolvedLogged;
      }
      return prev;
    });
  }, [isLoggedInFromServer]);

  const handleAccept = async () => {
    if (!consented) {
      toast.error("Consent required", { description: "Please accept the terms to continue." });
      return;
    }

    if (!isLoggedIn) {
      // PRIV-017: the single-use referral token stays in component state only.
      // It is echoed back through ?next= below; copying it into a JS-readable
      // cookie would hand a live capability to any script on the page.
      toast.info("Authentication Required", { description: "Redirecting to login to verify your account." });
      router.push(`/login?next=/referral/${token}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/freelancer/referrals/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          consent_version: "1.0",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to claim referral.");
      }

      toast.success("Referral associated!", { description: "You can now apply for this job." });
      setClaimCompleted(true);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      toast.error("Referral Claim Error", { description: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    try {
      await fetch("/api/freelancer/referrals/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    } catch (e) {
      console.error("Error declining referral:", e);
    }
    toast.info("Referral declined", { description: "You will be redirected to the main job board." });
    router.push("/");
  };

  const job = referral.job_id;
  const isSchoolAdmin = referral.is_school_admin || !!referral.school_name;
  const schoolName = referral.school_name;

  const referrerName = referral.referrer_user_id
    ? `${referral.referrer_user_id.user_fname} ${referral.referrer_user_id.user_lname}`.trim()
    : "Your Academic Institution";

  // Clean HTML from job description if present
  const cleanDescription = job.job_description ? job.job_description.replace(/<\/?[^>]+(>|$)/g, "") : "";

  if (alreadyClaimed) {
    return (
      <Card className="border-2 border-primary/20 shadow-xl overflow-hidden max-w-2xl mx-auto">
        <div className="bg-primary/10 p-6 flex items-center justify-center">
          <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
            ✓
          </div>
        </div>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Referral Already Accepted</CardTitle>
          <CardDescription>
            You have already accepted the referral for <strong>{job.job_title}</strong> from {referrerName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground text-sm">
            Your referral endorsement is active on your account. You can proceed directly to complete your application.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mx-auto">
            <Bookmark className="h-3.5 w-3.5 fill-primary" />
            <span>Saved in your Bookmarked Jobs</span>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center p-6 bg-muted/20 border-t">
          <Button onClick={() => router.push(`/linkbridge/freelancer/jobs/${job.job_id}`)} className="px-8 font-semibold">
            Proceed to Apply
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (claimCompleted) {
    return (
      <Card className="border-2 border-emerald-500/20 shadow-xl overflow-hidden max-w-2xl mx-auto">
        <div className="bg-emerald-500/10 p-6 flex items-center justify-center">
          <div className="h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center text-white">
            <Check className="h-8 w-8" />
          </div>
        </div>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Referral Successfully Connected!</CardTitle>
          <CardDescription>
            {isSchoolAdmin && schoolName
              ? `The official academic endorsement from ${schoolName} (via ${referrerName}) has been linked to your account.`
              : `The referral from ${referrerName} has been linked to your LinkBridge account.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            You are now ready to apply for the position. Your verified recommendation will be attached directly to your job application.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mx-auto">
            <Bookmark className="h-3.5 w-3.5 fill-primary" />
            <span>Job automatically saved to your Bookmarks</span>
          </div>
          <div className="inline-flex flex-col p-4 bg-muted/30 rounded-lg text-left max-w-md w-full">
            <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
              <Briefcase className="h-4 w-4 text-primary" /> {job.job_title}
            </h4>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary">{job.work_arrangement || "Hybrid"}</Badge>
              <Badge variant="outline">{job.job_type || "Full-time"}</Badge>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center p-6 bg-muted/20 border-t">
          <Button onClick={() => router.push(`/linkbridge/freelancer/jobs/${job.job_id}`)} className="px-8 font-semibold">
            Apply Now
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="shadow-2xl border-muted/50 overflow-hidden max-w-3xl mx-auto">
      <div className="bg-primary/5 p-6 border-b border-muted/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
            <User className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-semibold text-primary block">
              {isSchoolAdmin ? "🎓 Academic Endorsement & Referral" : "Referral Invitation"}
            </span>
            <span className="text-sm text-muted-foreground">
              {isSchoolAdmin && schoolName ? (
                <>
                  Endorsed by <strong className="text-foreground">{schoolName}</strong> ({referrerName}, School Admin)
                </>
              ) : (
                <>
                  Sent by <strong className="text-foreground">{referrerName}</strong>
                </>
              )}
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground flex flex-col items-end gap-1">
          <span>Expires: {new Date(referral.expires_at).toLocaleDateString()}</span>
          {(() => {
            const diff = new Date(referral.expires_at).getTime() - now;
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            if (days <= 0) return <Badge variant="destructive" className="text-[10px]">Expired</Badge>;
            if (days === 1) return <Badge variant="destructive" className="text-[10px]">⚠️ Expires tomorrow</Badge>;
            if (days <= 3) return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]" variant="outline">⏳ {days} days left</Badge>;
            return <Badge variant="outline" className="text-muted-foreground text-[10px]">⏳ {days} days left</Badge>;
          })()}
        </div>
      </div>

      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {job.job_type || "Full-time"}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {job.work_arrangement || "Hybrid"}
          </Badge>
        </div>
        <CardTitle className="text-3xl font-extrabold tracking-tight">{job.job_title}</CardTitle>
        <CardDescription className="flex items-center gap-1.5 text-sm">
          <MapPin className="h-4 w-4" /> {job.job_location || "Remote"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <Separator />
        
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Job Overview</h3>
          <div className="text-muted-foreground text-sm line-clamp-4 leading-relaxed whitespace-pre-line">
            {cleanDescription}
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-muted/30 border-muted-foreground/10 space-y-4">
          <h4 className="font-semibold text-sm text-foreground">Consent & Privacy Agreement</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            By accepting, you consent to associate this referral with your LinkBridge account. If you submit a job application for this position, the referrer ({isSchoolAdmin && schoolName ? `${schoolName} / ${referrerName}` : referrerName}) will be attributed for the introduction. 
            No private files, resumes, or application responses are shared with the referrer. Only the completion status of the application may be shown to them.
          </p>
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="consent"
              checked={consented}
              onCheckedChange={(checked) => setConsented(checked === true)}
            />
            <label
              htmlFor="consent"
              className="text-sm font-medium leading-none max-md:min-h-11 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              I accept and consent to these terms
            </label>
          </div>
        </div>

        {/* Unauthenticated Guest CTA Block */}
        {!isLoggedIn && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
            <h4 className="text-base font-bold text-foreground">Interested in this opportunity?</h4>
            <p className="text-xs text-muted-foreground">
              Create a free Job Seeker account or sign in to accept this referral and submit your application.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <Button
                type="button"
                onClick={() => {
                  if (!consented) {
                    toast.error("Consent required", { description: "Please accept the terms above to continue." });
                    return;
                  }
                  router.push(`/login?next=/referral/${token}`);
                }}
                className="gap-2 font-bold max-md:min-h-11 shadow-xs"
              >
                <LogIn className="h-4 w-4" />
                Sign In to Apply
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!consented) {
                    toast.error("Consent required", { description: "Please accept the terms above to continue." });
                    return;
                  }
                  router.push(`/signup?role=freelancer&next=/referral/${token}`);
                }}
                className="gap-2 font-bold max-md:min-h-11"
              >
                <UserPlus className="h-4 w-4" />
                Create Job Seeker Account
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row gap-3 p-6 bg-muted/15 border-t">
        {isLoggedIn ? (
          <Button
            onClick={handleAccept}
            className="w-full sm:w-auto px-8 py-5 max-md:min-h-11 flex items-center justify-center gap-2 font-bold shadow-lg"
            disabled={loading}
          >
            Accept and Continue
          </Button>
        ) : null}
        <Button onClick={handleDecline} variant="outline" className="w-full sm:w-auto px-8 py-5 max-md:min-h-11">
          Decline
        </Button>
      </CardFooter>
    </Card>
  );
}

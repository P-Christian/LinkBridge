"use client";

// src/modules/shared/messaging/components/HiredCard.tsx

import React, { useEffect, useState, useCallback } from "react";
import { Trophy, PartyPopper, CheckCircle2, ArrowRight, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Message, StageTransitionCardData } from "@/modules/client/messaging/types";

interface Props {
  message: Message;
}

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HiredCard({ message }: Props) {
  const initialData = (message.system_card_data as StageTransitionCardData) ?? null;
  const [data, setData] = useState<StageTransitionCardData | null>(initialData);
  const [loading, setLoading] = useState(!initialData?.job_title);
  const pathname = usePathname();

  useEffect(() => {
    if (initialData?.job_title) {
      return;
    }

    let cancelled = false;
    fetch(`/api/messaging/system-card?message_id=${message.message_id}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          setData(json && !json.error ? json : null);
        }
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [message.message_id, initialData]);

  const isFreelancer =
    pathname?.includes("/freelancer") ||
    data?.viewer_role === "FREELANCER";

  const jobTitle = data?.job_title || "Position";
  const applicantName = data?.applicant_name || data?.candidate_name || "Candidate";
  const displayDate = formatDisplayDate(data?.created_at || message.created_at);
  const applicationId = data?.application_id || message.system_message?.application_id || null;

  const handleLaunchCelebration = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("vos:trigger-celebration", {
          detail: {
            type: "HIRED",
            message_id: message.message_id,
            job_title: jobTitle,
            applicant_name: applicantName,
          },
        })
      );
    }
  }, [message.message_id, jobTitle, applicantName]);

  // Automatically trigger celebration on initial first mount in this browser session
  useEffect(() => {
    if (isFreelancer && typeof window !== "undefined") {
      const storageKey = `vos_celebrated_hired_${message.message_id}`;
      try {
        if (!sessionStorage.getItem(storageKey)) {
          sessionStorage.setItem(storageKey, "true");
          const timer = setTimeout(() => {
            handleLaunchCelebration();
          }, 450);
          return () => clearTimeout(timer);
        }
      } catch {}
    }
  }, [isFreelancer, message.message_id, handleLaunchCelebration]);

  if (loading) {
    return (
      <div className="w-full max-w-sm sm:max-w-md mx-auto my-3 rounded-2xl border border-emerald-500/20 bg-card/80 p-4 backdrop-blur-xl flex items-center justify-center gap-2.5 shadow-xs text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 text-emerald-500 animate-spin" />
        <span>Loading hiring celebration...</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Official Hire Confirmed"
      className="w-full max-w-sm sm:max-w-md mx-auto my-3.5 relative overflow-hidden rounded-2xl border-2 border-emerald-500/35 bg-gradient-to-br from-emerald-500/10 via-card/90 to-teal-500/10 p-5 shadow-lg shadow-emerald-500/15 backdrop-blur-xl text-center transition hover:border-emerald-500/50"
    >
      {/* Radiant ambient glow rings */}
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-emerald-500/20 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-teal-500/20 blur-2xl pointer-events-none" />

      {/* Top Tag & Time */}
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-emerald-500/15">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wider">
          <Trophy className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{isFreelancer ? "Official Hire Confirmed" : "Candidate Hired"}</span>
        </span>
        {displayDate && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {displayDate}
          </span>
        )}
      </div>

      {/* Glowing Celebratory Trophy Icon */}
      <div className="relative mx-auto mb-3.5 flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 opacity-25 blur-lg animate-pulse" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/30">
          <PartyPopper className="h-8 w-8 text-white" />
        </div>
      </div>

      {/* Headline & Body Copy */}
      <div className="space-y-1.5 mb-4">
        <h4 className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center justify-center gap-1.5">
          <span>{isFreelancer ? "Congratulations! You're Hired!" : "Candidate Successfully Hired!"}</span>
        </h4>
        <p className="text-xs sm:text-sm text-foreground/90 font-medium">
          {isFreelancer ? (
            <>
              You were officially hired for{" "}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {jobTitle}
              </span>
              !
            </>
          ) : (
            <>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {applicantName}
              </span>{" "}
              was officially hired for {jobTitle}!
            </>
          )}
        </p>
        <p className="text-[11px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
          {isFreelancer
            ? "Your journey begins here! You can check your application details and continue messaging your employer anytime."
            : "The hiring milestone has been confirmed. You can coordinate next steps and onboarding here in the chat."}
        </p>
      </div>

      {/* Interactive Action Buttons */}
      <div className="flex items-center justify-center gap-2 pt-2 border-t border-emerald-500/15 flex-wrap">
        {isFreelancer ? (
          <>
            <button
              type="button"
              onClick={handleLaunchCelebration}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/25 transition active:scale-95 cursor-pointer max-md:min-h-11"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Launch Celebration 🎉</span>
            </button>

            {applicationId && (
              <Link
                href={`/linkbridge/freelancer/applications`}
                className="inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-full border border-emerald-500/25 bg-card/60 hover:bg-muted text-foreground text-xs font-medium transition max-md:min-h-11"
              >
                <span>View Applications</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </Link>
            )}
          </>
        ) : (
          <Link
            href={`/linkbridge/client/applicants`}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full border border-emerald-500/30 bg-card/80 hover:bg-muted text-foreground text-xs font-semibold shadow-xs transition max-md:min-h-11"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Review in Applicants</span>
          </Link>
        )}
      </div>
    </div>
  );
}

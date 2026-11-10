// src/modules/client/dashboard/components/DashboardHeader.tsx
"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { CompanyInfo } from "../types";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle2, ShieldAlert, Building2, MapPin } from "lucide-react";
import { motion } from "framer-motion";

interface DashboardHeaderProps {
  company: CompanyInfo;
  userName?: string;
}

export default function DashboardHeader({ company, userName }: DashboardHeaderProps) {
  const isVerified = company.verification_status === "VERIFIED";

  const greeting = useMemo(() => {
    const hrs = new Date().getHours();
    if (hrs < 12) return "Good morning";
    if (hrs < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const displayName = useMemo(() => {
    if (company.company_name?.trim()) return company.company_name;
    if (userName?.trim()) return userName.split(" ")[0];
    return "Partner";
  }, [company.company_name, userName]);

  const locationStr = useMemo(() => {
    return [company.company_city, company.company_province].filter(Boolean).join(", ");
  }, [company.company_city, company.company_province]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 p-5 sm:p-8 text-white shadow-[0_24px_56px_-24px_rgba(37,99,235,0.6)]"
    >
      {/* Decorative layers (static, GPU-cheap): light pools + a fading dot grid */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-white/15 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_right,transparent,#000_70%)]"
      />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 md:gap-6">
        <div className="flex items-start gap-4 min-w-0">
          <div className="h-14 w-14 max-md:h-11 max-md:w-11 rounded-2xl bg-white/15 border border-white/25 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-lg shadow-black/10">
            <Building2 className="h-7 w-7 max-md:h-5 max-md:w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight">
                {greeting}, {displayName}
              </h1>
              {isVerified ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/15 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Verified Profile
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/60 bg-amber-300/25 px-2.5 py-0.5 text-xs font-semibold text-amber-50 backdrop-blur-sm">
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> Pending Verification
                </span>
              )}
            </div>
            <p className="text-sm text-white/80 flex items-center gap-2 flex-wrap">
              <span>Here&apos;s an overview of your hiring activity.</span>
              {locationStr && (
                <>
                  <span className="hidden sm:inline text-white/50">•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {locationStr}
                  </span>
                </>
              )}
            </p>
            {!isVerified && (
              <p className="text-xs text-white/70">
                Posting jobs unlocks once your company profile is verified.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isVerified ? (
            <Button
              asChild
              className="h-11 max-md:h-10 rounded-xl bg-white px-6 max-md:px-4 text-sm font-semibold text-indigo-700 shadow-lg shadow-black/10 transition-all duration-200 hover:bg-white/90 hover:-translate-y-0.5 active:scale-95 max-md:w-full"
            >
              <Link href="/linkbridge/client/jobs" className="flex items-center justify-center gap-2">
                <Plus className="h-4.5 w-4.5" aria-hidden="true" />
                Post a Job
              </Link>
            </Button>
          ) : (
            <Button
              disabled
              className="h-11 max-md:h-10 rounded-xl bg-white/20 px-6 max-md:px-4 text-sm font-semibold text-white/70 max-md:w-full"
            >
              <Plus className="h-4.5 w-4.5" aria-hidden="true" />
              Post a Job
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

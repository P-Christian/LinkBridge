// src/modules/school-admin/components/dashboard/SchoolOverviewBanner.tsx
'use client';

import React from 'react';
import { SchoolWithStats } from '../../types/school-admin.types';
import { Building2, MapPin, Award, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface SchoolOverviewBannerProps {
  school: SchoolWithStats;
}

export function SchoolOverviewBanner({ school }: SchoolOverviewBannerProps) {
  const completion = school.profile_completion_percent || 0;
  const isVerified = school.verification_status === 'VERIFIED';
  const isPending = school.verification_status === 'PENDING_VERIFICATION';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm">
      {/* Decorative background glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 right-24 h-40 w-40 rounded-full bg-emerald-500/10 blur-2xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Institution Welcome & Badges */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {completion}% Profile Complete
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Award className="h-3.5 w-3.5" />
              {school.school_type || 'Higher Education'}
            </span>

            {isVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                <CheckCircle2 className="h-3 w-3" />
                Verified Institution
              </span>
            ) : isPending ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3 w-3" />
                Pending Verification
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-muted bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Draft Account
              </span>
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Welcome back, <span className="text-primary">{school.school_name}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              {school.school_description || 'Track your institution academic programs, student onboarding pipeline, and career placement performance on LinkBridge.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />
              {[school.city_municipality, school.province].filter(Boolean).join(', ') || 'Philippines'}
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground/70" />
              Campus Portal Active
            </span>
          </div>
        </div>

        {/* Right: Circular Readiness Meter & Action button */}
        <div className="flex flex-row items-center gap-6 sm:self-start lg:self-center">
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/80 backdrop-blur-sm p-3.5 shadow-xs">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-emerald-500/20 bg-emerald-500/5">
              <div
                className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent"
                style={{ transform: `rotate(${completion * 3.6}deg)` }}
              />
              <span className="text-sm font-extrabold text-foreground">{completion}%</span>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Portal Status</p>
              <p className="text-sm font-semibold text-foreground">
                {completion >= 80 ? 'Ready to Match' : 'Setup In Progress'}
              </p>
              <Link
                href="/linkbridge/school-admin/profile"
                className="inline-flex items-center text-xs font-medium text-primary hover:underline"
              >
                Manage Profile <ArrowUpRight className="ml-0.5 h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

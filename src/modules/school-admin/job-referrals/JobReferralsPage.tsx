// src/modules/school-admin/job-referrals/JobReferralsPage.tsx
"use client";

import React from 'react';
import { JobReferralsProvider, useJobReferralsContext } from './providers/JobReferralsProvider';
import { JobReferralList } from './components/JobReferralList';
import { ReferralWizardModal } from './components/ReferralWizardModal';
import { ReferralSuccessModal } from './components/ReferralSuccessModal';
import { ReferralHistoryDrawer } from './components/ReferralHistoryDrawer';
import { ShareLinkDialog } from './components/ShareLinkDialog';
import { ShareLinkSuccessDialog } from './components/ShareLinkSuccessDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  History,
  GraduationCap,
  Briefcase,
  Users,
  Send,
} from 'lucide-react';

function JobReferralsContent() {
  const { schoolName, jobs, students, referrals, setIsHistoryOpen } = useJobReferralsContext();

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Student Job Referrals
            </h1>
            <Badge
              variant="outline"
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border-primary/30 flex items-center gap-1.5"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              {schoolName}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Connect verified student freelancers directly with active partner job vacancies and generate AI-powered recommendation letters.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsHistoryOpen(true)}
            className="text-xs h-9 gap-2 shadow-xs hover:bg-muted"
          >
            <History className="w-4 h-4 text-primary" />
            Referral History
            {referrals.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                {referrals.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border/80 bg-card/60 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Available Vacancies</p>
            <p className="text-2xl font-bold text-foreground">{jobs.length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/80 bg-card/60 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Verified Student Talent</p>
            <p className="text-2xl font-bold text-foreground">{students.length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/80 bg-card/60 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Dispatched Referrals</p>
            <p className="text-2xl font-bold text-foreground">{referrals.length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Send className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Jobs Listing */}
      <JobReferralList />

      {/* Modals & Drawers */}
      <ReferralWizardModal />
      <ReferralSuccessModal />
      <ShareLinkDialog />
      <ShareLinkSuccessDialog />
      <ReferralHistoryDrawer />
    </div>
  );
}

export function JobReferralsPage() {
  return (
    <JobReferralsProvider>
      <JobReferralsContent />
    </JobReferralsProvider>
  );
}

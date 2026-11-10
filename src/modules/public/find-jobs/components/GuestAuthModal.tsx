// src/modules/public/find-jobs/components/GuestAuthModal.tsx
"use client";

import React from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, LogIn, CheckCircle2 } from "lucide-react";
import { PublicJobPosting } from "../types";

interface Props {
  job: PublicJobPosting | null;
  isOpen: boolean;
  onClose: () => void;
}

export function GuestAuthModal({ job, isOpen, onClose }: Props) {
  const openJobQuery = job?.job_id ? `?open_job=${job.job_id}` : "";
  const targetPath = `/linkbridge/freelancer/jobs${openJobQuery}`;
  const loginHref = `/login?next=${encodeURIComponent(targetPath)}`;
  const signupHref = `/signup?next=${encodeURIComponent(targetPath)}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!max-w-md w-[92vw] p-6 bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl space-y-5 text-center">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl font-extrabold text-foreground">
            Sign in to Apply for this Position
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            You are viewing <strong className="text-foreground">{job?.job_title}</strong> at{" "}
            <strong className="text-foreground">{job?.company_name}</strong>. Create a job seeker account or log in to submit your resume.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 border border-border/60 rounded-xl p-4 text-left space-y-2 text-xs">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            Direct profile submission to employer
          </div>
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            Track application status & schedule interviews
          </div>
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            Receive job match recommendations
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <Button asChild size="lg" className="w-full font-bold text-sm gap-2 rounded-xl">
            <Link href={signupHref}>
              <UserPlus className="h-4 w-4" />
              Create Job Seeker Account
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full font-bold text-sm gap-2 rounded-xl">
            <Link href={loginHref}>
              <LogIn className="h-4 w-4" />
              Existing Account Sign In
            </Link>
          </Button>
        </div>

        <DialogFooter className="pt-2 sm:justify-center border-t text-center">
          <p className="text-[11px] text-muted-foreground w-full">
            Looking for employer registration?{" "}
            <Link href="/signup?role=employer" className="text-primary font-semibold hover:underline">
              Employer Sign Up
            </Link>
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

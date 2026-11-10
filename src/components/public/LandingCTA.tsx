"use client";

import React from "react";
import Link from "next/link";
import { UserCheck, Building2, LayoutDashboard, Briefcase, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideUp } from "@/components/shared/MotionContainer";
import { useAuthSession } from "@/hooks/useAuthSession";

export function LandingCTA() {
  const session = useAuthSession();

  return (
    <section className="py-16 md:py-24">
      <SlideUp className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white/85 dark:bg-card/75 backdrop-blur-xl rounded-3xl p-8 md:p-16 text-center text-foreground relative overflow-hidden border border-border/80 shadow-[0_12px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 dark:bg-primary/15 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-sky-500/10 dark:bg-sky-500/15 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

          {session.isJobSeeker ? (
            /* Logged in Job Seeker View */
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 text-foreground">
                Ready to accelerate your career?
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-2xl mx-auto mb-10">
                Explore verified jobs from actively hiring organizations and track your applications.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="text-sm sm:text-base rounded-full px-8 shadow-sm cursor-pointer">
                  <Link href="/linkbridge/freelancer" className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Go to Job Seeker Portal
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-sm sm:text-base border-border bg-background/50 hover:bg-background/80 text-foreground rounded-full px-8 cursor-pointer">
                  <Link href="/find-jobs" className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Explore All Jobs
                  </Link>
                </Button>
              </div>
            </div>
          ) : session.isEmployer ? (
            /* Logged in Employer View */
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 text-foreground">
                Ready to scale your team?
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-2xl mx-auto mb-10">
                Manage your job postings, review applicants, and source top verified talent across industries.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="text-sm sm:text-base rounded-full px-8 shadow-sm cursor-pointer">
                  <Link href="/linkbridge/client/dashboard" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Go to Client Portal
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-sm sm:text-base border-border bg-background/50 hover:bg-background/80 text-foreground rounded-full px-8 cursor-pointer">
                  <Link href="/linkbridge/client/jobs" className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Post a Job
                  </Link>
                </Button>
              </div>
            </div>
          ) : session.isAdmin || session.isSchool ? (
            /* Logged in Admin / School View */
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 text-foreground">
                Manage your organization on LinkBridge
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-2xl mx-auto mb-10">
                Access your organization dashboard to verify records and monitor platform operations.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="text-sm sm:text-base rounded-full px-8 shadow-sm cursor-pointer">
                  <Link href={session.dashboard || "/linkbridge/admin"} className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    Go to Dashboard
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-sm sm:text-base border-border bg-background/50 hover:bg-background/80 text-foreground rounded-full px-8 cursor-pointer">
                  <Link href="/find-jobs">Browse Jobs</Link>
                </Button>
              </div>
            </div>
          ) : (
            /* Guest / Unauthenticated View */
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 text-foreground">
                Ready to accelerate your career?
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-2xl mx-auto mb-10">
                Join ambitious professionals and organizations connecting through verified hiring workflows. Create your free account today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="text-sm sm:text-base rounded-full px-8 shadow-sm cursor-pointer">
                  <Link href="/signup">Get Started for Free</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-sm sm:text-base border-border bg-background/50 hover:bg-background/80 text-foreground rounded-full px-8 cursor-pointer">
                  <Link href="/signup?role=employer">Post a Job <ArrowRight className="ml-2 w-4 h-4" /></Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </SlideUp>
    </section>
  );
}

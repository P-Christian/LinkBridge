// src/modules/school-admin/components/dashboard/SchoolActionHighlights.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, Users, GraduationCap, Briefcase, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export function SchoolActionHighlights() {
  const actions = [
    {
      title: 'Invite & Onboard Students',
      description: 'Send bulk enrollment invitations or CSV roster invites to graduating cohorts.',
      icon: Users,
      href: '/linkbridge/school-admin/students',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/10 border-blue-500/20',
      badge: 'Batch Invite',
    },
    {
      title: 'Manage Academic Courses',
      description: 'Add new degrees, curriculum tracks, or update course certification criteria.',
      icon: GraduationCap,
      href: '/linkbridge/school-admin/courses',
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-500/10 border-indigo-500/20',
      badge: 'Curriculum',
    },
    {
      title: 'AI Job Referrals & Matches',
      description: 'Match certified students to high-demand corporate partner opportunities automatically.',
      icon: Briefcase,
      href: '/linkbridge/school-admin/job-referrals',
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      badge: 'AI Powered',
    },
  ];

  return (
    <Card className="rounded-2xl border border-border/80 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                Institutional Actions & Industry Alignment
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Accelerate student placement outcomes and track industry partnerships
              </CardDescription>
            </div>
          </div>
          <span className="hidden sm:inline-flex rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-semibold text-primary">
            Quick Actions
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {actions.map((act) => {
            const Icon = act.icon;
            return (
              <Link
                key={act.title}
                href={act.href}
                className="group relative flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${act.bgColor} ${act.color}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {act.badge}
                    </span>
                  </div>
                  <h4 className="mt-3 text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {act.title}
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {act.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary">
                  <span>Open workspace</span>
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

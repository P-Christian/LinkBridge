// src/modules/vos-admin/components/dashboard/AdminQuickShortcuts.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Users,
  Target,
  ShieldCheck,
  Cpu,
  ClipboardCheck,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

export function AdminQuickShortcuts() {
  const shortcuts = [
    {
      title: 'User Management',
      desc: 'Roster of active clients and freelancers',
      href: '/linkbridge/admin/users',
      icon: Users,
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    },
    {
      title: 'Role Matching',
      desc: 'Taxonomy and test studio for AI matching',
      href: '/linkbridge/admin/job-roles',
      icon: Target,
      color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
    },
    {
      title: 'Gemini Monitoring',
      desc: 'Telemetry, latency curves, and token consumption',
      href: '/linkbridge/admin/gemini-monitoring',
      icon: Cpu,
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    },
    {
      title: 'Request Management',
      desc: 'School demands and candidate referral routing',
      href: '/linkbridge/admin/requests',
      icon: ClipboardCheck,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Account Status',
      desc: 'Suspensions, identity flags, and bans',
      href: '/linkbridge/admin/account-status',
      icon: ShieldAlert,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Audit Trail',
      desc: 'Immutable platform action logs & security events',
      href: '/linkbridge/admin/audit-trail',
      icon: ShieldCheck,
      color: 'text-slate-500 bg-slate-500/10 border-slate-500/20',
    },
  ];

  return (
    <Card className="rounded-2xl border border-border/80 shadow-xs flex flex-col justify-between h-full">
      <CardHeader className="min-h-[72px] pb-2">
        <CardTitle className="text-base font-semibold text-foreground">
          Command Shortcuts
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Direct navigation to core administration and governance consoles
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {shortcuts.map((sc, idx) => {
            const Icon = sc.icon;
            return (
              <Link
                key={idx}
                href={sc.href}
                className="group p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/40 transition-all flex items-start gap-3 hover:-translate-y-0.5"
              >
                <div className={`h-8 w-8 shrink-0 rounded-lg border flex items-center justify-center ${sc.color} transition-transform group-hover:scale-105`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {sc.title}
                    </p>
                    <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{sc.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground text-right">
          <span>Platform Version: <strong>LinkBridge 2.0</strong></span>
        </div>
      </CardContent>
    </Card>
  );
}

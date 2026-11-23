// src/modules/school-admin/success-metrics/components/TopHiringCompaniesTable.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TopHiringCompanyStat } from '../types/success-metrics.types';
import { Building2, Briefcase } from 'lucide-react';

interface TopHiringCompaniesTableProps {
  topCompanies: TopHiringCompanyStat[];
}

function resolveCompanyLogo(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('/api/assets/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/assets/')) return `/api${trimmed}`;
  if (trimmed.startsWith('assets/')) return `/api/${trimmed}`;
  if (trimmed.startsWith('/')) return trimmed;
  return `/api/assets/${encodeURIComponent(trimmed)}`;
}

function companyInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function CompanyLogo({ name, logo }: { name: string; logo: string | null }) {
  const [failed, setFailed] = useState(false);
  const src = resolveCompanyLogo(logo);

  if (src === null || failed) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 font-bold text-primary">
        {companyInitial(name)}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={`${name} logo`}
      width={40}
      height={40}
      unoptimized
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover"
    />
  );
}

export function TopHiringCompaniesTable({ topCompanies }: TopHiringCompaniesTableProps) {
  return (
    <Card className="border shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">Top Hiring Employers</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Companies actively hiring graduates and students from your institution
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {topCompanies.length === 0 ? (
          <div className="flex h-44 flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <Building2 className="mb-2 h-8 w-8 opacity-40" />
            <p>No company placement records found yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {topCompanies.map((company, index) => (
              <div
                key={`${company.companyId}-${index}`}
                className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CompanyLogo name={company.companyName} logo={company.companyLogo} />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{company.companyName}</h4>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {company.topJobTitles.map((title, tIdx) => (
                        <Badge key={tIdx} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                          <Briefcase className="mr-1 h-2.5 w-2.5" />
                          {title}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <div className="text-right">
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {company.hiredCount}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">graduates hired</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

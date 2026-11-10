"use client";

import React from 'react';
import { ApplicationSummary } from '../types';
import { TrendingUp, MessageSquare, Briefcase } from 'lucide-react';

interface Props {
  summary: ApplicationSummary;
}

export const ApplicationSummaryCards: React.FC<Props> = ({ summary }) => {
  const cards = [
    {
      label: 'Total Applied',
      value: String(summary.totalApplied),
      icon: TrendingUp,
    },
    {
      label: 'Pending Applications',
      value: String(summary.pendingApplications),
      icon: MessageSquare,
    },
    {
      label: 'Active Offers',
      value: String(summary.activeOffers),
      icon: Briefcase,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 md:flex md:flex-row md:flex-nowrap md:gap-4 mb-6 w-full md:overflow-x-auto">
      {cards.map(({ label, value, icon: Icon }) => (
        <div key={label} className="flex-1 flex flex-col p-2.5 gap-1.5 md:p-6 md:gap-3 rounded-xl border bg-card shadow-sm md:min-w-[200px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider max-md:leading-tight">{label}</span>
            <Icon className="h-3.5 w-3.5 md:h-5 md:w-5 text-primary" />
          </div>
          <div className="text-lg md:text-4xl font-bold text-foreground">{value}</div>
        </div>
      ))}
    </div>
  );
};

"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const ApplicationTips: React.FC = () => {
  return (
    <div className="bg-card border rounded-xl p-8 flex flex-col justify-center h-full shadow-sm">
      <h3 className="text-lg font-bold text-primary mb-3">Maximize Your Success Rate</h3>
      <p className="text-muted-foreground text-sm leading-relaxed mb-5">
        Designers who follow up on{' '}
        <span className="text-primary font-medium">&quot;Applied&quot;</span>{' '}
        positions within 3 days are 40% more likely to move to the{' '}
        <span className="text-primary font-medium">&quot;Interviewing&quot;</span>{' '}
        stage. Try sending a quick note to hiring managers.
      </p>
      <Link
        href="/career-advice"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline group"
      >
        Read follow-up tips
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </Link>
    </div>
  );
};

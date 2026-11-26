// src/modules/vos-admin/components/dashboard/hiring-map/HiringStatsBar.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

export interface HiringStats {
  hiredToday: number;
  hiresInRange: number;
  companies: number;
  freelancers: number;
  rangeLabel: string;
}

/** Counts up/down to the new value instead of snapping. */
function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const controls = animate(current.current, value, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v: number) => {
        current.current = v;
        setShown(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value]);
  return <span className="tabular-nums">{shown.toLocaleString('en-US')}</span>;
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <div
        className={`text-[clamp(1.75rem,2.9vw,4rem)] font-bold leading-none tracking-tight ${
          accent ? 'text-sky-300' : 'text-slate-50'
        }`}
      >
        <AnimatedNumber value={value} />
      </div>
      <div className="mt-1 truncate text-[clamp(0.65rem,0.85vw,1.1rem)] font-medium uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>
    </div>
  );
}

export function HiringStatsBar({ stats }: { stats: HiringStats }) {
  return (
    <dl className="flex items-end gap-[clamp(1.25rem,3vw,4rem)]" aria-label="Hiring statistics">
      <Stat label="Hired today" value={stats.hiredToday} accent />
      <Stat label={`Hires · ${stats.rangeLabel}`} value={stats.hiresInRange} />
      <Stat label="Companies hiring" value={stats.companies} />
      <Stat label="Freelancers placed" value={stats.freelancers} />
    </dl>
  );
}


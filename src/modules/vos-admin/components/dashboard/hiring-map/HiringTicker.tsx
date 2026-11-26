// src/modules/vos-admin/components/dashboard/hiring-map/HiringTicker.tsx
'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { HireEvent } from '../../../types/hiring-map.types';
import { FALLBACK_COLOR, categoryOf } from '../../../lib/hiring-map/hiring-graph';
import { hireTime, timeAgo } from '../../../lib/hiring-map/hiring-format';

const JOB_TYPE_LABEL: Record<string, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  FREELANCE: 'Freelance',
};

export interface HiringTickerProps {
  items: readonly HireEvent[];
  categoryColors: ReadonlyMap<string, string>;
  now: number;
  /** hire currently being announced on the graph */
  activeHireId?: string | null;
  limit?: number;
  /** click a row to fly to that company on the map */
  onSelect?: (hire: HireEvent) => void;
  /** hover/focus a row to highlight that freelancer & company on the map */
  onHover?: (hire: HireEvent | null) => void;
}

export function HiringTicker({ items, categoryColors, now, activeHireId, limit = 9, onSelect, onHover }: HiringTickerProps) {
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Latest hires">
      <h2 className="px-[clamp(0.75rem,1.2vw,1.5rem)] pb-3 pt-4 text-[clamp(0.7rem,0.9vw,1.15rem)] font-semibold uppercase tracking-[0.16em] text-slate-400">
        Latest hires
      </h2>

      {items.length === 0 ? (
        <p className="px-[clamp(0.75rem,1.2vw,1.5rem)] text-[clamp(0.85rem,1vw,1.3rem)] text-slate-500">
          No hires yet. New ones will appear here the moment they happen.
        </p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-[clamp(0.5rem,0.9vw,1.1rem)] pb-4">
          <AnimatePresence initial={false}>
            {items.slice(0, limit).map((hire) => {
              const color = categoryColors.get(categoryOf(hire)) ?? FALLBACK_COLOR;
              const active = hire.hireId === activeHireId;
              return (
                <motion.li
                  key={hire.hireId}
                  layout
                  initial={{ opacity: 0, x: 36, scale: 0.97 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                  className={`rounded-xl border ${
                    active ? 'border-sky-400/60 bg-sky-400/10' : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.07]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect?.(hire)}
                    onMouseEnter={() => onHover?.(hire)}
                    onMouseLeave={() => onHover?.(null)}
                    onFocus={() => onHover?.(hire)}
                    onBlur={() => onHover?.(null)}
                    className="block w-full rounded-xl px-[clamp(0.6rem,0.9vw,1.1rem)] py-[clamp(0.45rem,0.7vw,0.9rem)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    title="Click to focus · hover to highlight on map"
                  >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 truncate text-[clamp(0.9rem,1.15vw,1.6rem)] font-semibold text-slate-50">
                      <span className="mr-2 inline-block h-[0.55em] w-[0.55em] rounded-full align-middle" style={{ backgroundColor: color }} />
                      {hire.freelancer.displayName}
                    </p>
                    <time
                      dateTime={hire.hiredAt}
                      className="shrink-0 text-[clamp(0.65rem,0.8vw,1.05rem)] tabular-nums text-slate-500"
                    >
                      {timeAgo(hireTime(hire), now)}
                    </time>
                  </div>
                  <p className="truncate text-[clamp(0.8rem,1vw,1.35rem)] text-slate-300">
                    <span className="text-slate-500">hired by </span>
                    {hire.company.name}
                  </p>
                  <p className="truncate text-[clamp(0.65rem,0.8vw,1.05rem)] text-slate-500">
                    {hire.jobTitle}
                    {hire.jobType ? ` · ${JOB_TYPE_LABEL[hire.jobType] ?? hire.jobType}` : ''}
                  </p>
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

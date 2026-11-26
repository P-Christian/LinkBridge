// src/modules/vos-admin/components/dashboard/hiring-map/HiringDetailPanel.tsx
'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { GraphSelection, HireEvent, HiringGraph } from '../../../types/hiring-map.types';
import { FALLBACK_COLOR, categoryOf } from '../../../lib/hiring-map/hiring-graph';
import { hireTime, timeAgo } from '../../../lib/hiring-map/hiring-format';

export interface HiringDetailPanelProps {
  selection: GraphSelection;
  graph: HiringGraph;
  /** hires in the current time range */
  hires: readonly HireEvent[];
  categoryColors: ReadonlyMap<string, string>;
  now: number;
  onClose: () => void;
  onSelect: (selection: GraphSelection) => void;
}

const MAX_ROWS = 8;

/** Opens when a company or freelancer is clicked on the map. */
export function HiringDetailPanel({ selection, graph, hires, categoryColors, now, onClose, onSelect }: HiringDetailPanelProps) {
  const data = useMemo(() => {
    if (selection.kind === 'company') {
      const company = graph.companies.find((c) => c.id === selection.id);
      if (!company) return null;
      const rows = hires.filter((h) => h.company.id === company.entityId).sort((a, b) => hireTime(b) - hireTime(a));
      return { title: company.label, subtitle: `${rows.length} ${rows.length === 1 ? 'hire' : 'hires'} in this range`, rows };
    }
    const person = graph.freelancers.find((f) => f.id === selection.id);
    if (!person) return null;
    const rows = hires.filter((h) => h.freelancer.id === person.entityId).sort((a, b) => hireTime(b) - hireTime(a));
    return { title: person.label, subtitle: person.category, rows };
  }, [selection, graph, hires]);

  if (!data) return null;

  return (
    <motion.aside
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="absolute left-[clamp(0.75rem,1.4vw,2rem)] top-[clamp(0.5rem,1vw,1.5rem)] z-10 flex max-h-[min(70%,32rem)] w-[clamp(15rem,22vw,26rem)] flex-col rounded-2xl border border-white/10 bg-slate-900/90 shadow-2xl backdrop-blur"
      aria-label={`${data.title} details`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/5 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">
            {selection.kind === 'company' ? 'Company' : 'Freelancer'}
          </p>
          <h2 className="truncate text-[clamp(1rem,1.3vw,1.7rem)] font-bold text-slate-50">{data.title}</h2>
          <p className="truncate text-xs text-slate-400">{data.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          aria-label="Close details"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {data.rows.slice(0, MAX_ROWS).map((hire) => {
          const color = categoryColors.get(categoryOf(hire)) ?? FALLBACK_COLOR;
          const target: GraphSelection =
            selection.kind === 'company'
              ? { kind: 'freelancer', id: `f${hire.freelancer.id}` }
              : { kind: 'company', id: `c${hire.company.id}` };
          return (
            <li key={hire.hireId}>
              <button
                type="button"
                onClick={() => onSelect(target)}
                className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-100">
                      {selection.kind === 'company' ? hire.freelancer.displayName : hire.company.name}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-slate-500">{timeAgo(hireTime(hire), now)}</span>
                  </span>
                  <span className="block truncate text-xs text-slate-400">{hire.jobTitle}</span>
                </span>
              </button>
            </li>
          );
        })}
        {data.rows.length > MAX_ROWS && (
          <li className="px-3 py-1 text-xs text-slate-500">+{data.rows.length - MAX_ROWS} more</li>
        )}
      </ul>
    </motion.aside>
  );
}

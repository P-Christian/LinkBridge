// src/modules/vos-admin/components/dashboard/AdminHiringMapCard.tsx
'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Network } from 'lucide-react';
import type { GraphSelection } from '../../types/hiring-map.types';
import { createLiveSource } from '../../lib/hiring-map/hiring-live';
import { hireTime, startOfLocalDay } from '../../lib/hiring-map/hiring-format';
import { useHiringStream } from '../../hooks/useHiringStream';
import { useElementSize, useHiringGraph } from '../../hooks/useHiringGraph';
import { HiringNetworkGraph } from './hiring-map/HiringNetworkGraph';

export interface AdminHiringMapCardProps {
  /** where the full-screen map lives */
  href?: string;
}

/** Small live preview of the hiring network for the admin dashboard. */
export function AdminHiringMapCard({ href = '/linkbridge/admin/hiring-map' }: AdminHiringMapCardProps) {
  const source = useMemo(() => createLiveSource({ pollMs: 30_000, streamUrl: '/api/realtime/stream' }), []);
  const stream = useHiringStream(source);
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const { ref: paneRef, size: paneSize } = useElementSize<HTMLDivElement>();
  const { graph } = useHiringGraph(stream.hires, stream.hires, paneSize);

  const [todayStart] = useState(() => startOfLocalDay(Date.now()));
  const hiredToday = stream.hires.filter((h) => hireTime(h) >= todayStart).length;
  const live = stream.status === 'live';

  return (
    <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm" aria-labelledby="hiring-map-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Network className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div>
            <h2 id="hiring-map-title" className="text-base font-semibold leading-tight text-foreground">
              Live hiring network
            </h2>
            <p className="text-xs text-muted-foreground">
              {stream.loading
                ? 'Loading…'
                : `${hiredToday} hired today · ${graph.companies.length} companies · ${graph.freelancers.length} freelancers`}
            </p>
          </div>
        </div>

        <Link
          href={href}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-2xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open full screen
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div ref={paneRef} className="relative h-[clamp(18rem,52vh,36rem)] overflow-hidden rounded-2xl bg-slate-950">
        {graph.companies.length > 0 ? (
          <HiringNetworkGraph
            graph={graph}
            width={paneSize.width}
            height={paneSize.height}
            todayStart={todayStart}
            arrival={stream.arrival}
            compact
            scrollSafe
            selection={selection}
            onSelectionChange={setSelection}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {stream.error ?? (stream.loading ? 'Loading…' : 'No hires yet')}
          </div>
        )}

        <p className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-slate-900/70 px-3 py-1 text-[11px] text-slate-400 backdrop-blur">
          Drag to pan · Ctrl + scroll to zoom
        </p>

        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
            live ? 'text-emerald-300' : 'text-amber-300'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {live ? 'Live' : stream.status}
        </span>
      </div>
    </section>
  );
}

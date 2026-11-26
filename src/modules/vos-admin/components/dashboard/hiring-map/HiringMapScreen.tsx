// src/modules/vos-admin/components/dashboard/hiring-map/HiringMapScreen.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import {
  HIRING_DESIGNS,
  isHiringDesign,
  type ConnectionStatus,
  type GraphSelection,
  type HireEvent,
  type HiringDesign,
  type HiringSource,
} from '../../../types/hiring-map.types';
import { createDemoSource } from '../../../lib/hiring-map/hiring-demo';
import { createLiveSource } from '../../../lib/hiring-map/hiring-live';
import { hireTime, rangeStart, startOfLocalDay, type TimeRange } from '../../../lib/hiring-map/hiring-format';
import { useHiringStream } from '../../../hooks/useHiringStream';
import { useFullscreen } from '../../../hooks/useFullscreen';
import { useElementSize, useHiringGraph } from '../../../hooks/useHiringGraph';
import { HiringNetworkGraph, type HiringNetworkGraphHandle } from './HiringNetworkGraph';
import { HiringDetailPanel } from './HiringDetailPanel';
import { HiringFlowBoard } from './HiringFlowBoard';
import { HiringOrbitBoard } from './HiringOrbitBoard';
import { HiringSpotlightBoard } from './HiringSpotlightBoard';
import { HiringStatsBar } from './HiringStatsBar';
import { HiringTicker } from './HiringTicker';
import { HiringMapControls } from './HiringMapControls';

const RANGE_LABEL: Record<TimeRange, string> = { today: 'today', '7d': '7 days', all: 'all time' };

const STATUS_UI: Record<ConnectionStatus, { label: string; dot: string; text: string }> = {
  live: { label: 'Live', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  demo: { label: 'Demo data', dot: 'bg-violet-400', text: 'text-violet-300' },
  connecting: { label: 'Connecting…', dot: 'bg-amber-400', text: 'text-amber-300' },
  reconnecting: { label: 'Reconnecting…', dot: 'bg-amber-400', text: 'text-amber-300' },
  offline: { label: 'Offline', dot: 'bg-red-500', text: 'text-red-300' },
};

/** Active SSE URL with fallback to polling */
export const HIRING_SSE_URL = process.env.NEXT_PUBLIC_HIRING_MAP_SSE === 'off' ? null : '/api/realtime/stream';

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** true after `ms` without mouse / key / touch activity (hides the cursor and the controls on a TV). */
function useIdle(ms: number) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), ms);
    };
    wake();
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [ms]);
  return idle;
}

/** Numbers the test page shows next to the map. */
export interface HiringMapDebug {
  status: ConnectionStatus;
  hires: number;
  queued: number;
  companies: number;
  freelancers: number;
  lastHire: string | null;
}

export interface HiringMapScreenProps {
  /** force demo data (otherwise `?demo=1` in the URL decides) */
  demo?: boolean;
  /** bring your own source (the test page does, so it can trigger hires by hand) */
  source?: HiringSource;
  /** render inside a page instead of covering the whole viewport */
  embedded?: boolean;
  /** `null` hides the "Admin portal" link */
  backHref?: string | null;
  /** controlled design; otherwise `?design=flow|orbit|spotlight` or the V key decides */
  design?: HiringDesign;
  onDesignChange?: (design: HiringDesign) => void;
  /** show the Network/Flow/Orbit/Spotlight switcher in the toolbar (hidden on main UI by default) */
  showDesignSwitcher?: boolean;
  onDebug?: (debug: HiringMapDebug) => void;
}

export function HiringMapScreen({
  demo,
  source: sourceProp,
  embedded = false,
  backHref = '/linkbridge/admin',
  design: designProp,
  onDesignChange,
  showDesignSwitcher = false,
  onDebug,
}: HiringMapScreenProps) {
  const searchParams = useSearchParams();
  const isDemo = sourceProp ? sourceProp.kind === 'demo' : (demo ?? searchParams?.get('demo') === '1');

  const ownSource = useMemo(
    () => (isDemo ? createDemoSource() : createLiveSource({ streamUrl: HIRING_SSE_URL })),
    [isDemo],
  );
  const source = sourceProp ?? ownSource;
  const stream = useHiringStream(source);

  const [designState, setDesignState] = useState<HiringDesign>(() => {
    const asked = searchParams?.get('design');
    return isHiringDesign(asked) ? asked : 'network';
  });
  const design = designProp ?? designState;
  const changeDesign = useCallback(
    (next: HiringDesign) => {
      setDesignState(next);
      onDesignChange?.(next);
    },
    [onDesignChange],
  );

  const { ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>();
  const idle = useIdle(4_000);
  const now = useNow(30_000);
  const todayStart = startOfLocalDay(now);

  const [range, setRange] = useState<TimeRange>('all');
  const [feedOpen, setFeedOpen] = useState(true);
  const [legendOpen, setLegendOpen] = useState(true);
  const [hoveredHire, setHoveredHire] = useState<HireEvent | null>(null);
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const graphRef = useRef<HiringNetworkGraphHandle>(null);
  const visible = useMemo(() => {
    const from = rangeStart(range, todayStart);
    return stream.hires.filter((h) => hireTime(h) >= from);
  }, [stream.hires, range, todayStart]);

  const { ref: paneRef, size: paneSize } = useElementSize<HTMLElement>();
  const { graph, categoryColors } = useHiringGraph(visible, stream.hires, paneSize);

  // freelancers hired most recently today get a name tag on the graph
  const labelled = useMemo(() => {
    const ids = new Set<number>();
    [...visible]
      .filter((h) => hireTime(h) >= todayStart)
      .sort((a, b) => hireTime(b) - hireTime(a))
      .slice(0, 5)
      .forEach((h) => ids.add(h.freelancer.id));
    return ids;
  }, [visible, todayStart]);

  const stats = useMemo(
    () => ({
      hiredToday: stream.hires.filter((h) => hireTime(h) >= todayStart).length,
      hiresInRange: visible.length,
      companies: graph.companies.length,
      freelancers: graph.freelancers.length,
      rangeLabel: RANGE_LABEL[range],
    }),
    [stream.hires, visible, graph, range, todayStart],
  );

  useEffect(() => {
    onDebug?.({
      status: stream.status,
      hires: stream.hires.length,
      queued: stream.queued,
      companies: graph.companies.length,
      freelancers: graph.freelancers.length,
      lastHire: stream.recent[0]?.hireId ?? null,
    });
  }, [onDebug, stream.status, stream.hires.length, stream.queued, stream.recent, graph.companies.length, graph.freelancers.length]);
  const { simulate } = stream;

  const toggleFeed = useCallback(() => setFeedOpen((open) => !open), []);

  // ticker row -> select that company and fly the camera to it
  const showHire = useCallback((hire: HireEvent) => {
    const id = `c${hire.company.id}`;
    setSelection({ kind: 'company', id });
    graphRef.current?.focusNode(id);
  }, []);

  // detail-panel row -> select that node and fly to it
  const selectNode = useCallback((next: GraphSelection) => {
    setSelection(next);
    graphRef.current?.focusNode(next.id);
  }, []);

  // keyboard: F full screen, T feed, 1/2/3 range, +/- zoom, 0 fit, Esc clear, S simulate (demo)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'f') void toggleFullscreen();
      else if (key === '1') setRange('today');
      else if (key === '2') setRange('7d');
      else if (key === '3') setRange('all');
      else if (key === 's' && simulate) simulate();
      else if (key === 't') toggleFeed();
      else if (key === 'v' && showDesignSwitcher) changeDesign(HIRING_DESIGNS[(HIRING_DESIGNS.indexOf(design) + 1) % HIRING_DESIGNS.length]);
      else if (key === '+' || key === '=') graphRef.current?.zoomBy(1 / 1.5);
      else if (key === '-' || key === '_') graphRef.current?.zoomBy(1.5);
      else if (key === '0') graphRef.current?.recenter();
      else if (key === 'escape') {
        setSelection(null);
        setCategoryFilter(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleFullscreen, toggleFeed, simulate, changeDesign, design, showDesignSwitcher]);

  const handleRange = useCallback((r: TimeRange) => setRange(r), []);

  const statusUi = STATUS_UI[stream.status];
  const hideChrome = idle && isFullscreen;
  const isEmpty = !stream.loading && graph.companies.length === 0;

  return (
    <div
      ref={fullscreenRef}
      className={`${
        embedded ? 'relative h-full w-full' : 'fixed inset-0 z-[100]'
      } flex flex-col overflow-hidden bg-slate-950 text-slate-100 ${idle && isFullscreen ? 'cursor-none' : ''} ${
        !embedded && idle ? 'cursor-none' : ''
      }`}
    >
      {/* soft depth behind the graph */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(56,189,248,0.10),transparent_55%),radial-gradient(ellipse_at_80%_90%,rgba(167,139,250,0.10),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:28px_28px]"
      />

      {/* ───────── header ───────── */}
      <header className="relative z-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-3 px-[clamp(1rem,2vw,3rem)] pb-3 pt-[clamp(0.75rem,1.4vw,2rem)]">
        <div className="min-w-0">
          <div className={`mb-1 flex items-center gap-3 transition-opacity duration-500 ${hideChrome ? 'opacity-0' : 'opacity-100'}`}>
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 rounded-lg text-sm text-slate-400 transition-colors hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Admin portal
              </Link>
            )}
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-[clamp(1.4rem,2.4vw,3.4rem)] font-bold leading-none tracking-tight">Live Hiring Network</h1>
            <span
              className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[clamp(0.7rem,0.9vw,1.15rem)] font-semibold uppercase tracking-wider ${statusUi.text}`}
              role="status"
            >
              <span className="relative flex h-2.5 w-2.5">
                {(stream.status === 'live' || stream.status === 'demo') && (
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${statusUi.dot}`} />
                )}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statusUi.dot}`} />
              </span>
              {statusUi.label}
            </span>
          </div>
        </div>

        <HiringStatsBar stats={stats} />

        <div className={`transition-opacity duration-500 ${hideChrome ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
          <HiringMapControls
            range={range}
            onRangeChange={handleRange}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => void toggleFullscreen()}
            onSimulate={isDemo ? simulate : undefined}
            feedOpen={feedOpen}
            onToggleFeed={toggleFeed}
            design={design}
            onDesignChange={changeDesign}
            showDesignSwitcher={showDesignSwitcher}
          />
        </div>
      </header>

      {/* ───────── graph + ticker ───────── */}
      <div className="relative z-10 flex min-h-0 flex-1">
        <main ref={paneRef} className="relative min-w-0 flex-1">
          {graph.companies.length > 0 && design === 'flow' && (
            <HiringFlowBoard
              hires={visible}
              categoryColors={categoryColors}
              width={paneSize.width}
              height={paneSize.height}
              todayStart={todayStart}
              now={now}
              arrival={stream.arrival}
              selection={selection}
              onSelectionChange={setSelection}
              categoryFilter={categoryFilter}
            />
          )}
          {graph.companies.length > 0 && design === 'orbit' && (
            <HiringOrbitBoard
              hires={visible}
              categoryColors={categoryColors}
              width={paneSize.width}
              height={paneSize.height}
              todayStart={todayStart}
              now={now}
              arrival={stream.arrival}
              selection={selection}
              onSelectionChange={setSelection}
              categoryFilter={categoryFilter}
            />
          )}
          {graph.companies.length > 0 && design === 'spotlight' && (
            <HiringSpotlightBoard
              hires={visible}
              categoryColors={categoryColors}
              width={paneSize.width}
              height={paneSize.height}
              todayStart={todayStart}
              now={now}
              arrival={stream.arrival}
              selection={selection}
              onSelectionChange={setSelection}
              categoryFilter={categoryFilter}
            />
          )}
          {graph.companies.length > 0 && design === 'network' && (
            <HiringNetworkGraph
              graph={graph}
              width={paneSize.width}
              height={paneSize.height}
              todayStart={todayStart}
              arrival={stream.arrival}
              labelledFreelancers={labelled}
              selection={selection}
              onSelectionChange={setSelection}
              categoryFilter={categoryFilter}
              externalHoverId={hoveredHire ? `f${hoveredHire.freelancer.id}` : null}
              ref={graphRef}
            />
          )}

          <AnimatePresence>
            {selection && graph.companies.length > 0 && (
              <HiringDetailPanel
                key={selection.id}
                selection={selection}
                graph={graph}
                hires={visible}
                categoryColors={categoryColors}
                now={now}
                onClose={() => setSelection(null)}
                onSelect={selectNode}
              />
            )}
          </AnimatePresence>

          {(stream.loading || isEmpty || stream.error) && (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
              <div>
                <div className="mx-auto mb-5 h-16 w-16 animate-pulse rounded-full border-2 border-sky-400/40" />
                <p className="text-[clamp(1.1rem,1.6vw,2.2rem)] font-semibold text-slate-200">
                  {stream.error
                    ? 'Could not load hires'
                    : stream.loading
                      ? 'Loading the hiring network…'
                      : range === 'all'
                        ? 'Waiting for the first hire…'
                        : `No hires ${range === 'today' ? 'today' : 'in the last 7 days'} yet`}
                </p>
                <p className="mt-2 text-[clamp(0.8rem,1vw,1.3rem)] text-slate-500">
                  {stream.error ?? (isEmpty ? 'The map will draw itself as soon as someone is hired.' : '')}
                </p>
              </div>
            </div>
          )}

          {/* legend: click a category to isolate it */}
          {graph.categories.length > 0 && (
            <div className="absolute bottom-[clamp(0.75rem,1.4vw,2rem)] left-[clamp(1rem,2vw,3rem)] z-10 max-w-[min(34rem,52%)]">
              {legendOpen ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-1.5 shadow-lg shadow-slate-950/60 backdrop-blur">
                  <div className="mb-1 flex items-center justify-between gap-2 px-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Categories
                    </span>
                    <div className="flex items-center gap-2">
                      {categoryFilter && (
                        <button
                          type="button"
                          onClick={() => setCategoryFilter(null)}
                          className="rounded-md bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300 transition-colors hover:bg-sky-400/25"
                          title="Clear category filter"
                        >
                          Clear filter
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setLegendOpen(false)}
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
                        title="Minimize categories"
                      >
                        Hide
                      </button>
                    </div>
                  </div>
                  <ul
                    className="grid grid-cols-1 gap-x-1.5 gap-y-0.5 sm:grid-cols-2"
                    aria-label="Categories (click to filter)"
                  >
                    {graph.categories.slice(0, 8).map((c) => {
                      const active = categoryFilter === c.category;
                      const faded = categoryFilter !== null && !active;
                      return (
                        <li key={c.category}>
                          <button
                            type="button"
                            aria-pressed={active}
                            title={`${c.category} (${c.count}) — Click to ${active ? 'clear filter' : 'filter'}`}
                            onClick={() => setCategoryFilter(active ? null : c.category)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-0.5 text-left text-[clamp(0.68rem,0.82vw,1.05rem)] transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                              active ? 'bg-white/15 text-slate-50 ring-1 ring-sky-400/50' : 'text-slate-300'
                            } ${faded ? 'opacity-45' : ''}`}
                          >
                            <span className="h-[0.65em] w-[0.65em] shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                            <span className="truncate">{c.category}</span>
                            <span className="ml-auto tabular-nums text-slate-500">{c.count}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setLegendOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-slate-300 shadow-lg backdrop-blur transition-colors hover:bg-white/10 hover:text-slate-100"
                  title="Show category filters"
                >
                  Categories{categoryFilter ? ` · ${categoryFilter}` : ''}
                </button>
              )}
            </div>
          )}

          {/* big "just hired" banner, readable from across the room */}
          <div className="pointer-events-none absolute inset-x-0 top-[clamp(0.25rem,0.8vw,1.25rem)] flex justify-center px-6">
            <AnimatePresence mode="wait">
              {stream.arrival && (
                <motion.div
                  key={stream.arrival.hire.hireId}
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                  className="max-w-full rounded-2xl border border-sky-400/40 bg-slate-900/90 px-[clamp(1rem,2vw,2.5rem)] py-[clamp(0.6rem,1vw,1.4rem)] text-center shadow-[0_0_60px_rgba(56,189,248,0.25)] backdrop-blur"
                  role="status"
                  aria-live="polite"
                >
                  <p className="text-[clamp(0.65rem,0.85vw,1.1rem)] font-semibold uppercase tracking-[0.2em] text-sky-300">
                    Just hired
                  </p>
                  <p className="truncate text-[clamp(1.1rem,2vw,3rem)] font-bold text-slate-50">
                    {stream.arrival.hire.freelancer.displayName}
                    <span className="mx-3 font-normal text-slate-500">→</span>
                    {stream.arrival.hire.company.name}
                  </p>
                  <p className="truncate text-[clamp(0.75rem,1vw,1.4rem)] text-slate-400">{stream.arrival.hire.jobTitle}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {stream.queued > 2 && (
            <div className="absolute right-4 top-3 rounded-full bg-sky-400/15 px-3 py-1 text-xs font-medium text-sky-300">
              +{stream.queued} more arriving
            </div>
          )}
        </main>

        <aside
          className={`hidden shrink-0 overflow-hidden border-l border-white/5 bg-slate-950/40 backdrop-blur-sm transition-[width] duration-300 md:block ${
            feedOpen ? 'w-[clamp(17rem,22vw,32rem)]' : 'w-0 border-l-0'
          }`}
          aria-hidden={!feedOpen}
        >
          <div className="h-full w-[clamp(17rem,22vw,32rem)]">
          <HiringTicker
            items={stream.recent}
            categoryColors={categoryColors}
            now={now}
            activeHireId={stream.arrival?.hire.hireId}
            onSelect={showHire}
            onHover={setHoveredHire}
          />
          </div>
        </aside>
      </div>

      {stream.status === 'offline' && (
        <div className="absolute inset-x-0 top-0 z-20 bg-red-500/90 py-1.5 text-center text-sm font-semibold text-white" role="alert">
          Connection lost. This screen may be out of date, retrying…
        </div>
      )}
    </div>
  );
}


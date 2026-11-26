// src/modules/vos-admin/components/dashboard/hiring-map/HiringMapLab.tsx
//
// Test bench for the live hiring map: pick the design, switch demo/live data,
// trigger hires by hand and watch what the map reports.
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HIRING_DESIGNS, type HiringDesign } from '../../../types/hiring-map.types';
import { createDemoSource, type DemoSource } from '../../../lib/hiring-map/hiring-demo';
import { createLiveSource } from '../../../lib/hiring-map/hiring-live';
import { HIRING_SSE_URL, HiringMapScreen, type HiringMapDebug } from './HiringMapScreen';

type Mode = 'demo' | 'live';

export interface HiringMapLabProps {
  /** the real, full-screen page */
  livePageHref?: string;
}

function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{props.label}</span>
      <div role="radiogroup" aria-label={props.label} className="flex rounded-xl border border-border/80 bg-muted/40 p-1">
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={props.value === o.value}
            onClick={() => props.onChange(o.value)}
            className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              props.value === o.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const DESIGN_OPTIONS: ReadonlyArray<{ value: HiringDesign; label: string }> = HIRING_DESIGNS.map((value) => ({
  value,
  label: { network: 'Network', flow: 'Flow board', orbit: 'Orbit', spotlight: 'Spotlight' }[value],
}));

const CHECKS: ReadonlyArray<[string, string]> = [
  ['Network', 'Drag empty space to pan, scroll to zoom, double-click to fit'],
  ['Network', 'Drag a company; its freelancers follow; the reset button puts it back'],
  ['Network', 'Click a company: others fade and a detail panel opens'],
  ['Flow', 'Newest hire slides in at the top and its ribbon draws itself'],
  ['Flow', 'Hover a card to light up its ribbons; click to pin'],
  ['Orbit', 'Everything fits the pane; hover a company or dot to light up its lines; Re-hire draws a curve across the middle'],
  ['Orbit', 'New company: the ring re-spaces and the dots glide to their new place'],
  ['Spotlight', 'The newest hire fills the top with a glowing line; Add hire swaps it and the old one drops into the grid'],
  ['Spotlight', 'Click a name or a company in the grid to open its detail panel'],
  ['All', 'Burst ×5 plays one by one (the "+N more arriving" badge shows the queue)'],
  ['Network', 'New company: the layout re-balances without jumping'],
  ['All', 'Keys: F full screen · V next design · T feed · 1/2/3 range · Esc clear'],
];

export function HiringMapLab({ livePageHref = '/linkbridge/admin/hiring-map' }: HiringMapLabProps) {
  const [mode, setMode] = useState<Mode>('demo');
  const [design, setDesign] = useState<HiringDesign>('network');
  const [auto, setAuto] = useState(false);
  const [nonce, setNonce] = useState(0); // bump = fresh source = reset
  const [debug, setDebug] = useState<HiringMapDebug | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const source = useMemo(
    () => (mode === 'demo' ? createDemoSource({ auto: false }) : createLiveSource({ streamUrl: HIRING_SSE_URL })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, nonce],
  );
  const demo: DemoSource | null = mode === 'demo' ? (source as DemoSource) : null;

  useEffect(() => {
    demo?.setAuto(auto);
  }, [demo, auto]);

  const note = useCallback((text: string) => {
    const t = new Date().toLocaleTimeString('en-GB');
    setLog((prev) => [`${t}  ${text}`, ...prev].slice(0, 8));
  }, []);

  const trigger = (text: string, fn: (() => void) | undefined) => () => {
    fn?.();
    note(text);
  };

  const onDebug = useCallback((d: HiringMapDebug) => setDebug(d), []);

  return (
    <div className="flex-1 space-y-4 p-4 sm:p-6 md:p-8 max-w-[1800px] mx-auto w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FlaskConical className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight tracking-tight text-foreground">Live hiring · test lab</h1>
            <p className="text-xs text-muted-foreground">Try every design with fake or real data before putting them on the TV.</p>
          </div>
        </div>
        <Link
          href={livePageHref}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-2xs transition-colors hover:bg-muted"
        >
          Open the real page <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border/80 bg-card p-3 shadow-sm">
        <Segmented
          label="Design"
          value={design}
          onChange={setDesign}
          options={DESIGN_OPTIONS}
        />
        <Segmented
          label="Data"
          value={mode}
          onChange={(m) => {
            setMode(m);
            note(`data → ${m}`);
          }}
          options={[
            { value: 'demo', label: 'Demo' },
            { value: 'live', label: 'Live' },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Simulate</span>
          <Button size="sm" variant="outline" disabled={!demo} onClick={trigger('add hire', demo?.simulate)}>
            Add hire
          </Button>
          <Button size="sm" variant="outline" disabled={!demo} onClick={trigger('burst ×5', () => demo?.simulateBurst(5))}>
            Burst ×5
          </Button>
          <Button size="sm" variant="outline" disabled={!demo} onClick={trigger('hire at a new company', demo?.simulateNewCompany)}>
            New company
          </Button>
          <Button size="sm" variant="outline" disabled={!demo} onClick={trigger('re-hire (cross link)', demo?.simulateRehire)}>
            Re-hire
          </Button>
          <label className="ml-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={auto}
              disabled={!demo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setAuto(e.target.checked);
                note(`auto-simulate ${e.target.checked ? 'on' : 'off'}`);
              }}
            />
            Auto
          </label>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setNonce((n) => n + 1);
              note('reset');
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* the map */}
        <div className="h-[clamp(30rem,76vh,60rem)] overflow-hidden rounded-3xl border border-border/80 shadow-sm">
          <HiringMapScreen source={source} embedded backHref={null} design={design} onDesignChange={setDesign} onDebug={onDebug} />
        </div>

        {/* readouts */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-foreground">What the map reports</h2>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {[
                ['Status', debug?.status ?? '…'],
                ['Hires loaded', debug?.hires ?? '…'],
                ['Queued', debug?.queued ?? '…'],
                ['Companies', debug?.companies ?? '…'],
                ['Freelancers', debug?.freelancers ?? '…'],
                ['Latest id', debug?.lastHire ?? '–'],
              ].map(([k, v]) => (
                <React.Fragment key={String(k)}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="truncate text-right font-medium tabular-nums text-foreground">{String(v)}</dd>
                </React.Fragment>
              ))}
            </dl>
            {mode === 'live' && (
              <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                Live mode shows real hires. Simulate buttons are off; mark an application as HIRED to see it arrive.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Event log</h2>
            {log.length === 0 ? (
              <p className="text-xs text-muted-foreground">Press a Simulate button.</p>
            ) : (
              <ul className="space-y-1 font-mono text-xs text-muted-foreground">
                {log.map((line, i) => (
                  <li key={`${line}-${i}`} className="truncate">
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Things to check</h2>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {CHECKS.map(([tag, text]) => (
                <li key={text} className="flex gap-2">
                  <span className="mt-0.5 h-fit shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-foreground/70">{tag}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

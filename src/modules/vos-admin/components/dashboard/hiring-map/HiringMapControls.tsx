// src/modules/vos-admin/components/dashboard/hiring-map/HiringMapControls.tsx
'use client';

import React from 'react';
import { Maximize2, Minimize2, PanelRightClose, PanelRightOpen, Sparkles } from 'lucide-react';
import { HIRING_DESIGNS, HIRING_DESIGN_LABEL, type HiringDesign } from '../../../types/hiring-map.types';
import { TIME_RANGES, type TimeRange } from '../../../lib/hiring-map/hiring-format';

export interface HiringMapControlsProps {
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  /** demo mode only */
  onSimulate?: () => void;
  feedOpen: boolean;
  onToggleFeed: () => void;
  design: HiringDesign;
  onDesignChange: (design: HiringDesign) => void;
  showDesignSwitcher?: boolean;
}

const btn =
  'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-slate-200 ' +
  'transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400';

export function HiringMapControls({
  range,
  onRangeChange,
  isFullscreen,
  onToggleFullscreen,
  onSimulate,
  feedOpen,
  onToggleFeed,
  design,
  onDesignChange,
  showDesignSwitcher = false,
}: HiringMapControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <div role="radiogroup" aria-label="Time range" className="flex rounded-xl border border-white/10 bg-white/5 p-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={range === r.value}
            onClick={() => onRangeChange(r.value)}
            title={`Press ${r.key}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              range === r.value ? 'bg-sky-400 text-slate-950' : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {showDesignSwitcher && (
        <div role="radiogroup" aria-label="Design" className="flex rounded-xl border border-white/10 bg-white/5 p-1">
          {HIRING_DESIGNS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={design === value}
              onClick={() => onDesignChange(value)}
              title="Press V to switch"
              className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                design === value ? 'bg-violet-400 text-slate-950' : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              {HIRING_DESIGN_LABEL[value]}
            </button>
          ))}
        </div>
      )}

      {onSimulate && (
        <button type="button" onClick={onSimulate} className={btn} title="Press S">
          <Sparkles className="h-4 w-4" aria-hidden />
          Simulate hire
        </button>
      )}

      <button type="button" onClick={onToggleFeed} className={btn} title="Press T" aria-pressed={feedOpen}>
        {feedOpen ? <PanelRightClose className="h-4 w-4" aria-hidden /> : <PanelRightOpen className="h-4 w-4" aria-hidden />}
        {feedOpen ? 'Hide feed' : 'Show feed'}
      </button>

      <button type="button" onClick={onToggleFullscreen} className={btn} title="Press F">
        {isFullscreen ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
        {isFullscreen ? 'Exit full screen' : 'Full screen'}
      </button>
    </div>
  );
}

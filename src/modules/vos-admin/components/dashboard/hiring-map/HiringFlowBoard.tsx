// src/modules/vos-admin/components/dashboard/hiring-map/HiringFlowBoard.tsx
//
// Design B, "Flow board": recent freelancers on the left, the companies that hired
// them on the right, a ribbon per hire. Reads like a sentence from across a room
// ("Ana G. → Brightwave Labs") and never has overlapping labels, which makes it a
// good TV view when the network design gets busy.
//
// Styled with inline styles on purpose (no Tailwind dependency, easy to restyle).
'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GraphSelection, HireEvent } from '../../../types/hiring-map.types';
import { FALLBACK_COLOR } from '../../../lib/hiring-map/hiring-graph';
import { buildFlowLayout, type FlowCompany, type FlowFreelancer } from '../../../lib/hiring-map/hiring-flow';
import { initialsOf, timeAgo } from '../../../lib/hiring-map/hiring-format';
import type { Arrival } from '../../../hooks/useHiringStream';

const ACCENT = '#38bdf8';
const SPRING = { type: 'spring', stiffness: 220, damping: 28 } as const;

export interface HiringFlowBoardProps {
  hires: readonly HireEvent[];
  categoryColors: ReadonlyMap<string, string>;
  width: number;
  height: number;
  todayStart: number;
  now: number;
  arrival?: Arrival | null;
  selection: GraphSelection | null;
  onSelectionChange: (selection: GraphSelection | null) => void;
  categoryFilter?: string | null;
}

const font = (min: string, vw: number, max: string) => `clamp(${min}, ${vw}vw, ${max})`;

const titleStyle: React.CSSProperties = {
  position: 'absolute',
  top: 30,
  fontSize: font('0.7rem', 0.85, '1.1rem'),
  fontWeight: 700,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: '#94a3b8',
};

function cardBase(opts: { x: number; w: number; h: number; dim: boolean; active: boolean; glow: boolean; today: boolean }): React.CSSProperties {
  return {
    position: 'absolute',
    left: opts.x,
    top: 0,
    width: opts.w,
    height: opts.h,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0 16px',
    borderRadius: 16,
    border: `1px solid ${opts.active ? '#f8fafc' : opts.today ? 'rgba(56,189,248,0.45)' : 'rgba(255,255,255,0.08)'}`,
    background: 'linear-gradient(180deg, rgba(30,41,59,0.78), rgba(15,23,42,0.82))',
    boxShadow: opts.glow ? `0 0 0 2px ${ACCENT}, 0 0 36px rgba(56,189,248,0.45)` : '0 6px 20px rgba(0,0,0,0.35)',
    transition: 'box-shadow 300ms, border-color 200ms',
    cursor: 'pointer',
    textAlign: 'left',
    color: '#f1f5f9',
    font: 'inherit',
    overflow: 'hidden',
  };
}

function Avatar({ text, color, src }: { text: string; color: string; src?: string | null }) {
  const [ok, setOk] = useState(true);
  return (
    <span
      style={{
        flex: '0 0 auto',
        width: 'clamp(2rem, 2.6vw, 3.4rem)',
        height: 'clamp(2rem, 2.6vw, 3.4rem)',
        borderRadius: '9999px',
        display: 'grid',
        placeItems: 'center',
        background: src && ok ? '#fff' : `${color}33`,
        color,
        border: `1.5px solid ${color}`,
        fontWeight: 800,
        fontSize: font('0.7rem', 0.9, '1.2rem'),
        overflow: 'hidden',
      }}
    >
      {src && ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setOk(false)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        text
      )}
    </span>
  );
}

const ellipsis: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

export function HiringFlowBoard({
  hires,
  categoryColors,
  width,
  height,
  todayStart,
  now,
  arrival = null,
  selection,
  onSelectionChange,
  categoryFilter = null,
}: HiringFlowBoardProps) {
  const layout = useMemo(() => buildFlowLayout(hires, { width, height }), [hires, width, height]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const colorOf = (category: string) => categoryColors.get(category) ?? FALLBACK_COLOR;

  // what stays bright: the hovered / selected card, its ribbons and the cards on the other end
  const focusId = selection?.id ?? hoverId;
  const focus = useMemo(() => {
    const cards = new Set<string>();
    const links = new Set<string>();
    if (focusId) {
      cards.add(focusId);
      for (const l of layout.links) {
        if (l.from === focusId || l.to === focusId) {
          links.add(l.id);
          cards.add(l.from);
          cards.add(l.to);
        }
      }
      return { cards, links };
    }
    if (categoryFilter) {
      for (const f of layout.freelancers) if (f.category === categoryFilter) cards.add(f.id);
      for (const l of layout.links) {
        if (cards.has(l.from)) {
          links.add(l.id);
          cards.add(l.to);
        }
      }
      return { cards, links };
    }
    return null;
  }, [focusId, categoryFilter, layout]);

  const arrivalF = arrival ? `f${arrival.hire.freelancer.id}` : null;
  const arrivalC = arrival ? `c${arrival.hire.company.id}` : null;
  const arrivalLink = arrival ? `f${arrival.hire.freelancer.id}>c${arrival.hire.company.id}` : null;

  const toggle = (kind: GraphSelection['kind'], id: string) =>
    onSelectionChange(selection?.id === id ? null : { kind, id });

  const { cardW, cardH, x1, x2 } = layout;
  const midX = (x1 + x2) / 2;

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
      onClick={() => onSelectionChange(null)}
    >
      <span style={{ ...titleStyle, left: layout.leftX + 4 }}>Freelancers · latest {layout.freelancers.length}</span>
      <span style={{ ...titleStyle, left: layout.rightX + 4 }}>Hired by</span>

      {/* ribbons */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        aria-hidden
      >
        {layout.links.map((l) => {
          const color = colorOf(l.category);
          const today = l.latest >= todayStart;
          const fresh = l.id === arrivalLink;
          const dim = !!focus && !focus.links.has(l.id);
          const w = (today ? 3 : 2) + (l.weight - 1) * 1.5;
          const d = `M${x1},${l.y1} C${midX},${l.y1} ${midX},${l.y2} ${x2},${l.y2}`;
          return (
            <g key={l.id} style={{ transition: 'opacity 200ms' }} opacity={dim ? 0.07 : 1}>
              {(fresh || (!!focus && !dim)) && (
                <motion.path d={d} fill="none" stroke={color} strokeWidth={w * 4} strokeOpacity={0.16} strokeLinecap="round" animate={{ d }} transition={SPRING} />
              )}
              <motion.path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={w}
                strokeLinecap="round"
                strokeOpacity={fresh ? 1 : today ? 0.85 : 0.5}
                initial={fresh ? { pathLength: 0 } : false}
                animate={{ d, pathLength: 1 }}
                transition={{ ...SPRING, pathLength: { duration: 1.1, ease: 'easeOut' } }}
              />
              <circle cx={x1} cy={l.y1} r={4} fill={color} />
              <circle cx={x2} cy={l.y2} r={4} fill={color} />
            </g>
          );
        })}
      </svg>

      {/* freelancers */}
      <AnimatePresence initial={false}>
        {layout.freelancers.map((f: FlowFreelancer) => {
          const color = colorOf(f.category);
          return (
            <motion.button
              key={f.id}
              type="button"
              initial={{ opacity: 0, y: f.y - 36 }}
              animate={{ opacity: !!focus && !focus.cards.has(f.id) ? 0.22 : 1, y: f.y }}
              exit={{ opacity: 0, y: f.y + 36, transition: { duration: 0.25 } }}
              transition={SPRING}
              style={cardBase({
                x: layout.leftX,
                w: cardW,
                h: cardH,
                dim: !!focus && !focus.cards.has(f.id),
                active: selection?.id === f.id,
                glow: f.id === arrivalF,
                today: f.latest >= todayStart,
              })}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                toggle('freelancer', f.id);
              }}
              onMouseEnter={() => setHoverId(f.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              <span style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 4, borderRadius: 4, background: color }} />
              <Avatar text={initialsOf(f.name)} color={color} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ ...ellipsis, display: 'block', fontWeight: 700, fontSize: font('0.9rem', 1.2, '1.6rem') }}>{f.name}</span>
                <span style={{ ...ellipsis, display: 'block', color: '#94a3b8', fontSize: font('0.7rem', 0.85, '1.15rem') }}>
                  {f.jobTitle} · <span style={{ color }}>{f.category}</span>
                </span>
              </span>
              <span style={{ flex: '0 0 auto', color: '#64748b', fontSize: font('0.65rem', 0.8, '1.05rem'), fontVariantNumeric: 'tabular-nums' }}>
                {timeAgo(f.latest, now)}
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>

      {/* companies */}
      <AnimatePresence initial={false}>
        {layout.companies.map((c: FlowCompany) => {
          const today = c.latest >= todayStart;
          return (
            <motion.button
              key={c.id}
              type="button"
              initial={{ opacity: 0, y: c.y + 24 }}
              animate={{ opacity: !!focus && !focus.cards.has(c.id) ? 0.22 : 1, y: c.y }}
              exit={{ opacity: 0, y: c.y - 24, transition: { duration: 0.25 } }}
              transition={SPRING}
              style={cardBase({
                x: layout.rightX,
                w: cardW,
                h: cardH,
                dim: !!focus && !focus.cards.has(c.id),
                active: selection?.id === c.id,
                glow: c.id === arrivalC,
                today,
              })}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                toggle('company', c.id);
              }}
              onMouseEnter={() => setHoverId(c.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              <Avatar text={c.initials} color={today ? ACCENT : '#94a3b8'} src={c.logoUrl} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ ...ellipsis, display: 'block', fontWeight: 700, fontSize: font('0.9rem', 1.2, '1.6rem') }}>{c.name}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: font('0.7rem', 0.85, '1.15rem') }}>
                  <span style={{ flex: '0 0 auto', color: today ? ACCENT : '#94a3b8', fontWeight: 600 }}>
                    {c.hireCount} {c.hireCount === 1 ? 'hire' : 'hires'}
                  </span>
                  <span style={{ flex: 1, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        width: `${Math.max(8, (c.hireCount / layout.maxCompanyHires) * 100)}%`,
                        background: today ? ACCENT : '#64748b',
                        borderRadius: 4,
                        transition: 'width 500ms',
                      }}
                    />
                  </span>
                </span>
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// src/modules/vos-admin/components/dashboard/hiring-map/HiringOrbitBoard.tsx
//
// Design C, "Orbit": companies on a ring, the freelancers they hired inside it, a line
// from every freelancer to their company. Re-hires draw a curve across the middle.
// The whole picture always fits the pane, so it needs no panning on a TV. The centre
// shows the running total.
//
// Styled with inline styles / SVG attributes on purpose (no Tailwind dependency).
'use client';

import React, { useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { GraphSelection, HireEvent } from '../../../types/hiring-map.types';
import { FALLBACK_COLOR } from '../../../lib/hiring-map/hiring-graph';
import { buildOrbitLayout, type OrbitCompany, type OrbitFreelancer } from '../../../lib/hiring-map/hiring-orbit';
import { clamp, truncate } from '../../../lib/hiring-map/hiring-format';
import type { Arrival } from '../../../hooks/useHiringStream';

const ACCENT = '#38bdf8';
const SPRING = { type: 'spring', stiffness: 170, damping: 26 } as const;
const DIM = 0.14;

export interface HiringOrbitBoardProps {
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

export function HiringOrbitBoard({
  hires,
  categoryColors,
  width,
  height,
  todayStart,
  arrival = null,
  selection,
  onSelectionChange,
  categoryFilter = null,
}: HiringOrbitBoardProps) {
  const layout = useMemo(() => buildOrbitLayout(hires, { width, height }), [hires, width, height]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [badLogos, setBadLogos] = useState<ReadonlySet<string>>(() => new Set());
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const colorOf = (category: string) => categoryColors.get(category) ?? FALLBACK_COLOR;
  const { cx, cy, rx, ry, dotR, fontPx } = layout;

  // what stays bright: the hovered / selected node, the lines touching it and the nodes on the other end
  const focusId = selection?.id ?? hoverId;
  const focus = useMemo(() => {
    const nodes = new Set<string>();
    const links = new Set<string>();
    if (focusId) {
      nodes.add(focusId);
      for (const l of layout.links) {
        if (l.from === focusId || l.to === focusId) {
          links.add(l.id);
          nodes.add(l.from);
          nodes.add(l.to);
        }
      }
      return { nodes, links };
    }
    if (categoryFilter) {
      for (const f of layout.freelancers) if (f.category === categoryFilter) nodes.add(f.id);
      for (const l of layout.links) {
        if (nodes.has(l.from)) {
          links.add(l.id);
          nodes.add(l.to);
        }
      }
      return { nodes, links };
    }
    return null;
  }, [focusId, categoryFilter, layout]);

  const arrivalF = arrival ? `f${arrival.hire.freelancer.id}` : null;
  const arrivalC = arrival ? `c${arrival.hire.company.id}` : null;
  const arrivalLink = arrival ? `f${arrival.hire.freelancer.id}>c${arrival.hire.company.id}` : null;

  const toggle = (kind: GraphSelection['kind'], id: string) =>
    onSelectionChange(selection?.id === id ? null : { kind, id });
  const nodeOpacity = (id: string) => (focus && !focus.nodes.has(id) ? 0.22 : 1);

  const centreSize = Math.min(rx, ry);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }} onClick={() => onSelectionChange(null)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: 'absolute', inset: 0 }}
        role="img"
        aria-label="Freelancers hired by companies, drawn as an orbit"
      >
        {/* soft guides */}
        <g fill="none" stroke="#94a3b8" strokeOpacity={0.1} strokeWidth={1}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
          <ellipse cx={cx} cy={cy} rx={rx * 0.7} ry={ry * 0.7} strokeDasharray="2 7" />
          <ellipse cx={cx} cy={cy} rx={rx * 0.44} ry={ry * 0.44} strokeDasharray="2 7" />
        </g>

        {/* lines */}
        {layout.links.map((l) => {
          const color = colorOf(l.category);
          const today = l.latest >= todayStart;
          const fresh = l.id === arrivalLink;
          const dim = !!focus && !focus.links.has(l.id);
          const w = Math.max(1.4, dotR * 0.3) * (today ? 1.35 : 1) + (l.weight - 1) * 1.2;
          const d = `M${l.x1},${l.y1} Q${l.qx},${l.qy} ${l.x2},${l.y2}`;
          return (
            <g key={l.id} style={{ transition: 'opacity 200ms' }} opacity={dim ? DIM / 2 : 1}>
              {(fresh || (!!focus && !dim)) && (
                <motion.path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={w * 4}
                  strokeOpacity={0.16}
                  strokeLinecap="round"
                  initial={false}
                  animate={{ d }}
                  transition={SPRING}
                />
              )}
              <motion.path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={w}
                strokeLinecap="round"
                strokeOpacity={fresh ? 1 : today ? 0.9 : l.cross ? 0.55 : 0.5}
                initial={fresh ? { d, pathLength: 0 } : false}
                animate={{ d, pathLength: 1 }}
                transition={{ ...SPRING, pathLength: { duration: 1.1, ease: 'easeOut' } }}
              />
            </g>
          );
        })}

        {/* freelancers */}
        {layout.freelancers.map((f: OrbitFreelancer) => {
          const color = colorOf(f.category);
          const today = f.latest >= todayStart;
          const active = selection?.id === f.id;
          const glow = f.id === arrivalF;
          const tagged = glow || active || hoverId === f.id;
          const left = f.x < cx;
          return (
            <motion.g
              key={f.id}
              initial={{ opacity: 0, x: f.x, y: f.y }}
              animate={{ opacity: nodeOpacity(f.id), x: f.x, y: f.y }}
              transition={SPRING}
              style={{ cursor: 'pointer' }}
              data-node-id={f.id}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                toggle('freelancer', f.id);
              }}
              onMouseEnter={() => setHoverId(f.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              <title>{`${f.name} · ${f.jobTitle}`}</title>
              <circle r={dotR + 6} fill="transparent" />
              {glow && (
                <circle r={dotR} fill="none" stroke={ACCENT} strokeWidth={2}>
                  <animate attributeName="r" from={dotR} to={dotR * 3.2} dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.9" to="0" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                r={glow || active ? dotR * 1.35 : dotR}
                fill={color}
                stroke={active ? '#f8fafc' : today ? ACCENT : '#0f172a'}
                strokeWidth={active || today ? 2 : 1.5}
              />
              {tagged && (
                <text
                  x={left ? -(dotR + 7) : dotR + 7}
                  y={fontPx * 0.35}
                  textAnchor={left ? 'end' : 'start'}
                  fontSize={fontPx}
                  fontWeight={700}
                  fill="#f8fafc"
                  stroke="#020617"
                  strokeWidth={4}
                  paintOrder="stroke"
                  style={{ pointerEvents: 'none' }}
                >
                  {f.name}
                </text>
              )}
            </motion.g>
          );
        })}

        {/* companies */}
        {layout.companies.map((c: OrbitCompany) => {
          const today = c.latest >= todayStart;
          const active = selection?.id === c.id;
          const glow = c.id === arrivalC;
          const clip = `orb${uid}${c.entityId}`;
          const logo = c.logoUrl && !badLogos.has(c.id) ? c.logoUrl : null;
          // side labels run out to the edge of the pane; top / bottom labels must fit between their neighbours
          const room =
            c.label.anchor === 'start'
              ? width - (c.x + c.r + 10) - 8
              : c.label.anchor === 'end'
                ? c.x - c.r - 10 - 8
                : rx * ((Math.PI * 2) / layout.companies.length) * Math.abs(Math.sin(c.angle)) - 14;
          const maxChars = clamp(Math.floor(room / (fontPx * 0.6)), 7, 26);
          const lineH = fontPx * 1.25;
          return (
            <motion.g
              key={c.id}
              initial={{ opacity: 0, x: c.x, y: c.y }}
              animate={{ opacity: nodeOpacity(c.id), x: c.x, y: c.y }}
              transition={SPRING}
              style={{ cursor: 'pointer' }}
              data-node-id={c.id}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                toggle('company', c.id);
              }}
              onMouseEnter={() => setHoverId(c.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              <title>{c.name}</title>
              {glow && (
                <circle r={c.r} fill="none" stroke={ACCENT} strokeWidth={3}>
                  <animate attributeName="r" from={c.r} to={c.r * 2.6} dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.8" to="0" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              {(today || glow) && <circle r={c.r + 6} fill={ACCENT} opacity={0.14} />}
              <circle r={c.r} fill="#0f172a" stroke={active ? '#f8fafc' : today ? ACCENT : '#64748b'} strokeWidth={active ? 3 : 2} />
              {logo ? (
                <>
                  <clipPath id={clip}>
                    <circle r={c.r - 2} />
                  </clipPath>
                  <circle r={c.r - 2} fill="#fff" />
                  <image
                    href={logo}
                    x={-(c.r - 2)}
                    y={-(c.r - 2)}
                    width={(c.r - 2) * 2}
                    height={(c.r - 2) * 2}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#${clip})`}
                    onError={() => setBadLogos((prev) => new Set(prev).add(c.id))}
                  />
                </>
              ) : (
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={Math.max(10, c.r * 0.78)}
                  fontWeight={800}
                  fill={today ? ACCENT : '#cbd5e1'}
                  style={{ pointerEvents: 'none' }}
                >
                  {c.initials}
                </text>
              )}
              <g style={{ pointerEvents: 'none' }}>
                <text
                  x={c.label.dx}
                  y={c.label.dy + fontPx}
                  textAnchor={c.label.anchor}
                  fontSize={fontPx}
                  fontWeight={700}
                  fill="#f1f5f9"
                  stroke="#020617"
                  strokeWidth={4}
                  paintOrder="stroke"
                >
                  {truncate(c.name, maxChars)}
                </text>
                <text
                  x={c.label.dx}
                  y={c.label.dy + fontPx + lineH}
                  textAnchor={c.label.anchor}
                  fontSize={fontPx * 0.82}
                  fontWeight={600}
                  fill={today ? ACCENT : '#94a3b8'}
                  stroke="#020617"
                  strokeWidth={4}
                  paintOrder="stroke"
                >
                  {c.hireCount} {c.hireCount === 1 ? 'hire' : 'hires'}
                  {c.hiddenMembers > 0 ? `  ·  +${c.hiddenMembers} more` : ''}
                </text>
              </g>
              {/* big, invisible target so hubs are easy to hit from a distance */}
              <circle r={c.r + 8} fill="transparent" />
            </motion.g>
          );
        })}
      </svg>

      {/* running total in the middle */}
      <div
        style={{
          position: 'absolute',
          left: cx,
          top: cy,
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          color: '#f1f5f9',
        }}
      >
        <div style={{ fontSize: Math.max(28, centreSize * 0.3), fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {layout.totalHires}
        </div>
        <div style={{ marginTop: 6, fontSize: Math.max(11, centreSize * 0.065), letterSpacing: '0.22em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
          hires
        </div>
        <div style={{ marginTop: 4, fontSize: Math.max(11, centreSize * 0.055), color: '#64748b' }}>
          {layout.totalCompanies} {layout.totalCompanies === 1 ? 'company' : 'companies'}
          {layout.totalCompanies > layout.companies.length ? ` · ${layout.companies.length} shown` : ''}
        </div>
      </div>
    </div>
  );
}

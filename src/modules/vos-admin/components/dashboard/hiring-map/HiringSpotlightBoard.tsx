// src/modules/vos-admin/components/dashboard/hiring-map/HiringSpotlightBoard.tsx
//
// Design D, "Spotlight": the newest hire gets the whole top half (big avatars, a big
// glowing line between freelancer and company), and the hires before it sit below as
// compact pairs with their own line. Built for a TV in a lobby: one thing to look at,
// readable from across the room.
//
// Styled with inline styles on purpose (no Tailwind dependency, easy to restyle).
'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GraphSelection, HireEvent } from '../../../types/hiring-map.types';
import { FALLBACK_COLOR, categoryOf } from '../../../lib/hiring-map/hiring-graph';
import { clamp, hireTime, initialsOf, timeAgo } from '../../../lib/hiring-map/hiring-format';
import type { Arrival } from '../../../hooks/useHiringStream';

const ACCENT = '#38bdf8';
const SPRING = { type: 'spring', stiffness: 220, damping: 28 } as const;

export interface HiringSpotlightBoardProps {
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

const ellipsis: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const bare: React.CSSProperties = { background: 'none', border: 0, padding: 0, margin: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'inherit' };

function Avatar({ text, color, size, src, ring = 2 }: { text: string; color: string; size: number; src?: string | null; ring?: number }) {
  const [ok, setOk] = useState(true);
  const showImg = !!src && ok;
  return (
    <span
      style={{
        flex: '0 0 auto',
        width: size,
        height: size,
        borderRadius: '9999px',
        display: 'grid',
        placeItems: 'center',
        background: showImg ? '#fff' : `${color}33`,
        color,
        border: `${ring}px solid ${color}`,
        fontWeight: 800,
        fontSize: size * 0.34,
        overflow: 'hidden',
      }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src ?? ''} alt="" onError={() => setOk(false)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        text
      )}
    </span>
  );
}

/** A glowing line with a dot at each end and a spark that travels from the freelancer to the company. */
function Wire({ color, thick, live, today }: { color: string; thick: number; live?: boolean; today?: boolean }) {
  const dot = thick * 2.6;
  return (
    <div style={{ position: 'relative', flex: '1 1 0', minWidth: 24, height: dot, display: 'flex', alignItems: 'center' }}>
      <motion.div
        initial={live ? { scaleX: 0 } : false}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: thick,
          borderRadius: thick,
          transformOrigin: 'left center',
          background: `linear-gradient(90deg, ${color}, ${today || live ? ACCENT : color})`,
          opacity: live ? 1 : today ? 0.9 : 0.55,
          boxShadow: live ? `0 0 ${thick * 5}px ${color}` : 'none',
        }}
      />
      <span style={{ position: 'absolute', left: 0, width: dot, height: dot, borderRadius: '9999px', background: color }} />
      <span style={{ position: 'absolute', right: 0, width: dot, height: dot, borderRadius: '9999px', background: today || live ? ACCENT : color }} />
      {live && (
        <motion.span
          initial={{ left: '0%' }}
          animate={{ left: ['0%', '100%'] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute',
            width: dot * 1.2,
            height: dot * 1.2,
            marginLeft: -dot * 0.6,
            borderRadius: '9999px',
            background: '#fff',
            boxShadow: `0 0 ${dot * 2}px ${ACCENT}`,
          }}
        />
      )}
    </div>
  );
}

export function HiringSpotlightBoard({
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
}: HiringSpotlightBoardProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const colorOf = (category: string) => categoryColors.get(category) ?? FALLBACK_COLOR;

  const newest = useMemo(
    () => [...hires].sort((a, b) => hireTime(b) - hireTime(a) || (a.hireId < b.hireId ? 1 : -1)),
    [hires],
  );
  const companyHires = useMemo(() => {
    const m = new Map<number, number>();
    for (const h of hires) m.set(h.company.id, (m.get(h.company.id) ?? 0) + 1);
    return m;
  }, [hires]);

  const hero = arrival?.hire ?? newest[0] ?? null;
  const u = clamp(Math.min(width / 1100, height / 720), 0.7, 2.4); // one unit for every size below
  const heroH = clamp(height * 0.42, 180, 520);
  const avatar = clamp(Math.min(heroH * 0.44, width * 0.19), 48, 200);

  const cols = clamp(Math.floor(width / (330 * Math.max(u, 0.9))), 1, 4);
  const pairH = 92 * u;
  const gap = 12 * u;
  const listH = Math.max(0, height - heroH - 28 * u);
  const rows = Math.max(1, Math.floor((listH + gap) / (pairH + gap)));
  const list = newest.filter((h) => h.hireId !== hero?.hireId).slice(0, cols * rows);

  const focusId = selection?.id ?? hoverId;
  const toggle = (kind: GraphSelection['kind'], id: string) =>
    onSelectionChange(selection?.id === id ? null : { kind, id });

  const bright = (h: HireEvent) => {
    if (focusId) return focusId === `f${h.freelancer.id}` || focusId === `c${h.company.id}`;
    if (categoryFilter) return categoryOf(h) === categoryFilter;
    return true;
  };

  if (!hero) return null;
  const heroColor = colorOf(categoryOf(hero));
  const heroFid = `f${hero.freelancer.id}`;
  const heroCid = `c${hero.company.id}`;
  const heroLive = !!arrival && arrival.hire.hireId === hero.hireId;
  const heroToday = hireTime(hero) >= todayStart;

  const enter = (id: string) => ({ onMouseEnter: () => setHoverId(id), onMouseLeave: () => setHoverId(null) });

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      onClick={() => onSelectionChange(null)}
    >
      {/* ───────── hero ───────── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={hero.hireId}
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: bright(hero) ? 1 : 0.25, y: 0 }}
          exit={{ opacity: 0, y: -18, transition: { duration: 0.2 } }}
          transition={SPRING}
          style={{
            flex: '0 0 auto',
            height: heroH,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Math.min(28 * u, width * 0.03),
            padding: `${34 * u}px ${Math.min(36 * u, width * 0.04)}px 0`,
          }}
          data-hero={hero.hireId}
        >
          <button
            type="button"
            style={{ ...bare, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 * u, flex: '0 1 30%', minWidth: 0 }}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              toggle('freelancer', heroFid);
            }}
            {...enter(heroFid)}
          >
            <Avatar text={initialsOf(hero.freelancer.displayName)} color={heroColor} size={avatar} ring={Math.max(3, u * 3)} />
            <span style={{ ...ellipsis, maxWidth: '100%', fontSize: 30 * u, fontWeight: 800, color: '#f8fafc' }}>{hero.freelancer.displayName}</span>
            <span style={{ ...ellipsis, maxWidth: '100%', fontSize: 15 * u, color: heroColor, fontWeight: 600 }}>{categoryOf(hero)}</span>
          </button>

          <div style={{ flex: '1 1 0', maxWidth: 620 * u, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12 * u }}>
            <span
              style={{
                alignSelf: 'center',
                padding: `${4 * u}px ${14 * u}px`,
                borderRadius: 9999,
                border: `1px solid ${heroLive ? 'rgba(56,189,248,0.6)' : 'rgba(255,255,255,0.12)'}`,
                background: heroLive ? 'rgba(56,189,248,0.14)' : 'rgba(255,255,255,0.05)',
                color: heroLive ? ACCENT : '#94a3b8',
                fontSize: 12 * u,
                fontWeight: 700,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              {heroLive ? 'Just hired' : 'Latest hire'}
            </span>
            <Wire color={heroColor} thick={Math.max(4, 6 * u)} live={heroLive} today={heroToday} />
            <span style={{ ...ellipsis, textAlign: 'center', fontSize: 18 * u, fontWeight: 600, color: '#e2e8f0' }}>{hero.jobTitle}</span>
            <span style={{ textAlign: 'center', fontSize: 13 * u, color: '#64748b' }}>{timeAgo(hireTime(hero), now)}</span>
          </div>

          <button
            type="button"
            style={{ ...bare, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 * u, flex: '0 1 30%', minWidth: 0 }}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              toggle('company', heroCid);
            }}
            {...enter(heroCid)}
          >
            <Avatar text={initialsOf(hero.company.name)} color={heroToday ? ACCENT : '#94a3b8'} size={avatar} src={hero.company.logoUrl} ring={Math.max(3, u * 3)} />
            <span style={{ ...ellipsis, maxWidth: '100%', fontSize: 30 * u, fontWeight: 800, color: '#f8fafc' }}>{hero.company.name}</span>
            <span style={{ fontSize: 15 * u, color: '#94a3b8', fontWeight: 600 }}>
              {companyHires.get(hero.company.id) ?? 1} {(companyHires.get(hero.company.id) ?? 1) === 1 ? 'hire' : 'hires'}
            </span>
          </button>
        </motion.div>
      </AnimatePresence>

      {/* ───────── earlier hires ───────── */}
      <div
        style={{
          flex: '1 1 0',
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridAutoRows: pairH,
          alignContent: 'start',
          gap,
          padding: `${14 * u}px ${28 * u}px ${20 * u}px`,
          overflow: 'hidden',
        }}
      >
        {list.map((h) => {
          const fid = `f${h.freelancer.id}`;
          const cid = `c${h.company.id}`;
          const color = colorOf(categoryOf(h));
          const today = hireTime(h) >= todayStart;
          const lit = bright(h);
          return (
            <motion.div
              key={h.hireId}
              layout="position"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: lit ? 1 : 0.2, scale: 1 }}
              transition={SPRING}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8 * u,
                padding: `0 ${12 * u}px`,
                borderRadius: 16 * u,
                border: `1px solid ${today ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.08)'}`,
                background: 'linear-gradient(180deg, rgba(30,41,59,0.7), rgba(15,23,42,0.8))',
                boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                minWidth: 0,
              }}
              data-hire={h.hireId}
            >
              <button
                type="button"
                style={{ ...bare, display: 'flex', alignItems: 'center', gap: 8 * u, flex: '1 1 0', minWidth: 0 }}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  toggle('freelancer', fid);
                }}
                {...enter(fid)}
              >
                <Avatar text={initialsOf(h.freelancer.displayName)} color={color} size={38 * u} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ ...ellipsis, display: 'block', fontSize: 14.5 * u, fontWeight: 700, color: '#f1f5f9' }}>{h.freelancer.displayName}</span>
                  <span style={{ ...ellipsis, display: 'block', fontSize: 11.5 * u, color: '#94a3b8' }}>{h.jobTitle}</span>
                </span>
              </button>

              <span style={{ flex: '0 1 12%', minWidth: 54 * u, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 3 * u }}>
                <Wire color={color} thick={Math.max(2, 2.5 * u)} today={today} />
                <span style={{ textAlign: 'center', fontSize: 10.5 * u, color: '#64748b', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{timeAgo(hireTime(h), now)}</span>
              </span>

              <button
                type="button"
                style={{ ...bare, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 * u, flex: '1 1 0', minWidth: 0, textAlign: 'right' }}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  toggle('company', cid);
                }}
                {...enter(cid)}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ ...ellipsis, display: 'block', fontSize: 15 * u, fontWeight: 700, color: '#f1f5f9' }}>{h.company.name}</span>
                  <span style={{ display: 'block', fontSize: 11.5 * u, color: today ? ACCENT : '#94a3b8', fontWeight: 600 }}>
                    {companyHires.get(h.company.id) ?? 1} {(companyHires.get(h.company.id) ?? 1) === 1 ? 'hire' : 'hires'}
                  </span>
                </span>
                <Avatar text={initialsOf(h.company.name)} color={today ? ACCENT : '#94a3b8'} size={38 * u} src={h.company.logoUrl} />
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

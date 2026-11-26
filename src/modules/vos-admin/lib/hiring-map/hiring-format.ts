// src/modules/vos-admin/lib/hiring-map/hiring-format.ts
import type { HireEvent } from '../../types/hiring-map.types';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export type TimeRange = 'today' | '7d' | 'all';

export const TIME_RANGES: ReadonlyArray<{ value: TimeRange; label: string; key: string }> = [
  { value: 'today', label: 'Today', key: '1' },
  { value: '7d', label: '7 days', key: '2' },
  { value: 'all', label: 'All time', key: '3' },
];

/** epoch ms of a hire (0 if the timestamp is invalid). */
export function hireTime(hire: HireEvent): number {
  const t = Date.parse(hire.hiredAt);
  return Number.isNaN(t) ? 0 : t;
}

/** Midnight in the browser's local time zone. */
export function startOfLocalDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Inclusive lower bound for a range; -Infinity means "no lower bound". */
export function rangeStart(range: TimeRange, todayStart: number): number {
  if (range === 'today') return todayStart;
  if (range === '7d') return todayStart - 6 * DAY;
  return Number.NEGATIVE_INFINITY;
}

export function timeAgo(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  if (diff < 45_000) return 'just now';
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MINUTE))}m ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)}h ago`;
  return `${Math.round(diff / DAY)}d ago`;
}

/** "Ana G." -> "AG", "Brightwave Labs" -> "BL", "Acme" -> "AC" */
export function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Privacy trim used by the API layer: "Ana Marie", "Garcia" -> "Ana G."
 * Only first name + last initial ever leave the server.
 */
export function toDisplayName(first?: string | null, last?: string | null): string {
  const firstName = (first ?? '').trim().split(/\s+/)[0] ?? '';
  const lastInitial = [...(last ?? '').trim()][0];
  const name = [firstName, lastInitial ? `${lastInitial.toUpperCase()}.` : ''].filter(Boolean).join(' ');
  return name || 'Freelancer';
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}


// src/modules/vos-admin/lib/hiring-map/hiring-orbit.ts
//
// Layout for the "Orbit" design: companies sit on an ellipse, the freelancers they
// hired sit in small groups on the inside, and the middle stays free for a big
// counter. The whole picture always fits the pane, so nothing needs panning on a TV.
// Pure and deterministic; the component only draws what this returns.
import type { HireEvent } from '../../types/hiring-map.types';
import { categoryOf } from './hiring-graph';
import { clamp, hireTime, initialsOf } from './hiring-format';

export interface OrbitCompany {
  /** "c42" */
  id: string;
  entityId: number;
  name: string;
  logoUrl: string | null;
  initials: string;
  /** hires in the current range */
  hireCount: number;
  latest: number;
  /** freelancers whose group is this company but did not fit on screen */
  hiddenMembers: number;
  /** radius of the node */
  r: number;
  /** angle on the ellipse (radians, 0 = right, clockwise) */
  angle: number;
  x: number;
  y: number;
  /** label box, relative to (x, y) */
  label: { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' };
}

export interface OrbitFreelancer {
  /** "f17" */
  id: string;
  entityId: number;
  name: string;
  category: string;
  jobTitle: string;
  latest: number;
  /** "c42": the company whose group the dot sits in (their first hire) */
  home: string;
  x: number;
  y: number;
}

export interface OrbitLink {
  /** "f17>c42" – same scheme as the network graph's edges */
  id: string;
  from: string;
  to: string;
  category: string;
  weight: number;
  latest: number;
  /** a freelancer hired by a company other than their group's */
  cross: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** quadratic control point (the middle of the line for ordinary links, pulled towards the centre for cross links) */
  qx: number;
  qy: number;
}

export interface OrbitLayout {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  companies: OrbitCompany[];
  freelancers: OrbitFreelancer[];
  links: OrbitLink[];
  dotR: number;
  fontPx: number;
  totalHires: number;
  /** companies with hires in range, including those that did not fit on the ring */
  totalCompanies: number;
  maxCompanyHires: number;
}

export interface OrbitOptions {
  width: number;
  height: number;
  /** hard cap on companies on the ring; the size of the pane decides the rest */
  maxCompanies?: number;
  /** freelancers drawn per company */
  maxMembers?: number;
}

const PER_ROW = 3;

export function buildOrbitLayout(
  hires: readonly HireEvent[],
  { width, height, maxCompanies, maxMembers = 9 }: OrbitOptions,
): OrbitLayout {
  const fontPx = clamp(Math.min(width, height) * 0.024, 11, 24);
  const labelW = clamp(width * 0.17, 120, 240);
  const padY = clamp(height * 0.1, 54, 96);
  const rx = Math.max(80, width / 2 - labelW - 24);
  const ry = Math.max(80, height / 2 - padY - 24);
  const cx = width / 2;
  const cy = height / 2;
  const perimeter = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
  const cap = maxCompanies ?? clamp(Math.floor(perimeter / 96), 6, 28);

  // oldest first, so "first hire" and "latest hire" are easy to read off
  const ascending = [...hires].sort((a, b) => hireTime(a) - hireTime(b) || (a.hireId < b.hireId ? -1 : 1));

  const agg = new Map<number, { hire: HireEvent; count: number; latest: number }>();
  for (const hire of ascending) {
    const t = hireTime(hire);
    const c = agg.get(hire.company.id);
    if (c) {
      c.count += 1;
      c.latest = Math.max(c.latest, t);
      c.hire = hire;
    } else {
      agg.set(hire.company.id, { hire, count: 1, latest: t });
    }
  }

  // the most recently active companies, then a stable order around the ring (by id)
  const chosen = [...agg.entries()]
    .sort((a, b) => b[1].latest - a[1].latest || a[0] - b[0])
    .slice(0, cap)
    .map(([id]) => id)
    .sort((a, b) => a - b);
  const n = chosen.length;

  const base = {
    cx,
    cy,
    rx,
    ry,
    fontPx,
    totalHires: hires.length,
    totalCompanies: agg.size,
    maxCompanyHires: Math.max(1, ...[...agg.values()].map((c) => c.count)),
  };
  if (n === 0) return { ...base, companies: [], freelancers: [], links: [], dotR: 6 };

  const dt = (2 * Math.PI) / n;
  const arc = perimeter / n;
  const nodeR = Math.min(clamp(Math.min(rx, ry) * 0.075, 14, 30), arc * 0.28);
  const maxCount = base.maxCompanyHires;
  const shown = new Set(chosen);

  const companies: OrbitCompany[] = chosen.map((cid, i) => {
    const a = agg.get(cid)!;
    const angle = -Math.PI / 2 + (i + 0.5) * dt;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const r = nodeR * (0.8 + 0.32 * Math.sqrt(a.count / maxCount));
    const x = cx + rx * cos;
    const y = cy + ry * sin;
    const lineH = fontPx * 1.25;
    const blockH = lineH * 2;
    let label: OrbitCompany['label'];
    if (cos > 0.35) label = { dx: r + 10, dy: -blockH / 2, anchor: 'start' };
    else if (cos < -0.35) label = { dx: -(r + 10), dy: -blockH / 2, anchor: 'end' };
    else if (sin < 0) label = { dx: 0, dy: -(r + 8 + blockH), anchor: 'middle' };
    else label = { dx: 0, dy: r + 8, anchor: 'middle' };
    return {
      id: `c${cid}`,
      entityId: cid,
      name: a.hire.company.name,
      logoUrl: a.hire.company.logoUrl,
      initials: initialsOf(a.hire.company.name),
      hireCount: a.count,
      latest: a.latest,
      hiddenMembers: 0,
      r,
      angle,
      x,
      y,
      label,
    };
  });
  const byEntity = new Map(companies.map((c) => [c.entityId, c] as const));

  // a freelancer's group is the first (shown) company that hired them
  const home = new Map<number, number>();
  const info = new Map<number, { name: string; category: string; jobTitle: string; latest: number }>();
  for (const hire of ascending) {
    if (!shown.has(hire.company.id)) continue;
    const fid = hire.freelancer.id;
    if (!home.has(fid)) home.set(fid, hire.company.id);
    info.set(fid, {
      name: hire.freelancer.displayName,
      category: categoryOf(hire),
      jobTitle: hire.jobTitle,
      latest: hireTime(hire),
    });
  }

  const members = new Map<number, number[]>();
  for (const [fid, cid] of home) {
    const list = members.get(cid) ?? [];
    list.push(fid);
    members.set(cid, list);
  }

  // dots: rows of up to PER_ROW across the company's slice of the inner ring, the newest nearest the company
  // the innermost row is the tightest, so size the dots for it
  const biggest = Math.min(maxMembers, Math.max(1, ...[...members.values()].map((m) => m.length)));
  const rowsNeeded = Math.ceil(biggest / PER_ROW);
  const sInner = Math.max(0.3, 0.7 - (rowsNeeded - 1) * 0.13);
  const sepAng = Math.min(rx, ry) * sInner * ((dt * 0.78) / PER_ROW);
  const sepRad = Math.min(rx, ry) * 0.13;
  const dotR = clamp(Math.min(sepAng, sepRad) * 0.5, 4, 12);

  const freelancers: OrbitFreelancer[] = [];
  for (const company of companies) {
    const all = (members.get(company.entityId) ?? []).sort(
      (a, b) => (info.get(b)?.latest ?? 0) - (info.get(a)?.latest ?? 0) || b - a,
    );
    const list = all.slice(0, maxMembers);
    company.hiddenMembers = all.length - list.length;
    const k = list.length;
    const perRow = Math.min(k, PER_ROW);
    list.forEach((fid, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const inRow = Math.min(perRow, k - row * perRow);
      const off = inRow > 1 ? (col - (inRow - 1) / 2) * ((dt * 0.78) / PER_ROW) : 0;
      const s = Math.max(0.3, 0.7 - row * 0.13);
      const t = company.angle + off;
      const f = info.get(fid)!;
      freelancers.push({
        id: `f${fid}`,
        entityId: fid,
        name: f.name,
        category: f.category,
        jobTitle: f.jobTitle,
        latest: f.latest,
        home: company.id,
        x: cx + rx * s * Math.cos(t),
        y: cy + ry * s * Math.sin(t),
      });
    });
  }
  const dots = new Map(freelancers.map((f) => [f.entityId, f] as const));

  // one line per freelancer/company pair (re-hires make it thicker)
  const pairs = new Map<string, { fid: number; cid: number; category: string; weight: number; latest: number }>();
  for (const hire of ascending) {
    if (!dots.has(hire.freelancer.id) || !byEntity.has(hire.company.id)) continue;
    const key = `${hire.freelancer.id}:${hire.company.id}`;
    const t = hireTime(hire);
    const p = pairs.get(key);
    if (p) {
      p.weight += 1;
      p.latest = Math.max(p.latest, t);
    } else {
      pairs.set(key, { fid: hire.freelancer.id, cid: hire.company.id, category: categoryOf(hire), weight: 1, latest: t });
    }
  }

  const links: OrbitLink[] = [...pairs.values()].map((p) => {
    const f = dots.get(p.fid)!;
    const c = byEntity.get(p.cid)!;
    const cross = f.home !== c.id;
    const mx = (f.x + c.x) / 2;
    const my = (f.y + c.y) / 2;
    return {
      id: `f${p.fid}>c${p.cid}`,
      from: f.id,
      to: c.id,
      category: p.category,
      weight: p.weight,
      latest: p.latest,
      cross,
      x1: f.x,
      y1: f.y,
      x2: c.x,
      y2: c.y,
      qx: cross ? cx + (mx - cx) * 0.25 : mx,
      qy: cross ? cy + (my - cy) * 0.25 : my,
    };
  });

  return { ...base, companies, freelancers, links, dotR };
}

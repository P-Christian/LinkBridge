// src/modules/vos-admin/lib/hiring-map/hiring-flow.ts
//
// Layout for the "Flow board" design: the most recent freelancers in a column on
// the left, the companies that hired them on the right, a ribbon per hire in
// between. Pure and deterministic; the component only draws what this returns.
import type { HireEvent } from '../../types/hiring-map.types';
import { categoryOf } from './hiring-graph';
import { clamp, hireTime, initialsOf } from './hiring-format';

export interface FlowFreelancer {
  /** graph-style id: "f17" (shared with the network design and the detail panel) */
  id: string;
  entityId: number;
  name: string;
  category: string;
  jobTitle: string;
  /** epoch ms of their latest hire */
  latest: number;
  /** top of the card */
  y: number;
}

export interface FlowCompany {
  /** "c42" */
  id: string;
  entityId: number;
  name: string;
  logoUrl: string | null;
  initials: string;
  /** hires in the current range (not only the ones drawn) */
  hireCount: number;
  latest: number;
  y: number;
}

export interface FlowLink {
  /** "f17>c42" – same scheme as the network graph's edges */
  id: string;
  from: string;
  to: string;
  category: string;
  weight: number;
  latest: number;
  /** vertical centres of the two cards */
  y1: number;
  y2: number;
}

export interface FlowLayout {
  freelancers: FlowFreelancer[];
  companies: FlowCompany[];
  links: FlowLink[];
  cardW: number;
  cardH: number;
  leftX: number;
  rightX: number;
  /** x where a ribbon leaves the left card / enters the right card */
  x1: number;
  x2: number;
  top: number;
  maxCompanyHires: number;
}

export interface FlowOptions {
  width: number;
  height: number;
  /** hard cap on rows; the height decides the rest */
  maxRows?: number;
}

const PAD_X = 28;
const TOP = 70; // room for the column titles
const PAD_BOTTOM = 24;
const MIN_ROW_H = 64;
const MAX_ROW_H = 96;

export function buildFlowLayout(hires: readonly HireEvent[], { width, height, maxRows = 14 }: FlowOptions): FlowLayout {
  const usable = Math.max(120, height - TOP - PAD_BOTTOM);
  const rows = clamp(Math.floor(usable / MIN_ROW_H), 3, maxRows);
  const cardW = clamp(width * 0.27, 190, 400);
  const leftX = PAD_X;
  const rightX = Math.max(leftX + cardW + 80, width - PAD_X - cardW);

  const newestFirst = [...hires].sort((a, b) => hireTime(b) - hireTime(a) || (a.hireId < b.hireId ? 1 : -1));

  // 1. left column: the most recent distinct freelancers
  const people = new Map<number, { hire: HireEvent; latest: number }>();
  for (const hire of newestFirst) {
    if (people.size >= rows) break;
    if (!people.has(hire.freelancer.id)) people.set(hire.freelancer.id, { hire, latest: hireTime(hire) });
  }

  const n = Math.max(people.size, 1);
  const rowH = Math.min(usable / Math.max(n, 4), MAX_ROW_H);
  const cardH = Math.max(40, rowH - 10);

  const freelancers: FlowFreelancer[] = [...people.values()].map(({ hire, latest }, i) => ({
    id: `f${hire.freelancer.id}`,
    entityId: hire.freelancer.id,
    name: hire.freelancer.displayName,
    category: categoryOf(hire),
    jobTitle: hire.jobTitle,
    latest,
    y: TOP + i * rowH + (rowH - cardH) / 2,
  }));
  const leftCentre = new Map(freelancers.map((f) => [f.entityId, f.y + cardH / 2] as const));

  // 2. ribbons: every hire of those freelancers, merged per pair
  const pairs = new Map<string, { fid: number; cid: number; category: string; weight: number; latest: number }>();
  const companyAgg = new Map<number, { hire: HireEvent; hireCount: number; latest: number }>();
  for (const hire of newestFirst) {
    const c = companyAgg.get(hire.company.id);
    if (c) c.hireCount += 1;
    else companyAgg.set(hire.company.id, { hire, hireCount: 1, latest: hireTime(hire) });
    if (!leftCentre.has(hire.freelancer.id)) continue;
    const key = `${hire.freelancer.id}:${hire.company.id}`;
    const pair = pairs.get(key);
    if (pair) {
      pair.weight += 1;
      pair.latest = Math.max(pair.latest, hireTime(hire));
    } else {
      pairs.set(key, { fid: hire.freelancer.id, cid: hire.company.id, category: categoryOf(hire), weight: 1, latest: hireTime(hire) });
    }
  }

  // 3. right column: companies that appear in a ribbon, newest first, capped at `rows`
  const linked = new Map<number, number[]>(); // company -> centres of its freelancers
  for (const p of pairs.values()) {
    const list = linked.get(p.cid) ?? [];
    list.push(leftCentre.get(p.fid) ?? 0);
    linked.set(p.cid, list);
  }
  const chosen = [...linked.keys()]
    .sort((a, b) => (companyAgg.get(b)?.latest ?? 0) - (companyAgg.get(a)?.latest ?? 0))
    .slice(0, rows);

  // sit each company near the average height of its freelancers (fewer crossings), then push apart
  const gap = cardH + 10;
  const wanted = chosen
    .map((cid) => {
      const ys = linked.get(cid) ?? [];
      return { cid, y: ys.reduce((a, b) => a + b, 0) / Math.max(ys.length, 1) - cardH / 2 };
    })
    .sort((a, b) => a.y - b.y || a.cid - b.cid);
  const bottomLimit = TOP + usable - cardH;
  for (let i = 0; i < wanted.length; i++) {
    wanted[i].y = Math.max(wanted[i].y, TOP, i > 0 ? wanted[i - 1].y + gap : TOP);
  }
  for (let i = wanted.length - 1; i >= 0; i--) {
    wanted[i].y = Math.min(wanted[i].y, i === wanted.length - 1 ? bottomLimit : wanted[i + 1].y - gap);
  }

  const companies: FlowCompany[] = wanted.map(({ cid, y }) => {
    const agg = companyAgg.get(cid)!;
    return {
      id: `c${cid}`,
      entityId: cid,
      name: agg.hire.company.name,
      logoUrl: agg.hire.company.logoUrl,
      initials: initialsOf(agg.hire.company.name),
      hireCount: agg.hireCount,
      latest: agg.latest,
      y,
    };
  });
  const rightCentre = new Map(companies.map((c) => [c.entityId, c.y + cardH / 2] as const));

  const links: FlowLink[] = [...pairs.values()]
    .filter((p) => rightCentre.has(p.cid))
    .map((p) => ({
      id: `f${p.fid}>c${p.cid}`,
      from: `f${p.fid}`,
      to: `c${p.cid}`,
      category: p.category,
      weight: p.weight,
      latest: p.latest,
      y1: leftCentre.get(p.fid) ?? 0,
      y2: rightCentre.get(p.cid) ?? 0,
    }));

  return {
    freelancers,
    companies,
    links,
    cardW,
    cardH,
    leftX,
    rightX,
    x1: leftX + cardW,
    x2: rightX,
    top: TOP,
    maxCompanyHires: Math.max(1, ...companies.map((c) => c.hireCount)),
  };
}

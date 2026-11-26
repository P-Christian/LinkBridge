// src/modules/vos-admin/lib/hiring-map/hiring-graph.ts
//
// Pure, deterministic layout for the hiring network. No physics loop, no React.
//
//  • Each company is a hub. Freelancers sit on concentric rings around the hub
//    they were FIRST hired by, so a hub's size shows how many people it hired.
//  • A freelancer hired by a second company keeps their place and gets a second
//    line to that company's hub (this is what makes the cross-links).
//  • Slots are fixed per member index, so adding a hire never moves anybody who
//    is already on screen. Only hub positions are re-balanced (and animated).
//
import type {
  CategoryCount,
  CompanyNode,
  FitBox,
  FreelancerNode,
  GraphEdge,
  HireEvent,
  HiringGraph,
  ViewBox,
} from '../../types/hiring-map.types';
import { clamp, hireTime, initialsOf, truncate } from './hiring-format';

// ── geometry (world units; the camera fits whatever results) ──
export const COMPANY_R = 20;
export const DOT_R = 5.5;
const RING0 = 44; // first ring radius
const RING_GAP = 22;
const RING_DENSITY = 0.17; // slots per unit of ring radius (golden-angle placement needs slack)
const CLUSTER_PAD = 12;
const COLLISION_PAD = 14;
const MIN_VB_W = 480;
const FIT_PAD = 0.13;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TWO_PI = Math.PI * 2;

// hub placement
const BASE_AREA = 300_000;
const AREA_SLACK = 1.7;
const RELAX_ITERATIONS = 320;
const RELAX_SETTLE = 90; // final iterations with collision only (no pull-back)
const RELAX_PULL = 0.015;

export const FALLBACK_CATEGORY = 'Other';
export const FALLBACK_COLOR = '#94a3b8';

/** Bright on a dark screen, distinguishable from each other. */
export const CATEGORY_PALETTE: readonly string[] = [
  '#38bdf8', // sky
  '#a78bfa', // violet
  '#34d399', // emerald
  '#fbbf24', // amber
  '#f472b6', // pink
  '#fb923c', // orange
  '#22d3ee', // cyan
  '#a3e635', // lime
  '#f87171', // red
  '#818cf8', // indigo
  '#2dd4bf', // teal
  '#e879f9', // fuchsia
];

export function categoryOf(hire: HireEvent): string {
  return hire.freelancer.category?.trim() || FALLBACK_CATEGORY;
}

function byTime(a: HireEvent, b: HireEvent): number {
  const dt = hireTime(a) - hireTime(b);
  if (dt !== 0) return dt;
  return a.hireId < b.hireId ? -1 : a.hireId > b.hireId ? 1 : 0;
}

/**
 * Category → colour, assigned in order of first appearance over ALL hires so a
 * category keeps its colour when the time-range filter changes.
 */
export function buildCategoryColors(hires: readonly HireEvent[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const hire of [...hires].sort(byTime)) {
    const category = categoryOf(hire);
    if (!colors.has(category)) colors.set(category, CATEGORY_PALETTE[colors.size % CATEGORY_PALETTE.length]);
  }
  return colors;
}

// ── ring slots ──

function ringRadius(ring: number): number {
  return RING0 + (ring - 1) * RING_GAP;
}

function ringCapacity(ring: number): number {
  return Math.max(5, Math.floor(RING_DENSITY * ringRadius(ring)));
}

function slotFor(memberIndex: number): { ring: number; index: number } {
  let remaining = memberIndex;
  let ring = 1;
  while (remaining >= ringCapacity(ring)) {
    remaining -= ringCapacity(ring);
    ring += 1;
  }
  return { ring, index: remaining };
}

function clusterRadiusFor(memberCount: number): number {
  if (memberCount === 0) return COMPANY_R + 30;
  return ringRadius(slotFor(memberCount - 1).ring) + DOT_R + CLUSTER_PAD;
}

function hash01(n: number): number {
  let x = (n | 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function quantizeUp(value: number, base: number, step: number): number {
  if (value <= base) return base;
  return base * Math.pow(step, Math.ceil(Math.log(value / base) / Math.log(step)));
}

function relaxHubs(slotX: number[], slotY: number[], radii: number[]): { x: number[]; y: number[] } {
  const n = slotX.length;
  const x = slotX.slice();
  const y = slotY.slice();
  for (let it = 0; it < RELAX_ITERATIONS; it++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = x[j] - x[i];
        let dy = y[j] - y[i];
        let d = Math.hypot(dx, dy);
        const min = radii[i] + radii[j] + COLLISION_PAD;
        if (d >= min) continue;
        if (d < 1e-6) {
          const a = (i * 31 + j * 17) * GOLDEN_ANGLE;
          dx = Math.cos(a);
          dy = Math.sin(a);
          d = 1;
        }
        const push = (min - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        x[i] -= ux * push;
        y[i] -= uy * push;
        x[j] += ux * push;
        y[j] += uy * push;
      }
    }
    if (it < RELAX_ITERATIONS - RELAX_SETTLE) {
      for (let i = 0; i < n; i++) {
        x[i] += (slotX[i] - x[i]) * RELAX_PULL;
        y[i] += (slotY[i] - y[i]) * RELAX_PULL;
      }
    }
  }
  return { x, y };
}

// ── aggregation ──

interface FreelancerAgg {
  id: number;
  name: string;
  category: string;
  primaryCompanyId: number;
  hireCount: number;
  latest: number;
}

interface CompanyAgg {
  id: number;
  name: string;
  logoUrl: string | null;
  hireCount: number;
  latest: number;
  members: FreelancerAgg[];
}

interface EdgeAgg {
  freelancerId: number;
  companyId: number;
  weight: number;
  latest: number;
}

const EMPTY_BOX: ViewBox = [-MIN_VB_W / 2, -MIN_VB_W / 2 / (16 / 9), MIN_VB_W, MIN_VB_W / (16 / 9)];

function fitBox(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  aspect: number,
): FitBox {
  const bw = (maxX - minX) * (1 + 2 * FIT_PAD);
  const bh = (maxY - minY) * (1 + 2 * FIT_PAD);
  let vw = Math.max(bw, MIN_VB_W);
  let vh = Math.max(bh, MIN_VB_W / aspect);
  if (vw / vh < aspect) vw = vh * aspect;
  else vh = vw / aspect;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const box: ViewBox = [cx - vw / 2, cy - vh / 2, vw, vh];
  // Quantise the key so tiny drifts don't re-trigger the camera animation.
  const key = box.map((v) => Math.round(v / 8)).join('|');
  return { box, key };
}

export interface BuildOptions {
  /** width / height of the pane the graph is shown in */
  aspect: number;
  categoryColors: ReadonlyMap<string, string>;
}

export function buildHiringGraph(hires: readonly HireEvent[], options: BuildOptions): HiringGraph {
  const aspect = clamp(options.aspect, 1, 3);
  const sorted = [...hires].sort(byTime);

  const companies = new Map<number, CompanyAgg>(); // insertion order = first appearance
  const freelancers = new Map<number, FreelancerAgg>();
  const edges = new Map<string, EdgeAgg>();
  const categoryCount = new Map<string, number>();

  for (const hire of sorted) {
    const t = hireTime(hire);
    const category = categoryOf(hire);

    let company = companies.get(hire.company.id);
    if (!company) {
      company = {
        id: hire.company.id,
        name: hire.company.name,
        logoUrl: hire.company.logoUrl,
        hireCount: 0,
        latest: 0,
        members: [],
      };
      companies.set(company.id, company);
    }
    company.hireCount += 1;
    company.latest = Math.max(company.latest, t);

    let freelancer = freelancers.get(hire.freelancer.id);
    if (!freelancer) {
      freelancer = {
        id: hire.freelancer.id,
        name: hire.freelancer.displayName,
        category,
        primaryCompanyId: company.id,
        hireCount: 0,
        latest: 0,
      };
      freelancers.set(freelancer.id, freelancer);
      company.members.push(freelancer);
    }
    freelancer.hireCount += 1;
    freelancer.latest = Math.max(freelancer.latest, t);

    const edgeKey = `${freelancer.id}:${company.id}`;
    const edge = edges.get(edgeKey);
    if (edge) {
      edge.weight += 1;
      edge.latest = Math.max(edge.latest, t);
    } else {
      edges.set(edgeKey, { freelancerId: freelancer.id, companyId: company.id, weight: 1, latest: t });
    }

    categoryCount.set(category, (categoryCount.get(category) ?? 0) + 1);
  }

  const companyList = [...companies.values()];
  const n = companyList.length;
  const categories: CategoryCount[] = [...categoryCount.entries()]
    .map(([category, count]) => ({
      category,
      count,
      color: options.categoryColors.get(category) ?? FALLBACK_COLOR,
    }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  if (n === 0) {
    return {
      companies: [],
      freelancers: [],
      edges: [],
      categories,
      fit: { box: EMPTY_BOX, key: 'empty' },
    };
  }

  // 1. hub radii → ellipse big enough for all clusters, quantised so it doesn't drift per hire
  const radii = companyList.map((c) => clusterRadiusFor(c.members.length));
  const area = radii.reduce((sum, r) => sum + Math.PI * (r + COLLISION_PAD) ** 2, 0) * AREA_SLACK;
  const qArea = quantizeUp(area, BASE_AREA, 1.25);
  const ay = Math.sqrt(qArea / (Math.PI * aspect));
  const ax = ay * aspect;

  // 2. hubs on a sunflower spiral in order of first appearance, then pushed apart
  const capacity = Math.max(24, Math.ceil((n * 1.15) / 8) * 8);
  const slotX: number[] = [];
  const slotY: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = Math.sqrt((i + 0.5) / capacity);
    const a = i * GOLDEN_ANGLE;
    slotX.push(ax * t * Math.cos(a));
    slotY.push(ay * t * Math.sin(a));
  }
  const hub = relaxHubs(slotX, slotY, radii);

  // 3. nodes
  const companyNodes: CompanyNode[] = [];
  const freelancerNodes: FreelancerNode[] = [];
  const nodePos = new Map<string, { x: number; y: number }>();

  companyList.forEach((company, i) => {
    const node: CompanyNode = {
      kind: 'company',
      id: `c${company.id}`,
      entityId: company.id,
      x: hub.x[i],
      y: hub.y[i],
      label: truncate(company.name, 22),
      hireCount: company.hireCount,
      latestHiredAt: company.latest,
      logoUrl: company.logoUrl,
      initials: initialsOf(company.name),
      clusterRadius: radii[i],
      memberCount: company.members.length,
    };
    companyNodes.push(node);
    nodePos.set(node.id, { x: node.x, y: node.y });

    company.members.forEach((member, m) => {
      const { ring, index } = slotFor(m);
      const angle = hash01(company.id * 131 + ring * 7919) * TWO_PI + index * GOLDEN_ANGLE;
      const fx = node.x + ringRadius(ring) * Math.cos(angle);
      const fy = node.y + ringRadius(ring) * Math.sin(angle);
      const fNode: FreelancerNode = {
        kind: 'freelancer',
        id: `f${member.id}`,
        entityId: member.id,
        x: fx,
        y: fy,
        r: DOT_R + (member.hireCount > 1 ? 1.5 : 0),
        label: member.name,
        color: options.categoryColors.get(member.category) ?? FALLBACK_COLOR,
        category: member.category,
        hireCount: member.hireCount,
        latestHiredAt: member.latest,
        companyNodeId: node.id,
      };
      freelancerNodes.push(fNode);
      nodePos.set(fNode.id, { x: fx, y: fy });
    });
  });

  const colorByFreelancer = new Map(freelancerNodes.map((f) => [f.entityId, f.color] as const));
  const edgeList: GraphEdge[] = [...edges.values()].map((e) => ({
    id: `f${e.freelancerId}>c${e.companyId}`,
    from: `f${e.freelancerId}`,
    to: `c${e.companyId}`,
    freelancerId: e.freelancerId,
    companyId: e.companyId,
    color: colorByFreelancer.get(e.freelancerId) ?? FALLBACK_COLOR,
    weight: e.weight,
    latestHiredAt: e.latest,
  }));

  // 4. camera
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of companyNodes) {
    minX = Math.min(minX, c.x - c.clusterRadius);
    maxX = Math.max(maxX, c.x + c.clusterRadius);
    minY = Math.min(minY, c.y - c.clusterRadius);
    maxY = Math.max(maxY, c.y + c.clusterRadius);
  }

  return {
    companies: companyNodes,
    freelancers: freelancerNodes,
    edges: edgeList,
    categories,
    fit: fitBox(minX, minY, maxX, maxY, aspect),
  };
}


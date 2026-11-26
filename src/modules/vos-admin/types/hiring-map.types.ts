// src/modules/vos-admin/types/hiring-map.types.ts

export type JobType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';

/**
 * One "freelancer was hired by company" event.
 *
 * Privacy: this is the ONLY shape the big screen ever receives. It deliberately
 * has no email, phone, birthday, government IDs or profile photo. The API layer
 * must build `displayName` as "First L." before it leaves the server.
 */
export interface HireEvent {
  /** Stable unique id of the hire ("app-<application_id>" in live mode). Used for de-duplication. */
  hireId: string;
  /** ISO-8601 timestamp of when the application became HIRED. */
  hiredAt: string;
  freelancer: {
    id: number;
    /** Already privacy-trimmed, e.g. "Ana G." */
    displayName: string;
    /** vs_role_category.category_name */
    category: string;
  };
  company: {
    id: number;
    name: string;
    logoUrl: string | null;
  };
  jobTitle: string;
  jobType: JobType | null;
}

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline' | 'demo';

export interface HiringSourceHandlers {
  onHire: (hire: HireEvent) => void;
  onStatus: (status: ConnectionStatus) => void;
}

/**
 * Where hires come from. `createDemoSource` implements it with fake data now;
 * the live implementation (snapshot REST call + SSE) plugs into the same shape.
 */
export interface HiringSource {
  kind: 'demo' | 'live';
  /** All hires so far (the graph starts fully populated). */
  loadSnapshot: (signal: AbortSignal) => Promise<HireEvent[]>;
  /** Live events after the snapshot. Returns an unsubscribe function. */
  subscribe: (handlers: HiringSourceHandlers) => () => void;
  /** Demo only: emit one hire right now. */
  simulate?: () => void;
}

// ───────────────────────────── graph model ─────────────────────────────

/** [x, y, width, height] in graph world units. */
export type ViewBox = readonly [number, number, number, number];

export interface FitBox {
  box: ViewBox;
  /** Changes only when the framing meaningfully changes (drives the camera animation). */
  key: string;
}

interface NodeBase {
  /** "c42" for companies, "f17" for freelancers. */
  id: string;
  entityId: number;
  x: number;
  y: number;
  label: string;
  hireCount: number;
  /** epoch ms of the most recent hire touching this node */
  latestHiredAt: number;
}

export interface CompanyNode extends NodeBase {
  kind: 'company';
  logoUrl: string | null;
  initials: string;
  /** Radius of the freelancer rings around the company, incl. padding. */
  clusterRadius: number;
  memberCount: number;
}

export interface FreelancerNode extends NodeBase {
  kind: 'freelancer';
  r: number;
  color: string;
  category: string;
  /** The company whose cluster this freelancer sits in (their first hire). */
  companyNodeId: string;
}

export interface GraphEdge {
  id: string;
  /** freelancer node id */
  from: string;
  /** company node id */
  to: string;
  freelancerId: number;
  companyId: number;
  color: string;
  /** number of hires between this pair (re-hires make the line thicker) */
  weight: number;
  latestHiredAt: number;
}

export interface CategoryCount {
  category: string;
  color: string;
  count: number;
}

export interface HiringGraph {
  companies: CompanyNode[];
  freelancers: FreelancerNode[];
  edges: GraphEdge[];
  categories: CategoryCount[];
  fit: FitBox;
}

/** What the admin has clicked on the map (company hub or freelancer dot). */
export interface GraphSelection {
  kind: 'company' | 'freelancer';
  /** graph node id: "c42" / "f17" */
  id: string;
}

/** The ways the hires can be drawn. The order is the order of the V key and the buttons. */
export const HIRING_DESIGNS = ['network', 'flow', 'orbit', 'spotlight'] as const;
export type HiringDesign = (typeof HIRING_DESIGNS)[number];

export const HIRING_DESIGN_LABEL: Record<HiringDesign, string> = {
  network: 'Network',
  flow: 'Flow',
  orbit: 'Orbit',
  spotlight: 'Spotlight',
};

export function isHiringDesign(value: unknown): value is HiringDesign {
  return typeof value === 'string' && (HIRING_DESIGNS as readonly string[]).includes(value);
}

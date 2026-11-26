// src/modules/vos-admin/lib/hiring-map/hiring-demo.ts
//
// Fake hires for `?demo=1` and for judging the look on a TV before the real
// data is wired. All companies and people below are invented.
import type { HireEvent, HiringSource, HiringSourceHandlers, JobType } from '../../types/hiring-map.types';
import { DAY, toDisplayName } from './hiring-format';

const CATEGORIES = [
  'Software Development',
  'Design & Creative',
  'Digital Marketing',
  'Customer Support',
  'Data & Analytics',
  'Writing & Translation',
  'Virtual Assistance',
  'Finance & Accounting',
];

const COMPANIES = [
  'Brightwave Labs', 'Northgate Digital', 'Kapitan Foods', 'Luzon Logistics', 'Pixel Harbor',
  'Mabuhay Media', 'Cebu Cloudworks', 'Harvest Ledger', 'Tala Analytics', 'Bayanihan Health',
  'Sunrise Retail', 'Isla Travel Co.', 'Ironleaf Studio', 'Pacific Orbit', 'Greenline Energy',
  'Daloy Payments', 'Mango Street Cafe', 'Blue Heron Legal', 'Sampaguita Beauty', 'Vista Learning',
  'Hanapbuhay Labs', 'Orchid Interiors', 'Quarry & Co.', 'Zenith Mobile', 'Tropic Games', 'Alon Marine',
];

const FIRST = [
  'Ana', 'Jose', 'Maria', 'Miguel', 'Carla', 'Paolo', 'Bianca', 'Rafael', 'Kristine', 'Marco',
  'Liza', 'Andrei', 'Joy', 'Nico', 'Trisha', 'Enzo', 'Hazel', 'Gab', 'Patricia', 'Ramon',
];
const LAST = [
  'Garcia', 'Reyes', 'Santos', 'Cruz', 'Bautista', 'Ocampo', 'Mendoza', 'Villanueva', 'Torres',
  'Aquino', 'Navarro', 'Castillo', 'Domingo', 'Lopez', 'Flores',
];
const TITLES = [
  'Frontend Developer', 'Brand Designer', 'Content Writer', 'Support Specialist', 'Data Analyst',
  'Social Media Manager', 'Virtual Assistant', 'Bookkeeper', 'UI/UX Designer', 'QA Tester',
];
const JOB_TYPES: JobType[] = ['FREELANCE', 'FREELANCE', 'CONTRACT', 'PART_TIME', 'FULL_TIME'];

/** Small seeded PRNG so the initial snapshot looks the same on every reload. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const person = (id: number) => ({
  id,
  displayName: toDisplayName(FIRST[id % FIRST.length], LAST[(id * 7) % LAST.length]),
  category: CATEGORIES[(id * 3) % CATEGORIES.length],
});

export interface DemoOptions {
  /** hires in the initial snapshot */
  initialCount?: number;
  /** companies used by the snapshot; the rest only appear later, which shows the hubs re-balancing */
  initialCompanies?: number;
  seed?: number;
  /** emit a hire every few seconds on its own (default true) */
  auto?: boolean;
}

/** The demo source plus manual triggers, used by the test page. */
export interface DemoSource extends HiringSource {
  /** n hires in quick succession (exercises the burst queue) */
  simulateBurst: (count?: number) => void;
  /** a hire at a company that has no hires yet (hubs re-balance) */
  simulateNewCompany: () => void;
  /** an existing freelancer hired by a second company (a cross link) */
  simulateRehire: () => void;
  setAuto: (on: boolean) => void;
}

export function createDemoSource(options: DemoOptions = {}): DemoSource {
  const { initialCount = 72, initialCompanies = 16, seed = 7, auto = true } = options;
  const rand = mulberry32(seed);
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];

  let nextHire = 1;
  let nextFreelancer = 1;
  const hiredBy = new Map<number, number>(); // freelancer -> first company index
  const usedCompanies = new Set<number>();

  interface MakeOptions {
    pool: number;
    at: number;
    /** 'maybe' = 12 % chance, 'force' = always, 'never' */
    rehire?: 'maybe' | 'force' | 'never';
    company?: number;
  }

  const makeHire = ({ pool, at, rehire = 'maybe', company }: MakeOptions): HireEvent => {
    let companyIndex = company ?? Math.floor(rand() * pool);
    let freelancerId: number;
    const wantsRehire = rehire === 'force' || (rehire === 'maybe' && nextFreelancer > 12 && rand() < 0.12);
    if (wantsRehire && nextFreelancer > 1) {
      // an existing freelancer gets hired again by a different company -> a cross link
      freelancerId = 1 + Math.floor(rand() * (nextFreelancer - 1));
      if (hiredBy.get(freelancerId) === companyIndex) companyIndex = (companyIndex + 1) % COMPANIES.length;
    } else {
      freelancerId = nextFreelancer++;
      hiredBy.set(freelancerId, companyIndex);
    }
    usedCompanies.add(companyIndex);
    const id = nextHire++;
    return {
      hireId: `demo-${id}`,
      hiredAt: new Date(at).toISOString(),
      freelancer: person(freelancerId),
      company: { id: companyIndex + 1, name: COMPANIES[companyIndex], logoUrl: null },
      jobTitle: pick(TITLES),
      jobType: pick(JOB_TYPES),
    };
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  let emit: ((hire: HireEvent) => void) | undefined;
  let autoOn = auto;
  let running = false;

  const emitHire = (opts: Partial<MakeOptions> = {}) =>
    emit?.(makeHire({ pool: COMPANIES.length, at: Date.now(), ...opts }));

  const schedule = () => {
    if (timer) clearTimeout(timer);
    if (!autoOn || !running) return;
    timer = setTimeout(() => {
      emitHire();
      // sometimes a burst, to exercise the burst queue
      if (rand() < 0.18) {
        setTimeout(() => emitHire(), 250);
        setTimeout(() => emitHire(), 500);
      }
      schedule();
    }, 3500 + rand() * 4500);
  };

  const newCompanyIndex = () => {
    for (let i = 0; i < COMPANIES.length; i++) if (!usedCompanies.has(i)) return i;
    return Math.floor(rand() * COMPANIES.length);
  };

  return {
    kind: 'demo',

    async loadSnapshot() {
      const now = Date.now();
      const hires: HireEvent[] = [];
      for (let i = 0; i < initialCount; i++) {
        // ~8 hires land "today", the rest over the previous 12 days
        const recent = i >= initialCount - 8;
        const age = recent ? rand() * 6 * 3_600_000 : (1 + rand() * 11) * DAY;
        hires.push(makeHire({ pool: initialCompanies, at: now - age }));
      }
      return hires;
    },

    subscribe({ onHire, onStatus }: HiringSourceHandlers) {
      emit = onHire;
      running = true;
      onStatus('demo');
      schedule();
      return () => {
        running = false;
        if (timer) clearTimeout(timer);
        emit = undefined;
      };
    },

    simulate: () => emitHire(),
    simulateBurst: (count = 5) => {
      for (let i = 0; i < count; i++) setTimeout(() => emitHire(), i * 150);
    },
    simulateNewCompany: () => emitHire({ company: newCompanyIndex(), rehire: 'never' }),
    simulateRehire: () => emitHire({ rehire: 'force' }),
    setAuto: (on: boolean) => {
      autoOn = on;
      schedule();
    },
  };
}

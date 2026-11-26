// src/modules/vos-admin/server/hiring-map.server.ts
//
// SERVER ONLY. Builds privacy-trimmed HireEvents from Directus.
// Used by the snapshot route and by the SSE patch.
import type { HireEvent, JobType } from '../types/hiring-map.types';
import { toDisplayName } from '../lib/hiring-map/hiring-format';

const DIRECTUS_URL = process.env.DIRECTUS_URL?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || '';
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN?.trim() || '';

/**
 * vs_job_application.status_updated_at is a MySQL DATETIME. Directus returns it
 * without a zone. Default assumes Philippine local time (+08:00).
 */
const DB_OFFSET = process.env.HIRING_MAP_DB_UTC_OFFSET ?? '+08:00';

/** Only these columns are requested. Nothing like email, phone, birthday or government IDs. */
const FIELDS = [
  'application_id',
  'status_updated_at',
  'applied_at',
  'user_id.user_id',
  'user_id.user_fname',
  'user_id.user_lname',
  'job_id.job_title',
  'job_id.job_type',
  'job_id.job_category',
  'job_id.category_id.category_name',
  'job_id.company_id.company_id',
  'job_id.company_id.company_name',
  'job_id.company_id.company_logo',
].join(',');

interface DirectusRow {
  application_id: number;
  status_updated_at: string | null;
  applied_at: string | null;
  user_id: { user_id: number; user_fname: string | null; user_lname: string | null } | null;
  job_id: {
    job_title: string | null;
    job_type: string | null;
    job_category: string | null;
    category_id: { category_name: string | null } | null;
    company_id: { company_id: number; company_name: string | null; company_logo: string | null } | null;
  } | null;
}

async function directusGet<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!DIRECTUS_URL) throw new Error('DIRECTUS_URL is not set');
  const url = `${DIRECTUS_URL.replace(/\/$/, '')}${path}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, {
    headers: DIRECTUS_TOKEN ? { Authorization: `Bearer ${DIRECTUS_TOKEN}` } : undefined,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Directus ${path} failed (${res.status})`);
  return ((await res.json()) as { data: T }).data;
}

function toIso(value: string | null): string | null {
  if (!value) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) return new Date(value).toISOString();
  const withZone = `${value.replace(' ', 'T')}${DB_OFFSET}`;
  const t = Date.parse(withZone);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

const JOB_TYPES: ReadonlySet<string> = new Set(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE']);

/**
 * vs_company.company_logo is free text. Absolute URLs and site-relative
 * paths work as-is. A bare Directus file id is turned into an /assets URL.
 */
function resolveLogoUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith('/')) return value;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) && DIRECTUS_URL) {
    return `${DIRECTUS_URL.replace(/\/$/, '')}/assets/${value}`;
  }
  return null;
}

export function toHireEvent(row: DirectusRow): HireEvent | null {
  const company = row.job_id?.company_id;
  const user = row.user_id;
  const hiredAt = toIso(row.status_updated_at) ?? toIso(row.applied_at);
  if (!company || !user || !hiredAt) return null;

  return {
    hireId: `app-${row.application_id}`,
    hiredAt,
    freelancer: {
      id: user.user_id,
      displayName: toDisplayName(user.user_fname, user.user_lname),
      category: row.job_id?.category_id?.category_name ?? row.job_id?.job_category ?? 'Other',
    },
    company: {
      id: company.company_id,
      name: company.company_name?.trim() || 'Company',
      logoUrl: resolveLogoUrl(company.company_logo),
    },
    jobTitle: row.job_id?.job_title?.trim() || 'Role',
    jobType: row.job_id?.job_type && JOB_TYPES.has(row.job_id.job_type) ? (row.job_id.job_type as JobType) : null,
  };
}

/** All HIRED applications (oldest first), or just one when `applicationId` is given. */
export async function fetchHires(options: { applicationId?: number; limit?: number } = {}): Promise<HireEvent[]> {
  const params: Record<string, string> = {
    'filter[application_status][_eq]': 'HIRED',
    fields: FIELDS,
    sort: 'status_updated_at,application_id',
    limit: String(options.limit ?? 5000),
  };
  if (options.applicationId != null) params['filter[application_id][_eq]'] = String(options.applicationId);

  const rows = await directusGet<DirectusRow[]>('/items/vs_job_application', params);
  return rows.map(toHireEvent).filter((h): h is HireEvent => h !== null);
}

export async function fetchHireByApplicationId(applicationId: number): Promise<HireEvent | null> {
  const [hire] = await fetchHires({ applicationId, limit: 1 });
  return hire ?? null;
}


// src/modules/vos-admin/request-management/services/request.repo.ts
import { VsSchoolRequest, VsCourseRequest } from '../types/request.types';

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

const PAGE_SIZE = 5000;
// The demand dashboard sums these rows into requestCount / distinctRequesterCount.
// Directus answers an un-paginated read with its default limit of 100, which made
// those sums report only the newest 100 requests as if they were the whole queue.
const MAX_ROWS = 50_000;

async function readAllRows<T>(collection: string, query: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const res = await fetch(
      `${DIRECTUS_BASE}/items/${collection}?${query}&limit=${PAGE_SIZE}&offset=${offset}`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (!res.ok) throw new Error(`Failed to fetch ${collection} from database.`);
    const json = await res.json();
    const page: T[] = json.data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  throw new Error(`Too many ${collection} rows to summarise safely (${MAX_ROWS}+). Filter the queue and try again.`);
}

export async function fetchSchoolRequestsRepo(status?: string): Promise<VsSchoolRequest[]> {
  let filterQuery = '';
  if (status && status !== 'ALL') {
    filterQuery = `&filter[request_status][_eq]=${encodeURIComponent(status)}`;
  }
  const query = `fields=*,requested_by.user_id,requested_by.user_fname,requested_by.user_lname&sort=-created_at${filterQuery}`;
  return readAllRows<VsSchoolRequest>("vs_school_request", query);
}

export async function fetchCourseRequestsRepo(status?: string): Promise<VsCourseRequest[]> {
  let filterQuery = '';
  if (status && status !== 'ALL') {
    filterQuery = `&filter[request_status][_eq]=${encodeURIComponent(status)}`;
  }
  // Expand school_id to get school_name for the UI
  const query = `fields=*,requested_by.user_id,requested_by.user_fname,requested_by.user_lname,school_id.*&sort=-created_at${filterQuery}`;
  return readAllRows<VsCourseRequest>("vs_course_request", query);
}

export async function reviewSchoolRequestRepo(id: number, payload: Partial<VsSchoolRequest>): Promise<VsSchoolRequest> {
  const url = `${DIRECTUS_BASE}/items/vs_school_request/${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.errors?.[0]?.message || "Failed to update school request.");
  return json.data;
}

export async function reviewCourseRequestRepo(id: number, payload: Partial<VsCourseRequest>): Promise<VsCourseRequest> {
  const url = `${DIRECTUS_BASE}/items/vs_course_request/${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.errors?.[0]?.message || "Failed to update course request.");
  return json.data;
}

export async function createSchoolRequestRepo(payload: Partial<VsSchoolRequest>): Promise<VsSchoolRequest> {
  const url = `${DIRECTUS_BASE}/items/vs_school_request`;
  const res = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.errors?.[0]?.message || "Failed to create school request.");
  return json.data;
}

export async function fetchSchoolRequestById(id: number): Promise<VsSchoolRequest> {
  const url = `${DIRECTUS_BASE}/items/vs_school_request/${id}?fields=*,requested_by.user_id,requested_by.user_fname,requested_by.user_lname`;
  const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch school request details.");
  const json = await res.json();
  return json.data;
}

export async function fetchCourseRequestById(id: number): Promise<VsCourseRequest> {
  const url = `${DIRECTUS_BASE}/items/vs_course_request/${id}?fields=*,requested_by.user_id,requested_by.user_fname,requested_by.user_lname,school_id.*`;
  const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch course request details.");
  const json = await res.json();
  return json.data;
}



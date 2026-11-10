// src/modules/vos-admin/user-management/services/user.repo.ts
import { VsUser, IdentityVerification } from '../types/user.types';

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 200;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

function toSafePositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
}

export async function fetchUsersRepo(
  roleId?: number,
  search?: string,
  page: number = 1,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<{ users: VsUser[]; total: number }> {
  const safePage = toSafePositiveInt(page, 1);
  const safeLimit = Math.min(toSafePositiveInt(limit, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  const queries: string[] = [];

  // Server-side pagination; the filtered total comes from Directus meta.
  queries.push(`limit=${safeLimit}`);
  queries.push(`page=${safePage}`);
  queries.push('meta=filter_count');
  queries.push('fields=*,job_seeker_profile.*,vs_job_seeker_profile.*,job_preferences.*,vs_job_preferences.*');
  queries.push('sort=-user_id');

  // Filter conditions
  const filter: Record<string, unknown> = {
    // Exclude client accounts (role_id === 2) and school accounts (role_id === 4)
    // unless a specific role bucket was requested.
    role_id: roleId ? { _eq: roleId } : { _nin: [2, 4] },
  };

  // Filter by search query (first name, last name, or email)
  if (search && search.trim()) {
    const cleanSearch = search.trim();
    filter._or = [
      { user_fname: { _icontains: cleanSearch } },
      { user_lname: { _icontains: cleanSearch } },
      { user_email: { _icontains: cleanSearch } },
    ];
  }

  queries.push(`filter=${encodeURIComponent(JSON.stringify(filter))}`);

  const url = `${DIRECTUS_BASE}/items/vs_user?${queries.join('&')}`;

  const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch users from database: ${res.statusText}`);
  }

  const json = await res.json();
  const users = json.data || [];
  const total = Number(json.meta?.filter_count ?? users.length);

  // Let's also fetch verification status summaries for these users to display in the table
  const userIds = users
    .map((u: VsUser) => Number(u.user_id))
    .filter((id: number) => Number.isSafeInteger(id) && id > 0);
  const verificationsMap: Record<number, IdentityVerification[]> = {};
  const preferencesMap: Record<number, unknown> = {};

  if (userIds.length > 0) {
    // Fetch verifications
    const verifUrl = `${DIRECTUS_BASE}/items/vs_identity_verifications?filter[user_id][_in]=${userIds.join(',')}&limit=-1`;
    const verifRes = await fetch(verifUrl, { headers: getHeaders(), cache: "no-store" });
    if (verifRes.ok) {
      const verifJson = await verifRes.json();
      const allVerifs = verifJson.data || [];
      allVerifs.forEach((v: IdentityVerification) => {
        if (!verificationsMap[v.user_id]) {
          verificationsMap[v.user_id] = [];
        }
        verificationsMap[v.user_id].push(v);
      });
    }

    // Fetch job preferences directly
    const prefsUrl = `${DIRECTUS_BASE}/items/vs_job_preferences?filter[user_id][_in]=${userIds.join(',')}&limit=-1`;
    const prefsRes = await fetch(prefsUrl, { headers: getHeaders(), cache: "no-store" });
    if (prefsRes.ok) {
      const prefsJson = await prefsRes.json();
      const allPrefs = prefsJson.data || [];
      allPrefs.forEach((p: { user_id: number }) => {
        preferencesMap[p.user_id] = p;
      });
    }
  }

  const usersWithVerif = users.map((user: VsUser) => ({
    ...user,
    verifications: verificationsMap[user.user_id] || [],
    job_preferences: (preferencesMap[user.user_id] as VsUser['job_preferences']) || null
  }));

  return {
    users: usersWithVerif,
    total
  };
}

export async function fetchUserDetailRepo(userId: number): Promise<VsUser | null> {
  const url = `${DIRECTUS_BASE}/items/vs_user/${userId}?fields=*,job_seeker_profile.*,vs_job_seeker_profile.*`;
  const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch user detail: ${res.statusText}`);
  }

  const json = await res.json();
  const user = json.data;
  if (!user) return null;

  // Fetch verifications for this specific user
  const verifUrl = `${DIRECTUS_BASE}/items/vs_identity_verifications?filter[user_id][_eq]=${userId}&sort=-submitted_at&limit=-1`;
  const verifRes = await fetch(verifUrl, { headers: getHeaders(), cache: "no-store" });
  let verifications: IdentityVerification[] = [];
  if (verifRes.ok) {
    const verifJson = await verifRes.json();
    verifications = verifJson.data || [];
  }

  // Fetch job preferences directly for this user
  const prefsUrl = `${DIRECTUS_BASE}/items/vs_job_preferences?filter[user_id][_eq]=${userId}&limit=1`;
  const prefsRes = await fetch(prefsUrl, { headers: getHeaders(), cache: "no-store" });
  let job_preferences = null;
  if (prefsRes.ok) {
    const prefsJson = await prefsRes.json();
    const data = prefsJson.data || [];
    job_preferences = data.length > 0 ? data[0] : null;
  }

  return {
    ...user,
    verifications,
    job_preferences
  };
}

export async function updateIdentityVerificationStatusRepo(
  verificationId: number,
  status: 'approved' | 'rejected',
  adminId: number,
  rejectionNote?: string
): Promise<IdentityVerification> {
  const url = `${DIRECTUS_BASE}/items/vs_identity_verifications/${verificationId}`;
  
  const payload: Partial<IdentityVerification> = {
    status,
    reviewed_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " "), // PH Time
    reviewed_by: adminId,
    rejection_note: status === 'rejected' ? (rejectionNote || 'Rejected by Administrator') : null
  };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to update verification status: ${errorText}`);
  }

  const json = await res.json();
  return json.data;
}

// src/modules/vos-admin/audit-trail/services/audit.repo.ts
import { AuditRecord, AuditFilters, AuditKPIData, AuditCategoryConfig, DEFAULT_AUDIT_CONFIG } from '../types/audit.types';

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

// Memory cache for audit config to avoid HTTP overhead on every audit log write
let cachedAuditConfig: AuditCategoryConfig | null = null;
let lastConfigFetchTime = 0;
const CONFIG_CACHE_TTL_MS = 30 * 1000; // 30 seconds

// Hard ceiling for any single Directus page/export request.
const MAX_DIRECTUS_LIMIT = 5000;

// A role wider than this cannot be turned into an `actor_user_id _in` list: the
// encoded id list would outgrow the URL before Directus ever sees it.
const ACTOR_ROLE_CEILING = 500;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

/**
 * Resolve the actor_type role bucket to concrete user ids.
 *
 * Both failure modes here used to substitute a different search: an unreachable
 * Directus dropped the condition entirely (every actor matched), and a role with
 * more members than the ceiling matched only the first `limit` of them while the
 * pager still reported "that is everything". A role too large to express as an
 * id list is now an error the admin can read.
 */
async function resolveActorUserIds(
  targetRoleId: number
): Promise<number[]> {
  const uRes = await fetch(
    `${DIRECTUS_BASE}/items/vs_user?filter[role_id][_eq]=${targetRoleId}&fields=user_id&sort=user_id&limit=${ACTOR_ROLE_CEILING}&meta=filter_count`,
    { headers: getHeaders(), cache: "no-store" }
  );
  if (!uRes.ok) {
    throw new Error(`Could not read the members of role #${targetRoleId} to filter the audit trail.`);
  }
  const uJson = (await uRes.json().catch(() => null)) as {
    data?: unknown;
    meta?: { filter_count?: unknown };
  } | null;
  const rows = Array.isArray(uJson?.data) ? uJson.data : [];
  const total = Number(uJson?.meta?.filter_count);
  if (Number.isSafeInteger(total) && total > rows.length) {
    throw new Error(
      `${total} accounts hold this role, which is too many to filter the audit trail by. Filter by a specific user instead.`
    );
  }
  return rows
    .map((u: { user_id: number }) => u.user_id)
    .filter(Boolean);
}

export async function fetchAuditLogsRepo(
  filters: AuditFilters
): Promise<{ records: AuditRecord[]; total: number }> {
  const queries: string[] = [];

  // Pagination
  const limit = filters.limit > 0 ? filters.limit : MAX_DIRECTUS_LIMIT;
  const page = filters.page > 0 ? filters.page : 1;
  queries.push(`limit=${Math.min(limit, MAX_DIRECTUS_LIMIT)}`);
  queries.push(`page=${page}`);
  queries.push('meta=filter_count');
  queries.push('sort=-created_at');

  // Build filter object for Directus (serialized + encoded below)
  const filter: Record<string, unknown> = {};

  if (filters.event_category && filters.event_category !== "ALL") {
    filter.event_category = { _eq: filters.event_category };
  }

  if (filters.action && filters.action !== "ALL") {
    filter.action = { _eq: filters.action };
  }

  if (filters.status && filters.status !== "ALL") {
    filter.status = { _eq: filters.status };
  }

  if (filters.actor_type && filters.actor_type !== "ALL") {
    const act = filters.actor_type.toUpperCase();
    if (act === "ADMIN") {
      filter._or = [{ actor_type: { _eq: "ADMIN" } }, { actor_type: { _eq: "SYSTEM" } }];
    } else if (act === "SYSTEM") {
      filter.actor_type = { _eq: "SYSTEM" };
    } else {
      // For specific roles (SCH_ADMIN, CLIENT, FREELANCER), resolve target role_ids
      let targetRoleId: number | null = null;
      if (act === "FREELANCER") targetRoleId = 1;
      else if (act === "CLIENT") targetRoleId = 2;
      else if (act === "SCH_ADMIN" || act === "SCHOOL_ADMIN") targetRoleId = 4;

      if (targetRoleId !== null) {
        const uIds = await resolveActorUserIds(targetRoleId);
        filter.actor_user_id =
          uIds.length > 0 ? { _in: uIds } : { _eq: -1 };
      } else {
        filter.actor_type = { _eq: filters.actor_type };
      }
    }
  }

  if (filters.organization_type && filters.organization_type !== "ALL") {
    filter.organization_type = { _eq: filters.organization_type };
  }

  if (filters.resource_type && filters.resource_type.trim()) {
    filter.resource_type = { _icontains: filters.resource_type.trim() };
  }

  if (filters.actor_user_id && Number.isSafeInteger(filters.actor_user_id)) {
    filter.actor_user_id = { _eq: filters.actor_user_id };
  }

  if (filters.date_from && filters.date_to) {
    const cleanFrom = filters.date_from.trim().split("T")[0];
    const cleanTo = filters.date_to.trim().split("T")[0];
    filter.created_at = { _gte: `${cleanFrom}T00:00:00`, _lte: `${cleanTo}T23:59:59` };
  } else if (filters.date_from) {
    const cleanFrom = filters.date_from.trim().split("T")[0];
    filter.created_at = { _gte: `${cleanFrom}T00:00:00` };
  } else if (filters.date_to) {
    const cleanTo = filters.date_to.trim().split("T")[0];
    filter.created_at = { _lte: `${cleanTo}T23:59:59` };
  }

  if (filters.search && filters.search.trim()) {
    const cleanSearch = filters.search.trim();
    filter._or = [
      { event_type: { _icontains: cleanSearch } },
      { reason: { _icontains: cleanSearch } },
      { resource_id: { _icontains: cleanSearch } },
      { resource_type: { _icontains: cleanSearch } },
      { correlation_id: { _icontains: cleanSearch } },
    ];
  }

  if (Object.keys(filter).length > 0) {
    queries.push(`filter=${encodeURIComponent(JSON.stringify(filter))}`);
  }

  const queryString = queries.length > 0 ? `?${queries.join('&')}` : '';
  const url = `${DIRECTUS_BASE}/items/vs_audit_trail${queryString}`;

  const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch audit records: ${res.statusText}`);
  }

  const json = await res.json();
  const rawRecords: AuditRecord[] = json.data || [];
  const total = json.meta?.filter_count ?? rawRecords.length;

  // Resolve actor and resource user IDs via batch fetch on vs_user
  const actorUserIds = Array.from(
    new Set(
      rawRecords
        .map((r) => r.actor_user_id)
        .filter((id): id is number => id !== null && id !== undefined && id > 0)
    )
  );

  const resourceUserIds = rawRecords
    .filter((r) => {
      const rt = r.resource_type?.toUpperCase();
      const rc = r.event_category?.toUpperCase();
      return (rt === "USER" || rt === "VS_USER" || rc === "USER") && r.resource_id;
    })
    .map((r) => parseInt(String(r.resource_id), 10))
    .filter((id) => !isNaN(id) && id > 0);

  const allUserIds = Array.from(new Set([...actorUserIds, ...resourceUserIds]));

  // Resolve company IDs from actor_company_id, resource_id, and organization_id
  const companyIds = Array.from(
    new Set(
      rawRecords
        .flatMap((r) => {
          const ids: number[] = [];
          if (r.actor_company_id) ids.push(Number(r.actor_company_id));
          const isCompanyRelated =
            r.resource_type?.toUpperCase() === "COMPANY" ||
            r.event_category?.toUpperCase() === "COMPANY" ||
            r.event_category?.toUpperCase() === "VERIFICATION" ||
            (r.event_type || "").toUpperCase().includes("COMPANY") ||
            r.organization_type?.toUpperCase() === "EMPLOYER";

          if (isCompanyRelated && r.resource_id) {
            const num = parseInt(String(r.resource_id), 10);
            if (!isNaN(num) && num > 0) ids.push(num);
          }
          if (r.organization_id && (isCompanyRelated || r.organization_type === "EMPLOYER")) {
            const orgNum = parseInt(String(r.organization_id), 10);
            if (!isNaN(orgNum) && orgNum > 0) ids.push(orgNum);
          }
          return ids;
        })
        .filter((id) => !isNaN(id) && id > 0)
    )
  );

  // Resolve job IDs
  const jobIds = Array.from(
    new Set(
      rawRecords
        .filter((r) => r.resource_type?.toUpperCase() === "JOB" && r.resource_id)
        .map((r) => parseInt(String(r.resource_id), 10))
        .filter((id) => !isNaN(id) && id > 0)
    )
  );

  const userMap: Record<number, { name: string; email: string; role?: string | null }> = {};
  const companyMap: Record<number, string> = {};
  const jobMap: Record<number, string> = {};

  try {
    const promises: Promise<void>[] = [];

    if (allUserIds.length > 0) {
      promises.push(
        (async () => {
          const userUrl = `${DIRECTUS_BASE}/items/vs_user?filter[user_id][_in]=${allUserIds.join(",")}&fields=user_id,user_fname,user_lname,user_email,role_id,role&limit=-1`;
          const userRes = await fetch(userUrl, { headers: getHeaders(), cache: "no-store" });
          if (userRes.ok) {
            const userJson = await userRes.json();
            const users = userJson.data || [];
            users.forEach((u: { user_id?: number; user_fname?: string; user_lname?: string; user_email?: string; role_id?: number; role?: string }) => {
              if (u.user_id) {
                const name = `${u.user_fname ?? ""} ${u.user_lname ?? ""}`.trim() || u.user_email || `User #${u.user_id}`;
                let roleLabel = u.role || null;
                if (u.role_id === 1) roleLabel = "Freelancer";
                else if (u.role_id === 2) roleLabel = "Client";
                else if (u.role_id === 3 || u.role_id === 5) roleLabel = "Admin";
                else if (u.role_id === 4) roleLabel = "School Admin";
                userMap[u.user_id] = { name, email: u.user_email || "", role: roleLabel };
              }
            });
          }
        })()
      );
    }

    if (companyIds.length > 0) {
      promises.push(
        (async () => {
          const compUrl = `${DIRECTUS_BASE}/items/vs_company?filter[company_id][_in]=${companyIds.join(",")}&fields=company_id,company_name&limit=-1`;
          const compRes = await fetch(compUrl, { headers: getHeaders(), cache: "no-store" });
          if (compRes.ok) {
            const compJson = await compRes.json();
            const companies = compJson.data || [];
            companies.forEach((c: { company_id?: number; company_name?: string }) => {
              if (c.company_id && c.company_name) {
                companyMap[c.company_id] = c.company_name;
              }
            });
          }
        })()
      );
    }

    if (jobIds.length > 0) {
      promises.push(
        (async () => {
          const jobUrl = `${DIRECTUS_BASE}/items/vs_job_posting?filter[job_id][_in]=${jobIds.join(",")}&fields=job_id,job_title&limit=-1`;
          const jobRes = await fetch(jobUrl, { headers: getHeaders(), cache: "no-store" });
          if (jobRes.ok) {
            const jobJson = await jobRes.json();
            const jobs = jobJson.data || [];
            jobs.forEach((j: { job_id?: number; job_title?: string }) => {
              if (j.job_id) {
                jobMap[j.job_id] = j.job_title || `Job #${j.job_id}`;
              }
            });
          }
        })()
      );
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  } catch (err) {
    console.warn("Failed to batch resolve actor & resource names for audit records:", err);
  }

  const recordsWithActorInfo = rawRecords.map((record) => {
    let oldVals = record.old_values;
    let newVals = record.new_values;
    if (typeof oldVals === "string") {
      try { oldVals = JSON.parse(oldVals); } catch { /* ignore */ }
    }
    if (typeof newVals === "string") {
      try { newVals = JSON.parse(newVals); } catch { /* ignore */ }
    }

    const resolvedUser = record.actor_user_id ? userMap[record.actor_user_id] : null;

    // Resolve resource friendly name
    let resourceName: string | null = null;
    const rType = (record.resource_type || "").toUpperCase();
    const rCat = (record.event_category || "").toUpperCase();
    const rId = record.resource_id ? parseInt(String(record.resource_id), 10) : null;
    const orgId = record.organization_id ? parseInt(String(record.organization_id), 10) : null;

    if (rId && companyMap[rId]) {
      resourceName = companyMap[rId];
    } else if (orgId && companyMap[orgId]) {
      resourceName = companyMap[orgId];
    } else if (record.actor_company_id && companyMap[Number(record.actor_company_id)]) {
      resourceName = companyMap[Number(record.actor_company_id)];
    } else if (rId && userMap[rId] && (rType === "USER" || rType === "VS_USER" || rCat === "USER")) {
      resourceName = userMap[rId].name;
    } else if (rId && jobMap[rId] && (rType === "JOB" || rCat === "JOB")) {
      resourceName = jobMap[rId];
    }

    const isSystemActor = record.actor_type === "SYSTEM";
    const finalActorName = isSystemActor ? "System" : (resolvedUser ? resolvedUser.name : null);
    const finalActorEmail = isSystemActor ? null : (resolvedUser ? resolvedUser.email : null);
    const finalActorRole = isSystemActor ? "Automated Policy" : (resolvedUser?.role || (record.actor_type === "ADMIN" ? "Admin" : record.actor_type));
    const finalResourceName = resourceName || (isSystemActor && resolvedUser ? resolvedUser.name : null);

    return {
      ...record,
      old_values: oldVals,
      new_values: newVals,
      actor_name: finalActorName,
      actor_email: finalActorEmail,
      actor_role: finalActorRole,
      resource_name: finalResourceName,
    };
  });

  return {
    records: recordsWithActorInfo,
    total,
  };
}

export async function fetchAuditKPIsRepo(filters?: AuditFilters): Promise<AuditKPIData> {
  const now = new Date();
  const phDateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const fromDateStr = filters?.date_from || phDateParts;
  const toDateStr = filters?.date_to || fromDateStr;

  const baseFilter: Record<string, unknown> = {};
  if (fromDateStr && toDateStr) {
    const cleanFrom = fromDateStr.trim().split("T")[0];
    const cleanTo = toDateStr.trim().split("T")[0];
    baseFilter.created_at = { _gte: `${cleanFrom}T00:00:00`, _lte: `${cleanTo}T23:59:59` };
  } else if (fromDateStr) {
    const cleanFrom = fromDateStr.trim().split("T")[0];
    baseFilter.created_at = { _gte: `${cleanFrom}T00:00:00` };
  } else if (toDateStr) {
    const cleanTo = toDateStr.trim().split("T")[0];
    baseFilter.created_at = { _lte: `${cleanTo}T23:59:59` };
  }
  if (filters?.event_category && filters.event_category !== "ALL") {
    baseFilter.event_category = { _eq: filters.event_category };
  }
  if (filters?.action && filters.action !== "ALL") {
    baseFilter.action = { _eq: filters.action };
  }
  if (filters?.organization_type && filters.organization_type !== "ALL") {
    baseFilter.organization_type = { _eq: filters.organization_type };
  }
  if (filters?.actor_user_id && Number.isSafeInteger(filters.actor_user_id)) {
    baseFilter.actor_user_id = { _eq: filters.actor_user_id };
  }
  if (filters?.actor_type && filters.actor_type !== "ALL") {
    const act = filters.actor_type.toUpperCase();
    if (act === "ADMIN") {
      baseFilter._or = [{ actor_type: { _eq: "ADMIN" } }, { actor_type: { _eq: "SYSTEM" } }];
    } else if (act === "SYSTEM") {
      baseFilter.actor_type = { _eq: "SYSTEM" };
    } else {
      let targetRoleId: number | null = null;
      if (act === "FREELANCER") targetRoleId = 1;
      else if (act === "CLIENT") targetRoleId = 2;
      else if (act === "SCH_ADMIN" || act === "SCHOOL_ADMIN") targetRoleId = 4;

      if (targetRoleId !== null) {
        const uIds = await resolveActorUserIds(targetRoleId);
        baseFilter.actor_user_id =
          uIds.length > 0 ? { _in: uIds } : { _eq: -1 };
      } else {
        baseFilter.actor_type = { _eq: filters.actor_type };
      }
    }
  }

  const buildFilterQuery = (extraConditions: Record<string, unknown> = {}): string => {
    const combined = { ...baseFilter, ...extraConditions };
    return Object.keys(combined).length > 0
      ? `&filter=${encodeURIComponent(JSON.stringify(combined))}`
      : "";
  };

  const todayFilter = buildFilterQuery();
  const failedFilter = buildFilterQuery({ status: { _eq: "FAILED" } });
  const deniedFilter = buildFilterQuery({ status: { _eq: "DENIED" } });
  const adminFilter = buildFilterQuery({ _or: [{ actor_type: { _eq: "ADMIN" } }, { actor_type: { _eq: "SYSTEM" } }] });

  // Each count is read on its own and answered as null when it could not be
  // read. Returning a blanket set of zeros turned an unreachable Directus into a
  // dashboard claiming "no failed events, no denied access today" — the two
  // numbers a security review opens this page for.
  const countOf = async (filter: string): Promise<number | null> => {
    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_audit_trail?limit=1&meta=filter_count${filter}`,
      { headers: getHeaders(), cache: "no-store" }
    ).catch(() => null);
    if (!res?.ok) return null;
    const json = (await res.json().catch(() => null)) as {
      meta?: { filter_count?: unknown }
    } | null;
    const count = Number(json?.meta?.filter_count);
    return Number.isSafeInteger(count) && count >= 0 ? count : null;
  };

  const [todayEvents, failedEvents, deniedAccess, adminActions] = await Promise.all([
    countOf(todayFilter),
    countOf(failedFilter),
    countOf(deniedFilter),
    countOf(adminFilter),
  ]);

  return { todayEvents, failedEvents, deniedAccess, adminActions };
}

export async function fetchAuditConfigRepo(): Promise<AuditCategoryConfig> {
  const now = Date.now();
  if (cachedAuditConfig && now - lastConfigFetchTime < CONFIG_CACHE_TTL_MS) {
    return cachedAuditConfig;
  }

  try {
    if (!DIRECTUS_BASE) return DEFAULT_AUDIT_CONFIG;
    const url = `${DIRECTUS_BASE}/items/vs_audit_config?limit=-1`;
    const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const rows: Array<{ audit_config_id: number; event_category: string; event_type: string; is_enabled: number | boolean }> = json.data || [];

      if (rows.length > 0) {
        const categories: Record<string, boolean> = { ...(DEFAULT_AUDIT_CONFIG.categories || {}) };
        const actions: Record<string, Record<string, boolean>> = { ...(DEFAULT_AUDIT_CONFIG.actions || {}) };

        rows.forEach((r) => {
          const cat = r.event_category;
          const act = r.event_type;
          const enabled = Boolean(r.is_enabled);

          if (act === '__CATEGORY__') {
            categories[cat] = enabled;
          } else {
            if (!actions[cat]) actions[cat] = {};
            actions[cat][act] = enabled;
          }
        });

        cachedAuditConfig = { categories, actions };
        lastConfigFetchTime = Date.now();
        return cachedAuditConfig;
      }
    }
  } catch (err) {
    console.warn("[fetchAuditConfigRepo] Fallback to default config:", err);
  }

  return cachedAuditConfig || DEFAULT_AUDIT_CONFIG;
}

export async function updateAuditConfigRepo(
  newConfig: AuditCategoryConfig,
  adminId?: number
): Promise<{ config: AuditCategoryConfig; warnings: string[] }> {
  const warnings: string[] = [];
  try {
    if (!DIRECTUS_BASE) {
      return { config: newConfig, warnings: ["Audit settings were not saved: Directus is not configured."] };
    }
    const url = `${DIRECTUS_BASE}/items/vs_audit_config`;

    // Fetch existing configuration rows
    const checkRes = await fetch(`${url}?limit=-1`, { headers: getHeaders(), cache: "no-store" });
    const existingMap: Record<string, number> = {};

    if (!checkRes.ok) {
      // Without the existing rows every toggle would take the create branch and
      // insert a second row for the same event, so nothing is written at all.
      return {
        config: newConfig,
        warnings: ["The stored audit settings could not be read, so nothing was changed. Please try again."],
      };
    }

    const json = (await checkRes.json()) as {
      data?: Array<{ audit_config_id: number; event_category: string; event_type: string }>;
    };
    (json.data || []).forEach((r) => {
      const key = `${r.event_category}::${r.event_type}`;
      existingMap[key] = r.audit_config_id;
    });

    // Process actions
    const actionsMap = newConfig.actions || {};
    const categoriesMap = newConfig.categories || {};

    const writes: Array<{ label: string; res: Promise<Response> }> = [];

    // Category master toggles
    Object.entries(categoriesMap).forEach(([catKey, isEnabled]) => {
      const dbKey = `${catKey}::__CATEGORY__`;
      const existingId = existingMap[dbKey];
      const payload = {
        event_category: catKey,
        event_type: '__CATEGORY__',
        is_enabled: isEnabled ? 1 : 0,
        updated_by: adminId || null,
        description: `Master switch for ${catKey}`,
      };

      if (existingId) {
        writes.push({
          label: dbKey,
          res: fetch(`${url}/${existingId}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(payload),
          }),
        });
      } else {
        writes.push({
          label: dbKey,
          res: fetch(url, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ ...payload, created_by: adminId || null }),
          }),
        });
      }
    });

    // Individual action toggles
    Object.entries(actionsMap).forEach(([catKey, actMap]) => {
      Object.entries(actMap).forEach(([actKey, isEnabled]) => {
        const dbKey = `${catKey}::${actKey}`;
        const existingId = existingMap[dbKey];
        const payload = {
          event_category: catKey,
          event_type: actKey,
          is_enabled: isEnabled ? 1 : 0,
          updated_by: adminId || null,
          description: `${actKey} action in ${catKey}`,
        };

        if (existingId) {
          writes.push({
            label: dbKey,
            res: fetch(`${url}/${existingId}`, {
              method: 'PATCH',
              headers: getHeaders(),
              body: JSON.stringify(payload),
            }),
          });
        } else {
          writes.push({
            label: dbKey,
            res: fetch(url, {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify({ ...payload, created_by: adminId || null }),
            }),
          });
        }
      });
    });

    const results = await Promise.allSettled(writes.map((w) => w.res));
    const failed = writes
      .map((w, i) => {
        const result = results[i]!;
        return result.status === 'fulfilled' && result.value.ok ? null : w.label;
      })
      .filter((label): label is string => label !== null);

    if (failed.length > 0) {
      warnings.push(`These audit settings did not save: ${failed.join(', ')}.`);
      // The writer reads this cache to decide whether an event is recorded at
      // all, so a partially applied config must not be kept as if it were.
      cachedAuditConfig = null;
      lastConfigFetchTime = 0;
      return { config: newConfig, warnings };
    }

    cachedAuditConfig = { ...newConfig };
    lastConfigFetchTime = Date.now();
    return { config: cachedAuditConfig, warnings };
  } catch (err) {
    console.error("[updateAuditConfigRepo] Error updating audit config:", err);
    warnings.push("Audit settings could not be saved.");
  }

  cachedAuditConfig = null;
  lastConfigFetchTime = 0;
  return { config: newConfig, warnings };
}

export function getPHISOTimestamp(): string {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return dtf.format(now).replace(" ", "T") + "+08:00";
}

/**
 * vs_audit_trail.created_at is a zone-less DATETIME that Directus fills from a
 * UTC-normalised value, and both audit readers assume naive means UTC. A caller
 * that hands over a bare wall-clock string (the repo-wide getPHTimeString()
 * convention, e.g. the verification services) would otherwise be stored eight
 * hours off, so state the Manila offset before it is written.
 */
function auditTimestamp(value: string): string {
  if (/Z$/i.test(value) || /[+-]\d{2}:?\d{2}$/.test(value)) return value;
  const naive = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  return naive ? `${naive[1]}T${naive[2]}+08:00` : value;
}

async function insertAuditRecord(payload: Partial<AuditRecord>): Promise<void> {
  if (!DIRECTUS_BASE) throw new Error("Audit trail base URL is not configured.");

  // Check category and action toggle settings before inserting log
  if (payload.event_category) {
    const config = await fetchAuditConfigRepo();
    const cat = String(payload.event_category);
    const act = payload.action ? String(payload.action) : null;

    // 1. Check category master toggle
    if (config.categories && config.categories[cat] === false) {
      return;
    }

    // 2. Check individual action toggle
    if (act && config.actions && config.actions[cat] && config.actions[cat][act] === false) {
      return;
    }
  }

  const recordPayload = {
    ...payload,
    created_at: payload.created_at ? auditTimestamp(payload.created_at) : getPHISOTimestamp(),
  };

  const url = `${DIRECTUS_BASE}/items/vs_audit_trail`;
  const res = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(recordPayload),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Audit record rejected (${res.status}): ${errText.slice(0, 200)}`);
  }
}

/**
 * Best-effort log. Every un-awaited caller across the auth routes relies on this
 * never rejecting, so a lost row is only visible in the server log.
 */
export async function createAuditRecordRepo(payload: Partial<AuditRecord>): Promise<void> {
  try {
    await insertAuditRecord(payload);
  } catch (err) {
    console.error("[createAuditRecordRepo] Audit record emission error:", err);
  }
}

/**
 * For the admin actions that have to be provable after the fact — an export, a
 * status transition, a verification decision. Unlike the best-effort variant this
 * rejects when the row was not stored, so the caller can say the action went
 * unrecorded instead of implying it was logged.
 */
export async function createAuditRecordStrictRepo(payload: Partial<AuditRecord>): Promise<void> {
  await insertAuditRecord(payload);
}


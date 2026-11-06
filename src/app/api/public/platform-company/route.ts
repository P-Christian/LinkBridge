import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "")
  .split("#")[0]
  .trim()
  .replace(/\/$/, "");
const DIRECTUS_TOKEN = (process.env.DIRECTUS_STATIC_TOKEN || "")
  .split("#")[0]
  .trim();

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

function sanitizeBrandCopy(text: unknown, brandName: string): string | null {
  if (typeof text !== "string" || !text) return null;
  return text
    .replace(/VOS Sync/gi, brandName)
    .replace(/VOS-Sync/gi, brandName)
    .replace(/vosync\.com/gi, "linkbridge.com");
}

function normalizePlatformCompany(raw: Record<string, unknown> | null) {
  if (!raw) return null;
  const meta =
    typeof raw.metadata === "string"
      ? (() => {
          try {
            return JSON.parse(raw.metadata as string);
          } catch {
            return {};
          }
        })()
      : (raw.metadata as Record<string, unknown> | null) || {};

  const brandName = (raw.platform_name as string) || (meta.platform_name as string) || (raw.company_name as string) || "LinkBridge";

  return {
    ...raw,
    metadata: meta,
    platform_name: brandName,
    company_name: sanitizeBrandCopy(raw.company_name, brandName) || brandName,
    company_tagline: sanitizeBrandCopy(raw.company_tagline, brandName) || raw.company_tagline,
    company_short_description: sanitizeBrandCopy(raw.company_short_description, brandName) || raw.company_short_description,
    company_description: sanitizeBrandCopy(raw.company_description, brandName) || raw.company_description,
    company_mission: sanitizeBrandCopy(raw.company_mission, brandName) || raw.company_mission,
    company_vision: sanitizeBrandCopy(raw.company_vision, brandName) || raw.company_vision,
    platform_icon: (raw.platform_icon as string) || (meta.platform_icon as string) || "Briefcase",
    support_hours_days: (raw.support_hours_days as string) || (meta.support_hours_days as string) || "Mon–Fri",
    support_hours_time: (raw.support_hours_time as string) || (meta.support_hours_time as string) || "8am–5pm",
    support_hours_timezone: (raw.support_hours_timezone as string) || (meta.support_hours_timezone as string) || "Philippine Time (PHT)",
    values: Array.isArray(meta.values) ? meta.values.slice(0, 4) : [],
  };
}

async function fetchCompanyValues(companyId: number): Promise<unknown[] | null> {
  try {
    const valRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_platform_company_value?filter[company_id][_eq]=${companyId}&filter[is_active][_eq]=1&sort=display_order&limit=4`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (!valRes.ok) return null;
    const valJson = await valRes.json();
    if (Array.isArray(valJson.data) && valJson.data.length > 0) {
      return valJson.data.map((v: Record<string, unknown>) => ({
        id: v.id,
        company_id: v.company_id,
        title: v.title,
        description: v.description,
        desc: v.description,
        icon_name: v.icon_name,
        icon: v.icon_name,
        color: v.color,
        display_order: v.display_order,
        is_active: true,
        created_at: v.created_at,
        updated_at: v.updated_at,
      }));
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    if (!DIRECTUS_BASE) {
      return NextResponse.json({ data: null, error: "Directus API base URL not configured" }, { status: 500 });
    }

    // 1. First attempt to fetch the active primary company
    const primaryRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_platform_company?filter[is_primary][_eq]=1&filter[is_active][_eq]=1&limit=1`,
      {
        headers: getHeaders(),
        cache: "no-store",
      }
    );

    if (primaryRes.ok) {
      const primaryJson = await primaryRes.json();
      if (primaryJson.data && primaryJson.data.length > 0) {
        const rawComp = primaryJson.data[0];
        const normalized = normalizePlatformCompany(rawComp);
        if (normalized && rawComp.company_id) {
          const dbValues = await fetchCompanyValues(Number(rawComp.company_id));
          if (dbValues && dbValues.length > 0) {
            normalized.values = dbValues;
          }
        }
        return NextResponse.json({ data: normalized });
      }
    }

    // 2. Fallback to any active company ordered by display_order
    const fallbackRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_platform_company?filter[is_active][_eq]=1&sort[]=display_order&limit=1`,
      {
        headers: getHeaders(),
        cache: "no-store",
      }
    );

    if (fallbackRes.ok) {
      const fallbackJson = await fallbackRes.json();
      if (fallbackJson.data && fallbackJson.data.length > 0) {
        const rawComp = fallbackJson.data[0];
        const normalized = normalizePlatformCompany(rawComp);
        if (normalized && rawComp.company_id) {
          const dbValues = await fetchCompanyValues(Number(rawComp.company_id));
          if (dbValues && dbValues.length > 0) {
            normalized.values = dbValues;
          }
        }
        return NextResponse.json({ data: normalized });
      }
    }

    return NextResponse.json({ data: null });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ data: null, error: err.message || "Failed to fetch platform company" }, { status: 500 });
  }
}

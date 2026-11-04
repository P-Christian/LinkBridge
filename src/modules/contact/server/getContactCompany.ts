import { directusSettled } from "@/lib/server/directus";
import type { PlatformCompany } from "@/modules/vos-admin/platform-company/types/platformCompany.types";

const TABLE = "vs_platform_company";

function normalizePlatformCompany(raw: Record<string, unknown> | null): PlatformCompany | null {
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

  return {
    ...raw,
    metadata: meta,
    platform_name:
      (raw.platform_name as string) ||
      (meta.platform_name as string) ||
      (raw.company_name as string) ||
      "VOS Sync",
    platform_icon: (raw.platform_icon as string) || (meta.platform_icon as string) || "Briefcase",
    support_hours_days:
      (raw.support_hours_days as string) || (meta.support_hours_days as string) || "Mon–Fri",
    support_hours_time:
      (raw.support_hours_time as string) || (meta.support_hours_time as string) || "8am–5pm",
    support_hours_timezone:
      (raw.support_hours_timezone as string) ||
      (meta.support_hours_timezone as string) ||
      "Philippine Time (PHT)",
    values: Array.isArray(meta.values) ? meta.values.slice(0, 4) : [],
  } as unknown as PlatformCompany;
}

export async function getContactCompany(): Promise<PlatformCompany | null> {
  try {
    // 1. Fetch active primary company
    const primaryRes = await directusSettled<{ data?: Record<string, unknown>[] }>(
      `/items/${TABLE}`,
      {
        query: "filter[is_primary][_eq]=1&filter[is_active][_eq]=1&limit=1",
      }
    );

    if (primaryRes.ok && primaryRes.data?.data && primaryRes.data.data.length > 0) {
      return normalizePlatformCompany(primaryRes.data.data[0]);
    }

    // 2. Fallback to any active company ordered by display_order
    const fallbackRes = await directusSettled<{ data?: Record<string, unknown>[] }>(
      `/items/${TABLE}`,
      {
        query: "filter[is_active][_eq]=1&sort[]=display_order&limit=1",
      }
    );

    if (fallbackRes.ok && fallbackRes.data?.data && fallbackRes.data.data.length > 0) {
      return normalizePlatformCompany(fallbackRes.data.data[0]);
    }

    return null;
  } catch {
    return null;
  }
}

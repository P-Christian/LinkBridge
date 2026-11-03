// src/app/api/vos-admin/platform-company/_values.ts
import { directusSettled } from "@/lib/server/directus";

const TABLE = "vs_platform_company_value";
/** The editor accepts at most four values per company. */
const MAX_VALUES = 4;

export interface CompanyValueInput {
  title: string;
  description: string;
  icon_name: string;
  color: string;
  display_order: number;
  is_active: number;
}

export function mapValueRow(row: object): Record<string, unknown> {
  const v = row as Record<string, unknown>;
  return {
    id: v.id,
    company_id: v.company_id,
    title: v.title,
    description: v.description,
    desc: v.description,
    icon_name: v.icon_name,
    icon: v.icon_name,
    color: v.color,
    display_order: v.display_order,
    is_active: Number(v.is_active) === 1 || v.is_active === true,
    created_at: v.created_at,
    updated_at: v.updated_at,
  };
}

/**
 * Writes the submitted values for one company and reports what did not land.
 *
 * A value that fails to save is returned as a warning rather than an error: the
 * company row itself is already committed, and an admin told the whole request
 * failed would retry it and re-write rows that did succeed.
 */
export async function syncCompanyValues(
  companyId: number,
  submitted: Array<Record<string, unknown>>,
  timestamp: string
): Promise<{ values: Array<Record<string, unknown>>; warnings: string[] }> {
  const warnings: string[] = [];
  const values = submitted.slice(0, MAX_VALUES);

  const lookup = await directusSettled<{ data?: Array<{ id?: unknown }> }>(`/items/${TABLE}`, {
    query: `filter[company_id][_eq]=${companyId}&fields=id&limit=${MAX_VALUES * 2}`,
  });
  const currentRows = lookup.ok && Array.isArray(lookup.data?.data) ? lookup.data.data : null;
  if (!currentRows) {
    // Without the stored rows there is no way to tell an edit from a new value,
    // and treating every submission as new would add duplicates instead.
    return { values: [], warnings: ["The company values could not be saved."] };
  }

  const existingIds = new Set<number>(
    currentRows.map((row) => Number(row.id)).filter((id) => Number.isSafeInteger(id) && id > 0)
  );

  const retainedIds = new Set<number>();
  const saved: Array<Record<string, unknown>> = [];

  for (let idx = 0; idx < values.length; idx++) {
    const val = values[idx]!;
    const title = String(val.title || "").trim() || `Value ${idx + 1}`;
    const body: CompanyValueInput & { company_id: number; updated_at: string } = {
      company_id: companyId,
      title: String(val.title || ""),
      description: String(val.description || val.desc || ""),
      icon_name: String(val.icon_name || val.icon || "HeartHandshake"),
      color: String(val.color || "bg-blue-500/10 text-blue-500"),
      display_order: typeof val.display_order === "number" ? val.display_order : idx + 1,
      is_active: val.is_active === false || Number(val.is_active) === 0 ? 0 : 1,
      updated_at: timestamp,
    };

    const rawId = val.id ? Number(val.id) : null;
    if (rawId && existingIds.has(rawId)) {
      const patched = await directusSettled<{ data?: Record<string, unknown> }>(
        `/items/${TABLE}/${rawId}`,
        { method: "PATCH", body }
      );
      if (patched.ok) {
        retainedIds.add(rawId);
        saved.push(mapValueRow(patched.data?.data ?? body));
      } else {
        warnings.push(`"${title}" kept its previous text.`);
      }
      continue;
    }

    const created = await directusSettled<{ data?: { id?: unknown } }>(`/items/${TABLE}`, {
      method: "POST",
      body: { ...body, created_at: timestamp },
    });
    const newId = Number(created.data?.data?.id);
    if (created.ok && Number.isSafeInteger(newId) && newId > 0) {
      retainedIds.add(newId);
      saved.push(mapValueRow({ ...body, id: newId, company_id: companyId }));
    } else {
      warnings.push(`"${title}" was not saved.`);
    }
  }

  for (const existingId of existingIds) {
    if (retainedIds.has(existingId)) continue;
    const removed = await directusSettled(`/items/${TABLE}/${existingId}`, { method: "DELETE" });
    if (!removed.ok) {
      warnings.push(`An outdated value (id ${existingId}) could not be removed.`);
    }
  }

  return { values: saved, warnings };
}

// src/app/api/vos-admin/platform-company/_primary.ts
import { directusSettled } from "@/lib/server/directus";

const TABLE = "vs_platform_company";

export type ResolvedCompany =
  | { ok: true; companyId: number }
  | { ok: false; status: number; error: string };

function rowId(value: unknown): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Decides which `vs_platform_company` row a request should touch.
 *
 * When the caller names a row, that row is the only acceptable answer. The
 * version this replaced fell back to "the primary company" whenever the named
 * id was absent *or* Directus was briefly unreadable, so an edit intended for
 * company 7 was silently applied to whichever company happened to be primary —
 * and the editor then re-read that company and confirmed the wrong row back to
 * the admin. A named-but-missing row is a 404, an unreadable one a 502.
 *
 * With no id supplied the collection is treated as the singleton the admin
 * module assumes, so the primary row (then lowest `display_order`) is used.
 */
export async function resolveCompanyId(suppliedId?: unknown): Promise<ResolvedCompany> {
  const named = suppliedId !== undefined && suppliedId !== null && suppliedId !== "";
  if (named) {
    const id = rowId(suppliedId);
    if (!id) return { ok: false, status: 400, error: "Invalid company id." };

    const found = await directusSettled<{ data?: { company_id?: unknown } | null }>(
      `/items/${TABLE}/${id}`,
      { query: "fields=company_id" }
    );
    if (!found.ok) {
      return found.status === 404
        ? { ok: false, status: 404, error: `Platform company ${id} not found.` }
        : { ok: false, status: 502, error: `Could not read platform company ${id}.` };
    }
    const companyId = rowId(found.data?.data?.company_id);
    return companyId
      ? { ok: true, companyId }
      : { ok: false, status: 404, error: `Platform company ${id} not found.` };
  }

  const first = await directusSettled<{ data?: Array<{ company_id?: unknown }> }>(
    `/items/${TABLE}`,
    {
      query: "sort[]=-is_primary&sort[]=display_order&sort[]=company_id&limit=1&fields=company_id",
    }
  );
  if (!first.ok) {
    return {
      ok: false,
      status: 502,
      error: "Could not read the platform company records.",
    };
  }
  const companyId = rowId(first.data?.data?.[0]?.company_id);
  return companyId
    ? { ok: true, companyId }
    : { ok: false, status: 404, error: "No platform company record exists yet." };
}

/**
 * Clears `is_primary` on every company except `keepId`, and returns a message
 * describing why that could not be done — or `null` on success.
 *
 * The callers all promote `keepId` right after this, so a demotion that quietly
 * fails leaves two rows flagged primary while the admin is told the switch
 * worked. Returning the reason lets them abort the promotion instead.
 */
export async function demoteOtherPrimaries(keepId: number): Promise<string | null> {
  const lookup = await directusSettled<{ data?: Array<{ company_id: number }> }>(
    `/items/${TABLE}`,
    { query: "filter[is_primary][_eq]=1&fields=company_id" }
  );
  if (!lookup.ok) {
    return "Could not read which company is currently primary, so the primary company was not changed.";
  }

  const rows = Array.isArray(lookup.data?.data) ? lookup.data.data : [];
  const others = rows
    .map((row) => Number(row.company_id))
    .filter((id) => Number.isSafeInteger(id) && id > 0 && id !== keepId);
  if (others.length === 0) return null;

  const results = await Promise.all(
    others.map((id) =>
      directusSettled(`/items/${TABLE}/${id}`, { method: "PATCH", body: { is_primary: 0 } })
    )
  );
  const failed = others.filter((_, index) => !results[index]!.ok);
  if (failed.length === 0) return null;

  return `Could not clear the primary flag on company id ${failed.join(", ")}, so the primary company was not changed.`;
}

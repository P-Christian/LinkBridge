// Directus connection + JSON helpers for the employer assessment-review APIs.
// Mirrors the freelancer assessment directus module conventions.

const DIRECTUS_BASE = (
  process.env.DIRECTUS_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  ""
).replace(/\/$/, "");

const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

export function directusBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.DIRECTUS_URL ||
    DIRECTUS_BASE;
  return (raw ?? "").split("#")[0].trim().replace(/\/+$/, "");
}

export function directusHeaders(): Record<string, string> {
  const token = (process.env.DIRECTUS_STATIC_TOKEN || DIRECTUS_TOKEN || "")
    .split("#")[0]
    .trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/** Philippine local-time string, matching the pipeline/job services. */
export function nowPH(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function collectionData(json: unknown): Record<string, unknown>[] {
  if (typeof json !== "object" || json === null) return [];
  const data = (json as { data?: unknown }).data;
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

export async function directusList(
  collection: string,
  params: URLSearchParams,
): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${directusBase()}/items/${collection}?${params.toString()}`, {
    headers: directusHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Directus list ${collection} failed: ${response.status}`);
  return collectionData(await parseJson(response));
}

export async function directusGetOne(
  collection: string,
  id: number | string,
  fields: string,
): Promise<Record<string, unknown> | null> {
  const result = await directusGetOneSettled(collection, id, fields);
  return result.ok ? result.row : null;
}

export type SingleItemRead =
  | { ok: true; row: Record<string, unknown> | null }
  | { ok: false; status: number };

/**
 * Single-item read that keeps "this row does not exist" apart from "we could
 * not look". `directusGetOne` collapses both to null, which is what an
 * after-write re-read wants; an authorization check cannot use it, because the
 * difference decides a 404 versus a 502.
 */
export async function directusGetOneSettled(
  collection: string,
  id: number | string,
  fields: string,
): Promise<SingleItemRead> {
  const cleanFields = fields
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean)
    .join(",");
  const response = await fetch(
    `${directusBase()}/items/${collection}/${encodeURIComponent(String(id))}?fields=${cleanFields}`,
    { headers: directusHeaders(), cache: "no-store" },
  );
  if (!response.ok) return { ok: false, status: response.status };
  const json = (await parseJson(response)) as { data?: unknown } | null;
  const data = json?.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: true, row: null };
  }
  return { ok: true, row: data as Record<string, unknown> };
}

export async function directusPost(
  collection: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; row: Record<string, unknown> | null }> {
  const response = await fetch(`${directusBase()}/items/${collection}`, {
    method: "POST",
    headers: directusHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await parseJson(response)) as { data?: unknown } | null;
  const data = json?.data;
  const row =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  return { ok: response.ok, status: response.status, row };
}

export async function directusPatch(
  collection: string,
  id: number | string,
  body: Record<string, unknown>,
): Promise<boolean> {
  const response = await fetch(
    `${directusBase()}/items/${collection}/${encodeURIComponent(String(id))}`,
    {
      method: "PATCH",
      headers: directusHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  return response.ok;
}

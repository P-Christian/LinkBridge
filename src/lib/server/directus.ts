// src/lib/server/directus.ts
import { directusBase, directusToken } from "./env";
import { chunk, mapPool } from "./pool";

/**
 * An upstream Directus failure. `status` mirrors the Directus response so a
 * route can forward it, which is what the current hand-rolled clients do.
 */
export class DirectusError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DirectusError";
    this.status = status;
  }
}

export interface DirectusRequestInit {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Request body; serialized as JSON. */
  body?: unknown;
  /**
   * Pre-built Directus query string without a leading `?`, e.g.
   * `filter[user_id][_eq]=4&fields=id,name&limit=100`. Left raw because the
   * bracket operators callers use are already URL-safe and encoding them would
   * change which rows Directus returns.
   */
  query?: string;
  headers?: Record<string, string>;
  cache?: RequestCache;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: string): string {
  const base = directusBase();
  if (!base) throw new DirectusError(500, "Directus base URL is not configured.");
  const suffix = query ? `${path.includes("?") ? "&" : "?"}${query.replace(/^\?/, "")}` : "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}${suffix}`;
}

function buildHeaders(init: DirectusRequestInit): Record<string, string> {
  const token = directusToken();
  return {
    Accept: "application/json",
    ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...init.headers,
  };
}

/** Directus reports failures as `errors: [{ message }]`; some shims use `error`. */
function upstreamMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as { errors?: unknown; error?: unknown };
    const first = Array.isArray(record.errors) ? record.errors[0] : undefined;
    const nested =
      first && typeof first === "object"
        ? (first as { message?: unknown }).message
        : undefined;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
    if (typeof record.error === "string" && record.error.trim()) return record.error.trim();
    if (first && typeof first === "object") {
      const extensions = (first as { extensions?: { message?: unknown } }).extensions;
      if (typeof extensions?.message === "string" && extensions.message.trim()) {
        return extensions.message.trim();
      }
    }
  }
  return fallback;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text.slice(0, 500) };
  }
}

export interface SettledDirectusResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string;
}

/**
 * Issues a Directus request and never throws on a non-2xx response. Use this
 * where the caller branches on success — the "look for an existing row, create
 * if absent" flows — instead of swallowing `DirectusError`.
 */
export async function directusSettled<T = unknown>(
  path: string,
  init: DirectusRequestInit = {}
): Promise<SettledDirectusResponse<T>> {
  const response = await fetch(buildUrl(path, init.query), {
    method: init.method ?? "GET",
    headers: buildHeaders(init),
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    cache: init.cache ?? "no-store",
    ...(init.signal ? { signal: init.signal } : {}),
  });
  const payload = await parseBody(response);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data: null,
      error: upstreamMessage(payload, `Directus request failed (${response.status}).`),
    };
  }
  return { ok: true, status: response.status, data: payload as T, error: "" };
}

/** Issues a Directus request and returns the parsed envelope. */
export async function directusRequest<T = unknown>(
  path: string,
  init: DirectusRequestInit = {}
): Promise<T> {
  const settled = await directusSettled<T>(path, init);
  if (!settled.ok) throw new DirectusError(settled.status, settled.error);
  return settled.data as T;
}

interface DirectusEnvelope<T> {
  data?: T;
}

/** `GET /items/<collection>` as an array; empty rather than null when no rows. */
export async function directusItems<T = Record<string, unknown>>(
  collection: string,
  init: DirectusRequestInit = {}
): Promise<T[]> {
  const envelope = await directusRequest<DirectusEnvelope<T[]>>(`/items/${collection}`, init);
  return Array.isArray(envelope?.data) ? envelope.data : [];
}

/** `GET /items/<collection>/<id>` as a single row, or `null` when absent. */
export async function directusItem<T = Record<string, unknown>>(
  collection: string,
  id: string | number,
  init: DirectusRequestInit = {}
): Promise<T | null> {
  const envelope = await directusRequest<DirectusEnvelope<T | null>>(
    `/items/${collection}/${id}`,
    init
  );
  return envelope?.data ?? null;
}

export interface BatchedItemsOptions {
  /** Ids carried by one request. Defaults to 200. */
  batch?: number;
  /** Requests in flight. Defaults to 4. */
  size?: number;
  /** Raw Directus query segments appended to every batch (sorts, extra filters). */
  extra?: string;
}

/**
 * `GET /items/<collection>?filter[<field>][_in]=…` over an id list, in bounded
 * batches that each read every matching row.
 *
 * Both hand-rolled alternatives lose rows without saying so: one request cannot
 * carry every id once a company's history is long (an over-long URL fails at the
 * transport layer), and a fixed `limit=` drops whatever sits past it. Either way
 * the caller gets a short list and renders it as "no related rows" — an
 * application reads as having no candidate, an applicant as having no skills.
 *
 * A failed batch rejects the whole read rather than returning the batches that
 * did land: a partial attach list is the same silent wrong answer.
 */
export async function directusItemsWhereIn<T = Record<string, unknown>>(
  collection: string,
  field: string,
  ids: readonly (string | number)[],
  fields: string,
  options: BatchedItemsOptions = {}
): Promise<T[]> {
  const keyList = ids.filter((id) => id !== null && id !== undefined && id !== "");
  if (keyList.length === 0) return [];

  const batches = chunk(keyList, options.batch ?? 200);
  const rows = await mapPool(
    batches,
    (batch) => {
      const extra = options.extra ? `&${options.extra.replace(/^&/, "")}` : "";
      const limitQuery = /[?&]?limit=/.test(extra) ? "" : "&limit=-1";
      return directusItems<T>(collection, {
        query: `filter[${field}][_in]=${batch.join(",")}&fields=${fields}${limitQuery}${extra}`,
      });
    },
    options.size ?? 4
  );

  return rows.flat();
}

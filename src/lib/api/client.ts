// src/lib/api/client.ts
"use client";

/** A failed `/api` call. `message` is already safe to show to a user. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.body = body;
  }
}

export type QueryValue = string | number | boolean | null | undefined;

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  cache?: RequestCache;
  /**
   * Shown when the response carries no `error` or `message`, so a caller can
   * keep its own wording ("Failed to star notification.") for a bare failure.
   */
  errorText?: string;
}

type ApiCallOptions = Omit<ApiRequestOptions, "method" | "body">;

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = path.startsWith("/") ? path : `/${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  if (!search) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${search}`;
}

/** Server routes answer with `{ error }`; the older auth endpoints use `{ message }`. */
function resolveErrorMessage(status: number, body: unknown, errorText?: string): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    for (const key of ["error", "message"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return errorText ?? `Request failed (${status}).`;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Calls a same-origin `/api` route and returns the parsed body.
 *
 * Aborted reads rethrow the original `AbortError` unchanged so callers keep
 * treating a superseded read as "not an error".
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { method = "GET", body, query, headers, signal, cache, errorText } = options;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
      ...(cache ? { cache } : {}),
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (signal?.aborted) throw err;
    throw new ApiRequestError(0, errorText ?? "Unable to reach the server. Check your connection.", null);
  }

  const text = await response.text();
  const payload: unknown = text ? safeJson(text) : null;

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      resolveErrorMessage(response.status, payload, errorText),
      payload
    );
  }
  return payload as T;
}

export function apiGet<T = unknown>(path: string, options?: ApiCallOptions): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "GET" });
}

export function apiPost<T = unknown>(
  path: string,
  body?: unknown,
  options?: ApiCallOptions
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "POST", body });
}

export function apiPatch<T = unknown>(
  path: string,
  body?: unknown,
  options?: ApiCallOptions
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "PATCH", body });
}

export function apiPut<T = unknown>(
  path: string,
  body?: unknown,
  options?: ApiCallOptions
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "PUT", body });
}

export function apiDelete<T = unknown>(
  path: string,
  body?: unknown,
  options?: ApiCallOptions
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "DELETE", body });
}

// src/lib/server/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  authenticateRequest,
  isAdministratorSession,
  isClientSession,
  isFreelancerSession,
  isSchoolAdminSession,
  type AuthenticatedSession,
} from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";
import {
  getClientIp,
  rateLimitRetryAfterMs,
  tooManyRequestsResponse,
} from "@/lib/rate-limit";
import { DirectusError } from "./directus";

/** A client-facing failure with an explicit HTTP status. */
export class HttpError extends Error {
  readonly status: number;
  readonly extra: Record<string, unknown>;

  constructor(status: number, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.extra = extra;
  }
}

export function badRequest(message: string, extra?: Record<string, unknown>): HttpError {
  return new HttpError(400, message, extra);
}

export function forbidden(message = "Forbidden.", extra?: Record<string, unknown>): HttpError {
  return new HttpError(403, message, extra);
}

export function notFound(message = "Not found.", extra?: Record<string, unknown>): HttpError {
  return new HttpError(404, message, extra);
}

/** Success body. Handlers may also return a `Response` to set status or headers. */
export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

const ROLE_GUARDS = {
  client: { predicate: isClientSession, message: "Forbidden: employer access required." },
  freelancer: {
    predicate: isFreelancerSession,
    message: "Forbidden: Freelancer access required.",
  },
  admin: {
    predicate: isAdministratorSession,
    message: "Forbidden: Restricted to administrators.",
  },
  schoolAdmin: {
    predicate: isSchoolAdminSession,
    message: "Forbidden: School administrators only.",
  },
} as const;

export type RouteRole = keyof typeof ROLE_GUARDS;

export interface RouteContext {
  req: NextRequest;
  /**
   * Guaranteed for every guarded route. Read it on an `auth: "public"` route
   * only after null-checking, since such routes may have no caller at all.
   */
  session: AuthenticatedSession;
  params: Record<string, string | string[]>;
}

export interface WithRouteOptions {
  /**
   * Defaults to requiring a session, so a route is never accidentally open.
   * `"public"` skips authentication entirely; `"any"` requires a valid session
   * of any role. Every guarded option runs revocation and the dev bypass
   * through `authenticated-session`, so no caller can skip them.
   */
  auth?: "public" | "any" | RouteRole;
  /** Budget applied per IP and, once a session resolves, per account. */
  rateLimit?: { scope: string; limit: number; windowMs: number };
}

type RouteResult = NextResponse | Response | unknown;
type RouteHandler = (ctx: RouteContext) => Promise<RouteResult> | RouteResult;
type RouteEvent = { params?: Promise<Record<string, string | string[]>> };
export type RouteMethod<Ctx> = (req: NextRequest, event?: Ctx) => Promise<Response>;

/**
 * Wraps an API handler so authentication, rate limiting and the `{ error }`
 * envelope are stated once instead of re-typed per route.
 *
 * Thrown `HttpError` and `DirectusError` become their own status with the
 * message kept (both are authored upstream by us or Directus and are already
 * safe to show). Anything else becomes a generic 500 whose cause is logged.
 */
export function withRoute(
  handler: RouteHandler,
  options: WithRouteOptions = {}
): (req: NextRequest, event?: RouteEvent) => Promise<Response> {
  return async (req, event) => {
    try {
      // Rate limiting runs before authentication. Verifying a token costs two
      // Directus reads, so an anonymous flood of guessed tokens used to be the
      // cheapest way to take the API down; a counter keyed on the caller's
      // address answers that for free.
      const limit = options.rateLimit;
      let ipRetryAfterMs = 0;
      if (limit) {
        ipRetryAfterMs = rateLimitRetryAfterMs(
          limit.scope,
          getClientIp(req),
          limit.limit,
          limit.windowMs
        );
      }

      const auth = options.auth ?? "any";
      let session: AuthenticatedSession | null = null;

      if (auth !== "public") {
        session = await authenticateRequest(req);
        if (!session) return json({ error: "Unauthorized." }, 401);

        if (auth !== "any") {
          const guard = ROLE_GUARDS[auth];
          if (!guard.predicate(session)) {
            return json({ error: guard.message }, 403);
          }
        }
      }

      if (limit) {
        // A second bucket keyed on the account, so one caller rotating
        // addresses cannot keep hammering a single account's budget and a
        // shared NAT does not inherit one abuser's throttle.
        if (ipRetryAfterMs > 0) return tooManyRequestsResponse(ipRetryAfterMs);
        if (session) {
          const userRetryAfterMs = rateLimitRetryAfterMs(
            limit.scope,
            `user:${session.userId}`,
            limit.limit,
            limit.windowMs
          );
          if (userRetryAfterMs > 0) return tooManyRequestsResponse(userRetryAfterMs);
        }
      }

      const result = await handler({
        req,
        session: session as AuthenticatedSession,
        params: (await event?.params) ?? {},
      });

      if (result instanceof Response) return result;
      if (result === undefined) return new NextResponse(null, { status: 204 });
      return json(result);
    } catch (err: unknown) {
      if (err instanceof HttpError) {
        return json({ error: err.message, ...err.extra }, err.status);
      }
      if (err instanceof DirectusError) {
        return json({ error: err.message }, err.status >= 500 ? 502 : err.status);
      }
      return json({ error: safeErrorMessage(err, "Internal server error") }, 500);
    }
  };
}

/**
 * A path/query/body id as a positive integer, or null. Route params arrive
 * percent-decoded and JSON body fields are untyped, so anything interpolated
 * into a Directus filter URL or written into a row must pass through this first.
 */
export function toId(raw: unknown): number | null {
  // Accepted types only: Number(true) is 1 and Number([]) is 0, so a boolean or
  // array id from a hand-built request would otherwise become a valid row.
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** `params.id` as a positive integer, or a 400. Replaces the per-route NaN guard. */
export function readId(
  params: Record<string, string | string[]>,
  name = "id"
): number {
  const raw = params[name];
  const value = toId(Array.isArray(raw) ? raw[0] : raw);
  if (value === null) {
    throw badRequest("Invalid ID");
  }
  return value;
}

/** Parses a JSON object body, or a 400. */
export async function readBody(
  req: NextRequest
): Promise<Record<string, unknown>> {
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw badRequest("A JSON object body is required.");
  }
  return body as Record<string, unknown>;
}

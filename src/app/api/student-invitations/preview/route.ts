import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hashClientIp } from "@/modules/auth/registration/registration.crypto";
import {
  findCourseById,
  findInvitationByToken,
  findSchoolById,
  findStudentById,
} from "@/modules/auth/student-invitation/invitation.repo";
import { buildPreview } from "@/modules/auth/student-invitation/invitation.service";
import { requireJwtSecret } from "@/modules/auth/registration/registration.session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const previewTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9_-]+$/u);
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 30;
const MAX_TRACKED_CLIENTS = 10_000;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

interface RateLimitEntry {
  readonly requests: number;
  readonly resetAt: number;
}

/**
 * Process-local limiter state is intentionally bounded. It provides a small
 * abuse barrier without persisting raw client IPs; distributed limiting can
 * replace it later without changing the preview contract.
 */
const rateLimits = new Map<string, RateLimitEntry>();

function previewJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function getClientIp(request: NextRequest): string {
  const forwardedIp = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwardedIp || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function exceedsRateLimit(ipHash: string, now: number): boolean {
  const current = rateLimits.get(ipHash);
  if (!current || current.resetAt <= now) {
    if (!current && rateLimits.size >= MAX_TRACKED_CLIENTS) {
      for (const [key, entry] of rateLimits) {
        if (entry.resetAt <= now) rateLimits.delete(key);
      }
      if (rateLimits.size >= MAX_TRACKED_CLIENTS) return true;
    }

    rateLimits.set(ipHash, { requests: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (current.requests >= RATE_LIMIT_REQUESTS) return true;
  rateLimits.set(ipHash, { ...current, requests: current.requests + 1 });
  return false;
}

/** Return a masked, read-only preview of a student invitation. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const now = Date.now();

  try {
    const ipHashSecret =
      process.env.REGISTRATION_OTP_HMAC_SECRET?.trim() || requireJwtSecret();

    const ipHash = hashClientIp(getClientIp(request), ipHashSecret);
    if (exceedsRateLimit(ipHash, now)) {
      return previewJson(
        { error: "Too many requests.", code: "RATE_LIMITED" },
        429
      );
    }

    const parsedToken = previewTokenSchema.safeParse(
      request.nextUrl.searchParams.get("token")
    );
    if (!parsedToken.success) {
      return previewJson(
        { error: "Invalid request.", code: "INVALID_REQUEST" },
        400
      );
    }

    const invitation = await findInvitationByToken(parsedToken.data);
    if (!invitation) {
      return previewJson(
        buildPreview({ invitation: null, student: null, school: null, course: null, now })
      );
    }

    const student = await findStudentById(invitation.student_id);
    if (!student) {
      return previewJson(
        buildPreview({ invitation, student, school: null, course: null, now })
      );
    }
    if (invitation.school_id !== student.school_id) {
      console.warn("[student-invitation.preview] School binding mismatch");
      return previewJson(
        buildPreview({ invitation, student, school: null, course: null, now })
      );
    }

    const [school, course] = await Promise.all([
      findSchoolById(invitation.school_id),
      student.school_course_id === null
        ? Promise.resolve(null)
        : findCourseById(student.school_course_id),
    ]);

    return previewJson(buildPreview({ invitation, student, school, course, now }));
  } catch (error: unknown) {
    console.error("[student-invitation.preview] Request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return previewJson(
      { error: "Unable to preview invitation.", code: "SERVICE_UNAVAILABLE" },
      500
    );
  }
}

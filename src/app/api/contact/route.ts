// src/app/api/contact/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { getPHTimeString } from "@/lib/utils";
import { extractClientIp } from "@/lib/auth-utils";
import { authenticateRequest } from "@/lib/authenticated-session";
import { insertContactMessageRepo } from "@/modules/vos-admin/contact-messages";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------
const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name must be 100 characters or less."),
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .max(254, "Email must be 254 characters or less.")
    .email("Please enter a valid email address."),
  company: z
    .string()
    .trim()
    .max(150, "Company must be 150 characters or less.")
    .optional()
    .default(""),
  subject: z
    .string()
    .trim()
    .min(1, "Subject is required.")
    .max(150, "Subject must be 150 characters or less."),
  message: z
    .string()
    .trim()
    .min(1, "Message is required.")
    .max(5000, "Message must be 5000 characters or less."),
  // Honeypot — must be absent or empty
  website: z.string().optional(),
});

// ---------------------------------------------------------------------------
// In-memory rate limiter: 5 submissions per 10 minutes per IP hash
// NOTE: Single-server only. Use Redis/Upstash for multi-instance production.
// ---------------------------------------------------------------------------
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function checkRateLimit(ipHash: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ipHash);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ipHash, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }

  entry.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // -- 1. Extract & hash the client IP (never store raw IP)
    const rawIp = extractClientIp(req.headers) ?? "unknown";
    const ipHash = crypto.createHash("sha256").update(rawIp).digest("hex");

    // -- 2. Rate limit check
    const { allowed, retryAfterMs } = checkRateLimit(ipHash);
    if (!allowed) {
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      return NextResponse.json(
        {
          message: `Too many submissions. Please wait ${Math.ceil(retryAfterSec / 60)} minute(s) before trying again.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        }
      );
    }

    // -- 3. Parse body (reject non-JSON)
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }

    // -- 4. Zod validation
    const parsed = contactSchema.safeParse(rawBody);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      return NextResponse.json(
        { message: "Please fix the errors below.", fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, company, subject, message, website } = parsed.data;

    // -- 5. Honeypot: if filled, silently return success without storing
    if (website && website.trim().length > 0) {
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    // -- 6. Read session (optional — logged-in user context only)
    let userId: number | string | null = null;
    let userRole: string | null = null;
    try {
      const session = await authenticateRequest(req);
      if (session) {
        userId = session.userId;
        userRole = session.roleName || null;
      }
    } catch {
      // Auth failure is not a blocking error for the public contact form
    }

    // -- 7. Insert into Directus
    const now = getPHTimeString();
    await insertContactMessageRepo({
      name,
      email,
      company: company || null,
      subject,
      message,
      user_id: userId ? Number(userId) : null,
      user_role: userRole,
      status: "new",
      source: "web_form",
      ip_hash: ipHash,
      created_at: now,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    // Never leak internal errors to the client
    console.error("[POST /api/contact] Error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { message: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }
}

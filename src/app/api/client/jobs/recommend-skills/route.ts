// src/app/api/client/jobs/recommend-skills/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as jobService from "../service.directus";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import {
  getClientIp,
  rateLimitRetryAfterMs,
  tooManyRequestsResponse,
} from "@/lib/rate-limit";

import { safeErrorMessage } from "@/lib/api-error";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    // Unbounded free-text prompt sent to the model; throttled per employer.
    const userRetryAfterMs = rateLimitRetryAfterMs("recommend-skills:user", String(session.userId), 100, 300_000);
    const ipRetryAfterMs = rateLimitRetryAfterMs("recommend-skills:ip", getClientIp(req), 200, 300_000);
    const blockedForMs = userRetryAfterMs || ipRetryAfterMs;
    if (blockedForMs) return tooManyRequestsResponse(blockedForMs);

    const { searchParams } = new URL(req.url);
    const title = searchParams.get("title") || "";
    const description = searchParams.get("description") || "";

    if (!title.trim() && !description.trim()) {
      return NextResponse.json({ skills: [] });
    }

    const skills = await jobService.recommendSkills(title, description);
    return NextResponse.json({ skills });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

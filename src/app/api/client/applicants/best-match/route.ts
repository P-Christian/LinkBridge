// src/app/api/client/applicants/best-match/route.ts

import { NextRequest, NextResponse } from "next/server";
import { callGeminiMonitored } from "@/lib/gemini/geminiMonitoring";
import { evaluateTaxonomyProposal } from "@/modules/vos-admin/role-matching/services/taxonomy/taxonomyGovernanceService";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import {
  getClientIp,
  rateLimitRetryAfterMs,
  tooManyRequestsResponse,
} from "@/lib/rate-limit";

// The client builds this prompt from at most 20 ranked candidates.
const MAX_PROMPT_CHARS = 30_000;

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: employer access required." },
        { status: 403 }
      );
    }

    const userId = Number(session.userId);
    const companyId = session.payload?.company_id ? Number(session.payload.company_id) : undefined;

    const userRetryAfterMs = rateLimitRetryAfterMs("best-match:user", String(userId), 10, 600_000);
    const ipRetryAfterMs = rateLimitRetryAfterMs("best-match:ip", getClientIp(req), 20, 600_000);
    const blockedForMs = userRetryAfterMs || ipRetryAfterMs;
    if (blockedForMs) return tooManyRequestsResponse(blockedForMs);

    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { success: false, error: "Prompt is required." },
        { status: 400 }
      );
    }

    if (prompt.length > MAX_PROMPT_CHARS) {
      return NextResponse.json(
        { success: false, error: "Prompt exceeds the allowed length." },
        { status: 413 }
      );
    }

    const rawGemini = await callGeminiMonitored({
      prompt,
      feature: "BEST_MATCH",
      endpoint: "/api/client/applicants/best-match",
      userId,
      companyId,
    });

    if (!rawGemini) {
      // 503, not 200: the caller falls back to rule-engine summaries on any
      // non-ok answer, and a success status here made an AI outage look like a
      // completed run to anything else reading the response.
      return NextResponse.json(
        {
          success: false,
          result: null,
          message: "Gemini AI unavailable or API key not configured.",
        },
        { status: 503 }
      );
    }

    // Non-blocking asynchronous taxonomy governance enrichment on the server
    try {
      const cleaned = rawGemini
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      if (parsed?.taxonomyProposal && typeof parsed.taxonomyProposal === "object") {
        void evaluateTaxonomyProposal({
          roleName: parsed.taxonomyProposal.roleName || "",
          keywords: Array.isArray(parsed.taxonomyProposal.keywords) ? parsed.taxonomyProposal.keywords : [],
          skills: Array.isArray(parsed.taxonomyProposal.skills) ? parsed.taxonomyProposal.skills : [],
        })
          .then((res) => console.info("[BEST_MATCH API] ✅ Server-side Taxonomy Governance completed:", res))
          .catch((err) => console.error("[BEST_MATCH API] ⚠️ Server-side Taxonomy Governance failed:", err?.message ?? err));
      }
    } catch {
      // Non-blocking if JSON parsing fails
    }

    return NextResponse.json({
      success: true,
      result: rawGemini,
    });
  } catch (error) {
    console.error("[BestMatchAI API] Error generating AI match explanations:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

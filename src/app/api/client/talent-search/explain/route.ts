// src/app/api/client/talent-search/explain/route.ts

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";
import { generateMatchExplanation, generateCandidateSuitability, ExplainCandidate } from "@/lib/gemini/matchExplainer";
import { getCachedExplanation, setCachedExplanation } from "../search-ranking-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    const userId = Number(session.userId);
    const { isVerified, verification_status, companyId } = await checkCompanyVerificationStatus(userId);
    if (!isVerified) {
      return NextResponse.json(
        { error: `Restricted: Company status is ${verification_status}.` },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { keyword, candidate } = body as {
      keyword?: string;
      candidate?: ExplainCandidate & { id?: number | string };
    };

    if (!candidate || typeof candidate !== "object") {
      return NextResponse.json({ explanation: null });
    }

    // Input sanitization & bounds enforcement to prevent prompt injection and cost drain
    const sanitizedKeyword = typeof keyword === "string" ? keyword.trim().slice(0, 120) : "";
    const candidateCacheKey = candidate.id ?? candidate.name;
    const cacheLookupKey = sanitizedKeyword || "__suitability__";

    // Check backend in-memory cache first (shared across recruiters/sessions)
    const cachedExplanation = getCachedExplanation(candidateCacheKey, cacheLookupKey);
    if (cachedExplanation) {
      return NextResponse.json({
        explanation: cachedExplanation,
        cached: true,
        type: sanitizedKeyword ? "match" : "suitability",
      });
    }

    const sanitizedCandidate: ExplainCandidate = {
      name: String(candidate.name || "Candidate").trim().slice(0, 100),
      title: candidate.title ? String(candidate.title).trim().slice(0, 100) : null,
      summary: candidate.summary ? String(candidate.summary).trim().slice(0, 500) : null,
      skills: Array.isArray(candidate.skills)
        ? candidate.skills.slice(0, 20).map((s) => String(s).trim().slice(0, 50)).filter(Boolean)
        : [],
      experience_years: typeof candidate.experience_years === "number" && !isNaN(candidate.experience_years)
        ? Math.min(50, Math.max(0, candidate.experience_years))
        : 0,
    };

    let explanation: string | null = null;
    if (sanitizedKeyword) {
      explanation = await generateMatchExplanation(sanitizedKeyword, sanitizedCandidate, {
        userId: userId ?? undefined,
        companyId: companyId ?? undefined,
      });
    } else {
      explanation = await generateCandidateSuitability(sanitizedCandidate, {
        userId: userId ?? undefined,
        companyId: companyId ?? undefined,
      });
    }

    if (explanation) {
      setCachedExplanation(candidateCacheKey, cacheLookupKey, explanation);
    }

    return NextResponse.json({
      explanation,
      type: sanitizedKeyword ? "match" : "suitability",
    });
  } catch (err: unknown) {
    console.error("[talent-search/explain POST] Error:", err);
    return NextResponse.json({ explanation: null });
  }
}


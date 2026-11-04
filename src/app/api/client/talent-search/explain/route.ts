// src/app/api/client/talent-search/explain/route.ts

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";
import { generateMatchExplanation, ExplainCandidate } from "@/lib/gemini/matchExplainer";

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
      candidate?: ExplainCandidate;
    };

    if (!keyword || typeof keyword !== "string" || !candidate || typeof candidate !== "object") {
      return NextResponse.json({ explanation: null });
    }

    // Input sanitization & bounds enforcement to prevent prompt injection and cost drain
    const sanitizedKeyword = keyword.trim().slice(0, 120);
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

    const explanation = await generateMatchExplanation(sanitizedKeyword, sanitizedCandidate, {
      userId: userId ?? undefined,
      companyId: companyId ?? undefined,
    });

    return NextResponse.json({ explanation });
  } catch (err: unknown) {
    console.error("[talent-search/explain POST] Error:", err);
    return NextResponse.json({ explanation: null });
  }
}


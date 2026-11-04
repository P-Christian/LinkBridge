// src/app/api/client/campus-talent/match/route.ts
// POST: Runs the full campus matching pipeline for students against a selected job.
// Architecture: Eligibility → Deterministic Score → Evidence → Gemini Explanation
// Gemini does NOT modify scores. It explains deterministic evidence and gaps only.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";
import {
  CampusCandidate,
  NormalizedJobRequirements,
  CampusMatchResult,
} from "@/modules/matching-engine/campus/types";
import { normalizeJobRequirements, RawJobPosting } from "@/modules/matching-engine/campus/requirementNormalizer";
import { runCampusMatch } from "@/modules/matching-engine/campus/runCampusMatch";
import { generateCampusMatchExplanation } from "@/lib/gemini/campusMatchExplainer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

interface MatchRequestBody {
  job: RawJobPosting;
  candidates: CampusCandidate[];
  withExplanation?: boolean;
}

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
    if (!isVerified || !companyId) {
      return NextResponse.json(
        { error: `Restricted: Company status is ${verification_status}.` },
        { status: 403 }
      );
    }

    const body = (await req.json()) as MatchRequestBody;
    const { job, candidates, withExplanation = true } = body;

    if (!job || !Array.isArray(candidates)) {
      return NextResponse.json({ error: "Missing job or candidates." }, { status: 400 });
    }

    // Verify job ownership to prevent cross-tenant IDOR
    if (job.job_id) {
      const jobCheckRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_job_posting/${job.job_id}?fields=job_id,company_id`,
        { headers: getHeaders(), cache: "no-store" }
      );
      // Only 404 means the posting is gone; anything else was an outage that read
      // back to the recruiter as "your job does not exist".
      if (jobCheckRes.status === 404) {
        return NextResponse.json({ error: "Job posting not found." }, { status: 404 });
      }
      if (!jobCheckRes.ok) {
        return NextResponse.json(
          { error: "The job posting could not be verified. Please try again." },
          { status: 502 }
        );
      }
      const jobCheckData = await jobCheckRes.json();
      if (Number(jobCheckData.data?.company_id) !== Number(companyId)) {
        return NextResponse.json({ error: "Forbidden: You do not own this job posting." }, { status: 403 });
      }
    }

    if (candidates.length > 200) {
      return NextResponse.json({ error: "Maximum 200 candidates per batch." }, { status: 400 });
    }

    // Step 1: Normalize the job requirements (REQUIRED vs PREFERRED)
    const normalizedJob: NormalizedJobRequirements = normalizeJobRequirements(job);

    // Step 2: Run deterministic matching for each candidate
    const deterministicResults: CampusMatchResult[] = candidates.map((candidate) =>
      runCampusMatch(candidate, normalizedJob)
    );

    // Step 3: Sort by score descending (eligible first)
    deterministicResults.sort((a, b) => {
      if (a.eligibility.eligible && !b.eligibility.eligible) return -1;
      if (!a.eligibility.eligible && b.eligibility.eligible) return 1;
      return b.score - a.score;
    });

    // Step 4: Optionally enrich top eligible candidates with Gemini explanations
    // Only explain top 10 eligible candidates to stay within token budget
    if (withExplanation) {
      const eligible = deterministicResults.filter((r) => r.eligibility.eligible);
      const topCandidates = eligible.slice(0, 10);

      await Promise.allSettled(
        topCandidates.map(async (result) => {
          const explanation = await generateCampusMatchExplanation(result, job.job_title, {
            userId,
            companyId,
          });
          result.explanation = explanation;
        })
      );
    }

    return NextResponse.json({
      jobId: job.job_id,
      jobTitle: job.job_title,
      total: deterministicResults.length,
      eligibleCount: deterministicResults.filter((r) => r.eligibility.eligible).length,
      results: deterministicResults,
    });
  } catch (err: unknown) {
    console.error("[campus-talent/match POST]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

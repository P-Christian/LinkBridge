// src/app/api/client/jobs/categories/suggest/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { CANONICAL_ROLE_CATEGORIES } from "@/modules/client/jobs/hooks/useRoleCategories";
import { getPHTimeString } from "@/lib/utils";
import { safeErrorMessage } from "@/lib/api-error";
import {
  DirectusError,
  directusItems,
  directusSettled,
  directusRequest,
} from "@/lib/server/directus";
import { toId } from "@/lib/server/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

interface CompanyLinkRow {
  company_id?: number | string | null;
}

interface JobOwnershipRow {
  job_id: number;
  company_id?: number | string | null;
}

interface RoleCategoryRow {
  category_id?: number;
  category_code?: string;
  category_name: string;
}

/**
 * Only Directus' own 404 may tell the employer a row is gone. Every other
 * status means it could not be read, and answering 404 makes an outage look
 * like a deleted posting.
 */
function missingOrOutage(status: number, entity: string): NextResponse {
  if (status === 404) {
    return NextResponse.json({ error: `${entity} not found.` }, { status: 404 });
  }
  return NextResponse.json(
    { error: `${entity} could not be read. Please try again.` },
    { status: 502 }
  );
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return Math.max(0.75, minLen / maxLen);
  }

  // Token Jaccard index
  const words1 = new Set(s1.split(/[\s&/,-]+/));
  const words2 = new Set(s2.split(/[\s&/,-]+/));
  let intersection = 0;
  words1.forEach((w) => {
    if (words2.has(w) && w.length > 2) intersection++;
  });
  const union = new Set([...words1, ...words2]).size;
  return union > 0 ? intersection / union : 0;
}

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const userId = toId(session.userId);
    if (!userId) {
      return NextResponse.json({ error: "Invalid user." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const categoryName = String(body.category_name || "").trim().slice(0, MAX_NAME_LENGTH);
    const description = String(body.description || "").trim().slice(0, MAX_DESCRIPTION_LENGTH);

    if (!categoryName) {
      return NextResponse.json({ error: "Category name is required." }, { status: 400 });
    }

    // Attribution is resolved from the session, never from the request body.
    // A failed link read used to answer "No company linked." — an account
    // verdict drawn from an outage.
    const links = await directusItems<CompanyLinkRow>("vs_company_user", {
      query: `filter[user_id][_eq]=${userId}&fields=company_id&limit=1`,
    });
    const companyId = toId(links[0]?.company_id ?? null);
    if (!companyId) {
      return NextResponse.json({ error: "No company linked." }, { status: 403 });
    }

    const jobId = toId(body.job_id ?? null);
    if (body.job_id && !jobId) {
      return NextResponse.json({ error: "Invalid job id." }, { status: 400 });
    }
    if (jobId) {
      const jobRes = await directusSettled<JobOwnershipRow>(`/items/vs_job_posting/${jobId}`, {
        query: "fields=job_id,company_id",
      });
      if (!jobRes.ok) {
        return missingOrOutage(jobRes.status, "Job");
      }
      if (Number(jobRes.data?.company_id) !== companyId) {
        return NextResponse.json({ error: "Job not found." }, { status: 404 });
      }
    }

    // 1. Fetch active categories. Falling back to the built-in list when this
    // read failed made the duplicate check compare against the wrong taxonomy,
    // so an existing category was reported as novel and queued for admin review.
    const categories = await directusItems<RoleCategoryRow>("vs_role_category", {
      query: "fields=category_id,category_code,category_name&limit=-1",
    });
    const existingCategories: RoleCategoryRow[] =
      categories.length > 0 ? categories : CANONICAL_ROLE_CATEGORIES;

    // 2. Semantic matching against existing taxonomy
    let bestMatch = null;
    let highestConfidence = 0;

    for (const cat of existingCategories) {
      const scoreName = calculateSimilarity(categoryName, cat.category_name);
      const scoreCode = calculateSimilarity(categoryName, cat.category_code ?? "");
      const maxScore = Math.max(scoreName, scoreCode);

      if (maxScore > highestConfidence) {
        highestConfidence = maxScore;
        bestMatch = cat;
      }
    }

    // If exact or very high confidence match (>= 80%)
    if (highestConfidence >= 0.80 && bestMatch) {
      return NextResponse.json({
        has_existing_match: true,
        confidence: Math.round(highestConfidence * 100),
        existing_category: bestMatch,
        message: `A close matching category "${bestMatch.category_name}" already exists.`,
      });
    }

    // 3. Insert into vs_role_category_suggestion. The response promised
    // "submitted for admin review" even when the insert was never confirmed, so
    // the employer believed a suggestion the admin queue never received.
    const nowPH = getPHTimeString();
    const insertEnvelope = await directusRequest<{
      data?: { suggestion_id?: number; id?: number } | null;
    }>("/items/vs_role_category_suggestion", {
      method: "POST",
      body: {
        job_id: jobId,
        category_name: categoryName,
        category_description: description,
        company_id: companyId,
        suggested_by_user_id: userId,
        status: "PENDING",
        created_at: nowPH,
        updated_at: nowPH,
      },
    });
    const suggestionId = toId(insertEnvelope?.data?.suggestion_id ?? insertEnvelope?.data?.id ?? null);
    if (!suggestionId) {
      return NextResponse.json(
        { error: "The suggestion could not be recorded. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      has_existing_match: false,
      confidence: Math.round(highestConfidence * 100),
      closest_match: highestConfidence >= 0.45 ? bestMatch : null,
      suggestion_id: suggestionId,
      suggested_name: categoryName,
      message: "Category suggestion submitted for admin review. You may continue publishing your job.",
    });
  } catch (err: unknown) {
    console.error("[client/jobs/categories/suggest POST]", err);
    if (err instanceof DirectusError) {
      return NextResponse.json(
        { error: "Category suggestion could not be processed. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(err, "Server error") },
      { status: 500 }
    );
  }
}

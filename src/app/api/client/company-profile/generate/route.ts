// src/app/api/client/company-profile/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { callGeminiMonitored } from "@/lib/gemini/geminiMonitoring";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

interface TaxonomyIndustry {
  industry_id: number;
  industry_name: string;
}

interface TaxonomyOrgType {
  organization_type_id: number;
  organization_type_name: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session && !isClientSession(session)) {
      return NextResponse.json({ error: "Forbidden: employer access required." }, { status: 403 });
    }

    const userId = Number(session.userId);
    const body = await req.json().catch(() => ({}));

    const companyName = (body.company_name || "").trim().slice(0, 200);
    const rawNotes = (body.prompt || body.raw_notes || "").trim();
    const promptNotes = rawNotes.slice(0, 4000);
    const website = (body.website || "").trim().slice(0, 300);
    const currentDescription = (body.current_description || "").trim().slice(0, 4000);
    const currentMission = (body.current_mission || "").trim();
    const currentVision = (body.current_vision || "").trim();
    const currentCulture = (body.current_culture || "").trim();
    const currentBenefits = (body.current_benefits || "").trim();

    // 1. Fetch available industries and organization types from taxonomy
    let industries: TaxonomyIndustry[] = [];
    let orgTypes: TaxonomyOrgType[] = [];

    if (DIRECTUS_BASE) {
      try {
        const [indRes, orgRes] = await Promise.all([
          fetch(`${DIRECTUS_BASE}/items/vs_industry?limit=-1&fields=industry_id,industry_name`, {
            headers: getHeaders(),
            cache: "no-store",
          }),
          fetch(`${DIRECTUS_BASE}/items/vs_organization_type?limit=-1&fields=organization_type_id,organization_type_name`, {
            headers: getHeaders(),
            cache: "no-store",
          }),
        ]);

        if (indRes.ok) {
          const indJson = await indRes.json();
          industries = indJson.data || [];
        }
        if (orgRes.ok) {
          const orgJson = await orgRes.json();
          orgTypes = orgJson.data || [];
        }
      } catch (err) {
        console.warn("[company-profile/generate] Failed to fetch taxonomy:", err);
      }
    }

    const industryListStr = industries.map((i) => `ID ${i.industry_id}: "${i.industry_name}"`).join("\n");
    const orgTypeListStr = orgTypes.map((o) => `ID ${o.organization_type_id}: "${o.organization_type_name}"`).join("\n");

    const systemPrompt = `You are an elite corporate branding & technical recruitment intelligence system.
Your task is to analyze company details and generate candidate-facing profile content and classify the company into our controlled taxonomy.

==================== STRICT ARCHITECTURAL & ETHICAL RULES ====================
1. OWNERSHIP MODEL:
   - You are proposing content for the employer to review.
   - Do NOT claim or invent regulatory/legal/factual data.
2. GROUNDING FOR BENEFITS & CULTURE:
   - Do NOT invent unverified perks (e.g. "free daily catered buffet", "4-day workweek", "unlimited paid leave") unless explicitly stated in the input notes.
   - If benefits are not specified, summarize standard competitive employment benefits realistically or organize the provided points cleanly.
   - Culture must reflect professional collaboration, growth, innovation, and integrity without unverifiable claims.
3. TAXONOMY CLASSIFICATION:
   - You MUST pick the most fitting industry from the PROVIDED INDUSTRY LIST below.
   - You MUST return its exact numerical ID and exact name, along with your match confidence percentage (0-100) and a concise 1-sentence reason.
   - You MUST pick the most fitting organization type from the PROVIDED ORG TYPE LIST below with its numerical ID.
4. TAG EXTRACTION:
   - Extract 5-8 high-value industry, technology, and domain tags as a comma-separated string (e.g. "Software Development, Cloud Solutions, SaaS, Artificial Intelligence").

==================== AVAILABLE TAXONOMY ====================
INDUSTRIES:
${industryListStr || "1: Information Technology & Services\n2: Financial Services\n3: Healthcare\n4: E-Commerce"}

ORGANIZATION TYPES:
${orgTypeListStr || "1: Corporation\n2: Sole Proprietorship\n3: Partnership\n4: Startup"}

==================== INPUT CONTEXT ====================
Company Name: ${companyName || "Our Company"}
Website: ${website || "Not provided"}
User Notes / Guidance: ${promptNotes || "Generate high-standard comprehensive company profile content"}
Current Description: ${currentDescription || "None"}
Current Mission: ${currentMission || "None"}
Current Vision: ${currentVision || "None"}
Current Culture: ${currentCulture || "None"}
Current Benefits: ${currentBenefits || "None"}

==================== REQUIRED OUTPUT FORMAT ====================
Return ONLY a valid, parseable JSON object with no markdown fences, no surrounding text:
{
  "company_description": "2-3 well-written paragraphs introducing the company, core business, mission-driven impact, and why talent should join.",
  "company_mission": "A crisp, inspiring 1-2 sentence mission statement.",
  "company_vision": "A forward-looking 1-2 sentence vision statement.",
  "company_culture": "A clear, compelling statement outlining key culture pillars (collaboration, excellence, continuous learning).",
  "company_benefits": "Clean bullet points highlighting standard/provided employee benefits & perks.",
  "company_tags": "Tag1, Tag2, Tag3, Tag4, Tag5",
  "suggested_industry_id": <numerical ID from list or null>,
  "suggested_industry_name": "<exact industry name from list>",
  "industry_confidence": <number between 50 and 99>,
  "industry_reason": "<1 concise sentence explaining why this industry matches>",
  "suggested_organization_type_id": <numerical ID from list or null>,
  "suggested_organization_type_name": "<exact organization type name from list>",
  "org_type_confidence": <number between 50 and 99>
}`;

    const rawResponse = await callGeminiMonitored({
      prompt: systemPrompt,
      feature: "COMPANY_PROFILE_AI",
      endpoint: "/api/client/company-profile/generate",
      requestType: "TEXT",
      provider: "GEMINI",
      userId: userId ?? undefined,
      timeoutMs: 30000,
    });

    if (!rawResponse) {
      return NextResponse.json(
        { error: "AI service did not return a response. Please try again." },
        { status: 502 }
      );
    }

    let parsed: Record<string, unknown> = {};
    try {
      let cleaned = rawResponse.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      parsed = JSON.parse(cleaned);
    } catch {
      console.error(
        "[company-profile/generate] JSON parse error",
        process.env.NODE_ENV === "production" ? "(response content redacted)" : rawResponse
      );
      return NextResponse.json(
        { error: "Failed to parse structured AI output. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: parsed,
    });
  } catch (err: unknown) {
    console.error("POST /api/client/company-profile/generate error:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

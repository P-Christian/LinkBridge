// src/app/api/vos-admin/career-articles/ai-assist/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";
import { callGeminiMonitored } from "@/lib/gemini/geminiMonitoring";
import { AiArticleActionSchema } from "@/modules/vos-admin/career-advice-management/types/article.schema";
import { safeErrorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isAdministratorSession(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = AiArticleActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid AI action payload", details: parsed.error.format() }, { status: 400 });
    }

    const { action, topic, category, target_audience, raw_text, title, content } = parsed.data;
    const userId = Number(session.userId);

    let systemInstruction = "";
    let prompt = "";

    switch (action) {
      case "generate_draft":
        systemInstruction = `You are a high-level Career Coach and Content Strategist for VOS Sync (a platform connecting tech talent, graduates, and companies).
Generate a compelling, well-structured career advice article based on the provided topic.
Return strict JSON with the following schema:
{
  "title": "Engaging, high-CTR article title",
  "category": "One category from: Resume Tips, Interview Prep, Salary Guides, Career Strategy, Remote Work, Leadership, Freelancing, Job Search, Skill Building",
  "excerpt": "A punchy, clear 1-2 sentence teaser/summary (max 180 chars)",
  "read_time_minutes": 5,
  "seo_title": "SEO optimized title (max 60 chars)",
  "seo_description": "SEO meta description with call to action (max 160 chars)",
  "content": "Rich HTML content formatted with <h2>, <h3>, <p>, <ul>, <li>, and <blockquote> tags. DO NOT include markdown code blocks like \`\`\`html."
}`;
        prompt = `TOPIC: ${topic || "Navigating Tech Careers in 2026"}
CATEGORY PREFERENCE: ${category || "Career Strategy"}
TARGET AUDIENCE: ${target_audience || "Early to mid-career professionals and freelancers"}
ADDITIONAL NOTES: ${raw_text || "None"}`;
        break;

      case "proofread":
        systemInstruction = `You are an expert editorial proofreader for professional career publications.
Improve readability, eliminate grammar/spelling errors, and elevate tone to be authoritative, encouraging, and clear.
Preserve existing HTML tags if present.
Return strict JSON:
{
  "proofread_text": "The refined, polished text with formatting preserved",
  "suggestions": ["List of 2-3 notable editorial improvements made"]
}`;
        prompt = `TEXT TO PROOFREAD AND POLISH:
${content || raw_text || ""}`;
        break;

      case "generate_seo":
        systemInstruction = `You are an SEO and OpenGraph specialist for online publications.
Generate an optimized SEO Title, SEO Meta Description, and punchy excerpt from the article content.
Return strict JSON:
{
  "seo_title": "Optimized title under 60 chars",
  "seo_description": "Compelling meta description under 160 chars",
  "excerpt": "Crisp 1-2 sentence summary for article card previews"
}`;
        prompt = `ARTICLE TITLE: ${title || ""}
ARTICLE CONTENT:
${content || ""}`;
        break;

      case "suggest_topics":
      default:
        systemInstruction = `You are an editorial director for a modern tech career advice blog.
Suggest 5 trending, high-impact career advice article topics with outlines.
Return strict JSON:
{
  "suggestions": [
    "Topic 1: Title and angle",
    "Topic 2: Title and angle",
    "Topic 3: Title and angle",
    "Topic 4: Title and angle",
    "Topic 5: Title and angle"
  ]
}`;
        prompt = `CATEGORY: ${category || "General Career Advice"}`;
        break;
    }

    const aiPrompt = `${systemInstruction}\n\nImportant: Output ONLY raw valid JSON without markdown code fences or backticks.\n\n${prompt}`;

    const rawResponse = await callGeminiMonitored({
      prompt: aiPrompt,
      feature: "CAREER_ADVICE_AI",
      endpoint: "/api/vos-admin/career-articles/ai-assist",
      userId,
    });

    if (!rawResponse) {
      return NextResponse.json({ error: "No response from AI model" }, { status: 502 });
    }

    const cleanedText = rawResponse.replace(/```json/gi, "").replace(/```/g, "").trim();
    let resultJson: Record<string, unknown> = {};
    try {
      resultJson = JSON.parse(cleanedText) as Record<string, unknown>;
    } catch {
      resultJson = { raw_output: rawResponse };
    }

    return NextResponse.json({ success: true, data: resultJson });
  } catch (err: unknown) {
    console.error("[api/career-articles/ai-assist POST] Error:", err);
    const message = safeErrorMessage(err, "AI assist failed");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

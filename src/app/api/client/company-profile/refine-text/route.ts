// src/app/api/client/company-profile/refine-text/route.ts
import { NextRequest, NextResponse } from "next/server";
import { callGeminiMonitored } from "@/lib/gemini/geminiMonitoring";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const text = (body.text || "").trim();
    let action = body.action || "improve";
    const customPrompt = (body.custom_prompt || "").trim();
    const fieldType = body.field_type || "company_description";
    const companyName = body.company_name || "the company";

    if (!text && !customPrompt && action !== "regenerate") {
      // If text is empty and no custom prompt, treat as generate fresh draft
      action = "regenerate";
    }

    let instructionDetails = "";
    switch (action) {
      case "candidate_focused":
        instructionDetails = "Rewrite to be highly appealing to prospective candidates, emphasizing impactful work, mission, and career growth.";
        break;
      case "professional":
        instructionDetails = "Elevate the executive tone, business clarity, and professional presentation.";
        break;
      case "shorten":
        instructionDetails = "Condense and make punchy while retaining all critical value propositions and essence.";
        break;
      case "structure":
        instructionDetails = "Organize and format into clear, clean bullet points or distinct structured statements without inventing ungrounded claims.";
        break;
      case "regenerate":
        instructionDetails = `Generate a fresh, industry-standard, high-impact ${fieldType.replace("company_", "")} for ${companyName}.`;
        break;
      case "custom":
        instructionDetails = `Apply this specific instruction: "${customPrompt}"`;
        break;
      case "improve":
      default:
        instructionDetails = "Polish grammar, improve flow, strengthen vocabulary, and maximize overall impact.";
        break;
    }

    const fieldLabel = fieldType.replace("company_", "").replace("_", " ");

    const prompt = `You are a world-class corporate branding and recruitment copywriting expert.
Your task is to refine or generate the ${fieldLabel} for "${companyName}".

==================== GUIDELINES ====================
1. Respect the target field: "${fieldType}".
2. Strict Grounding: DO NOT invent regulatory facts or ungrounded employee perks (e.g. free housing, unlimited leave) unless already in the text.
3. Plain text output only. Do not output markdown fences or code blocks.
4. Output should be ready to paste directly into a profile form.
${fieldType === "company_tags" ? "5. CRITICAL: For company_tags, output only 5 to 8 concise, comma-separated keywords/skills. Total length MUST be strictly under 200 characters. Never exceed 200 characters." : ""}

==================== INSTRUCTION ====================
${instructionDetails}

==================== ORIGINAL CONTENT ====================
${text || "(Empty — generate from scratch)"}
`;

    const refinedText = await callGeminiMonitored({
      prompt,
      feature: "REFINE_COMPANY_TEXT",
      endpoint: "/api/client/company-profile/refine-text",
      requestType: "TEXT",
      provider: "GEMINI",
      userId: userId ?? undefined,
      timeoutMs: 20000,
    });

    if (!refinedText) {
      return NextResponse.json(
        { error: "AI service failed to refine text. Please try again." },
        { status: 502 }
      );
    }

    let cleaned = refinedText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:text|markdown)?\n?/, "").replace(/\n?```$/, "");
    }

    if (fieldType === "company_tags" && cleaned.length > 250) {
      // Safely truncate at the last comma within 240 characters
      const commaIdx = cleaned.lastIndexOf(",", 240);
      if (commaIdx > 0) {
        cleaned = cleaned.substring(0, commaIdx).trim();
      } else {
        cleaned = cleaned.substring(0, 240).trim();
      }
    }

    return NextResponse.json({
      success: true,
      refined_text: cleaned,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

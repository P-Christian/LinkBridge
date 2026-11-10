// src/app/api/client/jobs/refine-text/route.ts
import { NextRequest, NextResponse } from "next/server";
import { callGeminiMonitored } from "@/lib/gemini/geminiMonitoring";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";
import { sanitizeHtml } from "@/lib/sanitize-html";

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
    const action = body.action || "improve"; // "improve" | "concise" | "technical" | "regenerate" | "custom"
    const customPrompt = (body.custom_prompt || "").trim();
    const fieldType = body.field_type || "job_description"; // "job_description" | "job_responsibilities" | "job_qualifications"
    const jobTitle = body.job_title || "Job Posting";

    if (!text && action !== "regenerate" && !(action === "custom" && customPrompt)) {
      return NextResponse.json({ error: "Content is required to refine." }, { status: 400 });
    }

    let fieldScopeDesc = "";
    let fieldFormatRule = "";
    let negativeConstraints = "";

    if (fieldType === "job_description") {
      fieldScopeDesc = "role overview, company and team context, mission, and why this opportunity is compelling";
      fieldFormatRule = "Output clean, structured HTML paragraphs (<p>...</p>) only. Optionally use <b>...</b> for key highlights.";
      negativeConstraints = "CRITICAL BOUNDARY: Strictly DO NOT include bullet points, lists, sections, headings, or summaries for responsibilities, daily tasks, duties, qualifications, requirements, or skills. Those exist as separate dedicated fields in the form.";
    } else if (fieldType === "job_responsibilities") {
      fieldScopeDesc = "day-to-day core responsibilities, key deliverables, and team impact";
      fieldFormatRule = "Output strictly a single <ul> list containing 5 to 8 clear, high-impact <li> bullet items. Each bullet must start with an active verb in the present tense.";
      negativeConstraints = "CRITICAL BOUNDARY: Strictly DO NOT include company introduction, role overview, education, years of experience, requirements, or qualifications. Focus only on actionable daily responsibilities.";
    } else if (fieldType === "job_qualifications") {
      fieldScopeDesc = "required skills, domain experience, technical proficiencies, education, and preferred qualifications";
      fieldFormatRule = "Output strictly a single <ul> list containing 5 to 8 realistic <li> requirement items.";
      negativeConstraints = "CRITICAL BOUNDARY: Strictly DO NOT include company overview, role intro, or day-to-day tasks. Focus only on candidate qualifications and competencies.";
    } else {
      fieldScopeDesc = "professional job posting content";
      fieldFormatRule = "Format output in clean, structured HTML.";
      negativeConstraints = "";
    }

    let instructionDetails = "";
    switch (action) {
      case "concise":
        instructionDetails = "Make this text clear, concise, and punchy. Eliminate filler, fluff, and wordy corporate jargon while preserving essential terminology, metrics, and key details.";
        break;
      case "technical":
        instructionDetails = "Enhance the technical depth, precision, and modern industry terminology appropriate for contemporary software engineering and technology standards.";
        break;
      case "regenerate":
        if (fieldType === "job_description") {
          instructionDetails = `Generate a fresh, engaging 2-3 paragraph overview of the role and team mission for "${jobTitle}". Highlight why this role is exciting and its organizational impact. Under no circumstances should you generate responsibilities or qualifications bullet lists.`;
        } else if (fieldType === "job_responsibilities") {
          instructionDetails = `Generate 5 to 8 realistic, high-impact core daily responsibilities for the position "${jobTitle}", starting each bullet with a strong action verb.`;
        } else if (fieldType === "job_qualifications") {
          instructionDetails = `Generate 5 to 8 realistic, industry-standard qualifications, technical proficiencies, and experience requirements for "${jobTitle}".`;
        } else {
          instructionDetails = `Generate fresh, compelling, and high-standard content for the position "${jobTitle}".`;
        }
        break;
      case "custom":
        instructionDetails = `Apply this user instruction: "${customPrompt}". Ensure the result strictly adheres to the scope of ${fieldScopeDesc}.`;
        break;
      case "improve":
      default:
        if (fieldType === "job_description") {
          instructionDetails = "Elevate the clarity, narrative flow, and professional appeal for top-tier candidates. Focus strictly on the role overview and mission without adding responsibilities or qualifications lists.";
        } else if (fieldType === "job_responsibilities") {
          instructionDetails = "Elevate the impact, clarity, and precision of each responsibility, ensuring strong action verbs and clear ownership.";
        } else {
          instructionDetails = "Elevate the clarity and professionalism of each qualification, ensuring standard industry expectations.";
        }
        break;
    }

    const prompt = `You are an expert technical recruiter and job posting strategist.
You are refining the ${fieldType.replace("job_", "").toUpperCase()} for the role "${jobTitle}".

TARGET FIELD PURPOSE: ${fieldScopeDesc}
ACTION REQUIRED: ${instructionDetails}

ORIGINAL CONTENT:
${text || "(Field is currently empty — generate high-quality content following the instructions)"}

CRITICAL RULES:
1. ${negativeConstraints}
2. FORMATTING: ${fieldFormatRule}
3. Clean HTML only: Return only the inner HTML elements (<p>...</p> or <ul><li>...</li></ul>). Do NOT wrap with <html>, <body>, or markdown code fences (\`\`\`html).
4. No conversational filler: Return the raw HTML only. Do NOT include phrases like "Here is the updated description:".`;

    const refinedHtml = await callGeminiMonitored({
      prompt,
      feature: "REFINE_JOB_TEXT",
      endpoint: "/api/client/jobs/refine-text",
      requestType: "TEXT",
      provider: "GEMINI",
      userId: userId ?? undefined,
      timeoutMs: 20000,
    });

    if (!refinedHtml) {
      return NextResponse.json(
        { error: "AI service failed to refine text. Please try again." },
        { status: 502 }
      );
    }

    let cleaned = refinedHtml.trim();
    cleaned = cleaned.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      cleaned = bodyMatch[1].trim();
    }

    return NextResponse.json({
      success: true,
      refined_html: sanitizeHtml(cleaned),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}

// src/app/api/client/jobs/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { callGeminiMonitored } from "@/lib/gemini/geminiMonitoring";
import { CANONICAL_ROLE_CATEGORIES } from "@/modules/client/jobs/hooks/useRoleCategories";
import { checkRestrictionState } from "@/lib/status-validator";
import { ExperienceLevel } from "@/modules/client/jobs/types";
import { getPHTimeString } from "@/lib/utils";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const EDUCATION_OPTIONS = [
  "High School Graduate",
  "Vocational / Associate Degree",
  "Bachelor's Degree Graduate",
  "Master's Degree / Post-Graduate",
  "Doctorate / PhD",
  "No Education Requirement / Open to All",
];

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}


async function resolveCompanyProfile(userId: number) {
  const linkUrl = `${DIRECTUS_BASE}/items/vs_company_user?filter[user_id][_eq]=${userId}&fields=company_id&limit=1`;
  const linkRes = await fetch(linkUrl, { headers: getHeaders(), cache: "no-store" });
  const linkJson = await linkRes.json().catch(() => ({}));
  const link = linkJson.data?.[0];
  if (!link) return null;

  const companyRes = await fetch(
    `${DIRECTUS_BASE}/items/vs_company/${link.company_id}?fields=*`,
    { headers: getHeaders(), cache: "no-store" }
  );
  const companyJson = await companyRes.json().catch(() => ({}));
  return companyJson.data || null;
}

function normalizeExpLevel(lvl: string | null | undefined): ExperienceLevel {
  if (!lvl) return "MID";
  const u = String(lvl).toUpperCase().trim();
  if (u.includes("ENTRY") || u.includes("JUNIOR") || u.includes("FRESH") || u.includes("ASSOCIATE")) return "ENTRY";
  if (u.includes("SENIOR") || u.includes("LEAD") || u.includes("PRINCIPAL") || u.includes("STAFF")) return "SENIOR";
  if (u.includes("MANAGER") || u.includes("HEAD")) return "MANAGER";
  if (u.includes("EXECUTIVE") || u.includes("DIRECTOR") || u.includes("VP") || u.includes("CHIEF")) return "EXECUTIVE";
  return "MID";
}

function normalizeEducation(edu: string | null | undefined): string {
  if (!edu) return "Bachelor's Degree Graduate";
  const match = EDUCATION_OPTIONS.find((opt) => opt.toLowerCase() === edu.toLowerCase().trim());
  if (match) return match;
  const l = edu.toLowerCase();
  if (l.includes("bachelor") || l.includes("degree") || l.includes("college") || l.includes("bs") || l.includes("ba")) return "Bachelor's Degree Graduate";
  if (l.includes("master") || l.includes("post-grad") || l.includes("ms") || l.includes("mba")) return "Master's Degree / Post-Graduate";
  if (l.includes("phd") || l.includes("doctor")) return "Doctorate / PhD";
  if (l.includes("high school") || l.includes("secondary")) return "High School Graduate";
  if (l.includes("vocational") || l.includes("associate") || l.includes("diploma")) return "Vocational / Associate Degree";
  if (l.includes("open") || l.includes("no requirement") || l.includes("any")) return "No Education Requirement / Open to All";
  return "Bachelor's Degree Graduate";
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

    // Validate PUBLISH_JOBS Restriction
    const restriction = await checkRestrictionState(userId, "PUBLISH_JOBS");
    if (restriction.restricted) {
      if (restriction.reason === "unavailable") {
        return NextResponse.json(
          { error: "Your account status could not be verified, so the draft was not generated. Please try again." },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "Your job posting privileges are temporarily suspended." },
        { status: 403 }
      );
    }

    const company = await resolveCompanyProfile(userId);
    if (!company) {
      return NextResponse.json({ error: "Company profile not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const rawPrompt = (body.prompt || "").trim();

    if (!rawPrompt) {
      return NextResponse.json({ error: "Job description prompt is required." }, { status: 400 });
    }

    const userPrompt = rawPrompt.slice(0, 4000);

    // 1. Fetch active categories from vs_role_category
    let activeCategories = CANONICAL_ROLE_CATEGORIES;
    if (DIRECTUS_BASE) {
      try {
        const catRes = await fetch(`${DIRECTUS_BASE}/items/vs_role_category?limit=-1`, {
          headers: getHeaders(),
          cache: "no-store",
        });
        if (catRes.ok) {
          const catJson = await catRes.json();
          if (catJson.data && catJson.data.length > 0) {
            activeCategories = catJson.data;
          }
        }
      } catch {
        // fallback
      }
    }

    const categoryTaxonomyList = activeCategories
      .map((c) => `- ID ${c.category_id}: "${c.category_name}" (${c.category_code}) — ${c.description || ""}`)
      .join("\n");

    const fullCompanyAddress =
      company.company_address ||
      [company.company_city, company.company_province, "Philippines"].filter(Boolean).join(", ") ||
      "Metro Manila, Philippines";

    // 2. Build Gemini System Prompt
    const systemPrompt = `You are an expert AI Technical Recruiter and Job Specification Architect for VOS Sync.
Your task is to analyze the employer's prompt and generate a structured, highly professional, and complete job posting draft.

### EMPLOYER & COMPANY PROFILE:
- Company Name: ${company.company_name || "Employer"}
- Industry: ${company.industry || "Technology"}
- Company Description: ${company.company_description || "Not specified"}
- Company Full Address: ${fullCompanyAddress}

### CANONICAL ROLE CATEGORIES TAXONOMY:
${categoryTaxonomyList}

### USER JOB CREATION PROMPT:
"${userPrompt}"

### CRITICAL RULES:
1. **Category Classification & Suggestions**:
   - First, check if the job fits well into an existing category from the Canonical Taxonomy list above. If so, map \`category_id\` to that number, \`job_category\` to that exact category name, and set \`is_new_category_suggested: false\`.
   - If the role does NOT reasonably fit any existing category (e.g. specialized or emerging fields like Cybersecurity, Blockchain / Web3, Game Development, Hardware & Embedded Systems, Biotechnology, etc.), you CAN suggest a new category! In that case:
     * Set \`category_id: null\`
     * Set \`job_category\` and \`suggested_category_name\` to a concise, standardized category title (e.g. "Game Development & Interactive Media", "Cybersecurity & InfoSec", "Blockchain & Web3 Engineering")
     * Set \`is_new_category_suggested: true\`
     * Provide a clear 1-sentence \`category_suggestion_rationale\` explaining why this role warrants its own category.
2. **Rich Text HTML Structure**:
   - \`job_description\`: An engaging overview of the role and team in clean HTML (<p>...</p>).
   - \`job_responsibilities\`: A clear bullet list of core day-to-day duties in HTML (<ul><li>...</li></ul>).
   - \`job_qualifications\`: A clear bullet list of requirements, experience, and skills in HTML (<ul><li>...</li></ul>).
3. **SALARY STRICT COMPLIANCE**:
   - NEVER invent or fabricate salary numbers.
   - If the user prompt explicitly mentions a salary, budget, or rate (e.g. "budget is 60k-80k PHP" or "$1000/mo"): extract \`salary_min\`, \`salary_max\`, \`currency\`, \`salary_type\`, and set \`salary_negotiable: false\`.
   - If user prompt DOES NOT mention specific salary numbers, you MUST set \`salary_negotiable: true\`, \`salary_min: null\`, \`salary_max: null\`, \`salary_type: "Salary Range"\`.
4. **Location**: MUST BE the company address: "${fullCompanyAddress}".
5. **Work Arrangement**: Must be one of: "Remote", "Hybrid", or "On-site".
6. **Employment Type**: Must be one of: "FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", or "FREELANCE".
7. **Experience Level**: MUST BE strictly one of: "ENTRY", "MID", "SENIOR", "MANAGER", or "EXECUTIVE".
8. **Education**: MUST BE strictly one of:
   - "Bachelor's Degree Graduate"
   - "High School Graduate"
   - "Vocational / Associate Degree"
   - "Master's Degree / Post-Graduate"
   - "Doctorate / PhD"
   - "No Education Requirement / Open to All"
9. **Screening Questions**: Return an array of 2 to 4 relevant candidate screening questions tailored to this role.
10. **Skills**: Return an array of 5–12 specific technical & professional skill strings extracted for this role (e.g. ["React", "TypeScript", "Node.js", "PostgreSQL", "Docker"]).
11. **Benefits & Custom Perks**: Must include at minimum "13th Month Pay & Bonuses" and "Paid Leave (Sick, Vacation)". In addition, IF the user prompt specifies any particular perks, allowances, or incentives (e.g. gym subsidy, HMO / medical insurance, equipment allowance, free meals, profit sharing, stock options, internet stipend, travel allowance), you MUST extract and include them as items in the "benefits" array.

### OUTPUT FORMAT:
You MUST return ONLY valid JSON matching this exact structure without markdown backticks:
{
  "job_title": "string",
  "category_id": 4,
  "job_category": "Full Stack Software Engineering",
  "is_new_category_suggested": false,
  "suggested_category_name": null,
  "category_suggestion_rationale": null,
  "job_type": "FULL_TIME",
  "work_arrangement": "Remote",
  "job_location": "${fullCompanyAddress}",
  "experience_level": "MID",
  "education": "Bachelor's Degree Graduate",
  "number_of_openings": "1",
  "job_description": "<p>...</p>",
  "job_responsibilities": "<ul><li>...</li></ul>",
  "job_qualifications": "<ul><li>...</li></ul>",
  "skills": ["string"],
  "benefits": ["13th Month Pay & Bonuses", "Paid Leave (Sick, Vacation)"],
  "screening_questions": ["string"],
  "salary_type": "Salary Range",
  "currency": "PHP",
  "salary_min": "number_or_null",
  "salary_max": "number_or_null",
  "salary_negotiable": true
}`;

    // 3. Call Gemini
    const geminiRaw = await callGeminiMonitored({
      prompt: systemPrompt,
      feature: "AUTO_CREATE_JOB",
      endpoint: "/api/client/jobs/generate",
      requestType: "TEXT",
      provider: "GEMINI",
      userId,
      companyId: company.company_id,
      timeoutMs: 35000,
    });

    if (!geminiRaw) {
      return NextResponse.json(
        { error: "AI service was unable to generate the job draft. Please try again." },
        { status: 502 }
      );
    }

    // Clean JSON response (strip markdown wrappers if present)
    let cleanedJson = geminiRaw.trim();
    if (cleanedJson.startsWith("```")) {
      cleanedJson = cleanedJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let parsedDraft: Record<string, unknown>;
    try {
      parsedDraft = JSON.parse(cleanedJson);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI-generated job specification." },
        { status: 502 }
      );
    }

    // 4. Resolve Master Skill IDs from vs_master_skills
    const rawSkillNames = Array.isArray(parsedDraft.skills)
      ? (parsedDraft.skills as string[]).map((s) => String(s).trim()).filter(Boolean)
      : [];

    const resolvedSkills: { id: number; skill_name: string }[] = [];

    if (DIRECTUS_BASE && rawSkillNames.length > 0) {
      for (const skillName of rawSkillNames) {
        try {
          const findUrl = `${DIRECTUS_BASE}/items/vs_master_skills?filter[skill_name][_icontains]=${encodeURIComponent(skillName)}&fields=id,skill_name&limit=1`;
          const findRes = await fetch(findUrl, { headers: getHeaders(), cache: "no-store" });
          if (findRes.ok) {
            const findJson = await findRes.json();
            const foundSkill = findJson.data?.[0];
            if (foundSkill) {
              resolvedSkills.push({ id: foundSkill.id, skill_name: foundSkill.skill_name });
              continue;
            }
          }

          // Fallback: register new skill in vs_master_skills if absent
          const createRes = await fetch(`${DIRECTUS_BASE}/items/vs_master_skills`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ skill_name: skillName, skill_category: "General" }),
          });
          if (createRes.ok) {
            const createJson = await createRes.json();
            if (createJson.data?.id) {
              resolvedSkills.push({ id: createJson.data.id, skill_name: skillName });
              continue;
            }
          }
          resolvedSkills.push({ id: 0, skill_name: skillName });
        } catch {
          resolvedSkills.push({ id: 0, skill_name: skillName });
        }
      }
    } else {
      rawSkillNames.forEach((s, idx) => {
        resolvedSkills.push({ id: idx + 1, skill_name: s });
      });
    }

    // 5. Category Verification & Suggestion Recording
    let finalCategoryId = Number(parsedDraft.category_id) || null;
    let finalCategoryName = (parsedDraft.job_category as string) || "";
    const isNewCategorySuggested = Boolean(parsedDraft.is_new_category_suggested);
    const suggestedCategoryName = (parsedDraft.suggested_category_name as string) || finalCategoryName;
    const categoryRationale = (parsedDraft.category_suggestion_rationale as string) || "";

    if (!isNewCategorySuggested && finalCategoryId) {
      const matchedCat = activeCategories.find((c) => c.category_id === finalCategoryId);
      if (matchedCat) {
        finalCategoryName = matchedCat.category_name;
      }
    } else if (!isNewCategorySuggested && finalCategoryName) {
      const byName = activeCategories.find(
        (c) => c.category_name.toLowerCase() === finalCategoryName.toLowerCase()
      );
      if (byName) {
        finalCategoryId = byName.category_id;
        finalCategoryName = byName.category_name;
      }
    }

    // If new category was suggested by AI, automatically record proposal in vs_role_category_suggestion
    if (isNewCategorySuggested && suggestedCategoryName && DIRECTUS_BASE) {
      try {
        const createSugUrl = `${DIRECTUS_BASE}/items/vs_role_category_suggestion`;
        await fetch(createSugUrl, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            suggested_category_name: suggestedCategoryName.trim(),
            description: categoryRationale || "Suggested via Auto Create Job AI generator.",
            submitted_by_user_id: userId,
            company_id: company.company_id,
            status: "PENDING",
            created_at: getPHTimeString(),
          }),
        }).catch(() => {});
      } catch {
        // non-blocking
      }
    }

    // 6. Benefits Normalization (Ensure 13th Month Pay & Bonuses and Paid Leave are default checked)
    const defaultBenefits = ["13th Month Pay & Bonuses", "Paid Leave (Sick, Vacation)"];
    const extractedBenefits = Array.isArray(parsedDraft.benefits)
      ? (parsedDraft.benefits as string[]).map((b) => String(b).trim()).filter(Boolean)
      : [];
    const mergedBenefits = Array.from(new Set([...defaultBenefits, ...extractedBenefits]));

    // 7. Salary Normalization (If no salary specified, check negotiable / undisclosed)
    const hasExplicitSalary =
      parsedDraft.salary_min != null &&
      parsedDraft.salary_min !== "" &&
      String(parsedDraft.salary_min) !== "null";

    const isNegotiable =
      parsedDraft.salary_negotiable !== undefined
        ? Boolean(parsedDraft.salary_negotiable)
        : !hasExplicitSalary;

    // 8. Screening Questions Normalization
    const rawScreening = Array.isArray(parsedDraft.screening_questions)
      ? (parsedDraft.screening_questions as string[]).map((q) => String(q).trim()).filter(Boolean)
      : [];
    const screeningQuestions =
      rawScreening.length > 0
        ? rawScreening
        : [
            `How many years of professional experience do you have in ${parsedDraft.job_title || "this role"}?`,
            "Are you comfortable working in the specified work arrangement (Remote / Hybrid / On-site)?",
          ];

    const structuredJob = {
      job_title: (parsedDraft.job_title as string) || "New Position",
      category_id: finalCategoryId,
      job_category: finalCategoryName || suggestedCategoryName,
      is_new_category_suggested: isNewCategorySuggested,
      suggested_category_name: suggestedCategoryName,
      category_suggestion_rationale: categoryRationale,
      job_type: (parsedDraft.job_type as string) || "FULL_TIME",
      work_arrangement: (parsedDraft.work_arrangement as string) || "Remote",
      job_location: fullCompanyAddress,
      job_department: (parsedDraft.job_department as string) || "Engineering",
      experience_level: normalizeExpLevel(parsedDraft.experience_level as string),
      education: normalizeEducation(parsedDraft.education as string),
      number_of_openings: String(parsedDraft.number_of_openings || "1"),
      job_description: (parsedDraft.job_description as string) || "",
      job_responsibilities: (parsedDraft.job_responsibilities as string) || "",
      job_qualifications: (parsedDraft.job_qualifications as string) || "",
      skills: resolvedSkills,
      benefits: mergedBenefits,
      screening_questions: screeningQuestions,
      salary_type: (parsedDraft.salary_type as string) || "Salary Range",
      currency: (parsedDraft.currency as string) || "PHP",
      salary_min: hasExplicitSalary ? String(parsedDraft.salary_min) : "",
      salary_max:
        hasExplicitSalary && parsedDraft.salary_max != null && parsedDraft.salary_max !== ""
          ? String(parsedDraft.salary_max)
          : "",
      salary_negotiable: isNegotiable,
    };

    return NextResponse.json({
      success: true,
      job: structuredJob,
      company: {
        company_name: company.company_name,
        industry: company.industry,
      },
    });
  } catch (err: unknown) {
    console.error("Error generating job draft:", err);
    return NextResponse.json(
      { error: safeErrorMessage(err, "Internal server error") },
      { status: 500 }
    );
  }
}
